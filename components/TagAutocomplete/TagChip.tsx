import React from 'react';
import { TAG_CATEGORY_COLORS } from '../../services/tagService';

interface TagChipProps {
    name: string;
    zhName?: string;
    category: number;
    count: number;
    isSelected?: boolean;
    onClick: () => void;
}

/**
 * 格式化数字（K/M 显示）
 */
function formatCount(count: number): string {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(0)}K`;
    }
    return String(count);
}

/**
 * 标签建议项组件
 */
const TagChip: React.FC<TagChipProps> = ({
    name,
    zhName,
    category,
    count,
    isSelected,
    onClick,
}) => {
    const categoryColor = TAG_CATEGORY_COLORS[category] || TAG_CATEGORY_COLORS[0];

    return (
        <button
            type="button"
            onClick={onClick}
            className={`
        tag-chip
        inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
        text-sm whitespace-nowrap cursor-pointer
        transition-all duration-150
        border
        ${isSelected
                    ? 'bg-primary/20 border-primary text-white scale-105'
                    : 'bg-surface/80 border-white/10 text-gray-300 hover:bg-surface hover:border-white/20'
                }
      `}
            style={{
                '--category-color': categoryColor,
            } as React.CSSProperties}
        >
            {/* 类型指示点 */}
            <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: categoryColor }}
            />

            {/* 标签名称 */}
            <span className="tag-name font-medium">{name.replace(/_/g, ' ')}</span>

            {/* 中文翻译 */}
            {zhName && (
                <span className="tag-zh text-gray-500 text-xs">
                    {zhName}
                </span>
            )}

            {/* 热度 */}
            <span className="tag-count text-gray-600 text-xs ml-1">
                {formatCount(count)}
            </span>
        </button>
    );
};

export default TagChip;
