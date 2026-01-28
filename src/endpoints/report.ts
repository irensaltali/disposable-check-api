import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";

export class ReportDomain extends OpenAPIRoute {
    schema = {
        tags: ["Report"],
        summary: "Report a disposable domain",
        description: "Report a domain that should be classified as disposable. Community reports are reviewed by admins.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: z.object({
                            domain: z.string().min(3).max(253).regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i, "Invalid domain format"),
                            reason: z.string().optional(),
                        }),
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Report received",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { domain, reason } = data.body;

        const doId = c.env.API_KEY_MANAGER.idFromName("global");
        const stub = c.env.API_KEY_MANAGER.get(doId);

        await stub.reportDomain(domain.toLowerCase(), reason);

        return c.json({
            success: true,
            message: "Domain reported successfully. Thank you for your contribution.",
        });
    }
}
