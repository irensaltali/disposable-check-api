import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext, KeyInfoResponse, ErrorResponse } from "../types";

export class GetKeyInfo extends OpenAPIRoute {
    schema = {
        tags: ["API Keys"],
        summary: "Get API key usage information",
        description: "Returns usage stats for an API key by email.",
        request: {
            params: z.object({
                email: Str({ description: "Email address associated with the key" }),
            }),
        },
        responses: {
            "200": {
                description: "Key information",
                content: { "application/json": { schema: KeyInfoResponse } },
            },
            "404": {
                description: "Key not found",
                content: { "application/json": { schema: ErrorResponse } },
            },
        },
    };

    async handle(c: AppContext) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { email } = data.params;

        const doId = c.env.API_KEY_MANAGER.idFromName("global");
        const stub = c.env.API_KEY_MANAGER.get(doId);
        const info = (await stub.getKeyInfo(email)) as {
            exists: boolean;
            requestsToday?: number;
            dailyLimit?: number;
            createdAt?: string;
        };

        if (!info.exists) {
            return c.json(
                { error: "No API key found for this email", code: "NOT_FOUND" },
                404
            );
        }

        return c.json({
            exists: true,
            requests_today: info.requestsToday,
            daily_limit: info.dailyLimit,
            created_at: info.createdAt,
        });
    }
}
