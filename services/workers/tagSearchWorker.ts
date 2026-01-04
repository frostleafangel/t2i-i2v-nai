/**
 * 标签搜索 Web Worker
 * 在独立线程中执行标签搜索，避免阻塞主线程
 * 支持 IndexedDB 缓存，避免重复下载数据
 */

import uFuzzy from '@leeoniya/ufuzzy';

// 标签数据结构 [name, zhName, pinyinFull, pinyinInitials, category, count]
type TagEntry = [string, string, string, string, number, number];

// 搜索结果
interface SearchResult {
    name: string;      // 英文标签名
    zhName: string;    // 中文翻译
    category: number;  // 类型 (0=通用, 1=艺术家, 3=版权, 4=角色, 5=元数据)
    count: number;     // 使用次数
    score: number;     // 匹配得分
}

// Worker 消息类型
interface WorkerMessage {
    type: 'search' | 'load';
    id: number;
    query?: string;
    limit?: number;
}

interface WorkerResponse {
    type: 'searchResult' | 'loaded' | 'error';
    id: number;
    results?: SearchResult[];
    error?: string;
    tagCount?: number;
    fromCache?: boolean;
}

// IndexedDB 配置
const DB_NAME = 'TagAutocompleteDB';
const DB_VERSION = 1;
const STORE_NAME = 'tagData';
const CACHE_KEY = 'danbooru_tags';
const VERSION_KEY = 'data_version';

// 数据存储
let tags: TagEntry[] = [];
let englishNames: string[] = [];
let chineseNames: string[] = [];
let pinyinFull: string[] = [];
let pinyinInitials: string[] = [];

// 搜索引擎实例
let fuzzyEn: uFuzzy;
let fuzzyZh: uFuzzy;
let fuzzyPy: uFuzzy;

// 是否已初始化
let isLoaded = false;

/**
 * 打开 IndexedDB 数据库
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

/**
 * 从 IndexedDB 读取数据
 */
async function getFromCache(key: string): Promise<any> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            tx.oncomplete = () => db.close();
        });
    } catch (error) {
        console.warn('[TagWorker] IndexedDB 读取失败:', error);
        return null;
    }
}

/**
 * 写入数据到 IndexedDB
 */
async function setToCache(key: string, value: any): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(value, key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();

            tx.oncomplete = () => db.close();
        });
    } catch (error) {
        console.warn('[TagWorker] IndexedDB 写入失败:', error);
    }
}

/**
 * 初始化搜索引擎
 */
function initSearchEngines() {
    // 英文搜索配置 - 前缀匹配优先
    fuzzyEn = new uFuzzy({
        intraMode: 1,       // 单词内模糊
        intraIns: 1,        // 允许1个插入
        intraSub: 1,        // 允许1个替换
        intraTrn: 1,        // 允许1个换位
        intraDel: 1,        // 允许1个删除
    });

    // 中文搜索配置
    fuzzyZh = new uFuzzy({
        intraMode: 0,       // 精确匹配
    });

    // 拼音搜索配置
    fuzzyPy = new uFuzzy({
        intraMode: 1,
        intraIns: 1,
    });
}

/**
 * 构建索引数组
 */
function buildIndexes() {
    englishNames = tags.map(t => t[0]);
    chineseNames = tags.map(t => t[1] || '');
    pinyinFull = tags.map(t => t[2] || '');
    pinyinInitials = tags.map(t => t[3] || '');

    initSearchEngines();
    isLoaded = true;
}

/**
 * 加载标签数据（支持 IndexedDB 缓存）
 */
