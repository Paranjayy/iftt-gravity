import { List, ActionPanel, Action, showToast, Toast, Icon, Color, Keyboard, Detail, Form, useNavigation, getPreferenceValues } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import { hubUrl, dashboardUrl } from "./config";
import { sendWizPilot, WizDevice } from "./wiz-direct";
import ACControlDetail from "./ac-control-detail";
import BulbControlDetail from "./bulb-control-detail";
import HubPulse from "./hub_pulse";
import SchedulePresetsList from "./schedule_presets";
import HubOfflineDetail from "./hub_offline";

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
  smartthings?: {
    deviceCount?: number;
    locationId?: string;
    lastSyncedAt?: string;
    lastError?: string;
    lastErrorAt?: string;
    devices?: Array<{
      id: string;
      name: string;
      type?: string;
      online?: boolean;
      capabilities?: string[];
    }>;
    hasToken?: boolean;
  };
  solis?: { today: string; current: string; battery: string; status: string };
  weather?: { temp: number; humidity: number; condition: string; aqi: number; sunrise: string; sunset: string };
  stats?: { ac?: { status: string }; light?: { status: string }; archiveCount?: number };
  pgvcl?: { units: string; bill: string };
}

interface Preferences {
  smartThingsPat?: string;
  smartThingsLocationId?: string;
}


