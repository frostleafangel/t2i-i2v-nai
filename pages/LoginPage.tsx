import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, User, Lock, Ticket, ArrowRight, Loader2 } from 'lucide-react';

const LoginPage: React.FC = () => {
    const { login, register } = useAuth();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            let result;
            if (isRegisterMode) {
                result = await register(username, password, inviteCode);
            } else {
                result = await login(username, password);
            }

            if (!result.success) {
                setError(result.error || '操作失败');
            }
        } catch (err) {
            setError('网络错误，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-darker flex items-center justify-center p-4">
            {/* 背景装饰 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-500 mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                        Newbie Anime Generator
                    </h1>
                    <p className="text-gray-400 mt-2">
                        {isRegisterMode ? '创建您的账户' : '欢迎回来'}
                    </p>
                </div>

                {/* 表单卡片 */}
                <div className="bg-surface/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 用户名 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                用户名
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                                    placeholder="请输入用户名"
                                    required
                                    minLength={2}
                                    maxLength={20}
                                />
                            </div>
                        </div>

                        {/* 密码 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                密码
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                                    placeholder="请输入密码"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {/* 邀请码（仅注册时显示） */}
                        {isRegisterMode && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    邀请码
                                </label>
                                <div className="relative">
                                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                                        placeholder="请输入邀请码"
                                        required
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-500">
                                    需要邀请码才能注册，请向管理员索取
                                </p>
                            </div>
                        )}

                        {/* 错误提示 */}
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* 提交按钮 */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-primary to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    处理中...
                                </>
                            ) : (
                                <>
                                    {isRegisterMode ? '注册' : '登录'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* 切换登录/注册 */}
                    <div className="mt-6 pt-6 border-t border-white/10 text-center">
                        <button
                            onClick={() => {
                                setIsRegisterMode(!isRegisterMode);
                                setError('');
                            }}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            {isRegisterMode ? (
                                <>已有账户？<span className="text-primary ml-1">立即登录</span></>
                            ) : (
                                <>没有账户？<span className="text-primary ml-1">立即注册</span></>
                            )}
                        </button>
                    </div>
                </div>

                {/* 底部装饰文字 */}
                <p className="text-center text-gray-500 text-xs mt-6">
                    使用本服务即表示您同意我们的服务条款
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
