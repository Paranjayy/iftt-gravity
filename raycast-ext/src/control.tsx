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
    } catch (e) { }
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

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Precision Control Center...">
      
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
          accessories={[{ text: "🕵️ HOARDING ACTIVE" }]}
        />
        <List.Item
          icon={Icon.Sun}
          title="SolisCloud Solar Intel"
          subtitle={`${state?.solis?.today || '--'} kWh Today | ${state?.solis?.current || '--'} kW Now`}
          accessories={[{ text: state?.solis?.status || "OPTIMAL" }]}
        />
        <List.Item
          icon={Icon.Cloud}
          title="Atmospheric Context"
          subtitle={`${state?.weather?.temp || '??'}°C | AQI: ${state?.weather?.aqi || '??'}`}
          accessories={[{ text: `🌇 ${state?.weather?.sunset || '--'} | 🌅 ${state?.weather?.sunrise || '--'}` }]}
        />
      </List.Section>

      <List.Section title="Precision Hardware Control">
        <List.Item
          icon={Icon.Wind}
          title="Panasonic AC Control"
          subtitle={acStatus === 'ON' ? `Running for ${state?.ac_duration || '0m'}` : "Standby"}
          accessories={[{ text: acStatus, color: acColor }]}
          actions={
            <ActionPanel>
              {/* PRIMARY BINDINGS (ENTER / CMD+ENTER) */}
              <Action icon={Icon.ChevronDown} title="Temperature DOWN" onAction={() => runAction("Temp Down", "/control/temp?dir=down")} />
              <Action icon={Icon.ChevronUp} title="Temperature UP" shortcut={{ modifiers: ["cmd"], key: "enter" }} onAction={() => runAction("Temp Up", "/control/temp?dir=up")} />
              
              <ActionPanel.Section title="Climate Precision">
                <Action icon={Icon.Power} title="Toggle Power" shortcut={{ modifiers: ["cmd"], key: "t" }} onAction={() => runAction("AC", acStatus === 'ON' ? "/control/ac/off" : "/control/ac/on")} />
                <Action icon={Icon.Snowflake} title="Cool Mode" onAction={() => runAction("Cool", "/control/ac/mode?mode=cool")} />
                <Action icon={Icon.Repeat} title="Auto Mode" onAction={() => runAction("Auto", "/control/ac/mode?mode=auto")} />
                <Action icon={Icon.Repeat} title="Vertical Swing" onAction={() => runAction("Swing", "/control/ac/swing")} />
                <Action icon={Icon.Bolt} title="Powerful Mode" onAction={() => runAction("Powerful", "/control/ac/powerful?ps=on")} />
                <Action icon={Icon.Clock} title="1h Sleep Timer" onAction={() => runAction("1h Timer", "/control/ac/timer?mins=60")} />
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
            <ActionPanel>
              {/* PRIMARY BINDINGS (ENTER / CMD+ENTER) */}
              <Action icon={Icon.Minus} title="Brightness DOWN" onAction={() => runAction("Bright Down", "/control/brightness?dir=down")} />
              <Action icon={Icon.Plus} title="Brightness UP" shortcut={{ modifiers: ["cmd"], key: "enter" }} onAction={() => runAction("Bright Up", "/control/brightness?dir=up")} />

              <ActionPanel.Section title="Atmospheric Controls">
                <Action icon={Icon.Power} title="Toggle Power" shortcut={{ modifiers: ["cmd"], key: "l" }} onAction={() => runAction("Lights", ltStatus === 'ON' ? "/control/bulb_off" : "/control/bulb_on")} />
                <Action icon={{ source: Icon.Circle, color: Color.Red }} title="Color: Red" onAction={() => runAction("Red", "/control/bulb/color?r=255&g=0&b=0")} />
                <Action icon={{ source: Icon.Circle, color: Color.Blue }} title="Color: Blue" onAction={() => runAction("Blue", "/control/bulb/color?r=0&g=0&b=255")} />
                <Action icon={{ source: Icon.Circle, color: Color.Green }} title="Color: Green" onAction={() => runAction("Green", "/control/bulb/color?r=0&g=255&b=0")} />
                <Action icon={{ source: Icon.Circle, color: Color.Yellow }} title="Color: Gold" onAction={() => runAction("Gold", "/control/bulb/color?r=255&g=215&b=0")} />
                <Action icon={Icon.Star} title="Aura Sync (Media)" onAction={() => runAction("Aura", "/control/aura/toggle")} />
                <Action icon={Icon.Circle} title="Warm White" onAction={() => runAction("Warm", "/control/bulb/color?temp=2700")} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Gravity Scenes">
        <List.Item
          icon={Icon.Video}
          title="TV TIME"
          subtitle="Dim Purple & AC Cool"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("TV", "/scene/tv")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.House}
          title="BACK HOME"
          subtitle="Warm Welcome Sequence"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("HOME", "/scene/home")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Clock}
          title="Sync Vault Metadata"
          actions={<ActionPanel><Action title="Pulse Sync" onAction={() => runAction("Vault Sync", "/archive/sync")} /></ActionPanel>}
        />
      </List.Section>
    </List>
  );
}
