/**
 * StackOverflow stats provider.
 *
 * Uses the public Stack Exchange API.
 *   https://api.stackexchange.com/2.3/questions/{id}?site=stackoverflow
 *
 * Returns: title, score, answer_count, view_count, is_answered, tags,
 * accepted_answer_id. The /questions/ endpoint is filterable to return
 * exactly the fields we want.
 */

import { Provider, RichResult, ProviderOptions, DEFAULT_UA } from "./types";

const SO_HOSTS = ["stackoverflow.com", "www.stackoverflow.com"];

function isSO(url: string): boolean {
  try {
    const u = new URL(url);
    return SO_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function extractQuestionId(url: string): string | null {
  try {
    const u = new URL(url);
    // /questions/12345/...  OR  /q/12345
    let m = u.pathname.match(/\/questions\/(\d+)/);
    if (m) return m[1];
    m = u.pathname.match(/\/q\/(\d+)/);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

export const stackoverflowProvider: Provider = {
  name: "StackOverflow",
  platform: "stackoverflow",
  match: isSO,
  async fetchStats(url: string, opts: ProviderOptions = {}): Promise<RichResult> {
    const t0 = Date.now();
    const timeoutMs = opts.timeoutMs ?? 8000;
    const ua = opts.userAgent ?? DEFAULT_UA;
    const id = extractQuestionId(url);
    if (!id) {
      return {
        url,
        title: "(not a question URL)",
        platform: "stackoverflow",
        status: "no-stats",
        stats: {},
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: "Expected /questions/N or /q/N",
      };
    }
    const apiUrl = `https://api.stackexchange.com/2.3/questions/${id}?site=stackoverflow&filter=default`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(apiUrl, { signal: ac.signal, headers: { "User-Agent": ua } });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          url,
          title: `(question ${id})`,
          platform: "stackoverflow",
          status: "no-stats",
          stats: {},
          fetchedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          error: `HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as { items?: any[] };
      const q = data.items?.[0];
      if (!q) {
        return {
          url,
          title: `(question ${id})`,
          platform: "stackoverflow",
          status: "no-stats",
          stats: {},
          fetchedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
          error: "Question not found",
        };
      }
      const owner = q.owner?.display_name || q.owner?.user_id?.toString();
      const stats = {
        author: typeof owner === "string" ? owner : undefined,
        authorUrl: q.owner?.link || undefined,
        score: typeof q.score === "number" ? q.score : undefined,
        answers: typeof q.answer_count === "number" ? q.answer_count : undefined,
        commentCount: typeof q.comment_count === "number" ? q.comment_count : undefined,
        views: typeof q.view_count === "number" ? q.view_count : undefined,
        isAnswered: q.is_answered === true,
        acceptedAnswerId: typeof q.accepted_answer_id === "number" ? q.accepted_answer_id : undefined,
        tags: Array.isArray(q.tags) ? q.tags : undefined,
        createdAt: q.creation_date ? new Date(q.creation_date * 1000).toISOString() : undefined,
      };
      return {
        url,
        title: q.title || `(question ${id})`,
        platform: "stackoverflow",
        status: "ok",
        stats,
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
      };
    } catch (e: any) {
      clearTimeout(timer);
      return {
        url,
        title: `(question ${id})`,
        platform: "stackoverflow",
        status: "no-stats",
        stats: {},
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: String(e?.message || e),
      };
    }
  },
};
