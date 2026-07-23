/**
 * GitHub stats provider.
 *
 * Uses GitHub's public REST API. For repos, the endpoint is
 * `https://api.github.com/repos/{owner}/{name}` and returns
 * stargazers_count, forks_count, open_issues_count, language, description, topics.
 *
 * No auth needed for public repos. Rate limit: 60 requests/hour per IP
 * for unauthenticated, plenty for personal use.
 */

import { Provider, RichResult, ProviderOptions, DEFAULT_UA } from "./types";

const GITHUB_HOSTS = ["github.com", "www.github.com"];

function isGitHub(url: string): boolean {
  try {
    const u = new URL(url);
    return GITHUB_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function extractRepoPath(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export const githubProvider: Provider = {
  name: "GitHub",
  platform: "github",
  match: isGitHub,
  async fetchStats(url: string, opts: ProviderOptions = {}): Promise<RichResult> {
    const t0 = Date.now();
    const timeoutMs = opts.timeoutMs ?? 8000;
    const ua = opts.userAgent ?? DEFAULT_UA;
    const path = extractRepoPath(url);
    if (!path) {
      // Not a repo URL — could be a gist, user profile, or org page.
      return {
        url,
        title: "(not a repo URL)",
        platform: "github",
        status: "partial",
        stats: {},
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: "Only /owner/repo URLs are supported",
      };
    }
    const apiUrl = `https://api.github.com/repos/${path.owner}/${path.repo}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(apiUrl, {
        signal: ac.signal,
        headers: {
          "User-Agent": ua,
          Accept: "application/vnd.github+json",
        },
      });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          url,
          title: `${path.owner}/${path.repo}`,
          platform: "github",
          status: "no-stats",
          stats: {},
          fetchedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          error: `HTTP ${res.status} ${res.statusText}`,
        };
      }
      const data = (await res.json()) as any;
      const stats = {
        author: data.owner?.login as string | undefined,
        authorUrl: data.owner?.html_url as string | undefined,
        stars: typeof data.stargazers_count === "number" ? data.stargazers_count : undefined,
        forks: typeof data.forks_count === "number" ? data.forks_count : undefined,
        openIssues: typeof data.open_issues_count === "number" ? data.open_issues_count : undefined,
        language: data.language as string | undefined,
        description: data.description as string | undefined,
        topics: Array.isArray(data.topics) ? data.topics : undefined,
        createdAt: data.created_at as string | undefined,
      };
      return {
        url,
        title: data.full_name || `${path.owner}/${path.repo}`,
        platform: "github",
        status: "ok",
        stats,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
      };
    } catch (e: any) {
      clearTimeout(timer);
      return {
        url,
        title: `${path.owner}/${path.repo}`,
        platform: "github",
        status: "no-stats",
        stats: {},
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: String(e?.message || e),
      };
    }
  },
};
