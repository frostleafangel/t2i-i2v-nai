/**
 * 任务管理服务
 * 与后端 API 交互管理 ComfyUI 任务
 */

const API_BASE = '/api/tasks';

export interface Task {
    id: string;
    user_id: number;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    params: any;
    result_url: string | null;
    error_message: string | null;
    retry_count: number;
    created_at: string;
    updated_at: string;
}

/**
 * 获取活动任务（pending/running）
 */
export const getActiveTasks = async (): Promise<Task[]> => {
    const response = await fetch(`${API_BASE}/active`, {
        credentials: 'include'
    });
    if (!response.ok) {
        throw new Error('Failed to get active tasks');
    }
    const data = await response.json();
    return data.tasks || [];
};

/**
 * 获取最近任务
 */
export const getRecentTasks = async (limit: number = 20): Promise<Task[]> => {
    const response = await fetch(`${API_BASE}?limit=${limit}`, {
        credentials: 'include'
    });
    if (!response.ok) {
        throw new Error('Failed to get recent tasks');
    }
    const data = await response.json();
    return data.tasks || [];
};

/**
 * 获取任务详情
 */
export const getTask = async (id: string): Promise<Task | null> => {
    const response = await fetch(`${API_BASE}/${id}`, {
        credentials: 'include'
    });
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to get task');
    }
    const data = await response.json();
    return data.task;
};

/**
 * 创建任务
 */
export const createTask = async (
    id: string,
    type: Task['type'],
    params: any
): Promise<{ task: Task; created: boolean }> => {
    const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, type, params })
    });
    if (!response.ok) {
        throw new Error('Failed to create task');
    }
    return response.json();
};

/**
 * 更新任务状态
 */
export const updateTaskStatus = async (
    id: string,
    status: Task['status'],
    resultUrl?: string,
    errorMessage?: string,
    queueWaitMs?: number
): Promise<Task> => {
    const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            status,
            result_url: resultUrl,
            error_message: errorMessage,
            queue_wait_ms: queueWaitMs
        })
    });
    if (!response.ok) {
        throw new Error('Failed to update task');
    }
    const data = await response.json();
    return data.task;
};

/**
 * 取消任务
 */
export const cancelTask = async (id: string): Promise<boolean> => {
    const response = await fetch(`${API_BASE}/${id}/cancel`, {
        method: 'POST',
        credentials: 'include'
    });
    if (!response.ok) {
        return false;
    }
    const data = await response.json();
    return data.success;
};
