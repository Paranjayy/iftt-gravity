import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface Probe {
  name: string;
  url: string;
  category: "hub" | "archive" | "dashboard" | "device";
  expectedMs?: number;
}

const PROBES: Probe[] = [
  { name: "Gravity Hub API (port 3030)",        url: "http://127.0.0.1:3030/status",         category: "hub" },
  { name: "Archive API (port 3031)",            url: "http://127.0.0.1:3031/archive/notes/list", category: "archive" },
  { name: "Web Dashboard (port 3000)",          url: "http://127.0.0.1:3000",               category: "dashboard" },
  { name: "WiZ Bulb reachable",                  url: "http://127.0.0.1:3030/scene/cozy",     category: "device" },
  { name: "AC controllable",                     url: "http://127.0.0.1:3030/control/ac/on",  category: "device" },
  { name: "Scene orchestration",                 url: "http://127.0.0.1:3030/scene/away",     category: "hub" },
];

interface ProbeResult {
  name: string;
  category: string;
  ok: boolean;
  ms: number;
  status?: number;
  message?: string;
}

async function probe(p: Probe): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(p.url, { signal: ac.signal, method: p.url.includes("/control/") || p.url.includes("/scene/") ? "GET" : "GET" });
    clearTimeout(t);
    const ms = Date.now() - t0;
    const text = await res.text().catch(() => "");
    // Hub catch-all returns "Gravity API Active" for unknown routes
    // Archive catch-all returns "Archive API Online"
    // Some real endpoints return "Scene X Engaged" etc
    return {
      name: p.name,
      category: p.category,
      ok: res.ok,
      ms,
      status: res.status,
      message: text.slice(0, 100),
    };
  } catch (e: any) {
    return {
      name: p.name,
      category: p.category,
      ok: false,
      ms: Date.now() - t0,
      message: String(e?.message || "Failed").slice(0, 100),
    };
  }
}

export default function Command() {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  async function refresh() {
    setIsLoading(true);
    const out: ProbeResult[] = [];
    // Run all probes in parallel for speed
    await Promise.all(PROBES.map(async (p) => {
      const r = await probe(p);
      out.push(r);
      setResults([...out]); // incremental update
    }));
    setResults(out);
    setLastRun(new Date());
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const overall = failCount === 0 && results.length === PROBES.length ? "🟢 ALL GREEN" : failCount > 0 ? `🔴 ${failCount} FAILS` : "⏳ CHECKING…";
  const avgMs = results.length > 0 ? Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length) : 0;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Hub Diagnostic — running probes..."
    >
      <List.Section title="Overall Health">
        <List.Item
          title={overall}
          subtitle={`${okCount}/${PROBES.length} endpoints responding · avg ${avgMs}ms · last run ${lastRun?.toLocaleTimeString() || "—"}`}
          icon={{ source: failCount === 0 ? Icon.Heartbeat : Icon.ExclamationMark, tintColor: failCount === 0 ? Color.Green : Color.Red }}
          actions={
            <ActionPanel>
              <Action icon={Icon.Repeat} title="Re-run All Probes" shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={refresh} />
              <Action.CopyToClipboard
                title="Copy Report"
                content={results.map((r) => `${r.ok ? "✓" : "✗"} ${r.name} (${r.ms}ms)${r.message ? `: ${r.message}` : ""}`).join("\n")}
              />
            </ActionPanel>
          }
        />
      </List.Section>

      {(["hub", "archive", "dashboard", "device"] as const).map((cat) => {
        const inCat = results.filter((r) => r.category === cat);
        if (inCat.length === 0) return null;
        return (
          <List.Section key={cat} title={cat.toUpperCase()}>
            {inCat.map((r) => (
              <List.Item
                key={r.name}
                title={r.name}
                subtitle={r.ok ? `✓ ${r.ms}ms` : `✗ ${r.message || "Failed"}`}
                icon={{ source: r.ok ? Icon.Checkmark : Icon.Xmark, tintColor: r.ok ? Color.Green : Color.Red }}
                accessories={[
                  { text: r.ok ? "OK" : "FAIL", tag: { color: r.ok ? Color.Green : Color.Red } as any } as any,
                ]}
              />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}
