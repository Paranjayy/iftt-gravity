import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

export default function Command() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch("http://localhost:3030/logs");
      const text = await res.text();
      setLogs(text.split("\n").filter(l => l.trim()).reverse());
    } catch (e) {
      setLogs(["Hub Offline. Start ./hub.sh"]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const L: any = List;
  const LI: any = List.Item;
  const AP: any = ActionPanel;
  const A: any = Action;

  return (
    <L isLoading={isLoading} searchBarPlaceholder="Search house chronicle...">
      {logs.map((log: string, i: number) => (
        <LI
          key={i}
          icon={Icon.Calendar}
          title={log}
          actions={
            <AP>
              <A title="Refresh Logs" onAction={refresh} />
            </AP>
          }
        />
      ))}
    </L>
  );
}
