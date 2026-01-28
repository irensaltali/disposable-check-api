import { z } from "zod";
import type { Context } from "hono";
import {
    validateAdminSecret,
    ADMIN_SECRET_HEADER,
} from "../../middleware/adminAuth";
import type { AdminAccountInfo } from "../../ApiKeyManager";
import { updateDomainList } from "../../domainList";

// Type for our Hono context with Env bindings
type AdminContext = Context<{ Bindings: Env }>;

/**
 * GET /api/v1/admin/accounts/:email
 * Get account details by email
 */
export async function getAdminAccount(c: AdminContext) {
    // Validate admin secret
    const providedSecret = c.req.header(ADMIN_SECRET_HEADER);
    if (!validateAdminSecret(providedSecret, c.env.ADMIN_API_SECRET)) {
        return c.json(
            { error: "Unauthorized", code: "UNAUTHORIZED" },
            401
        );
    }

    const email = c.req.param("email");
    if (!email) {
        return c.json(
            { error: "Email parameter required", code: "INVALID_REQUEST" },
            400
        );
    }

    // Get account from Durable Object
    const doId = c.env.API_KEY_MANAGER.idFromName("global");
    const stub = c.env.API_KEY_MANAGER.get(doId);
    const account = (await stub.getAccountByEmail(email)) as AdminAccountInfo | null;

    if (!account) {
        return c.json(
            { error: "Account not found", code: "NOT_FOUND" },
            404
        );
    }

    return c.json({
        email: account.email,
        created_at: account.createdAt,
        total_usage: account.totalUsage,
        requests_today: account.requestsToday,
        daily_limit: account.dailyLimit,
        custom_daily_limit: account.customDailyLimit,
    });
}

/**
 * PATCH /api/v1/admin/accounts/:email/limit
 * Update daily limit for an account
 */
export async function updateAccountLimit(c: AdminContext) {
    // Validate admin secret
    const providedSecret = c.req.header(ADMIN_SECRET_HEADER);
    if (!validateAdminSecret(providedSecret, c.env.ADMIN_API_SECRET)) {
        return c.json(
            { error: "Unauthorized", code: "UNAUTHORIZED" },
            401
        );
    }

    const email = c.req.param("email");
    if (!email) {
        return c.json(
            { error: "Email parameter required", code: "INVALID_REQUEST" },
            400
        );
    }

    // Parse and validate request body
    let body: { daily_limit?: number };
    try {
        body = await c.req.json();
    } catch {
        return c.json(
            { error: "Invalid JSON body", code: "INVALID_REQUEST" },
            400
        );
    }

    const dailyLimit = body.daily_limit;
    if (typeof dailyLimit !== "number" || dailyLimit < 0 || dailyLimit > 1000000) {
        return c.json(
            { error: "daily_limit must be a number between 0 and 1,000,000", code: "INVALID_REQUEST" },
            400
        );
    }

    // Update limit via Durable Object
    const doId = c.env.API_KEY_MANAGER.idFromName("global");
    const stub = c.env.API_KEY_MANAGER.get(doId);
    const result = (await stub.updateDailyLimit(email, dailyLimit)) as {
        previousLimit: number;
        newLimit: number;
    } | null;

    if (!result) {
        return c.json(
            { error: "Account not found", code: "NOT_FOUND" },
            404
        );
    }

    return c.json({
        success: true,
        previous_limit: result.previousLimit,
        new_limit: result.newLimit,
    });
}

/**
 * GET /api/v1/admin/accounts
 * List all accounts with optional filters and pagination
 */
export async function listAdminAccounts(c: AdminContext) {
    // Validate admin secret
    const providedSecret = c.req.header(ADMIN_SECRET_HEADER);
    if (!validateAdminSecret(providedSecret, c.env.ADMIN_API_SECRET)) {
        return c.json(
            { error: "Unauthorized", code: "UNAUTHORIZED" },
            401
        );
    }

    // Parse query parameters
    const registeredWithinDays = c.req.query("registered_within_days");
    const minUsageCount = c.req.query("min_usage_count");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    // Convert and validate numeric parameters
    const filters: {
        registeredWithinDays?: number;
        minUsageCount?: number;
        limit: number;
        offset: number;
    } = {
        limit: 100,
        offset: 0,
    };

    if (registeredWithinDays !== undefined) {
        const parsed = parseInt(registeredWithinDays, 10);
        if (isNaN(parsed) || parsed < 0) {
            return c.json(
                { error: "registered_within_days must be a non-negative integer", code: "INVALID_REQUEST" },
                400
            );
        }
        filters.registeredWithinDays = parsed;
    }

    if (minUsageCount !== undefined) {
        const parsed = parseInt(minUsageCount, 10);
        if (isNaN(parsed) || parsed < 0) {
            return c.json(
                { error: "min_usage_count must be a non-negative integer", code: "INVALID_REQUEST" },
                400
            );
        }
        filters.minUsageCount = parsed;
    }

    if (limitParam !== undefined) {
        const parsed = parseInt(limitParam, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 1000) {
            return c.json(
                { error: "limit must be between 1 and 1000", code: "INVALID_REQUEST" },
                400
            );
        }
        filters.limit = parsed;
    }

    if (offsetParam !== undefined) {
        const parsed = parseInt(offsetParam, 10);
        if (isNaN(parsed) || parsed < 0) {
            return c.json(
                { error: "offset must be a non-negative integer", code: "INVALID_REQUEST" },
                400
            );
        }
        filters.offset = parsed;
    }

    // List accounts from Durable Object
    const doId = c.env.API_KEY_MANAGER.idFromName("global");
    const stub = c.env.API_KEY_MANAGER.get(doId);
    const result = (await stub.listAccounts(filters)) as {
        accounts: AdminAccountInfo[];
        totalCount: number;
    };

    // Map to response format (snake_case)
    const accounts = result.accounts.map((account) => ({
        email: account.email,
        created_at: account.createdAt,
        total_usage: account.totalUsage,
        requests_today: account.requestsToday,
        daily_limit: account.dailyLimit,
        custom_daily_limit: account.customDailyLimit,
    }));

    return c.json({
        accounts,
        total_count: result.totalCount,
        limit: filters.limit,
        offset: filters.offset,
    });
}

/**
 * POST /api/v1/admin/domains/update
 * Force update the domain blocklist
 */
export async function forceUpdateDomainList(c: AdminContext) {
    // Validate admin secret
    const providedSecret = c.req.header(ADMIN_SECRET_HEADER);
    if (!validateAdminSecret(providedSecret, c.env.ADMIN_API_SECRET)) {
        return c.json(
            { error: "Unauthorized", code: "UNAUTHORIZED" },
            401
        );
    }

    try {
        const count = await updateDomainList(c.env);
        return c.json({
            success: true,
            count: count,
            message: `Successfully updated domain list with ${count} domains`,
        });
    } catch (error) {
        console.error("Failed to update domain list:", error);
        return c.json(
            { error: "Failed to update domain list", code: "INTERNAL_ERROR", details: String(error) },
            500
        );
    }
}
