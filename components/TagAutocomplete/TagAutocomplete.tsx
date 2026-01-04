import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchTags, TagSearchResult, TAG_CATEGORY_COLORS, preloadTagData } from '../../services/tagService';
import './TagAutocomplete.css';

interface TagAutocompleteProps {
    /** 当前输入值 */
    value: string;
    /** 值变化回调 */
    onChange: (value: string) => void;
    /** 占位符文本 */
    placeholder?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 自定义类名 */
    className?: string;
    /** 输入类型：'input' 或 'textarea' */
    inputType?: 'input' | 'textarea';
    /** textarea 行数（初始/最小行数） */
    rows?: number;
    /** 最大行数（自适应高度时使用） */
    maxRows?: number;
    /** 是否自动调整高度 */
    autoResize?: boolean;
    /** 键盘事件回调（透传） */
    onKeyDown?: (e: React.KeyboardEvent) => void;
    /** ref 透传 */
    inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
}

/**
 * 获取光标位置之前的当前词
 */
function getCurrentWord(text: string, cursorPos: number): { word: string; start: number; end: number } {
    // 标签分隔符
    const separators = /[,，\s]/;

    let start = cursorPos;
    let end = cursorPos;

    // 向左查找词的开始
    while (start > 0 && !separators.test(text[start - 1])) {
        start--;
    }

    // 向右查找词的结束
    while (end < text.length && !separators.test(text[end])) {
        end++;
    }

    const word = text.slice(start, end).trim();

    return { word, start, end };
}

/**
 * 判断是否为移动设备
 */
function isMobileDevice(): boolean {
    return window.innerWidth <= 768;
}

/**
 * 提示词自动补全输入组件
 */
