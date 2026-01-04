import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Eraser, Trash2, RotateCcw, X, Check } from 'lucide-react';

interface MaskCanvasModalProps {
    width: number;
    height: number;
    onSave: (maskData: string | undefined) => void;
    onClose: () => void;
    initialMaskData?: string;
}

type BrushType = 'characterA' | 'characterB' | 'eraser';

const COLORS = {
    characterA: '#FF0000', // 红色 - 角色A
    characterB: '#0000FF', // 蓝色 - 角色B
    background: '#000000', // 黑色 - 背景
};

const MaskCanvasModal: React.FC<MaskCanvasModalProps> = ({
    width,
    height,
    onSave,
    onClose,
    initialMaskData
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushType, setBrushType] = useState<BrushType>('characterA');
    const [brushSize, setBrushSize] = useState(50);
    const [scale, setScale] = useState(1);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);

    // 计算画布显示比例 - 最大化利用屏幕空间
    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth - 32; // padding
                const containerHeight = containerRef.current.clientHeight - 32;
                const scaleX = containerWidth / width;
                const scaleY = containerHeight / height;
                setScale(Math.min(scaleX, scaleY, 1));
            }
        };
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [width, height]);

    // 初始化画布
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (initialMaskData) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = initialMaskData;
        } else {
            ctx.fillStyle = COLORS.background;
            ctx.fillRect(0, 0, width, height);
        }
    }, [width, height, initialMaskData]);

    // 阻止触摸时的页面滚动
    useEffect(() => {
        const preventScroll = (e: TouchEvent) => {
            if (e.target === canvasRef.current) {
                e.preventDefault();
            }
        };
        document.addEventListener('touchmove', preventScroll, { passive: false });
        return () => document.removeEventListener('touchmove', preventScroll);
    }, []);

    // 获取鼠标/触摸在画布上的真实位置
    const getCanvasPosition = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        let clientX: number, clientY: number;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale
        };
    }, [scale]);

    // 绘制
    const draw = useCallback((x: number, y: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (brushType === 'eraser') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = COLORS.background;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = COLORS[brushType];
        }

        ctx.lineWidth = brushSize;

        if (lastPosRef.current) {
            ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = brushType === 'eraser' ? COLORS.background : COLORS[brushType];
            ctx.fill();
        }

        lastPosRef.current = { x, y };
    }, [brushType, brushSize]);

    // 导出 mask 数据
    const exportMask = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        return canvas.toDataURL('image/png');
    }, []);

    // 事件处理
    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDrawing(true);
        const pos = getCanvasPosition(e);
        lastPosRef.current = null;
        draw(pos.x, pos.y);
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        e.preventDefault();
        e.stopPropagation();
        const pos = getCanvasPosition(e);
        draw(pos.x, pos.y);
    };

    const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDrawing) {
            setIsDrawing(false);
            lastPosRef.current = null;
        }
    };

    // 清除画布
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, width, height);
    };

    // 保存并关闭
    const handleSave = () => {
        onSave(exportMask());
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between p-3 bg-surface border-b border-white/10">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg bg-darker border border-white/10 hover:border-white/20"
                    >
                        <X size={18} />
                    </button>
                    <span className="text-sm font-medium">绘制分区 Mask</span>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors"
                >
                    <Check size={16} />
                    <span>完成</span>
                </button>
            </div>

            {/* 工具栏 */}
            <div className="flex items-center justify-center gap-3 p-3 bg-surface/50 border-b border-white/10 flex-wrap">
                {/* 画笔选择 */}
                <div className="flex gap-1">
                    <button
                        onClick={() => setBrushType('characterA')}
                        className={`p-2.5 rounded-lg transition-all flex items-center gap-1.5 ${brushType === 'characterA'
                            ? 'bg-red-500/30 text-red-300 border-2 border-red-500'
                            : 'bg-darker border border-white/10'
                            }`}
                    >
                        <Pencil size={16} />
                        <span className="text-sm font-medium">角色A</span>
                    </button>
                    <button
                        onClick={() => setBrushType('characterB')}
                        className={`p-2.5 rounded-lg transition-all flex items-center gap-1.5 ${brushType === 'characterB'
                            ? 'bg-blue-500/30 text-blue-300 border-2 border-blue-500'
                            : 'bg-darker border border-white/10'
                            }`}
                    >
                        <Pencil size={16} />
                        <span className="text-sm font-medium">角色B</span>
                    </button>
                    <button
                        onClick={() => setBrushType('eraser')}
                        className={`p-2.5 rounded-lg transition-all ${brushType === 'eraser'
                            ? 'bg-gray-500/30 text-gray-300 border-2 border-gray-500'
                            : 'bg-darker border border-white/10'
                            }`}
                    >
                        <Eraser size={16} />
                    </button>
                </div>

                <div className="w-px h-8 bg-white/10" />

                {/* 画笔大小 */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">画笔</span>
                    <input
                        type="range"
                        min="10"
                        max="150"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-24 accent-purple-500"
                    />
                    <span className="text-xs text-purple-400 w-8">{brushSize}</span>
                </div>

                <div className="w-px h-8 bg-white/10" />

                {/* 清除 */}
                <button
                    onClick={clearCanvas}
                    className="p-2.5 rounded-lg bg-darker border border-white/10 hover:border-red-500/50 hover:text-red-400 transition-all flex items-center gap-1.5"
                >
                    <Trash2 size={16} />
                    <span className="text-sm">清除</span>
                </button>
            </div>

            {/* 画布区域 */}
            <div
                ref={containerRef}
                className="flex-1 flex items-center justify-center p-4 overflow-hidden touch-none"
            >
                <div className="relative">
                    <canvas
                        ref={canvasRef}
                        width={width}
                        height={height}
                        style={{
                            width: `${width * scale}px`,
                            height: `${height * scale}px`,
                            cursor: brushType === 'eraser' ? 'crosshair' : 'pointer',
                            touchAction: 'none'
                        }}
                        className="rounded-lg border-2 border-white/20 shadow-2xl"
                        onMouseDown={handleStart}
                        onMouseMove={handleMove}
                        onMouseUp={handleEnd}
                        onMouseLeave={handleEnd}
                        onTouchStart={handleStart}
                        onTouchMove={handleMove}
                        onTouchEnd={handleEnd}
                    />
                    {/* 图例 */}
                    <div className="absolute bottom-3 right-3 flex gap-3 text-xs bg-black/70 px-3 py-2 rounded-lg">
                        <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-red-500" />
                            <span className="text-gray-300">角色A</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-blue-500" />
                            <span className="text-gray-300">角色B</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-gray-800 border border-white/30" />
                            <span className="text-gray-300">背景</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 底部提示 */}
            <div className="p-3 bg-surface/50 border-t border-white/10 text-center">
                <p className="text-xs text-gray-500">
                    使用红色绘制角色A区域，蓝色绘制角色B区域，黑色区域为共享背景
                </p>
            </div>
        </div>,
        document.body
    );
};

export default MaskCanvasModal;
