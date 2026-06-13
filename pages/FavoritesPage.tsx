import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Heart, Bookmark, Send, X, ChevronLeft, ChevronRight,
    Loader2, ImageIcon, Home, ArrowLeft, User, LogOut
} from 'lucide-react';

interface GalleryImage {
    id: number;
    filename: string;
    imageUrl: string;
    prompt: string;
    author: string;
    likes_count: number;
    is_liked: number;
    is_favorited: number;
    created_at: string;
}

const FavoritesPage: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [images, setImages] = useState<GalleryImage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const fetchFavorites = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/gallery/favorites', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setImages(data.images);
            } else if (response.status === 401) {
                navigate('/login', { replace: true });
            }
        } catch (error) {
            console.error('Failed to fetch favorites:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

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

    const handleUnfavorite = async (image: GalleryImage, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/gallery/${image.id}/favorite`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                // 从收藏列表中移除
                setImages(prev => prev.filter(img => img.id !== image.id));
                if (selectedImage?.id === image.id) {
                    setSelectedImage(null);
                }
            }
        } catch (error) {
            console.error('Unfavorite failed:', error);
        }
    };

    const handleSendToGenerator = (prompt: string) => {
        sessionStorage.setItem('gallery_prompt', prompt);
        navigate('/');
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
                        to="/gallery"
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="返回画廊"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="font-bold text-lg tracking-tight text-white">
                        ⭐ 我的收藏
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="返回生图"
                    >
                        <Home size={20} />
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
                        <Bookmark size={48} className="mb-4 opacity-50" />
                        <p>还没有收藏任何作品</p>
                        <Link to="/gallery" className="text-primary hover:underline mt-2">
                            去画廊看看 →
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {images.map((image) => (
                            <div
                                key={image.id}
                                onClick={() => setSelectedImage(image)}
                                className="group relative aspect-[3/4] bg-surface rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-primary/50 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10"
                            >
                                <img
                                    src={image.imageUrl}
                                    alt={image.prompt}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />

                                {/* 悬浮信息 */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                        <p className="text-white text-xs line-clamp-2 mb-2">{image.prompt}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400 text-xs">@{image.author}</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => handleLike(image, e)}
                                                    className={`p-1.5 rounded-full transition-colors ${image.is_liked ? 'text-red-500 bg-red-500/20' : 'text-gray-400 hover:text-red-400'
                                                        }`}
                                                >
                                                    <Heart size={14} fill={image.is_liked ? 'currentColor' : 'none'} />
                                                </button>
                                                <span className="text-xs text-gray-400">{image.likes_count}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 收藏标记 */}
                                <div className="absolute top-2 right-2">
                                    <Bookmark size={16} className="text-yellow-400" fill="currentColor" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* 图片详情模态框 */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <div
                        className="relative max-w-4xl w-full bg-surface rounded-2xl overflow-hidden shadow-2xl h-[95vh] lg:h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col lg:flex-row h-full">
                            <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                                <img
                                    src={selectedImage.imageUrl}
                                    alt={selectedImage.prompt}
                                    className="max-w-full max-h-[60vh] lg:max-h-full object-contain"
                                />
                            </div>

                            <div className="h-[40%] lg:h-full lg:w-80 flex flex-col bg-surface border-l border-white/10">
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                                            <User size={16} className="text-primary" />
                                        </div>
                                        <span className="text-white font-medium">{selectedImage.author}</span>
                                    </div>

                                    <div className="mb-4">
                                        <h3 className="text-gray-400 text-sm mb-2">提示词</h3>
                                        <p className="text-white text-sm leading-relaxed break-words">{selectedImage.prompt}</p>
                                    </div>
                                </div>

                                <div className="p-6 border-t border-white/10 bg-surface">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => handleLike(selectedImage, e)}
                                            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors ${selectedImage.is_liked
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    : 'bg-white/5 text-gray-400 hover:text-red-400 border border-white/10'
                                                }`}
                                        >
                                            <Heart size={18} fill={selectedImage.is_liked ? 'currentColor' : 'none'} />
                                            <span>{selectedImage.likes_count}</span>
                                        </button>

                                        <button
                                            onClick={(e) => handleUnfavorite(selectedImage, e)}
                                            className="flex-1 py-2.5 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center gap-2 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                                        >
                                            <Bookmark size={18} fill="currentColor" />
                                            <span>取消</span>
                                        </button>

                                        <button
                                            onClick={() => handleSendToGenerator(selectedImage.prompt)}
                                            className="flex-1 py-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center gap-2 hover:bg-primary/30 transition-colors"
                                        >
                                            <Send size={18} />
                                            <span>使用</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FavoritesPage;
