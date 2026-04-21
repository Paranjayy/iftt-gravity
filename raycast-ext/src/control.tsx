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
    <List isLoading={isLoading} searchBarPlaceholder="Control Gravity Hub...">
      <List.Section title="Sovereign Control">
        <List.Item
          icon={Icon.Wind}
          title="Air Conditioning"
          subtitle={acStatus === 'ON' ? `Running for ${state?.ac_duration || '0m'}` : "Standby"}
          accessories={[{ text: acStatus, color: acColor }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Power} title={acStatus === 'ON' ? "Turn OFF" : "Turn ON"} onAction={() => runAction("AC", acStatus === 'ON' ? "/control/ac/off" : "/control/ac/on")} />
              <Action icon={Icon.Snowflake} title="Cool Mode" onAction={() => runAction("Cool", "/control/ac/mode?mode=cool")} />
              <Action icon={Icon.Bolt} title="Powerful Mode" onAction={() => runAction("Powerful", "/control/ac/powerful?ps=on")} />
              <Action icon={Icon.Clock} title="1 Hour Timer" onAction={() => runAction("1h Timer", "/control/ac/timer?mins=60")} />
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
              <Action icon={Icon.Power} title="Toggle Lights" onAction={() => runAction("Lights", ltStatus === 'ON' ? "/control/bulb_off" : "/control/bulb_on")} />
              <Action icon={Icon.Circle} title="Warm White" onAction={() => runAction("Warm", "/control/bulb/color?temp=2700")} />
              <Action icon={Icon.Circle} title="Cool White" onAction={() => runAction("Cool", "/control/bulb/color?temp=6500")} />
              <Action icon={Icon.Plus} title="Brightness Up" onAction={() => runAction("Bright Up", "/control/brightness?dir=up")} />
              <Action icon={Icon.Minus} title="Brightness Down" onAction={() => runAction("Bright Down", "/control/brightness?dir=down")} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Livestream}
          title="Aura Sync / Auto-Pilot"
          subtitle={state?.mediaAura ? "Syncing Media" : "Static"}
          accessories={[{ text: state?.autoAc ? "AUTO" : "MANUAL" }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Switch} title="Toggle Aura" onAction={() => runAction("Aura", "/control/aura/toggle")} />
              <Action icon={Icon.CheckCircle} title="Toggle Auto-AC" onAction={() => runAction("Auto-AC", "/control/auto/ac")} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Utility Pulse">
        <List.Item
          icon={Icon.Bolt}
          title="Energy & Weather"
          subtitle={`₹${state?.estimatedPgBill || '??'} | ${state?.weather?.temp || '??'}°C`}
          actions={
            <ActionPanel>
              <Action icon={Icon.Cloud} title="Sync Archive to GitHub" onAction={() => runAction("Vault Sync", "/archive/sync")} />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
