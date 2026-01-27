import { DurableObject } from "cloudflare:workers";

interface ApiKeyData {
    email: string;
    apiKey: string;
    createdAt: string;
    requestsToday: number;
    lastResetDate: string;
}

const DAILY_LIMIT = 1000;

export class ApiKeyManager extends DurableObject {
    private async getKeyData(email: string): Promise<ApiKeyData | null> {
        const data = await this.ctx.storage.get<ApiKeyData>(`key:${email}`);
        return data || null;
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

        // Check rate limit
        if (data.requestsToday >= DAILY_LIMIT) {
            return {
                valid: false,
                error: "Daily rate limit exceeded",
                remaining: 0,
            };
        }

        // Increment user counter and global counter
        data.requestsToday++;
        await this.setKeyData(email, data);
        await this.incrementGlobalCheckCount();

        return {
            valid: true,
            email,
            remaining: DAILY_LIMIT - data.requestsToday,
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

        return {
            exists: true,
            requestsToday,
            dailyLimit: DAILY_LIMIT,
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
}
