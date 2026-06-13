/**
 * 视频历史记录画廊
 */

import React, { useState, useEffect } from 'react';
import { GeneratedVideo } from '../../types';
import { Play, Download, Clock, Upload, Loader2, Check, Trash2, SkipForward } from 'lucide-react';

interface VideoHistoryGalleryProps {
    history: GeneratedVideo[];
    selectedId: string | null;
    onSelect: (video: GeneratedVideo) => void;
    onUploadToGallery?: (video: GeneratedVideo) => Promise<boolean>;
    onClearHistory?: () => void;
    onDelete?: (video: GeneratedVideo) => void;
    onContinueGenerate?: (video: GeneratedVideo) => void;  // 接续生成回调
}

const VideoHistoryGallery: React.FC<VideoHistoryGalleryProps> = ({
    history,
    selectedId,
    onSelect,
    onUploadToGallery,
    onClearHistory,
    onDelete,
    onContinueGenerate
}) => {
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set());

    // 从 history 的 isShared 属性初始化已上传状态
    useEffect(() => {
        const sharedIds = history.filter(v => v.isShared).map(v => v.id);
        if (sharedIds.length > 0) {
            setUploadedIds(prev => {
                const newSet = new Set(prev);
                sharedIds.forEach(id => newSet.add(id));
                return newSet;
            });
        }
    }, [history]);

    const handleUpload = async (video: GeneratedVideo, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onUploadToGallery || uploadingId || uploadedIds.has(video.id)) return;

        // 只有有首帧图片的才能上传
        if (!video.firstFrameUrl) {
            alert('该视频没有保存首帧图片，无法上传到画廊');
            return;
        }

        setUploadingId(video.id);
        try {
            const success = await onUploadToGallery(video);
            if (success) {
                setUploadedIds(prev => new Set([...prev, video.id]));
            }
        } finally {
            setUploadingId(null);
        }
    };

    if (history.length === 0) {
        return (
            <div className="p-4 text-center text-gray-500 text-sm">
                <Clock size={24} className="mx-auto mb-2 opacity-50" />
                <p>暂无视频记录</p>
            </div>
        );
    }

    return (
        <div className="p-2 space-y-2">
            {history.map((video) => {
                // 判断是否可以上传（有首帧图片才显示上传按钮）
                const canUpload = !!video.firstFrameUrl;
                const isUploaded = uploadedIds.has(video.id);
                const canContinue = !!video.lastFrameUrl;  // 有尾帧才能接续生成

                return (
                    <div
                        key={video.id}
                        onClick={() => onSelect(video)}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedId === video.id
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-transparent hover:border-white/20'
                            }`}
                    >
                        {/* 缩略图 */}
                        <div className="aspect-video bg-black/40 relative">
                            {video.thumbnailUrl || video.firstFrameUrl ? (
                                <img
                                    src={video.thumbnailUrl || video.firstFrameUrl}
                                    alt="Video thumbnail"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Play size={20} className="text-gray-500" />
                                </div>
                            )}

                            {/* 播放图标覆盖 */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                    <Play size={16} className="text-white fill-white ml-0.5" />
                                </div>
                            </div>

                            {/* 时长标签 */}
                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white">
                                {video.duration}s
                            </div>

                            {/* 已上传标记 */}
                            {isUploaded && (
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary/80 rounded text-[10px] text-white font-medium flex items-center gap-0.5">
                                    <Check size={10} />
                                    已分享
                                </div>
                            )}

                            {/* 左下角上传按钮（桌面hover显示，手机始终显示） */}
                            {onUploadToGallery && canUpload && !isUploaded && (
                                <div className="absolute bottom-1 left-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                        className={`p-1.5 rounded text-white backdrop-blur-md ${uploadingId === video.id
                                            ? 'bg-primary/50 cursor-wait'
                                            : 'bg-white/20 hover:bg-primary/50'
                                            }`}
                                        onClick={(e) => handleUpload(video, e)}
                                        disabled={uploadingId === video.id}
                                        title={uploadingId === video.id ? '上传中...' : '分享到画廊'}
                                    >
                                        {uploadingId === video.id ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <Upload size={12} />
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* 右下角接续生成按钮（有尾帧时显示，手机始终显示） */}
                            {onContinueGenerate && canContinue && (
                                <div className="absolute bottom-1 left-9 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                        className="p-1.5 rounded text-white backdrop-blur-md bg-green-500/30 hover:bg-green-500/50"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onContinueGenerate(video);
                                        }}
                                        title="接续生成（用尾帧作为首帧）"
                                    >
                                        <SkipForward size={12} />
                                    </button>
                                </div>
                            )}

                            {/* 右上角删除按钮（桌面hover显示，手机始终显示） */}
                            {onDelete && !isUploaded && (
                                <div className="absolute top-1 right-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                        className="p-1.5 rounded text-red-400 backdrop-blur-md bg-red-500/30 hover:bg-red-500/50"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm('确定要删除这个视频吗？')) {
                                                onDelete(video);
                                            }
                                        }}
                                        title="删除"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 信息 */}
                        <div className="p-2 bg-surface/50">
                            <p className="text-xs text-gray-400 truncate" title={video.prompt}>
                                {video.prompt || '无描述'}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                                {new Date(video.timestamp).toLocaleString('zh-CN', {
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default VideoHistoryGallery;
