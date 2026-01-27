import { DurableObject } from "cloudflare:workers";

interface ApiKeyData {
    email: string;
    apiKey: string;
    createdAt: string;
    requestsToday: number;
    lastResetDate: string;
    totalUsage: number;         // Lifetime total API calls
    customDailyLimit?: number;  // Per-user override, undefined = use default
}

// Default daily limit for all users
const DEFAULT_DAILY_LIMIT = 1000;
// Maximum allowed daily limit (admin can set up to this)
const MAX_DAILY_LIMIT = 1000000;

// Admin response type for account info
export interface AdminAccountInfo {
    email: string;
    createdAt: string;
    totalUsage: number;
    requestsToday: number;
    dailyLimit: number;
    customDailyLimit?: number;
}

export class ApiKeyManager extends DurableObject {
    private async getKeyData(email: string): Promise<ApiKeyData | null> {
        const data = await this.ctx.storage.get<ApiKeyData>(`key:${email}`);
        if (!data) return null;

        // Backward compatibility: default totalUsage to 0 if missing
        if (data.totalUsage === undefined) {
            data.totalUsage = 0;
        }
        return data;
    }

    private async setKeyData(email: string, data: ApiKeyData): Promise<void> {
        await this.ctx.storage.put(`key:${email}`, data);
        // Also index by API key for lookups
        await this.ctx.storage.put(`lookup:${data.apiKey}`, email);
    }

    private generateApiKey(): string {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let key = "dk_live_";
        for (let i = 0; i < 32; i++) {
            key += chars[Math.floor(Math.random() * chars.length)];
        }
        return key;
    }

    private getTodayDate(): string {
        return new Date().toISOString().split("T")[0];
    }

    // Create or get existing API key for email
    async createKey(email: string): Promise<{ apiKey: string; isNew: boolean }> {
        const existing = await this.getKeyData(email);
        if (existing) {
            return { apiKey: existing.apiKey, isNew: false };
        }

        const apiKey = this.generateApiKey();
        const now = new Date().toISOString();
        await this.setKeyData(email, {
            email,
            apiKey,
            createdAt: now,
            requestsToday: 0,
            lastResetDate: this.getTodayDate(),
            totalUsage: 0,
        });

        return { apiKey, isNew: true };
    }

    // Validate API key and check rate limit
    async validateAndIncrement(apiKey: string): Promise<{
        valid: boolean;
        email?: string;
        remaining?: number;
        error?: string;
    }> {
        const email = await this.ctx.storage.get<string>(`lookup:${apiKey}`);
        if (!email) {
            return { valid: false, error: "Invalid API key" };
        }

        const data = await this.getKeyData(email);
        if (!data) {
            return { valid: false, error: "Key data not found" };
        }

        const today = this.getTodayDate();

        // Reset counter if new day
        if (data.lastResetDate !== today) {
            data.requestsToday = 0;
            data.lastResetDate = today;
        }

        // Get effective daily limit (custom or default)
        const effectiveLimit = data.customDailyLimit ?? DEFAULT_DAILY_LIMIT;

        // Check rate limit
        if (data.requestsToday >= effectiveLimit) {
            return {
                valid: false,
                error: "Daily rate limit exceeded",
                remaining: 0,
            };
        }

        // Increment user counter, total usage, and global counter
        data.requestsToday++;
        data.totalUsage = (data.totalUsage || 0) + 1;
        await this.setKeyData(email, data);
        await this.incrementGlobalCheckCount();

        return {
            valid: true,
            email,
            remaining: effectiveLimit - data.requestsToday,
        };
    }

    // Get key info by email
    async getKeyInfo(email: string): Promise<{
        exists: boolean;
        requestsToday?: number;
        dailyLimit?: number;
        createdAt?: string;
    }> {
        const data = await this.getKeyData(email);
        if (!data) {
            return { exists: false };
        }

        const today = this.getTodayDate();
        const requestsToday = data.lastResetDate === today ? data.requestsToday : 0;
        const dailyLimit = data.customDailyLimit ?? DEFAULT_DAILY_LIMIT;

        return {
            exists: true,
            requestsToday,
            dailyLimit,
            createdAt: data.createdAt,
        };
    }

