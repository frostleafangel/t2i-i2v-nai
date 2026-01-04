/**
 * Simple in-memory queue for NovelAI requests
 * Ensures only one request is processed at a time to avoid rate limiting
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../queue.log');

// Direct file logging function
const log = (message) => {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    console.log(message); // Also to stdout
    try {
        fs.appendFileSync(LOG_FILE, line);
    } catch (e) {
        // Ignore file write errors
    }
};

class NovelAIQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.currentTask = null;
        log('[NAI Queue] Queue service initialized');
    }

    /**
     * Add a task to the queue and return a promise that resolves when the task completes
     * @param {Function} taskFn - Async function to execute
     * @param {string} userId - User ID for logging
     * @returns {Promise} - Resolves with task result or rejects with error
     */
    async enqueue(taskFn, userId) {
        return new Promise((resolve, reject) => {
            const task = {
                taskFn,
                userId,
                resolve,
                reject,
                addedAt: Date.now()
            };

            this.queue.push(task);
            log(`[NAI Queue] Task added for user ${userId}. Queue length: ${this.queue.length}`);

            // Start processing if not already
            this.processNext();
        });
    }

    /**
     * Process the next task in the queue
     */
    async processNext() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        this.currentTask = this.queue.shift();

        const { taskFn, userId, resolve, reject, addedAt } = this.currentTask;
        const waitTime = Date.now() - addedAt;

        log(`[NAI Queue] Processing task for user ${userId}. Wait time: ${waitTime}ms. Remaining: ${this.queue.length}`);

        try {
            const result = await taskFn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.currentTask = null;
            this.isProcessing = false;
            // Process next task
            this.processNext();
        }
    }

    /**
     * Get current queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            waitingUsers: this.queue.map(t => t.userId)
        };
    }

    /**
     * Get position of a user in the queue (0 = currently processing, 1+ = waiting)
     */
    getPosition(userId) {
        if (this.currentTask && this.currentTask.userId === userId) {
            return 0; // Currently processing
        }
        const index = this.queue.findIndex(t => t.userId === userId);
        if (index === -1) {
            return -1; // Not in queue
        }
        return index + 1 + (this.isProcessing ? 1 : 0); // Position in queue
    }
}

// Singleton instance
const novelaiQueue = new NovelAIQueue();

module.exports = novelaiQueue;
