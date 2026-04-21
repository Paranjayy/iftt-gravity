import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
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
  pgvcl?: { units: string; bill: string; lastUpdate: string };
  weather?: { temp: number; humidity: number; condition: string };
  stats?: { ac?: { status: string }; light?: { status: string } };
}

export default function Command() {
  const [state, setState] = useState<HubState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch("http://localhost:3030/status");
      const data = await res.json();
      setState(data as HubState);
    } catch (e) {
      // Offline fallback handled by UI
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, []);

  async function runAction(name: string, endpoint: string) {
    try {
      const res = await fetch(`http://localhost:3030${endpoint}`);
      if (!res.ok) throw new Error("Failed");
      showToast({ style: Toast.Style.Success, title: `Triggered: ${name}` });
      setTimeout(refresh, 500);
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Action Failed", message: "Hub Offline" });
    }
  }

  const acStatus = (state?.stats?.ac?.status || 'off').toUpperCase();
  const ltStatus = (state?.stats?.light?.status || 'off').toUpperCase();
  const acColor = acStatus === 'ON' ? Color.Green : Color.Red;
  const ltColor = ltStatus === 'ON' ? Color.Green : Color.Red;

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search scenes or control devices...">
      
      <List.Section title="Gravity Scenes">
        <List.Item
          icon={Icon.Video}
          title="TV TIME"
          subtitle="Cinema Lighting & AC Pulse"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("TV", "/scene/tv")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.House}
          title="BACK HOME"
          subtitle="Welcome Sequence"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("HOME", "/scene/home")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Moon}
          title="AWAY MODE"
          subtitle="Power Save / Sentry Active"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("AWAY", "/scene/away")} /></ActionPanel>}
        />
      </List.Section>

      <List.Section title="Hardware Control">
        <List.Item
          icon={Icon.Wind}
          title="Air Conditioning"
          subtitle={acStatus === 'ON' ? `Running for ${state?.ac_duration || '0m'}` : "Standby"}
          accessories={[{ text: acStatus, color: acColor }]}
          actions={
            <ActionPanel>
              <Action.Submenu icon={Icon.Power} title="Toggle & Modes">
                <Action icon={Icon.Power} title={acStatus === 'ON' ? "Turn OFF" : "Turn ON"} onAction={() => runAction("AC", acStatus === 'ON' ? "/control/ac/off" : "/control/ac/on")} />
                <Action icon={Icon.Snowflake} title="Cool Mode" onAction={() => runAction("Cool", "/control/ac/mode?mode=cool")} />
                <Action icon={Icon.Drop} title="Dry Mode" onAction={() => runAction("Dry", "/control/ac/mode?mode=dry")} />
                <Action icon={Icon.Livestream} title="Fan Mode" onAction={() => runAction("Fan", "/control/ac/mode?mode=fan")} />
                <Action icon={Icon.Repeat} title="Auto Mode" onAction={() => runAction("Auto", "/control/ac/mode?mode=auto")} />
              </Action.Submenu>
              <Action.Submenu icon={Icon.Bolt} title="Performance">
                <Action icon={Icon.Bolt} title="Powerful Mode" onAction={() => runAction("Powerful", "/control/ac/powerful?ps=on")} />
                <Action icon={Icon.Leaf} title="Economical Mode" onAction={() => runAction("Eco", "/control/ac/powerful?ps=off")} />
              </Action.Submenu>
              <Action.Submenu icon={Icon.Clock} title="Sleep Timer">
                <Action icon={Icon.Clock} title="1 Hour Timer" onAction={() => runAction("1h Timer", "/control/ac/timer?mins=60")} />
                <Action icon={Icon.Clock} title="2 Hour Timer" onAction={() => runAction("2h Timer", "/control/ac/timer?mins=120")} />
                <Action icon={Icon.XMarkCircle} title="Cancel Timer" onAction={() => runAction("Stop Timer", "/control/ac/timer?mins=0")} />
              </Action.Submenu>
              <Action icon={Icon.ChevronUp} title="Temp Up" onAction={() => runAction("Temp Up", "/control/temp?dir=up")} />
              <Action icon={Icon.ChevronDown} title="Temp Down" onAction={() => runAction("Temp Down", "/control/temp?dir=down")} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Sun}
          title="Lighting"
          subtitle={ltStatus === 'ON' ? `Running for ${state?.light_duration || '0m'}` : "Standby"}
          accessories={[{ text: ltStatus, color: ltColor }]}
          actions={
            <ActionPanel>
              <Action.Submenu icon={Icon.EditShape} title="Colors & Scenes">
                <Action icon={Icon.Circle} title="Warm White" onAction={() => runAction("Warm", "/control/bulb/color?temp=2700")} />
                <Action icon={Icon.Circle} title="Cool White" onAction={() => runAction("Cool", "/control/bulb/color?temp=6500")} />
                <Action icon={Icon.Circle} title="Red" onAction={() => runAction("Red", "/control/bulb/color?r=255&g=0&b=0")} />
                <Action icon={Icon.Circle} title="Blue" onAction={() => runAction("Blue", "/control/bulb/color?r=0&g=0&b=255")} />
                <Action icon={Icon.Circle} title="Green" onAction={() => runAction("Green", "/control/bulb/color?r=0&g=255&b=0")} />
                <Action icon={Icon.Circle} title="Gold" onAction={() => runAction("Gold", "/control/bulb/color?r=255&g=215&b=0")} />
                <Action icon={Icon.Star} title="Party Scene (Aura)" onAction={() => runAction("Party", "/control/aura/toggle")} />
              </Action.Submenu>
              <Action icon={Icon.Power} title="Toggle Lights" onAction={() => runAction("Lights", ltStatus === 'ON' ? "/control/bulb_off" : "/control/bulb_on")} />
              <Action icon={Icon.Plus} title="Brightness Up" onAction={() => runAction("Bright Up", "/control/brightness?dir=up")} />
              <Action icon={Icon.Minus} title="Brightness Down" onAction={() => runAction("Bright Down", "/control/brightness?dir=down")} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Auto-Pilot Sovereignty">
        <List.Item
          icon={Icon.Snowflake}
          title="Auto-AC Logic"
          subtitle={state?.autoAc ? "Weather-Aware Controls" : "Manual Mode"}
          accessories={[{ text: state?.autoAc ? "ENABLED" : "DISABLED", color: state?.autoAc ? Color.Green : Color.Red }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.CheckCircle} title="Toggle Auto-AC" onAction={() => runAction("Auto-AC", "/control/auto/ac")} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Livestream}
          title="Aura Sync (Media)"
          subtitle={state?.mediaAura ? "Spotify Lighting Sync" : "Static Mode"}
          accessories={[{ text: state?.mediaAura ? "ENABLED" : "DISABLED", color: state?.mediaAura ? Color.Green : Color.Red }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Switch} title="Toggle Aura" onAction={() => runAction("Aura", "/control/aura/toggle")} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Utility Pulse">
        <List.Item
          icon={Icon.Bolt}
          title="PGVCL Budget"
          subtitle={`₹${state?.estimatedPgBill || '??'} Estimated`}
          accessories={[{ text: `${state?.units || '0'} Units Used` }]}
        />
        <List.Item
          icon={Icon.Cloud}
          title="Weather"
          subtitle={`${state?.weather?.temp || '??'}°C | ${state?.weather?.humidity || '??'}% Humid`}
          accessories={[{ text: state?.weather?.condition || 'Clear' }]}
        />
        <List.Item
          icon={Icon.Desktop}
          title="Sovereign Vault"
          subtitle="Archive Sync & Pulse"
          actions={
            <ActionPanel>
              <Action icon={Icon.Cloud} title="Sync to GitHub" onAction={() => runAction("Vault Sync", "/archive/sync")} />
              <Action icon={Icon.BarChart} title="Show Hoarding Pulse" onAction={() => runAction("Heatmap", "/archive/stats/heatmap")} />
              <Action icon={Icon.ArrowRight} title="Export to Markdown" onAction={() => runAction("Export", "/archive/export/md")} />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
