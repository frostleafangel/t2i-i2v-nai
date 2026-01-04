#!/usr/bin/env python3
"""
Danbooru 标签数据预处理脚本
从 CSV 数据源生成包含中文翻译和拼音索引的 JSON 数据文件
"""

import json
import csv
import os
from pathlib import Path

# 尝试导入拼音库，如果没有则跳过拼音处理
try:
    from pypinyin import lazy_pinyin, Style
    HAS_PINYIN = True
except ImportError:
    print("警告: pypinyin 未安装，将跳过拼音索引生成")
    print("安装命令: pip install pypinyin")
    HAS_PINYIN = False

def get_pinyin_initials(text: str) -> str:
    """获取中文文本的拼音首字母"""
    if not HAS_PINYIN or not text:
        return ""
    try:
        initials = lazy_pinyin(text, style=Style.FIRST_LETTER)
        return ''.join(initials).lower()
    except:
        return ""

def get_pinyin_full(text: str) -> str:
    """获取中文文本的完整拼音（无声调）"""
    if not HAS_PINYIN or not text:
        return ""
    try:
        pinyin_list = lazy_pinyin(text)
        return ''.join(pinyin_list).lower()
    except:
        return ""

def load_danbooru_csv(filepath: str) -> dict:
    """
    加载 Danbooru CSV 文件
    格式: tag_name,category,post_count,aliases (可选)
    返回: {tag_name: {category, count, aliases}}
    """
    tags = {}
    
    if not os.path.exists(filepath):
        print(f"警告: 文件不存在 {filepath}")
        return tags
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 3:
                continue
            
            name = row[0].strip()
            if not name:
                continue
                
            try:
                category = int(row[1])
            except:
                category = 0
            try:
                count = int(row[2])
            except:
                count = 0
            
            aliases = row[3].strip() if len(row) > 3 else ""
            
            tags[name] = {
                'category': category,
                'count': count,
                'aliases': aliases
            }
    
    print(f"加载了 {len(tags)} 个标签")
    return tags

def load_translation_csv(filepath: str) -> dict:
    """
    加载中文翻译 CSV 文件
    格式: english_tag,chinese_translation,...
    返回: {english_tag: chinese}
    """
    translations = {}
    
    if not os.path.exists(filepath):
        print(f"警告: 翻译文件不存在 {filepath}")
        return translations
    
    with open(filepath, 'r', encoding='utf-8-sig') as f:  # utf-8-sig 处理 BOM
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            
            en = row[0].strip()
            zh = row[1].strip()
            
            if en and zh:
                translations[en] = zh
    
    print(f"加载了 {len(translations)} 个翻译")
    return translations

def merge_and_process(danbooru_tags: dict, translations: dict, min_count: int = 50) -> list:
    """
    合并标签数据和翻译，生成最终的 JSON 数组
    格式: [name, zhName, pinyinFull, pinyinInitials, category, count]
    """
    result = []
    processed = 0
    with_translation = 0
    
    for name, data in danbooru_tags.items():
        # 过滤低热度标签
        if data['count'] < min_count:
            continue
        
        zh_name = translations.get(name, "")
        if zh_name:
            with_translation += 1
            
        pinyin_full = get_pinyin_full(zh_name)
        pinyin_initials = get_pinyin_initials(zh_name)
        
        result.append([
            name,                    # 0: 英文标签名
            zh_name,                # 1: 中文翻译
            pinyin_full,            # 2: 完整拼音
            pinyin_initials,        # 3: 拼音首字母
            data['category'],       # 4: 类型 (0=通用, 1=艺术家, 3=版权, 4=角色, 5=元数据)
            data['count']           # 5: 使用次数
        ])
        processed += 1
    
    # 按热度排序
    result.sort(key=lambda x: x[5], reverse=True)
    
    print(f"处理完成: {processed} 个标签, {with_translation} 个有中文翻译")
    return result

def main():
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_dir = project_root / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 加载原始数据文件
    danbooru_csv = script_dir / "danbooru.csv"
    translation_csv = script_dir / "danbooru_zh.csv"
    
    if danbooru_csv.exists():
        print("找到 Danbooru 数据文件，开始处理...")
        danbooru_tags = load_danbooru_csv(str(danbooru_csv))
        
        translations = {}
        if translation_csv.exists():
            translations = load_translation_csv(str(translation_csv))
        else:
            print("未找到翻译文件，将只使用英文标签")
        
        # 使用 min_count=50 过滤，保留更多标签
        result = merge_and_process(danbooru_tags, translations, min_count=50)
    else:
        print("错误: 未找到 danbooru.csv 文件")
        print("请先下载数据文件到 scripts/ 目录")
        return
    
    # 输出 JSON
    output_file = output_dir / "danbooru_tags.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"\n数据已保存到: {output_file}")
    
    # 输出统计
    file_size = output_file.stat().st_size
    print(f"文件大小: {file_size / 1024 / 1024:.2f} MB")
    
    # 按类型统计
    categories = {}
    for tag in result:
        cat = tag[4]
        categories[cat] = categories.get(cat, 0) + 1
    
    cat_names = {0: '通用', 1: '艺术家', 3: '版权', 4: '角色', 5: '元数据'}
    print("\n按类型统计:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat_names.get(cat, f'类型{cat}')}: {count}")

if __name__ == "__main__":
    main()
