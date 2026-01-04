/**
 * 邀请码管理脚本
 * 使用方法：
 *   node scripts/manage-invites.js create [数量]  - 创建邀请码
 *   node scripts/manage-invites.js list            - 列出所有邀请码
 */

const path = require('path');

// 设置数据库路径
process.chdir(path.join(__dirname, '..'));

const { inviteOps } = require('../database');
const { v4: uuidv4 } = require('uuid');

const command = process.argv[2];
const count = parseInt(process.argv[3]) || 1;

switch (command) {
    case 'create':
        console.log(`\n🎟️  创建 ${count} 个邀请码:\n`);
        for (let i = 0; i < count; i++) {
            const code = uuidv4().slice(0, 8).toUpperCase();
            inviteOps.create(code);
            console.log(`   ${code}`);
        }
        console.log('\n✅ 完成！\n');
        break;

    case 'list':
        const codes = inviteOps.listAll();
        console.log('\n📋 邀请码列表:\n');
        if (codes.length === 0) {
            console.log('   (暂无邀请码)');
        } else {
            codes.forEach(c => {
                const status = c.used_by ? `❌ 已使用` : `✅ 可用`;
                console.log(`   ${c.code}  ${status}`);
            });
        }
        console.log('');
        break;

    default:
        console.log(`
邀请码管理脚本

使用方法：
  node scripts/manage-invites.js create [数量]  - 创建邀请码
  node scripts/manage-invites.js list            - 列出所有邀请码

示例：
  node scripts/manage-invites.js create 5   # 创建 5 个邀请码
  node scripts/manage-invites.js list        # 列出所有邀请码
`);
}

process.exit(0);
