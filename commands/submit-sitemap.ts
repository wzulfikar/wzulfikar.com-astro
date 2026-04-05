/**
 * Submit sitemap URLs to search engines via IndexNow (Bing, Yandex, etc.).
 *
 * Google deprecated its sitemap ping endpoint in June 2023. Use Google Search
 * Console to submit sitemaps manually: https://search.google.com/search-console
 *
 * IndexNow setup (one-time):
 *   1. Generate a key: https://www.bing.com/indexnow/getstarted
 *   2. Place the key file at public/<your-key>.txt with the key as its content
 *   3. Set INDEXNOW_KEY=<your-key> in your environment (or .env file)
 *
 * Usage:
 *   INDEXNOW_KEY=your-key bun commands/submit-sitemap.ts
 *   INDEXNOW_KEY=your-key npx tsx commands/submit-sitemap.ts
 *
 * Dry run (parse sitemap only, don't submit):
 *   DRY_RUN=1 bun commands/submit-sitemap.ts
 */

const SITE_URL = "https://wzulfikar.com";
const SITEMAP_URL = `${SITE_URL}/sitemap-index.xml`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const INDEXNOW_KEY = process.env.INDEXNOW_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";

async function fetchSitemapURLs(sitemapUrl: string): Promise<string[]> {
  console.log(`Fetching sitemap: ${sitemapUrl}`);
  const res = await fetch(sitemapUrl);
  if (!res.ok) throw new Error(`Failed to fetch sitemap: ${res.status} ${res.statusText}`);
  const xml = await res.text();

  // Handle sitemap index — collect child sitemap URLs, then recurse
  const isSitemapIndex = xml.includes("<sitemapindex");
  if (isSitemapIndex) {
    const childUrls = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map((m) => m[1]);
    const nested = await Promise.all(childUrls.map(fetchSitemapURLs));
    return nested.flat();
  }

  // Regular sitemap — extract page URLs
  return [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function submitToIndexNow(urls: string[], key: string): Promise<void> {
  const host = new URL(SITE_URL).hostname;
  const keyLocation = `${SITE_URL}/${key}.txt`;

  const body = { host, key, keyLocation, urlList: urls };
  console.log(`\nSubmitting ${urls.length} URLs to IndexNow...`);

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 202) {
    console.log(`IndexNow: OK (${res.status}) — submitted to Bing, Yandex, and other IndexNow partners`);
  } else {
    const text = await res.text().catch(() => "");
    throw new Error(`IndexNow submission failed: ${res.status} ${res.statusText}\n${text}`);
  }
}

async function main() {
  const urls = await fetchSitemapURLs(SITEMAP_URL);
  console.log(`\nFound ${urls.length} URLs:`);
  for (const url of urls) console.log(`  ${url}`);

  if (DRY_RUN) {
    console.log("\nDry run — skipping submission.");
    return;
  }

  if (!INDEXNOW_KEY) {
    console.error(
      "\nError: INDEXNOW_KEY is not set.\n" +
      "Get a key at https://www.bing.com/indexnow/getstarted then run:\n" +
      "  INDEXNOW_KEY=your-key bun commands/submit-sitemap.ts\n\n" +
      "For Google, submit your sitemap manually:\n" +
      `  https://search.google.com/search-console/sitemaps?resource_id=sc-domain:${new URL(SITE_URL).hostname}`
    );
    process.exit(1);
  }

  await submitToIndexNow(urls, INDEXNOW_KEY);

  console.log(
    "\nNext step for Google: submit your sitemap manually in Search Console:\n" +
    `  https://search.google.com/search-console/sitemaps?resource_id=sc-domain:${new URL(SITE_URL).hostname}`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
