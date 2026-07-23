/**
 * Reddit stats provider.
 *
 * Reddit's public JSON API is the easiest of the bunch. Just append
 * `.json` to any reddit URL and you get the post data:
 *   - title, subreddit, author, score, upvote_ratio, num_comments
 *   - created_utc, permalink, is_self, over_18 (NSFW flag)
 *
 * No auth, no rate limit for low-volume use, returns JSON.
 * Caveat: some subreddits are private/quarantined and return 403.
 *
 * As of 2024, Reddit blocks ALL unauthenticated API requests with 403.
 * The HTML page is also a JS-only SPA (bot-blocked). This provider will
 * return `no-stats` for nearly everything. We keep the code so it works
 * IF Reddit ever re-enables public API access, and so other clients can
 * use it if they have their own auth.
 */

import { Provider, RichResult, ProviderOptions, DEFAULT_UA } from "./types";

const REDDIT_DOMAINS = [
  "reddit.com",
  "www.reddit.com",
  "old.reddit.com",
  "np.reddit.com",
  "i.reddit.com",
];

function isReddit(url: string): boolean {
  try {
    const u = new URL(url);
    return REDDIT_DOMAINS.includes(u.hostname);
  } catch {
    return false;
  }
}

function jsonUrl(original: string): string | null {
  try {
    const u = new URL(original);
    if (u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1) + ".json";
    } else {
      u.pathname = u.pathname + ".json";
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** Extract post path parts from a Reddit URL. */
function extractPathParts(url: string): { subreddit?: string; postId?: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/r\/([^/]+)(?:\/comments\/([^/]+))?/);
    if (!m) return null;
    return { subreddit: m[1], postId: m[2] };
  } catch {
    return null;
  }
}

export const redditProvider: Provider = {
  name: "Reddit",
  platform: "reddit",
  match: isReddit,
  async fetchStats(url: string, opts: ProviderOptions = {}): Promise<RichResult> {
    const t0 = Date.now();
    const timeoutMs = opts.timeoutMs ?? 8000;
    const ua = opts.userAgent ?? DEFAULT_UA;
    const parts = extractPathParts(url);
    if (!parts?.postId) {
      // No post ID — could be a subreddit front page or a user profile.
      // We could try a subreddit listing, but it requires auth too.
      return {
        url,
        title: `r/${parts?.subreddit ?? "(unknown)"}`,
        platform: "reddit",
        status: "no-stats",
        stats: { subreddit: parts?.subreddit },
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: "No post id in URL; subreddit listings require auth",
      };
    }
    const apiUrl = jsonUrl(url);
    if (!apiUrl) {
      return {
        url,
        title: `(r/${parts.subreddit})`,
        platform: "reddit",
        status: "no-stats",
        stats: {},
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: "Could not build JSON API URL",
      };
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(apiUrl, {
        signal: ac.signal,
        headers: {
          "User-Agent": ua,
          Accept: "application/json",
        },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!res.ok) {
        // As of 2024, all unauthenticated Reddit API calls return 403.
        // The HTML page is a JS-only SPA. No public data is available.
        return {
          url,
          title: `(r/${parts.subreddit})`,
          platform: "reddit",
          status: "no-stats",
          stats: { subreddit: parts.subreddit },
          fetchedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          error: `Reddit requires auth for stats (HTTP ${res.status}). Title still extracted from URL slug.`,
        };
      }
      const data = (await res.json()) as any[];
      const post = Array.isArray(data)
        ? data[0]?.data?.children?.[0]?.data
        : data?.data?.children?.[0]?.data;
      if (!post) {
        return {
          url,
          title: `(r/${parts.subreddit})`,
          platform: "reddit",
          status: "no-stats",
          stats: { subreddit: parts.subreddit },
          fetchedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          error: "JSON did not contain a post",
        };
      }
      const stats = {
        author: post.author as string | undefined,
        authorUrl: post.author ? `https://www.reddit.com/u/${post.author}/` : undefined,
        subreddit: post.subreddit as string | undefined,
        score: typeof post.score === "number" ? post.score : undefined,
        upvoteRatio: typeof post.upvote_ratio === "number" ? post.upvote_ratio : undefined,
        commentCount: typeof post.num_comments === "number" ? post.num_comments : undefined,
        createdAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : undefined,
        flair: post.link_flair_text as string | undefined,
        nsfw: post.over_18 === true,
      };
      return {
        url,
        title: post.title || `(r/${parts.subreddit})`,
        platform: "reddit",
        status: "ok",
        stats,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
      };
    } catch (e: any) {
      clearTimeout(timer);
      return {
        url,
        title: `(r/${parts.subreddit})`,
        platform: "reddit",
        status: "no-stats",
        stats: { subreddit: parts.subreddit },
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: String(e?.message || e),
      };
    }
  },
};
