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
      setTimeout(refresh, 200);
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Action Failed", message: "Hub Offline" });
    }
  }

  const acStatus = (state?.stats?.ac?.status || 'off').toUpperCase();
  const ltStatus = (state?.stats?.light?.status || 'off').toUpperCase();
  const acColor = acStatus === 'ON' ? Color.Green : Color.Red;
  const ltColor = ltStatus === 'ON' ? Color.Green : Color.Red;

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search commands (e.g. 'AC Temp Up', 'Bright Down')...">
      
      <List.Section title="Sovereignty Dashboard">
        <List.Item
          icon={Icon.Bolt}
          title="PGVCL Energy Pulse"
          subtitle={`₹${state?.estimatedPgBill || '??'} Est. Bill | ${state?.units || '0'} Units`}
          accessories={[{ text: "⚡ BILLING ACTIVE" }]}
          actions={<ActionPanel><Action icon={Icon.Cloud} title="Sync Vault" onAction={() => runAction("Vault Sync", "/archive/sync")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Cloud}
          title="Environmental Status"
          subtitle={`${state?.weather?.temp || '??'}°C | ${state?.weather?.humidity || '??'}% Humid | ${state?.weather?.condition || 'Clear'}`}
          accessories={[{ text: `💓 HEARTBEAT: ${state?.uptime || '0'}s` }]}
          actions={<ActionPanel><Action icon={Icon.Clock} title="Audit Logs" onAction={() => runAction("Logs", "/logs")} /></ActionPanel>}
        />
      </List.Section>

      <List.Section title="Gravity Scenes">
        <List.Item
          icon={Icon.Video}
          title="Scene: TV TIME"
          subtitle="Dim Purple & AC Cool"
          actions={<ActionPanel><Action title="Activate TV" onAction={() => runAction("TV", "/scene/tv")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.ComputerSpeaker}
          title="Scene: WORK MODE"
          subtitle="Bright White & AC Fan"
          actions={<ActionPanel><Action title="Activate Work" onAction={() => runAction("Work", "/scene/work")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.House}
          title="Scene: BACK HOME"
          subtitle="Warm Welcome Sequence"
          actions={<ActionPanel><Action title="Activate Home" onAction={() => runAction("HOME", "/scene/home")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Moon}
          title="Scene: AWAY MODE"
          subtitle="Sentry Mode Active"
          actions={<ActionPanel><Action title="Activate Away" onAction={() => runAction("AWAY", "/scene/away")} /></ActionPanel>}
        />
      </List.Section>

      <List.Section title="Hardware Toggles">
        <List.Item
          icon={Icon.Power}
          title="Toggle Light"
          subtitle={ltStatus}
          accessories={[{ text: ltStatus, color: ltColor }]}
          actions={<ActionPanel><Action title="Toggle" onAction={() => runAction("Lights", ltStatus === 'ON' ? "/control/bulb_off" : "/control/bulb_on")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Power}
          title="Toggle AC"
          subtitle={acStatus}
          accessories={[{ text: acStatus, color: acColor }]}
          actions={<ActionPanel><Action title="Toggle" onAction={() => runAction("AC", acStatus === 'ON' ? "/control/ac/off" : "/control/ac/on")} /></ActionPanel>}
        />
      </List.Section>

      <List.Section title="Chromatic Actions">
        <List.Item icon={{ source: Icon.Circle, color: Color.Red }} title="Red" actions={<ActionPanel><Action title="Set" onAction={() => runAction("Red", "/control/bulb/color?r=255&g=0&b=0")} /></ActionPanel>} />
        <List.Item icon={{ source: Icon.Circle, color: Color.Blue }} title="Blue" actions={<ActionPanel><Action title="Set" onAction={() => runAction("Blue", "/control/bulb/color?r=0&g=0&b=255")} /></ActionPanel>} />
        <List.Item icon={{ source: Icon.Circle, color: Color.Green }} title="Green" actions={<ActionPanel><Action title="Set" onAction={() => runAction("Green", "/control/bulb/color?r=0&g=255&b=0")} /></ActionPanel>} />
        <List.Item icon={{ source: Icon.Circle, color: Color.Yellow }} title="Gold" actions={<ActionPanel><Action title="Set" onAction={() => runAction("Gold", "/control/bulb/color?r=255&g=215&b=0")} /></ActionPanel>} />
        <List.Item icon={Icon.Star} title="Aura Sync" subtitle={state?.mediaAura ? "ON" : "OFF"} actions={<ActionPanel><Action title="Toggle" onAction={() => runAction("Aura", "/control/aura/toggle")} /></ActionPanel>} />
      </List.Section>

      <List.Section title="Granular Hardware Rails">
        <List.Item icon={Icon.Sun} title="Brightness Up" actions={<ActionPanel><Action title="Pulse" onAction={() => runAction("Bright Up", "/control/brightness?dir=up")} /></ActionPanel>} />
        <List.Item icon={Icon.Moon} title="Brightness Down" actions={<ActionPanel><Action title="Pulse" onAction={() => runAction("Bright Down", "/control/brightness?dir=down")} /></ActionPanel>} />
        <List.Item icon={Icon.ChevronUp} title="AC Temp Up" actions={<ActionPanel><Action title="Pulse" onAction={() => runAction("Temp Up", "/control/temp?dir=up")} /></ActionPanel>} />
        <List.Item icon={Icon.ChevronDown} title="AC Temp Down" actions={<ActionPanel><Action title="Pulse" onAction={() => runAction("Temp Down", "/control/temp?dir=down")} /></ActionPanel>} />
      </List.Section>
    </List>
  );
}
