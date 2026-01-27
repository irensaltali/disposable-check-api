import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext, EmailCheckResponse, ErrorResponse } from "../types";
import { getDisposableDomains } from "../domainList";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_ORIGINS = [
    "https://disposablecheck.irensaltali.com",
    "http://localhost:5173",
    "http://localhost:8787",
];

export class EmailCheck extends OpenAPIRoute {
    schema = {
        tags: ["Email"],
        summary: "Check if an email address is disposable",
        description:
            "Returns whether the email uses a known disposable domain.",
        // security: [{ apiKey: [] }],
        request: {
            query: z.object({
                email: Str({
                    description: "Email address to check",
                    example: "user@tempmail.com",
                }),
            }),
            headers: z.object({
                "x-api-key": Str({ description: "Your API key" }).optional().nullable(),
            }).passthrough(),
        },
        responses: {
            "200": {
                description: "Email check result",
                content: { "application/json": { schema: EmailCheckResponse } },
            },
            "400": {
                description: "Invalid email format",
                content: { "application/json": { schema: ErrorResponse } },
            },
            "401": {
                description: "Invalid or missing API key",
                content: { "application/json": { schema: ErrorResponse } },
            },
            "429": {
                description: "Rate limit exceeded",
                content: { "application/json": { schema: ErrorResponse } },
            },
        },
    };

    async handle(c: AppContext) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { email } = data.query;
        const apiKey = data.headers["x-api-key"];

        // Get DO stub
        const doId = c.env.API_KEY_MANAGER.idFromName("global");
        const stub = c.env.API_KEY_MANAGER.get(doId);

        if (apiKey) {
            // Validate API key
            const validation = (await stub.validateAndIncrement(apiKey)) as {
                valid: boolean;
                email?: string;
                remaining?: number;
                error?: string;
            };

            if (!validation.valid) {
                const status = validation.error?.includes("rate limit") ? 429 : 401;
                return c.json(
                    {
                        error: validation.error,
                        code: status === 429 ? "RATE_LIMITED" : "UNAUTHORIZED",
                    },
                    status
                );
            }
        } else {
            // Check for trusted origin or referer for website usage
            // curl commands often send Referer but not Origin
            const origin = c.req.header("Origin");
            const referer = c.req.header("Referer");

            const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
            const isAllowedReferer = referer && ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed));

            if (!isAllowedOrigin && !isAllowedReferer) {
                return c.json(
                    { error: "Missing API key", code: "UNAUTHORIZED" },
                    401
                );
            }

            // Valid origin/referer, increment global stats
            await stub.incrementGlobalCheckCount();
        }

        // Validate email format
        if (!EMAIL_REGEX.test(email)) {
            return c.json(
                { error: "Invalid email format", code: "INVALID_EMAIL" },
                400
            );
        }

        const domain = email.split("@")[1]?.toLowerCase() || "";
        const domains = await getDisposableDomains(c.env);
        const isDisposable = domains.has(domain);

        return c.json({
            email,
            domain,
            is_disposable: isDisposable,
            is_valid_format: true,
            checked_at: new Date().toISOString(),
        });
    }
}
