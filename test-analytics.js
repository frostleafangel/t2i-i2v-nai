const { db, generationLogOps } = require('./server/database');

// 1. 插入一条测试数据
console.log('Inserting test data...');
generationLogOps.log({
    user_id: 1, // 假设用户ID 1
    source: 'test-script',
    generation_type: 'novelai',
    model: 'nai-diffusion-3',
    width: 832,
    height: 1216,
    steps: 28,
    status: 'success',
    duration_ms: 1500,
    image_count: 1
});

// 2. 查询总览
console.log('\n--- Overview ---');
console.log(generationLogOps.getOverview(30));

console.log('\n--- Models ---');
console.log(generationLogOps.getModelStats(30));

console.log('\n--- Recent ---');
console.log(generationLogOps.getRecentLogs(5));