const TagAutocomplete: React.FC<TagAutocompleteProps> = ({
    value,
    onChange,
    placeholder,
    disabled,
    className,
    inputType = 'textarea',
    rows = 1,
    maxRows = 10,
    autoResize = true,
    onKeyDown,
    inputRef: externalRef,
}) => {
    const [suggestions, setSuggestions] = useState<TagSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [currentWord, setCurrentWord] = useState({ word: '', start: 0, end: 0 });
    const [isMobile, setIsMobile] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    // 追踪用户是否用方向键主动选择过建议（只有主动选择后，回车才确认选择）
    const [hasNavigated, setHasNavigated] = useState(false);

    const internalRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const inputRefToUse = externalRef || internalRef;
    const containerRef = useRef<HTMLDivElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout>();

    // 预加载标签数据
    useEffect(() => {
        preloadTagData();
    }, []);

    // 检测设备类型
    useEffect(() => {
        const checkMobile = () => setIsMobile(isMobileDevice());
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // 监听 visualViewport 变化，检测键盘高度
    useEffect(() => {
        if (!isMobile) return;

        const viewport = window.visualViewport;
        if (!viewport) return;

        const handleViewportChange = () => {
            // 计算键盘高度 = 窗口高度 - 可视视口高度 - 可视视口偏移
            const windowHeight = window.innerHeight;
            const viewportHeight = viewport.height;
            const viewportOffsetTop = viewport.offsetTop;

            // 键盘高度约等于 window.innerHeight - (viewport.height + viewport.offsetTop)
            const calculatedKeyboardHeight = windowHeight - viewportHeight - viewportOffsetTop;

            // 只有当键盘高度大于 100px 时才认为键盘已弹出（避免误判）
            if (calculatedKeyboardHeight > 100) {
                setKeyboardHeight(calculatedKeyboardHeight);
            } else {
                setKeyboardHeight(0);
            }
        };

        viewport.addEventListener('resize', handleViewportChange);
        viewport.addEventListener('scroll', handleViewportChange);

        // 初始检查
        handleViewportChange();

        return () => {
            viewport.removeEventListener('resize', handleViewportChange);
            viewport.removeEventListener('scroll', handleViewportChange);
        };
    }, [isMobile]);

    // 自适应高度
    useEffect(() => {
        if (!autoResize || inputType !== 'textarea') return;

        const textarea = inputRefToUse.current as HTMLTextAreaElement;
        if (!textarea) return;

        // 重置高度以获取正确的 scrollHeight
        textarea.style.height = 'auto';
        textarea.style.overflow = 'hidden'; // 先隐藏滚动条

        // 计算行高
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseInt(computedStyle.lineHeight) || 20;
        const paddingTop = parseInt(computedStyle.paddingTop) || 0;
        const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
        const borderTop = parseInt(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseInt(computedStyle.borderBottomWidth) || 0;

        const minHeight = lineHeight * rows + paddingTop + paddingBottom + borderTop + borderBottom;
        const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom;

        // 设置新高度
        const contentHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);
        textarea.style.height = `${newHeight}px`;

        // 只有内容超过最大高度时才显示滚动条
        if (contentHeight > maxHeight) {
            textarea.style.overflow = 'auto';
        } else {
            textarea.style.overflow = 'hidden';
        }
    }, [value, autoResize, inputType, rows, maxRows, inputRefToUse]);

    // 搜索标签
    const doSearch = useCallback(async (query: string) => {
        if (!query || query.length < 1) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setIsLoading(true);

        try {
            const results = await searchTags(query, 15);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
            setSelectedIndex(0);
            setHasNavigated(false); // 重置导航状态，用户需要重新选择
        } catch (error) {
            console.error('[TagAutocomplete] 搜索失败:', error);
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        // 获取光标位置
        const cursorPos = e.target.selectionStart || 0;
        const wordInfo = getCurrentWord(newValue, cursorPos);
        setCurrentWord(wordInfo);

        // 防抖搜索
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            doSearch(wordInfo.word);
        }, 150);
    };

    // 处理光标位置变化
    const handleSelectionChange = () => {
        const input = inputRefToUse.current;
        if (!input) return;

        const cursorPos = input.selectionStart || 0;
        const wordInfo = getCurrentWord(value, cursorPos);

        if (wordInfo.word !== currentWord.word) {
            setCurrentWord(wordInfo);

            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }

            searchTimeoutRef.current = setTimeout(() => {
                doSearch(wordInfo.word);
            }, 150);
        }
    };

    // 选择标签
    const selectTag = useCallback((tag: TagSearchResult) => {
        const input = inputRefToUse.current;
        if (!input) return;

        // 替换当前词
        const before = value.slice(0, currentWord.start);
        const after = value.slice(currentWord.end);

        // 将下划线替换为空格（适配新模型的提示词格式）
        const formattedTagName = tag.name.replace(/_/g, ' ');

        // 构建新值：插入标签名
        let newValue = before + formattedTagName;

        // 处理后面的内容
        let afterContent = after.trimStart();

        // 如果后面有内容且不是以逗号开头，需要添加分隔符
        if (afterContent.length > 0) {
            // 如果后面不是以逗号开头，添加逗号
            if (!afterContent.match(/^[,，]/)) {
                newValue += ', ' + afterContent;
            } else {
                // 后面已经有逗号了，直接连接
                newValue += afterContent;
            }
        } else {
            // 后面没有内容，添加逗号和空格方便继续输入
            newValue += ', ';
        }

        onChange(newValue);

        // 关闭建议列表
        setShowSuggestions(false);
        setSuggestions([]);
        setHasNavigated(false);

        // 聚焦回输入框
        setTimeout(() => {
            input.focus();
            // 设置光标位置到插入的标签后面（在逗号和空格之后）
            const newCursorPos = before.length + formattedTagName.length + 2;
            input.setSelectionRange(newCursorPos, newCursorPos);
        }, 10);
    }, [value, currentWord, onChange, inputRefToUse]);

    // 键盘导航
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSuggestions && suggestions.length > 0) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                    setHasNavigated(true); // 标记用户已主动导航
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                    setHasNavigated(true); // 标记用户已主动导航
                    return;
                case 'Enter':
                    // 只有当用户主动用方向键选择过时，回车才选择标签
                    // 否则回车正常换行（不阻止默认行为）
                    if (hasNavigated && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        selectTag(suggestions[selectedIndex]);
                        return;
                    }
                    // 未主动选择时，关闭建议列表，让回车正常换行
                    setShowSuggestions(false);
                    break;
                case 'Tab':
                    // Tab 键始终可以快速选择第一个建议
                    if (suggestions.length > 0) {
                        e.preventDefault();
                        selectTag(suggestions[selectedIndex]);
                        return;
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    setShowSuggestions(false);
                    setHasNavigated(false);
                    return;
            }
        }

        // 透传给外部处理
        onKeyDown?.(e);
    };

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 滚动选中项到可视区域
    useEffect(() => {
        if (suggestionsRef.current && showSuggestions) {
            const selectedEl = suggestionsRef.current.querySelector('.selected');
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, showSuggestions]);

    // 渲染建议列表（桌面端下拉菜单）
    const renderDropdown = () => {
        if (!showSuggestions || isMobile) return null;

        return (
            <div className="tag-suggestions-dropdown" ref={suggestionsRef}>
                {isLoading ? (
                    <div className="tag-suggestions-loading">
                        <span className="spinner" />
                        <span>搜索中...</span>
                    </div>
                ) : suggestions.length === 0 ? (
                    <div className="tag-suggestions-empty">无匹配标签</div>
                ) : (
                    <>
                        {suggestions.map((tag, index) => (
                            <div
                                key={tag.name}
                                className={`tag-suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => selectTag(tag)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span
                                    className="tag-category-dot"
                                    style={{ backgroundColor: TAG_CATEGORY_COLORS[tag.category] || TAG_CATEGORY_COLORS[0] }}
                                />
                                <div className="tag-info">
                                    <span className="tag-name">{tag.name.replace(/_/g, ' ')}</span>
                                    {tag.zhName && <span className="tag-zh">{tag.zhName}</span>}
                                </div>
                                <span className="tag-count">
                                    {tag.count >= 1000000
                                        ? `${(tag.count / 1000000).toFixed(1)}M`
                                        : tag.count >= 1000
                                            ? `${Math.floor(tag.count / 1000)}K`
                                            : tag.count}
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        );
    };

    // 渲染建议栏（移动端）
    const renderMobileBar = () => {
        if (!showSuggestions || !isMobile || suggestions.length === 0) return null;

        // 动态计算 bottom 值：如果检测到键盘高度，则使用它；否则使用 0
        const bottomValue = keyboardHeight > 0 ? `${keyboardHeight}px` : '0';

        return (
            <div
                className="tag-suggestions-bar"
                style={{ bottom: bottomValue }}
            >
                {suggestions.map((tag, index) => (
                    <button
                        key={tag.name}
                        type="button"
                        className={`tag-chip ${index === selectedIndex ? 'selected' : ''}`}
                        onClick={() => selectTag(tag)}
                    >
                        <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: TAG_CATEGORY_COLORS[tag.category] || TAG_CATEGORY_COLORS[0] }}
                        />
                        <span className="tag-name">{tag.name.replace(/_/g, ' ')}</span>
                        {tag.zhName && <span className="tag-zh">{tag.zhName}</span>}
                    </button>
                ))}
            </div>
        );
    };

    // 公共 props
    const inputProps = {
        value,
        onChange: handleInputChange,
        onKeyDown: handleKeyDown,
        onSelect: handleSelectionChange,
        onClick: handleSelectionChange,
        placeholder,
        disabled,
        className,
    };

    return (
        <div className="tag-autocomplete-container" ref={containerRef}>
            <div className="tag-autocomplete-input-wrapper">
                {inputType === 'textarea' ? (
                    <textarea
                        {...inputProps}
                        ref={inputRefToUse as React.RefObject<HTMLTextAreaElement>}
                        rows={rows}
                    />
                ) : (
                    <input
                        {...inputProps}
                        ref={inputRefToUse as React.RefObject<HTMLInputElement>}
                        type="text"
                    />
                )}
            </div>

            {renderDropdown()}
            {renderMobileBar()}
        </div>
    );
};

export default TagAutocomplete;
export { TagAutocomplete };
