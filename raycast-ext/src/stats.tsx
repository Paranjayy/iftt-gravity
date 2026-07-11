import { Detail, Icon, Color, ActionPanel, Action, showToast, Toast, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface HubState {
  online: boolean;
  uptime: number;
  autoAc?: boolean;
  autoLight?: boolean;
  mediaAura?: boolean;
  ac_duration?: string;
  light_duration?: string;
  units?: string;
  estimatedPgBill?: number;
  weather?: { temp: number; humidity: number; condition: string; aqi: number; sunrise: string; sunset: string };
  stats?: {
    ac?: { status: string; lastChanged: number };
    light?: { status: string; lastChanged: number };
    acMinutes?: number;
    lightMinutes?: number;
    archiveCount?: number;
  };
  pgvcl?: { units: string; bill: string };
  smartthings?: {
    deviceCount?: number;
    locationId?: string;
    lastSyncedAt?: string;
    lastError?: string;
    devices?: Array<{ id: string; name: string; type?: string; online?: boolean }>;
  };
  solis?: { today: string; current: string; battery: string; status: string };
  battery?: { level: number; charging: boolean };
  spotify?: string;
  jitter?: number;
  platform?: string;
}

export default function Command() {
  const [data, setData] = useState<HubState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function refresh() {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    try {
      const res = await fetch("http://127.0.0.1:3030/status", { signal: ac.signal });
      clearTimeout(t);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError("Hub Offline");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const ac = data?.stats?.ac;
  const light = data?.stats?.light;
  const acOn = ac?.status === "on";
  const lightOn = light?.status === "on";
  const stCount = data?.smartthings?.deviceCount || 0;
  const stOnline = data?.smartthings?.devices?.filter((d) => d.online).length || 0;
  const hubHealth = error ? "🔴 OFFLINE" : "🟢 HEALTHY";
  const networkHealth = (data?.jitter || 0) > 150 ? "🟡 Jittery" : "🟢 Stable";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const statusEmoji = error ? "❌" : "🌌";
  const status = error
    ? "**Hub Offline**"
    : `# ${statusEmoji} Gravity Hub Status Card

*${dateStr} · ${timeStr}*

---

## ❄️ Climate
- **AC Power**: ${acOn ? "🟢 ON" : "⚫ OFF"}${data?.ac_duration ? ` · running for ${data.ac_duration}` : ""}
- **AC Today**: ${data?.stats?.acMinutes ? `${Math.floor(data.stats.acMinutes / 60)}h ${data.stats.acMinutes % 60}m` : "0m"}
- **Auto-Pilot**: ${data?.autoAc ? "🤖 ON" : "👤 OFF"}

## 💡 Illumination
- **Light Power**: ${lightOn ? "🟢 ON" : "⚫ OFF"}${data?.light_duration ? ` · running for ${data.light_duration}` : ""}
- **Light Today**: ${data?.stats?.lightMinutes ? `${Math.floor(data.stats.lightMinutes / 60)}h ${data.stats.lightMinutes % 60}m` : "0m"}
- **Media Aura**: ${data?.mediaAura !== false ? "🌈 ON" : "🌑 OFF"}

## 🏠 SmartThings
- **Devices**: ${stOnline}/${stCount} online
- **Location**: ${data?.smartthings?.locationId ? "🔗 linked" : "—"}
${data?.smartthings?.lastError ? `- **Last Error**: ${data.smartthings.lastError}` : ""}

## ☀️ Solar (SolisCloud)
- **Today**: ${data?.solis?.today || "—"} kWh
- **Now**: ${data?.solis?.current || "—"} kW
- **Battery**: ${data?.solis?.battery || "—"} · ${data?.solis?.status || "—"}

## ⚡ Energy
- **Units**: ${data?.units || "0"} kWh
- **Est Bill**: ₹${data?.estimatedPgBill || 0}
- **PGVCL**: ${data?.pgvcl?.units || "—"} units · ₹${data?.pgvcl?.bill || "—"}

## 🌤 Weather
- **Outdoor**: ${data?.weather?.temp || "—"}°C · AQI ${data?.weather?.aqi || "—"}
- **Sun**: 🌅 ${data?.weather?.sunrise || "—"} → 🌇 ${data?.weather?.sunset || "—"}

## 🛡 Sovereign Health
- **Hub**: ${hubHealth} · uptime ${Math.floor((data?.uptime || 0) / 3600)}h ${Math.floor(((data?.uptime || 0) % 3600) / 60)}m
- **Network**: ${networkHealth}${data?.jitter ? ` (${data.jitter.toFixed(0)}ms)` : ""}
- **Mac Battery**: ${data?.battery ? `${data.battery.level}% ${data.battery.charging ? "⚡" : ""}` : "—"}
- **Spotify**: ${data?.spotify || "Idle"}
- **Archive**: ${data?.stats?.archiveCount ? `${data.stats.archiveCount} fragments` : "ONLINE"}

---

_Last refresh: ${lastRefresh.toLocaleTimeString()}_ · _Refresh: ⌘R_`;

  return (
    <Detail
      isLoading={isLoading}
      markdown={status}
      actions={
        <ActionPanel title="Status Card">
          <Action
            title="Force Refresh"
            icon={Icon.Repeat}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={refresh}
          />
          <Action.CopyToClipboard
            title="Copy as Text"
            content={status}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.CopyToClipboard
            title="Copy as JSON"
            content={JSON.stringify(data, null, 2)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
          <Action.OpenInBrowser
            title="Open Web Dashboard"
            url="http://127.0.0.1:3000"
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
        </ActionPanel>
      }
      metadata={
        data ? (
          <Detail.Metadata>
            <Detail.Metadata.TagList title="Hub Health">
              <Detail.Metadata.TagList.Item
                text={error ? "OFFLINE" : "ONLINE"}
                color={error ? Color.Red : Color.Green}
              />
              <Detail.Metadata.TagList.Item
                text={`Up ${Math.floor((data.uptime || 0) / 3600)}h ${Math.floor(((data.uptime || 0) % 3600) / 60)}m`}
                color={Color.Blue}
              />
            </Detail.Metadata.TagList>
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label title="Platform" icon={Icon.Computer} text={data.platform || "Local Mac"} />
            <Detail.Metadata.Label title="Network" icon={Icon.Globe} text={`${(data.jitter || 0).toFixed(0)}ms · ${networkHealth}`} />
            <Detail.Metadata.Label title="Mac Battery" icon={Icon.Bolt} text={data.battery ? `${data.battery.level}%` : "—"} />
            <Detail.Metadata.Label title="Spotify" icon={Icon.Music} text={data.spotify || "Idle"} />
          </Detail.Metadata>
        ) : null
      }
    />
  );
}