    // Increment global email check counter
    async incrementGlobalCheckCount(): Promise<number> {
        const current = await this.ctx.storage.get<number>("global:totalEmailsChecked") || 0;
        const newCount = current + 1;
        await this.ctx.storage.put("global:totalEmailsChecked", newCount);
        return newCount;
    }

    // Get global stats
    async getGlobalStats(): Promise<{
        totalEmailsChecked: number;
        totalApiKeys: number;
    }> {
        const totalEmailsChecked = await this.ctx.storage.get<number>("global:totalEmailsChecked") || 0;

        // Count API keys by listing all key: prefixed entries
        const entries = await this.ctx.storage.list({ prefix: "key:" });
        const totalApiKeys = entries.size;

        return {
            totalEmailsChecked,
            totalApiKeys,
        };
    }

    // ==================== ADMIN METHODS ====================

    /**
     * Get account info by email (admin only)
     */
    async getAccountByEmail(email: string): Promise<AdminAccountInfo | null> {
        const data = await this.getKeyData(email);
        if (!data) return null;

        const today = this.getTodayDate();
        const requestsToday = data.lastResetDate === today ? data.requestsToday : 0;
        const dailyLimit = data.customDailyLimit ?? DEFAULT_DAILY_LIMIT;

        return {
            email: data.email,
            createdAt: data.createdAt,
            totalUsage: data.totalUsage || 0,
            requestsToday,
            dailyLimit,
            customDailyLimit: data.customDailyLimit,
        };
    }

    /**
     * Update daily limit for a specific email (admin only)
     * Returns the previous limit, or null if email not found
     */
    async updateDailyLimit(
        email: string,
        newLimit: number
    ): Promise<{ previousLimit: number; newLimit: number } | null> {
        const data = await this.getKeyData(email);
        if (!data) return null;

        // Validate the new limit
        const clampedLimit = Math.max(0, Math.min(newLimit, MAX_DAILY_LIMIT));
        const previousLimit = data.customDailyLimit ?? DEFAULT_DAILY_LIMIT;

        // Set custom limit (or remove if it equals default)
        if (clampedLimit === DEFAULT_DAILY_LIMIT) {
            delete data.customDailyLimit;
        } else {
            data.customDailyLimit = clampedLimit;
        }

        await this.setKeyData(email, data);

        return {
            previousLimit,
            newLimit: clampedLimit,
        };
    }

    /**
     * List all accounts with optional filters (admin only)
     * Supports pagination via limit and offset
     */
    async listAccounts(filters: {
        registeredWithinDays?: number;
        minUsageCount?: number;
        limit?: number;
        offset?: number;
    }): Promise<{ accounts: AdminAccountInfo[]; totalCount: number }> {
        const { registeredWithinDays, minUsageCount, limit = 100, offset = 0 } = filters;

        // Cap the limit to prevent abuse
        const cappedLimit = Math.min(limit, 1000);

        // Get all keys
        const entries = await this.ctx.storage.list<ApiKeyData>({ prefix: "key:" });
        const today = this.getTodayDate();
        const now = Date.now();

        // Calculate cutoff date if filtering by registration date
        const cutoffTime = registeredWithinDays !== undefined
            ? now - registeredWithinDays * 24 * 60 * 60 * 1000
            : 0;

        const allAccounts: AdminAccountInfo[] = [];

        for (const [, data] of entries) {
            if (!data) continue;

            // Parse creation date for filtering
            const createdTime = new Date(data.createdAt).getTime();

            // Filter: registered within N days
            if (registeredWithinDays !== undefined && createdTime < cutoffTime) {
                continue;
            }

            // Get current requests today (reset if new day)
            const requestsToday = data.lastResetDate === today ? data.requestsToday : 0;
            const totalUsage = data.totalUsage || 0;

            // Filter: minimum usage count
            if (minUsageCount !== undefined && totalUsage < minUsageCount) {
                continue;
            }

            const dailyLimit = data.customDailyLimit ?? DEFAULT_DAILY_LIMIT;

            allAccounts.push({
                email: data.email,
                createdAt: data.createdAt,
                totalUsage,
                requestsToday,
                dailyLimit,
                customDailyLimit: data.customDailyLimit,
            });
        }

        // Sort by creation date descending (newest first)
        allAccounts.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Apply pagination
        const paginatedAccounts = allAccounts.slice(offset, offset + cappedLimit);

        return {
            accounts: paginatedAccounts,
            totalCount: allAccounts.length,
        };
    }
}
