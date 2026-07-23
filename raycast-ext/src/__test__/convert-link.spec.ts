/**
 * Test harness for the URL converter title extraction.
 * Runs the same logic the extension uses, but in Node so I can verify
 * behavior without opening Raycast.
 *
 * Run: bun run raycast-ext/src/__test__/convert-link.spec.ts
 *
 * Mirrors the logic in src/convert_link.tsx. If you change the converter,
 * update this file too.
 */

import fetch from "node-fetch";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const UA_HEADERS = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" };

const BLOCKED = [
  "please wait", "just a moment", "verifying", "verification",
  "cloudflare", "attention required", "are you human",
  "checking your browser", "redirecting",
];
const isBotBlock = (title: string) =>
  BLOCKED.some((b) => title.toLowerCase().includes(b));

const clean = (raw: string) =>
  raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+[|·•\-–—]\s+[A-Za-z0-9._-]+\s*$/, "")
    .trim()
    .slice(0, 200);

const fallback = (url: string) => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    const meaningful = parts
      .filter(
        (p) =>
          !/^\d+$/.test(p) &&
          !/^[a-f0-9]{6,}$/i.test(p) &&
          !/^\d/.test(p) &&
          (p.length >= 4 && /[aeiouy ]/i.test(p)),
      )
      .map((p) => p.replace(/\.\w+$/, ""))
      .map((p) => p.replace(/[-_]/g, " "))
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    return meaningful.length === 0 ? host : meaningful.slice(0, 3).join(" · ");
  } catch {
    return url;
  }
};

interface OembedProvider {
  name: string;
  match: (host: string, path: string) => boolean;
  build: (url: string) => string;
  parse: (json: any) => string | null;
}

const OEMBED: OembedProvider[] = [
  {
    name: "YouTube",
    match: (h) => /(^|\.)youtube\.com$/.test(h) || /^youtu\.be$/.test(h),
    build: (u) => `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
    parse: (j) => (j && typeof j.title === "string" ? j.title : null),
  },
  {
    name: "Twitter/X",
    match: (h) => /(^|\.)twitter\.com$/.test(h) || /(^|\.)x\.com$/.test(h),
    build: (u) => `https://publish.twitter.com/oembed?url=${encodeURIComponent(u)}`,
    parse: (j) => {
      if (!j || typeof j.author_name !== "string") return null;
      const html: string = j.html || "";
      const stripped = html
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const tweet = stripped.length > 200 ? stripped.slice(0, 197) + "..." : stripped;
      return tweet ? `${j.author_name}: ${tweet}` : j.author_name;
    },
  },
  {
    name: "Vimeo",
    match: (h) => /(^|\.)vimeo\.com$/.test(h),
    build: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
    parse: (j) => (j && typeof j.title === "string" ? j.title : null),
  },
  {
    name: "SoundCloud",
    match: (h) => /(^|\.)soundcloud\.com$/.test(h),
    build: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
    parse: (j) => (j && typeof j.title === "string" ? j.title : null),
  },
  {
    name: "Spotify",
    match: (h) => /(^|\.)spotify\.com$/.test(h) || /(^|\.)spotify\.link$/.test(h),
    build: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
    parse: (j) => (j && typeof j.title === "string" ? j.title : null),
  },
];

const findProvider = (url: string) => {
  try {
    const u = new URL(url);
    return OEMBED.find((p) => p.match(u.hostname, u.pathname)) || null;
  } catch {
    return null;
  }
};

async function tryOembed(url: string, timeoutMs = 6000) {
  const p = findProvider(url);
  if (!p) return null;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(p.build(url), { signal: ac.signal, headers: { "User-Agent": UA } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j: any = await res.json();
    const title = p.parse(j);
    if (title && !isBotBlock(title)) return { title: clean(title), site: p.name };
    return null;
  } catch {
    return null;
  }
}

interface TitleResult {
  url: string;
  title: string;
  source: "oembed" | "og" | "twitter" | "title" | "domain" | "url";
  sourceSite?: string;
  ms: number;
}

async function fetchTitle(url: string, timeoutMs = 8000): Promise<TitleResult> {
  const t0 = Date.now();
  const oe = await tryOembed(url, 6000);
  if (oe) return { url, title: oe.title, source: "oembed", sourceSite: oe.site, ms: Date.now() - t0 };
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(url, { headers: UA_HEADERS, signal: ac.signal, redirect: "follow" });
    clearTimeout(timer);
    const html = await res.text();
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (og?.[1] && !isBotBlock(og[1])) return { url, title: clean(og[1]), source: "og", ms: Date.now() - t0 };
    const tw = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
    if (tw?.[1] && !isBotBlock(tw[1])) return { url, title: clean(tw[1]), source: "twitter", ms: Date.now() - t0 };
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t?.[1] && !isBotBlock(t[1])) return { url, title: clean(t[1]), source: "title", ms: Date.now() - t0 };
    return { url, title: fallback(url), source: "domain", ms: Date.now() - t0 };
  } catch {
    return { url, title: fallback(url), source: "url", ms: Date.now() - t0 };
  }
}

const URL_RE = /https?:\/\/[^\s<>"')]+/g;
const extractUrls = (text: string) => {
  const matches = text.match(URL_RE) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of matches) {
    const clean = u.replace(/[.,;:!?)]+$/, "");
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
};

// --- Test cases (URLs from the user's chat) ---

