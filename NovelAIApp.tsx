import React, { useState, useEffect, useCallback } from 'react';
import { NovelAIGenerationSettings, GeneratedImage, StyleConfig } from './types';
import NovelAISettingsPanel from './components/NovelAI/NovelAISettingsPanel';
import NovelAIPromptArea from './components/NovelAI/NovelAIPromptArea';
import HistoryGallery from './components/HistoryGallery';
import StyleManager from './components/Style/StyleManager';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Image as GalleryIcon, Sparkles, Loader2, Palette, Info, Clock, Menu, History, Zap, X, Home, Trash2 } from 'lucide-react';
import MobileDrawer from './components/MobileDrawer';
import AppNavigation from './components/Common/AppNavigation';

// Default Settings - Expanded
const DEFAULT_SETTINGS: NovelAIGenerationSettings = {
    // Basic
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 5,
    seed: -1,
    sampler: "k_euler",
    model: "nai-diffusion-3",

    // Prompts
    prefixPrompt: "masterpiece, best quality",
    positivePrompt: "",
    suffixPrompt: "",
    negativePrompt: "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
    ucPreset: 'Heavy',

    // AI Core
    cfgRescale: 0.18,
    noiseSchedule: 'native',
    dynamicThresholding: true,

    // NAI3
    sm: true,
    sm_dyn: true,

    // NAI4
    aqtPreset: 'safe',
    divideRoles: false,
    characterPrompts: [],
    useAutoPositioning: false,

    // Advanced
    varietyPlus: false,
    legacy: false,
    legacyV3Extend: false,
    controlnetStrength: 0.01,

    // Vibe Transfer
    vibeReferences: [],
};

