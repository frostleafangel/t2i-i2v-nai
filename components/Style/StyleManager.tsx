import React, { useState, useEffect } from 'react';
import {
    Palette, Plus, Globe, Lock, Unlock,
    Trash2, Heart, Search, X, Check, Share2
} from 'lucide-react';
import { Style, StyleConfig } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface StyleManagerProps {
    currentConfig: StyleConfig;
    currentImage?: string; // 当前选中图片的 URL，作为封面候选
    onApplyStyle: (config: StyleConfig) => void;
    onClose: () => void;
    mode?: 'comfyui' | 'novelai';
}

const StyleManager: React.FC<StyleManagerProps> = ({
    currentConfig,
    currentImage,
    onApplyStyle,
    onClose,
    mode = 'comfyui'
}) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
    const [styles, setStyles] = useState<Style[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Save Modal State
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [newStyleName, setNewStyleName] = useState('');
    const [newStyleDesc, setNewStyleDesc] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    // Fetch styles
    const fetchStyles = async () => {
        setIsLoading(true);
        try {
            const endpoint = activeTab === 'my' ? '/api/styles' : '/api/styles/public';
            const response = await fetch(endpoint);
            if (response.ok) {
                const data = await response.json();
                // Filter styles by mode. Old styles without type are considered 'comfyui'
                const filteredStyles = data.styles.filter((s: Style) => {
                    const styleType = s.config.type || 'comfyui';
                    return styleType === mode;
                });
                setStyles(filteredStyles);
            }
        } catch (error) {
            console.error('Fetch styles failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStyles();
    }, [activeTab]);

    const handleSaveStyle = async () => {
        if (!newStyleName || !currentImage) return;

        // Ensure config has correct type
        const configToSave = {
            ...currentConfig,
            type: mode
        };

        try {
            const response = await fetch('/api/styles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newStyleName,
                    description: newStyleDesc,
                    coverImageUrl: currentImage,
                    config: configToSave,
                    isPublic
                })
            });

            if (response.ok) {
                setShowSaveModal(false);
                setNewStyleName('');
                setNewStyleDesc('');
                if (activeTab === 'my') fetchStyles();
                alert('风格保存成功！');
            }
        } catch (error) {
            console.error('Save style failed:', error);
            alert('保存失败，请重试');
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('确定要删除这个风格吗？')) return;

        try {
            const response = await fetch(`/api/styles/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setStyles(prev => prev.filter(s => s.id !== id));
            }
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const handleTogglePublic = async (style: Style, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/styles/${style.id}/toggle-public`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                setStyles(prev => prev.map(s =>
                    s.id === style.id ? { ...s, is_public: data.is_public } : s
                ));
            }
        } catch (error) {
            console.error('Toggle public failed:', error);
        }
    };

    const handleLike = async (style: Style, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/styles/${style.id}/like`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                setStyles(prev => prev.map(s =>
                    s.id === style.id ? {
                        ...s,
                        is_liked: data.liked,
                        likes_count: data.likesCount
                    } : s
                ));
            }
        } catch (error) {
            console.error('Like failed:', error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
            <div className="bg-surface w-full max-w-5xl h-full sm:h-[85vh] sm:rounded-2xl flex flex-col overflow-hidden border-white/10 shadow-2xl">
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 shrink-0">
                            <Palette className="text-primary hidden xs:block" />
                            <span className="truncate">风格管理</span>
                        </h2>
                        <div className="flex bg-black/40 p-1 rounded-lg shrink-0">
                            <button
                                onClick={() => setActiveTab('my')}
                                className={`px-2 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm transition-all ${activeTab === 'my'
                                    ? 'bg-primary text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                我的风格
                            </button>
                            <button
                                onClick={() => setActiveTab('public')}
                                className={`px-2 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 ${activeTab === 'public'
                                    ? 'bg-primary text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                <Globe size={14} className="hidden xs:block" />
                                风格广场
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
                    {/* Save Current Style CTA */}
                    {activeTab === 'my' && (
                        <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-center sm:text-left flex-1">
                                <h3 className="text-base sm:text-lg font-bold mb-1">保存当前配置为新风格</h3>
                                <p className="text-gray-400 text-xs sm:text-sm">
                                    {mode === 'novelai'
                                        ? '将当前的模型、采样设置和提示词保存为预设，方便以后一键调用。'
                                        : '将当前的模型、LoRA 和提示词保存为预设，方便以后一键调用。'
                                    }
                                </p>
                                {currentImage ? (
                                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 text-[10px] sm:text-xs text-green-400">
                                        <Check size={12} />
                                        已选中当前图片作为封面
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 text-[10px] sm:text-xs text-yellow-500">
                                        * 请先在生图界面选中一张图片作为封面
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => currentImage ? setShowSaveModal(true) : alert('请先在主界面选中一张图片作为封面！')}
                                className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 font-medium shrink-0"
                            >
                                <Plus size={18} />
                                保存当前风格
                            </button>
                        </div>
                    )}

                    {/* Styles Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                            {styles.map(style => (
                                <div
                                    key={style.id}
                                    className="group bg-black/40 rounded-xl overflow-hidden border border-white/5 hover:border-primary/50 transition-all hover:-translate-y-1 hover:shadow-xl"
                                >
                                    {/* Cover Image */}
                                    <div className="aspect-[3/2] relative overflow-hidden bg-black/50">
                                        <img
                                            src={style.cover_image_url}
                                            alt={style.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            loading="lazy"
                                        />
                                        {/* 移动端始终显示，桌面端悬浮显示 */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 sm:p-4">
                                            <button
                                                onClick={() => {
                                                    onApplyStyle(style.config);
                                                    onClose();
                                                }}
                                                className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center justify-center gap-2 font-medium shadow-lg text-sm"
                                            >
                                                <Check size={16} />
                                                应用此风格
                                            </button>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-bold truncate" title={style.name}>{style.name}</h3>
                                            {activeTab === 'my' && (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={(e) => handleTogglePublic(style, e)}
                                                        className={`p-1.5 rounded-md transition-colors ${style.is_public ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:text-gray-300'}`}
                                                        title={style.is_public ? "公开" : "私有"}
                                                    >
                                                        {style.is_public ? <Globe size={14} /> : <Lock size={14} />}
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(style.id, e)}
                                                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 line-clamp-2 h-8 mb-3">
                                            {style.description || '暂无描述'}
                                        </p>

                                        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-white/5">
                                            <span>@{style.author || user?.username}</span>
                                            <button
                                                onClick={(e) => handleLike(style, e)}
                                                className={`flex items-center gap-1 hover:text-red-400 transition-colors ${style.is_liked ? 'text-red-500' : ''}`}
                                            >
                                                <Heart size={12} fill={style.is_liked ? 'currentColor' : 'none'} />
                                                {style.likes_count}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-surface rounded-xl p-5 sm:p-6 w-full max-w-md border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg sm:text-xl font-bold">保存风格预设</h3>
                            <button onClick={() => setShowSaveModal(false)} className="sm:hidden p-2 text-gray-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">风格名称</label>
                                <input
                                    type="text"
                                    value={newStyleName}
                                    onChange={e => setNewStyleName(e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary outline-none"
                                    placeholder="例如：赛博朋克霓虹"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">描述（可选）</label>
                                <textarea
                                    value={newStyleDesc}
                                    onChange={e => setNewStyleDesc(e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary outline-none h-20 resize-none"
                                    placeholder="描述这个风格的特点..."
                                />
                            </div>

                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsPublic(!isPublic)}>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isPublic ? 'bg-primary' : 'bg-gray-700'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isPublic ? 'translate-x-4' : ''}`} />
                                </div>
                                <span className="text-sm">公开到风格广场</span>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowSaveModal(false)}
                                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSaveStyle}
                                    className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                                    disabled={!newStyleName}
                                >
                                    保存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StyleManager;
