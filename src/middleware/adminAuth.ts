import { timingSafeEqual } from "node:crypto";

/**
 * Validates the admin secret using constant-time comparison to prevent timing attacks.
 * 
 * Security considerations:
 * - Uses crypto.timingSafeEqual for constant-time comparison
 * - Handles length mismatches without leaking timing information
 * - Returns false for null/empty inputs without short-circuiting
 */
export function validateAdminSecret(
    provided: string | null | undefined,
    expected: string
): boolean {
    if (!provided || !expected) {
        return false;
    }

    // Convert to buffers for comparison
    const providedBuffer = Buffer.from(provided, "utf-8");
    const expectedBuffer = Buffer.from(expected, "utf-8");

    // If lengths differ, we still need to do constant-time work
    // to prevent timing attacks that could reveal length
    if (providedBuffer.length !== expectedBuffer.length) {
        // Compare with itself to maintain constant time, but return false
        timingSafeEqual(expectedBuffer, expectedBuffer);
        return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Header name for admin API authentication
 */
export const ADMIN_SECRET_HEADER = "X-Admin-Secret";
