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
    // Non-blocking Toast for rapid-fire usability
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
      
      <List.Section title="Exploded Hardware Controls">
        {/* LIGHTING COMMANDS */}
        <List.Item
          icon={Icon.Sun}
          title="Brightness Up"
          subtitle="Increase intensity (10%)"
          actions={<ActionPanel><Action title="Pulse Bright Up" onAction={() => runAction("Bright Up", "/control/brightness?dir=up")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Moon}
          title="Brightness Down"
          subtitle="Decrease intensity (Towards 0)"
          actions={<ActionPanel><Action title="Pulse Bright Down" onAction={() => runAction("Bright Down", "/control/brightness?dir=down")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Power}
          title="Light Toggle"
          subtitle={ltStatus}
          accessories={[{ text: ltStatus, color: ltColor }]}
          actions={<ActionPanel><Action title="Toggle" onAction={() => runAction("Lights", ltStatus === 'ON' ? "/control/bulb_off" : "/control/bulb_on")} /></ActionPanel>}
        />

        {/* CLIMATE COMMANDS */}
        <List.Item
          icon={Icon.ChevronUp}
          title="AC Temp Up"
          subtitle="Higher (+1°C)"
          actions={<ActionPanel><Action title="Pulse Temp Up" onAction={() => runAction("Temp Up", "/control/temp?dir=up")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.ChevronDown}
          title="AC Temp Down"
          subtitle="Lower (-1°C)"
          actions={<ActionPanel><Action title="Pulse Temp Down" onAction={() => runAction("Temp Down", "/control/temp?dir=down")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Power}
          title="AC Toggle"
          subtitle={acStatus}
          accessories={[{ text: acStatus, color: acColor }]}
          actions={<ActionPanel><Action title="Toggle" onAction={() => runAction("AC", acStatus === 'ON' ? "/control/ac/off" : "/control/ac/on")} /></ActionPanel>}
        />
      </List.Section>

      <List.Section title="Chromatic Actions">
        <List.Item
          icon={{ source: Icon.Circle, color: Color.Red }}
          title="Color: Red"
          actions={<ActionPanel><Action title="Set Red" onAction={() => runAction("Red", "/control/bulb/color?r=255&g=0&b=0")} /></ActionPanel>}
        />
        <List.Item
          icon={{ source: Icon.Circle, color: Color.Blue }}
          title="Color: Blue"
          actions={<ActionPanel><Action title="Set Blue" onAction={() => runAction("Blue", "/control/bulb/color?r=0&g=0&b=255")} /></ActionPanel>}
        />
        <List.Item
          icon={{ source: Icon.Circle, color: Color.Green }}
          title="Color: Green"
          actions={<ActionPanel><Action title="Set Green" onAction={() => runAction("Green", "/control/bulb/color?r=0&g=255&b=0")} /></ActionPanel>}
        />
        <List.Item
          icon={{ source: Icon.Circle, color: Color.Yellow }}
          title="Color: Gold"
          actions={<ActionPanel><Action title="Set Gold" onAction={() => runAction("Gold", "/control/bulb/color?r=255&g=215&b=0")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Star}
          title="Aura Sync (Media)"
          subtitle={state?.mediaAura ? "ON" : "OFF"}
          actions={<ActionPanel><Action title="Toggle Aura" onAction={() => runAction("Aura", "/control/aura/toggle")} /></ActionPanel>}
        />
      </List.Section>

      <List.Section title="Gravity Scenes & Vault">
        <List.Item
          icon={Icon.Video}
          title="Scene: TV TIME"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("TV", "/scene/tv")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.House}
          title="Scene: BACK HOME"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("HOME", "/scene/home")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Cloud}
          title="Sync Archive to GitHub"
          actions={<ActionPanel><Action title="Sync Vault" onAction={() => runAction("Vault Sync", "/archive/sync")} /></ActionPanel>}
        />
      </List.Section>
    </List>
  );
}
