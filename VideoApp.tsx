/**
 * 图生视频主页面
 * 基于 WAN 2.2 I2V 工作流
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    VideoGenerationSettings,
    GeneratedVideo,
    GenerationStatus
} from './types';
import {
    uploadImageForVideo,
    queueVideoGeneration,
    checkVideoGenerationStatus,
    fetchVideoLoras,
    DEFAULT_VIDEO_SETTINGS
} from './services/videoComfyService';
import {
    createTask,
    updateTaskStatus,
    getActiveTasks,
    getTask,
    Task
} from './services/taskService';
import { COMFY_API_URL_STANDARD } from './constants';
import VideoSettingsPanel from './components/Video/VideoSettingsPanel';
import VideoPromptArea from './components/Video/VideoPromptArea';
import VideoHistoryGallery from './components/Video/VideoHistoryGallery';
import MobileDrawer from './components/MobileDrawer';
import AppNavigation from './components/Common/AppNavigation';
import {
    Wifi, WifiOff, Settings, History, Video, Zap, Download, Play, Pause, Trash2
} from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { comfyFetch } from './services/comfyFetch';

const COMFY_URL = COMFY_API_URL_STANDARD;

// 默认负面提示词
const DEFAULT_NEGATIVE_PROMPT = "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走";

const DEFAULT_SETTINGS: VideoGenerationSettings = {
    positivePrompt: '',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    duration: 5,
    frameRate: 16,
    seed: -1,
    steps: 4,
    cfg: 1,
    crf: 19,
    refinerStep: 2,
    shiftHigh: 5,
    shiftLow: 5,
    samplerName: 'uni_pc_bh2',
    scheduler: 'beta',
    loras: []
};

const VideoApp: React.FC = () => {
    const { t } = useLanguage();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // State
    const [settings, setSettings] = useState<VideoGenerationSettings>(DEFAULT_SETTINGS);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
    // 首尾帧模式状态
    const [flf2vEnabled, setFlf2vEnabled] = useState(false);
    const [uploadedLastFrame, setUploadedLastFrame] = useState<string | null>(null);
    const [uploadedLastFrameName, setUploadedLastFrameName] = useState<string | null>(null);

    const [history, setHistory] = useState<GeneratedVideo[]>([]);
    const [currentVideo, setCurrentVideo] = useState<GeneratedVideo | null>(null);

    const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
    const [progress, setProgress] = useState(0);
    const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    // Mobile UI State
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [showMobileHistory, setShowMobileHistory] = useState(false);
    const [settingsCollapsed, setSettingsCollapsed] = useState(false);

    // LORA State
    const [availableVideoLoras, setAvailableVideoLoras] = useState<string[]>([]);
    const [isLoadingLoras, setIsLoadingLoras] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const currentPromptIdRef = useRef<string | null>(null);
    const pollingIntervalRef = useRef<any>(null);
    const isRestoringRef = useRef(false);
    const isSubmittingRef = useRef(false); // 防止重复提交的 ref（比 state 更可靠）
    const pollingAttemptsRef = useRef(0); // 轮询尝试次数（用于页面恢复时重置）
    const backgroundStartTimeRef = useRef<number | null>(null); // 页面进入后台的时间
    const queueWaitTimeRef = useRef<number>(0);
    const taskStartTimeRef = useRef<number>(0);

    // Persistence Keys
    const SETTINGS_KEY = 'video_settings_v1';
    const HISTORY_KEY = 'video_history_v1';
    const SYNCED_KEY = 'video_history_synced_v1';

    // 从云端加载历史记录
    const loadCloudHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/history?source=video&limit=50', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                return data.history || [];
            }
        } catch (error) {
            console.error('[Video] Failed to load cloud history:', error);
        }
        return [];
    }, []);

    // 同步本地历史到云端
    const syncLocalToCloud = useCallback(async (localHistory: GeneratedVideo[]) => {
        if (localHistory.length === 0) return;
        try {
            const imagesToSync = localHistory.map(v => ({
                url: v.url,
                prompt: v.prompt,
                negativePrompt: v.negativePrompt,
                timestamp: v.timestamp,
                source: 'video',
                metadata: {
                    duration: v.duration,
                    frameRate: v.frameRate,
                    firstFrameUrl: v.firstFrameUrl,
                    lastFrameUrl: v.lastFrameUrl  // 尾帧URL用于接续生成
                }
            }));
            await fetch('/api/history/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ images: imagesToSync })
            });
            console.log(`[Video] Synced ${localHistory.length} local videos to cloud`);
        } catch (error) {
            console.error('[Video] Failed to sync history:', error);
        }
    }, []);

    // 保存单条记录到云端
    const saveToCloud = useCallback(async (video: GeneratedVideo) => {
        try {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    url: video.url,
                    prompt: video.prompt,
                    negativePrompt: video.negativePrompt,
                    source: 'video',
                    metadata: {
                        duration: video.duration,
                        frameRate: video.frameRate,
                        firstFrameUrl: video.firstFrameUrl,
                        lastFrameUrl: video.lastFrameUrl  // 尾帧URL用于接续生成
                    }
                })
            });
        } catch (error) {
            console.error('[Video] Failed to save to cloud:', error);
        }
    }, []);

    // Load settings and history on mount
    useEffect(() => {
        // 参数版本控制：用于一次性推送最佳参数给所有用户
        const SETTINGS_VERSION_KEY = 'video_settings_version';
        const CURRENT_VERSION = '1'; // 提升此版本号可再次推送新参数

        const savedVersion = localStorage.getItem(SETTINGS_VERSION_KEY);
        const savedSettings = localStorage.getItem(SETTINGS_KEY);

        if (savedVersion !== CURRENT_VERSION) {
            // 版本不匹配，强制使用新默认参数
            console.log('[Video] Settings version mismatch, applying optimal defaults');
            setSettings(DEFAULT_SETTINGS);
            localStorage.setItem(SETTINGS_VERSION_KEY, CURRENT_VERSION);
            // 清除旧设置
            localStorage.removeItem(SETTINGS_KEY);
        } else if (savedSettings) {
            // 版本匹配，使用用户自己的设置
            try {
                const parsed = JSON.parse(savedSettings);
                setSettings({ ...DEFAULT_SETTINGS, ...parsed });
            } catch (e) {
                console.error('Failed to parse saved settings:', e);
            }
        }

        const initHistory = async () => {
            // 1. 加载本地历史
            let localHistory: GeneratedVideo[] = [];
            const savedHistory = localStorage.getItem(HISTORY_KEY);
            if (savedHistory) {
                try {
                    const parsed = JSON.parse(savedHistory);
                    // 只保留最近 3 天的记录
                    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
                    localHistory = parsed.filter((v: GeneratedVideo) => v.timestamp > threeDaysAgo);
                } catch (e) {
                    console.error('Failed to parse history:', e);
                }
            }

            // 2. 加载云端历史
            const cloudHistory = await loadCloudHistory();

            // 3. 首次同步本地到云端
            const synced = localStorage.getItem(SYNCED_KEY);
            if (!synced && localHistory.length > 0) {
                await syncLocalToCloud(localHistory);
                localStorage.setItem(SYNCED_KEY, 'true');
            }

            // 4. 合并去重（云端优先）
            const allHistory: GeneratedVideo[] = [];
            const seenUrls = new Set<string>();

            // 先添加云端记录
            for (const h of cloudHistory) {
                const video: GeneratedVideo = {
                    id: h.id,
                    url: h.url,
                    prompt: h.prompt || '',
                    negativePrompt: h.negativePrompt,
                    timestamp: h.timestamp,
                    duration: h.metadata?.duration || 5,
                    frameRate: h.metadata?.frameRate || 16,
                    firstFrameUrl: h.metadata?.firstFrameUrl,
                    lastFrameUrl: h.metadata?.lastFrameUrl,  // 尾帧URL用于接续生成
                    isShared: h.isShared // 传递已分享状态
                };
                if (!seenUrls.has(video.url)) {
                    seenUrls.add(video.url);
                    allHistory.push(video);
                }
            }

            // 再添加本地独有的记录
            for (const v of localHistory) {
                if (!seenUrls.has(v.url)) {
                    seenUrls.add(v.url);
                    allHistory.push(v);
                }
            }

            // 5. 按时间排序
            allHistory.sort((a, b) => b.timestamp - a.timestamp);
            setHistory(allHistory);
            if (allHistory.length > 0) {
                setCurrentVideo(allHistory[0]);
            }

            if (!synced) localStorage.setItem(SYNCED_KEY, 'true');
        };

        initHistory();

        // 检查是否有从其他模式发送过来的图片（优先级高）
        const initImage = sessionStorage.getItem('video_init_image');
        const initPrompt = sessionStorage.getItem('video_init_prompt');

        if (initImage) {
            console.log('[Video] Received image from other mode');
            setUploadedImage(initImage);
            sessionStorage.removeItem('video_init_image');

            // 同时保存到持久化存储
            try {
                localStorage.setItem('video_first_frame', initImage);
            } catch (e) { }
        } else {
            // 否则加载之前保存的首帧图片
            const savedImage = localStorage.getItem('video_first_frame');
            console.log('[Video] Checking localStorage for saved image:', savedImage ? `found (${Math.round(savedImage.length / 1024)}KB)` : 'not found');
            if (savedImage) {
                console.log('[Video] Restored saved first frame image');
                setUploadedImage(savedImage);
            }
        }

        // 如果有传入的 prompt，应用到设置中
        if (initPrompt) {
            console.log('[Video] Received prompt from gallery:', initPrompt);
            setSettings(s => ({ ...s, positivePrompt: initPrompt }));
            sessionStorage.removeItem('video_init_prompt');
        }
    }, [loadCloudHistory, syncLocalToCloud]);

    // Save settings on change
    useEffect(() => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }, [settings]);

    // Save history on change (排除 firstFrameUrl 以避免 localStorage 配额超限)
    useEffect(() => {
        const historyForStorage = history.slice(0, 50).map(v => {
            const { firstFrameUrl, ...rest } = v;
            return rest;
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(historyForStorage));
    }, [history]);

    // Check server status
    useEffect(() => {
        const checkServer = async () => {
            try {
                const res = await comfyFetch(`${COMFY_URL}/system_stats`);
                setServerStatus(res.ok ? 'connected' : 'disconnected');
            } catch (e) {
                setServerStatus('disconnected');
            }
        };

        checkServer();
        const interval = setInterval(checkServer, 10000);
        return () => clearInterval(interval);
    }, []);

    // 获取可用的视频LORA
    useEffect(() => {
        const loadVideoLoras = async () => {
            setIsLoadingLoras(true);
            try {
                const loras = await fetchVideoLoras();
                setAvailableVideoLoras(loras);
            } catch (err) {
                console.error('[Video] Failed to fetch loras:', err);
            } finally {
                setIsLoadingLoras(false);
            }
        };
        loadVideoLoras();
    }, []);

    // 恢复活动任务
    useEffect(() => {
        const restoreActiveTasks = async () => {
            if (isRestoringRef.current) return;
            isRestoringRef.current = true;

            try {
                // 优先从 sessionStorage 恢复任务ID（浏览器关闭后仍保留）
                const savedTaskId = sessionStorage.getItem('video_current_task');
                let taskToRestore = null;

                if (savedTaskId) {
                    console.log('[Video] Found saved task in sessionStorage:', savedTaskId);
                    // 通过任务ID直接获取任务详情
                    try {
                        taskToRestore = await getTask(savedTaskId);
                    } catch (e) {
                        console.warn('[Video] Failed to get saved task:', e);
                    }
                }

                // 如果 sessionStorage 没有任务，尝试从后端获取活动任务
                if (!taskToRestore) {
                    const tasks = await getActiveTasks();
                    taskToRestore = tasks.find(t => t.type === 'video') || null;
                }

                if (taskToRestore) {
                    console.log('[Video] Found task to restore:', taskToRestore.id, 'status:', taskToRestore.status);

                    if (taskToRestore.status === 'completed') {
                        // 任务已完成，检查是否已在历史记录中
                        // 注意：此时 history 可能尚未加载，使用 setHistory 的回调形式处理
                        console.log('[Video] Restoring completed task result');

                        try {
                            const result = await checkVideoGenerationStatus(taskToRestore.id);

                            if (result.status === 'completed' && result.videoUrl) {
                                const params = taskToRestore.params || {};
                                let firstFrameUrl = undefined;
                                if (params.firstFrameImage) {
                                    firstFrameUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(params.firstFrameImage)}&type=input`;
                                }

                                const newVideo: GeneratedVideo = {
                                    id: taskToRestore.id,
                                    url: result.videoUrl,
                                    prompt: params.positivePrompt || '',
                                    negativePrompt: params.negativePrompt,
                                    timestamp: Date.now(),
                                    duration: params.duration || 5,
                                    frameRate: params.frameRate || 16,
                                    firstFrameUrl,
                                    lastFrameUrl: result.lastFrameUrl
                                };

                                // 使用函数式更新避免时序问题，内部检查去重
                                setHistory(prev => {
                                    if (prev.some(v => v.id === newVideo.id)) {
                                        console.log('[Video] Video already in history, skipping');
                                        return prev;
                                    }
                                    console.log('[Video] Adding restored video to history');
                                    return [newVideo, ...prev];
                                });
                                setCurrentVideo(newVideo);
                                setStatus(GenerationStatus.COMPLETE);
                                sessionStorage.removeItem('video_current_task');

                                // 保存到云端
                                saveToCloud(newVideo);
                                console.log('[Video] Successfully restored completed task to history');
                            }
                        } catch (e) {
                            console.warn('[Video] Failed to restore completed task:', e);
                            // 清除无效的 sessionStorage 记录
                            sessionStorage.removeItem('video_current_task');
                        }
                    } else if (taskToRestore.status === 'pending' || taskToRestore.status === 'running') {
                        // 任务进行中，恢复轮询
                        console.log('[Video] Restoring active task:', taskToRestore.id, taskToRestore.params);
                        currentPromptIdRef.current = taskToRestore.id;
                        setStatus(taskToRestore.status === 'running' ? GenerationStatus.GENERATING : GenerationStatus.QUEUED);

                        // 从任务参数恢复设置
                        if (taskToRestore.params) {
                            const params = taskToRestore.params;
                            setSettings(s => ({
                                ...s,
                                positivePrompt: params.positivePrompt || s.positivePrompt,
                                negativePrompt: params.negativePrompt || s.negativePrompt,
                                duration: params.duration || s.duration,
                                frameRate: params.frameRate || s.frameRate
                            }));

                            // 如果有保存的首帧图片 URL，尝试从 ComfyUI 恢复
                            if (params.firstFrameImage) {
                                setUploadedImageName(params.firstFrameImage);
                            }
                        }

                        // 开始轮询
                        startPolling(taskToRestore.id);
                    } else {
                        // 任务失败或取消，清除 sessionStorage
                        console.log('[Video] Task status is', taskToRestore.status, ', clearing sessionStorage');
                        sessionStorage.removeItem('video_current_task');
                    }
                } else {
                    // 没有找到任务，清除可能过期的 sessionStorage
                    sessionStorage.removeItem('video_current_task');
                }
            } catch (err) {
                console.error('[Video] Failed to restore tasks:', err);
            } finally {
                isRestoringRef.current = false;
            }
        };

        restoreActiveTasks();
    }, []);

    // 上传视频到画廊
    const handleUploadToGallery = useCallback(async (video: GeneratedVideo): Promise<boolean> => {
        try {
            // 视频需要有首帧图片才能上传
            if (!video.firstFrameUrl) {
                console.warn('[Video] Cannot upload video without firstFrameUrl');
                return false;
            }

            // 构建视频元数据
            const videoMetadata = {
                duration: video.duration,
                frameRate: video.frameRate,
                firstFrameUrl: video.firstFrameUrl,
                videoUrl: video.url,
                positivePrompt: video.prompt,
                negativePrompt: video.negativePrompt
            };

            // 使用首帧图片作为画廊封面
            const response = await fetch('/api/gallery/upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    imageUrl: video.firstFrameUrl, // 使用首帧作为封面
                    prompt: video.prompt || '视频生成',
                    source: 'video',
                    metadata: JSON.stringify(videoMetadata)
                })
            });
            return response.ok;
        } catch (error) {
            console.error('[Video] Upload to gallery failed:', error);
            return false;
        }
    }, []);

    // 清空历史记录
    const handleClearHistory = useCallback(async () => {
        setHistory([]);
        setCurrentVideo(null);
        localStorage.removeItem(HISTORY_KEY);
        localStorage.removeItem('video_first_frame');
        // 清空云端历史
        try {
            const existingHistory = await fetch('/api/history?source=video&limit=100', { credentials: 'include' });
            if (existingHistory.ok) {
                const data = await existingHistory.json();
                for (const item of data.history || []) {
                    await fetch(`/api/history/${item.id}`, { method: 'DELETE', credentials: 'include' });
                }
            }
        } catch (e) {
            console.warn('[Video] Failed to clear cloud history:', e);
        }
    }, []);

    // 删除单个视频历史项目
    const handleDeleteHistoryItem = useCallback(async (video: GeneratedVideo) => {
        setHistory(prev => {
            const updated = prev.filter(item => item.id !== video.id);
            // 保存到 localStorage，如果配额超限则静默失败
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
            } catch (e) {
                console.warn('[Video] Failed to save to localStorage (quota exceeded), skipping local save');
            }
            return updated;
        });
        if (currentVideo?.id === video.id) {
            setCurrentVideo(null);
        }
        // 删除云端记录（忽略404错误，因为可能是本地生成的记录）
        try {
            const response = await fetch(`/api/history/${video.id}`, { method: 'DELETE', credentials: 'include' });
            if (!response.ok && response.status !== 404) {
                console.warn('[Video] Failed to delete from cloud:', response.status);
            }
        } catch (e) {
            console.warn('[Video] Failed to delete from cloud:', e);
        }
        // 同时更新任务状态为 cancelled，防止 restoreActiveTasks 重新恢复
        try {
            await updateTaskStatus(video.id, 'cancelled');
            console.log('[Video] Task marked as cancelled:', video.id);
        } catch (e) {
            console.warn('[Video] Failed to update task status:', e);
        }
    }, [currentVideo]);

    // Handle logout
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // 接续生成：将视频尾帧设置为下一次生成的首帧
    const handleContinueGenerate = useCallback((video: GeneratedVideo) => {
        if (!video.lastFrameUrl) {
            console.warn('[Video] Cannot continue generation: no lastFrameUrl');
            return;
        }

        console.log('[Video] Setting last frame as first frame for continued generation');

        // 设置尾帧为新的首帧
        setUploadedImage(video.lastFrameUrl);
        setUploadedImageName(null);  // 需要重新上传

        // 保存到 localStorage
        try {
            localStorage.setItem('video_first_frame', video.lastFrameUrl);
        } catch (e) {
            console.warn('[Video] Failed to save continued frame to localStorage:', e);
        }

        // 关闭移动端历史记录抽屉
        setShowMobileHistory(false);
    }, []);

    // Handle image upload
    const handleImageUpload = async (dataUrl: string) => {
        console.log('[Video] Image uploaded, size:', Math.round(dataUrl.length / 1024), 'KB');
        setUploadedImage(dataUrl);
        setUploadedImageName(null); // Reset, will upload when generating

        // 持久化首帧图片（用于刷新后恢复）
        try {
            localStorage.setItem('video_first_frame', dataUrl);
            console.log('[Video] First frame saved to localStorage');
        } catch (e) {
            console.warn('[Video] Failed to save first frame to localStorage:', e);
            // 如果配额超限，尝试清理旧数据后重试
            try {
                localStorage.removeItem('video_first_frame');
                localStorage.setItem('video_first_frame', dataUrl);
                console.log('[Video] First frame saved after cleanup');
            } catch (e2) {
                console.error('[Video] Still failed after cleanup:', e2);
            }
        }
    };

    // Handle generate
    const handleGenerate = async () => {
        // 使用 ref 防止重复提交（比 state 更可靠，因为 state 更新是异步的）
        if (isSubmittingRef.current) {
            console.log('[Video] Already submitting (ref check), ignoring');
            return;
        }

        // 防止重复提交（基于 state 的检查作为备份）
        if (status !== GenerationStatus.IDLE && status !== GenerationStatus.COMPLETE && status !== GenerationStatus.ERROR) {
            console.log('[Video] Already generating (state check), ignoring submit');
            return;
        }

        // 立即设置 ref，防止异步问题
        isSubmittingRef.current = true;

        if (!uploadedImage) {
            setErrorMsg('请先上传首帧图片');
            isSubmittingRef.current = false;
            return;
        }

        // 首尾帧模式下验证尾帧
        if (flf2vEnabled && !uploadedLastFrame) {
            setErrorMsg('首尾帧模式需要上传尾帧图片');
            isSubmittingRef.current = false;
            return;
        }

        if (!settings.positivePrompt.trim()) {
            setErrorMsg('请输入动作描述');
            isSubmittingRef.current = false;
            return;
        }

        if (serverStatus !== 'connected') {
            setErrorMsg('服务器未连接');
            isSubmittingRef.current = false;
            return;
        }

        setStatus(GenerationStatus.PREPARING);
        setProgress(0);
        setErrorMsg(null);

        try {
            const generateStartTime = Date.now();
            taskStartTimeRef.current = generateStartTime;
            queueWaitTimeRef.current = 0;
            console.log('[Video] >>> Starting generation sequence...');

            // 1. Upload first frame image if not already uploaded
            let imageName = uploadedImageName;
            if (!imageName) {
                console.log('[Video] Image not yet uploaded to server, starting upload...');
                setStatus(GenerationStatus.PREPARING);
                imageName = await uploadImageForVideo(uploadedImage);
                setUploadedImageName(imageName);
            } else {
                console.log('[Video] Image already indexed as:', imageName);
            }

            // 2. Upload last frame image if FLF2V mode (首尾帧模式)
            let lastFrameImageName = uploadedLastFrameName;
            if (flf2vEnabled && uploadedLastFrame && !lastFrameImageName) {
                console.log('[Video] FLF2V mode: Uploading last frame image...');
                lastFrameImageName = await uploadImageForVideo(uploadedLastFrame);
                setUploadedLastFrameName(lastFrameImageName);
            }

            // 3. Queue video generation
            console.log('[Video] Transitioning to QUEUED status...');
            setStatus(GenerationStatus.QUEUED);
            const promptId = await queueVideoGeneration({
                ...settings,
                firstFrameImage: imageName,
                flf2vEnabled: flf2vEnabled,
                lastFrameImage: lastFrameImageName || undefined
            });
            currentPromptIdRef.current = promptId;
            // 持久化到 sessionStorage，确保关闭浏览器后仍能恢复
            try {
                sessionStorage.setItem('video_current_task', promptId);
            } catch (e) {
                console.warn('[Video] Failed to save task to sessionStorage:', e);
            }
            console.log(`[Video] Prompt successfully queued. Sequence took ${Date.now() - generateStartTime}ms so far.`);

            // 4. 创建任务记录到后端（不保存完整图片以避免配额超限）
            try {
                await createTask(promptId, 'video', {
                    positivePrompt: settings.positivePrompt,
                    negativePrompt: settings.negativePrompt,
                    duration: settings.duration,
                    frameRate: settings.frameRate,
                    firstFrameImage: imageName,
                    flf2vEnabled: flf2vEnabled,
                    lastFrameImage: lastFrameImageName
                });
            } catch (taskErr) {
                console.warn('[Video] Failed to create task record:', taskErr);
                // 不影响生成流程
            }

            // 4. Start polling
            setStatus(GenerationStatus.GENERATING);
            startPolling(promptId);

        } catch (err: any) {
            console.error('Generation failed:', err);
            setStatus(GenerationStatus.ERROR);
            setErrorMsg(err.message || '生成失败');
            isSubmittingRef.current = false; // 重置提交状态
        }
    };

    // Polling function
    const startPolling = useCallback((promptId: string) => {
        pollingAttemptsRef.current = 0; // 重置轮询计数器
        const maxAttempts = 600; // 10 minutes max (600 * 1s)

        const poll = async () => {
            pollingAttemptsRef.current++;
            console.log(`[Video] Polling attempt ${pollingAttemptsRef.current}/${maxAttempts} for prompt ${promptId}`);

            if (pollingAttemptsRef.current > maxAttempts) {
                setStatus(GenerationStatus.ERROR);
                setErrorMsg('生成超时，请重试');
                isSubmittingRef.current = false; // 超时重置
                pollingAttemptsRef.current = 0;
                return;
            }

            try {
                const result = await checkVideoGenerationStatus(promptId);
                
                if (result.isRunning && queueWaitTimeRef.current === 0 && taskStartTimeRef.current > 0) {
                    queueWaitTimeRef.current = Date.now() - taskStartTimeRef.current;
                }

                if (result.status === 'completed' && result.videoUrl) {
                    // 获取任务参数（用于刷新后恢复）
                    let taskParams: any = null;
                    try {
                        const taskRes = await fetch(`/api/tasks/${promptId}`, { credentials: 'include' });
                        if (taskRes.ok) {
                            const taskData = await taskRes.json();
                            taskParams = taskData.task?.params;
                        }
                    } catch (e) {
                        console.warn('[Video] Failed to fetch task params:', e);
                    }

                    // 优先使用当前 state，如果为空则从任务参数恢复
                    const videoPrompt = settings.positivePrompt || taskParams?.positivePrompt || '';
                    const videoNegativePrompt = settings.negativePrompt || taskParams?.negativePrompt;
                    const videoDuration = settings.duration || taskParams?.duration || 5;
                    const videoFrameRate = settings.frameRate || taskParams?.frameRate || 16;

                    // 首帧图片：优先用当前上传的，否则尝试构造 ComfyUI URL
                    let firstFrameUrl = uploadedImage || undefined;
                    if (!firstFrameUrl && taskParams?.firstFrameImage) {
                        // 构造 ComfyUI 图片 URL
                        firstFrameUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(taskParams.firstFrameImage)}&type=input`;
                    }

                    // Success! 保存首帧图片用于历史记录缩略图
                    const newVideo: GeneratedVideo = {
                        id: promptId,
                        url: result.videoUrl,
                        prompt: videoPrompt,
                        negativePrompt: videoNegativePrompt,
                        timestamp: Date.now(),
                        duration: videoDuration,
                        frameRate: videoFrameRate,
                        firstFrameUrl,
                        lastFrameUrl: result.lastFrameUrl  // 保存尾帧用于接续生成
                    };

                    // 添加到历史（先去重，避免 Page Visibility 恢复和轮询同时添加）
                    setHistory(prev => {
                        if (prev.some(v => v.id === newVideo.id)) {
                            console.log('[Video] Video already in history, skipping duplicate');
                            return prev;
                        }
                        return [newVideo, ...prev];
                    });
                    setCurrentVideo(newVideo);
                    setStatus(GenerationStatus.COMPLETE);
                    sessionStorage.removeItem('video_current_task');  // 清除已完成任务
                    pollingAttemptsRef.current = 0;

                    // 保存到云端历史
                    saveToCloud(newVideo);

                    // 更新任务状态
                    try {
                        await updateTaskStatus(
                            promptId, 
                            'completed', 
                            result.videoUrl, 
                            undefined, 
                            queueWaitTimeRef.current > 0 ? queueWaitTimeRef.current : undefined
                        );
                    } catch (e) {
                        console.warn('[Video] Failed to update task status:', e);
                    }

                    setTimeout(() => {
                        setStatus(GenerationStatus.IDLE);
                        isSubmittingRef.current = false; // 完成后重置
                    }, 2000);
                    return;
                }

                if (result.status === 'error') {
                    setStatus(GenerationStatus.ERROR);
                    setErrorMsg('视频生成失败');
                    isSubmittingRef.current = false; // 失败重置
                    pollingAttemptsRef.current = 0;

                    // 更新任务状态
                    try {
                        await updateTaskStatus(promptId, 'failed', undefined, '视频生成失败');
                    } catch (e) {
                        console.warn('[Video] Failed to update task status:', e);
                    }
                    return;
                }

                // Continue polling
                pollingIntervalRef.current = setTimeout(poll, 1000);
            } catch (e) {
                console.error('Polling error:', e);
                pollingIntervalRef.current = setTimeout(poll, 2000);
            }
        };

        poll();
    }, [settings, uploadedImage]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearTimeout(pollingIntervalRef.current);
            }
        };
    }, []);

    // Page Visibility API: 处理页面从后台恢复的情况
    // 移动端浏览器在后台时会暂停JavaScript，导致轮询中断
    // 当页面恢复时需要重新检查任务状态
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.hidden) {
                // 页面进入后台，记录时间
                backgroundStartTimeRef.current = Date.now();
                console.log('[Video] Page went to background');
            } else {
                // 页面恢复到前台
                const backgroundDuration = backgroundStartTimeRef.current
                    ? Date.now() - backgroundStartTimeRef.current
                    : 0;
                console.log(`[Video] Page resumed from background after ${Math.round(backgroundDuration / 1000)}s`);
                backgroundStartTimeRef.current = null;

                // 如果有进行中的任务，重新检查状态
                const promptId = currentPromptIdRef.current;
                const isTaskInProgress = status === GenerationStatus.GENERATING ||
                    status === GenerationStatus.QUEUED;

                if (promptId && isTaskInProgress) {
                    console.log('[Video] Checking task status after resume:', promptId);

                    try {
                        // 直接检查 ComfyUI 的实际状态
                        const result = await checkVideoGenerationStatus(promptId);
                        console.log('[Video] Task status after resume:', result.status);

                        if (result.status === 'completed' && result.videoUrl) {
                            // 任务已完成！停止轮询并处理结果
                            if (pollingIntervalRef.current) {
                                clearTimeout(pollingIntervalRef.current);
                                pollingIntervalRef.current = null;
                            }

                            // 获取任务参数
                            let taskParams: any = null;
                            try {
                                const taskRes = await fetch(`/api/tasks/${promptId}`, { credentials: 'include' });
                                if (taskRes.ok) {
                                    const taskData = await taskRes.json();
                                    taskParams = taskData.task?.params;
                                }
                            } catch (e) {
                                console.warn('[Video] Failed to fetch task params:', e);
                            }

                            const videoPrompt = settings.positivePrompt || taskParams?.positivePrompt || '';
                            const videoNegativePrompt = settings.negativePrompt || taskParams?.negativePrompt;
                            const videoDuration = settings.duration || taskParams?.duration || 5;
                            const videoFrameRate = settings.frameRate || taskParams?.frameRate || 16;

                            let firstFrameUrl = uploadedImage || undefined;
                            if (!firstFrameUrl && taskParams?.firstFrameImage) {
                                firstFrameUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(taskParams.firstFrameImage)}&type=input`;
                            }

                            const newVideo: GeneratedVideo = {
                                id: promptId,
                                url: result.videoUrl,
                                prompt: videoPrompt,
                                negativePrompt: videoNegativePrompt,
                                timestamp: Date.now(),
                                duration: videoDuration,
                                frameRate: videoFrameRate,
                                firstFrameUrl,
                                lastFrameUrl: result.lastFrameUrl  // 保存尾帧用于接续生成
                            };

                            // 添加到历史（先去重，避免 Page Visibility 恢复和轮询同时添加）
                            setHistory(prev => {
                                if (prev.some(v => v.id === newVideo.id)) {
                                    console.log('[Video] Video already in history, skipping duplicate');
                                    return prev;
                                }
                                return [newVideo, ...prev];
                            });
                            setCurrentVideo(newVideo);
                            setStatus(GenerationStatus.COMPLETE);
                            sessionStorage.removeItem('video_current_task');  // 清除已完成任务
                            pollingAttemptsRef.current = 0;

                            // 保存到云端历史
                            saveToCloud(newVideo);

                            // 更新任务状态
                            try {
                                await updateTaskStatus(promptId, 'completed', result.videoUrl);
                            } catch (e) {
                                console.warn('[Video] Failed to update task status:', e);
                            }

                            setTimeout(() => {
                                setStatus(GenerationStatus.IDLE);
                                isSubmittingRef.current = false;
                            }, 2000);

                            console.log('[Video] Task completed during background, video restored!');
                        } else if (result.status === 'error') {
                            // 任务失败
                            if (pollingIntervalRef.current) {
                                clearTimeout(pollingIntervalRef.current);
                                pollingIntervalRef.current = null;
                            }
                            setStatus(GenerationStatus.ERROR);
                            setErrorMsg('视频生成失败');
                            isSubmittingRef.current = false;
                            pollingAttemptsRef.current = 0;

                            try {
                                await updateTaskStatus(promptId, 'failed', undefined, '视频生成失败');
                            } catch (e) {
                                console.warn('[Video] Failed to update task status:', e);
                            }
                        } else if (result.status === 'pending') {
                            // 任务仍在进行中，重置轮询计数器以避免误判超时
                            // 后台时间不应计入超时时间
                            const backgroundSeconds = Math.floor(backgroundDuration / 1000);
                            if (backgroundSeconds > 5) {
                                // 只有后台超过5秒才重置，避免频繁切换的计数问题
                                console.log(`[Video] Resetting polling counter (was ${pollingAttemptsRef.current}, background was ${backgroundSeconds}s)`);
                                // 减去后台时间对应的轮询次数，但至少保留当前的
                                pollingAttemptsRef.current = Math.max(0, pollingAttemptsRef.current - backgroundSeconds);
                            }
                        }
                    } catch (e) {
                        console.error('[Video] Error checking task status after resume:', e);
                        // 出错时不做处理，让现有的轮询继续
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [status, settings, uploadedImage, saveToCloud]);

    // Video playback control
    const togglePlayback = () => {
        if (videoRef.current) {
            if (isVideoPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsVideoPlaying(!isVideoPlaying);
        }
    };

    const isGenerating = status === GenerationStatus.GENERATING ||
        status === GenerationStatus.QUEUED ||
        status === GenerationStatus.PREPARING;

    return (
        <div className="min-h-screen bg-darker text-gray-100 font-sans selection:bg-primary/30">
            {/* Header */}
            <AppNavigation
                title="图生视频"
                mode="video"
                user={user}
                onLogout={handleLogout}
                serverStatus={serverStatus === 'connected' ? 'connected' : 'disconnected'}
                onMobileSettingsClick={() => setShowMobileSettings(true)}
                onMobileHistoryClick={() => setShowMobileHistory(true)}
            />

            {/* Mobile Drawers */}
            <MobileDrawer
                isOpen={showMobileSettings}
                onClose={() => setShowMobileSettings(false)}
                title="设置"
                position="left"
            >
                <div className="space-y-6 pb-8 p-4">
                    <VideoPromptArea
                        positivePrompt={settings.positivePrompt}
                        negativePrompt={settings.negativePrompt}
                        onPositiveChange={(v) => setSettings(s => ({ ...s, positivePrompt: v }))}
                        onNegativeChange={(v) => setSettings(s => ({ ...s, negativePrompt: v }))}
                        uploadedImage={uploadedImage}
                        onImageUpload={handleImageUpload}
                        onImageRemove={() => { setUploadedImage(null); setUploadedImageName(null); }}
                        isGenerating={isGenerating}
                        flf2vEnabled={flf2vEnabled}
                        onFlf2vToggle={setFlf2vEnabled}
                        uploadedLastFrame={uploadedLastFrame}
                        onLastFrameUpload={(url) => { setUploadedLastFrame(url); setUploadedLastFrameName(null); }}
                        onLastFrameRemove={() => { setUploadedLastFrame(null); setUploadedLastFrameName(null); }}
                    />
                    <VideoSettingsPanel
                        settings={settings}
                        onChange={setSettings}
                        isCollapsed={settingsCollapsed}
                        onToggleCollapse={() => setSettingsCollapsed(!settingsCollapsed)}
                        availableLoras={availableVideoLoras}
                        isLoadingLoras={isLoadingLoras}
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
                            if (window.confirm('确定要清空所有视频历史记录吗？此操作不可撤销。')) {
                                handleClearHistory();
                            }
                        }}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 py-1 px-2 rounded hover:bg-red-500/10 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            >
                <VideoHistoryGallery
                    history={history}
                    selectedId={currentVideo?.id || null}
                    onSelect={(video) => {
                        setCurrentVideo(video);
                        setShowMobileHistory(false);
                    }}
                    onUploadToGallery={handleUploadToGallery}
                    onClearHistory={handleClearHistory}
                    onDelete={handleDeleteHistoryItem}
                    onContinueGenerate={handleContinueGenerate}
                />
            </MobileDrawer>

            {/* Main Content (Desktop Layout) */}
            <main className="hidden lg:flex fixed top-16 left-0 right-0 bottom-0 py-4 pl-4 pr-4 gap-4">
                {/* Left Column: Controls */}
                <div className="w-[420px] flex flex-col bg-surface/30 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <VideoPromptArea
                            positivePrompt={settings.positivePrompt}
                            negativePrompt={settings.negativePrompt}
                            onPositiveChange={(v) => setSettings(s => ({ ...s, positivePrompt: v }))}
                            onNegativeChange={(v) => setSettings(s => ({ ...s, negativePrompt: v }))}
                            uploadedImage={uploadedImage}
                            onImageUpload={handleImageUpload}
                            onImageRemove={() => { setUploadedImage(null); setUploadedImageName(null); }}
                            isGenerating={isGenerating}
                            flf2vEnabled={flf2vEnabled}
                            onFlf2vToggle={setFlf2vEnabled}
                            uploadedLastFrame={uploadedLastFrame}
                            onLastFrameUpload={(url) => { setUploadedLastFrame(url); setUploadedLastFrameName(null); }}
                            onLastFrameRemove={() => { setUploadedLastFrame(null); setUploadedLastFrameName(null); }}
                        />

                        <div className="mt-6 pt-4 border-t border-white/5">
                            <VideoSettingsPanel
                                settings={settings}
                                onChange={setSettings}
                                isCollapsed={settingsCollapsed}
                                onToggleCollapse={() => setSettingsCollapsed(!settingsCollapsed)}
                                availableLoras={availableVideoLoras}
                                isLoadingLoras={isLoadingLoras}
                            />
                        </div>

                        {/* Generate Button */}
                        <div className="mt-6">
                            {errorMsg && (
                                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    {errorMsg}
                                </div>
                            )}
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !uploadedImage || serverStatus !== 'connected'}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                                    ${isGenerating
                                        ? 'bg-neutral-800 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-primary to-secondary hover:shadow-primary/30 hover:shadow-xl'
                                    }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        {status === GenerationStatus.PREPARING ? '准备中...' :
                                            status === GenerationStatus.QUEUED ? '排队中...' : '生成中...'}
                                    </>
                                ) : (
                                    <>
                                        <Zap size={18} className="fill-white" />
                                        生成视频
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Center Column: Video Display */}
                <div className="flex-1 bg-black/40 rounded-3xl border border-white/5 overflow-hidden relative flex items-center justify-center group flex-col">
                    <div className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    ></div>

                    {currentVideo ? (
                        <div className="relative w-full h-full p-4 flex items-center justify-center">
                            <video
                                ref={videoRef}
                                src={currentVideo.url}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                controls
                                loop
                                onPlay={() => setIsVideoPlaying(true)}
                                onPause={() => setIsVideoPlaying(false)}
                            />
                            {/* Download Button */}
                            <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a
                                    href={currentVideo.url}
                                    download={`video_${currentVideo.id}.mp4`}
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
                            {isGenerating ? (
                                <div className="space-y-4">
                                    <div className="relative w-24 h-24 mx-auto">
                                        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                        <Video className="absolute inset-0 m-auto text-primary animate-pulse" size={32} />
                                    </div>
                                    <p className="text-gray-400 animate-pulse">
                                        {status === GenerationStatus.PREPARING ? '准备中...' :
                                            status === GenerationStatus.QUEUED ? '排队中...' : '视频生成中...'}
                                    </p>
                                    <p className="text-xs text-gray-500">视频生成通常需要 2-5 分钟</p>
                                </div>
                            ) : (
                                <div className="space-y-2 opacity-50">
                                    <div className="w-20 h-20 bg-white/5 rounded-2xl mx-auto flex items-center justify-center mb-4">
                                        <Video size={32} className="text-gray-500" />
                                    </div>
                                    <p className="text-gray-400 font-medium">上传图片开始生成视频</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: History */}
                <div className="w-48 flex flex-col bg-surface/30 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-3 border-b border-white/5 shrink-0 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">历史记录</h3>
                        {history.length > 0 && (
                            <button
                                onClick={() => {
                                    if (window.confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
                                        handleClearHistory();
                                    }
                                }}
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-red-500/10 transition-colors"
                                title="清空历史记录"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <VideoHistoryGallery
                            history={history}
                            selectedId={currentVideo?.id || null}
                            onSelect={setCurrentVideo}
                            onUploadToGallery={handleUploadToGallery}
                            onClearHistory={handleClearHistory}
                            onDelete={handleDeleteHistoryItem}
                            onContinueGenerate={handleContinueGenerate}
                        />
                    </div>
                </div>
            </main>

            {/* Mobile Content */}
            <main className="lg:hidden pt-20 pb-24 px-4 h-full flex flex-col">
                <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden relative flex items-center justify-center mb-4">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    {currentVideo ? (
                        <div className="relative w-full h-full p-4 flex flex-col items-center justify-center">
                            <video
                                src={currentVideo.url}
                                className="max-w-full max-h-[calc(100%-50px)] object-contain shadow-2xl rounded-lg"
                                controls
                                loop
                            />
                            {/* 下载按钮 */}
                            <button
                                onClick={async () => {
                                    try {
                                        const response = await fetch(currentVideo.url);
                                        const blob = await response.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `video_${currentVideo.id}.mp4`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        window.URL.revokeObjectURL(url);
                                    } catch {
                                        window.open(currentVideo.url, '_blank');
                                    }
                                }}
                                className="mt-3 px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-xl flex items-center gap-2 hover:bg-primary/30 transition-colors"
                            >
                                <Download size={16} />
                                下载视频
                            </button>
                        </div>
                    ) : (
                        <div className="text-center p-8">
                            {isGenerating ? (
                                <div className="space-y-4">
                                    <div className="relative w-20 h-20 mx-auto">
                                        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                    </div>
                                    <p className="text-gray-400 text-sm">生成中...</p>
                                </div>
                            ) : (
                                <div className="opacity-50 flex flex-col items-center">
                                    <Video size={28} className="text-gray-500 mb-2" />
                                    <p className="text-sm text-gray-400">准备就绪</p>
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
                    disabled={isGenerating || !uploadedImage || serverStatus !== 'connected'}
                    className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                        ${isGenerating
                            ? 'bg-neutral-800 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary to-secondary'
                        }`}
                >
                    {isGenerating ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            生成中...
                        </>
                    ) : (
                        <>
                            <Zap size={18} className="fill-white" />
                            生成视频
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default VideoApp;
