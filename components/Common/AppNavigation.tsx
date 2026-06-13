import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Home, Sparkles, Users, Image as GalleryIcon, Palette,
    Settings, History, Wifi, WifiOff, AlertTriangle, User, LogOut, Video, BarChart2
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AppNavigationProps {
    title: string;
    mode: 'standard' | 'novelai' | 'duo' | 'video';
    user?: any;
    onLogout: () => void;

    // Server Status (Standard/Duo only)
    serverStatus?: 'online' | 'offline' | 'checking' | 'cors_error' | 'connected' | 'disconnected';
    onServerStatusClick?: () => void;

    // Actions
    onMobileSettingsClick?: () => void;
    onMobileHistoryClick?: () => void;
    onShowStyleManager?: () => void;
}

const AppNavigation: React.FC<AppNavigationProps> = ({
    title,
    mode,
    user,
    onLogout,
    serverStatus,
    onServerStatusClick,
    onMobileSettingsClick,
    onMobileHistoryClick,
    onShowStyleManager
}) => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    // Render Server Status
    const renderServerStatus = () => {
        if (!serverStatus) return null;

        // Normalize status strings
        const isOnline = serverStatus === 'online' || serverStatus === 'connected';
        const isError = serverStatus === 'offline' || serverStatus === 'disconnected';
        const isCors = serverStatus === 'cors_error';

        let content;
        let className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors hidden sm:flex";

        if (isOnline) {
            className += " bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20";
            content = (
                <>
                    <Wifi size={14} />
                    <span>{serverStatus === 'connected' ? '服务器已连接' : t.nav.serverOnline}</span>
                </>
            );
        } else if (isCors) {
            className += " bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20";
            content = (
                <>
                    <AlertTriangle size={14} />
                    <span>CORS 错误</span>
                </>
            );
        } else {
            className += " bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20";
            content = (
                <>
                    <WifiOff size={14} />
                    <span>{serverStatus === 'disconnected' ? '服务器未连接' : t.nav.serverOffline}</span>
                </>
            );
        }

        return (
            <div onClick={onServerStatusClick} className={className}>
                {content}
            </div>
        );
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-darker/80 backdrop-blur-lg border-b border-white/5 h-16 flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
                {/* Mobile Settings Toggle */}
                {onMobileSettingsClick && (
                    <button
                        onClick={onMobileSettingsClick}
                        className="lg:hidden p-1.5 -ml-1 text-gray-400 hover:text-white"
                    >
                        <Settings size={20} />
                    </button>
                )}

                {/* Title */}
                <div>
                    <h1 className={`font-bold text-lg tracking-tight text-transparent bg-clip-text bg-gradient-to-r 
                        ${mode === 'novelai' ? 'from-green-400 to-blue-500' :
                            mode === 'duo' ? 'from-pink-400 to-purple-500' :
                                mode === 'video' ? 'from-orange-400 to-red-500' :
                                    'from-blue-400 to-purple-500'}`}>
                        {title}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                {/* Style Library (If enabled) */}
                {onShowStyleManager && (
                    <button
                        onClick={onShowStyleManager}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-white/10 rounded-lg transition-colors"
                        title="风格库"
                    >
                        <Palette size={20} />
                    </button>
                )}

                {/* Gallery Link */}
                <Link
                    to="/gallery"
                    state={{ from: mode }}
                    className="p-2 text-pink-400 hover:text-pink-300 hover:bg-white/10 rounded-lg transition-colors"
                    title="画廊"
                >
                    <GalleryIcon size={20} />
                </Link>

                {user?.username === 'frostleaf' && (
                    <Link
                        to="/analytics"
                        className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-white/10 rounded-lg transition-colors"
                        title="数据分析看板"
                    >
                        <BarChart2 size={20} />
                    </Link>
                )}

                {/* Vertical Divider */}
                <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>

                {/* Mode Switchers */}
                {mode !== 'standard' && (
                    <Link to="/" className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1" title="切换到标准模式">
                        <Home size={18} />
                        <span className="text-xs font-bold hidden xl:inline">STD</span>
                    </Link>
                )}

                {mode !== 'novelai' && (
                    <Link to="/novelai" className="p-2 text-green-400 hover:text-green-300 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1" title="切换到 NovelAI 模式">
                        <Sparkles size={18} />
                        <span className="text-xs font-bold hidden xl:inline">NAI</span>
                    </Link>
                )}

                {mode !== 'duo' && (
                    <Link to="/duo" className="p-2 text-purple-400 hover:text-purple-300 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1" title="切换到双人模式">
                        <Users size={18} />
                        <span className="text-xs font-bold hidden xl:inline">DUO</span>
                    </Link>
                )}

                {mode !== 'video' && (
                    <Link to="/video" className="p-2 text-orange-400 hover:text-orange-300 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1" title="切换到图生视频">
                        <Video size={18} />
                        <span className="text-xs font-bold hidden xl:inline">I2V</span>
                    </Link>
                )}

                {/* Mobile History Toggle */}
                {onMobileHistoryClick && (
                    <button
                        onClick={onMobileHistoryClick}
                        className="lg:hidden p-2 text-gray-400 hover:text-white"
                    >
                        <History size={20} />
                    </button>
                )}

                {/* Server Status (Desktop) */}
                {renderServerStatus()}

                {/* User Menu */}
                {user && (
                    <div className="relative group hidden sm:block">
                        <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-white/5 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-primary/20">
                                {user.username.substring(0, 2).toUpperCase()}
                            </div>
                        </button>

                        {/* Dropdown */}
                        <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-white/10 rounded-xl shadow-2xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50">
                            <div className="px-4 py-3 border-b border-white/5">
                                <p className="text-sm font-bold text-white">{user.username}</p>
                                <p className="text-xs text-gray-500">已登录</p>
                            </div>
                            <button
                                onClick={onLogout}
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                            >
                                <LogOut size={14} />
                                退出登录
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default AppNavigation;
