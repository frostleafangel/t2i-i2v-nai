import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Heart, Bookmark, Send, X, ChevronLeft, ChevronRight,
    Loader2, ImageIcon, Home, BookmarkCheck, User, LogOut, Sparkles,
    Trash2, RotateCcw, Archive
} from 'lucide-react';

interface GalleryImage {
    id: number;
    filename: string;
    thumbnailUrl: string;
    imageUrl: string;
    prompt: string;
    author: string;
    likes_count: number;
    is_liked: number;
    is_favorited: number;
    created_at: string;
    metadata?: string;
    source?: 'all' | 'comfyui' | 'novelai';
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const GalleryPage: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const fromSource = location.state?.from as string | undefined;

    // Determine back link destination based on where user came from
    const getBackLink = () => {
        switch (fromSource) {
            case 'novelai':
                return { target: '/novelai', title: '返回 NovelAI' };
            case 'duo':
                return { target: '/duo', title: '返回双人模式' };
            case 'standard':
            default:
                return { target: '/', title: '返回生图' };
        }
    };
    const { target: backLinkTarget, title: backLinkTitle } = getBackLink();

    const [images, setImages] = useState<GalleryImage[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
    const [showFullImage, setShowFullImage] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [source, setSource] = useState<'all' | 'comfyui' | 'novelai'>('all');

    // 管理员功能状态
    const [isAdmin, setIsAdmin] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [trashImages, setTrashImages] = useState<GalleryImage[]>([]);
    const [trashPagination, setTrashPagination] = useState<Pagination | null>(null);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);