async function loadData(): Promise<{ count: number; fromCache: boolean }> {
    try {
        // 1. 尝试从缓存加载
        const cachedData = await getFromCache(CACHE_KEY);
        const cachedVersion = await getFromCache(VERSION_KEY);

        // 2. 获取服务端数据版本（通过 HEAD 请求检查 Last-Modified）
        let serverVersion = '';
        try {
            const headResponse = await fetch('/data/danbooru_tags.json', { method: 'HEAD' });
            serverVersion = headResponse.headers.get('last-modified') ||
                headResponse.headers.get('etag') ||
                Date.now().toString();
        } catch {
            // 如果 HEAD 请求失败，使用当前时间作为版本
            serverVersion = Date.now().toString();
        }

        // 3. 如果有缓存且版本匹配，使用缓存
        if (cachedData && cachedVersion === serverVersion) {
            console.log('[TagWorker] 从 IndexedDB 缓存加载数据');
            tags = cachedData;
            buildIndexes();
            return { count: tags.length, fromCache: true };
        }

        // 4. 否则从网络加载
        console.log('[TagWorker] 从网络加载数据...');
        const response = await fetch('/data/danbooru_tags.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        tags = await response.json();
        buildIndexes();

        // 5. 保存到缓存
        console.log('[TagWorker] 保存到 IndexedDB 缓存...');
        await setToCache(CACHE_KEY, tags);
        await setToCache(VERSION_KEY, serverVersion);

        return { count: tags.length, fromCache: false };
    } catch (error) {
        console.error('[TagWorker] 加载数据失败:', error);
        throw error;
    }
}

/**
 * 检测查询类型
 */
function detectQueryType(query: string): 'english' | 'chinese' | 'pinyin' {
    // 检测是否包含中文字符
    if (/[\u4e00-\u9fa5]/.test(query)) {
        return 'chinese';
    }

    // 检测是否为纯小写字母（可能是拼音）
    // 短查询（<=4字符）且全小写倾向于拼音首字母搜索
    if (/^[a-z]+$/.test(query) && query.length <= 4) {
        return 'pinyin';
    }

    return 'english';
}

/**
 * 执行搜索
 */
function search(query: string, limit: number = 20): SearchResult[] {
    if (!isLoaded || !query.trim()) {
        return [];
    }

    query = query.toLowerCase().trim();

    // 清理权重语法符号
    query = query.replace(/[{}[\]()]/g, '');

    if (!query) {
        return [];
    }

    const queryType = detectQueryType(query);
    const results: Map<number, { score: number }> = new Map();

    // 1. 英文精确匹配和前缀匹配（最高优先级）
    for (let i = 0; i < englishNames.length; i++) {
        const name = englishNames[i].toLowerCase();
        if (name === query) {
            results.set(i, { score: 1000000 + tags[i][5] });
        } else if (name.startsWith(query)) {
            results.set(i, { score: 500000 + tags[i][5] });
        }
    }

    // 1.5 英文包含匹配（支持搜索 xxx_sleeves 这样的后缀标签）
    if (query.length >= 3) {  // 至少3个字符才做包含搜索，避免过多结果
        for (let i = 0; i < englishNames.length; i++) {
            if (results.has(i)) continue;  // 已匹配的跳过
            const name = englishNames[i].toLowerCase();
            if (name.includes(query)) {
                results.set(i, { score: 450000 + tags[i][5] });
            }
        }
    }

    // 2. 中文精确匹配
    if (queryType === 'chinese') {
        for (let i = 0; i < chineseNames.length; i++) {
            if (chineseNames[i] && chineseNames[i].includes(query)) {
                const existing = results.get(i);
                const score = 400000 + tags[i][5];
                if (!existing || existing.score < score) {
                    results.set(i, { score });
                }
            }
        }
    }

    // 3. 拼音首字母匹配
    if (queryType === 'pinyin' || queryType === 'english') {
        for (let i = 0; i < pinyinInitials.length; i++) {
            const initials = pinyinInitials[i];
            if (initials && initials.startsWith(query)) {
                const existing = results.get(i);
                const score = 300000 + tags[i][5];
                if (!existing || existing.score < score) {
                    results.set(i, { score });
                }
            }
        }
    }

    // 4. 拼音全拼匹配
    if (queryType === 'pinyin' || query.length > 2) {
        for (let i = 0; i < pinyinFull.length; i++) {
            const full = pinyinFull[i];
            if (full && full.includes(query)) {
                const existing = results.get(i);
                const score = 200000 + tags[i][5];
                if (!existing || existing.score < score) {
                    results.set(i, { score });
                }
            }
        }
    }

    // 5. 英文模糊匹配（兜底）
    if (results.size < limit && queryType === 'english') {
        const [idxs, info, order] = fuzzyEn.search(englishNames, query);
        if (idxs && order) {
            for (let j = 0; j < Math.min(order.length, limit * 2); j++) {
                const i = idxs[order[j]];
                const existing = results.get(i);
                const score = 100000 - j * 1000 + tags[i][5] / 1000;
                if (!existing || existing.score < score) {
                    results.set(i, { score });
                }
            }
        }
    }

    // 排序并限制结果数量
    const sortedResults = Array.from(results.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, limit)
        .map(([idx, { score }]) => {
            const tag = tags[idx];
            return {
                name: tag[0],
                zhName: tag[1],
                category: tag[4],
                count: tag[5],
                score,
            };
        });

    return sortedResults;
}

// 消息处理
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { type, id, query, limit } = event.data;

    try {
        if (type === 'load') {
            const { count, fromCache } = await loadData();
            const response: WorkerResponse = {
                type: 'loaded',
                id,
                tagCount: count,
                fromCache,
            };
            self.postMessage(response);
        } else if (type === 'search') {
            if (!isLoaded) {
                await loadData();
            }

            const results = search(query || '', limit || 20);
            const response: WorkerResponse = {
                type: 'searchResult',
                id,
                results,
            };
            self.postMessage(response);
        }
    } catch (error) {
        const response: WorkerResponse = {
            type: 'error',
            id,
            error: error instanceof Error ? error.message : String(error),
        };
        self.postMessage(response);
    }
};

// 通知主线程 Worker 已准备就绪
self.postMessage({ type: 'ready' });
