import { Detail, Icon, Color, ActionPanel, Action, showToast, Toast, List } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface VaultStats {
  totalFiles: number;
  totalFragments: number;
  totalWords: number;
  dailyActivity: Record<string, number>;
}

interface SystemVitals {
  cpu: string;
  mem: string;
}

export default function Command() {
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [vitals, setVitals] = useState<SystemVitals | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchData() {
    try {
      const [sRes, vRes] = await Promise.all([
        fetch("http://localhost:3031/archive/stats"),
        fetch("http://localhost:3031/archive/system/vitals")
      ]);
      setStats(await sRes.json() as VaultStats);
      setVitals(await vRes.json() as SystemVitals);
    } catch (e) {
      showToast({ title: "Signal Lost", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return <Detail isLoading={true} />;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const heatmap = last7Days.map(date => {
     const count = stats?.dailyActivity[date] || 0;
     const dots = "█".repeat(Math.min(10, count));
     const empty = "░".repeat(Math.max(0, 10 - count));
     return `| ${date} | ${dots}${empty} | ${count} jots |`;
  }).join("\n");

  const markdown = `
# 📡 GRAVITY MISSION CONTROL
---

### 📊 Vault Intelligence
- **Sovereign Files:** \`${stats?.totalFiles}\`
- **Total Fragments:** \`${stats?.totalFragments}\`
- **Word Hoard:** \`${(stats?.totalWords || 0).toLocaleString()}\`
- **Archive Density:** \`${((stats?.totalFragments || 0) / (stats?.totalFiles || 1)).toFixed(1)}\` per file

### ⚡ System Pulse
- **CPU Load:** \`${vitals?.cpu || "N/A"}\`
- **Physical Memory:** \`${vitals?.mem || "N/A"}\`
- **Hub Status:** \`ONLINE\` 🟢

### 🗓️ Archival Momentum (Last 7 Days)
| Date | Density Heatmap | Pulse |
| :--- | :--- | :--- |
${heatmap}

---
### 🛠️ Quick Commands
- \`Cmd+D\`: Purge Desktop Clutter
- \`Cmd+S\`: Spotlight Deep Probe
- \`Cmd+G\`: Grep Vault Content
`;

  return (
    <Detail
      markdown={markdown}
      navigationTitle="Gravity Mission Control"
      actions={
        <ActionPanel title="Mission Actions">
          <Action title="Refresh Signal" icon={Icon.RotateClockwise} onAction={fetchData} />
          <Action.OpenInBrowser title="Open Global Analytics" url="http://localhost:3031/archive/stats" />
          <ActionPanel.Section title="System Operations">
             <Action title="Purge Desktop" icon={Icon.Desktop} onAction={async () => {
                await fetch("http://localhost:3031/archive/desktop/organize");
                showToast({ title: "Desktop Purified" });
             }} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