export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const [state, setState] = useState<HubState | null>(null);
  // Never block Raycast's command surface on a slow cloud-backed hub probe.
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1_500);
      const res = await fetch(hubUrl("status"), { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("Hub status failed");
      const data = await res.json();
      setState(data as HubState);
      setError(null);
    } catch (e) { 
      setError("Hub Offline");
    }
    finally { setIsLoading(false); }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const pat = preferences.smartThingsPat?.trim();
    const locId = preferences.smartThingsLocationId?.trim() || "";
    if (pat && state && (!state.smartthings?.hasToken || state.smartthings?.locationId !== locId)) {
      fetch(hubUrl("control/smartthings/link"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pat, locationId: locId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            refresh();
          }
        })
        .catch((e) => console.error("[SmartThings] Auto-sync failed", e));
    }
  }, [preferences.smartThingsPat, preferences.smartThingsLocationId, state?.smartthings?.hasToken, state?.smartthings?.locationId]);

  async function runAction(name: string, endpoint: string) {
    showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
    try {
      const res = await fetch(hubUrl(endpoint.startsWith("/") ? endpoint.slice(1) : endpoint));
      if (!res.ok) throw new Error("Failed");
      showToast({ style: Toast.Style.Success, title: `Confirmed: ${name}` });
      setTimeout(refresh, 500);
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Action Failed", message: "Hub Offline" });
    }
  }

  async function runDirectScene(name: string, ac: Record<string, string>, light: Record<string, unknown>) {
    showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
    try {
      const [acResponse, bulbsResponse] = await Promise.all([
        fetch(hubUrl(`control/ac/set?${new URLSearchParams(ac).toString()}`)),
        fetch(hubUrl("control/wiz/devices")),
      ]);
      if (!acResponse.ok || !bulbsResponse.ok) throw new Error("Hub request failed");
      const devices = (await bulbsResponse.json()) as { bulbs?: WizDevice[] };
      const bulb = devices.bulbs?.find((candidate) => candidate.online && candidate.ip) || devices.bulbs?.find((candidate) => candidate.ip);
      if (!bulb?.ip) throw new Error("No reachable WiZ bulb found");
      await sendWizPilot(bulb.ip, light);
      showToast({ style: Toast.Style.Success, title: `Confirmed: ${name}` });
      setTimeout(refresh, 500);
    } catch (error) {
      showToast({ style: Toast.Style.Failure, title: `${name} failed`, message: error instanceof Error ? error.message : "Could not reach the hub or lamp" });
    }
  }

  const runTvTime = () => runDirectScene("TV Time", { ps: "on", actmp: "24", acmd: "cool", acfs: "low" }, { state: true, sceneId: 18, dimming: 10 });
  const runWorkMode = () => runDirectScene("Work Mode", { ps: "on", actmp: "25", acmd: "cool" }, { state: true, temp: 6500, dimming: 100 });
  const runBackHome = () => runDirectScene("Back Home", { ps: "on", actmp: "25", acmd: "cool" }, { state: true, temp: 4500, dimming: 80 });

  async function runWizAction(name: string, params: Record<string, unknown>) {
    showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
    try {
      const response = await fetch(hubUrl("control/wiz/devices"));
      if (!response.ok) throw new Error("Hub could not list WiZ bulbs");
      const devices = (await response.json()) as { bulbs?: WizDevice[] };
      const bulb = devices.bulbs?.find((candidate) => candidate.online && candidate.ip) || devices.bulbs?.find((candidate) => candidate.ip);
      if (!bulb?.ip) throw new Error("No reachable WiZ bulb found");
      await sendWizPilot(bulb.ip, params);
      showToast({ style: Toast.Style.Success, title: `Confirmed: ${name}` });
      setTimeout(refresh, 500);
    } catch (error) {
      showToast({ style: Toast.Style.Failure, title: `${name} failed`, message: error instanceof Error ? error.message : "Could not reach the bulb" });
    }
  }

  const acStatus = (state?.stats?.ac?.status || 'off').toUpperCase();
  const ltStatus = (state?.stats?.light?.status || 'off').toUpperCase();
  const acColor = acStatus === 'ON' ? Color.Green : Color.Red;
  const ltColor = ltStatus === 'ON' ? Color.Green : Color.Red;

  const getUptimeStr = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const runSmartThingsCommand = (deviceId: string, capability: string, command: string, args: any[] = []) => {
    const query = new URLSearchParams({ deviceId, capability, command });
    if (args.length) query.set("args", JSON.stringify(args));
    return runAction(`SmartThings ${command}`, `/control/smartthings?${query.toString()}`);
  };

  const runRawSmartThingsCommand = (deviceId: string, capability: string, command: string, argsJson: string) => {
    const args = argsJson.trim() ? (() => {
      try {
        const parsed = JSON.parse(argsJson);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [argsJson];
      }
    })() : [];
    return runSmartThingsCommand(deviceId, capability, command, args);
  };

  const smartThingsActionSet = (device: NonNullable<HubState["smartthings"]>["devices"][number]) => {
    const caps = new Set((device.capabilities || []).map((cap) => String(cap).toLowerCase()));
    const actions: Array<{ title: string; icon: any; capability: string; command: string; args?: any[] }> = [];

    if (caps.has("switch")) {
      actions.push({ title: "On", icon: Icon.Power, capability: "switch", command: "on" });
      actions.push({ title: "Off", icon: Icon.Power, capability: "switch", command: "off" });
    }
    if (caps.has("switchlevel")) {
      actions.push({ title: "25%", icon: Icon.Minus, capability: "switchLevel", command: "setLevel", args: [25] });
      actions.push({ title: "50%", icon: Icon.Minus, capability: "switchLevel", command: "setLevel", args: [50] });
      actions.push({ title: "100%", icon: Icon.Plus, capability: "switchLevel", command: "setLevel", args: [100] });
    }
    if (caps.has("colortemperature")) {
      actions.push({ title: "Warm", icon: Icon.Sun, capability: "colorTemperature", command: "setColorTemperature", args: [2700] });
      actions.push({ title: "Daylight", icon: Icon.Sun, capability: "colorTemperature", command: "setColorTemperature", args: [5000] });
    }
    if (caps.has("audiomute")) {
      actions.push({ title: "Mute", icon: Icon.SpeakerOff, capability: "audioMute", command: "mute" });
      actions.push({ title: "Unmute", icon: Icon.SpeakerHigh, capability: "audioMute", command: "unmute" });
    }
    if (caps.has("mediaplayback")) {
      actions.push({ title: "Play", icon: Icon.Play, capability: "mediaPlayback", command: "play" });
      actions.push({ title: "Pause", icon: Icon.Pause, capability: "mediaPlayback", command: "pause" });
      actions.push({ title: "Stop", icon: Icon.Stop, capability: "mediaPlayback", command: "stop" });
    }
    if (caps.has("mediatrackcontrol")) {
      actions.push({ title: "Next", icon: Icon.ArrowRight, capability: "mediaTrackControl", command: "nextTrack" });
      actions.push({ title: "Previous", icon: Icon.ArrowLeft, capability: "mediaTrackControl", command: "previousTrack" });
    }
    if (caps.has("keypadinput")) {
      actions.push({ title: "Remote Up", icon: Icon.ArrowUp, capability: "keypadInput", command: "sendKey", args: ["UP"] });
      actions.push({ title: "Remote Down", icon: Icon.ArrowDown, capability: "keypadInput", command: "sendKey", args: ["DOWN"] });
      actions.push({ title: "Remote Left", icon: Icon.ArrowLeft, capability: "keypadInput", command: "sendKey", args: ["LEFT"] });
      actions.push({ title: "Remote Right", icon: Icon.ArrowRight, capability: "keypadInput", command: "sendKey", args: ["RIGHT"] });
      actions.push({ title: "Remote Select", icon: Icon.Circle, capability: "keypadInput", command: "sendKey", args: ["SELECT"] });
      actions.push({ title: "Remote Back", icon: Icon.ArrowLeft, capability: "keypadInput", command: "sendKey", args: ["BACK"] });
      actions.push({ title: "Remote Home", icon: Icon.House, capability: "keypadInput", command: "sendKey", args: ["HOME"] });
      actions.push({ title: "Remote Source", icon: Icon.Video, capability: "keypadInput", command: "sendKey", args: ["INPUT"] });
      actions.push({ title: "Remote Menu", icon: Icon.List, capability: "keypadInput", command: "sendKey", args: ["MENU"] });
      actions.push({ title: "Remote Guide", icon: Icon.List, capability: "keypadInput", command: "sendKey", args: ["GUIDE"] });
      actions.push({ title: "Remote Power", icon: Icon.Power, capability: "keypadInput", command: "sendKey", args: ["POWER"] });
    }

    if (!actions.length) {
      actions.push({ title: "On", icon: Icon.Power, capability: "switch", command: "on" });
    }

    return actions;
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Precision Control Center...">
      <List.Section title="Gravity Scenes (Intents)">
        <List.Item
          icon={Icon.Video}
          title="TV TIME"
          subtitle="Dim Purple & AC Cool"
          actions={<ActionPanel><Action title="Activate" icon={Icon.Video} onAction={runTvTime} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.ComputerSpeaker}
          title="WORK MODE"
          subtitle="Bright White & AC Fan"
          actions={<ActionPanel><Action title="Activate" icon={Icon.ComputerSpeaker} onAction={runWorkMode} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.House}
          title="BACK HOME"
          subtitle="Warm Welcome"
          actions={<ActionPanel><Action title="Activate" icon={Icon.House} onAction={runBackHome} /></ActionPanel>}
        />
      </List.Section>

      <List.Section title="Precision Hardware Control">
        <List.Item
          icon={Icon.Wind}
          title="Panasonic AC Controller"
          subtitle={acStatus === 'ON' ? `Running for ${state?.ac_duration || '0m'}` : "Standby"}
          accessories={[{ text: acStatus, color: acColor }]}
          actions={
            <ActionPanel title="AC Precision Pulse">
              <Action.Push icon={Icon.Wind} title="Detailed Control Panel" target={<ACControlDetail />} />
              <ActionPanel.Section title="Quick Command Pulse">
                <Action icon={Icon.ChevronDown} title="Temperature DOWN" shortcut={{ modifiers: ["cmd"], key: "j" }} onAction={() => runAction("Temp Down", "/control/temp?dir=down")} />
                <Action icon={Icon.ChevronUp} title="Temperature UP" shortcut={{ modifiers: ["cmd"], key: "k" }} onAction={() => runAction("Temp Up", "/control/temp?dir=up")} />
                <Action icon={Icon.Video} title="TV Mode (Cool & Quiet)" onAction={() => runAction("TV AC", "/control/ac_tv")} />
                <Action icon={Icon.Power} title="Toggle AC Power" shortcut={{ modifiers: ["cmd"], key: "t" }} onAction={() => runAction("AC", "/control/ac/toggle")} />
                <Action icon={Icon.Snowflake} title="Cool Mode" onAction={() => runAction("Cool", "/control/ac/mode?mode=cool")} />
                <Action icon={Icon.Repeat} title="Vertical Swing" onAction={() => runAction("Swing", "/control/ac/swing")} />
                <Action icon={Icon.Bolt} title="Powerful Mode" onAction={() => runAction("Powerful", "/control/ac/powerful?ps=on")} />
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
            <ActionPanel title="Light Tactical Pulse">
              <Action.Push icon={Icon.LightBulb} title="Detailed Control Panel" target={<BulbControlDetail />} />
              <Action icon={Icon.Minus} title="Brightness DOWN (20%)" onAction={() => runWizAction("Brightness down", { state: true, dimming: 30 })} />
              <Action icon={Icon.Plus} title="Brightness UP (70%)" shortcut={{ modifiers: ["cmd"], key: "enter" }} onAction={() => runWizAction("Brightness up", { state: true, dimming: 70 })} />
              <ActionPanel.Section title="Atmospheric Controls">
                <Action icon={Icon.Video} title="TV Mode (Dim to 10%)" onAction={() => runWizAction("TV Lights", { state: true, sceneId: 18, dimming: 10 })} />
                <Action icon={Icon.Power} title="Toggle Power" shortcut={{ modifiers: ["cmd"], key: "l" }} onAction={() => runWizAction("Lights", { state: ltStatus !== "ON" })} />
                <Action icon={Icon.Star} title="Aura Sync (Media)" onAction={() => runAction("Aura", "/control/aura/toggle")} />
                <Action icon={Icon.Circle} title="White Bulb Mode" onAction={() => runWizAction("White", { state: true, temp: 4500 })} />
                <Action icon={Icon.Circle} title="Warm White" onAction={() => runWizAction("Warm", { state: true, temp: 2700 })} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Sovereignty Dashboard">
        <List.Item
          icon={Icon.Bolt}
          title="PGVCL Energy Pulse"
          subtitle={`Actual: ₹${state?.pgvcl?.bill || '--'} (${state?.pgvcl?.units || '--'}U) | Today: ₹${state?.estimatedPgBill || '0'} (${state?.units || '0'}U)`}
          accessories={[{ text: "⚡ BILLING ACTIVE" }]}
          actions={<ActionPanel><Action icon={Icon.Cloud} title="Sync Vault" onAction={() => runAction("Vault Sync", "/archive/sync")} /></ActionPanel>}
        />
        <List.Item
          icon={Icon.Tray}
          title="Archive Intelligence"
          subtitle={`Vault Velocity: HIGH | ${state?.stats?.archiveCount || '41K+'} fragments`}
          accessories={[{ text: error ? "HUB OFFLINE" : "🕵️ HOARDING ACTIVE", color: error ? Color.Red : undefined }]}
          actions={
            <ActionPanel>
              <Action icon={Icon.Repeat} title="Restart All Backend Services" onAction={() => runAction("HUB RESET", "/control/restart")} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Sun}
          title="SolisCloud Solar Intel"
          subtitle={`${state?.solis?.today || '--'} kWh Today | ${state?.solis?.current || '--'} kW Now`}
          accessories={[{ text: state?.solis?.status || "OPTIMAL" }]}
          actions={
            <ActionPanel>
              <Action.Push icon={Icon.QuestionMark} title="How to Setup SolisCloud" target={<SolisSetupGuide />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Cloud}
          title="Atmospheric Context"
          subtitle={`${state?.weather?.temp || '??'}°C | AQI: ${state?.weather?.aqi || '??'}`}
          accessories={[{ text: `🌇 ${state?.weather?.sunset || '--'} | 🌅 ${state?.weather?.sunrise || '--'}` }]}
        />
      </List.Section>

      <List.Section title="SmartThings Setup">
        <List.Item
          icon={Icon.Key}
          title="Link SmartThings PAT"
          subtitle={state?.smartthings?.deviceCount
            ? `${state.smartthings.deviceCount} devices synced${state.smartthings.locationId ? " · location saved" : ""}${state.smartthings.lastSyncedAt ? " · refreshed" : ""}`
            : preferences.smartThingsPat
              ? "Raycast prefs already have a token"
              : "Store token in Gravity"}
          actions={
            <ActionPanel>
              <Action.Push
                title="Open Link Form"
                icon={Icon.Key}
                target={<SmartThingsLinkForm onDone={refresh} defaultToken={preferences.smartThingsPat || ""} defaultLocationId={state?.smartthings?.locationId || ""} />}
              />
              <Action
                title="Sync Devices"
                icon={Icon.Repeat}
                onAction={() => runAction("SmartThings Sync", "/control/smartthings/sync")}
              />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.QuestionMark}
          title="SmartThings Setup Guide"
          subtitle="Where to put the PAT and what the Location ID means"
          actions={
            <ActionPanel>
              <Action.Push
                title="Open Guide"
                icon={Icon.QuestionMark}
                target={<SmartThingsSetupGuide />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Globe}
          title="Open Device Sync"
          subtitle="Use the web setup page if you prefer"
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="Open Device Sync" url={dashboardUrl("device-sync")} />
            </ActionPanel>
          }
        />
        {state?.smartthings?.lastError ? (
          <List.Item
            icon={Icon.ExclamationMark}
            title="SmartThings Last Error"
            subtitle={state.smartthings.lastErrorAt ? `${state.smartthings.lastError} · ${new Date(state.smartthings.lastErrorAt).toLocaleString()}` : state.smartthings.lastError}
            accessories={[{ text: "ERROR", color: Color.Red }]}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard title="Copy Error" content={state.smartthings.lastError} />
                <Action title="Refresh" icon={Icon.Repeat} onAction={refresh} />
              </ActionPanel>
            }
          />
        ) : null}
      </List.Section>

      {state?.smartthings?.devices?.length ? (
        <List.Section title="SmartThings Devices">
          {state.smartthings.devices.map((device) => (
            <List.Item
              key={device.id}
              icon={device.type === "monitor" ? Icon.Desktop : device.type === "light" ? Icon.LightBulb : Icon.Desktop}
              title={device.name}
              subtitle={`${device.type || "device"} · ${device.capabilities?.slice(0, 3).join(", ") || "no capabilities listed"}`}
              accessories={[{ text: device.online ? "ONLINE" : "OFFLINE", color: device.online ? Color.Green : Color.Red }]}
              actions={
                <ActionPanel title="SmartThings Control">
                  {smartThingsActionSet(device).map((action) => (
                    <Action
                      key={`${device.id}-${action.capability}-${action.command}-${action.title}`}
                      title={action.title}
                      icon={action.icon}
                      onAction={() => runSmartThingsCommand(device.id, action.capability, action.command, action.args || [])}
                    />
                  ))}
                  <Action.Push
                    title="Raw Command"
                    icon={Icon.Terminal}
                    target={
                      <SmartThingsRawCommandForm
                        device={device}
                        onDone={refresh}
                        onRun={runRawSmartThingsCommand}
                      />
                    }
                  />
                  <Action
                    title="Refresh State"
                    icon={Icon.Repeat}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={refresh}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}

      <List.Section title="System Telemetry">
        <List.Item
          icon={Icon.Heartbeat}
          title="Sovereign Pulse"
          subtitle={`Hub: ${getUptimeStr(state?.uptime || 0)} | Archive: ONLINE`}
          accessories={[{ text: error ? "OFFLINE" : "HEALTHY", color: error ? Color.Red : Color.Green }]}
          actions={
            <ActionPanel>
              <Action.Push icon={Icon.BarChart} title="Open Hub Pulse" target={<HubPulse />} />
              <Action icon={Icon.Repeat} title="Re-Pulse All Services" onAction={() => runAction("REBUILD", "/control/restart")} />
              <Action.OpenInBrowser title="Open Web Dashboard" url={dashboardUrl()} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Network}
          title="Gravity Hub HTTP"
          subtitle={error ? "No response from localhost:3030" : `Responding · uptime ${getUptimeStr(state?.uptime || 0)}`}
          accessories={[{ text: error ? "DOWN" : "UP", color: error ? Color.Red : Color.Green }]}
        />
        <List.Item
          icon={Icon.LightBulb}
          title="WiZ Light Transport"
          subtitle="Direct Raycast LAN UDP · bypasses background-agent WiZ failures"
          accessories={[{ text: "DIRECT", color: Color.Green }]}
        />
        <List.Item
          icon={Icon.Wind}
          title="Panasonic AC Adapter"
          subtitle={acStatus === "ON" ? `Connected · running ${state?.ac_duration || "now"}` : "Connected · standby"}
          accessories={[{ text: acStatus, color: acColor }]}
        />
        <List.Item
          icon={Icon.Globe}
          title="SmartThings"
          subtitle={state?.smartthings?.lastError || (state?.smartthings?.deviceCount ? `${state.smartthings.deviceCount} device(s) synced` : "Not linked")}
          accessories={[{ text: state?.smartthings?.lastError ? "ERROR" : state?.smartthings?.deviceCount ? "READY" : "SETUP", color: state?.smartthings?.lastError ? Color.Red : state?.smartthings?.deviceCount ? Color.Green : Color.SecondaryText }]}
        />
      </List.Section>

      <List.Section title="Schedules & Routines">
        <List.Item icon={Icon.PlusCircle} title="Add Schedule…" subtitle="Daily alarm for AC, bulb, or scene" actions={<ActionPanel><Action.Push icon={Icon.PlusCircle} title="Open Add Schedule Form" target={<AddScheduleForm />} /></ActionPanel>} />
        <List.Item icon={Icon.Bolt} title="Schedule Presets" subtitle="7am safety, 11pm sleep, sunset, wake, panic-net" actions={<ActionPanel><Action.Push icon={Icon.Bolt} title="Open Schedule Presets" target={<SchedulePresetsList />} /></ActionPanel>} />
        <List.Item icon={Icon.List} title="View Active Schedules" subtitle="List current daily/weekly alarms" actions={<ActionPanel><Action.Push icon={Icon.List} title="View Schedules" target={<ViewSchedules />} /></ActionPanel>} />
        <List.Item icon={Icon.Trash} title="Clear All Schedules" subtitle="Wipe the entire schedule (irreversible)" actions={<ActionPanel><Action icon={Icon.Trash} title="Clear All Schedules" onAction={async () => { const toast = await showToast({ style: Toast.Style.Animated, title: "Clearing schedules..." }); try { const res = await fetch(hubUrl("control/schedule/clear")); const data = await res.json(); toast.style = Toast.Style.Success; toast.title = `Cleared ${data.cleared} schedule${data.cleared === 1 ? "" : "s"}`; } catch { toast.style = Toast.Style.Failure; toast.title = "Failed"; toast.message = "Hub Offline"; } }} /></ActionPanel>} />
      </List.Section>
    </List>
  );
}

function SmartThingsLinkForm({
  onDone,
  defaultToken,
  defaultLocationId,
}: {
  onDone: () => void;
  defaultToken: string;
  defaultLocationId: string;
}) {
  const { pop } = useNavigation();
  const [token, setToken] = useState(defaultToken);
  const [locationId, setLocationId] = useState(defaultLocationId);

  async function handleSubmit(values: { token: string; locationId?: string }) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Linking SmartThings..." });
    try {
      const res = await fetch(hubUrl("control/smartthings/link"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "SmartThings link failed");
      }
      toast.style = Toast.Style.Success;
      toast.title = "SmartThings linked";
      toast.message = `${data.deviceCount || 0} device(s) synced`;
      onDone();
      pop();
    } catch (error: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "SmartThings link failed";
      toast.message = error.message || "Unknown error";
    }
  }

  return (
    <Form
      navigationTitle="Link SmartThings"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save SmartThings PAT" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Gravity uses the token directly. If you also know the Location ID, you can paste it here so the hub can keep it with your SmartThings setup. If your input is a 36-character UUID, that is usually the Location ID, not the PAT." />
      <Form.TextField id="token" title="SmartThings PAT" placeholder="eyJ..." value={token} onChange={setToken} autoFocus />
      <Form.TextField id="locationId" title="Location ID" placeholder="UUID from SmartThings" value={locationId} onChange={setLocationId} />
    </Form>
  );
}

function SmartThingsSetupGuide() {
  const markdown = `
# SmartThings Setup

## 1. Create the token

Go to [account.smartthings.com/tokens](https://account.smartthings.com/tokens) and create a Personal Access Token for the Samsung account that owns your devices.

## 2. Where to put it

- In Gravity: use **Control House** or the **Device Sync** page and paste the PAT there.
- In Raycast: open the **Gravity Hub** extension settings. If the preferences do not show up yet, reload the extension after running the local dev server.

## 3. What the Location ID is

The Location ID is the UUID for your SmartThings home/location. It is **not** a device ID.

Gravity does not need it for basic device control, but the official Raycast SmartThings connector asks for it and some API calls can use it as a filter.

## 4. How to find it

Use the SmartThings API with your PAT:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_PAT" https://api.smartthings.com/v1/locations
\`\`\`

Look for the \`locationId\` field in the response and paste that UUID into the Location ID field when you want to keep it on hand.

If you already have Gravity Hub open, the **Device Sync** page can also list your locations straight from the same PAT, which is handy if you want to test the third-party Raycast connector without leaving the app.

## 5. Good test order

1. Save the PAT.
2. Sync devices.
3. Test a simple switch or light.
4. Move on to monitor / TV / media controls once the token works.
`;

  return <Detail markdown={markdown} />;
}

function SmartThingsRawCommandForm({
  device,
  onDone,
  onRun,
}: {
  device: NonNullable<HubState["smartthings"]>["devices"][number];
  onDone: () => void;
  onRun: (deviceId: string, capability: string, command: string, argsJson: string) => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [capability, setCapability] = useState((device.capabilities?.[0] || "switch").toString());
  const [command, setCommand] = useState("on");
  const [args, setArgs] = useState("");

  async function handleSubmit() {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Sending SmartThings command..." });
    try {
      await onRun(device.id, capability.trim(), command.trim(), args);
      toast.style = Toast.Style.Success;
      toast.title = "SmartThings command sent";
      onDone();
      pop();
    } catch (error: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "SmartThings command failed";
      toast.message = error.message || "Unknown error";
    }
  }

  return (
    <Form navigationTitle={`Raw Command: ${device.name}`} actions={<ActionPanel><Action.SubmitForm title="Send Command" onSubmit={handleSubmit} /></ActionPanel>}>
      <Form.Description text="Use this when a device exposes a capability the quick buttons do not cover. If the device has the capability, SmartThings will try to run it." />
      <Form.TextField id="capability" title="Capability" value={capability} onChange={setCapability} />
      <Form.TextField id="command" title="Command" value={command} onChange={setCommand} />
      <Form.TextField id="args" title="Arguments JSON" placeholder='["optional","args"]' value={args} onChange={setArgs} />
    </Form>
  );
}

function SolisSetupGuide() {
  const guide = `
# SolisCloud API Activation Guide ☀️📨

Looking at your dashboard, it seems the **API Management** menu is currently hidden. This is common for personal accounts and requires a one-time activation from their side.

### 🛑 **Step 1: Apply for Access** (Mandatory)
According to Solis documentation, you must first contact their technical support to "Verify and Activate" API access for your account:
- **Email**: \`ussupport@solisinv.com\` (or your regional Solis support).
- **Subject**: Request for API Access Activation - Praduman Khachar
- **Content**: "Please activate the API Management portal for my account (\`pkhachar@gmail.com\`) to allow integration with my personal dashboard."

### 🔧 **Step 2: Activation (Once Unlocked)**
Once they reply, you will see a new **API Management** option under the **Service** tab:
1.  Go to **Service** -> **API Management**.
2.  Click **Activate Now**.
3.  Complete the Email Verification (Puzzle + Code).
4.  Copy your **KeyId** and **SecretKey**.

### 🧬 **Plant Details**
- **Plant ID**: \`1298491919450000328\`
- **Current Flow**: Currently syncing via **Session Pulse** (18.7 kWh) until your persistent keys are live.

Restart the Hub once you have the keys!
  `;
  return <Detail markdown={guide} />;
}

/**
 * Add a new schedule. Submits to /control/schedule/add.
 * Supports a preset (daily / weekdays / weekends / custom) and per-day
 * checkboxes when 'custom' is picked.
 */
function AddScheduleForm() {
  const { pop } = useNavigation();
  const [time, setTime] = useState("07:00");
  const [action, setAction] = useState("ac_on");
  const [preset, setPreset] = useState("daily");
  const [mon, setMon] = useState(true);
  const [tue, setTue] = useState(true);
  const [wed, setWed] = useState(true);
  const [thu, setThu] = useState(true);
  const [fri, setFri] = useState(true);
  const [sat, setSat] = useState(false);
  const [sun, setSun] = useState(false);

  function computeDays(): string {
    if (preset === "daily") return "daily";
    if (preset === "weekdays") return "weekdays";
    if (preset === "weekends") return "weekends";
    // custom: build comma-separated list from checked days
    const dayMap: Record<string, boolean> = {
      monday: mon, tuesday: tue, wednesday: wed, thursday: thu,
      friday: fri, saturday: sat, sunday: sun,
    };
    const selected = Object.entries(dayMap).filter(([, v]) => v).map(([k]) => k);
    if (selected.length === 0) return "daily"; // sane default if none selected
    if (selected.length === 7) return "daily";
    return selected.join(",");
  }

  function applyPreset(p: string) {
    setPreset(p);
    if (p === "daily") { setMon(true); setTue(true); setWed(true); setThu(true); setFri(true); setSat(true); setSun(true); }
    if (p === "weekdays") { setMon(true); setTue(true); setWed(true); setThu(true); setFri(true); setSat(false); setSun(false); }
    if (p === "weekends") { setMon(false); setTue(false); setWed(false); setThu(false); setFri(false); setSat(true); setSun(true); }
    // "custom" doesn't auto-flip checkboxes
  }

  async function handleSubmit() {
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      await showToast({ title: "Time must be HH:MM (24h)", style: Toast.Style.Failure });
      return;
    }
    const days = computeDays();
    const toast = await showToast({ title: `Adding schedule: ${action} @ ${time} (${days})`, style: Toast.Style.Animated });
    try {
      const res = await fetch(hubUrl("control/schedule/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time, action, days }),
      });
      const text = await res.text();
      // Old bot (pre v1.2.0): returns 'Gravity: Scene ADD Active' instead of JSON
      if (!text.startsWith("{")) {
        throw new Error(
          "Bot is on an older version. Run 'Gravity Hub(Start)' from Raycast to restart with schedule support."
        );
      }
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);
      toast.style = Toast.Style.Success;
      toast.title = `Scheduled: ${action} @ ${time}`;
      toast.message = `Recurrence: ${days}`;
      pop();
    } catch (e: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to add schedule";
      toast.message = String(e?.message || "Hub Offline");
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Schedule" icon={Icon.PlusCircle} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Add a daily/weekly alarm. The bot will fire the action at the specified time." />
      <Form.TextField
        id="time"
        title="Time (HH:MM 24h)"
        placeholder="07:00"
        value={time}
        onChange={setTime}
        info="Examples: 07:00, 23:30, 06:15"
      />
      <Form.Dropdown
        id="action"
        title="Action"
        value={action}
        onChange={setAction}
        info="What should happen at the scheduled time"
      >
        <Form.Dropdown.Item value="ac_on" title="❄️  AC: Turn ON" />
        <Form.Dropdown.Item value="ac_off" title="❄️  AC: Turn OFF" />
        <Form.Dropdown.Item value="ac_set_cool_24" title="❄️  AC: Cool 24°C" />
        <Form.Dropdown.Item value="ac_set_cool_26" title="❄️  AC: Cool 26°C (sleep)" />
        <Form.Dropdown.Item value="bulb_on" title="💡  Bulb: Turn ON" />
        <Form.Dropdown.Item value="bulb_off" title="💡  Bulb: Turn OFF" />
        <Form.Dropdown.Item value="bulb_warm" title="💡  Bulb: Warm White 2700K" />
        <Form.Dropdown.Item value="bulb_cool" title="💡  Bulb: Cool White 6500K" />
        <Form.Dropdown.Item value="scene_tv" title="🎬  Scene: TV Time" />
        <Form.Dropdown.Item value="scene_focus" title="🎬  Scene: Focus" />
        <Form.Dropdown.Item value="scene_bedtime" title="🎬  Scene: Bedtime" />
        <Form.Dropdown.Item value="scene_sunrise" title="🎬  Scene: Sunrise" />
        <Form.Dropdown.Item value="scene_cozy" title="🎬  Scene: Cozy" />
        <Form.Dropdown.Item value="scene_party" title="🎬  Scene: Party" />
        <Form.Dropdown.Item value="aura_toggle" title="🌈  Aura: Toggle" />
        <Form.Dropdown.Item value="panic" title="🛑  PANIC: Turn everything off" />
      </Form.Dropdown>
      <Form.Separator />
      <Form.Dropdown
        id="preset"
        title="Recurrence"
        value={preset}
        onChange={applyPreset}
        info="Pick a preset, or 'Custom' to choose individual days below"
      >
        <Form.Dropdown.Item value="daily" title="Every day" />
        <Form.Dropdown.Item value="weekdays" title="Weekdays only (Mon-Fri)" />
        <Form.Dropdown.Item value="weekends" title="Weekends only (Sat-Sun)" />
        <Form.Dropdown.Item value="custom" title="Custom days…" />
      </Form.Dropdown>
      {preset === "custom" ? (
        <>
          <Form.Checkbox id="mon" label="Monday" value={mon} onChange={setMon} />
          <Form.Checkbox id="tue" label="Tuesday" value={tue} onChange={setTue} />
          <Form.Checkbox id="wed" label="Wednesday" value={wed} onChange={setWed} />
          <Form.Checkbox id="thu" label="Thursday" value={thu} onChange={setThu} />
          <Form.Checkbox id="fri" label="Friday" value={fri} onChange={setFri} />
          <Form.Checkbox id="sat" label="Saturday" value={sat} onChange={setSat} />
          <Form.Checkbox id="sun" label="Sunday" value={sun} onChange={setSun} />
        </>
      ) : null}
      <Form.Separator />
      <Form.Description text="Tip: The safe 7am routine is 'AC Turn ON at 07:00 weekdays' + 'AC Turn OFF at 07:10 weekdays' — that gives you a hard 10-min cap." />
    </Form>
  );
}

/**
 * View active schedules. Fetches /control/schedule/list.
 * Each schedule is a row with delete, so the user can surgically remove one
 * without nuking the whole list.
 */
function ViewSchedules() {
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    setError(null);
    setJobs(null);
    fetch(hubUrl("control/schedule/list"))
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .catch(() => setError("Hub Offline"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function removeOne(id: string, label: string) {
    setBusyId(id);
    const toast = await showToast({ style: Toast.Style.Animated, title: `Removing: ${label}…` });
    try {
      const res = await fetch(hubUrl("control/schedule/remove"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      toast.style = Toast.Style.Success;
      toast.title = "Removed";
      toast.message = label;
      // Optimistic local removal
      setJobs((prev) => (prev ? prev.filter((j) => j.id !== id) : prev));
    } catch (e: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to remove";
      toast.message = String(e?.message || "Hub Offline");
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <HubOfflineDetail context="schedule list" onRetry={refresh} />;
  }
  if (!jobs) {
    return <Detail isLoading={true} markdown="Loading schedules..." />;
  }
  if (jobs.length === 0) {
    const emptyMsg = "# 📅 No Active Schedules\n\nYou have no scheduled routines. Add one from **Control House > Schedules > Add Schedule**.";
    return <Detail markdown={emptyMsg} />;
  }
  const table = `| # | Time | Action | Days | Last Run |
|---|------|--------|------|----------|
${jobs.map((j, i) => `| ${i + 1} | \`${j.time}\` | \`${j.action}\` | ${j.days || 'daily'} | ${j.lastRun || '—'}`).join("\n")}`;
  return (
    <List searchBarPlaceholder="Search schedules (try time, action, or day)…" isLoading={false}>
      <List.Section title={`Active Schedules (${jobs.length})`}>
        {jobs.map((j, i) => {
          const id = j.id || `legacy-${i}`;
          const label = `${j.time} ${j.action} (${j.days || 'daily'})`;
          return (
            <List.Item
              key={id}
              title={j.time}
              subtitle={`${j.action} · ${j.days || 'daily'}`}
              icon={busyId === id ? { source: Icon.CircleProgress, tintColor: Color.Yellow } : { source: Icon.Clock, tintColor: Color.Blue }}
              accessories={[
                ...(j.lastRun ? [{ text: `last: ${j.lastRun}` }] : []),
              ]}
              actions={
                <ActionPanel title={label}>
                  <Action
                    icon={Icon.Trash}
                    title={`Remove ${label}`}
                    shortcut={{ modifiers: ["cmd"], key: "delete" }}
                    onAction={() => removeOne(id, label)}
                  />
                  <Action
                    icon={Icon.Repeat}
                    title="Refresh"
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={refresh}
                  />
                  <Action.CopyToClipboard
                    icon={Icon.Clipboard}
                    title="Copy Job as JSON"
                    content={JSON.stringify(j, null, 2)}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
      <List.Section title="Bulk">
        <List.Item
          title="Copy all as Markdown table"
          subtitle="Paste into a note or chat"
          icon={Icon.Clipboard}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy Markdown Table" content={table} />
            </ActionPanel>
          }
        />
        <List.Item
          title="View as Detail (markdown)"
          subtitle="Open the legacy table view"
          icon={Icon.Text}
          actions={
            <ActionPanel>
              <Action.Push title="Open Detail View" target={<Detail markdown={`# 📅 Active Schedules (${jobs.length})\n\n${table}\n\n---\n\n*Use ⌘⌫ on any row to remove that schedule. Refresh: ⌘R.*`} />} />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
