import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { EmailCheck } from "./endpoints/emailCheck";
import { CreateKey } from "./endpoints/createKey";
import { GetKeyInfo } from "./endpoints/getKeyInfo";
import { GetStats } from "./endpoints/stats";
import { ReportDomain } from "./endpoints/report";
import {
	getAdminAccount,
	updateAccountLimit,
	listAdminAccounts,
	forceUpdateDomainList,
	getReportedDomains,
} from "./endpoints/admin/handlers";
import { updateDomainList } from "./domainList";
import { ADMIN_SECRET_HEADER } from "./middleware/adminAuth";
// Env is globally defined in worker-configuration.d.ts

// Export Durable Object
export { ApiKeyManager } from "./ApiKeyManager";
// Export environment-specific Durable Object classes (same class, different namespaces for isolation)
export { ApiKeyManager as ApiKeyManagerStaging } from "./ApiKeyManager";
export { ApiKeyManager as ApiKeyManagerProduction } from "./ApiKeyManager";

const app = new Hono<{ Bindings: Env }>();

// CORS for website (same domain, but useful for local dev)
app.use(
	"*",
	cors({
		origin: [
			"https://disposablecheck.irensaltali.com",
			"http://localhost:5173",
			"http://localhost:8787",
		],
		allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
		allowHeaders: ["Content-Type", "X-API-Key", ADMIN_SECRET_HEADER],
		maxAge: 86400,
	})
);

// OpenAPI docs at root
const openapi = fromHono(app, {
	docs_url: "/",
	schema: {
		info: {
			title: "DisposableCheck API",
			version: "1.0.0",
			description:
				"Free API to check if an email address is from a disposable email provider",
		},
		servers: [
			{
				url: "https://disposablecheck.irensaltali.com/api",
				description: "Production",
			},
		],
	},
});

// Public Endpoints - /api prefix matches the production route pattern
openapi.get("/api/v1/check", EmailCheck);
openapi.post("/api/v1/keys", CreateKey);
openapi.get("/api/v1/keys/:email", GetKeyInfo);
openapi.get("/api/v1/stats", GetStats);
openapi.post("/api/v1/report", ReportDomain);

// Admin Endpoints - NOT in public OpenAPI docs
// These are registered directly on Hono, not through chanfana's openapi
app.get("/api/v1/admin/accounts/:email", getAdminAccount);
app.patch("/api/v1/admin/accounts/:email/limit", updateAccountLimit);
app.get("/api/v1/admin/accounts", listAdminAccounts);
app.post("/api/v1/admin/domains/update", forceUpdateDomainList);
app.get("/api/v1/admin/reports", getReportedDomains);

export default {
	fetch: app.fetch,

	// Cron handler for daily domain list update
	async scheduled(
		event: ScheduledEvent,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		ctx.waitUntil(
			updateDomainList(env).then((count) => {
				console.log(`Updated domain list: ${count} domains`);
			})
		);
	},
};
