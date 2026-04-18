import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface HubState {
  online: boolean;
  uptime: number;
  stats?: { prompts: number };
  estimatedPgBill?: string;
  pgvcl?: { usage: string; bill: string; lastUpdate: string };
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
        />
        <LI
          icon={Icon.Moon}
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
          title="Energy Bill Estimate"
          subtitle={state?.pgvcl?.usage || "Calculating..."}
          accessories={[{ text: state?.estimatedPgBill ? `Est: ₹${state.estimatedPgBill}` : undefined }]}
        />
        <LI
          icon={state?.online ? Icon.CheckCircle : Icon.Circle}
          title="Family Presence"
          subtitle={state?.online ? "Owner Detected" : "AWAY Mode logic active"}
          accessories={[{ text: `Uptime: ${(state?.uptime || 0).toFixed(1)}s` }]}
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
