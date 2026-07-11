/**
 * config.ts — single source of truth for runtime URLs and preferences.
 *
 * All public-store-prep work goes through this file. Existing commands
 * can keep using hardcoded URLs until the Phase E sweep; new code
 * should read from here.
 *
 * Default values match the local user's current setup, so the local
 * user sees NO behavior change.
 */

import { getPreferenceValues } from "@raycast/api";

/**
 * The Hub URL — where the bot (port 3030) lives.
 * Default: http://127.0.0.1:3030 (matches the local iftt setup)
 *
 * Public users set this to their own hub URL in Raycast preferences.
 * Empty string falls back to the default.
 */
export function getHubUrl(): string {
  try {
    const prefs = getPreferenceValues<{ hubUrl?: string }>();
    const url = (prefs.hubUrl || "").trim();
    if (!url) return DEFAULT_HUB_URL;
    // Strip trailing slash for consistent path concatenation
    return url.replace(/\/+$/, "");
  } catch {
    return DEFAULT_HUB_URL;
  }
}

/**
 * The Archive URL — where the archive service (port 3031) lives.
 * Default: http://127.0.0.1:3031 (matches the local iftt setup)
 */
export function getArchiveUrl(): string {
  try {
    const prefs = getPreferenceValues<{ archiveUrl?: string }>();
    const url = (prefs.archiveUrl || "").trim();
    if (!url) return DEFAULT_ARCHIVE_URL;
    return url.replace(/\/+$/, "");
  } catch {
    return DEFAULT_ARCHIVE_URL;
  }
}

/**
 * The Next.js dashboard URL — for the web UI (port 3000).
 * Default: http://127.0.0.1:3000
 */
export function getDashboardUrl(): string {
  try {
    const prefs = getPreferenceValues<{ dashboardUrl?: string }>();
    const url = (prefs.dashboardUrl || "").trim();
    if (!url) return DEFAULT_DASHBOARD_URL;
    return url.replace(/\/+$/, "");
  } catch {
    return DEFAULT_DASHBOARD_URL;
  }
}

/**
 * Convenience: build a hub URL with a path appended.
 * Strips leading slashes from the path so callers can pass either form.
 */
export function hubUrl(path: string): string {
  return `${getHubUrl()}/${path.replace(/^\/+/, "")}`;
}

export function archiveUrl(path: string): string {
  return `${getArchiveUrl()}/${path.replace(/^\/+/, "")}`;
}

export function dashboardUrl(path: string = ""): string {
  return `${getDashboardUrl()}${path ? "/" + path.replace(/^\/+/, "") : ""}`;
}

// Default URLs — match the current local iftt setup. Don't change these
// without coordinating with the local user; they're the reason existing
// commands work without any preferences set.
export const DEFAULT_HUB_URL = "http://127.0.0.1:3030";
export const DEFAULT_ARCHIVE_URL = "http://127.0.0.1:3031";
export const DEFAULT_DASHBOARD_URL = "http://127.0.0.1:3000";
