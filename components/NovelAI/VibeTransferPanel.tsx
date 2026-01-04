import React, { useRef, useState, useCallback } from 'react';
import { VibeReference } from '../../types';
import { Upload, Download, Trash2, Image as ImageIcon, Loader2, X, FolderOpen } from 'lucide-react';

interface Props {
    vibeReferences: VibeReference[];
    onChange: (vibes: VibeReference[]) => void;
}

const MAX_VIBES = 16;

const VibeTransferPanel: React.FC<Props> = ({ vibeReferences, onChange }) => {
    const [isEncoding, setIsEncoding] = useState(false);
    const [encodingProgress, setEncodingProgress] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    // Handle single file upload and encoding - returns the new vibe or null on error
    const handleSingleFileUpload = useCallback(async (file: File, currentCount: number): Promise<VibeReference | null> => {
        // Validate file
        if (!file.type.startsWith('image/')) {
            throw new Error(`${file.name}: 只支持图片文件`);
        }

        if (file.size > 35 * 1024 * 1024) {
            throw new Error(`${file.name}: 图片文件过大，最大支持 35MB`);
        }

        if (currentCount >= MAX_VIBES) {
            throw new Error(`已达到最大 Vibe 数量限制（${MAX_VIBES}个）`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('information_extracted', '1.0');

        const response = await fetch('/api/vibe/encode', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`${file.name}: ${err.error || 'Vibe 编码失败'}`);
        }

        const data = await response.json();

        // Create preview URL (temporary, lost on refresh)
        const previewUrl = URL.createObjectURL(file);

        // Generate persistent thumbnail (survives refresh)
        let thumbnail: string | undefined;
        try {
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject();
                img.src = previewUrl;
            });

            // Create small thumbnail (80x80)
            const canvas = document.createElement('canvas');
            const size = 80;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Calculate cropping to make square
                const minDim = Math.min(img.width, img.height);
                const sx = (img.width - minDim) / 2;
                const sy = (img.height - minDim) / 2;
                ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            }
        } catch {
            // Thumbnail generation failed, continue without it
        }

        return {
            id: data.vibe_id,
            name: file.name,
            vibeData: data.vibe_data,
            informationExtracted: 1.0,
            strength: 0.6,
            previewUrl,
            thumbnail
        };
    }, []);

    // Handle multiple files upload
    const handleMultipleFilesUpload = useCallback(async (files: File[]) => {
        if (files.length === 0) return;

        const remainingSlots = MAX_VIBES - vibeReferences.length;
        if (remainingSlots <= 0) {
            setError(`已达到最大 Vibe 数量限制（${MAX_VIBES}个）`);
            return;
        }

        // Limit files to remaining slots
        const filesToUpload = files.slice(0, remainingSlots);
        if (files.length > remainingSlots) {
            setError(`只能再添加 ${remainingSlots} 个 Vibe，已选择前 ${remainingSlots} 张图片`);
        } else {
            setError(null);
        }

        setIsEncoding(true);
        const newVibes: VibeReference[] = [];
        const errors: string[] = [];

        for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i];
            setEncodingProgress(`正在编码第 ${i + 1}/${filesToUpload.length} 张图片...`);

            try {
                const newVibe = await handleSingleFileUpload(file, vibeReferences.length + newVibes.length);
                if (newVibe) {
                    newVibes.push(newVibe);
                }
            } catch (err: any) {
                console.error('Vibe encoding error:', err);
                errors.push(err.message || `${file.name}: 编码失败`);
            }
        }

        // Update state with all new vibes
        if (newVibes.length > 0) {
            onChange([...vibeReferences, ...newVibes]);
        }

        // Show errors if any
        if (errors.length > 0) {
            setError(errors.join('；'));
        }

        setIsEncoding(false);
        setEncodingProgress('');
    }, [vibeReferences, onChange, handleSingleFileUpload]);

    // Handle file input change (supports multiple files)
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            await handleMultipleFilesUpload(Array.from(files));
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle drag and drop (supports multiple files)
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleMultipleFilesUpload(Array.from(files));
        }
    }, [handleMultipleFilesUpload]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // Update vibe parameter
    const updateVibeParam = (id: string, field: 'informationExtracted' | 'strength', value: number) => {
        const updated = vibeReferences.map(v =>
            v.id === id ? { ...v, [field]: value } : v
        );
        onChange(updated);
    };

    // Remove vibe
    const removeVibe = (id: string) => {
        const vibe = vibeReferences.find(v => v.id === id);
        if (vibe?.previewUrl) {
            URL.revokeObjectURL(vibe.previewUrl);
        }
        onChange(vibeReferences.filter(v => v.id !== id));
    };

    // Download vibe encoding
    const downloadVibe = (vibe: VibeReference) => {
        const vibeData = {
            version: '1.0',
            id: vibe.id,
            name: vibe.name,
            vibeData: vibe.vibeData,
            informationExtracted: vibe.informationExtracted,
            strength: vibe.strength,
            createdAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(vibeData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${vibe.name.replace(/\.[^/.]+$/, '')}_vibe.vibe`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Import vibe encoding
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (vibeReferences.length >= MAX_VIBES) {
            setError(`已达到最大 Vibe 数量限制（${MAX_VIBES}个）`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const vibeData = JSON.parse(content);

                if (!vibeData.vibeData || !vibeData.name) {
                    setError('无效的 Vibe 编码文件格式');
                    return;
                }

                const newVibe: VibeReference = {
                    id: crypto.randomUUID(),
                    name: vibeData.name,
                    vibeData: vibeData.vibeData,
                    informationExtracted: vibeData.informationExtracted || 1.0,
                    strength: vibeData.strength || 0.6,
                    previewUrl: vibeData.previewUrl || ''
                };

                onChange([...vibeReferences, newVibe]);
                setError(null);
            } catch {
                setError('文件格式错误，请导入有效的 .vibe 文件');
            }
        };
        reader.readAsText(file);

        if (importInputRef.current) {
            importInputRef.current.value = '';
        }
    };

    // Total strength calculation
    const totalStrength = vibeReferences.reduce((sum, v) => sum + v.strength, 0);

    return (
        <div className="space-y-3">
            {/* Upload Area */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => !isEncoding && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${isEncoding
                    ? 'border-primary/50 bg-primary/5'
                    : vibeReferences.length >= MAX_VIBES
                        ? 'border-white/5 bg-white/5 cursor-not-allowed opacity-50'
                        : 'border-white/10 hover:border-primary/30 hover:bg-white/5'
                    }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isEncoding || vibeReferences.length >= MAX_VIBES}
                />
                {isEncoding ? (
                    <>
                        <Loader2 size={24} className="mx-auto text-primary animate-spin mb-2" />
                        <p className="text-xs text-primary">{encodingProgress}</p>
                    </>
                ) : (
                    <>
                        <Upload size={20} className="mx-auto text-gray-500 mb-2" />
                        <p className="text-xs text-gray-500">拖拽图片到此处上传（支持多选）</p>
                        <p className="text-xs text-gray-600 mt-1">或点击选择多个文件</p>
                    </>
                )}
            </div>

            {/* Import Button */}
            <div className="flex justify-center">
                <input
                    ref={importInputRef}
                    type="file"
                    accept=".vibe,.json"
                    onChange={handleImport}
                    className="hidden"
                />
                <button
                    onClick={() => importInputRef.current?.click()}
                    disabled={vibeReferences.length >= MAX_VIBES}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 transition-colors disabled:opacity-50"
                >
                    <FolderOpen size={12} />
                    导入已保存的 Vibe 编码
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                    <X size={12} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Vibe Count */}
            <div className="text-xs text-gray-500 text-center">
                已上传 {vibeReferences.length}/{MAX_VIBES} 张
                {vibeReferences.length > 4 && (
                    <span className="text-yellow-500 ml-2">
                        ⚠️ 超过4个 Vibe 会额外消耗 Anlas
                    </span>
                )}
            </div>

            {/* Vibe List */}
            {vibeReferences.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {vibeReferences.map((vibe, idx) => (
                        <div key={vibe.id} className="flex gap-2 bg-white/5 rounded-lg p-2 border border-white/10">
                            {/* Preview */}
                            <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-black/30 relative">
                                <span className="absolute top-0.5 left-0.5 bg-black/70 text-white text-xs px-1 rounded z-10">
                                    {idx + 1}
                                </span>
                                {/* Priority: thumbnail (persistent) > previewUrl (temporary) > placeholder */}
                                {(vibe.thumbnail || vibe.previewUrl) ? (
                                    <img
                                        src={vibe.thumbnail || vibe.previewUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // If thumbnail/previewUrl fails, hide and show placeholder
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : null}
                                <div className={`w-full h-full flex items-center justify-center text-gray-500 absolute inset-0 ${(vibe.thumbnail || vibe.previewUrl) ? 'opacity-0' : 'opacity-100'}`}
                                    style={{ pointerEvents: 'none' }}>
                                    <ImageIcon size={16} />
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-xs text-gray-300 truncate" title={vibe.name}>
                                    {vibe.name}
                                </div>
                                {/* Info Extracted */}
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-500 w-12">信息</span>
                                    <input
                                        type="range" min="0" max="1" step="0.1"
                                        value={vibe.informationExtracted}
                                        onChange={(e) => updateVibeParam(vibe.id, 'informationExtracted', parseFloat(e.target.value))}
                                        className="flex-1 h-1 accent-primary"
                                    />
                                    <span className="text-primary w-6 text-right">{vibe.informationExtracted.toFixed(1)}</span>
                                </div>
                                {/* Strength */}
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-500 w-12">强度</span>
                                    <input
                                        type="range" min="0" max="1" step="0.1"
                                        value={vibe.strength}
                                        onChange={(e) => updateVibeParam(vibe.id, 'strength', parseFloat(e.target.value))}
                                        className="flex-1 h-1 accent-primary"
                                    />
                                    <span className="text-primary w-6 text-right">{vibe.strength.toFixed(1)}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => downloadVibe(vibe)}
                                    className="p-1 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                                    title="下载 Vibe 编码"
                                >
                                    <Download size={12} />
                                </button>
                                <button
                                    onClick={() => removeVibe(vibe.id)}
                                    className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                    title="删除"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Total Strength Warning */}
            {vibeReferences.length > 1 && (
                <div className={`text-xs text-center ${totalStrength > 1 ? 'text-yellow-500' : 'text-gray-500'}`}>
                    总参考强度: {totalStrength.toFixed(2)}
                    {totalStrength > 1 && ' (建议 ≤1.0)'}
                </div>
            )}

            {/* Quick Presets */}
            {vibeReferences.length > 0 && (
                <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-gray-500">快捷预设:</span>
                    {[
                        { label: '轻微', info: 0.5, str: 0.3 },
                        { label: '标准', info: 0.7, str: 0.6 },
                        { label: '强烈', info: 1.0, str: 0.8 },
                    ].map(preset => (
                        <button
                            key={preset.label}
                            onClick={() => {
                                const updated = vibeReferences.map(v => ({
                                    ...v,
                                    informationExtracted: preset.info,
                                    strength: preset.str
                                }));
                                onChange(updated);
                            }}
                            className="text-xs px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-400 transition-colors"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VibeTransferPanel;
