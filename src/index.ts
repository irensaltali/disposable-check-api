import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { EmailCheck } from "./endpoints/emailCheck";
import { CreateKey } from "./endpoints/createKey";
import { GetKeyInfo } from "./endpoints/getKeyInfo";
import { updateDomainList } from "./domainList";
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
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "X-API-Key"],
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

// Endpoints
openapi.get("/v1/check", EmailCheck);
openapi.post("/v1/keys", CreateKey);
openapi.get("/v1/keys/:email", GetKeyInfo);

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
