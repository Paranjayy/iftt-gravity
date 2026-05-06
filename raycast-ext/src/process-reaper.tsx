import { List, ActionPanel, Action, Icon, Color, showToast, Toast, ConfirmAlert, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface Process {
  pid: string;
  name: string;
  cpu: string;
  mem: string;
  memAbs: string;
  command: string;
}

export default function Command() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:3031/archive/system/processes");
      const data = await res.json() as Process[];
      setProcesses(data);
    } catch (e) {
      showToast({ title: "Reaper Offline", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  async function killProcess(pid: string, name: string) {
    if (await ConfirmAlert({ title: "Sovereign Execution?", message: `Terminate ${name} (PID: ${pid})?` })) {
      const res = await fetch("http://localhost:3031/archive/system/kill", {
        method: "POST",
        body: JSON.stringify({ pid }),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        showToast({ title: "Process Purged", style: Toast.Style.Success });
        load();
      } else {
        showToast({ title: "Execution Failed", style: Toast.Style.Failure });
      }
    }
  }

  const copySummary = () => {
     let summary = `### 💀 System Process Report\n\n| PID | Name | CPU % | MEM |\n| :--- | :--- | :--- | :--- |\n`;
     processes.slice(0, 10).forEach(p => {
        summary += `| ${p.pid} | ${p.name} | ${p.cpu} | ${p.memAbs} |\n`;
     });
     Clipboard.copy(summary);
     showToast({ title: "Death List Copied", message: "Top 10 heavy processes hoarded." });
  };

  const getProcessIcon = (p: Process) => {
     if (p.command.includes('.app/')) {
        const appPath = p.command.match(/.*?\.app/)?.[0];
        if (appPath) return { fileIcon: appPath };
     }
     return Icon.Activity;
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search heavy processes..." navigationTitle="Process Reaper">
      {processes.map((p) => (
        <List.Item
          key={p.pid}
          title={p.name}
          subtitle={`PID: ${p.pid}`}
          icon={getProcessIcon(p)}
          accessories={[
            { text: `${p.cpu}% CPU`, color: parseFloat(p.cpu) > 50 ? Color.Red : Color.SecondaryText },
            { text: `${p.memAbs} (${p.mem}%)`, color: parseFloat(p.mem) > 10 ? Color.Orange : Color.SecondaryText }
          ]}
          actions={
            <ActionPanel title={p.name}>
              <Action title="Sovereign Kill" icon={Icon.XMarkCircle} style={Action.Style.Destructive} shortcut={{ modifiers: ["cmd"], key: "delete" }} onAction={() => killProcess(p.pid, p.name)} />
              <Action title="Copy AI Summary" icon={Icon.CopyClipboard} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} onAction={copySummary} />
              <Action.CopyToClipboard title="Copy PID" content={p.pid} />
              <Action.CopyToClipboard title="Copy Full Command" content={p.command} />
              <Action title="Force Refresh" icon={Icon.RotateClockwise} onAction={load} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
