import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface HubState {
  online: boolean;
  uptime: number;
<<<<<<< Updated upstream
  stats?: { prompts: number };
  estimatedPgBill?: string;
   pgvcl?: { units: string; bill: string; lastUpdate: string };
  weather?: { temp: number; condition: string; isRain: boolean };
=======
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
>>>>>>> Stashed changes
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
      showToast({ style: Toast.Style.Failure, title: "Hub Offline", message: "Start ./hub.sh first" });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000); // 30s pulse
    return () => clearInterval(timer);
  }, []);

  async function runAction(name: string, endpoint: string) {
    try {
      const res = await fetch(`http://localhost:3030${endpoint}`);
      if (!res.ok) throw new Error("Failed");
      showToast({ style: Toast.Style.Success, title: `Triggered: ${name}` });
      setTimeout(refresh, 500);
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Action Failed" });
    }
  }

  const acStatus = (state?.stats?.ac?.status || 'off').toUpperCase();
  const ltStatus = (state?.stats?.light?.status || 'off').toUpperCase();

  return (
<<<<<<< Updated upstream
    <L isLoading={isLoading} searchBarPlaceholder="Search scenes or control devices...">
      <LS title="Mission Scenes">
        <LI
          icon={Icon.Video}
          title="TV TIME"
          subtitle="Cinematic lighting & quiet AC"
          actions={
            <AP title="Scene Actions">
              <A icon={Icon.Video} title="Activate Scene" onAction={() => runAction("TV TIME", "/scene/tv")} />
            </AP>
          }
        />
        <LI
          icon={Icon.Circle}
          title="HOME"
          subtitle="Welcome back lights & AC"
          actions={
            <AP title="Scene Actions">
              <A icon={Icon.Circle} title="Activate Scene" onAction={() => runAction("HOME", "/scene/home")} />
            </AP>
          }
=======
    <List isLoading={isLoading} searchBarPlaceholder="Search scenes or control devices...">
      
      <List.Section title="Utility Metrics">
        <List.Item
          icon={{ source: Icon.Bolt, color: Color.Yellow }}
          title="PGVCL Budget"
          subtitle={`₹${state?.estimatedPgBill || '??'} Estimated`}
          accessories={[{ text: `${state?.units || '0'} Units Used` }]}
        />
        <List.Item
          icon={{ source: Icon.Cloud, color: Color.Blue }}
          title="Weather Pulse"
          subtitle={`${state?.weather?.temp || '??'}°C | Humidity: ${state?.weather?.humidity || '??'}%`}
          accessories={[{ text: state?.weather?.condition || 'Clear' }]}
        />
      </List.Section>

      <List.Section title="Hardware Control">
        <List.Item
          icon={{ source: Icon.Wind, color: acStatus === 'ON' ? Color.Blue : Color.SecondaryText }}
          title="Air Conditioning"
          subtitle={acStatus === 'ON' ? `Running for ${state?.ac_duration || '0m'}` : "Standby"}
          accessories={[{ text: acStatus, color: acStatus === 'ON' ? Color.Green : Color.Red }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Power} title="Toggle AC" onAction={() => runAction("AC", acStatus === 'ON' ? "/control/ac/off" : "/control/ac/on")} />
              <Action icon={Icon.ChevronUp} title="Temp Up" onAction={() => runAction("Temp Up", "/control/temp_up")} />
              <Action icon={Action.ChevronDown} title="Temp Down" onAction={() => runAction("Temp Down", "/control/temp_down")} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={{ source: Icon.Sun, color: ltStatus === 'ON' ? Color.Yellow : Color.SecondaryText }}
          title="Lighting"
          subtitle={ltStatus === 'ON' ? `Running for ${state?.light_duration || '0m'}` : "Standby"}
          accessories={[{ text: ltStatus, color: ltStatus === 'ON' ? Color.Green : Color.Red }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Power} title="Toggle Lights" onAction={() => runAction("Lights", ltStatus === 'ON' ? "/control/bulb_off" : "/control/bulb_on")} />
              <Action icon={Icon.Plus} title="Brightness Up" onAction={() => runAction("Bright Up", "/control/bright_up")} />
              <Action icon={Icon.Minus} title="Brightness Down" onAction={() => runAction("Bright Down", "/control/bright_down")} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Auto-Pilot Sovereignty">
        <List.Item
          icon={Icon.Snowflake}
          title="Auto-AC Logic"
          subtitle={state?.autoAc ? "Dynamic Environment Control Active" : "Manual Mode"}
          accessories={[{ text: state?.autoAc ? "ENABLED" : "DISABLED", color: state?.autoAc ? Color.Green : Color.Red }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.CheckCircle} title="Toggle Auto-AC" onAction={() => runAction("Auto-AC", "/control/auto/ac")} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Livestream}
          title="Aura Sync (Media Exposure)"
          subtitle={state?.mediaAura ? "Cinematic RGB Sync Active" : "Static Lighting"}
          accessories={[{ text: state?.mediaAura ? "ENABLED" : "DISABLED", color: state?.mediaAura ? Color.Green : Color.Red }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Switch} title="Toggle Aura" onAction={() => runAction("Aura", "/control/aura/toggle")} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Gravity Scenes">
        <List.Item
          icon={Icon.Video}
          title="TV TIME"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("TV", "/scene/tv")} /></ActionPanel>}
>>>>>>> Stashed changes
        />
        <List.Item
          icon={Icon.House}
          title="BACK HOME"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("HOME", "/scene/home")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Moon}
<<<<<<< Updated upstream
          title="AWAY"
          subtitle="Everything off (Energy Save)"
          actions={
            <AP title="Scene Actions">
              <A icon={Icon.Moon} title="Activate Scene" onAction={() => runAction("AWAY", "/scene/away")} />
            </AP>
          }
        />
      </LS>

      <LS title="Deep Device Control">
        <LI
          icon={Icon.Sun}
          title="Bulb Control"
          subtitle="Precision lighting"
          actions={
            <AP title="Lighting">
              <A icon={Icon.PlusCircle} title="Brightness Up" onAction={() => runAction("Brightness Up", "/control/brightness?dir=up")} />
              <A icon={Icon.MinusCircle} title="Brightness Down" onAction={() => runAction("Brightness Down", "/control/brightness?dir=down")} />
              <A icon={Icon.Temperature} title="Warm White" onAction={() => runAction("Warm White", "/control/bulb/color?temp=2700")} />
              <A icon={Icon.Circle} title="Cool White" onAction={() => runAction("Cool White", "/control/bulb/color?temp=6500")} />
              <A icon={Icon.Power} title="Turn Off Bulbs" onAction={() => runAction("Bulbs Off", "/control/bulb/off")} />
            </AP>
          }
        />
        <LI
          icon={Icon.Wind}
          title="Air Conditioning"
          subtitle="Climate control"
          actions={
            <AP title="AC Control">
              <A icon={Icon.ChevronUp} title="Temp Up (+1°C)" onAction={() => runAction("Temp Up", "/control/temp?dir=up")} />
              <A icon={Icon.ChevronDown} title="Temp Down (-1°C)" onAction={() => runAction("Temp Down", "/control/temp?dir=down")} />
              <A icon={Icon.Circle} title="Cool Mode" onAction={() => runAction("AC Cool", "/control/ac/mode?mode=cool")} />
              <A icon={Icon.Leaf} title="Dry Mode" onAction={() => runAction("AC Dry", "/control/ac/mode?mode=dry")} />
              <A icon={Icon.Power} title="Turn Off AC" onAction={() => runAction("AC Off", "/control/ac/off")} />
            </AP>
          }
        />
        <LI
          icon={Icon.SpeakerHigh}
          title="Mac Volume"
          actions={
            <AP title="System Volume">
              <A icon={Icon.PlusCircle} title="Volume Up" onAction={() => runAction("Volume Up", "/control/volume?dir=up")} />
              <A icon={Icon.MinusCircle} title="Volume Down" onAction={() => runAction("Volume Down", "/control/volume?dir=down")} />
            </AP>
          }
        />
      </LS>

      <LS title="Hub Telemetry & Environment">
        <LI
          icon={Icon.Cloud}
          title="Current Weather"
          subtitle={state?.weather ? `${state.weather.condition} (${state.weather.temp}°C)` : "Fetching..."}
          accessories={[{ text: state?.weather?.isRain ? "☔ Rain Forecast" : "🌤 Clear" }]}
        />
        <LI
          icon={Icon.Bolt}
          title="Energy Usage"
          subtitle={state?.pgvcl?.units ? `${state.pgvcl.units} Units` : "No data yet"}
          accessories={[{ text: state?.estimatedPgBill ? ` Est: ₹${state.estimatedPgBill}` : undefined }]}
        />
        <LI
          icon={state?.online ? Icon.CheckCircle : Icon.Circle}
          title="Family Presence"
          subtitle={state?.online ? "Owner Detected" : "AWAY Mode logic active"}
          accessories={[{ text: `Uptime: ${(state?.uptime || 0).toFixed(1)}s` }]}
          actions={
            <AP title="Hub Control">
              <A icon={Icon.RotateAntiClockwise} title="Emergency Restart Hub" onAction={() => runAction("Hub Restart", "/system/restart")} />
              <A.Push icon={Icon.Eye} title="View Gravity Logs" target={<LogsView />} />
            </AP>
          }
        />
      </LS>

      <LS title="Mac System Control">
        <LI
          icon={Icon.Lock}
          title="Lock Screen"
          actions={
            <AP title="Lock Now">
              <A icon={Icon.Lock} title="Lock Now" onAction={() => runAction("Lock", "/system/lock")} />
            </AP>
          }
        />
        <LI
          icon={Icon.XMarkCircle}
          title="Put Mac to Sleep"
          actions={
            <AP title="Sleep Actions">
              <A icon={Icon.XMarkCircle} title="Sleep Now" onAction={() => runAction("Sleep", "/system/sleep")} />
            </AP>
          }
        />
      </LS>
    </L>
  );
}

function LogsView() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3030/logs")
      .then(r => r.text())
      .then(t => setLogs(t.split("\n").filter(l => l.trim()).reverse()))
      .catch(() => setLogs(["Error fetching logs"]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <List isLoading={loading} searchBarPlaceholder="Filter chronicle...">
      {logs.map((log, i) => <List.Item key={i} title={log} icon={Icon.Calendar} />)}
=======
          title="AWAY MODE"
          actions={<ActionPanel><Action title="Activate" onAction={() => runAction("AWAY", "/scene/away")} /></ActionPanel>}
        />
      </List.Section>
>>>>>>> Stashed changes
    </List>
  );
}
