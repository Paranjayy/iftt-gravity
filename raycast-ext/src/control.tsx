import { List, ActionPanel, Action, showToast, Toast, Icon, Color, Image } from "@raycast/api";
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
    <List isLoading={isLoading} searchBarPlaceholder="Search Gravity Hub (Scenes, Commands)...">
      
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
          actions={<ActionPanel><Action icon={Icon.MagnifyingGlass} title="Deep Audit" onAction={() => {}} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Sun}
          title="SolisCloud Solar Intel"
          subtitle={`${state?.solis?.today || '--'} kWh Today | ${state?.solis?.current || '--'} kW Now`}
          accessories={[{ text: state?.solis?.status || "SYNCING SOLIS..." }]}
          actions={<ActionPanel><Action icon={Icon.ChevronRight} title="Full Solar Report" onAction={() => {}} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Cloud}
          title="Atmospheric Context"
          subtitle={`${state?.weather?.temp || '??'}°C | AQI: ${state?.weather?.aqi || '??'} | Hum: ${state?.weather?.humidity || '??'}%`}
          accessories={[{ text: `🌇 ${state?.weather?.sunset || '--'} | 🌅 ${state?.weather?.sunrise || '--'}` }]}
        />
      </List.Section>

      <List.Section title="Hardware Controls (Unified)">
        <List.Item
          icon={Icon.Wind}
          title="Panasonic AC Controller"
          subtitle={acStatus === 'ON' ? `Running for ${state?.ac_duration || '0m'}` : "Standby"}
          accessories={[{ text: acStatus, color: acColor }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Power} title="Toggle AC" onAction={() => runAction("AC", acStatus === 'ON' ? "/control/ac/off" : "/control/ac/on")} />
              <Action.Submenu icon={Icon.Snowflake} title="Modes & Precision">
                <Action key="cool" icon={Icon.Snowflake} title="Cool Mode" onAction={() => runAction("Cool", "/control/ac/mode?mode=cool")} />
                <Action key="dry" icon={Icon.Drop} title="Dry Mode" onAction={() => runAction("Dry", "/control/ac/mode?mode=dry")} />
                <Action key="fan" icon={Icon.Livestream} title="Fan Mode" onAction={() => runAction("Fan", "/control/ac/mode?mode=fan")} />
                <Action key="auto" icon={Icon.Repeat} title="Auto Mode" onAction={() => runAction("Auto", "/control/ac/mode?mode=auto")} />
                <Action key="swing" icon={Icon.Repeat} title="Vertical Swing" onAction={() => runAction("Swing", "/control/ac/swing")} />
              </Action.Submenu>
              <Action.Submenu icon={Icon.Clock} title="Power & Timers">
                <Action key="powerful" icon={Icon.Bolt} title="Powerful Mode" onAction={() => runAction("Powerful", "/control/ac/powerful?ps=on")} />
                <Action key="eco" icon={Icon.Leaf} title="Economical Mode" onAction={() => runAction("Eco", "/control/ac/powerful?ps=off")} />
                <Action key="t1" icon={Icon.Clock} title="1 Hour Timer" onAction={() => runAction("1h Timer", "/control/ac/timer?mins=60")} />
                <Action key="t0" icon={Icon.XMarkCircle} title="Cancel Timer" onAction={() => runAction("Stop Timer", "/control/ac/timer?mins=0")} />
              </Action.Submenu>
              <Action key="tup" icon={Icon.ChevronUp} title="Temp Up" onAction={() => runAction("Temp Up", "/control/temp?dir=up")} />
              <Action key="tdown" icon={Icon.ChevronDown} title="Temp Down" onAction={() => runAction("Temp Down", "/control/temp?dir=down")} />
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
              <Action icon={Icon.Power} title="Toggle Lights" onAction={() => runAction("Lights", ltStatus === 'ON' ? "/control/bulb_off" : "/control/bulb_on")} />
              <Action.Submenu icon={Icon.EditShape} title="Chromatic Vault">
                <Action key="red" icon={{ source: Icon.Circle, color: Color.Red }} title="Set Red" onAction={() => runAction("Red", "/control/bulb/color?r=255&g=0&b=0")} />
                <Action key="blue" icon={{ source: Icon.Circle, color: Color.Blue }} title="Set Blue" onAction={() => runAction("Blue", "/control/bulb/color?r=0&g=0&b=255")} />
                <Action key="green" icon={{ source: Icon.Circle, color: Color.Green }} title="Set Green" onAction={() => runAction("Green", "/control/bulb/color?r=0&g=255&b=0")} />
                <Action key="gold" icon={{ source: Icon.Circle, color: Color.Yellow }} title="Set Gold" onAction={() => runAction("Gold", "/control/bulb/color?r=255&g=215&b=0")} />
                <Action key="purple" icon={{ source: Icon.Circle, color: Color.Purple }} title="Set Purple" onAction={() => runAction("Purple", "/control/bulb/color?r=128&g=0&b=128")} />
              </Action.Submenu>
              <Action.Submenu icon={Icon.Brightness} title="Atmospheric Whites">
                <Action key="warm" icon={Icon.Circle} title="Warm White" onAction={() => runAction("Warm", "/control/bulb/color?temp=2700")} />
                <Action key="cool" icon={Icon.Circle} title="Cool White" onAction={() => runAction("Cool", "/control/bulb/color?temp=6500")} />
                <Action key="party" icon={Icon.Star} title="Aura Sync (Media)" onAction={() => runAction("Aura", "/control/aura/toggle")} />
              </Action.Submenu>
              <Action key="bup" icon={Icon.Plus} title="Brightness Up" onAction={() => runAction("Bright Up", "/control/brightness?dir=up")} />
              <Action key="bdown" icon={Icon.Minus} title="Brightness Down" onAction={() => runAction("Bright Down", "/control/brightness?dir=down")} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Sovereign Hub Scenes">
        <List.Item
          icon={Icon.Video}
          title="Scene: TV TIME"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("TV", "/scene/tv")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.ComputerSpeaker}
          title="Scene: WORK MODE"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("Work", "/scene/work")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.House}
          title="Scene: BACK HOME"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("HOME", "/scene/home")} /></ActionPanel>}
        />
      </List.Section>
    </List>
  );
}
