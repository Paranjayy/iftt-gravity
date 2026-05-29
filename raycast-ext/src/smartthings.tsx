"use client";

import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Form,
  getPreferenceValues,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import fetch from "node-fetch";

interface Preferences {
  smartThingsPat?: string;
}

interface HubState {
  smartthings?: {
    linked?: boolean;
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
  };
}

interface SmartThingsScene {
  id: string;
  name: string;
  locationId?: string;
  lastExecutedAt?: string;
}

interface SmartThingsLocation {
  id: string;
  name: string;
  countryCode?: string;
}

interface SmartThingsMode {
  id: string;
  name: string;
  locationId?: string;
  current?: boolean;
}

interface SmartThingsRoom {
  id: string;
  name: string;
  locationId?: string;
  deviceCount?: number;
}

type SmartThingsDevice = {
  id: string;
  name: string;
  type?: string;
  online?: boolean;
  capabilities?: string[];
};

type SmartThingsAction = {
  title: string;
  icon: any;
  capability: string;
  command: string;
  args?: any[];
};

export default function SmartThingsCommand() {
  const preferences = getPreferenceValues<Preferences>();
  const [state, setState] = useState<HubState | null>(null);
  const [scenes, setScenes] = useState<SmartThingsScene[]>([]);
  const [locations, setLocations] = useState<SmartThingsLocation[]>([]);
  const [modes, setModes] = useState<SmartThingsMode[]>([]);
  const [rooms, setRooms] = useState<SmartThingsRoom[]>([]);
  const [currentMode, setCurrentMode] = useState<SmartThingsMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locationId = state?.smartthings?.locationId || "";

  async function fetchJson<T>(url: string, init?: any): Promise<T> {
    const res = await fetch(url, init);
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || `Request failed: ${res.status}`);
    }
    return data as T;
  }

  async function refresh() {
    try {
      const [status, scenesResponse, locationsResponse, roomsResponse, modesResponse] = await Promise.all([
        fetchJson<HubState>("http://127.0.0.1:3030/status"),
        fetchJson<{ scenes: SmartThingsScene[] }>("http://127.0.0.1:3030/control/smartthings/scenes").catch(() => ({ scenes: [] })),
        fetchJson<{ locations: SmartThingsLocation[] }>("http://127.0.0.1:3030/control/smartthings/locations").catch(() => ({ locations: [] })),
        locationId
          ? fetchJson<{ rooms: SmartThingsRoom[] }>(
              `http://127.0.0.1:3030/control/smartthings/rooms?locationId=${encodeURIComponent(locationId)}`
            ).catch(() => ({ rooms: [] }))
          : Promise.resolve({ rooms: [] }),
        locationId
          ? fetchJson<{ modes: SmartThingsMode[]; currentMode?: SmartThingsMode }>(
              `http://127.0.0.1:3030/control/smartthings/modes?locationId=${encodeURIComponent(locationId)}`
            ).catch(() => ({ modes: [], currentMode: null as any }))
          : Promise.resolve({ modes: [], currentMode: null as any }),
      ]);

      setState(status);
      setScenes(scenesResponse.scenes || []);
      setLocations(locationsResponse.locations || []);
      setRooms(roomsResponse.rooms || []);
      setModes(modesResponse.modes || []);
      setCurrentMode(modesResponse.currentMode || null);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Hub Offline");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [locationId]);

  async function runAction(name: string, endpoint: string, init?: any) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
    try {
      const res = await fetch(`http://127.0.0.1:3030${endpoint}`, init);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed");
      }
      toast.style = Toast.Style.Success;
      toast.title = `Confirmed: ${name}`;
      setTimeout(refresh, 400);
    } catch (e: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "Action Failed";
      toast.message = e.message || "Hub Offline";
    }
  }

  const smartthingsDevices = state?.smartthings?.devices || [];
  const linked = Boolean(state?.smartthings?.linked || smartthingsDevices.length);
  const currentModeLabel = currentMode?.name || "Unknown";

  const modeItems = useMemo(() => {
    return modes.map((mode) => ({
      ...mode,
      active: currentMode?.id ? mode.id === currentMode.id : mode.current,
    }));
  }, [modes, currentMode]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search SmartThings devices, scenes, or modes...">
      <List.Section title="SmartThings Setup">
        <List.Item
          icon={Icon.Key}
          title="Link or Update Token"
          subtitle={linked
            ? `${smartthingsDevices.length} devices${locationId ? ` · ${locationId.slice(0, 8)}…` : ""}${state?.smartthings?.lastSyncedAt ? " · refreshed" : ""}`
            : preferences.smartThingsPat
              ? "Raycast prefs already have a token"
              : "Add a SmartThings PAT"}
          actions={
            <ActionPanel>
              <Action.Push
                title="Open Link Form"
                icon={Icon.Key}
                target={<SmartThingsLinkForm onDone={refresh} defaultToken={preferences.smartThingsPat || ""} defaultLocationId={locationId} />}
              />
              <Action
                title="Sync Devices"
                icon={Icon.Repeat}
                onAction={() => runAction("SmartThings Sync", "/control/smartthings/sync")}
              />
              <Action.OpenInBrowser title="Open Device Sync" url="http://127.0.0.1:3000/device-sync" />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.QuestionMark}
          title="Location ID"
          subtitle={locationId ? `Using ${locationId}` : "Load it from PAT or save it in Raycast prefs"}
          actions={
            <ActionPanel>
              <Action
                title="Load Locations"
                icon={Icon.Download}
                onAction={() => runAction("Load SmartThings Locations", "/control/smartthings/locations")}
              />
              <Action.OpenInBrowser title="Open Device Sync" url="http://127.0.0.1:3000/device-sync" />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Sun}
          title="Location Mode"
          subtitle={currentMode ? currentModeLabel : "No mode loaded"}
          accessories={currentMode ? [{ text: currentModeLabel, color: Color.Green }] : []}
          actions={
            <ActionPanel>
              <Action title="Refresh Modes" icon={Icon.Repeat} onAction={refresh} />
            </ActionPanel>
          }
        />
      </List.Section>

      {modeItems.length ? (
        <List.Section title="Location Modes">
          {modeItems.map((mode) => (
            <List.Item
              key={mode.id}
              icon={mode.active ? Icon.CheckCircle : Icon.Circle}
              title={mode.name}
              subtitle={mode.active ? "Current mode" : "Available location mode"}
              accessories={[{ text: mode.active ? "ACTIVE" : "READY", color: mode.active ? Color.Green : undefined }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Set Current Mode"
                    icon={Icon.CheckCircle}
                    onAction={() =>
                      runAction(`Set Mode ${mode.name}`, `/control/smartthings/mode?locationId=${encodeURIComponent(locationId)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ modeId: mode.id }),
                      })
                    }
                  />
                  <Action.CopyToClipboard title="Copy Mode ID" content={mode.id} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}

      {rooms.length ? (
        <List.Section title="Rooms">
          {rooms.map((room) => (
            <List.Item
              key={room.id}
              icon={Icon.House}
              title={room.name}
              subtitle={room.deviceCount ? `${room.deviceCount} device(s)` : "Room"}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Open Room"
                    icon={Icon.House}
                    target={
                      <SmartThingsRoomDetail
                        room={room}
                        locationId={locationId}
                        onDone={refresh}
                      />
                    }
                  />
                  <Action.CopyToClipboard title="Copy Room ID" content={room.id} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}

      {scenes.length ? (
        <List.Section title="Scenes">
          {scenes.map((scene) => (
            <List.Item
              key={scene.id}
              icon={Icon.Play}
              title={scene.name}
              subtitle={scene.lastExecutedAt ? `Last used ${new Date(scene.lastExecutedAt).toLocaleString()}` : "Scene available to execute"}
              accessories={[{ text: "SCENE", color: Color.Green }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Execute Scene"
                    icon={Icon.Play}
                    onAction={() =>
                      runAction(`Scene ${scene.name}`, "/control/smartthings/scene", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sceneId: scene.id }),
                      })
                    }
                  />
                  <Action.CopyToClipboard title="Copy Scene ID" content={scene.id} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}

      {locations.length ? (
        <List.Section title="Locations">
          {locations.map((location) => (
            <List.Item
              key={location.id}
              icon={Icon.Globe}
              title={location.name}
              subtitle={location.countryCode ? `Country ${location.countryCode}` : "SmartThings location"}
              accessories={[{ text: location.id === locationId ? "ACTIVE" : "READY", color: location.id === locationId ? Color.Green : undefined }]}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard title="Copy Location ID" content={location.id} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}

      {smartthingsDevices.length ? (
        <List.Section title="Devices">
          {smartthingsDevices.map((device) => (
            <List.Item
              key={device.id}
              icon={device.type === "monitor" ? Icon.Desktop : device.type === "light" ? Icon.LightBulb : Icon.Desktop}
              title={device.name}
              subtitle={`${device.type || "device"} · ${device.capabilities?.slice(0, 4).join(", ") || "no capabilities listed"}`}
              accessories={[{ text: device.online ? "ONLINE" : "OFFLINE", color: device.online ? Color.Green : Color.Red }]}
              actions={
                <ActionPanel title="SmartThings Control">
                  {buildSmartThingsActionGroups(device).quick.length ? (
                    <ActionPanel.Section title="Quick Controls">
                      {buildSmartThingsActionGroups(device).quick.map((action) => (
                        <Action
                          key={`${device.id}-${action.capability}-${action.command}-${action.title}`}
                          title={action.title}
                          icon={action.icon}
                          onAction={() =>
                            runAction(
                              `SmartThings ${action.title}`,
                              `/control/smartthings?deviceId=${encodeURIComponent(device.id)}&capability=${encodeURIComponent(action.capability)}&command=${encodeURIComponent(action.command)}${action.args?.length ? `&args=${encodeURIComponent(JSON.stringify(action.args))}` : ""}`
                            )
                          }
                        />
                      ))}
                    </ActionPanel.Section>
                  ) : null}
                  {buildSmartThingsActionGroups(device).remote.length ? (
                    <ActionPanel.Section title="Remote Control">
                      {buildSmartThingsActionGroups(device).remote.map((action) => (
                        <Action
                          key={`${device.id}-${action.capability}-${action.command}-${action.title}`}
                          title={action.title}
                          icon={action.icon}
                          onAction={() =>
                            runAction(
                              `SmartThings ${action.title}`,
                              `/control/smartthings?deviceId=${encodeURIComponent(device.id)}&capability=${encodeURIComponent(action.capability)}&command=${encodeURIComponent(action.command)}${action.args?.length ? `&args=${encodeURIComponent(JSON.stringify(action.args))}` : ""}`
                            )
                          }
                        />
                      ))}
                    </ActionPanel.Section>
                  ) : null}
                  <Action.Push
                    title="Raw Capability Command"
                    icon={Icon.Terminal}
                    target={<SmartThingsRawCommandForm device={device} onDone={refresh} />}
                  />
                  <Action.CopyToClipboard title="Copy Device ID" content={device.id} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}

      <List.Section title="Context">
        <List.Item
          icon={Icon.Info}
          title="Location Sync"
          subtitle={error ? error : state?.smartthings?.lastError ? `Last error: ${state.smartthings.lastError}` : state?.smartthings?.lastSyncedAt ? `Last sync ${new Date(state.smartthings.lastSyncedAt).toLocaleString()}` : "No sync time yet"}
          accessories={[{ text: error ? "OFFLINE" : "LIVE", color: error ? Color.Red : Color.Green }]}
          actions={<ActionPanel><Action title="Refresh" icon={Icon.Repeat} onAction={refresh} /></ActionPanel>}
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
    </List>
  );
}

function buildSmartThingsActionGroups(device: SmartThingsDevice) {
  const caps = new Set((device.capabilities || []).map((cap: string) => String(cap).toLowerCase()));
  const quick: SmartThingsAction[] = [];
  const remote: SmartThingsAction[] = [];

  if (caps.has("switch")) {
    quick.push({ title: "On", icon: Icon.Power, capability: "switch", command: "on" });
    quick.push({ title: "Off", icon: Icon.Power, capability: "switch", command: "off" });
  }
  if (caps.has("switchlevel")) {
    quick.push({ title: "25%", icon: Icon.Minus, capability: "switchLevel", command: "setLevel", args: [25] });
    quick.push({ title: "50%", icon: Icon.Minus, capability: "switchLevel", command: "setLevel", args: [50] });
    quick.push({ title: "100%", icon: Icon.Plus, capability: "switchLevel", command: "setLevel", args: [100] });
  }
  if (caps.has("colortemperature")) {
    quick.push({ title: "Warm", icon: Icon.Sun, capability: "colorTemperature", command: "setColorTemperature", args: [2700] });
    quick.push({ title: "Daylight", icon: Icon.Sun, capability: "colorTemperature", command: "setColorTemperature", args: [5000] });
  }
  if (caps.has("audiomute")) {
    quick.push({ title: "Mute", icon: Icon.SpeakerOff, capability: "audioMute", command: "mute" });
    quick.push({ title: "Unmute", icon: Icon.SpeakerHigh, capability: "audioMute", command: "unmute" });
  }
  if (caps.has("mediaplayback")) {
    quick.push({ title: "Play", icon: Icon.Play, capability: "mediaPlayback", command: "play" });
    quick.push({ title: "Pause", icon: Icon.Pause, capability: "mediaPlayback", command: "pause" });
    quick.push({ title: "Stop", icon: Icon.Stop, capability: "mediaPlayback", command: "stop" });
  }
  if (caps.has("mediatrackcontrol")) {
    quick.push({ title: "Next", icon: Icon.ArrowRight, capability: "mediaTrackControl", command: "nextTrack" });
    quick.push({ title: "Previous", icon: Icon.ArrowLeft, capability: "mediaTrackControl", command: "previousTrack" });
  }

  if (caps.has("keypadinput")) {
    remote.push({ title: "Up", icon: Icon.ArrowUp, capability: "keypadInput", command: "sendKey", args: ["UP"] });
    remote.push({ title: "Down", icon: Icon.ArrowDown, capability: "keypadInput", command: "sendKey", args: ["DOWN"] });
    remote.push({ title: "Left", icon: Icon.ArrowLeft, capability: "keypadInput", command: "sendKey", args: ["LEFT"] });
    remote.push({ title: "Right", icon: Icon.ArrowRight, capability: "keypadInput", command: "sendKey", args: ["RIGHT"] });
    remote.push({ title: "Select", icon: Icon.Circle, capability: "keypadInput", command: "sendKey", args: ["SELECT"] });
    remote.push({ title: "Back", icon: Icon.ArrowLeft, capability: "keypadInput", command: "sendKey", args: ["BACK"] });
    remote.push({ title: "Home", icon: Icon.House, capability: "keypadInput", command: "sendKey", args: ["HOME"] });
    remote.push({ title: "Source", icon: Icon.Video, capability: "keypadInput", command: "sendKey", args: ["INPUT"] });
    remote.push({ title: "Menu", icon: Icon.List, capability: "keypadInput", command: "sendKey", args: ["MENU"] });
    remote.push({ title: "Guide", icon: Icon.List, capability: "keypadInput", command: "sendKey", args: ["GUIDE"] });
    remote.push({ title: "Power", icon: Icon.Power, capability: "keypadInput", command: "sendKey", args: ["POWER"] });
  }

  if (!quick.length) {
    quick.push({ title: "On", icon: Icon.Power, capability: "switch", command: "on" });
  }

  return { quick, remote };
}

function buildQuickActions(device: SmartThingsDevice) {
  return buildSmartThingsActionGroups(device).quick;
}

function SmartThingsRoomDetail({
  room,
  locationId,
  onDone,
}: {
  room: SmartThingsRoom;
  locationId: string;
  onDone: () => void;
}) {
  const [devices, setDevices] = useState<SmartThingsDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRoomDevices() {
    try {
      const res = await fetch(`http://127.0.0.1:3030/control/smartthings/room-devices?locationId=${encodeURIComponent(locationId)}&roomId=${encodeURIComponent(room.id)}`);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to load room devices");
      }
      setDevices(data.devices || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load room");
    } finally {
      setIsLoading(false);
    }
  }

  async function runRoomAction(device: SmartThingsDevice, action: SmartThingsAction) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Sending ${action.title}...` });
    try {
      const query = new URLSearchParams({
        deviceId: device.id,
        capability: action.capability,
        command: action.command,
      });
      if (action.args?.length) {
        query.set("args", JSON.stringify(action.args));
      }

      const res = await fetch(`http://127.0.0.1:3030/control/smartthings?${query.toString()}`);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed");
      }

      toast.style = Toast.Style.Success;
      toast.title = `Sent ${action.title}`;
      onDone();
      loadRoomDevices();
    } catch (e: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "SmartThings command failed";
      toast.message = e.message || "Hub Offline";
    }
  }

  useEffect(() => {
    // SmartThings room device fetching is intentionally lazy until we add a dedicated backend route.
    // For now, the room detail shows the room context and lets users continue from the room browser.
    loadRoomDevices();
  }, [locationId, room.id]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder={`Room: ${room.name}`}>
      <List.Section title={`Room: ${room.name}`}>
        <List.Item
          icon={Icon.House}
          title={room.name}
          subtitle={error || `${room.deviceCount || 0} device(s) in this room`}
          accessories={[{ text: error ? "CHECK ROOM" : "READY", color: error ? Color.Red : Color.Green }]}
          actions={
            <ActionPanel>
              <Action title="Refresh" icon={Icon.Repeat} onAction={loadRoomDevices} />
              <Action.CopyToClipboard title="Copy Room ID" content={room.id} />
            </ActionPanel>
          }
        />
      </List.Section>
      {devices.length ? (
        <List.Section title="Devices in Room">
          {devices.map((device) => (
            <List.Item
              key={device.id}
              icon={device.type === "monitor" ? Icon.Desktop : device.type === "light" ? Icon.LightBulb : Icon.Desktop}
              title={device.name}
              subtitle={`${device.type || "device"} · ${device.capabilities?.slice(0, 4).join(", ") || "no capabilities listed"}`}
              accessories={[{ text: device.online ? "ONLINE" : "OFFLINE", color: device.online ? Color.Green : Color.Red }]}
              actions={
                <ActionPanel title="Room Device Control">
                  {buildSmartThingsActionGroups(device).quick.length ? (
                    <ActionPanel.Section title="Quick Controls">
                      {buildSmartThingsActionGroups(device).quick.map((action) => (
                        <Action
                          key={`${device.id}-${action.capability}-${action.command}-${action.title}`}
                          title={action.title}
                          icon={action.icon}
                          onAction={() => runRoomAction(device, action)}
                        />
                      ))}
                    </ActionPanel.Section>
                  ) : null}
                  {buildSmartThingsActionGroups(device).remote.length ? (
                    <ActionPanel.Section title="Remote Control">
                      {buildSmartThingsActionGroups(device).remote.map((action) => (
                        <Action
                          key={`${device.id}-${action.capability}-${action.command}-${action.title}`}
                          title={action.title}
                          icon={action.icon}
                          onAction={() => runRoomAction(device, action)}
                        />
                      ))}
                    </ActionPanel.Section>
                  ) : null}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}
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
      const res = await fetch("http://127.0.0.1:3030/control/smartthings/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: any = await res.json();
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

function SmartThingsRawCommandForm({
  device,
  onDone,
}: {
  device: SmartThingsDevice;
  onDone: () => void;
}) {
  const { pop } = useNavigation();
  const [capability, setCapability] = useState((device.capabilities?.[0] || "switch").toString());
  const [command, setCommand] = useState("on");
  const [args, setArgs] = useState("");

  async function handleSubmit() {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Sending SmartThings command..." });
    try {
      const normalizedArgs = args.trim()
        ? (() => {
            try {
              const parsed = JSON.parse(args);
              return Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              return [args];
            }
          })()
        : [];
      const query = new URLSearchParams({
        deviceId: device.id,
        capability: capability.trim(),
        command: command.trim(),
      });
      if (normalizedArgs.length) {
        query.set("args", JSON.stringify(normalizedArgs));
      }
      const res = await fetch(`http://127.0.0.1:3030/control/smartthings?${query.toString()}`);
      const data: any = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "SmartThings command failed");
      }
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
    <Form
      navigationTitle={`Raw Command: ${device.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Command" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Use this when a device exposes a capability the quick buttons do not cover. If the device has the capability, SmartThings will try to run it." />
      <Form.TextField id="capability" title="Capability" value={capability} onChange={setCapability} />
      <Form.TextField id="command" title="Command" value={command} onChange={setCommand} />
      <Form.TextField id="args" title="Arguments JSON" placeholder='["optional","args"]' value={args} onChange={setArgs} />
    </Form>
  );
}
