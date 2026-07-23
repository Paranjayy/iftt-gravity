/**
 * Test harness for the social stats providers. Real URLs from the user's
 * chat. Run with:
 *   bun run raycast-ext/src/social/providers/__test__/providers.spec.ts
 *
 * If a test URL stops working (e.g. platform changed their API), update
 * the expected range or the URL.
 */

import {
  fetchStatsForUrl,
  fetchStatsForUrls,
  formatStatsMarkdown,
  findProvider,
} from "../index";

const TESTS: { label: string; url: string; platform: string }[] = [
  { label: "YouTube video", url: "https://m.youtube.com/watch?v=aGNhUcu54PA", platform: "youtube" },
  { label: "YouTube short", url: "https://www.youtube.com/watch?v=zaiMSQiaZp4", platform: "youtube" },
  { label: "Reddit comment", url: "https://www.reddit.com/r/interesting/comments/1re8r5w/taylor_swift_s_two_private_jets_in_2023_where_did/", platform: "reddit" },
  { label: "Reddit sub", url: "https://www.reddit.com/r/TaylorSwiftJets/", platform: "reddit" },
  { label: "GitHub repo", url: "https://github.com/raycast/extensions", platform: "github" },
  { label: "HN item", url: "https://news.ycombinator.com/item?id=1", platform: "hackernews" },
  { label: "HN top", url: "https://news.ycombinator.com/", platform: "hackernews" },
  { label: "Twitter (no stats)", url: "https://x.com/SwiftJetNextDay/status/2080016812884775168", platform: "twitter" },
  { label: "Instagram (no stats)", url: "https://www.instagram.com/p/abc123", platform: "instagram" },
  { label: "Random site (unknown)", url: "https://example.com/", platform: "other" },
];

async function testProviderMatching() {
  console.log("\n--- PROVIDER MATCHING ---");
  for (const t of TESTS) {
    const p = findProvider(t.url);
    // For Twitter/IG/Instagram, the registry returns no provider but the
    // platform is still recognized (with a "no stats" message)
    const expectedProvider = ["twitter", "instagram"].includes(t.platform) ? null : (t.platform === "other" ? null : t.platform);
    const match = p ? p.platform : "(no provider)";
    const gotProvider = p?.platform || null;
    const ok = gotProvider === expectedProvider;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${t.label.padEnd(25)}  -> ${match}`);
  }
}

async function testFetchOne(t: { label: string; url: string; platform: string }) {
  const t0 = Date.now();
  const r = await fetchStatsForUrl(t.url);
  const ms = Date.now() - t0;
  console.log(`\n  [${t.label}] ${r.platform} (${r.status})  ${ms}ms`);
  console.log(`  url:     ${t.url}`);
  console.log(`  title:   ${r.title.slice(0, 70)}`);
  console.log(`  status:  ${r.status}${r.error ? " — " + r.error : ""}`);
  // Print populated stat fields
  const fields: string[] = [];
  for (const [k, v] of Object.entries(r.stats)) {
    if (v !== undefined && v !== null) {
      const display = Array.isArray(v) ? v.slice(0, 3).join(", ") + (v.length > 3 ? "…" : "") : typeof v === "number" ? v.toLocaleString() : String(v);
      fields.push(`${k}=${display}`);
    }
  }
  if (fields.length) console.log(`  stats:   ${fields.join("  ")}`);
  return r;
}

async function testFetchAll() {
  console.log("\n--- FETCH (one URL at a time) ---");
  const results = [];
  for (const t of TESTS) {
    const r = await testFetchOne(t);
    results.push(r);
  }
  return results;
}

async function testBatchFetch() {
  console.log("\n--- BATCH FETCH (parallel) ---");
  const t0 = Date.now();
  const results = await fetchStatsForUrls(TESTS.map((t) => t.url));
  const ms = Date.now() - t0;
  console.log(`  Fetched ${results.length} URLs in ${ms}ms (${(ms / results.length).toFixed(0)}ms avg)`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const t = TESTS[i];
    console.log(`  ${r.status.padEnd(10)} ${t.label.padEnd(25)} -> ${r.title.slice(0, 50)}`);
  }
  return results;
}

function testFormatMarkdown(results: Awaited<ReturnType<typeof testFetchAll>>) {
  console.log("\n--- MARKDOWN FORMATTING ---");
  for (const r of results) {
    if (r.status === "ok" || r.status === "partial") {
      console.log("\n" + formatStatsMarkdown(r));
    }
  }
}

async function main() {
  console.log("=== Social Stats Provider Test Harness ===");
  await testProviderMatching();
  const results = await testFetchAll();
  await testBatchFetch();
  testFormatMarkdown(results);
  console.log("\n=== ALL TESTS DONE ===");
}

main().catch((e) => {
  console.error("Test run failed:", e);
  process.exit(1);
});
