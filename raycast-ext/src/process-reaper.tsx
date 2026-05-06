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
  const [sortBy, setSortBy] = useState<"cpu" | "mem" | "pid" | "name">("mem");
  const [filter, setFilter] = useState<"all" | "high-cpu" | "high-mem">("all");
  const [grouping, setGrouping] = useState(true);

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

  const getProcessIcon = (p: Process) => {
     if (p.command.includes('.app/')) {
        const appPath = p.command.match(/.*?\.app/)?.[0];
        if (appPath) return { fileIcon: appPath };
     }
     return Icon.Activity;
  };

  const filtered = processes.filter(p => {
     if (filter === "high-cpu") return parseFloat(p.cpu) > 10;
     if (filter === "high-mem") return parseFloat(p.mem) > 5;
     return true;
  });

  const sorted = [...filtered].sort((a, b) => {
     if (sortBy === "cpu") return parseFloat(b.cpu) - parseFloat(a.cpu);
     if (sortBy === "mem") return parseFloat(b.mem) - parseFloat(a.mem);
     if (sortBy === "pid") return parseInt(b.pid) - parseInt(a.pid);
     return a.name.localeCompare(b.name);
  });

  const grouped = grouping ? sorted.reduce((acc, p) => {
     const key = p.name;
     if (!acc[key]) acc[key] = [];
     acc[key].push(p);
     return acc;
  }, {} as Record<string, Process[]>) : null;

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Sovereign Process Audit..." 
      navigationTitle="Process Reaper"
      searchBarAccessory={
        <List.Dropdown tooltip="Sort & Filter" onChange={(v) => {
           if (v === "group-toggle") setGrouping(!grouping);
           else if (v.startsWith("sort:")) setSortBy(v.split(":")[1] as any);
           else setFilter(v as any);
        }} storeValue>
          <List.Dropdown.Section title="Sort Telemetry">
            <List.Dropdown.Item title="Sort by Memory" value="sort:mem" icon={Icon.MemoryChip} />
            <List.Dropdown.Item title="Sort by CPU" value="sort:cpu" icon={Icon.Activity} />
            <List.Dropdown.Item title="Sort by Name" value="sort:name" icon={Icon.Text} />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Forensic Filters">
            <List.Dropdown.Item title="All Processes" value="all" icon={Icon.List} />
            <List.Dropdown.Item title="High CPU (>10%)" value="high-cpu" icon={Icon.ExclamationMark} />
            <List.Dropdown.Item title="High Memory (>5%)" value="high-mem" icon={Icon.ExclamationMark} />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="View Mode">
            <List.Dropdown.Item title={grouping ? "Disable App Grouping" : "Enable App Grouping"} value="group-toggle" icon={grouping ? Icon.EyeDisabled : Icon.Eye} />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {grouped ? Object.entries(grouped).map(([name, group]) => {
         return (
            <List.Section key={name} title={`${name} (${group.length} instances)`}>
               {group.map(p => (
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
                           <Action title="Kill Process" icon={Icon.XMarkCircle} style={Action.Style.Destructive} onAction={() => killProcess(p.pid, p.name)} />
                           <Action title="Force Kill All" icon={Icon.Trash} shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }} style={Action.Style.Destructive} onAction={async () => {
                              if (await ConfirmAlert({ title: "Purge Entire App?", message: `Terminate all ${group.length} instances of ${name}?` })) {
                                 for (const proc of group) {
                                    await fetch("http://localhost:3031/archive/system/kill", {
                                       method: "POST",
                                       body: JSON.stringify({ pid: proc.pid }),
                                       headers: { "Content-Type": "application/json" }
                                    });
                                 }
                                 showToast({ title: "App Purged" });
                                 load();
                              }
                           }} />
                        </ActionPanel>
                     }
                  />
               ))}
            </List.Section>
         );
      }) : sorted.map((p) => (
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
              <Action title="Kill Process" icon={Icon.XMarkCircle} style={Action.Style.Destructive} onAction={() => killProcess(p.pid, p.name)} />
              <Action title="Copy Details" icon={Icon.CopyClipboard} onAction={() => Clipboard.copy(`${p.name} (PID: ${p.pid}) CPU: ${p.cpu}% MEM: ${p.memAbs}`)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