const TEST_URLS = [
  "https://www.reddit.com/r/interesting/comments/1re8r5w/taylor_swift_s_two_private_jets_in_2023_where_did/",
  "https://www.reddit.com/r/TaylorSwiftJets/",
  "https://m.youtube.com/watch?v=aGNhUcu54PA",
  "https://www.youtube.com/watch?v=zaiMSQiaZp4",
  "https://x.com/SwiftJetNextDay/status/2080016812884775168?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Etweet",
  "https://jettly.com/post/jet-taylor-swift",
  "https://www.celebplanes.com/",
  "https://www.quora.com/Who-is-a-better-speaker-Sadhguru-or-Shashi-tharoor",
  "https://github.com/raycast/extensions",
  "https://share.google/aimode/UuR854xaRVO8caFDM",
  "https://m.youtube.com/watch?v=Rl9SmJrtsNU",
];

// --- Test the URL extraction regex ---

function testUrlExtraction() {
  console.log("\n--- URL EXTRACTION ---");
  const block = `here are some links
  1. https://example.com
  2. https://reddit.com/r/foo, with a comma after
  3. https://twitter.com/x
  end`;
  const urls = extractUrls(block);
  console.log("extracted:", urls);
  if (urls.length !== 3) {
    console.log("FAIL: expected 3 URLs, got", urls.length);
    process.exit(1);
  }
  if (urls[1] !== "https://reddit.com/r/foo") {
    console.log("FAIL: expected trailing comma to be stripped");
    process.exit(1);
  }
  console.log("PASS");
}

// --- Test the title fetching ---

async function testTitles() {
  console.log("\n--- TITLE FETCHING ---");
  const results: TitleResult[] = [];
  for (const url of TEST_URLS) {
    const r = await fetchTitle(url);
    results.push(r);
    const site = r.sourceSite ? ` [${r.sourceSite}]` : "";
    const display = r.title.length > 60 ? r.title.slice(0, 57) + "..." : r.title;
    console.log(`[${r.source.padEnd(7)}]${site.padEnd(12)} ${String(r.ms).padStart(5)}ms  ${display}`);
    console.log(`           ${url}`);
  }
  return results;
}

// --- Test bot-block detection ---

function testBotBlock() {
  console.log("\n--- BOT-BLOCK DETECTION ---");
  const cases: [string, boolean][] = [
    ["Reddit - Please wait for verification", true],
    ["Just a moment...", true],
    ["Verifying you are human", true],
    ["Cloudflare Ray ID: 12345", true],
    ["Taylor Swift's Two Private Jets in 2023", false],
    ["GitHub - raycast/extensions", false],
    ["", false],
  ];
  for (const [title, expected] of cases) {
    const got = isBotBlock(title);
    const mark = got === expected ? "PASS" : "FAIL";
    console.log(`  ${mark}  isBotBlock(${JSON.stringify(title.slice(0, 40))}) = ${got} (expected ${expected})`);
    if (got !== expected) process.exit(1);
  }
}

// --- Test the fallback title ---

function testFallback() {
  console.log("\n--- FALLBACK TITLES ---");
  const cases: [string, string][] = [
    ["https://www.quora.com/Who-is-a-better-speaker-Sadhguru-or-Shashi-tharoor", "Who is a better speaker Sadhguru or Shashi tharoor"],
    ["https://reddit.com/r/interesting/comments/1re8r5w", "Interesting · Comments"],
    ["https://github.com/raycast/extensions", "Raycast · Extensions"],
    ["https://example.com", "example.com"],
    ["https://www.youtube.com/watch?v=abc123", "Watch"],
    ["https://reddit.com/r/interesting/comments/1re8r5w/some_title", "Interesting · Comments · Some title"],
  ];
  for (const [url, expected] of cases) {
    const got = fallback(url);
    const mark = got === expected ? "PASS" : "FAIL";
    console.log(`  ${mark}  fallback(${url.slice(0, 50)}) = "${got}"`);
    if (got !== expected) {
      console.log(`        expected: "${expected}"`);
      process.exit(1);
    }
  }
}

// --- Test the format output ---

function testFormatOutput() {
  console.log("\n--- OUTPUT FORMATTING ---");
  const results: TitleResult[] = [
    { url: "https://a.com", title: "A", source: "og", ms: 100 },
    { url: "https://b.com", title: "B", source: "title", ms: 200 },
  ];
  const fmt = (format: string) => {
    return results
      .map((r, i) => {
        const link = `[${r.title}](${r.url})`;
        switch (format) {
          case "numbered": return `${i + 1}. ${link}`;
          case "bullet": return `- ${link}`;
          case "bare": return link;
          default: return link;
        }
      })
      .join("\n");
  };
  console.log("numbered:");
  console.log(fmt("numbered"));
  console.log("\nbullet:");
  console.log(fmt("bullet"));
  console.log("\nbare:");
  console.log(fmt("bare"));
  if (fmt("numbered") !== "1. [A](https://a.com)\n2. [B](https://b.com)") {
    console.log("FAIL: numbered format wrong");
    process.exit(1);
  }
  console.log("\nPASS");
}

// --- Main ---

(async () => {
  console.log("=== URL Converter Test Harness ===");
  testBotBlock();
  testFallback();
  testUrlExtraction();
  testFormatOutput();
  await testTitles();
  console.log("\n=== ALL TESTS PASSED ===");
})().catch((e) => {
  console.error("Test run failed:", e);
  process.exit(1);
});
