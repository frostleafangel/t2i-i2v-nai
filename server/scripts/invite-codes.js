#!/usr/bin/env node
/**
 * 邀请码管理工具
 * 
 * 用法:
 *   node invite-codes.js           - 查看所有邀请码
 *   node invite-codes.js list      - 查看所有邀请码
 *   node invite-codes.js create    - 生成1个新邀请码
 *   node invite-codes.js create 5  - 生成5个新邀请码
 */

const { db } = require('../database');
const crypto = require('crypto');

// 生成随机邀请码
function generateCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// 列出所有邀请码
function listCodes() {
    const codes = db.prepare(`
        SELECT 
            ic.id,
            ic.code,
            ic.created_at,
            ic.used_at,
            u.username as used_by_username
        FROM invite_codes ic
        LEFT JOIN users u ON ic.used_by = u.id
        ORDER BY ic.id
    `).all();

    console.log('\n=== 邀请码列表 ===\n');

    let usedCount = 0;
    let unusedCount = 0;

    codes.forEach(c => {
        if (c.used_by_username) {
            usedCount++;
            console.log(`✅ ${c.code} | 已使用 | 使用者: ${c.used_by_username.padEnd(12)} | 时间: ${c.used_at}`);
        } else {
            unusedCount++;
            console.log(`⚪ ${c.code} | 未使用 | 创建时间: ${c.created_at}`);
        }
    });

    console.log(`\n📊 统计: 共 ${codes.length} 个 | ✅ 已使用 ${usedCount} | ⚪ 未使用 ${unusedCount}\n`);
}

// 创建新邀请码
function createCodes(count = 1) {
    const stmt = db.prepare('INSERT INTO invite_codes (code) VALUES (?)');
    const newCodes = [];

    for (let i = 0; i < count; i++) {
        const code = generateCode();
        try {
            stmt.run(code);
            newCodes.push(code);
        } catch (err) {
            // 如果重复，重试
            i--;
        }
    }

    console.log(`\n✨ 成功创建 ${newCodes.length} 个新邀请码:\n`);
    newCodes.forEach(code => {
        console.log(`   ${code}`);
    });
    console.log('');
}

// 主逻辑
const args = process.argv.slice(2);
const command = args[0] || 'list';

switch (command) {
    case 'list':
    case 'ls':
        listCodes();
        break;
    case 'create':
    case 'new':
    case 'add':
        const count = parseInt(args[1]) || 1;
        createCodes(count);
        break;
    case 'help':
    case '-h':
    case '--help':
        console.log(`
邀请码管理工具

用法:
  node invite-codes.js [命令] [参数]

命令:
  list, ls          查看所有邀请码 (默认)
  create, new, add  生成新邀请码
                    可选参数: 数量 (默认1)

示例:
  node invite-codes.js              查看所有邀请码
  node invite-codes.js create       生成1个邀请码
  node invite-codes.js create 5     生成5个邀请码
`);
        break;
    default:
        console.log(`未知命令: ${command}`);
        console.log('使用 --help 查看帮助');
}
