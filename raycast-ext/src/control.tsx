import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface HubState {
  online: boolean;
  uptime: number;
  autoAc: boolean;
  autoLight: boolean;
  ac_duration: number;
  light_duration: number;
  stats?: { prompts: number };
  estimatedPgBill?: string;
  pgvcl?: { units: string; bill: string; lastUpdate: string };
  weather?: { temp: number; condition: string; isRain: boolean };
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
  }, []);

  async function runAction(name: string, endpoint: string) {
    try {
      const res = await fetch(`http://localhost:3030${endpoint}`);
      if (!res.ok) throw new Error("Failed");
      showToast({ style: Toast.Style.Success, title: `Triggered: ${name}` });
      setTimeout(refresh, 1000);
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Action Failed" });
    }
  }

  const L: any = List;
  const LI: any = List.Item;
  const LS: any = List.Section;
  const AP: any = ActionPanel;
  const A: any = Action;

  return (
    <L isLoading={isLoading} searchBarPlaceholder="Search scenes or control devices...">
      <LS title="Gravity Scenes">
        <LI
          icon={Icon.Video}
          title="TV TIME"
          subtitle="Cinema mode"
          actions={
            <AP title="Actions">
              <A icon={Icon.Video} title="Activate" onAction={() => runAction("TV", "/scene/tv")} />
            </AP>
          }
        />
        <LI
          icon={Icon.Moon}
          title="AWAY"
          subtitle="Power save"
          actions={
            <AP title="Actions">
              <A icon={Icon.Moon} title="Activate" onAction={() => runAction("AWAY", "/scene/away")} />
            </AP>
          }
        />
      </LS>

      <LS title="Aura Moods">
        <LI
          icon={Icon.Livestream}
          title="OCEAN BLUE"
          actions={
            <AP title="Pulse">
              <A icon={Icon.Livestream} title="Trigger" onAction={() => runAction("BLUE", "/control/bulb/color?temp=6500")} />
            </AP>
          }
        />
        <LI
          icon={Icon.SpeakerHigh}
          title="MUSIC SYNC"
          subtitle="Reactive lighting"
          actions={
            <AP title="Pulse">
              <A icon={Icon.SpeakerHigh} title="Toggle Sync" onAction={() => runAction("SYNC", "/control/aura/toggle")} />
            </AP>
          }
        />
      </LS>

      <LS title="Hardware Control">
        <LI
          icon={Icon.Sun}
          title="Lighting"
          subtitle={state?.light_duration ? `Running for ${state.light_duration}m` : "Standby"}
          actions={
            <AP title="Lighting">
              <A icon={Icon.PlusCircle} title="Brightness Up" onAction={() => runAction("Up", "/control/brightness?dir=up")} />
              <A icon={Icon.MinusCircle} title="Brightness Down" onAction={() => runAction("Down", "/control/brightness?dir=down")} />
              <A icon={Icon.Power} title="Turn Off" onAction={() => runAction("Off", "/control/bulb/off")} />
            </AP>
          }
        />
        <LI
          icon={Icon.Wind}
          title="Air Conditioning"
          subtitle={state?.ac_duration ? `Running for ${state.ac_duration}m` : "Standby"}
          actions={
            <AP title="AC">
              <A icon={Icon.ChevronUp} title="Temp Up" onAction={() => runAction("Up", "/control/temp?dir=up")} />
              <A icon={Icon.ChevronDown} title="Temp Down" onAction={() => runAction("Down", "/control/temp?dir=down")} />
              <A icon={Icon.Power} title="Turn Off" onAction={() => runAction("Off", "/control/ac/off")} />
            </AP>
          }
        />
      </LS>

      <LS title="Gravity Pulse">
        <LI
          icon={state?.online ? Icon.CheckCircle : Icon.Circle}
          title="Presence"
          subtitle={state?.online ? "Home" : "Away"}
          actions={
            <AP title="Hub">
              <A icon={Icon.Snowflake} title={state?.autoAc ? "Disable Auto-AC" : "Enable Auto-AC"} onAction={() => runAction("Auto-AC", "/control/auto/ac")} />
              <A icon={Icon.Sun} title={state?.autoLight ? "Disable Auto-Lights" : "Enable Auto-Lights"} onAction={() => runAction("Auto-Lights", "/control/auto/light")} />
              <A icon={Icon.RotateAntiClockwise} title="Restart Hub" onAction={() => runAction("Restart", "/system/restart")} />
              <A.Push icon={Icon.Eye} title="View Chronicle" target={<LogsView />} />
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
    </List>
  );
}
