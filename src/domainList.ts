// Env is globally defined in worker-configuration.d.ts

const BLOCKLIST_URLS = [
    "https://raw.githubusercontent.com/7c/fakefilter/main/txt/data.txt",
    "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf",
    "https://raw.githubusercontent.com/wesbos/burner-email-providers/master/emails.txt",
];

const R2_KEY = "disposable-domains.txt";

// In-memory cache with TTL
let cachedDomains: Set<string> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 300000; // 5 minutes in-memory cache

async function fetchDomainList(url: string): Promise<string[]> {
    try {
        const response = await fetch(url, {
            headers: { "User-Agent": "DisposableCheck/1.0" },
        });
        if (!response.ok) return [];
        const text = await response.text();
        return text
            .split("\n")
            .map((d) => d.trim().toLowerCase())
            .filter((d) => d && !d.startsWith("#") && d.includes("."));
    } catch {
        return [];
    }
}

// Fetch from all sources and update R2
export async function updateDomainList(env: Env): Promise<number> {
    const results = await Promise.all(BLOCKLIST_URLS.map(fetchDomainList));
    const allDomains = [...new Set(results.flat())].sort();

    if (allDomains.length === 0) {
        throw new Error("Failed to fetch any domains");
    }

    const content = allDomains.join("\n");
    await env.DOMAINS_BUCKET.put(R2_KEY, content, {
        httpMetadata: { contentType: "text/plain" },
        customMetadata: {
            count: String(allDomains.length),
            updatedAt: new Date().toISOString(),
        },
    });

    // Clear in-memory cache
    cachedDomains = null;
    cacheTime = 0;

    return allDomains.length;
}

// Get domains from R2 with in-memory caching
export async function getDisposableDomains(env: Env): Promise<Set<string>> {
    const now = Date.now();

    // Return cached if fresh
    if (cachedDomains && now - cacheTime < CACHE_TTL_MS) {
        return cachedDomains;
    }

    // Try to get from R2
    const object = await env.DOMAINS_BUCKET.get(R2_KEY);
    if (!object) {
        // R2 empty, fetch and populate
        await updateDomainList(env);
        return getDisposableDomains(env);
    }

    const text = await object.text();
    const domains = text.split("\n").filter((d) => d);

    cachedDomains = new Set(domains);
    cacheTime = now;

    return cachedDomains;
}
