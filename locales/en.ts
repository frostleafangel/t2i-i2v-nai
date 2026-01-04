import { Translations } from './zh';

export const en: Translations = {
  // Common
  common: {
    generate: 'Generate',
    generating: 'Generating...',
    recovering: 'Recovering...',
    cancel: 'Cancel',
    close: 'Close',
    copy: 'Copy',
    copied: 'Copied',
    reset: 'Reset',
    save: 'Save',
    delete: 'Delete',
    confirm: 'Confirm',
    error: 'Error',
    success: 'Success',
    loading: 'Loading...',
    retry: 'Retry',
  },

  // Navigation
  nav: {
    title: 'NewBie Anime Generator',
    subtitle: 'Private Beta',
    aiAssistant: 'AI Assistant',
    chainOfThought: 'Chain of Thought',
    guideAndDocs: 'Guide & Docs',
    serverOnline: 'Server Online',
    serverOffline: 'Server Offline',
    corsError: 'CORS Blocked',
    queue: 'Queue',
  },

  // Settings Panel
  settings: {
    title: 'Generation Settings',
    resolution: 'Resolution',
    width: 'Width',
    height: 'Height',
    range: 'Range',
    square: 'Square',
    portrait: 'Portrait',
    landscape: 'Landscape',
    steps: 'Steps',
    cfgScale: 'CFG Scale',
    sampler: 'Sampler',
    scheduler: 'Scheduler',
    seed: 'Seed',
    randomSeed: 'Random',
    autoUpscale: 'Auto Upscale',
    autoUpscaleHint: 'When enabled, images will be automatically upscaled (takes longer but higher quality)',
    negativePrompt: 'Negative Prompt',
    resetToDefault: 'Reset to Default',
  },

  // Mobile Drawer
  mobileDrawer: {
    configAndPrompt: 'Config & Prompt',
  },

  // Prompt Builder
  promptBuilder: {
    simpleMode: 'Simple Builder',
    advancedMode: 'Advanced (XML)',
    characters: 'Characters',
    addCharacter: 'Add Character',
    maxReached: '(Max)',
    deleteCharacter: 'Delete Character',
    characterName: 'Name',
    gender: 'Gender',
    appearance: 'Appearance',
    clothing: 'Clothing',
    expression: 'Expression',
    position: 'Position',
    action: 'Action',
    generalTags: 'General Tags',
    count: 'Count',
    style: 'Style',
    background: 'Background',
    lighting: 'Lighting',
    atmosphere: 'Atmosphere',
    quality: 'Quality',
    objects: 'Objects',
    other: 'Other',
    caption: 'Caption',
    tip: 'Tip: The builder auto-generates XML. Use commas to separate tags (e.g., blue_hair, long_hair).',
    rawPlaceholder: 'Enter XML or natural language here...',
    previewMode: 'Preview Mode',
    rawMode: 'Raw Mode',
  },

  // History
  history: {
    title: 'History',
    empty: 'No history yet',
    viewPrompt: 'View Full Prompt',
    useCurrentPrompt: 'Use Current Prompt',
    historyPreview: 'History Prompt Preview',
    generationHistory: 'Generation History',
    download: 'Download Image',
    upscale: 'Upscale',
    upscaling: 'Upscaling...',
    upscaled: 'Upscaled',
    upscaleFailed: 'Upscale failed',
    retentionNotice: 'History kept for 3 days',
  },

  // Status Messages
  status: {
    preparingGeneration: 'Preparing...',
    drawingMasterpiece: 'Drawing masterpiece...',
    readyToGenerate: 'Ready to Generate',
    readyToGenerateHint: 'Configure prompt on the left',
    clickSettingsToConfig: 'Click settings icon to configure',
    canLeavePageTip: '💡 Feel free to leave, the image will show when you return',
    canLeavePageTipShort: '💡 You can leave, image will show when you return',
    taskLost: 'Previous task was lost (server may have restarted). Please regenerate.',
    taskTimeout: 'Task recovery timeout.',
    generationTimeout: 'Generation timeout. Server response took too long.',
    serverBusy: 'Server busy (queue full at 70). Please try again later.',
    connectionFailed: 'Connection failed. This is usually due to mixed content (HTTPS page accessing HTTP server) or CORS issues. Check console for details.',
  },

  // Server Diagnostics
  serverDiag: {
    title: 'Server Connection Diagnostics',
    currentStatus: 'Current Status',
    apiAddress: 'API Address',
    statusOnline: 'Connected',
    statusCors: 'CORS Error',
    statusOffline: 'Cannot Connect',
    offlineMessage: 'Cannot connect to server. Please try again later.',
    corsMessage: 'Mixed content warning detected. You are accessing this page via HTTPS, but the ComfyUI server uses HTTP. Browsers block such insecure requests.',
    corsSolution: 'Solutions:',
    corsSolution1: 'Access this page via HTTP (change https:// to http:// in address bar)',
    corsSolution2: 'Or configure SSL certificate for ComfyUI server',
    mixedContentWarning: 'Connection Security Issue',
    clickForDetails: 'Click for details',
  },

  // Chain of Thought Modal
  chainOfThought: {
    title: 'AI Assistant Chain of Thought Prompt',
    description: 'Copy the following prompt to your AI assistant (ChatGPT, Claude, Gemini, etc.) to help you efficiently generate XML prompts that conform to the NewBie model specification.',
    copyPrompt: 'Copy Prompt',
    copied: 'Copied!',
    close: 'Close',
    promptContent: `You are an intelligent assistant specialized in generating high-quality XML format prompts for the NewBie-image model. Your core task is to strictly convert users' natural language descriptions or Tag groups into XML structures that conform to official documentation specifications.
Your workflow is divided into [Phase 0: Initialization Configuration] and [Phase 1: Generation Processing].

Phase 0: Initialization Protocol
Execution Rules:
When you receive the user's first message (this instruction), pause generation and perform the following checks:
Check Configuration: Confirm whether the user's {DEFAULT_STYLE} and {DEFAULT_QUALITY} have been stored.
Request Input: If not stored, output the following welcome message and wait for user response:

🤖 NewBie Assistant Configuration Mode
For convenience in future use, please send your preferred 'Style Tags' and 'Quality Tags' as global defaults.
(Recommended default quality: very_aesthetic, masterpiece, no_text, high_resolution, detailed)
(Your style example: anime style, flat color, no lineart...)
Once received, I will automatically apply them in subsequent tasks unless you specify other styles in new prompts.

Save Configuration: When the user provides them, store in session memory and reply: "Configuration saved, please send your scene description Tags".

Phase 1: Dynamic Thinking
When receiving the user's scene description Tags, think through these steps:

1. Intent Recognition and Deconstruction
Read user input and break it down into: [Character], [Appearance], [Clothing], [Action/Expression], [Scene], [Interactive Objects], [Lighting/Atmosphere].
Character Distinction Logic: If multiple characters appear, you must clearly distinguish features of <character_1> and <character_2> to prevent feature confusion.

2. Style/Quality Smart Routing
Detect: Check if user input contains specific style descriptions (like sketch, realistic) or artist names.
Decision:
User specified style: Current_Style = style tags from user input + anime_style
User not specified: Current_Style = {DEFAULT_STYLE}
Quality merge: Current_Quality = {DEFAULT_QUALITY} (if user doesn't specify negative quality, apply high quality by default)

3. XML Structured Cleaning (Critical Step)
Underscore Rules (Strictly Enforce):
Inside XML tags (like <appearance>, <clothing>): Must retain Danbooru tag underscores (e.g., long_hair, blue_sky, school_uniform).
Natural language (<caption>): Must remove underscores, convert to fluent English sentences (e.g., long hair, blue sky).
Special Character Escaping: If Tag contains parentheses (), use backslash escape \\(\\), unless it's ComfyUI weight syntax.

Phase 2: XML Construction
Based on Phase 1 parsing results, strictly fill the following template (optional tags not used can be omitted):

Template Structure:
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
    <caption>[Fluent English natural language description based on final content, must remove underscores]</caption>
</general_tags>
}

Phase 3: Output
Output a code block directly containing the complete XML content.
Do not output any extra dialogue besides the XML code block and the hint below.
Below the code block, briefly remind the user: (Assistant hint: Please ensure ComfyUI's Text Encode node has System Prompt: "You are an assistant designed to generate high-quality anime images with the highest degree of image-text alignment based on xml format textual prompts. <Prompt Start>")

Now, execute Phase 0 and check if configuration exists.`,
  },

  // AI Assistant
  aiAssistant: {
    title: 'AI Prompt Assistant',
    placeholder: 'Describe the image you want to generate, e.g.: A girl in a white dress standing under cherry blossoms...',
    send: 'Send',
    thinking: 'AI is thinking...',
    fillToBuilder: 'Fill to Simple Mode',
    fillToXml: 'Fill to XML Mode',
    errorOccurred: 'An error occurred. Please retry.',
    requestFailed: 'Request failed',
    xmlParseFailed: 'XML parsing failed. Try filling to Advanced mode.',
    notConfigured: 'Not configured',
    resetConfig: 'Reset Config',
    clearHistory: 'Clear History',
    configFirst: 'Please configure style and quality first...',
    sendHint: 'Enter to send, Shift+Enter for new line',
  },

  // Maintenance Mode
  maintenance: {
    title: 'System Maintenance',
    message: 'We are performing system upgrades. Please come back later.',
    passwordPlaceholder: 'Maintenance Password',
    wrongPassword: 'Wrong Password',
  },

  // Standard Mode
  standardMode: {
    title: 'Standard Mode',
    switchToAnime: 'Switch to Newbie Mode',
    configuration: 'Configuration',
    history: 'History',
    prompt: 'Main Prompt',
    prefixPrompt: 'Prefix Prompt',
    prefixHint: 'Quality/Style',
    suffixPrompt: 'Suffix Prompt',
    suffixHint: 'Additional modifiers',
    negativePrompt: 'Negative Prompt',
    promptPlaceholder: 'Describe what you want to see...',
    negativePlaceholder: 'Describe what you want to avoid...',
    ctrlEnterHint: 'Ctrl + Enter to generate',
    generate: 'Generate',
    generating: 'Generating',
    inQueue: 'In Queue...',
    readyToCreate: 'Ready to create',
    serverOnline: 'Standard Online',
    serverOffline: 'Offline',
    generationFailed: 'Generation failed on server',
    loadResourcesFailed: 'Failed to load models/LoRAs',
    // Settings Panel
    settingsPanel: {
      model: 'Model',
      loras: 'LoRA',
      addLora: 'Add LoRA',
      loraStrength: 'Strength',
      resolution: 'Resolution',
      width: 'Width',
      height: 'Height',
      steps: 'Steps',
      cfg: 'CFG',
      sampler: 'Sampler',
      scheduler: 'Scheduler',
      seed: 'Seed',
      randomSeed: '-1 for random',
      upscale: 'Enable Upscale',
      upscaleHint: 'Auto upscale after generation',
      upscaleBy: 'Upscale By',
      upscaleDenoise: 'Denoise Strength',
      secondUpscale: 'Second Upscale',
      secondUpscaleHint: 'Further enhance details',
    },
  },

  // Language
  language: {
    zh: '中文',
    en: 'English',
    switchLanguage: 'Switch Language',
  },
};
