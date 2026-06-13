import React, { useState, useEffect } from 'react';
import { GeneratedImage } from '../types';
import { Download, Clock, Maximize2, Loader2, Check, Upload, Video, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  history: GeneratedImage[];
  onSelect: (img: GeneratedImage) => void;
  selectedId?: string;
  onUpscale?: (img: GeneratedImage) => void;
  upscalingId?: string | null; // 正在放大的图片 ID
  onUploadToGallery?: (img: GeneratedImage) => Promise<boolean>; // 上传到画廊
  onSendToVideo?: (img: GeneratedImage) => void; // 发送到视频模式
  onClearHistory?: () => void; // 清空历史记录
  onDelete?: (img: GeneratedImage) => void; // 删除单个项目
}

const HistoryGallery: React.FC<Props> = ({ history, onSelect, selectedId, onUpscale, upscalingId, onUploadToGallery, onSendToVideo, onClearHistory, onDelete }) => {
  const { t } = useLanguage();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set());

  // 从 history prop 的 isShared 字段初始化已分享状态
  useEffect(() => {
    const sharedIds = history.filter(img => img.isShared).map(img => img.id);
    if (sharedIds.length > 0) {
      setUploadedIds(prev => {
        const newSet = new Set(prev);
        sharedIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  }, [history]);

  const handleUpload = async (img: GeneratedImage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUploadToGallery || uploadingId || uploadedIds.has(img.id)) return;

    setUploadingId(img.id);
    try {
      const success = await onUploadToGallery(img);
      if (success) {
        setUploadedIds(prev => new Set([...prev, img.id]));
      }
    } finally {
      setUploadingId(null);
    }
  };

  if (history.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
        <Clock size={32} className="mb-2 opacity-50" />
        <p className="text-sm">{t.history.empty}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-2 space-y-2">
      {history.map((img) => (
        <div
          key={img.id}
          className={`group relative aspect-square bg-surface rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedId === img.id ? 'border-primary' : 'border-transparent hover:border-white/20'
            }`}
          onClick={() => onSelect(img)}
        >
          <img
            src={img.url}
            alt="Generated"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* 已放大标记 */}
          {img.isUpscaled && (
            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-green-500/80 rounded text-[10px] text-white font-medium flex items-center gap-0.5">
              <Check size={10} />
              {t.history.upscaled}
            </div>
          )}

          {/* 已上传到画廊标记 */}
          {uploadedIds.has(img.id) && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary/80 rounded text-[10px] text-white font-medium flex items-center gap-0.5">
              <Check size={10} />
              已分享
            </div>
          )}

          {/* 右上角删除按钮 */}
          {onDelete && (
            <button
              className={`absolute top-1 p-1.5 bg-red-500/30 hover:bg-red-500/50 rounded text-red-400 backdrop-blur-md opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ${img.isUpscaled ? 'right-16' : 'right-1'
                }`}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('确定要删除这张图片吗？')) {
                  onDelete(img);
                }
              }}
              title="删除"
            >
              <Trash2 size={12} />
            </button>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
            <div className="flex gap-1">
              {/* 发送到视频模式按钮 */}
              {onSendToVideo && (
                <button
                  className="p-1.5 bg-cyan-500/30 hover:bg-cyan-500/50 rounded text-cyan-400 backdrop-blur-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendToVideo(img);
                  }}
                  title="发送到视频模式"
                >
                  <Video size={12} />
                </button>
              )}

              {/* 上传到画廊按钮 */}
              {onUploadToGallery && !uploadedIds.has(img.id) && (
                <button
                  className={`p-1.5 rounded text-white backdrop-blur-md ${uploadingId === img.id
                    ? 'bg-primary/50 cursor-wait'
                    : 'bg-white/20 hover:bg-primary/50'
                    }`}
                  onClick={(e) => handleUpload(img, e)}
                  disabled={uploadingId === img.id}
                  title={uploadingId === img.id ? '上传中...' : '分享到画廊'}
                >
                  {uploadingId === img.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                </button>
              )}

              {/* 放大按钮 - 只对未放大且没有放大版本的图片显示 */}
              {onUpscale && !img.isUpscaled && !img.hasUpscaledVersion && (
                <button
                  className={`p-1.5 rounded text-white backdrop-blur-md ${upscalingId === img.id
                    ? 'bg-primary/50 cursor-wait'
                    : 'bg-white/20 hover:bg-primary/50'
                    }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (upscalingId !== img.id) {
                      onUpscale(img);
                    }
                  }}
                  disabled={upscalingId === img.id}
                  title={upscalingId === img.id ? t.history.upscaling : t.history.upscale}
                >
                  {upscalingId === img.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Maximize2 size={12} />
                  )}
                </button>
              )}

              {/* 下载按钮 */}
              <button
                className="p-1.5 bg-white/20 hover:bg-white/40 rounded text-white backdrop-blur-md"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const response = await fetch(img.url);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `newbie_${img.id}${img.isUpscaled ? '_upscaled' : ''}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  } catch {
                    window.open(img.url, '_blank');
                  }
                }}
                title={t.history.download}
              >
                <Download size={12} />
              </button>
            </div>
          </div>
        </div>
      ))}
      {/* 底部保留期限提示 */}
      <div className="text-center py-2 border-t border-white/5 mt-2">
        <p className="text-[10px] text-gray-500">{t.history.retentionNotice}</p>
      </div>
    </div>
  );
};

export default HistoryGallery;