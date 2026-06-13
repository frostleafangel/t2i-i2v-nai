const fs = require('fs');
const path = require('path');

// 清理目标目录
const NOVELAI_UPLOAD_DIR = path.join(__dirname, '../uploads/novelai');

// 配置
const MAX_AGE_DAYS = 30; // 文件最大保留天数
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 每 24 小时执行一次

/**
 * 清理指定目录中超过指定天数的文件
 * 只清理文件，不清理子目录
 */
function cleanupOldFiles() {
    const now = Date.now();
    const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    let freedBytes = 0;
    let errorCount = 0;

    // 检查目录是否存在
    if (!fs.existsSync(NOVELAI_UPLOAD_DIR)) {
        console.log('[Cleanup] uploads/novelai 目录不存在，跳过清理');
        return { deletedCount: 0, freedBytes: 0, errorCount: 0 };
    }

    let files;
    let protectedFiles = new Set();

    try {
        // 获取数据库中受保护的文件列表（已被风格库引用为封面图的图片）
        // 动态加载数据库以避免循环引用
        const { db } = require('../database');
        
        // 1. 获取风格库封面
        const styleCovers = db.prepare('SELECT cover_image_url FROM styles').all();
        styleCovers.forEach(row => {
            if (row.cover_image_url && row.cover_image_url.startsWith('/uploads/novelai/')) {
                const filename = row.cover_image_url.replace('/uploads/novelai/', '');
                protectedFiles.add(filename);
            }
        });

        // 2. 获取画廊中的 NovelAI 图片
        const galleryFiles = db.prepare("SELECT filename FROM gallery_images WHERE source = 'novelai' AND is_deleted = 0").all();
        galleryFiles.forEach(row => {
            if (row.filename) {
                protectedFiles.add(row.filename);
            }
        });

        files = fs.readdirSync(NOVELAI_UPLOAD_DIR);
    } catch (err) {
        console.error('[Cleanup] 读取目录或查询数据库失败:', err.message);
        return { deletedCount: 0, freedBytes: 0, errorCount: 1 };
    }

    for (const file of files) {
        // 跳过 .gitkeep 等隐藏文件
        if (file.startsWith('.')) continue;

        // 跳过受保护的文件
        if (protectedFiles.has(file)) {
            // console.log(`[Cleanup] 跳过受保护的文件: ${file}`);
            continue;
        }

        const filePath = path.join(NOVELAI_UPLOAD_DIR, file);

        try {
            const stat = fs.statSync(filePath);

            // 只处理文件，跳过子目录
            if (!stat.isFile()) continue;

            const fileAge = now - stat.mtimeMs;

            if (fileAge > maxAgeMs) {
                fs.unlinkSync(filePath);
                deletedCount++;
                freedBytes += stat.size;
            }
        } catch (err) {
            // 单个文件失败不影响其他文件的清理
            console.error(`[Cleanup] 删除文件失败 ${file}:`, err.message);
            errorCount++;
        }
    }

    return { deletedCount, freedBytes, errorCount };
}

/**
 * 执行清理并输出日志
 */
function runCleanup() {
    console.log(`[Cleanup] 开始清理 ${MAX_AGE_DAYS} 天前的 NovelAI 生成图片...`);
    const startTime = Date.now();

    const { deletedCount, freedBytes, errorCount } = cleanupOldFiles();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const freedMB = (freedBytes / 1024 / 1024).toFixed(2);

    if (deletedCount > 0) {
        console.log(`[Cleanup] ✅ 清理完成：删除了 ${deletedCount} 个文件，释放了 ${freedMB} MB 空间（耗时 ${elapsed}s）`);
    } else {
        console.log(`[Cleanup] ✅ 无需清理：没有超过 ${MAX_AGE_DAYS} 天的文件`);
    }

    if (errorCount > 0) {
        console.warn(`[Cleanup] ⚠️ ${errorCount} 个文件删除失败，请检查日志`);
    }
}

/**
 * 启动定时清理调度器
 * - 服务启动时立即执行一次
 * - 之后每 24 小时执行一次
 */
function startCleanupScheduler() {
    // 启动时立即执行一次
    runCleanup();

    // 设置定时任务
    const intervalId = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

    // 确保定时器不阻止进程退出
    if (intervalId.unref) {
        intervalId.unref();
    }

    console.log(`[Cleanup] 📅 定时清理已启动：每 24 小时清理一次超过 ${MAX_AGE_DAYS} 天的图片`);
}

module.exports = {
    startCleanupScheduler,
    runCleanup, // 导出以便手动触发
    cleanupOldFiles // 导出以便测试
};
