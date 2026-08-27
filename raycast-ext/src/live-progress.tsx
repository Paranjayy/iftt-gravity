import { Detail } from "@raycast/api";
import { useState, useEffect, useRef } from "react";

function fmtDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

export function LiveProgress({
  title,
  icon,
  task,
}: {
  title: string;
  icon?: string;
  task: (onProgress: (done: number, total: number, name: string) => void) => Promise<string>;
}) {
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState("");
  const [finished, setFinished] = useState<string | null>(null);
  const log = useRef<string[]>([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    task((d, t, n) => {
      if (cancelled) return;
      setDone(d);
      setTotal(t);
      setCurrent(n);
      if (n && (log.current.length === 0 || log.current[log.current.length - 1] !== n)) {
        log.current.push(n);
        if (log.current.length > 8) log.current.shift();
      }
    })
      .then((md) => !cancelled && setFinished(md))
      .catch((e) => !cancelled && setFinished(`# Error\n\n${(e as Error).message}`));
    return () => {
      cancelled = true;
    };
  }, []);

  if (finished) return <Detail markdown={finished} />;

  const elapsed = Date.now() - startRef.current;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const remaining = total - done;
  const rate = done > 0 ? elapsed / done : 0;
  const eta = remaining > 0 ? rate * remaining : 0;
  const speed = done > 0 ? (done / (elapsed / 1000)).toFixed(1) : "—";

  // Progress bar — 24 chars wide
  const barW = 24;
  const filled = Math.round((pct / 100) * barW);
  const bar = "━".repeat(filled) + "╶".repeat(barW - filled);

  // Recent log
  const recentLog = log.current.length > 1
    ? `\n\n**Recent**\n${log.current.slice(-5).map((f) => `• \`${f}\``).join("\n")}`
    : "";

  const md = `# ${icon ?? "⚡"} ${title}

\`${bar}\` **${pct}%**

| | |
|---|---|
| **Progress** | ${done.toLocaleString()} / ${total.toLocaleString()} |
| **Speed** | ${speed} items/sec |
| **Elapsed** | ${fmtDuration(elapsed)} |
| **ETA** | ${eta > 0 ? `~${fmtDuration(eta)}` : "almost done…"} |

**Now:** \`${current}\`
${recentLog}`;

  return <Detail markdown={md} />;
}
