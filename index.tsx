import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './src/index.css';
// Newbie 模式暂时隐藏 - 模型训练优化后可恢复
// import App from './App';
import StandardApp from './StandardApp';
import NovelAIApp from './NovelAIApp';
import DuoApp from './DuoApp';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import GalleryPage from './pages/GalleryPage';
import FavoritesPage from './pages/FavoritesPage';
import { Loader2 } from 'lucide-react';

// 路由保护组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 登录页保护（已登录则跳转首页）
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* 受保护路由 */}
      <Route path="/" element={<ProtectedRoute><StandardApp /></ProtectedRoute>} />
      <Route path="/standard" element={<ProtectedRoute><StandardApp /></ProtectedRoute>} />
      <Route path="/duo" element={<ProtectedRoute><DuoApp /></ProtectedRoute>} />
      <Route path="/gallery" element={<ProtectedRoute><GalleryPage /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
      <Route path="/novelai" element={<ProtectedRoute><NovelAIApp /></ProtectedRoute>} />

      {/* Newbie 模式暂时隐藏 */}
      {/* <Route path="/newbie" element={<ProtectedRoute><App /></ProtectedRoute>} /> */}
      <Route path="/newbie" element={<Navigate to="/" replace />} />

      {/* 未知路由重定向 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <AppRoutes />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);