    // 检查管理员权限
    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const response = await fetch('/api/gallery/admin/check', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setIsAdmin(data.isAdmin);
                }
            } catch (error) {
                console.error('Admin check failed:', error);
            }
        };
        checkAdmin();
    }, []);

    const fetchGallery = useCallback(async (page = 1) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/gallery?page=${page}&limit=24&source=${source}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setImages(data.images);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Failed to fetch gallery:', error);
        } finally {
            setIsLoading(false);
        }
    }, [source]);

    useEffect(() => {
        fetchGallery();
    }, [fetchGallery]); // source is in fetchGallery dependency

    // Reset when source changes handled by dependency in fetchGallery? 
    // No, standard pattern is usually effect triggering fetch.
    // My fetchGallery depends on source. 
    // So when source changes, fetchGallery changes.
    // The effect calls new fetchGallery. Correct.

    const handleLike = async (image: GalleryImage, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/gallery/${image.id}/like`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setImages(prev => prev.map(img =>
                    img.id === image.id
                        ? { ...img, is_liked: data.liked ? 1 : 0, likes_count: data.likesCount }
                        : img
                ));
                if (selectedImage?.id === image.id) {
                    setSelectedImage(prev => prev ? { ...prev, is_liked: data.liked ? 1 : 0, likes_count: data.likesCount } : null);
                }
            }
        } catch (error) {
            console.error('Like failed:', error);
        }
    };

    const handleFavorite = async (image: GalleryImage, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/gallery/${image.id}/favorite`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setImages(prev => prev.map(img =>
                    img.id === image.id
                        ? { ...img, is_favorited: data.favorited ? 1 : 0 }
                        : img
                ));
                if (selectedImage?.id === image.id) {
                    setSelectedImage(prev => prev ? { ...prev, is_favorited: data.favorited ? 1 : 0 } : null);
                }
            }
        } catch (error) {
            console.error('Favorite failed:', error);
        }
    };

    // 管理员: 软删除图片
    const handleDelete = async (image: GalleryImage, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(`确定要删除这张图片吗？（将移至回收站）`)) return;

        setIsDeleting(image.id);
        try {
            const response = await fetch(`/api/gallery/${image.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                setImages(prev => prev.filter(img => img.id !== image.id));
                if (selectedImage?.id === image.id) {
                    setSelectedImage(null);
                }
            } else {
                const data = await response.json();
                alert(data.error || '删除失败');
            }
        } catch (error) {
            console.error('Delete failed:', error);
        } finally {
            setIsDeleting(null);
        }
    };

    // 管理员: 获取回收站列表
    const fetchTrash = useCallback(async (page = 1) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/gallery/trash/list?page=${page}&limit=24`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setTrashImages(data.images);
                setTrashPagination(data.pagination);
            }
        } catch (error) {
            console.error('Failed to fetch trash:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 管理员: 恢复图片
    const handleRestore = async (image: GalleryImage) => {
        try {
            const response = await fetch(`/api/gallery/${image.id}/restore`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                setTrashImages(prev => prev.filter(img => img.id !== image.id));
                fetchGallery(); // 刷新主画廊
            }
        } catch (error) {
            console.error('Restore failed:', error);
        }
    };

    // 管理员: 彻底删除图片
    const handlePermanentDelete = async (image: GalleryImage) => {
        if (!window.confirm(`确定要彻底删除这张图片吗？此操作不可恢复！`)) return;

        try {
            const response = await fetch(`/api/gallery/${image.id}/permanent`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                setTrashImages(prev => prev.filter(img => img.id !== image.id));
            } else {
                const data = await response.json();
                alert(data.error || '删除失败');
            }
        } catch (error) {
            console.error('Permanent delete failed:', error);
        }
    };

    // 切换回收站视图
    useEffect(() => {
        if (showTrash && isAdmin) {
            fetchTrash();
        }
    }, [showTrash, isAdmin, fetchTrash]);

    const handleApplyToGenerator = (target: 'standard' | 'novelai' | 'duo', image: GalleryImage) => {
        let finalPrompt = image.prompt;
        let finalMetadata = image.metadata;

        // 如果是从 NovelAI 发送到 Standard，需要合并提示词
        if (target === 'standard' && image.source === 'novelai' && image.metadata) {
            try {
                const meta = JSON.parse(image.metadata);
                if (meta.v4_prompt || (meta.characterPrompts && meta.characterPrompts.length > 0)) {
                    let mergedPrompt = meta.v4_prompt || image.prompt || '';
                    if (meta.characterPrompts) {
                        meta.characterPrompts.forEach((cp: any) => {
                            if (cp.prompt) {
                                mergedPrompt += ', ' + cp.prompt;
                            }
                        });
                    }
                    finalPrompt = mergedPrompt;
                }
            } catch (e) {
                console.error('Failed to parse metadata for merging:', e);
            }
        }

        // Duo 模式特殊处理
        if (target === 'duo') {
            try {
                const meta = JSON.parse(image.metadata || '{}');
                if (meta.duo) {
                    sessionStorage.setItem('duo_init_settings', JSON.stringify(meta.duo));
                    // 同时也保存 customMaskData 如果存在
                    if (meta.duo.customMaskData) {
                        // handled inside duo object usually, but check just in case
                    }
                }
            } catch (e) {
                console.error('Failed to parse duo metadata:', e);
            }
            navigate('/duo');
            return;
        }

        // 存储到 sessionStorage
        sessionStorage.setItem('gallery_prompt', finalPrompt);
        if (finalMetadata) {
            sessionStorage.setItem('gallery_metadata', finalMetadata);
        }

        if (target === 'novelai') {
            navigate('/novelai');
        } else {
            navigate('/');
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-darker text-gray-100">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-darker/80 backdrop-blur-lg border-b border-white/5 h-16 flex items-center justify-between px-4 lg:px-6">
                <div className="flex items-center gap-4">
                    <Link
                        to={backLinkTarget}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title={backLinkTitle}
                    >
                        {fromSource === 'novelai' ? <ChevronLeft size={24} /> : <Home size={20} />}
                    </Link>
                    <h1 className="font-bold text-lg tracking-tight text-white">
                        🎨 作品画廊
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    {/* 管理员: 回收站入口 */}
                    {isAdmin && (
                        <button
                            onClick={() => setShowTrash(!showTrash)}
                            className={`p-2 rounded-lg transition-colors ${showTrash
                                ? 'text-orange-400 bg-orange-500/20'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                            title={showTrash ? '返回画廊' : '回收站'}
                        >
                            {showTrash ? <Archive size={20} /> : <Trash2 size={20} />}
                        </button>
                    )}

                    <Link
                        to="/favorites"
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="我的收藏"
                    >
                        <BookmarkCheck size={20} />
                    </Link>

                    {/* 用户菜单 */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <User size={18} />
                            <span className="hidden sm:inline text-sm">{user?.username}</span>
                        </button>

                        {showUserMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-white/10 rounded-xl shadow-xl z-50 py-2">
                                    <div className="px-4 py-2 border-b border-white/10">
                                        <p className="text-sm text-white font-medium">{user?.username}</p>
                                        <p className="text-xs text-gray-500">已登录</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full px-4 py-2 text-left text-red-400 hover:bg-white/5 flex items-center gap-2"
                                    >
                                        <LogOut size={16} />
                                        退出登录
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 pb-8 px-4 lg:px-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : images.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <ImageIcon size={48} className="mb-4 opacity-50" />
                        <p>画廊还没有作品</p>
                        <p className="text-sm mt-1">快去生成并分享你的作品吧！</p>
                    </div>
                ) : showTrash ? (
                    /* 回收站视图 */
                    <>
                        <div className="mb-4 flex items-center gap-2 text-orange-400">
                            <Trash2 size={20} />
                            <span className="font-medium">回收站</span>
                            <span className="text-sm text-gray-500">({trashImages.length} 张图片)</span>
                        </div>
                        {trashImages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <Trash2 size={48} className="mb-4 opacity-50" />
                                <p>回收站是空的</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {trashImages.map((image: any) => (
                                    <div
                                        key={image.id}
                                        className="group relative aspect-[3/4] bg-surface rounded-xl overflow-hidden border border-red-500/30"
                                    >
                                        <img
                                            src={image.thumbnailUrl}
                                            alt={image.prompt}
                                            className="w-full h-full object-cover opacity-70"
                                            loading="lazy"
                                        />
                                        {/* 删除信息和操作按钮 - 移动端始终显示 */}
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <p className="text-xs text-gray-400 mb-2">删除者: {image.deleted_by_username}</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleRestore(image)}
                                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-xs rounded-lg flex items-center gap-1"
                                                >
                                                    <RotateCcw size={12} />
                                                    恢复
                                                </button>
                                                <button
                                                    onClick={() => handlePermanentDelete(image)}
                                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs rounded-lg flex items-center gap-1"
                                                >
                                                    <Trash2 size={12} />
                                                    彻底删除
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* 回收站分页 */}
                        {trashPagination && trashPagination.totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-8">
                                {Array.from({ length: trashPagination.totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => fetchTrash(page)}
                                        className={`px-3 py-1 rounded ${page === trashPagination.page
                                            ? 'bg-primary text-white'
                                            : 'bg-surface text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* 图片网格 */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {images.map((image) => (
                                <div
                                    key={image.id}
                                    onClick={() => setSelectedImage(image)}
                                    className="group relative aspect-[3/4] bg-surface rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-primary/50 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10"
                                >
                                    <img
                                        src={image.thumbnailUrl}
                                        alt={image.prompt}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />

                                    {/* 管理员删除按钮 - 右上角，移动端始终显示 */}
                                    {isAdmin && (
                                        <button
                                            onClick={(e) => handleDelete(image, e)}
                                            disabled={isDeleting === image.id}
                                            className="absolute top-2 right-2 p-2 sm:p-1.5 bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10 touch-manipulation"
                                            title="删除图片"
                                        >
                                            {isDeleting === image.id ? (
                                                <Loader2 size={16} className="animate-spin sm:w-3.5 sm:h-3.5" />
                                            ) : (
                                                <Trash2 size={16} className="sm:w-3.5 sm:h-3.5" />
                                            )}
                                        </button>
                                    )}

                                    {/* 悬浮信息 */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                            <p className="text-white text-xs line-clamp-2 mb-2">{image.prompt}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400 text-xs">@{image.author}</span>
                                                <div className="flex items-center gap-2">
                                                    {/* 收藏按钮 */}
                                                    <button
                                                        onClick={(e) => handleFavorite(image, e)}
                                                        className={`p-1.5 rounded-full transition-colors ${image.is_favorited ? 'text-yellow-500 bg-yellow-500/20' : 'text-gray-400 hover:text-yellow-400'
                                                            }`}
                                                        title={image.is_favorited ? '取消收藏' : '收藏'}
                                                    >
                                                        <Bookmark size={14} fill={image.is_favorited ? 'currentColor' : 'none'} />
                                                    </button>
                                                    {/* 点赞按钮 */}
                                                    <button
                                                        onClick={(e) => handleLike(image, e)}
                                                        className={`p-1.5 rounded-full transition-colors ${image.is_liked ? 'text-red-500 bg-red-500/20' : 'text-gray-400 hover:text-red-400'
                                                            }`}
                                                        title={image.is_liked ? '取消点赞' : '点赞'}
                                                    >
                                                        <Heart size={14} fill={image.is_liked ? 'currentColor' : 'none'} />
                                                    </button>
                                                    <span className="text-xs text-gray-400">{image.likes_count}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 分页 */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-8">
                                <button
                                    onClick={() => fetchGallery(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-gray-400">
                                    {pagination.page} / {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => fetchGallery(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* 图片详情模态框 */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <div
                        className="relative max-w-4xl w-full bg-surface rounded-2xl overflow-hidden shadow-2xl h-[95vh] lg:h-auto lg:max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 关闭按钮 */}
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-3 right-3 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>

                        {/* 移动端：垂直布局 60/40 分割 */}
                        {/* 桌面端：水平布局 */}
                        <div className="flex flex-col lg:flex-row h-full">
                            {/* 图片区域 - 移动端60%，桌面端自适应 */}
                            <div
                                className="h-[60%] lg:h-auto lg:flex-1 bg-black flex items-center justify-center cursor-pointer relative group"
                                onClick={() => setShowFullImage(true)}
                            >
                                <img
                                    src={selectedImage.imageUrl}
                                    alt={selectedImage.prompt}
                                    className="max-w-full max-h-full object-contain"
                                />
                                {/* 点击放大提示 */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm bg-black/50 px-3 py-1.5 rounded-full">
                                        点击查看大图
                                    </span>
                                </div>
                            </div>

                            {/* 信息区域 - 移动端40%，桌面端固定宽度 */}
                            <div className="h-[40%] lg:h-auto lg:w-80 flex flex-col bg-surface">
                                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                                    {/* 作者信息 */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                                            <User size={16} className="text-primary" />
                                        </div>
                                        <span className="text-white font-medium">{selectedImage.author}</span>
                                    </div>

                                    {/* 提示词 */}
                                    <div>
                                        <h3 className="text-gray-400 text-xs mb-1.5 font-medium uppercase tracking-wider">提示词</h3>

                                        {selectedImage.source === 'novelai' && (() => {
                                            try {
                                                const meta = JSON.parse(selectedImage.metadata || '{}');
                                                if (meta.prefixPrompt || meta.positivePrompt || meta.suffixPrompt) {
                                                    return (
                                                        <div className="space-y-3">
                                                            {meta.prefixPrompt && (
                                                                <div>
                                                                    <div className="text-[10px] text-green-400/70 font-bold mb-1 uppercase">风格 / 前缀</div>
                                                                    <p className="text-white text-sm bg-green-400/5 border border-green-400/10 p-2 rounded-lg leading-relaxed">{meta.prefixPrompt}</p>
                                                                </div>
                                                            )}
                                                            {meta.positivePrompt && (
                                                                <div>
                                                                    <div className="text-[10px] text-blue-400/70 font-bold mb-1 uppercase">内容 / 主提示词</div>
                                                                    <p className="text-white text-sm bg-blue-400/5 border border-blue-400/10 p-2 rounded-lg leading-relaxed">{meta.positivePrompt}</p>
                                                                </div>
                                                            )}
                                                            {meta.suffixPrompt && (
                                                                <div>
                                                                    <div className="text-[10px] text-purple-400/70 font-bold mb-1 uppercase">修饰 / 后缀</div>
                                                                    <p className="text-white text-sm bg-purple-400/5 border border-purple-400/10 p-2 rounded-lg leading-relaxed">{meta.suffixPrompt}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                            } catch (e) { }
                                            return <p className="text-white text-sm leading-relaxed">{selectedImage.prompt}</p>;
                                        })()}

                                        {selectedImage.source !== 'novelai' && (
                                            <p className="text-white text-sm leading-relaxed">{selectedImage.prompt}</p>
                                        )}
                                    </div>
                                </div>

                                {/* 操作按钮 - 固定在底部 */}
                                <div className="flex items-center gap-2 p-4 border-t border-white/10 bg-surface">
                                    <button
                                        onClick={(e) => handleLike(selectedImage, e)}
                                        className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-sm ${selectedImage.is_liked
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            : 'bg-white/5 text-gray-400 hover:text-red-400 border border-white/10'
                                            }`}
                                    >
                                        <Heart size={16} fill={selectedImage.is_liked ? 'currentColor' : 'none'} />
                                        <span>{selectedImage.likes_count}</span>
                                    </button>

                                    <button
                                        onClick={(e) => handleFavorite(selectedImage, e)}
                                        className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-sm ${selectedImage.is_favorited
                                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                            : 'bg-white/5 text-gray-400 hover:text-yellow-400 border border-white/10'
                                            }`}
                                    >
                                        <Bookmark size={16} fill={selectedImage.is_favorited ? 'currentColor' : 'none'} />
                                        <span>收藏</span>
                                    </button>

                                    <button
                                        onClick={() => handleApplyToGenerator('standard', selectedImage)}
                                        className="flex-1 py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 flex flex-col items-center justify-center hover:bg-primary/30 transition-colors text-xs"
                                        title="发送到常规模式（ComfyUI）"
                                    >
                                        <Send size={14} className="mb-0.5" />
                                        <span>Standard</span>
                                    </button>
                                    <button
                                        onClick={() => handleApplyToGenerator('novelai', selectedImage)}
                                        className="flex-1 py-2 rounded-xl bg-[#ff9c9c]/20 text-[#ff9c9c] border border-[#ff9c9c]/30 flex flex-col items-center justify-center hover:bg-[#ff9c9c]/30 transition-colors text-xs"
                                        title="发送到 NovelAI 模式"
                                    >
                                        <Sparkles size={14} className="mb-0.5" />
                                        <span>NovelAI</span>
                                    </button>

                                    {/* Duo 按钮 (当存在 duo 元数据时显示) */}
                                    {(() => {
                                        try {
                                            const meta = JSON.parse(selectedImage.metadata || '{}');
                                            if (meta.duo) {
                                                return (
                                                    <button
                                                        onClick={() => handleApplyToGenerator('duo', selectedImage)}
                                                        className="flex-1 py-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex flex-col items-center justify-center hover:bg-purple-500/30 transition-colors text-xs"
                                                        title="发送到双人模式"
                                                    >
                                                        <User size={14} className="mb-0.5" />
                                                        <span>双人模式</span>
                                                    </button>
                                                );
                                            }
                                        } catch (e) { }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 全屏大图预览 */}
            {showFullImage && selectedImage && (
                <div
                    className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
                    onClick={() => setShowFullImage(false)}
                >
                    <button
                        onClick={() => setShowFullImage(false)}
                        className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={selectedImage.imageUrl}
                        alt={selectedImage.prompt}
                        className="max-w-full max-h-full object-contain"
                    />
                </div>
            )}
        </div>
    );
};

export default GalleryPage;
