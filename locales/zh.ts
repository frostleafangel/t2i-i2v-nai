export const zh = {
  // 通用
  common: {
    generate: '生成图片',
    generating: '生成中...',
    recovering: '恢复任务中...',
    cancel: '取消',
    close: '关闭',
    copy: '复制',
    copied: '已复制',
    reset: '重置',
    save: '保存',
    delete: '删除',
    confirm: '确认',
    error: '错误',
    success: '成功',
    loading: '加载中...',
    retry: '重试',
  },

  // 导航栏
  nav: {
    title: 'NewBie 动漫生成站',
    subtitle: '公益测试版',
    aiAssistant: 'AI 助手',
    chainOfThought: '思维链',
    guideAndDocs: '指南与文档',
    serverOnline: '服务器在线',
    serverOffline: '服务器离线',
    corsError: 'CORS 阻止',
    queue: '排队',
  },

  // 设置面板
  settings: {
    title: '生成设置',
    resolution: '分辨率 (Resolution)',
    width: '宽 (Width)',
    height: '高 (Height)',
    range: '范围',
    square: '方形 (Square)',
    portrait: '人像 (Portrait)',
    landscape: '风景 (Landscape)',
    steps: '步数 (Steps)',
    cfgScale: '相关性 (CFG Scale)',
    sampler: '采样器 (Sampler)',
    scheduler: '调度器 (Scheduler)',
    seed: '种子 (Seed)',
    randomSeed: '随机',
    autoUpscale: '自动放大 (Auto Upscale)',
    autoUpscaleHint: '启用后生成时会自动放大图片，耗时更长但画质更高',
    negativePrompt: '负面提示词 (Negative Prompt)',
    resetToDefault: '重置为默认',
  },

  // 移动端抽屉
  mobileDrawer: {
    configAndPrompt: '配置与提示词',
  },

  // 提示词构建器
  promptBuilder: {
    simpleMode: '简易构建',
    advancedMode: '高级模式 (XML)',
    characters: '角色设定 (Characters)',
    addCharacter: '添加角色',
    maxReached: '(上限)',
    deleteCharacter: '删除角色',
    characterName: '角色名',
    gender: '性别',
    appearance: '外貌',
    clothing: '服装',
    expression: '表情',
    position: '位置',
    action: '动作',
    generalTags: '全局设置 (General Tags)',
    count: '数量',
    style: '画风',
    background: '背景',
    lighting: '光影',
    atmosphere: '氛围',
    quality: '质量',
    objects: '物品',
    other: '其他',
    caption: '自然语言描述',
    tip: '提示：构建器会自动生成 XML。请使用英文逗号分隔标签 (例如: blue_hair, long_hair)。',
    rawPlaceholder: '在此输入 XML 或自然语言...',
    previewMode: '预览模式',
    rawMode: 'Raw 模式',
  },

  // 历史记录
  history: {
    title: '历史',
    empty: '暂无历史记录',
    viewPrompt: '查看完整提示词',
    useCurrentPrompt: '使用当前提示词生成',
    historyPreview: '历史提示词预览',
    generationHistory: '生成历史',
    download: '下载图片',
    upscale: '放大',
    upscaling: '放大中...',
    upscaled: '已放大',
    upscaleFailed: '放大失败',
    retentionNotice: '历史记录保留 3 天',
  },

  // 状态消息
  status: {
    preparingGeneration: '准备生成...',
    drawingMasterpiece: '正在绘制杰作...',
    readyToGenerate: '准备生成',
    readyToGenerateHint: '请在左侧配置提示词',
    clickSettingsToConfig: '点击左上角设置配置参数',
    canLeavePageTip: '💡 可以先去做其他事，关闭页面也没关系，回来后图片会自动显示',
    canLeavePageTipShort: '💡 关闭页面也没关系，回来后图片会自动显示',
    taskLost: '之前的任务已丢失（服务器可能已重启），请重新生成。',
    taskTimeout: '恢复任务超时。',
    generationTimeout: '生成超时。服务器响应时间过长。',
    serverBusy: '服务器繁忙（队列已满70），请稍后再试',
    connectionLost: '连接丢失，请重新生成',
    connectionFailed: '连接失败。这通常是因为混合内容问题（HTTPS 网页访问 HTTP 服务器）或跨域（CORS）问题。请检查控制台详情。',
  },

  // 服务器诊断
  serverDiag: {
    title: '服务器连接诊断',
    currentStatus: '当前状态',
    apiAddress: 'API 地址',
    statusOnline: '连接正常',
    statusCors: 'CORS 跨域错误',
    statusOffline: '无法连接',
    offlineMessage: '无法连接到服务器，请稍后再试。',
    corsMessage: '检测到混合内容警告。您正在通过 HTTPS 访问此网页，但 ComfyUI 服务器使用 HTTP。浏览器会阻止这种不安全的请求。',
    corsSolution: '解决方法：',
    corsSolution1: '使用 HTTP 协议访问此网页 (将地址栏 https:// 改为 http://)',
    corsSolution2: '或者为 ComfyUI 服务器配置 SSL 证书',
    mixedContentWarning: '连接安全问题',
    clickForDetails: '点击查看详情',
  },

  // 思维链提示词模态框
  chainOfThought: {
    title: 'AI 助手思维链提示词',
    description: '将以下提示词复制给你的 AI 助手（如 ChatGPT、Claude、Gemini 等），它将帮助你高效地生成符合 NewBie 模型规范的 XML 提示词。',
    copyPrompt: '复制提示词',
    copied: '已复制!',
    close: '关闭',
    promptContent: `你是一个专门为 NewBie-image 模型生成高质量 XML 格式提示词的智能助手。你的核心任务是将用户的自然语言描述或 Tag 组，严格转换为符合官方文档规范的 XML 结构。
你的工作流分为 [Phase 0: 初始化配置] 和 [Phase 1: 生成处理] 两个阶段。

Phase 0: 初始化协议 (Initialization Protocol)
执行规则：
当你收到用户的第一条消息（即本指令）时，请暂停生成，先执行以下检查：
检查配置： 确认是否已存储用户的 {DEFAULT_STYLE} (默认风格) 和 {DEFAULT_QUALITY} (默认画质)。
请求输入： 如果未存储，请输出以下欢迎语，并等待用户回复：

🤖 NewBie 助手配置模式
为了方便后续使用，请发送您希望作为 全局默认 的『风格标签 (Style Tags)』和『画质标签 (Quality Tags)』。
（官方推荐默认画质：very_aesthetic, masterpiece, no_text, high_resolution, detailed）
（您的风格示例：anime style, flat color, no lineart...）
收到后，我将在后续任务中自动应用它们，除非您在新的提示词中特别指定了其他风格。

保存配置： 当用户提供后，将其存入会话记忆，并回复："配置已保存，请发送您的画面描述 Tags"。

Phase 1: 动态思维解析 (Dynamic Thinking)
当收到用户的画面描述 Tags 后，请按以下步骤思考：

1. 意图识别与拆解 (Deconstruct)
阅读用户输入，将其拆解为：[角色], [外貌], [服装], [动作/表情], [场景], [互动对象], [光影/氛围].
角色区分逻辑： 若出现多个角色，必须明确区分 <character_1> 和 <character_2> 的特征，防止特征混淆。

2. 风格/画质 智能路由 (Style/Quality Routing)
检测 (Detect): 检查用户输入中是否包含特定的风格描述（如 sketch, realistic）或画师名。
判定 (Decision):
用户指定风格： Current_Style = 用户输入中的风格标签 + anime_style
用户未指定： Current_Style = {DEFAULT_STYLE}
画质合并： Current_Quality = {DEFAULT_QUALITY} (若用户未特别指定负面画质，则默认应用高质量)

3. XML 结构化清洗 (Cleaning - 关键步骤)
下划线规则 (严厉执行)：
XML 标签内 (如 <appearance>, <clothing>): 必须保留 Danbooru 标签的下划线（例如 long_hair, blue_sky, school_uniform）。
自然语言 (<caption>): 必须去除下划线，转换为通顺的英语句子（例如 long hair, blue sky）。
特殊字符转义： 若 Tag 中包含括号 ()，请使用反斜杠转义 \\(\\)，除非它是用于 ComfyUI 的权重语法。

Phase 2: XML 构建 (XML Construction)
请基于 Phase 1 的解析结果，严格填充以下模板（未用到的可选标签可省略）：

模板结构：
{
<character_1>
    <n>original_character</n>
    <gender>...</gender>
    <appearance>...</appearance>
    <clothing>...</clothing>
    <expression>...</expression>
    <action>...</action>
    <position>...</position>
</character_1>

<character_2>
    <n>...</n>
    <gender>...</gender>
    <appearance>...</appearance>
    <clothing>...</clothing>
    <action>...</action>
</character_2>

<general_tags>
    <count>...</count>
    <style>[Current_Style]</style>
    <resolution>max_high_resolution</resolution>
    <quality>[Current_Quality]</quality>
    <background>...</background>
    <lighting>...</lighting>
    <atmosphere>...</atmosphere>
    <objects>...</objects>
    <other>...</other>
    <caption>[基于最终内容的通顺英文自然语言描述，必须去除下划线]</caption>
</general_tags>
}

Phase 3: 输出 (Output)
请直接输出一个代码块，包含完整的 XML 内容。
不要输出除了 XML 代码块和下方提示之外的多余对话。
在代码块下方，简要提醒用户：(助手提示：请确保 ComfyUI 的 Text Encode 节点下方保留 System Prompt: "You are an assistant designed to generate high-quality anime images with the highest degree of image-text alignment based on xml format textual prompts. <Prompt Start>")

现在，请执行 Phase 0，检查是否已有配置。`,
  },

  // AI 助手
  aiAssistant: {
    title: 'AI 提示词助手',
    placeholder: '描述你想生成的图片，例如：一个穿着白色连衣裙的少女站在樱花树下...',
    send: '发送',
    thinking: 'AI 正在思考...',
    fillToBuilder: '填充到简易模式',
    fillToXml: '填充到 XML 模式',
    errorOccurred: '发生错误，请重试',
    requestFailed: '请求失败',
    xmlParseFailed: 'XML 解析失败，请尝试填充到高级模式',
    notConfigured: '未配置',
    resetConfig: '重置配置',
    clearHistory: '清空对话',
    configFirst: '请先配置风格和画质...',
    sendHint: 'Enter 发送，Shift+Enter 换行',
  },

  // 维护模式
  maintenance: {
    title: '系统维护中',
    message: '我们正在进行系统升级，请稍后再来访问。',
    passwordPlaceholder: '维护密码',
    wrongPassword: '密码错误',
  },

  // Standard 模式
  standardMode: {
    title: '常规模式',
    switchToAnime: '切换到 Newbie 模式',
    configuration: '配置',
    history: '历史记录',
    prompt: '主提示词',
    prefixPrompt: '前置提示词',
    prefixHint: '质量词/画风',
    suffixPrompt: '后置提示词',
    suffixHint: '附加修饰',
    negativePrompt: '负面提示词',
    promptPlaceholder: '描述你想生成的内容...',
    negativePlaceholder: '描述你想避免的内容...',
    ctrlEnterHint: 'Ctrl + Enter 生成',
    generate: '生成',
    generating: '生成中',
    inQueue: '排队中...',
    readyToCreate: '准备就绪',
    serverOnline: '常规模式在线',
    serverOffline: '离线',
    generationFailed: '服务器生成失败',
    loadResourcesFailed: '加载模型/LoRA 失败',
    // 设置面板
    settingsPanel: {
      model: '模型',
      loras: 'LoRA',
      addLora: '添加 LoRA',
      loraStrength: '权重',
      resolution: '分辨率',
      width: '宽',
      height: '高',
      steps: '步数',
      cfg: 'CFG',
      sampler: '采样器',
      scheduler: '调度器',
      seed: '种子',
      randomSeed: '-1 为随机',
      upscale: '启用放大',
      upscaleHint: '生成后自动放大',
      upscaleBy: '放大倍数',
      upscaleDenoise: '去噪强度',
      secondUpscale: '二次放大',
      secondUpscaleHint: '进一步增强细节',
    },
  },

  // 数据分析
  analytics: {
    title: '生图数据分析',
    overview: '总览数据',
    totalGenerations: '总生成量',
    successRate: '成功率',
    activeUsers: '活跃用户',
    avgDuration: '平均耗时',
    ms: '毫秒',
    dailyTrend: '每日生成趋势',
    hourlyDistribution: '24小时请求分布',
    modelsRanking: '模型使用排行',
    usersRanking: '活跃用户排行',
    sourceDistribution: '生图来源分布',
    date: '日期',
    count: '数量',
    successCount: '成功数量',
    hour: '时段',
    requests: '请求量',
    model: '模型',
    user: '用户',
    images: '生成图片数',
    source: '来源',
    last7Days: '近 7 天',
    last30Days: '近 30 天',
    last90Days: '近 90 天',
    refresh: '刷新',
    noData: '暂无数据',
    fetchFailed: '获取统计数据失败',
    accessDenied: '需要管理员权限方可查看本页',
    backToHome: '返回首页',
  },

  // 语言
  language: {
    zh: '中文',
    en: 'English',
    switchLanguage: '切换语言',
  },
};

export type Translations = typeof zh;
