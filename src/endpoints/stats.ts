import { OpenAPIRoute } from "chanfana";
import { type AppContext, StatsResponse } from "../types";
import { getDisposableDomainsCount } from "../domainList";

export class GetStats extends OpenAPIRoute {
    schema = {
        tags: ["Stats"],
        summary: "Get platform statistics",
        description:
            "Returns aggregated statistics including total emails checked, total disposable domains tracked, and community reports.",
        responses: {
            "200": {
                description: "Platform statistics",
                content: { "application/json": { schema: StatsResponse } },
            },
        },
    };

    async handle(c: AppContext) {
        // Get global stats from Durable Object
        const doId = c.env.API_KEY_MANAGER.idFromName("global");
        const stub = c.env.API_KEY_MANAGER.get(doId);
        const globalStats = (await stub.getGlobalStats()) as {
            totalEmailsChecked: number;
            totalApiKeys: number;
        };

        // Get domain count from R2
        const totalDisposableDomains = await getDisposableDomainsCount(c.env);

        // Community reports - stored in R2 metadata or default to a placeholder
        // For now, we'll track this as a growing metric
        const communityReports = await this.getCommunityReports(c);

        return c.json({
            total_emails_checked: globalStats.totalEmailsChecked,
            total_disposable_domains: totalDisposableDomains,
            community_reports: communityReports,
        });
    }

    private async getCommunityReports(c: AppContext): Promise<number> {
        try {
            const object = await c.env.DOMAINS_BUCKET.get("stats/community-reports.json");
            if (object) {
                const data = await object.json<{ count: number }>();
                return data.count || 0;
            }
        } catch {
            // Ignore errors, return default
        }
        return 0;
    }
}
