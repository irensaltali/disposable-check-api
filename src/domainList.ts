// Env is globally defined in worker-configuration.d.ts

const BLOCKLIST_URLS = [
    // --- High-accuracy, community-vetted (low false-positive rate) ---
    "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf",
    "https://raw.githubusercontent.com/7c/fakefilter/main/txt/data.txt",
    "https://raw.githubusercontent.com/unkn0w/disposable-email-domain-list/main/domains.txt",

    // --- Large aggregated / automated lists ---
    "https://raw.githubusercontent.com/FGRibreau/mailchecker/master/list.txt",                                                  // +55k domains
    "https://raw.githubusercontent.com/doodad-labs/throwaway-email-checker/refs/heads/main/data/domains.txt",                  // +183k domains
    "https://disposable.github.io/disposable-email-domains/domains_mx.txt",                                                    // DNS-validated subset
    "https://disposable.github.io/disposable-email-domains/domains.txt",                                                       // full list

    // --- Anti-abuse / broader coverage ---
    "https://www.stopforumspam.com/downloads/toxic_domains_whole.txt",
    "https://github.com/groundcat/disposable-email-domain-list/raw/master/domains.txt",

    // --- Community-maintained ---
    "https://raw.githubusercontent.com/wesbos/burner-email-providers/master/emails.txt",
];

const R2_KEY = "disposable-domains.txt";

interface CacheEntry {
    domains: Set<string>;
    expiresAt: number;
}

const CACHE_TTL_MS = 300000; // 5 minutes in-memory cache
let cache: CacheEntry | null = null;

async function fetchDomainList(url: string): Promise<string[]> {
    try {
        const response = await fetch(url, {
            headers: { "User-Agent": "DisposableCheck/1.0" },
            signal: AbortSignal.timeout(10_000),
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
            sources: String(BLOCKLIST_URLS.length),
        },
    });

    // Invalidate in-memory cache
    cache = null;

    return allDomains.length;
}

// Get domains from R2 with in-memory caching
export async function getDisposableDomains(env: Env): Promise<Set<string>> {
    const now = Date.now();

    if (cache && cache.expiresAt > now) {
        return cache.domains;
    }

    const object = await env.DOMAINS_BUCKET.get(R2_KEY);
    if (!object) {
        // R2 empty, fetch and populate
        await updateDomainList(env);
        return getDisposableDomains(env);
    }

    const text = await object.text();
    const domains = new Set(
        text
            .split("\n")
            .map((d) => d.trim().toLowerCase())
            .filter((d) => d && d.includes("."))
    );

    cache = { domains, expiresAt: now + CACHE_TTL_MS };
    return domains;
}

// Get the count of disposable domains from R2 metadata
export async function getDisposableDomainsCount(env: Env): Promise<number> {
    const object = await env.DOMAINS_BUCKET.head(R2_KEY);
    if (!object) {
        return 0;
    }

    const countStr = object.customMetadata?.count;
    return countStr ? parseInt(countStr, 10) : 0;
}
