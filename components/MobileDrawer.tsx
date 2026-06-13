import React, { useEffect, memo } from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
  headerAction?: React.ReactNode; // 可选的标题栏操作按钮
}

const MobileDrawer: React.FC<Props> = ({ isOpen, onClose, title, children, position = 'left', headerAction }) => {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 使用 CSS 隐藏而非条件渲染，避免每次打开都重新创建DOM
  return (
    <div
      className={`fixed inset-0 z-[100] lg:hidden transition-all duration-300 ${isOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
        }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={onClose}
      ></div>

      {/* Drawer */}
      <div
        className={`absolute top-0 bottom-0 w-[85%] max-w-sm bg-surface border-white/5 shadow-2xl flex flex-col transition-transform duration-300 ${position === 'left'
          ? `left-0 border-r ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `right-0 border-l ${isOpen ? 'translate-x-0' : 'translate-x-full'}`
          }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-darker/50">
          <h3 className="font-bold text-lg text-white">{title}</h3>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default memo(MobileDrawer);
