#!/usr/bin/env node
/**
 * 为现有画廊图片生成缩略图
 * 用法: node scripts/generate-thumbnails.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads/gallery');
const thumbDir = path.join(__dirname, '../uploads/gallery/thumbnails');

// 确保缩略图目录存在
if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
}

async function generateThumbnails() {
    console.log('🖼️  开始生成缩略图...\n');

    const files = fs.readdirSync(uploadDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) && !fs.statSync(path.join(uploadDir, file)).isDirectory();
    });

    console.log(`📁 找到 ${files.length} 张图片\n`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
        const inputPath = path.join(uploadDir, file);
        const thumbFilename = file.replace(/\.[^.]+$/, '.jpg');
        const thumbPath = path.join(thumbDir, thumbFilename);

        // 如果缩略图已存在则跳过
        if (fs.existsSync(thumbPath)) {
            console.log(`⏭️  跳过: ${file} (已存在)`);
            skipped++;
            continue;
        }

        try {
            // 先读取图片元数据获取尺寸
            const metadata = await sharp(inputPath).metadata();
            const { width, height } = metadata;

            let resizeOptions;
            if (height > width) {
                // 竖图：按宽度 400px 缩放
                resizeOptions = { width: 400 };
            } else if (width > height) {
                // 横图：按高度 350px 缩放
                resizeOptions = { height: 350 };
            } else {
                // 方图：按宽度 400px 缩放
                resizeOptions = { width: 400 };
            }

            await sharp(inputPath)
                .resize({
                    ...resizeOptions,
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .jpeg({ quality: 80 })
                .toFile(thumbPath);

            console.log(`✅ 成功: ${file}`);
            success++;
        } catch (err) {
            console.error(`❌ 失败: ${file} - ${err.message}`);
            failed++;
        }
    }

    console.log('\n' + '='.repeat(40));
    console.log(`📊 完成统计:`);
    console.log(`   ✅ 成功: ${success}`);
    console.log(`   ⏭️  跳过: ${skipped}`);
    console.log(`   ❌ 失败: ${failed}`);
    console.log('='.repeat(40));
}

generateThumbnails().catch(err => {
    console.error('生成缩略图时出错:', err);
    process.exit(1);
});
