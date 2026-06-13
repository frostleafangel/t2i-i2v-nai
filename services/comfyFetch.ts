/**
 * ComfyUI API 请求工具
 * 自动添加 Cloudflare Access 认证头
 * 支持网络错误自动重试（解决移动端后台网络状态变化问题）
 */

// CF Access 凭证 - 从环境变量读取
const CF_ACCESS_CLIENT_ID = import.meta.env.VITE_CF_ACCESS_CLIENT_ID || '';
const CF_ACCESS_CLIENT_SECRET = import.meta.env.VITE_CF_ACCESS_CLIENT_SECRET || '';

/**
 * 重试配置
 */
interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
};

/**
 * 判断错误是否为可重试的网络错误
 */
const isRetryableError = (error: any): boolean => {
    // TypeError: Failed to fetch 通常意味着网络问题
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return true;
    }
    // 检查常见的网络错误信息
    const errorMessage = String(error?.message || error).toLowerCase();
    return (
        errorMessage.includes('network') ||
        errorMessage.includes('failed to fetch') ||
        errorMessage.includes('net::err_') ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('timeout')
    );
};

/**
 * 延迟函数
 */
const delay = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * 计算指数退避延迟
 */
const getRetryDelay = (attempt: number, config: RetryConfig): number => {
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
    // 添加一些随机抖动 (jitter) 以避免雷同请求
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, config.maxDelayMs);
};

/**
 * 获取 CF Access 认证头
 */
export const getCFAccessHeaders = (): Record<string, string> => {
    if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
        return {
            'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID,
            'CF-Access-Client-Secret': CF_ACCESS_CLIENT_SECRET,
        };
    }
    return {};
};

/**
 * 带 CF Access 认证和自动重试的 fetch 封装
 * 自动添加认证头，用于所有 ComfyUI API 请求
 * 在网络错误时自动重试
 */
export const comfyFetch = async (
    url: string,
    options: RequestInit = {},
    retryConfig: Partial<RetryConfig> = {}
): Promise<Response> => {
    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    const cfHeaders = getCFAccessHeaders();

    // 合并 headers
    const headers = new Headers(options.headers);
    Object.entries(cfHeaders).forEach(([key, value]) => {
        headers.set(key, value);
    });

    let lastError: any;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const retryDelay = getRetryDelay(attempt - 1, config);
                console.log(`[ComfyFetch] Retry attempt ${attempt}/${config.maxRetries} after ${Math.round(retryDelay)}ms for: ${url}`);
                await delay(retryDelay);
            }

            const response = await fetch(url, {
                ...options,
                headers,
            });

            // 请求成功（即使是 4xx/5xx 状态码也算 fetch 成功）
            if (attempt > 0) {
                console.log(`[ComfyFetch] Request succeeded on retry ${attempt}`);
            }
            return response;
        } catch (error) {
            lastError = error;
            console.error(`[ComfyFetch] Request failed (attempt ${attempt + 1}/${config.maxRetries + 1}):`, error);

            // 如果不是可重试的错误，或者已经是最后一次尝试，则抛出
            if (!isRetryableError(error) || attempt === config.maxRetries) {
                throw error;
            }

            console.log(`[ComfyFetch] Will retry due to retryable error: ${error}`);
        }
    }

    // 这里不应该到达，但为了类型安全
    throw lastError;
};

/**
 * 带认证和重试的 JSON POST 请求
 */
export const comfyPost = async (
    url: string,
    data: any,
    retryConfig: Partial<RetryConfig> = {}
): Promise<Response> => {
    return comfyFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    }, retryConfig);
};

/**
 * 带认证和重试的 FormData POST 请求（用于上传图片）
 * 上传可能需要更多的重试时间
 */
export const comfyUpload = async (
    url: string,
    formData: FormData,
    retryConfig: Partial<RetryConfig> = {}
): Promise<Response> => {
    // 上传使用更长的延迟
    const uploadRetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
        ...retryConfig,
    };

    return comfyFetch(url, {
        method: 'POST',
        body: formData,
    }, uploadRetryConfig);
};

/**
 * 检查是否配置了 CF Access
 */
export const hasCFAccessConfig = (): boolean => {
    return !!(CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET);
};

/**
 * 获取带认证的图片 URL
 * 由于图片 URL 需要在 <img> 标签中使用，而 <img> 无法设置自定义 header，
 * 需要通过服务端代理或使用 blob URL
 */
export const getAuthenticatedImageUrl = async (imageUrl: string): Promise<string> => {
    if (!hasCFAccessConfig()) {
        return imageUrl;
    }

    try {
        const response = await comfyFetch(imageUrl);
        if (response.ok) {
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        }
    } catch (e) {
        console.error('Failed to fetch authenticated image:', e);
    }

    return imageUrl;
};

