import { Resend } from "resend";

interface SendApiKeyEmailParams {
    to: string;
    apiKey: string;
    resendApiKey: string;
}

export async function sendApiKeyEmail({
    to,
    apiKey,
    resendApiKey,
}: SendApiKeyEmailParams): Promise<{ success: boolean; error?: string }> {
    const resend = new Resend(resendApiKey);

    try {
        const { error } = await resend.emails.send({
            from: "DisposableCheck <noreply@disposablecheck.irensaltali.com>",
            to: [to],
            subject: "Your DisposableCheck API Key",
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #111827; margin: 0 0 16px;">Your API Key is Ready! 🎉</h1>
    
    <p style="color: #6b7280; line-height: 1.6;">
      Thank you for signing up for DisposableCheck. Here's your API key:
    </p>
    
    <div style="background: #f3f4f6; border-radius: 6px; padding: 16px; margin: 24px 0; font-family: monospace; font-size: 14px; word-break: break-all;">
      ${apiKey}
    </div>
    
    <h2 style="color: #111827; font-size: 18px; margin: 24px 0 12px;">Quick Start</h2>
    
    <pre style="background: #1f2937; color: #e5e7eb; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 13px;">curl "https://disposablecheck.irensaltali.com/api/v1/check?email=test@tempmail.com" \\
  -H "X-API-Key: ${apiKey}"</pre>
    
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 24px 0;">
      <strong style="color: #92400e;">⚠️ Attribution Required</strong>
      <p style="color: #92400e; margin: 8px 0 0; font-size: 14px;">
        Free tier requires a visible backlink to one of: irensaltali.com, sendfax.pro, or zenrise.app
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      <strong>Rate Limit:</strong> 1,000 requests/day
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      © 2026 DisposableCheck · <a href="https://disposablecheck.irensaltali.com" style="color: #6366f1;">disposablecheck.irensaltali.com</a>
    </p>
  </div>
</body>
</html>
      `,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
}
