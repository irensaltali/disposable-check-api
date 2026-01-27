import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import {
    type AppContext,
    CreateKeyRequest,
    CreateKeyResponse,
    ErrorResponse,
} from "../types";
import { sendApiKeyEmail } from "../resend";
import { getDisposableDomains } from "../domainList";
import { validateTurnstileToken } from "../turnstile";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CreateKey extends OpenAPIRoute {
    schema = {
        tags: ["API Keys"],
        summary: "Request a new API key",
        description:
            "Creates an API key and sends it to the provided email address.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: CreateKeyRequest,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "API key created and sent",
                content: { "application/json": { schema: CreateKeyResponse } },
            },
            "400": {
                description: "Invalid or disposable email",
                content: { "application/json": { schema: ErrorResponse } },
            },
        },
    };

    async handle(c: AppContext) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { email, turnstileToken } = data.body;

        // Validate Turnstile token
        if (!turnstileToken) {
            return c.json(
                { error: "Turnstile verification required", code: "TURNSTILE_REQUIRED" },
                400
            );
        }

        const clientIP = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || undefined;
        const turnstileResult = await validateTurnstileToken(
            turnstileToken,
            c.env.TURNSTILE_SECRET_KEY,
            clientIP
        );

        if (!turnstileResult.success) {
            console.log("Turnstile validation failed:", turnstileResult["error-codes"]);
            return c.json(
                { error: "Turnstile verification failed", code: "TURNSTILE_FAILED" },
                400
            );
        }

        // Validate email format
        if (!EMAIL_REGEX.test(email)) {
            return c.json(
                { error: "Invalid email format", code: "INVALID_EMAIL" },
                400
            );
        }

        // Check if email is disposable (don't allow disposable emails for API keys!)
        const domain = email.split("@")[1]?.toLowerCase() || "";
        const domains = await getDisposableDomains(c.env);
        if (domains.has(domain)) {
            return c.json(
                {
                    error: "Cannot use disposable email for API key registration",
                    code: "DISPOSABLE_EMAIL",
                },
                400
            );
        }

        // Create or get API key
        const doId = c.env.API_KEY_MANAGER.idFromName("global");
        const stub = c.env.API_KEY_MANAGER.get(doId);
        const { apiKey, isNew } = (await stub.createKey(email)) as {
            apiKey: string;
            isNew: boolean;
        };

        // Send email
        const emailResult = await sendApiKeyEmail({
            to: email,
            apiKey,
            resendApiKey: c.env.RESEND_API_KEY,
        });

        if (!emailResult.success) {
            return c.json(
                {
                    error: "Failed to send email. Please try again.",
                    code: "EMAIL_FAILED",
                },
                500
            );
        }

        return c.json({
            success: true,
            message: isNew
                ? "API key created and sent to your email"
                : "Your existing API key has been resent to your email",
        });
    }
}
