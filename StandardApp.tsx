
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    StandardGenerationSettings,
    GeneratedImage,
    GenerationStatus,
    QueuePromptResponse,
    StyleConfig
} from './types';
import {
    fetchAvailableModels,
    fetchAvailableLoras,
    fetchAvailableDetectors,
    queueStandardGeneration,
    checkStandardGenerationStatus,
    uploadImageForUpscale,
    queueStandardUpscale,
    checkStandardUpscaleStatus
} from './services/standardComfyService';
import { COMFY_API_URL_STANDARD } from './constants';
import StandardSettingsPanel from './components/Standard/StandardSettingsPanel';
import StandardPromptArea from './components/Standard/StandardPromptArea';
import HistoryGallery from './components/HistoryGallery';
import MobileDrawer from './components/MobileDrawer';
import AppNavigation from './components/Common/AppNavigation';
import StyleManager from './components/Style/StyleManager';
import {
    Wifi, WifiOff, Settings, History,
    Sparkles, Zap, Download, ImageIcon, Maximize2, Image as GalleryIcon, User, LogOut
} from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';

const COMFY_URL = COMFY_API_URL_STANDARD;
const getWsUrl = (url: string) => {
    if (url.startsWith('http')) {
        return url.replace(/^http/, 'ws') + '/ws';
    }
    if (url.startsWith('/')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}${url}/ws`;
    }
    return url;
};
const COMFY_WS_URL = getWsUrl(COMFY_API_URL_STANDARD);

const DEFAULT_SETTINGS: StandardGenerationSettings = {
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 7,
    seed: -1,
    sampler_name: "euler_ancestral",
    scheduler: "karras",
    model: "",
    loras: [],
    // 三段式提示词
    prefixPrompt: "masterpiece, best quality",
    positivePrompt: "",
    suffixPrompt: "",
    negativePrompt: "lowres, (worst quality,bad quality,low quality:1.2), bad anatomy, watermark, fused hands, bad hands, boy, looking at viewer",
    enableUpscale: false,
    // 一次放大设置默认值
    upscaleBy: 1.5,
    upscaleDenoise: 0.2,
    upscaleSteps: 20,
    upscaleCfg: 4.5,
    upscaleSampler: "euler",
    upscaleScheduler: "karras",
    // 二次放大设置默认值
    enableSecondUpscale: false,
    secondUpscaleBy: 1.1,
    secondUpscaleDenoise: 0.25,
    secondUpscaleSteps: 20,
    secondUpscaleCfg: 5,
    secondUpscaleSampler: "euler",
    secondUpscaleScheduler: "normal",
    // FaceDetailer 设置
    enableFaceDetailer: true,
    faceDetectorModel: "bbox/face_yolov8m.pt"
};

const StandardApp: React.FC = () => {
    const { t } = useLanguage();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // State
    const [settings, setSettings] = useState<StandardGenerationSettings>(DEFAULT_SETTINGS);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [availableLoras, setAvailableLoras] = useState<string[]>([]);
    const [availableDetectors, setAvailableDetectors] = useState<string[]>([]);
    const [isLoadingResources, setIsLoadingResources] = useState(true);

    const [history, setHistory] = useState<GeneratedImage[]>([]);
    const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);

    const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
    const [progress, setProgress] = useState(0);
    const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [upscalingId, setUpscalingId] = useState<string | null>(null);
    const [upscaleProgress, setUpscaleProgress] = useState(0); // 放大进度
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false); // 标记设置是否已从 localStorage 加载
    const [showStyleManager, setShowStyleManager] = useState(false);

    // Mobile UI State
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [showMobileHistory, setShowMobileHistory] = useState(false);

    const socketRef = useRef<WebSocket | null>(null);
    const currentPromptIdRef = useRef<string | null>(null);
    const upscalePromptIdRef = useRef<string | null>(null); // 放大任务的 prompt_id
    const pollingIntervalRef = useRef<any>(null);

    // Persistence Keys
    const SETTINGS_KEY = 'standard_settings_v1';
    const HISTORY_KEY = 'standard_history_v1';
    const PENDING_TASK_KEY = 'standard_pending_task_v1';
    const SYNCED_KEY = 'standard_history_synced_v1'; // 标记是否已同步过
    const EXPIRATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

    // 从云端加载历史记录
    const loadCloudHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/history?source=comfyui', { credentials: 'include' });
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
            console.log(`Synced ${localHistory.length} local images to cloud`);
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

    // Load history on mount
    useEffect(() => {
        const initHistory = async () => {
            try {
                // 加载设置
                const savedSettings = localStorage.getItem(SETTINGS_KEY);
                if (savedSettings) {
                    setSettings(JSON.parse(savedSettings));
                }
                setSettingsLoaded(true); // 标记设置已加载

                // 读取本地历史
                let localHistory: GeneratedImage[] = [];
                const localHistoryJson = localStorage.getItem(HISTORY_KEY);
                const now = Date.now();
                if (localHistoryJson) {
                    try {
                        const parsedHistory = JSON.parse(localHistoryJson);
                        // 过滤掉超过3天的记录
                        localHistory = parsedHistory.filter((img: GeneratedImage) => {
                            const imgTime = img.timestamp || 0;
                            return (now - imgTime) < EXPIRATION_MS;
                        });
                        // 如果有过期记录被清理，更新 localStorage
                        if (localHistory.length < parsedHistory.length) {
                            localStorage.setItem(HISTORY_KEY, JSON.stringify(localHistory));
                            console.log(`Cleaned ${parsedHistory.length - localHistory.length} expired history entries`);
                        }
                    } catch (e) {
                        console.error('Failed to parse local history:', e);
                    }
                }

                // 从云端加载历史
                const cloudHistory = await loadCloudHistory();

                // 检查是否已同步过
                const synced = localStorage.getItem(SYNCED_KEY);

                if (!synced && localHistory.length > 0) {
                    // 首次登录且有本地历史：同步到云端
                    try {
                        await syncLocalToCloud(localHistory);
                        console.log(`✅ Synced ${localHistory.length} local images to cloud`);
                    } catch (e) {
                        console.error('Sync failed, keeping local history:', e);
                    }
                    localStorage.setItem(SYNCED_KEY, 'true');
                }

                // 合并本地和云端历史（去重）
                const allHistory = [...cloudHistory];
                const cloudUrls = new Set(cloudHistory.map((h: any) => h.url || h.image_url));

                for (const localImg of localHistory) {
                    if (!cloudUrls.has(localImg.url)) {
                        allHistory.push(localImg);
                    }
                }

                // 按时间排序
                allHistory.sort((a: any, b: any) => {
                    const timeA = a.timestamp || new Date(a.created_at).getTime();
                    const timeB = b.timestamp || new Date(b.created_at).getTime();
                    return timeB - timeA;
                });

                setHistory(allHistory);
                if (allHistory.length > 0) {
                    setCurrentImage(allHistory[0]);
                }

                // 标记为已同步
                if (!synced) {
                    localStorage.setItem(SYNCED_KEY, 'true');
                }

                // 检查待处理任务
                const pendingTaskJson = localStorage.getItem(PENDING_TASK_KEY);
                if (pendingTaskJson) {
                    const task = JSON.parse(pendingTaskJson);
                    if (Date.now() - task.timestamp < 2 * 60 * 60 * 1000) {
                        setStatus(GenerationStatus.QUEUED);
                    } else {
                        localStorage.removeItem(PENDING_TASK_KEY);
                    }
                }
            } catch (e) {
                console.error("Failed to load persistence data:", e);
            }
        };
        initHistory();
    }, [loadCloudHistory, syncLocalToCloud]);

    // Save settings on change (only after initial load to prevent overwriting)
    useEffect(() => {
        if (settingsLoaded) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }
    }, [settings, settingsLoaded]);


    // 预加载最近 10 张图片（提升切换性能）
    useEffect(() => {
        const imagesToPreload = history.slice(0, 10);
        imagesToPreload.forEach(img => {
            const image = new Image();
            image.src = img.url;
        });
    }, [history]);

    // 从画廊接收提示词和元数据
    useEffect(() => {
        const galleryPrompt = sessionStorage.getItem('gallery_prompt');
        const galleryMetadata = sessionStorage.getItem('gallery_metadata');

        if (galleryPrompt || galleryMetadata) {
            console.log('Received from gallery:', { prompt: !!galleryPrompt, meta: !!galleryMetadata });

            if (galleryMetadata) {
                try {
                    const meta = JSON.parse(galleryMetadata);
                    // 排除 width 和 height，避免放大后的分辨率覆盖用户设置
                    const { width, height, ...metaWithoutDimensions } = meta;
                    setSettings(prev => ({
                        ...prev,
                        ...metaWithoutDimensions,
                        // 确保主提示词正确映射（如果是从 NAI 合并过来的，galleryPrompt 会包含合并后的版本）
                        positivePrompt: galleryPrompt || meta.positivePrompt || prev.positivePrompt
                    }));
                } catch (e) {
                    console.error('Failed to parse gallery metadata:', e);
                }
            } else if (galleryPrompt) {
                setSettings(prev => ({ ...prev, positivePrompt: galleryPrompt }));
            }

            sessionStorage.removeItem('gallery_prompt');
            sessionStorage.removeItem('gallery_metadata');
        }
    }, [setSettings]);

    // 上传到画廊
    // 画廊只保存内容相关的元数据（正面提示词、尺寸、seed、模型）
    // 风格相关的设置（prefixPrompt、suffixPrompt、negativePrompt、loras 等）应该保存到风格库
    const handleUploadToGallery = useCallback(async (img: GeneratedImage): Promise<boolean> => {
        try {
            // 构建仅包含内容相关的元数据
            const contentMetadata = {
                positivePrompt: img.prompt || settings.positivePrompt,
                width: img.width || settings.width,
                height: img.height || settings.height,
                seed: img.seed ?? settings.seed,
                model: settings.model, // 保留模型信息用于参考
            };

            const response = await fetch('/api/gallery/upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    imageUrl: img.url,
                    prompt: img.prompt || settings.positivePrompt,
                    source: 'comfyui',
                    metadata: JSON.stringify(contentMetadata)
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Upload to gallery failed:', error);
            return false;
        }
    }, [settings]);

    // 退出登录
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Polling Function
    const startPolling = useCallback(async (promptId: string, generationSettings: StandardGenerationSettings) => {
        const poll = async () => {
            try {
                const res = await checkStandardGenerationStatus(promptId);

                if (res.status === 'completed' && res.imageUrl) {
                    const newImage: GeneratedImage = {
                        id: promptId,
                        url: res.imageUrl,
                        prompt: generationSettings.positivePrompt,
                        timestamp: Date.now(),
                        width: generationSettings.enableUpscale ? generationSettings.width * 1.5 : generationSettings.width,
                        height: generationSettings.enableUpscale ? generationSettings.height * 1.5 : generationSettings.height,
                        seed: generationSettings.seed,
                        isUpscaled: res.isUpscaled
                    };

                    setHistory(prev => {
                        if (prev.some(img => img.id === newImage.id)) return prev;
                        const newHistory = [newImage, ...prev];
                        // 保存到 localStorage
                        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory.slice(0, 50)));
                        return newHistory;
                    });
                    setCurrentImage(newImage);
                    setStatus(GenerationStatus.COMPLETE);

                    // 保存到云端
                    saveToCloud(newImage);

                    // Clear pending task
                    localStorage.removeItem(PENDING_TASK_KEY);

                    setTimeout(() => setStatus(GenerationStatus.IDLE), 2000);
                    return;

                } else if (res.status === 'error') {
                    // Don't clear pending task immediately on connection error, allow retries
                    console.warn("Connection error to server, retrying...");
                    // Optional: set a temporary error state in UI but keep polling?
                    // For now, just retry silently to match Newbie behavior
                    pollingIntervalRef.current = setTimeout(poll, 2000); // Retry slower
                    return;
                }

                // Continue polling
                pollingIntervalRef.current = setTimeout(poll, 1000);
            } catch (e) {
                console.error("Polling error", e);
                // Retry on exception
                pollingIntervalRef.current = setTimeout(poll, 2000);
            }
        };
        poll();
    }, [saveToCloud]);

    // Initial Load & Resume Task
    useEffect(() => {
        const init = async () => {
            try {
                const [models, loras, detectors] = await Promise.all([
                    fetchAvailableModels(),
                    fetchAvailableLoras(),
                    fetchAvailableDetectors()
                ]);
                setAvailableModels(models);
                setAvailableLoras(loras);
                setAvailableDetectors(detectors);

                // Auto-select first model if none selected AND no saved model in localStorage
                // Note: settings might still be initial value due to async setState, so check localStorage directly
                const savedSettings = localStorage.getItem(SETTINGS_KEY);
                const savedModel = savedSettings ? JSON.parse(savedSettings).model : null;
                if (!savedModel && models.length > 0) {
                    setSettings(prev => ({ ...prev, model: models[0] }));
                }

                // Check for pending task to actally start polling
                const pendingTaskJson = localStorage.getItem(PENDING_TASK_KEY);
                if (pendingTaskJson) {
                    try {
                        const task = JSON.parse(pendingTaskJson);
                        // Resume if less than 2 hours old
                        if (Date.now() - task.timestamp < 2 * 60 * 60 * 1000) {
                            console.log('Resuming pending task:', task.promptId);
                            // Ensure status matches
                            setStatus(GenerationStatus.GENERATING);
                            currentPromptIdRef.current = task.promptId;
                            startPolling(task.promptId, task.settings);
                        } else {
                            localStorage.removeItem(PENDING_TASK_KEY);
                        }
                    } catch (e) {
                        console.error("Failed to parse pending task", e);
                        localStorage.removeItem(PENDING_TASK_KEY);
                    }
                }

            } catch (err) {
                console.error("Failed to load resources:", err);
                setErrorMsg("Failed to load models/loras.");
            } finally {
                setIsLoadingResources(false);
            }
        };
        init();
        checkServer();
    }, []); // Run once on mount

    // WebSocket
    useEffect(() => {
        const connectMetrics = () => {
            try {
                const ws = new WebSocket(COMFY_WS_URL);

                ws.onopen = () => {
                    console.log('Standard Mode WS Connected');
                    setServerStatus('connected');
                };

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'progress') {
                            // 只有当进度消息的 prompt_id 与当前任务匹配时才更新进度
                            // 否则其他用户的任务进度会显示在当前用户界面上
                            const messagePromptId = message.data?.prompt_id;

                            // 生成任务进度匹配
                            if (messagePromptId && currentPromptIdRef.current && messagePromptId === currentPromptIdRef.current) {
                                const progressValue = Math.round((message.data.value / message.data.max) * 100);
                                setProgress(progressValue);
                            }

                            // 放大任务进度匹配
                            if (messagePromptId && upscalePromptIdRef.current && messagePromptId === upscalePromptIdRef.current) {
                                const progressValue = Math.round((message.data.value / message.data.max) * 100);
                                setUpscaleProgress(progressValue);
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                };

                ws.onclose = () => {
                    setServerStatus('disconnected');
                    setTimeout(connectMetrics, 3000);
                };

                socketRef.current = ws;
            } catch (e) {
                console.error("WS Error:", e);
            }
        };

        connectMetrics();
        return () => {
            if (socketRef.current) socketRef.current.close();
            if (pollingIntervalRef.current) clearTimeout(pollingIntervalRef.current);
        };
    }, []);

    const checkServer = async () => {
        try {
            setServerStatus('checking');
            const res = await fetch(`${COMFY_URL}/system_stats`);
            if (res.ok) {
                setServerStatus('connected');
            } else {
                setServerStatus('disconnected');
            }
        } catch (e) {
            console.error('[Standard] Check server stats failed:', e);
            setServerStatus('disconnected');
        }
    };

    const handleGenerate = async () => {
        if (status === GenerationStatus.GENERATING || !settings.model) return;

        setStatus(GenerationStatus.PREPARING);
        setProgress(0);
        setErrorMsg(null);

        try {
            const promptId = await queueStandardGeneration(settings);
            currentPromptIdRef.current = promptId;
            setStatus(GenerationStatus.QUEUED);

            // Save Pending Task
            localStorage.setItem(PENDING_TASK_KEY, JSON.stringify({
                promptId,
                timestamp: Date.now(),
                settings // Save current settings to reconstruct history later
            }));

            // Start Polling
            startPolling(promptId, settings);

        } catch (err: any) {
            console.error("Generation failed:", err);
            setStatus(GenerationStatus.ERROR);
            setErrorMsg(err.message || "Failed to start generation.");
            localStorage.removeItem(PENDING_TASK_KEY);
        }
    };

    // 放大历史图片
    const handleUpscale = useCallback(async (img: GeneratedImage) => {
        if (upscalingId || img.isUpscaled) return;

        // 获取该图片的提示词（从历史记录中）
        const positivePrompt = img.prompt || settings.positivePrompt;
        const negativePrompt = img.negativePrompt || settings.negativePrompt;
        const model = settings.model;

        if (!model) {
            console.error('[Upscale] No model selected');
            return;
        }

        setUpscalingId(img.id);
        setUpscaleProgress(0); // 重置放大进度
        console.log('[Standard Upscale] Starting upscale for:', img.id);

        try {
            // 0. 获取图片实际尺寸并计算安全放大倍数
            const MAX_OUTPUT_SIZE = 3072;
            let safeUpscaleBy = settings.upscaleBy || 1.5;

            // 创建临时图片元素获取尺寸
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                tempImg.onload = () => resolve();
                tempImg.onerror = () => reject(new Error('Failed to load image'));
                tempImg.src = img.url;
            });

            const imgWidth = tempImg.naturalWidth;
            const imgHeight = tempImg.naturalHeight;
            const maxDimension = Math.max(imgWidth, imgHeight);

            // 计算允许的最大放大倍数
            const maxAllowedScale = MAX_OUTPUT_SIZE / maxDimension;
            if (safeUpscaleBy > maxAllowedScale) {
                safeUpscaleBy = Math.max(1, Math.floor(maxAllowedScale * 10) / 10); // 向下取整到 0.1
                console.log(`[Standard Upscale] Limited upscale from ${settings.upscaleBy}x to ${safeUpscaleBy}x (max output: ${MAX_OUTPUT_SIZE}px)`);
            }

            // 1. 上传图片到 ComfyUI
            const uploadedName = await uploadImageForUpscale(img.url);
            console.log('[Standard Upscale] Uploaded as:', uploadedName);

            // 2. 入队放大任务（固定参数：一次1.25x + 二次1x）
            const promptId = await queueStandardUpscale(
                uploadedName,
                positivePrompt,
                negativePrompt,
                model
            );
            upscalePromptIdRef.current = promptId; // 记录放大任务的 prompt_id
            console.log('[Standard Upscale] Queued with promptId:', promptId);

            // 3. 轮询结果
            const pollUpscale = async () => {
                const result = await checkStandardUpscaleStatus(promptId);
                console.log('[Standard Upscale] Poll result:', result);

                if (result.status === 'completed' && result.imageUrl) {
                    // 创建放大后的图片记录
                    const upscaledImg: GeneratedImage = {
                        id: `${img.id}_upscaled_${Date.now()}`,
                        url: result.imageUrl,
                        timestamp: Date.now(),
                        prompt: positivePrompt,
                        negativePrompt: negativePrompt,
                        isUpscaled: true
                    };

                    // 更新历史：标记原图已有放大版本（隐藏放大按钮但不显示已放大标签），添加放大图
                    setHistory(prev => {
                        const updated = prev.map(h =>
                            h.id === img.id ? { ...h, hasUpscaledVersion: true } : h
                        );
                        return [upscaledImg, ...updated];
                    });

                    setCurrentImage(upscaledImg);
                    setUpscalingId(null);
                } else if (result.status === 'pending') {
                    // 继续轮询
                    setTimeout(pollUpscale, 1000);
                } else {
                    // 错误
                    console.error('[Standard Upscale] Failed');
                    setUpscalingId(null);
                }
            };

            pollUpscale();

        } catch (err) {
            console.error('[Standard Upscale] Error:', err);
            setUpscalingId(null);
        }
    }, [upscalingId, settings]);

    const handleApplyStyle = (config: StyleConfig) => {
        setSettings(prev => ({
            ...prev,
            model: config.model,
            loras: config.loras,
            prefixPrompt: config.prefixPrompt,
            // 注：应用风格时不覆盖当前主提示词 (positivePrompt)
            suffixPrompt: config.suffixPrompt,
            negativePrompt: config.negativePrompt
        }));
    };

    // 构造当前的 StyleConfig
    const currentStyleConfig: StyleConfig = {
        type: 'comfyui',
        model: settings.model,
        loras: settings.loras,
        prefixPrompt: settings.prefixPrompt,
        positivePrompt: "", // 风格库不捕获内容/主提示词
        suffixPrompt: settings.suffixPrompt,
        negativePrompt: settings.negativePrompt
    };

    return (
        <div className="min-h-screen bg-darker text-gray-100 font-sans selection:bg-primary/30">
            {/* Header */}
            <AppNavigation
                title={t.standardMode.title}
                mode="standard"
                user={user}
                onLogout={handleLogout}
                serverStatus={serverStatus === 'connected' ? 'connected' : 'disconnected'}
                onMobileSettingsClick={() => setShowMobileSettings(true)}
                onMobileHistoryClick={() => setShowMobileHistory(true)}
                onShowStyleManager={() => setShowStyleManager(true)}
            />

            {showStyleManager && (
                <StyleManager
                    currentConfig={currentStyleConfig}
                    currentImage={currentImage?.url}
                    onApplyStyle={handleApplyStyle}
                    onClose={() => setShowStyleManager(false)}
                />
            )}

            {/* Mobile Drawers */}
            <MobileDrawer
                isOpen={showMobileSettings}
                onClose={() => setShowMobileSettings(false)}
                title={t.standardMode.configuration}
                position="left"
            >
                <div className="space-y-6 pb-8">
                    <StandardPromptArea
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
                    <div className="p-2">
                        <StandardSettingsPanel
                            settings={settings}
                            onChange={(newSettings) => {
                                setSettings(newSettings);
                            }}
                            availableModels={availableModels}
                            availableLoras={availableLoras}
                            availableDetectors={availableDetectors}
                            isLoadingResources={isLoadingResources}
                            currentImage={currentImage?.url}
                            onApplyStyle={handleApplyStyle}
                        />
                    </div>
                </div>
            </MobileDrawer>

            <MobileDrawer
                isOpen={showMobileHistory}
                onClose={() => setShowMobileHistory(false)}
                title={t.standardMode.history}
                position="right"
            >
                <HistoryGallery
                    history={history}
                    selectedId={currentImage?.id}
                    onSelect={(img) => {
                        setCurrentImage(img);
                        setShowMobileHistory(false);
                    }}
                    onUpscale={handleUpscale}
                    upscalingId={upscalingId}
                    onUploadToGallery={handleUploadToGallery}
                />
            </MobileDrawer>

            {/* Main Content (Desktop Layout) */}
            <main className="hidden lg:flex fixed top-16 left-0 right-0 bottom-0 py-4 pl-4 pr-4 gap-4">
                {/* Left Column: Controls */}
                <div className="w-[420px] flex flex-col bg-surface/30 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <StandardPromptArea
                            prefixPrompt={settings.prefixPrompt}
                            positivePrompt={settings.positivePrompt}
                            suffixPrompt={settings.suffixPrompt}
                            negativePrompt={settings.negativePrompt}
                            onPrefixChange={(v) => setSettings(s => ({ ...s, prefixPrompt: v }))}
                            onPositiveChange={(v) => setSettings(s => ({ ...s, positivePrompt: v }))}
                            onSuffixChange={(v) => setSettings(s => ({ ...s, suffixPrompt: v }))}
                            onNegativeChange={(v) => setSettings(s => ({ ...s, negativePrompt: v }))}
                            onGenerate={handleGenerate}
                            isGenerating={status !== GenerationStatus.IDLE && status !== GenerationStatus.COMPLETE && status !== GenerationStatus.ERROR}
                            disabled={!!upscalingId}
                            progress={progress}
                        />
                        <div className="mt-4">
                            <StandardSettingsPanel
                                settings={settings}
                                onChange={(newSettings) => {
                                    setSettings(newSettings);
                                    // Optional: auto-close specific settings on mobile if needed
                                }}
                                availableModels={availableModels}
                                availableLoras={availableLoras}
                                availableDetectors={availableDetectors}
                                isLoadingResources={isLoadingResources}
                                currentImage={currentImage?.url}
                                onApplyStyle={handleApplyStyle}
                                onShowStyleManager={() => setShowStyleManager(true)}
                            />
                        </div>
                    </div>
                </div>

                {/* Center Column: Image Display */}
                <div className="flex-1 bg-black/40 rounded-3xl border border-white/5 overflow-hidden relative flex items-center justify-center group flex-col">
                    <div className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    ></div>

                    {currentImage ? (
                        <div className="relative w-full h-full p-4 flex items-center justify-center">
                            <img
                                src={currentImage.url}
                                alt="Generated"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            />
                            {/* 放大中覆盖层 */}
                            {upscalingId === currentImage.id && (
                                <div className="absolute inset-4 bg-black/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-3">
                                    <div className="relative w-16 h-16">
                                        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                        <Maximize2 className="absolute inset-0 m-auto text-primary" size={24} />
                                    </div>
                                    <p className="text-white font-medium">{t.history.upscaling} {upscaleProgress}%</p>
                                </div>
                            )}
                            {/* Download Button */}
                            <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a
                                    href={currentImage.url}
                                    download={`standard_${currentImage.id}.png`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-md block"
                                >
                                    <Download size={20} />
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-8 z-10">
                            {status === GenerationStatus.GENERATING || status === GenerationStatus.QUEUED || status === GenerationStatus.PREPARING ? (
                                <div className="space-y-4">
                                    <div className="relative w-24 h-24 mx-auto">
                                        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                        <Sparkles className="absolute inset-0 m-auto text-primary animate-pulse" size={32} />
                                    </div>
                                    <p className="text-gray-400 animate-pulse">
                                        {status === GenerationStatus.QUEUED ? t.standardMode.inQueue : `${t.standardMode.generating} ${progress}%`}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 opacity-50">
                                    <div className="w-20 h-20 bg-white/5 rounded-2xl mx-auto flex items-center justify-center mb-4">
                                        <ImageIcon size={32} className="text-gray-500" />
                                    </div>
                                    <p className="text-gray-400 font-medium">{t.standardMode.readyToCreate}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Overlay Progress for Desktop */}
                    {status === GenerationStatus.GENERATING && (
                        <div className="absolute bottom-0 left-0 h-1 bg-primary/50 transition-all duration-300" style={{ width: `${progress}%` }} />
                    )}
                </div>

                {/* Right Column: History */}
                <div className="w-48 flex flex-col bg-surface/30 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-3 border-b border-white/5 shrink-0">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.standardMode.history}</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <HistoryGallery
                            history={history}
                            selectedId={currentImage?.id}
                            onSelect={(img) => setCurrentImage(img)}
                            onUpscale={handleUpscale}
                            upscalingId={upscalingId}
                            onUploadToGallery={handleUploadToGallery}
                        />
                    </div>
                </div>
            </main>

            {/* Mobile Content */}
            <main className="lg:hidden pt-20 pb-24 px-4 h-full flex flex-col">
                <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden relative flex items-center justify-center mb-4">
                    {/* Mobile Image same logic as desktop essentially */}
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    {currentImage ? (
                        <div className="relative w-full h-full p-4 flex items-center justify-center">
                            <img src={currentImage.url} alt="Generated" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                            {/* 放大中覆盖层 */}
                            {upscalingId === currentImage.id && (
                                <div className="absolute inset-4 bg-black/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-2">
                                    <div className="relative w-12 h-12">
                                        <div className="absolute inset-0 rounded-full border-3 border-primary/20"></div>
                                        <div className="absolute inset-0 rounded-full border-3 border-primary border-t-transparent animate-spin"></div>
                                        <Maximize2 className="absolute inset-0 m-auto text-primary" size={18} />
                                    </div>
                                    <p className="text-white text-sm font-medium">{t.history.upscaling} {upscaleProgress}%</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center p-8">
                            {status === GenerationStatus.GENERATING || status === GenerationStatus.QUEUED ? (
                                <div className="space-y-4">
                                    <div className="relative w-20 h-20 mx-auto">
                                        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                    </div>
                                    <p className="text-gray-400 text-sm">Generating...</p>
                                </div>
                            ) : (
                                <div className="opacity-50 flex flex-col items-center">
                                    <ImageIcon size={28} className="text-gray-500 mb-2" />
                                    <p className="text-sm text-gray-400">Ready</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Mobile Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-darker/90 backdrop-blur border-t border-white/10 lg:hidden z-40 flex flex-col gap-2">
                {errorMsg && (
                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs truncate">
                        {errorMsg}
                    </div>
                )}
                <button
                    onClick={handleGenerate}
                    disabled={status === GenerationStatus.GENERATING || status === GenerationStatus.QUEUED || !settings.model || !!upscalingId}
                    className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                        ${(status === GenerationStatus.GENERATING || status === GenerationStatus.QUEUED)
                            ? 'bg-neutral-800 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary to-secondary'
                        }`}
                >
                    {status === GenerationStatus.GENERATING || status === GenerationStatus.QUEUED ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            {t.standardMode.generating} {progress}%
                        </>
                    ) : (
                        <>
                            <Zap size={18} className="fill-white" />
                            {t.standardMode.generate}
                        </>
                    )}
                </button>
            </div>

        </div>
    );
};

export default StandardApp;
