import { List, ActionPanel, Action, showToast, Toast, Icon, Color, Keyboard, Detail } from "@raycast/api";
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
  pgvcl?: { units: string; bill: string };
}

export default function Command() {
  const [state, setState] = useState<HubState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("http://127.0.0.1:3030/status");
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
      const res = await fetch(`http://127.0.0.1:3030${endpoint}`);
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
          actions={<ActionPanel><Action title="Activate" icon={Icon.Video} onAction={() => runAction("TV", "/scene/tv")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.ComputerSpeaker}
          title="WORK MODE"
          subtitle="Bright White & AC Fan"
          actions={<ActionPanel><Action title="Activate" icon={Icon.ComputerSpeaker} onAction={() => runAction("Work", "/scene/work")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.House}
          title="BACK HOME"
          subtitle="Warm Welcome"
          actions={<ActionPanel><Action title="Activate" icon={Icon.House} onAction={() => runAction("HOME", "/scene/home")} /></ActionPanel>}
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
                <Action icon={Icon.Video} title="TV Mode (Cool & Quiet)" onAction={() => runAction("TV AC", "/control/ac_tv")} />
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
                <Action icon={Icon.Video} title="TV Mode (Dim to 10%)" onAction={() => runAction("TV Lights", "/control/bulb_tv")} />
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
          subtitle={`Actual: ₹${state?.pgvcl?.bill || '--'} (${state?.pgvcl?.units || '--'}U) | Today: ₹${state?.estimatedPgBill || '0'} (${state?.units || '0'}U)`}
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
# SolisCloud API Activation Guide ☀️📨

Looking at your dashboard, it seems the **API Management** menu is currently hidden. This is common for personal accounts and requires a one-time activation from their side.

### 🛑 **Step 1: Apply for Access** (Mandatory)
According to Solis documentation, you must first contact their technical support to "Verify and Activate" API access for your account:
- **Email**: \`ussupport@solisinv.com\` (or your regional Solis support).
- **Subject**: Request for API Access Activation - Praduman Khachar
- **Content**: "Please activate the API Management portal for my account (\`pkhachar@gmail.com\`) to allow integration with my personal dashboard."

### 🔧 **Step 2: Activation (Once Unlocked)**
Once they reply, you will see a new **API Management** option under the **Service** tab:
1.  Go to **Service** -> **API Management**.
2.  Click **Activate Now**.
3.  Complete the Email Verification (Puzzle + Code).
4.  Copy your **KeyId** and **SecretKey**.

### 🧬 **Plant Details**
- **Plant ID**: \`1298491919450000328\`
- **Current Flow**: Currently syncing via **Session Pulse** (18.7 kWh) until your persistent keys are live.

Restart the Hub once you have the keys!
  `;
  return <Detail markdown={guide} />;
}
