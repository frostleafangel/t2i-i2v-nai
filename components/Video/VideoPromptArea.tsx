/**
 * 视频提示词和图片上传区域
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react';

interface VideoPromptAreaProps {
    positivePrompt: string;
    negativePrompt: string;
    onPositiveChange: (value: string) => void;
    onNegativeChange: (value: string) => void;
    uploadedImage: string | null;
    onImageUpload: (imageUrl: string) => void;
    onImageRemove: () => void;
    isGenerating?: boolean;
    // 首尾帧模式 (FLF2V)
    flf2vEnabled?: boolean;
    onFlf2vToggle?: (enabled: boolean) => void;
    uploadedLastFrame?: string | null;
    onLastFrameUpload?: (imageUrl: string) => void;
    onLastFrameRemove?: () => void;
}

const VideoPromptArea: React.FC<VideoPromptAreaProps> = ({
    positivePrompt,
    negativePrompt,
    onPositiveChange,
    onNegativeChange,
    uploadedImage,
    onImageUpload,
    onImageRemove,
    isGenerating = false,
    // 首尾帧模式
    flf2vEnabled = false,
    onFlf2vToggle,
    uploadedLastFrame,
    onLastFrameUpload,
    onLastFrameRemove
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggingLast, setIsDraggingLast] = useState(false);
    const [showNegative, setShowNegative] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastFrameInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }, []);

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            console.error('Not an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                onImageUpload(e.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    // 尾帧文件处理
    const handleLastFrameFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            console.error('Not an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result && onLastFrameUpload) {
                onLastFrameUpload(e.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleLastFrameSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleLastFrameFile(files[0]);
        }
    };

    const handleLastFrameDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingLast(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleLastFrameFile(files[0]);
        }
    }, [onLastFrameUpload]);

    return (
        <div className="space-y-4">
            {/* 首尾帧模式开关 */}
            {onFlf2vToggle && (
                <div className="flex items-center justify-between p-3 bg-surface/30 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-300">首尾帧模式</span>
                        <span className="text-xs text-gray-500">(FLF2V)</span>
                    </div>
                    <button
                        onClick={() => onFlf2vToggle(!flf2vEnabled)}
                        className={`text-2xl transition-colors ${flf2vEnabled ? 'text-primary' : 'text-gray-500'}`}
                        disabled={isGenerating}
                    >
                        {flf2vEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                </div>
            )}

            {/* 首帧图片上传区 */}
            <div className="space-y-2">
                <label className="text-sm text-gray-400 flex items-center gap-1.5">
                    <ImageIcon size={14} />
                    首帧图像
                </label>

                {uploadedImage ? (
                    <div className="relative group">
                        <img
                            src={uploadedImage}
                            alt="First frame"
                            className="w-full aspect-video object-contain rounded-xl border border-white/10 bg-black/20"
                        />
                        {!isGenerating && (
                            <button
                                onClick={onImageRemove}
                                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-lg text-white sm:opacity-70 sm:group-hover:opacity-100 transition-opacity"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${isDragging
                            ? 'border-primary bg-primary/10'
                            : 'border-white/20 hover:border-primary/50 bg-surface/30'
                            }`}
                    >
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                            <Upload size={24} className="text-gray-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm text-gray-300">点击或拖放上传图片</p>
                            <p className="text-xs text-gray-500 mt-1">支持 PNG, JPG, WEBP</p>
                        </div>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* 尾帧图片上传区 (仅首尾帧模式) */}
            {flf2vEnabled && onLastFrameUpload && (
                <div className="space-y-2">
                    <label className="text-sm text-gray-400 flex items-center gap-1.5">
                        <ImageIcon size={14} />
                        尾帧图像
                    </label>

                    {uploadedLastFrame ? (
                        <div className="relative group">
                            <img
                                src={uploadedLastFrame}
                                alt="Last frame"
                                className="w-full aspect-video object-contain rounded-xl border border-green-500/30 bg-black/20"
                            />
                            {!isGenerating && onLastFrameRemove && (
                                <button
                                    onClick={onLastFrameRemove}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-lg text-white sm:opacity-70 sm:group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div
                            onClick={() => lastFrameInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingLast(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDraggingLast(false); }}
                            onDrop={handleLastFrameDrop}
                            className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${isDraggingLast
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-white/20 hover:border-green-500/50 bg-surface/30'
                                }`}
                        >
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                <Upload size={24} className="text-green-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-300">点击或拖放上传尾帧图片</p>
                                <p className="text-xs text-gray-500 mt-1">视频将以此图像结束</p>
                            </div>
                        </div>
                    )}

                    <input
                        ref={lastFrameInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLastFrameSelect}
                        className="hidden"
                    />
                </div>
            )}

            {/* 正面提示词 */}
            <div className="space-y-2">
                <label className="text-sm text-gray-400">动作描述</label>
                <textarea
                    value={positivePrompt}
                    onChange={(e) => onPositiveChange(e.target.value)}
                    placeholder="描述你想要的动作，例如：女性转动头部，微笑"
                    className="w-full h-24 bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-none"
                    disabled={isGenerating}
                />
            </div>

            {/* 负面提示词（可折叠） */}
            <div className="space-y-2">
                <button
                    onClick={() => setShowNegative(!showNegative)}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                    {showNegative ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    反向提示词
                </button>

                {showNegative && (
                    <textarea
                        value={negativePrompt}
                        onChange={(e) => onNegativeChange(e.target.value)}
                        placeholder="不想出现的内容..."
                        className="w-full h-20 bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-none animate-in fade-in duration-200"
                        disabled={isGenerating}
                    />
                )}
            </div>
        </div>
    );
};

export default VideoPromptArea;
