import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface HubState {
  online: boolean;
  uptime: number;
  stats?: { prompts: number };
  estimatedPgBill?: string;
  pgvcl?: { usage: string; bill: string; lastUpdate: string };
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
          title="Brightness Control"
          subtitle="Adjust all bulbs"
          actions={
            <AP title="Brightness">
              <A icon={Icon.PlusCircle} title="Increase (+20%)" onAction={() => runAction("Brightness Up", "/control/brightness?dir=up")} />
              <A icon={Icon.MinusCircle} title="Decrease (-20%)" onAction={() => runAction("Brightness Down", "/control/brightness?dir=down")} />
              <A icon={Icon.Power} title="Turn Off Bulbs" onAction={() => runAction("Bulbs Off", "/control/bulb/off")} />
            </AP>
          }
        />
        <LI
          icon={Icon.Circle}
          title="AC Temperature"
          subtitle="Control cooling precision"
          actions={
            <AP title="AC Temp">
              <A icon={Icon.ChevronUp} title="Warmer (+1°C)" onAction={() => runAction("Temp Up", "/control/temp?dir=up")} />
              <A icon={Icon.ChevronDown} title="Cooler (-1°C)" onAction={() => runAction("Temp Down", "/control/temp?dir=down")} />
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

      <LS title="Mac System Control">
        <LI
          icon={Icon.Lock}
          title="Lock Mac Screen"
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

      <LS title="Gravity Analytics">
        <LI
          icon={Icon.Bolt}
          title="PGVCL Usage"
          subtitle={state?.pgvcl?.usage || "Scanning..."}
          accessories={[{ text: state?.estimatedPgBill ? `Est: ₹${state.estimatedPgBill}` : undefined }]}
        />
        <LI
          icon={state?.online ? Icon.CheckCircle : Icon.Circle}
          title="Hub Status"
          subtitle={state?.online ? "Phone Detected" : "AWAY Mode active"}
          accessories={[{ text: `Uptime: ${(state?.uptime || 0).toFixed(1)}s` }]}
        />
      </LS>
    </L>
  );
}
