// Extend the generated Env interface with secrets
// Secrets are set via `wrangler secret put RESEND_API_KEY`
declare global {
    interface Env {
        RESEND_API_KEY: string;
        TURNSTILE_SECRET_KEY: string;
    }
}

export { };
