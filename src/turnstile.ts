/**
 * Cloudflare Turnstile server-side validation
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

interface TurnstileValidationResult {
    success: boolean;
    challenge_ts?: string;
    hostname?: string;
    "error-codes"?: string[];
    action?: string;
    cdata?: string;
}

export async function validateTurnstileToken(
    token: string,
    secretKey: string,
    remoteip?: string
): Promise<TurnstileValidationResult> {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteip) {
        formData.append("remoteip", remoteip);
    }

    try {
        const response = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                body: formData,
            }
        );

        const result = await response.json<TurnstileValidationResult>();
        return result;
    } catch (error) {
        console.error("Turnstile validation error:", error);
        return {
            success: false,
            "error-codes": ["internal-error"],
        };
    }
}
