/**
 * 标签搜索服务
 * 封装 Web Worker 通信，提供简洁的搜索 API
 */

// 搜索结果类型
export interface TagSearchResult {
    name: string;      // 英文标签名
    zhName: string;    // 中文翻译
    category: number;  // 类型 (0=通用, 1=艺术家, 3=版权, 4=角色, 5=元数据)
    count: number;     // 使用次数
    score: number;     // 匹配得分
}

// 标签类型名称映射
export const TAG_CATEGORY_NAMES: Record<number, string> = {
    0: '通用',
    1: '艺术家',
    3: '版权',
    4: '角色',
    5: '元数据',
};

// 标签类型颜色映射（Danbooru 标准）
export const TAG_CATEGORY_COLORS: Record<number, string> = {
    0: '#3b82f6',   // 蓝色 - 通用 (General)
    1: '#ef4444',   // 红色 - 艺术家 (Artist)
    3: '#a855f7',   // 紫色 - 版权 (Copyright)
    4: '#22c55e',   // 绿色 - 角色 (Character)
    5: '#f59e0b',   // 橙色 - 元数据 (Meta)
};

// 消息 ID 计数器
let messageId = 0;

// 待处理的请求
const pendingRequests = new Map<number, {
    resolve: (value: TagSearchResult[]) => void;
    reject: (reason: Error) => void;
}>();

// Worker 实例
let worker: Worker | null = null;
let isLoading = false;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * 初始化 Worker
 */
function initWorker(): Worker {
    if (worker) {
        return worker;
    }

    // 使用 Vite 的 Worker 导入语法
    worker = new Worker(
        new URL('./workers/tagSearchWorker.ts', import.meta.url),
        { type: 'module' }
    );

    worker.onmessage = (event) => {
        const { type, id, results, error, tagCount } = event.data;

        if (type === 'ready') {
            console.log('[TagService] Worker 已准备就绪');
            return;
        }

        if (type === 'loaded') {
            const { fromCache } = event.data;
            const source = fromCache ? '(来自缓存)' : '(来自网络)';
            console.log(`[TagService] 标签数据已加载: ${tagCount} 个标签 ${source}`);
            isLoaded = true;
            isLoading = false;
            return;
        }

        const pending = pendingRequests.get(id);
        if (!pending) {
            return;
        }

        pendingRequests.delete(id);

        if (type === 'error') {
            pending.reject(new Error(error));
        } else if (type === 'searchResult') {
            pending.resolve(results || []);
        }
    };

    worker.onerror = (error) => {
        console.error('[TagService] Worker 错误:', error);
        // 拒绝所有待处理的请求
        pendingRequests.forEach(({ reject }) => {
            reject(new Error('Worker error'));
        });
        pendingRequests.clear();
    };

    return worker;
}

/**
 * 加载标签数据
 */
export async function loadTagData(): Promise<void> {
    if (isLoaded) {
        return;
    }

    if (loadPromise) {
        return loadPromise;
    }

    if (isLoading) {
        return;
    }

    isLoading = true;
    const w = initWorker();

    loadPromise = new Promise((resolve, reject) => {
        const id = messageId++;

        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error('加载超时'));
        }, 30000);

        pendingRequests.set(id, {
            resolve: () => {
                clearTimeout(timeout);
                resolve();
            },
            reject: (error) => {
                clearTimeout(timeout);
                reject(error);
            },
        });

        w.postMessage({ type: 'load', id });
    });

    return loadPromise;
}

/**
 * 搜索标签
 * @param query 搜索词
 * @param limit 最大结果数量
 * @returns 搜索结果数组
 */
export async function searchTags(
    query: string,
    limit: number = 20
): Promise<TagSearchResult[]> {
    const trimmed = query.trim();

    if (!trimmed) {
        return [];
    }

    const w = initWorker();

    // 确保数据已加载
    if (!isLoaded) {
        try {
            await loadTagData();
        } catch (error) {
            console.error('[TagService] 加载数据失败:', error);
            return [];
        }
    }

    return new Promise((resolve, reject) => {
        const id = messageId++;

        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            resolve([]); // 超时返回空结果，不抛出错误
        }, 5000);

        pendingRequests.set(id, {
            resolve: (results) => {
                clearTimeout(timeout);
                resolve(results);
            },
            reject: (error) => {
                clearTimeout(timeout);
                reject(error);
            },
        });

        w.postMessage({ type: 'search', id, query: trimmed, limit });
    });
}

/**
 * 预加载标签数据（可选，在应用启动时调用以提前加载）
 */
export function preloadTagData(): void {
    loadTagData().catch((error) => {
        console.warn('[TagService] 预加载失败:', error);
    });
}

/**
 * 销毁 Worker（清理资源）
 */
export function destroyWorker(): void {
    if (worker) {
        worker.terminate();
        worker = null;
    }
    isLoaded = false;
    isLoading = false;
    loadPromise = null;
    pendingRequests.clear();
}
