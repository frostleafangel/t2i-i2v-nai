import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    DuoGenerationSettings,
    GeneratedImage,
    GenerationStatus,
    StyleConfig
} from './types';
import {
    fetchAvailableModels,
    fetchAvailableLoras,
    uploadImageForUpscale,
    queueStandardUpscale,
    checkStandardUpscaleStatus
} from './services/standardComfyService';
import {
    queueDuoGeneration,
    checkDuoGenerationStatus
} from './services/duoComfyService';
import { COMFY_API_URL_STANDARD } from './constants';
import DuoSettingsPanel from './components/Duo/DuoSettingsPanel';
import DuoPromptArea from './components/Duo/DuoPromptArea';
import HistoryGallery from './components/HistoryGallery';
import MobileDrawer from './components/MobileDrawer';
import AppNavigation from './components/Common/AppNavigation';
import StyleManager from './components/Style/StyleManager';
import {
    Wifi, WifiOff, Settings, History,
    Sparkles, Download, User, LogOut, Users, Home, Clock, Trash2
} from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { createTask, updateTaskStatus } from './services/taskService';

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

const DEFAULT_SETTINGS: DuoGenerationSettings = {
    model: "",
    loras: [],
    // 角色A
    characterAPrompt: "",
    characterADetails: "1girl, white hair, blue eyes",
    // 角色B
    characterBPrompt: "",
    characterBDetails: "1girl, black hair, red eyes",
    // 主体
    mainPrompt: "masterpiece, best quality, 2girls, yuri, indoor",
    qualityPrompt: "masterpiece,best quality,newest,highres,absurdres,incredibly absurdres,very awa,very aesthetic,extreme aesthetic,detailed backgroud, finished,overlapping,appropriate posture,appropriate configuration,cropping,thick dense skin,ultra-precise skin,soft cheeks,",
    negativePrompt: "lowres, worst quality, bad quality, text, watermark, bad anatomy, bad hands",
    // 分区
    splitRatio: 0.5,
    splitDirection: 'vertical',
    // 自定义 Mask
    useCustomMask: false,
    customMaskData: undefined,
    // 画布
    width: 1024,
    height: 1024,
    // 采样
    steps: 30,
    cfg: 4.5,
    sampler: "euler_ancestral",
    scheduler: "karras",
    // 一次放大
    enableUpscale: false,
    upscaleFactor: 1.25,
    upscaleDenoise: 0.15,
    upscaleSteps: 20,
    upscaleCfg: 4.5,
    upscaleSampler: "res_multistep",
    upscaleScheduler: "exponential",
    // 二次放大
    enableSecondUpscale: false,
    secondUpscaleFactor: 1.1,
    secondUpscaleDenoise: 0.15,
    secondUpscaleSteps: 20,
    secondUpscaleCfg: 4.5,
    secondUpscaleSampler: "res_multistep",
    secondUpscaleScheduler: "exponential"
};

