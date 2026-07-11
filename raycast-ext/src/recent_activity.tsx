import { Detail, ActionPanel, Action, Icon } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import HubOfflineDetail from "./hub_offline";

interface LogLine {
  ts: string;
  line: string;
}

const REPO = "/Users/paranjay/Developer/iftt";
const LOG_PATHS = [
  `${REPO}/house_log.md`,
  `${REPO}/gravity-archive/clips.json`,
];

export default function Command() {
  const [log, setLog] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    setIsLoading(true);
    try {
      // Read the Next.js status endpoint which already includes logs
      const res = await fetch("http://127.0.0.1:3000/api/gravity/status", { cache: "no-store" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLog("");
      } else {
        const logs = data.logs || [];
        setLog(formatLog(logs));
        setError(null);
      }
    } catch (e) {
      setError("Hub Offline — could not reach Next.js dashboard on :3000");
      setLog("");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return <HubOfflineDetail context="recent activity (Next.js dashboard on :3000)" onRetry={refresh} />;
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={`# 🪐 Recent Hub Activity\n\n\`\`\`\n${log || "(no activity)"}\n\`\`\`\n\n_Last refresh: ${new Date().toLocaleTimeString()}_`}
      actions={
        <ActionPanel title="Activity">
          <Action icon={Icon.Repeat} title="Force Refresh" shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={refresh} />
          <Action.CopyToClipboard title="Copy Log" content={log} shortcut={{ modifiers: ["cmd"], key: "c" }} />
          <Action.OpenInBrowser title="Open Web Dashboard" url="http://127.0.0.1:3000" />
        </ActionPanel>
      }
    />
  );
}

function formatLog(lines: any[]): string {
  if (!Array.isArray(lines)) return "";
  return lines
    .map((entry) => {
      if (typeof entry === "string") return entry;
      // Reverse chronological (newest first)
      return Object.values(entry).join(" ");
    })
    .filter((l) => l && l.length > 0)
    .join("\n");
}
