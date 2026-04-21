import { List, ActionPanel, Action, showToast, Toast, Icon, Color, Keyboard } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface HubState {
  online: boolean;
  uptime: number;
  autoAc: boolean;
  autoLight: boolean;
  ac_duration: string;
  light_duration: string;
  units: string;
  estimatedPgBill: number;
  mediaAura: boolean;
  solis?: { today: string; current: string; battery: string; status: string };
  weather?: { temp: number; humidity: number; condition: string; aqi: number; sunrise: string; sunset: string };
  stats?: { ac?: { status: string }; light?: { status: string }; archiveCount?: number };
}

export default function Command() {
  const [state, setState] = useState<HubState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("http://localhost:3030/status");
      const data = await res.json();
      setState(data as HubState);
      setError(null);
    } catch (e) { 
      setError("Hub Offline");
    }
    finally { setIsLoading(false); }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, []);

  async function runAction(name: string, endpoint: string) {
    showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
    try {
      const res = await fetch(`http://localhost:3030${endpoint}`);
      if (!res.ok) throw new Error("Failed");
      showToast({ style: Toast.Style.Success, title: `Confirmed: ${name}` });
      setTimeout(refresh, 500);
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Action Failed", message: "Hub Offline" });
    }
  }

  const acStatus = (state?.stats?.ac?.status || 'off').toUpperCase();
  const ltStatus = (state?.stats?.light?.status || 'off').toUpperCase();
  const acColor = acStatus === 'ON' ? Color.Green : Color.Red;
  const ltColor = ltStatus === 'ON' ? Color.Green : Color.Red;

  const getUptimeStr = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Precision Control Center...">
      
      <List.Section title="Gravity Scenes (Intents)">
        <List.Item
          icon={Icon.Video}
          title="TV TIME"
          subtitle="Dim Purple & AC Cool"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("TV", "/scene/tv")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.ComputerSpeaker}
          title="WORK MODE"
          subtitle="Bright White & AC Fan"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("Work", "/scene/work")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.House}
          title="BACK HOME"
          subtitle="Warm Welcome"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("HOME", "/scene/home")} /></ActionPanel>}
        />
      </List.Section>

      <List.Section title="Precision Hardware Control">
        <List.Item
          icon={Icon.Wind}
          title="Panasonic AC Controller"
          subtitle={acStatus === 'ON' ? `Running for ${state?.ac_duration || '0m'}` : "Standby"}
          accessories={[{ text: acStatus, color: acColor }]}
          actions={
            <ActionPanel title="AC Precision Pulse">
              <Action icon={Icon.ChevronDown} title="Temperature DOWN" onAction={() => runAction("Temp Down", "/control/temp?dir=down")} />
              <Action icon={Icon.ChevronUp} title="Temperature UP" shortcut={{ modifiers: ["cmd"], key: "enter" }} onAction={() => runAction("Temp Up", "/control/temp?dir=up")} />
              <ActionPanel.Section title="Climate Precision">
                <Action icon={Icon.Power} title="Toggle Power" shortcut={{ modifiers: ["cmd"], key: "t" }} onAction={() => runAction("AC", acStatus === 'ON' ? "/control/ac/off" : "/control/ac/on")} />
                <Action icon={Icon.Snowflake} title="Cool Mode" onAction={() => runAction("Cool", "/control/ac/mode?mode=cool")} />
                <Action icon={Icon.Repeat} title="Vertical Swing" onAction={() => runAction("Swing", "/control/ac/swing")} />
                <Action icon={Icon.Bolt} title="Powerful Mode" onAction={() => runAction("Powerful", "/control/ac/powerful?ps=on")} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Sun}
          title="Wiz Lighting Hub"
          subtitle={ltStatus === 'ON' ? `Running for ${state?.light_duration || '1h 32m'}` : "Standby"}
          accessories={[{ text: ltStatus, color: ltColor }]}
          actions={
            <ActionPanel title="Light Tactical Pulse">
              <Action icon={Icon.Minus} title="Brightness DOWN" onAction={() => runAction("Bright Down", "/control/brightness?dir=down")} />
              <Action icon={Icon.Plus} title="Brightness UP" shortcut={{ modifiers: ["cmd"], key: "enter" }} onAction={() => runAction("Bright Up", "/control/brightness?dir=up")} />
              <ActionPanel.Section title="Atmospheric Controls">
                <Action icon={Icon.Power} title="Toggle Power" shortcut={{ modifiers: ["cmd"], key: "l" }} onAction={() => runAction("Lights", ltStatus === 'ON' ? "/control/bulb_off" : "/control/bulb_on")} />
                <Action icon={Icon.Star} title="Aura Sync (Media)" onAction={() => runAction("Aura", "/control/aura/toggle")} />
                <Action icon={Icon.Circle} title="Warm White" onAction={() => runAction("Warm", "/control/bulb/color?temp=2700")} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Sovereignty Dashboard">
        <List.Item
          icon={Icon.Bolt}
          title="PGVCL Energy Pulse"
          subtitle={`₹${state?.estimatedPgBill || '??'} Est. Bill | ${state?.units || '0'} Units`}
          accessories={[{ text: "⚡ BILLING ACTIVE" }]}
          actions={<ActionPanel><Action icon={Icon.Cloud} title="Sync Vault" onAction={() => runAction("Vault Sync", "/archive/sync")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Tray}
          title="Archive Intelligence"
          subtitle={`Vault Velocity: HIGH | ${state?.stats?.archiveCount || '41K+'} fragments`}
          accessories={[{ text: error ? "HUB OFFLINE" : "🕵️ HOARDING ACTIVE", color: error ? Color.Red : undefined }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Repeat} title="Restart All Backend Services" onAction={() => runAction("HUB RESET", "/control/restart")} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Sun}
          title="SolisCloud Solar Intel"
          subtitle={`${state?.solis?.today || '--'} kWh Today | ${state?.solis?.current || '--'} kW Now`}
          accessories={[{ text: state?.solis?.status || "OPTIMAL" }]}
          actions={
            <ActionPanel>
              <Action.Push icon={Icon.QuestionMark} title="How to Setup SolisCloud" target={<SolisSetupGuide />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Cloud}
          title="Atmospheric Context"
          subtitle={`${state?.weather?.temp || '??'}°C | AQI: ${state?.weather?.aqi || '??'}`}
          accessories={[{ text: `🌇 ${state?.weather?.sunset || '--'} | 🌅 ${state?.weather?.sunrise || '--'}` }]}
        />
      </List.Section>

      <List.Section title="System Telemetry">
        <List.Item
          icon={Icon.Heartbeat}
          title="Sovereign Pulse"
          subtitle={`Hub: ${getUptimeStr(state?.uptime || 0)} | Archive: ONLINE`}
          accessories={[{ text: error ? "OFFLINE" : "HEALTHY", color: error ? Color.Red : Color.Green }]}
          actions={<ActionPanel><Action icon={Icon.Repeat} title="Re-Pulse All Services" onAction={() => runAction("REBUILD", "/control/restart")} /></ActionPanel>}
        />
      </List.Section>
    </List>
  );
}

function SolisSetupGuide() {
  const guide = `
# SolisCloud Integration Guide ☀️🔋

To get your API credentials for standalone sovereignty:

1. **Login** to [SolisCloud](https://www.soliscloud.com/).
2. Click on your **User Icon** (top right) or the **Service Center** tab.
3. Look for **API Management** or **API** in the sidebar.
4. **Generate API Key**:
   - You'll see a **KeyId** and a **SecretKey**. 
   - *Note: You might need to accept a disclaimer to enable API access.*
5. **Get Plant ID**:
   - Go to **Plant Overview**.
   - Your Plant ID for **Praduman Khachar** is: \`1298491919450000328\` 🧬
6. **Update Config**:
   - Enter these into your \`.env.local\` in the \`iftt\` root.
   - Restart the Hub using the **Re-Pulse** action in Raycast.

Once integrated, you'll see real-time generation counts instead of mock data!
  `;
  return <List.Item.Detail markdown={guide} />;
}