const DuoApp: React.FC = () => {
    const { t } = useLanguage();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // State
    const [settings, setSettings] = useState<DuoGenerationSettings>(DEFAULT_SETTINGS);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [availableLoras, setAvailableLoras] = useState<string[]>([]);
    const [isLoadingResources, setIsLoadingResources] = useState(true);

    const [history, setHistory] = useState<GeneratedImage[]>([]);
    const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);

    const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
    const [progress, setProgress] = useState(0);
    const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [upscalingId, setUpscalingId] = useState<string | null>(null);

    // Mobile UI State
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [showMobileHistory, setShowMobileHistory] = useState(false);
    const [showStyleManager, setShowStyleManager] = useState(false);

    const socketRef = useRef<WebSocket | null>(null);
    const currentPromptIdRef = useRef<string | null>(null);
    const pollingIntervalRef = useRef<any>(null);

    // Persistence Keys
    const SETTINGS_KEY = 'duo_settings_v1';
    const HISTORY_KEY = 'duo_history_v1';
    const PENDING_TASK_KEY = 'duo_pending_task_v1';

    // Check server status
    const checkServer = useCallback(async () => {
        try {
            const response = await fetch(`${COMFY_URL}/system_stats`);
            setServerStatus(response.ok ? 'connected' : 'disconnected');
        } catch {
            setServerStatus('disconnected');
        }
    }, []);

    // Load Cloud History
    const loadCloudHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/history?source=duo', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                return data.history || [];
            }
        } catch (error) {
            console.error('Failed to load cloud history:', error);
        }
        return [];
    }, []);

    // Sync Local to Cloud
    const syncLocalToCloud = useCallback(async (localHistory: GeneratedImage[]) => {
        if (localHistory.length === 0) return;
        try {
            // Ensure source is 'duo'
            const imagesToSync = localHistory.map(img => ({ ...img, source: 'duo' }));
            await fetch('/api/history/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ images: imagesToSync })
            });
            console.log(`Synced ${localHistory.length} local images to cloud`);
        } catch (error) {
            console.error('Failed to sync history:', error);
        }
    }, []);

    // Save Single Image to Cloud
    const saveToCloud = useCallback(async (img: GeneratedImage) => {
        try {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...img, source: 'duo' })
            });
        } catch (error) {
            console.error('Failed to save to cloud:', error);
        }
    }, []);

    // Load settings from localStorage
    useEffect(() => {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                setSettings(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error('Failed to parse saved settings:', e);
            }
        }
        setSettingsLoaded(true);

        const initHistory = async () => {
            // Load local history
            let localHistory: GeneratedImage[] = [];
            const savedHistory = localStorage.getItem(HISTORY_KEY);
            if (savedHistory) {
                try {
                    const parsed = JSON.parse(savedHistory);
                    if (Array.isArray(parsed)) {
                        localHistory = parsed;
                    }
                } catch (e) {
                    console.error('Failed to parse history:', e);
                }
            }

            // Load cloud history
            const cloudHistory = await loadCloudHistory();

            // Sync if needed (first time)
            const SYNCED_KEY = 'duo_history_synced_v1';
            const synced = localStorage.getItem(SYNCED_KEY);

            if (!synced && localHistory.length > 0) {
                await syncLocalToCloud(localHistory);
                localStorage.setItem(SYNCED_KEY, 'true');
            }

            // Merge
            const allHistory = [...cloudHistory];
            const cloudUrls = new Set(cloudHistory.map((h: any) => h.url));

            for (const localImg of localHistory) {
                if (!cloudUrls.has(localImg.url)) {
                    allHistory.push(localImg);
                }
            }

            // Sort
            allHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setHistory(allHistory);
            if (allHistory.length > 0) {
                setCurrentImage(allHistory[0]);
            }

            if (!synced) localStorage.setItem(SYNCED_KEY, 'true');

            // Check for pending task
            const pendingTaskJson = localStorage.getItem(PENDING_TASK_KEY);
            if (pendingTaskJson) {
                try {
                    const task = JSON.parse(pendingTaskJson);
                    // Resume if less than 2 hours old
                    if (Date.now() - task.timestamp < 2 * 60 * 60 * 1000) {
                        console.log('Resuming pending duo task:', task.promptId);
                        setStatus(GenerationStatus.GENERATING);
                        currentPromptIdRef.current = task.promptId;
                        startPolling(task.promptId);
                    } else {
                        localStorage.removeItem(PENDING_TASK_KEY);
                    }
                } catch (e) {
                    console.error("Failed to parse pending duo task", e);
                    localStorage.removeItem(PENDING_TASK_KEY);
                }
            }
        };

        const init = async () => {
            await initHistory();
            // ... resource loading ...
            try {
                const [models, loras] = await Promise.all([
                    fetchAvailableModels(),
                    fetchAvailableLoras()
                ]);
                setAvailableModels(models);
                setAvailableLoras(loras);

                // Auto-select first model if none selected
                const savedSettings = localStorage.getItem(SETTINGS_KEY);
                const savedModel = savedSettings ? JSON.parse(savedSettings).model : null;
                if (!savedModel && models.length > 0) {
                    setSettings(prev => ({ ...prev, model: models[0] }));
                }
            } catch (err) {
                console.error("Failed to load resources:", err);
                setErrorMsg("Failed to load models/loras.");
            } finally {
                setIsLoadingResources(false);
            }
        }
        init();

    }, [loadCloudHistory, syncLocalToCloud]);

    // Save settings to localStorage
    useEffect(() => {
        if (settingsLoaded) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }
    }, [settings, settingsLoaded]);

    // Save history to localStorage
    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }, [history]);

    // 服务器离线时清理过期的 pending task，防止卡在"生成中"状态
    useEffect(() => {
        if (serverStatus === 'disconnected') {
            const pendingTaskJson = localStorage.getItem(PENDING_TASK_KEY);
            if (pendingTaskJson) {
                try {
                    const task = JSON.parse(pendingTaskJson);
                    // 如果任务已经超过 5 分钟且服务器离线，清理任务让用户可以重新生成
                    if (Date.now() - task.timestamp > 5 * 60 * 1000) {
                        localStorage.removeItem(PENDING_TASK_KEY);
                        setStatus(GenerationStatus.IDLE);
                        setErrorMsg('连接丢失，请重新生成');
                        if (pollingIntervalRef.current) {
                            clearInterval(pollingIntervalRef.current);
                            pollingIntervalRef.current = null;
                        }
                    }
                } catch (e) {
                    localStorage.removeItem(PENDING_TASK_KEY);
                    setStatus(GenerationStatus.IDLE);
                }
            }
        }
    }, [serverStatus]);

    // Polling logic
    const startPolling = useCallback((promptId: string) => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        let consecutiveErrors = 0;
        let notFoundCount = 0;
        const MAX_CONSECUTIVE_ERRORS = 30; // 约 60 秒后停止重试
        const MAX_NOT_FOUND_COUNT = 60; // not_found 状态允许更多重试（约 120 秒）

        pollingIntervalRef.current = setInterval(async () => {
            try {
                const result = await checkDuoGenerationStatus(promptId);

                if (result.status === 'completed' && result.imageUrl) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;

                    const newImage: GeneratedImage = {
                        id: `duo_${Date.now()}`,
                        url: result.imageUrl,
                        prompt: `${settings.mainPrompt} | A: ${[settings.characterAPrompt, settings.characterADetails].filter(Boolean).join(', ')} | B: ${[settings.characterBPrompt, settings.characterBDetails].filter(Boolean).join(', ')}`,
                        negativePrompt: settings.negativePrompt,
                        timestamp: Date.now(),
                        width: settings.width,
                        height: settings.height,
                        isUpscaled: result.isUpscaled,
                        source: 'duo',
                        metadata: { duoSettings: { ...settings } }
                    };

                    setHistory(prev => {
                        // Dedupe: check if this image URL already exists in history
                        if (prev.some(img => img.url === newImage.url)) {
                            console.log('[Duo] Image already in history, skipping duplicate:', newImage.url);
                            return prev;
                        }
                        return [newImage, ...prev];
                    });
                    setCurrentImage(newImage);
                    setStatus(GenerationStatus.COMPLETE);
                    setProgress(100);
                    currentPromptIdRef.current = null;
                    saveToCloud(newImage);
                    localStorage.removeItem(PENDING_TASK_KEY);
                    // 记录成功到后端
                    updateTaskStatus(promptId, 'completed', newImage.url).catch(e => console.error(e));
                    // 重置错误计数
                    consecutiveErrors = 0;
                    notFoundCount = 0;
                } else if (result.status === 'failed') {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                    setStatus(GenerationStatus.ERROR);
                    setErrorMsg('生成失败');
                    currentPromptIdRef.current = null;
                    localStorage.removeItem(PENDING_TASK_KEY);
                    updateTaskStatus(promptId, 'failed', undefined, '生成失败').catch(console.error);
                } else if (result.status === 'not_found') {
                    notFoundCount++;
                    console.warn(`[Duo Polling] Status not found (${notFoundCount}/${MAX_NOT_FOUND_COUNT}), retrying...`);

                    if (notFoundCount >= MAX_NOT_FOUND_COUNT) {
                        // 任务可能已丢失（ComfyUI 重启）
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                        console.warn('[Duo Polling] Task not found after max retries, may be lost');
                        localStorage.removeItem(PENDING_TASK_KEY);
                        setStatus(GenerationStatus.IDLE);
                        setErrorMsg('任务丢失，请重新生成');
                        currentPromptIdRef.current = null;
                        updateTaskStatus(promptId, 'failed', undefined, '任务丢失，请重新生成').catch(console.error);
                    }
                } else {
                    // 其他状态（pending），重置错误计数
                    consecutiveErrors = 0;
                }
            } catch (err) {
                consecutiveErrors++;
                console.error(`[Duo] Polling error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err);

                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                    localStorage.removeItem(PENDING_TASK_KEY);
                    setStatus(GenerationStatus.ERROR);
                    setErrorMsg('连接丢失，请检查网络后重新生成');
                    currentPromptIdRef.current = null;
                    updateTaskStatus(promptId, 'failed', undefined, '连接丢失').catch(console.error);
                }
            }
        }, 2000);
    }, [settings]);

    // Handle generate
    const handleGenerate = async () => {
        if (status === GenerationStatus.GENERATING) return;

        setStatus(GenerationStatus.GENERATING);
        setProgress(0);
        setErrorMsg(null);

        try {
            const promptId = await queueDuoGeneration(settings);
            currentPromptIdRef.current = promptId;
            
            // 报告任务创建给后端
            createTask(promptId, 'comfy_duo', settings).catch(console.error);

            // Save Pending Task (exclude large data like customMaskData to avoid quota issues)
            const { customMaskData, ...settingsForStorage } = settings;
            localStorage.setItem(PENDING_TASK_KEY, JSON.stringify({
                promptId,
                timestamp: Date.now(),
                settings: settingsForStorage
            }));

            startPolling(promptId);
        } catch (err: any) {
            console.error('Generation failed:', err);
            setStatus(GenerationStatus.ERROR);
            setErrorMsg(err.message || '生成失败');
        }
    };

    // Cancel generation
    const handleCancel = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        currentPromptIdRef.current = null;
        setStatus(GenerationStatus.IDLE);
    };

    // Initial Load
    useEffect(() => {
        checkServer();

        // Restore settings from Gallery if available
        const storedSettings = sessionStorage.getItem('duo_init_settings');
        if (storedSettings) {
            try {
                const data = JSON.parse(storedSettings);
                setSettings(prev => ({
                    ...prev,
                    mainPrompt: data.mainPrompt || prev.mainPrompt,
                    qualityPrompt: data.qualityPrompt || prev.qualityPrompt,
                    characterAPrompt: data.characterA?.prompt || prev.characterAPrompt,
                    characterADetails: data.characterA?.details || prev.characterADetails,
                    characterBPrompt: data.characterB?.prompt || prev.characterBPrompt,
                    characterBDetails: data.characterB?.details || prev.characterBDetails,
                    negativePrompt: data.negativePrompt || prev.negativePrompt,
                    splitDirection: data.split?.direction || prev.splitDirection,
                    splitRatio: data.split?.ratio || prev.splitRatio,
                    loras: data.loras || prev.loras,
                    useCustomMask: data.useCustomMask,
                    customMaskData: data.customMaskData,
                    steps: data.steps || prev.steps,
                    cfg: data.cfg || prev.cfg,
                    sampler: data.sampler || prev.sampler,
                    scheduler: data.scheduler || prev.scheduler,
                    model: data.model || prev.model
                }));
                sessionStorage.removeItem('duo_init_settings');
            } catch (e) {
                console.error('Failed to restore Duo settings:', e);
            }
        }
    }, []);

    // WebSocket for progress
    useEffect(() => {
        const connect = () => {
            try {
                const ws = new WebSocket(COMFY_WS_URL);

                ws.onopen = () => {
                    console.log('Duo Mode WS Connected');
                    setServerStatus('connected');
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'progress' && currentPromptIdRef.current) {
                            setProgress(Math.round((data.data.value / data.data.max) * 100));
                        }
                    } catch { }
                };

                ws.onclose = () => {
                    setServerStatus('disconnected');
                    setTimeout(connect, 5000);
                };

                ws.onerror = () => {
                    ws.close();
                };

                socketRef.current = ws;
            } catch { }
        };

        connect();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    // Download image
    const handleDownload = () => {
        if (!currentImage) return;
        const link = document.createElement('a');
        link.href = currentImage.url;
        link.download = `duo_${Date.now()}.png`;
        link.click();
    };

    // Select from history
    const handleSelectHistory = (image: GeneratedImage) => {
        setCurrentImage(image);
    };

    // Upload to Gallery
    const handleUploadToGallery = useCallback(async (img: GeneratedImage): Promise<boolean> => {
        try {
            // Prefer using metadata saved with the image, fallback to current settings
            // img.metadata might be { duoSettings: ... } or direct settings object
            const savedSettings = (img.metadata as any)?.duoSettings || img.metadata;
            const meta = (savedSettings as DuoGenerationSettings) || settings;

            const contentMetadata = {
                // Compatible fields
                positivePrompt: img.prompt || meta.mainPrompt,
                width: img.width || meta.width,
                height: img.height || meta.height,
                model: meta.model,

                // Duo structure
                duo: {
                    mainPrompt: meta.mainPrompt,
                    qualityPrompt: meta.qualityPrompt,
                    characterA: {
                        prompt: meta.characterAPrompt,
                        details: meta.characterADetails
                    },
                    characterB: {
                        prompt: meta.characterBPrompt,
                        details: meta.characterBDetails
                    },
                    negativePrompt: meta.negativePrompt,
                    split: {
                        ratio: meta.splitRatio,
                        direction: meta.splitDirection
                    },
                    loras: meta.loras,
                    // Additional fields for full restoration
                    useCustomMask: meta.useCustomMask,
                    customMaskData: meta.customMaskData,
                    steps: meta.steps,
                    cfg: meta.cfg,
                    sampler: meta.sampler,
                    scheduler: meta.scheduler,
                    model: meta.model // explicitly include model inside duo for self-containment
                }
            };

            const response = await fetch('/api/gallery/upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    imageUrl: img.url,
                    prompt: img.prompt || meta.mainPrompt,
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

    // Upscale image
    const handleUpscale = useCallback(async (img: GeneratedImage) => {
        if (upscalingId || img.isUpscaled) return;

        const positivePrompt = img.prompt || settings.mainPrompt;
        const negativePrompt = settings.negativePrompt;
        const model = settings.model;

        if (!model) {
            console.error('[Duo Upscale] No model selected');
            return;
        }

        setUpscalingId(img.id);
        console.log('[Duo Upscale] Starting upscale for:', img.id);

        try {
            // 1. 上传图片到 ComfyUI
            const uploadedName = await uploadImageForUpscale(img.url);
            console.log('[Duo Upscale] Uploaded as:', uploadedName);

            // 2. 入队放大任务
            const promptId = await queueStandardUpscale(
                uploadedName,
                positivePrompt,
                negativePrompt,
                model
            );
            console.log('[Duo Upscale] Queued with promptId:', promptId);

            // 3. 轮询结果
            const pollUpscale = async () => {
                const result = await checkStandardUpscaleStatus(promptId);
                console.log('[Duo Upscale] Poll result:', result);

                if (result.status === 'completed' && result.imageUrl) {
                    const upscaledImg: GeneratedImage = {
                        id: `${img.id}_upscaled_${Date.now()}`,
                        url: result.imageUrl,
                        timestamp: Date.now(),
                        prompt: positivePrompt,
                        isUpscaled: true
                    };

                    setHistory(prev => {
                        const updated = prev.map(h =>
                            h.id === img.id ? { ...h, hasUpscaledVersion: true } : h
                        );
                        return [upscaledImg, ...updated];
                    });

                    setCurrentImage(upscaledImg);
                    setUpscalingId(null);
                } else if (result.status === 'pending' || result.status === 'not_found') {
                    // Continue polling for pending or not_found (allowing time for sync)
                    setTimeout(pollUpscale, 1000);
                } else {
                    console.error('[Duo Upscale] Failed, status:', result.status);
                    setUpscalingId(null);
                }
            };

            pollUpscale();
        } catch (err) {
            console.error('[Duo Upscale] Error:', err);
            setUpscalingId(null);
        }
    }, [upscalingId, settings]);

    // Delete from history (legacy)
    const handleDeleteHistory = (index: number) => {
        setHistory(prev => prev.filter((_, i) => i !== index));
    };

    // 清空历史记录
    const handleClearHistory = useCallback(async () => {
        setHistory([]);
        setCurrentImage(null);
        localStorage.removeItem('duo_history_v2');
        // 清空云端历史
        try {
            const existingHistory = await fetch('/api/history?source=duo&limit=100', { credentials: 'include' });
            if (existingHistory.ok) {
                const data = await existingHistory.json();
                for (const item of data.history || []) {
                    await fetch(`/api/history/${item.id}`, { method: 'DELETE', credentials: 'include' });
                }
            }
        } catch (e) {
            console.warn('[Duo] Failed to clear cloud history:', e);
        }
    }, []);

    // 删除单个历史项目
    const handleDeleteHistoryItem = useCallback(async (img: GeneratedImage) => {
        setHistory(prev => {
            const updated = prev.filter(item => item.id !== img.id);
            localStorage.setItem('duo_history_v2', JSON.stringify(updated));
            return updated;
        });
        if (currentImage?.id === img.id) {
            setCurrentImage(null);
        }
        // 删除云端记录
        try {
            await fetch(`/api/history/${img.id}`, { method: 'DELETE', credentials: 'include' });
        } catch (e) {
            console.warn('[Duo] Failed to delete from cloud:', e);
        }
    }, [currentImage]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // 构造当前的 StyleConfig
    const currentStyleConfig: StyleConfig = {
        type: 'comfyui',
        model: settings.model,
        loras: settings.loras,
        prefixPrompt: settings.qualityPrompt,
        positivePrompt: "",
        suffixPrompt: "",
        negativePrompt: settings.negativePrompt
    };

    const handleApplyStyle = (config: StyleConfig) => {
        setSettings(prev => ({
            ...prev,
            model: config.model,
            loras: config.loras,
            qualityPrompt: config.prefixPrompt,
            negativePrompt: config.negativePrompt
        }));
    };

    return (
        <div className="min-h-screen bg-darker text-gray-100 font-sans selection:bg-primary/30">
            {/* Header */}
            <AppNavigation
                title="双人模式"
                mode="duo"
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

            <main className="pt-16 pl-0 lg:pl-[420px] pr-0 lg:pr-[320px] min-h-screen">
                {/* Left Column - Settings (Desktop) */}
                <div className="hidden lg:flex flex-col fixed top-16 left-0 bottom-0 w-[420px] bg-surface/30 border-r border-white/5 z-20">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <DuoPromptArea
                            settings={settings}
                            onSettingsChange={setSettings}
                            onGenerate={handleGenerate}
                            isGenerating={status === GenerationStatus.GENERATING}
                        />
                        <div className="mt-4">
                            <DuoSettingsPanel
                                settings={settings}
                                onChange={setSettings}
                                availableModels={availableModels}
                                availableLoras={availableLoras}
                            />
                        </div>
                    </div>
                </div>

                {/* Center - Image Preview */}
                <div className="h-[calc(100vh-64px)] bg-black/40 relative flex items-center justify-center p-4 lg:p-8 overflow-hidden">
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
                                className="max-w-full max-h-[calc(100vh-64px-4rem)] object-contain rounded-lg shadow-2xl"
                            />
                        </div>
                    ) : (
                        <div className="text-gray-500 text-sm flex flex-col items-center gap-3">
                            <Sparkles size={32} className="opacity-50" />
                            <p>准备生成</p>
                        </div>
                    )}
                    {errorMsg && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-30 w-[90%] sm:w-auto text-center">
                            {errorMsg}
                        </div>
                    )}

                    {/* Progress overlay */}
                    {status === GenerationStatus.GENERATING && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                            <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden mb-4">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-gray-300">{progress}%</p>
                            <button
                                onClick={handleCancel}
                                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm"
                            >
                                取消
                            </button>
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
                            onSelect={handleSelectHistory}
                            selectedId={currentImage?.id}
                            onUpscale={handleUpscale}
                            upscalingId={upscalingId}
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
                    disabled={status === GenerationStatus.GENERATING}
                    className={`
                        w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                        ${status === GenerationStatus.GENERATING
                            ? 'bg-neutral-800 cursor-not-allowed'
                            : 'bg-gradient-to-r from-pink-500 to-purple-600'
                        }
                    `}
                >
                    {status === GenerationStatus.GENERATING ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>生成中...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={18} className="fill-white" />
                            <span>开始生成</span>
                        </>
                    )}
                </button>
            </div>

            {/* Mobile Drawers */}
            <MobileDrawer
                isOpen={showMobileSettings}
                onClose={() => setShowMobileSettings(false)}
                title="设置"
                position="left"
            >
                <div>
                    <DuoPromptArea
                        settings={settings}
                        onSettingsChange={setSettings}
                        onGenerate={handleGenerate}
                        isGenerating={status === GenerationStatus.GENERATING}
                        progress={progress}
                        hideGenerateButton={true}
                    />
                    <div className="p-4">
                        <DuoSettingsPanel
                            settings={settings}
                            onChange={setSettings}
                            availableModels={availableModels}
                            availableLoras={availableLoras}
                        />
                    </div>
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
                        onSelect={(img) => { handleSelectHistory(img); setShowMobileHistory(false); }}
                        selectedId={currentImage?.id}
                        onUpscale={handleUpscale}
                        upscalingId={upscalingId}
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

export default DuoApp;
