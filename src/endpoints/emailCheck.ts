import { OpenAPIRoute, Str, Bool } from "chanfana";
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
                check_reachable: Bool({
                    description: "Perform deep verification using Reacher (SMTP check, etc.)",
                    default: false,
                }).optional(),
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
        const { email, check_reachable } = data.query;
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

        let reacherData = undefined;
        if (check_reachable) {
            try {
                const containerId = c.env.CONTAINER_WORKER.idFromName("default");
                const containerStub = c.env.CONTAINER_WORKER.get(containerId);
                console.log(`Fetching from container: http://container/v0/check_email for ${email}`);
                const reacherRes = await containerStub.fetch("http://container/v0/check_email", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ to_email: email }),
                });
                console.log(`Container response status: ${reacherRes.status}`);

                if (reacherRes.ok) {
                    const data = (await reacherRes.json()) as any;
                    console.log("Container response data:", JSON.stringify(data));
                    reacherData = {
                        is_reachable: data.is_reachable,
                        misc: {
                            is_disposable: data.misc?.is_disposable || false,
                            is_role_account: data.misc?.is_role_account || false,
                        },
                        mx: {
                            accepts_mail: data.mx?.accepts_mail || false,
                            records: data.mx?.records || [],
                        },
                        smtp: {
                            can_connect_smtp: data.smtp?.can_connect_smtp || false,
                            has_full_inbox: data.smtp?.has_full_inbox || false,
                            is_catch_all: data.smtp?.is_catch_all || false,
                            is_deliverable: data.smtp?.is_deliverable || false,
                            is_disabled: data.smtp?.is_disabled || false,
                        },
                        syntax: {
                            is_valid_syntax: data.syntax?.is_valid_syntax || false,
                            username: data.syntax?.username || "",
                            domain: data.syntax?.domain || "",
                        },
                    };
                } else {
                    console.error(`Container fetch failed: ${await reacherRes.text()}`);
                }
            } catch (e) {
                console.error("Failed to fetch from reacher container", e);
            }
        }

        return c.json({
            email,
            domain,
            is_disposable: isDisposable,
            is_valid_format: true,
            checked_at: new Date().toISOString(),
            reacher: reacherData,
        });
    }
}