const NovelAIApp: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const SETTINGS_KEY = 'novelai_settings_v1';
    const HISTORY_KEY = 'novelai_history_v1';
    const SYNCED_KEY = 'novelai_history_synced_v1';
    const EXPIRATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

    // State
    const [settings, setSettings] = useState<NovelAIGenerationSettings>(DEFAULT_SETTINGS);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [history, setHistory] = useState<GeneratedImage[]>([]);
    const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sidebar & Mobile State
    const [showStyleManager, setShowStyleManager] = useState(false);
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [showMobileHistory, setShowMobileHistory] = useState(false);

    // 从云端加载历史记录
    const loadCloudHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/history?limit=50&source=novelai', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                return data.history || [];
            }
        } catch (error) {
            console.error('Failed to load cloud history:', error);
        }
        return [];
    }, []);

    // 同步本地历史到云端
    const syncLocalToCloud = useCallback(async (localHistory: GeneratedImage[]) => {
        if (localHistory.length === 0) return;
        try {
            await fetch('/api/history/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ images: localHistory })
            });
            console.log(`Synced ${localHistory.length} local NovelAI images to cloud`);
        } catch (error) {
            console.error('Failed to sync history:', error);
        }
    }, []);

    // 保存单条记录到云端
    const saveToCloud = useCallback(async (img: GeneratedImage) => {
        try {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(img)
            });
        } catch (error) {
            console.error('Failed to save to cloud:', error);
        }
    }, []);

    // 1. Initial Load & Sync
    useEffect(() => {
        const initHistory = async () => {
            try {
                // 1. 加载设置
                const savedSettings = localStorage.getItem(SETTINGS_KEY);
                if (savedSettings) {
                    setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
                }
                setSettingsLoaded(true);

                // 2. 加载并清理本地历史 (3天过期)
                let localHistory: GeneratedImage[] = [];
                const localHistoryJson = localStorage.getItem(HISTORY_KEY);
                const now = Date.now();
                if (localHistoryJson) {
                    try {
                        const parsedHistory = JSON.parse(localHistoryJson);
                        if (Array.isArray(parsedHistory)) {
                            // 过滤掉超过 3 天的记录
                            localHistory = parsedHistory.filter(img => {
                                const timestamp = img.timestamp || new Date(img.created_at || 0).getTime();
                                return (now - timestamp) < EXPIRATION_MS;
                            });
                            // 如果有清理，更新本地存储
                            if (localHistory.length !== parsedHistory.length) {
                                localStorage.setItem(HISTORY_KEY, JSON.stringify(localHistory));
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse local history:', e);
                    }
                }

                // 3. 加载云端历史
                const cloudHistory = await loadCloudHistory();

                // 4. 检查是否需要同步
                const synced = localStorage.getItem(SYNCED_KEY);
                if (!synced && localHistory.length > 0) {
                    try {
                        await syncLocalToCloud(localHistory);
                    } catch (e) {
                        console.error('Sync failed:', e);
                    }
                    localStorage.setItem(SYNCED_KEY, 'true');
                }

                // 5. 合并去重 (优先使用云端 ID)
                const allHistory = [...cloudHistory];
                const cloudUrls = new Set(cloudHistory.map((h: any) => h.url || h.image_url));

                for (const localImg of localHistory) {
                    if (!cloudUrls.has(localImg.url)) {
                        allHistory.push(localImg);
                    }
                }

                // 6. 排序
                allHistory.sort((a: any, b: any) => {
                    const timeA = a.timestamp || new Date(a.created_at || 0).getTime();
                    const timeB = b.timestamp || new Date(b.created_at || 0).getTime();
                    return timeB - timeA;
                });

                setHistory(allHistory);
                if (allHistory.length > 0) {
                    setCurrentImage(allHistory[0]);
                }

                if (!synced) {
                    localStorage.setItem(SYNCED_KEY, 'true');
                }

            } catch (e) {
                console.error("Failed to load persistence data:", e);
                setSettingsLoaded(true);
            }
        };

        initHistory();
    }, [loadCloudHistory, syncLocalToCloud]);

    // 2. Save Settings on Change
    useEffect(() => {
        if (settingsLoaded) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }
    }, [settings, settingsLoaded]);

    const handleGenerate = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setError(null);

        try {
            // Construct Prompt
            const promptParts = [
                settings.prefixPrompt,
                settings.positivePrompt,
                settings.suffixPrompt
            ].filter(Boolean);
            const fullPrompt = promptParts.join(", ");

            const requestBody: any = {
                prompt: fullPrompt,
                steps: 28, // 强制锁定步数为 28
                height: settings.height,
                width: settings.width,
                scale: settings.cfg,
                uncond_scale: 0, // default
                cfg_rescale: settings.cfgRescale,
                seed: settings.seed !== -1 ? settings.seed : Math.floor(Math.random() * 4294967295),
                n_samples: 1,
                noise_schedule: settings.noiseSchedule,
                legacy_v3_extend: settings.legacyV3Extend,
                reference_strength_multiple: [],
                uc_preset: settings.ucPreset,
                negative_prompt: settings.negativePrompt,
                model: settings.model,

                // Pass extra params for UI to verify debug
                extra_passthrough_testing: {
                    // ... (omitted for brevity)
                },

                // NAI4 Params
                v4_prompt: {
                    caption: {
                        base_caption: fullPrompt,
                        char_captions: [] // Logic handled by backend service now
                    },
                    use_coords: settings.useAutoPositioning,
                    use_order: true,
                    legacy_uc: false
                },
                v4_negative_prompt: {
                    caption: {
                        base_caption: settings.negativePrompt,
                        char_captions: []
                    },
                    use_coords: false,
                    use_order: false,
                    legacy_uc: false
                },

                // Other params
                sampler: settings.sampler,
                controlnet_strength: settings.controlnetStrength,
                dynamic_thresholding: settings.dynamicThresholding,
                sm: settings.sm,
                sm_dyn: settings.sm_dyn,
                deliberate_euler_ancestral_bug: settings.sampler === "k_euler_ancestral",
                prefer_brownian: settings.sampler === "k_euler_ancestral",

                // Extra NAI Params
                extra_novelai_parameters: {
                    ucPreset: settings.ucPreset === 'Heavy' ? 3 : settings.ucPreset === 'Light' ? 2 : 0,
                    qualityToggle: true, // Assuming default true for now or add to settings
                    characterPrompts: settings.characterPrompts,
                    // Add legacy variety if needed
                    nai3Variety: settings.varietyPlus
                }
            };

            // NAI4 Specifics
            const isV4 = settings.model.includes('4');
            if (isV4) {
                requestBody.model = settings.model;
                requestBody.aqt_preset = settings.aqtPreset;
            } else {
                requestBody.model = settings.model;
            }

            // Vibe Transfer
            if (settings.vibeReferences.length > 0) {
                requestBody.reference_image_multiple = settings.vibeReferences.map(v => v.vibeData);
                requestBody.reference_information_extracted_multiple = settings.vibeReferences.map((v) => v.informationExtracted ?? 1);
                requestBody.reference_strength_multiple = settings.vibeReferences.map(v => v.strength);
            }

            const response = await fetch('/api/novelai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorMsg = `HTTP Error ${response.status}`;
                try {
                    const text = await response.text();
                    try {
                        const json = JSON.parse(text);
                        errorMsg = json.error || errorMsg;
                    } catch {
                        errorMsg = `Server Error: ${text.substring(0, 200)}`;
                    }
                } catch (e) {
                    console.error('Failed to read error response:', e);
                }

                if (response.status === 401) {
                    logout();
                    navigate('/');
                    throw new Error('登录已过期，请重新登录');
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            if (data.success && data.images && data.images.length > 0) {
                const imgData = data.images[0]; // Backend returns { url, seed, width, height, ... }

                // Save to Backend History
                const newImagePayload = {
                    url: imgData.url,
                    prompt: fullPrompt,
                    negativePrompt: settings.negativePrompt,
                    width: settings.width,
                    height: settings.height,
                    seed: imgData.seed,
                    isUpscaled: false,
                    metadata: settings, // Save ALL current settings as metadata
                    source: 'novelai' as const
                };

                const newImage: GeneratedImage = {
                    id: `nai_${Date.now()}`,
                    ...newImagePayload,
                    timestamp: Date.now()
                };

                // Add to state and cloud (don't wait for cloud save to show image)
                setHistory(prev => {
                    const updated = [newImage, ...prev];
                    // Save to local storage
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 100)));
                    return updated;
                });
                setCurrentImage(newImage);
                saveToCloud(newImage);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || '生成失败');
        } finally {
            setIsGenerating(false);
        }
    };

    // Apply History Logic
    const handleApplyHistory = (img: GeneratedImage) => {
        setCurrentImage(img);
        if (img.metadata) {
            // If we have metadata, restore it
            const meta = img.metadata as Partial<NovelAIGenerationSettings>;
            setSettings(prev => ({
                ...prev,
                ...meta
            }));
        } else {
            // Partial restore for old images
            setSettings(prev => ({
                ...prev,
                width: img.width || prev.width,
                height: img.height || prev.height,
                positivePrompt: img.prompt || prev.positivePrompt,
                negativePrompt: img.negativePrompt || prev.negativePrompt,
                seed: img.seed || -1
            }));
        }
    };

    // Apply Style Logic
    const handleApplyStyle = (config: StyleConfig) => {
        // Check if it's a NovelAI style
        if (config.type === 'novelai' && config.novelai_settings) {
            setSettings(prev => ({
                ...prev,
                ...config.novelai_settings,
                // 注：应用风格时不覆盖当前主提示词 (positivePrompt)
                negativePrompt: config.negativePrompt || prev.negativePrompt,
                prefixPrompt: config.prefixPrompt || prev.prefixPrompt,
                suffixPrompt: config.suffixPrompt || prev.suffixPrompt,
                model: config.model || prev.model
            }));
        } else {
            // Try to apply generic parts of ComfyUI style
            setSettings(prev => ({
                ...prev,
                // 注：应用风格时不覆盖当前主提示词 (positivePrompt)
                negativePrompt: config.negativePrompt || prev.negativePrompt,
                prefixPrompt: config.prefixPrompt || prev.prefixPrompt,
                suffixPrompt: config.suffixPrompt || prev.suffixPrompt,
                // Model might be incompatible, ignore loras
            }));
        }
    };

    // Create a StyleConfig explicitly for saving from current state
    const currentStyleConfig: StyleConfig = {
        type: 'novelai',
        model: settings.model,
        loras: [],
        prefixPrompt: settings.prefixPrompt,
        positivePrompt: "", // 风格库不捕获内容/主提示词
        suffixPrompt: settings.suffixPrompt,
        negativePrompt: settings.negativePrompt,
        novelai_settings: {
            ...settings,
            positivePrompt: "" // 在深层设置中也清除内容
        }
    };

    // 从画廊接收提示词和元数据
    useEffect(() => {
        const galleryPrompt = sessionStorage.getItem('gallery_prompt');
        const galleryMetadata = sessionStorage.getItem('gallery_metadata');

        if (galleryPrompt || galleryMetadata) {
            console.log('Received data from gallery:', { prompt: galleryPrompt, hasMetadata: !!galleryMetadata });

            if (galleryMetadata) {
                try {
                    const meta = JSON.parse(galleryMetadata);
                    // 排除 width 和 height，避免放大后的分辨率覆盖用户设置
                    const { width, height, ...metaWithoutDimensions } = meta;
                    // 如果有元数据，优先使用元数据还原状态
                    setSettings(prev => ({
                        ...prev,
                        ...metaWithoutDimensions,
                        // 确保提示词正确映射
                        positivePrompt: meta.positivePrompt || galleryPrompt || prev.positivePrompt
                    }));
                } catch (e) {
                    console.error('Failed to parse gallery metadata:', e);
                }
            } else if (galleryPrompt) {
                // 只有提示词的情况
                setSettings(prev => ({ ...prev, positivePrompt: galleryPrompt }));
            }

            // 清理缓存
            sessionStorage.removeItem('gallery_prompt');
            sessionStorage.removeItem('gallery_metadata');
        }
    }, [setSettings]);

    // 上传到画廊
    // 画廊只保存内容相关的元数据（正面提示词、角色控制、尺寸、seed）
    // 风格相关的设置（Vibe、prefixPrompt、suffixPrompt、negativePrompt 等）应该保存到风格库
    const handleUploadToGallery = useCallback(async (img: GeneratedImage): Promise<boolean> => {
        try {
            // 构建仅包含内容相关的元数据
            const contentMetadata = {
                positivePrompt: settings.positivePrompt,
                characterPrompts: settings.characterPrompts,
                width: settings.width,
                height: settings.height,
                seed: img.seed ?? settings.seed,
                model: settings.model, // 保留模型信息用于参考
            };

            const response = await fetch('/api/gallery/upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    imageUrl: img.url,
                    // 画廊标题仅显示内容/主提示词
                    prompt: settings.positivePrompt || img.prompt,
                    source: 'novelai',
                    metadata: JSON.stringify(contentMetadata)
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Failed to upload to gallery:', error);
            return false;
        }
    }, [settings]);

    // 清空历史记录
    const handleClearHistory = useCallback(async () => {
        setHistory([]);
        setCurrentImage(null);
        localStorage.removeItem('novelai_history_v2');
        // 清空云端历史
        try {
            const existingHistory = await fetch('/api/history?source=novelai&limit=100', { credentials: 'include' });
            if (existingHistory.ok) {
                const data = await existingHistory.json();
                for (const item of data.history || []) {
                    await fetch(`/api/history/${item.id}`, { method: 'DELETE', credentials: 'include' });
                }
            }
        } catch (e) {
            console.warn('[NovelAI] Failed to clear cloud history:', e);
        }
    }, []);

    // 删除单个历史项目
    const handleDeleteHistoryItem = useCallback(async (img: GeneratedImage) => {
        setHistory(prev => prev.filter(item => item.id !== img.id));
        if (currentImage?.id === img.id) {
            setCurrentImage(null);
        }
        // 更新本地存储
        setHistory(prev => {
            localStorage.setItem('novelai_history_v2', JSON.stringify(prev));
            return prev;
        });
        // 删除云端记录
        try {
            await fetch(`/api/history/${img.id}`, { method: 'DELETE', credentials: 'include' });
        } catch (e) {
            console.warn('[NovelAI] Failed to delete from cloud:', e);
        }
    }, [currentImage]);

    return (
        <div className="min-h-screen bg-darker text-gray-100 font-sans selection:bg-primary/30">
            {/* Header */}
            <AppNavigation
                title="NovelAI Mode"
                mode="novelai"
                user={null} // NovelAIApp hook useAuth gives { logout } but usually also user?
                // Checking line 57: const { logout } = useAuth();
                // It didn't destruct user. I should add user to destructuring.
                onLogout={async () => {
                    await logout();
                    navigate('/login');
                }}
                onMobileSettingsClick={() => setShowMobileSettings(true)}
                onMobileHistoryClick={() => setShowMobileHistory(true)}
                onShowStyleManager={() => setShowStyleManager(true)}
            />

            <main className="pt-16 pl-0 lg:pl-[420px] pr-0 lg:pr-[320px] min-h-screen">
                {/* Left Column - Settings (Desktop) */}
                <div className="hidden lg:flex flex-col fixed top-16 left-0 bottom-0 w-[420px] bg-surface/30 border-r border-white/5 z-20">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <NovelAIPromptArea
                            prefixPrompt={settings.prefixPrompt}
                            positivePrompt={settings.positivePrompt}
                            suffixPrompt={settings.suffixPrompt}
                            negativePrompt={settings.negativePrompt}
                            onPrefixChange={(v) => setSettings(s => ({ ...s, prefixPrompt: v }))}
                            onPositiveChange={(v) => setSettings(s => ({ ...s, positivePrompt: v }))}
                            onSuffixChange={(v) => setSettings(s => ({ ...s, suffixPrompt: v }))}
                            onNegativeChange={(v) => setSettings(s => ({ ...s, negativePrompt: v }))}
                            onGenerate={handleGenerate}
                            isGenerating={isGenerating}
                        />
                        <div className="mt-4">
                            <NovelAISettingsPanel
                                settings={settings}
                                onChange={setSettings}
                            />
                        </div>
                    </div>
                </div>

                {/* Center - Image Preview */}
                <div className="min-h-[calc(100vh-64px)] bg-black/40 relative flex items-center justify-center p-4 lg:p-8">
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    ></div>
                    {currentImage ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <img
                                src={currentImage.url}
                                alt="Generated"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            />
                        </div>
                    ) : (
                        <div className="text-gray-500 text-sm flex flex-col items-center gap-3">
                            <Sparkles size={32} className="opacity-50" />
                            <p>Ready to generate</p>
                        </div>
                    )}
                    {error && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-30 w-[90%] sm:w-auto text-center">
                            {error}
                        </div>
                    )}
                </div>

                {/* Right Column - History Gallery (Desktop) */}
                <div className="hidden lg:flex flex-col fixed top-16 right-0 bottom-0 w-[320px] bg-surface/30 border-l border-white/5 z-20">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Clock size={16} />
                            历史记录
                        </h2>
                        {history.length > 0 && (
                            <button
                                onClick={() => {
                                    if (window.confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
                                        handleClearHistory();
                                    }
                                }}
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 py-1 px-2 rounded hover:bg-red-500/10 transition-colors"
                            >
                                <Trash2 size={12} />
                                清空
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        <HistoryGallery
                            history={history}
                            onSelect={handleApplyHistory}
                            selectedId={currentImage?.id}
                            onUploadToGallery={handleUploadToGallery}
                            onSendToVideo={(img) => {
                                sessionStorage.setItem('video_init_image', img.url);
                                navigate('/video');
                            }}
                            onClearHistory={handleClearHistory}
                            onDelete={handleDeleteHistoryItem}
                        />
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-darker/90 backdrop-blur-md border-t border-white/10 lg:hidden z-40 flex flex-col gap-2">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={`
                        w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                        ${isGenerating
                            ? 'bg-neutral-800 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary to-purple-600'
                        }
                    `}
                >
                    {isGenerating ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>正在生成...</span>
                        </>
                    ) : (
                        <>
                            <Zap size={18} className="fill-white" />
                            <span>开始生成</span>
                        </>
                    )}
                </button>
            </div>

            {/* Modals & Drawers */}
            {showStyleManager && (
                <StyleManager
                    mode="novelai"
                    currentConfig={currentStyleConfig}
                    currentImage={currentImage?.url}
                    onApplyStyle={handleApplyStyle}
                    onClose={() => setShowStyleManager(false)}
                />
            )}

            <MobileDrawer
                isOpen={showMobileSettings}
                onClose={() => setShowMobileSettings(false)}
                title="Configuration"
                position="left"
            >
                <div className="space-y-6 pb-20">
                    <NovelAIPromptArea
                        prefixPrompt={settings.prefixPrompt}
                        positivePrompt={settings.positivePrompt}
                        suffixPrompt={settings.suffixPrompt}
                        negativePrompt={settings.negativePrompt}
                        onPrefixChange={(v) => setSettings(s => ({ ...s, prefixPrompt: v }))}
                        onPositiveChange={(v) => setSettings(s => ({ ...s, positivePrompt: v }))}
                        onSuffixChange={(v) => setSettings(s => ({ ...s, suffixPrompt: v }))}
                        onNegativeChange={(v) => setSettings(s => ({ ...s, negativePrompt: v }))}
                        onGenerate={handleGenerate}
                        isGenerating={false}
                        hideGenerateButton={true}
                    />
                    <NovelAISettingsPanel
                        settings={settings}
                        onChange={setSettings}
                    />
                </div>
            </MobileDrawer>

            <MobileDrawer
                isOpen={showMobileHistory}
                onClose={() => setShowMobileHistory(false)}
                title="历史记录"
                position="right"
                headerAction={history.length > 0 && (
                    <button
                        onClick={() => {
                            if (window.confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
                                handleClearHistory();
                            }
                        }}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 py-1 px-2 rounded hover:bg-red-500/10 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            >
                <div className="h-full">
                    <HistoryGallery
                        history={history}
                        onSelect={(img) => {
                            handleApplyHistory(img);
                            setShowMobileHistory(false);
                        }}
                        selectedId={currentImage?.id}
                        onUploadToGallery={handleUploadToGallery}
                        onSendToVideo={(img) => {
                            sessionStorage.setItem('video_init_image', img.url);
                            navigate('/video');
                        }}
                        onClearHistory={handleClearHistory}
                        onDelete={handleDeleteHistoryItem}
                    />
                </div>
            </MobileDrawer>
        </div>
    );
};

export default NovelAIApp;
