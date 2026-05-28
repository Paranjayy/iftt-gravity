import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const CONFIG_PATH = path.join(process.cwd(), "config.json");

export type AutomationSource = "manual" | "automation";

export interface CoolingDecision {
  action: "none" | "start" | "stop" | "adjust";
  reason: string;
  targetTemp?: number;
  mode?: "COOL" | "DRY" | "FAN" | "AUTO" | "HEAT";
  fan?: "LOW" | "MED" | "HIGH" | "AUTO";
}

export interface CoolingPolicyInput {
  now?: Date;
  roomTemp?: number | null;
  macThermalLevel?: number | null;
  acOn: boolean;
  config: any;
}

export interface SmartThingsDeviceSnapshot {
  id: string;
  name: string;
  type: "tv" | "monitor" | "light" | "switch" | "sensor" | "other";
  online: boolean;
  capabilities: string[];
  lastSeen: string;
}

export interface SmartThingsLocationSnapshot {
  id: string;
  name: string;
  countryCode?: string;
}

export interface SmartThingsSceneSnapshot {
  id: string;
  name: string;
  locationId?: string;
  lastExecutedAt?: string;
}

export interface SmartThingsModeSnapshot {
  id: string;
  name: string;
  locationId?: string;
  current?: boolean;
}

export interface SmartThingsRoomSnapshot {
  id: string;
  name: string;
  locationId?: string;
  deviceCount?: number;
}

const SMARTTHINGS_ERROR_PREVIEW = 280;

function stripWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function previewSmartThingsBody(value: string) {
  return stripWhitespace(value).slice(0, SMARTTHINGS_ERROR_PREVIEW);
}

function extractSmartThingsMessage(payload: any): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) return payload.map(extractSmartThingsMessage).filter(Boolean).join(" | ");
  if (typeof payload !== "object") return "";
  const fields = [
    payload.error,
    payload.message,
    payload.detail,
    payload.details,
    payload.description,
    payload.cause,
  ];
  return fields
    .flatMap((field) => Array.isArray(field) ? field : [field])
    .filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)
    .map((value) => String(value).trim())
    .join(" | ");
}

async function readSmartThingsFailure(endpoint: string, res: Response, fallback: string): Promise<string> {
  const body = await res.text().catch(() => "");
  let parsed = "";
  try {
    parsed = extractSmartThingsMessage(body ? JSON.parse(body) : null);
  } catch {
    parsed = "";
  }

  const preview = previewSmartThingsBody(body);
  const statusText = `${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;
  const detail = parsed || preview || "";

  console.error("[SmartThings] Request failed", {
    endpoint,
    status: res.status,
    statusText: res.statusText,
    preview,
  });

  return detail
    ? `${fallback} (${statusText}) ${detail}`
    : `${fallback} (${statusText})`;
}

async function smartThingsJson<T>(
  endpoint: string,
  token: string,
  init: RequestInit,
  fallback: string,
  allowFailure = false
): Promise<T | null> {
  const res = await fetch(`https://api.smartthings.com/v1${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const message = await readSmartThingsFailure(endpoint, res, fallback);
    if (allowFailure) return null;
    throw new Error(message);
  }

  if (res.status === 204) return {} as T;
  return res.json().catch(() => ({} as T));
}

export function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export async function readHouseConfig(): Promise<any> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export async function writeHouseConfig(config: any): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getPrimaryMiraieDevice(config: any): string | null {
  return config?.miraie?.devices?.[0]?.id || config?.miraie?.devices?.[0]?.deviceId || null;
}

export function isWithinQuietHours(now: Date, quietHours?: { start?: string; end?: string }) {
  const start = quietHours?.start || "23:00";
  const end = quietHours?.end || "07:00";
  const current = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) return current >= startMinutes && current < endMinutes;
  return current >= startMinutes || current < endMinutes;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function evaluateCoolingDecision(input: CoolingPolicyInput): CoolingDecision {
  const now = input.now || new Date();
  const guard = input.config?.automation?.acGuard || {};
  const thresholds = guard.thresholds || {};
  const startThreshold = Number(thresholds.start ?? 75);
  const stopThreshold = Number(thresholds.stop ?? 60);
  const severeThreshold = Number(thresholds.severe ?? 85);
  const quietHours = guard.quietHours || { start: "23:00", end: "07:00" };
  const inQuietHours = isWithinQuietHours(now, quietHours);

  const macThermalLevel = typeof input.macThermalLevel === "number" ? input.macThermalLevel : null;
  const roomTemp = typeof input.roomTemp === "number" ? input.roomTemp : null;
  const manualOverrideUntil = guard.manualOverrideUntil ? new Date(guard.manualOverrideUntil).getTime() : 0;
  const manualOverrideActive = manualOverrideUntil > now.getTime();
  const cooldownUntil = guard.cooldownUntil ? new Date(guard.cooldownUntil).getTime() : 0;
  const cooldownActive = cooldownUntil > now.getTime();
  const lastActionAt = guard.lastActionAt ? new Date(guard.lastActionAt).getTime() : 0;
  const recentActionActive = lastActionAt > 0 && (now.getTime() - lastActionAt) < Number(guard.minActionGapMs ?? 20 * 60 * 1000);

  if (manualOverrideActive && (macThermalLevel === null || macThermalLevel < severeThreshold) && (roomTemp === null || roomTemp < Number(guard.roomOverrideTemp ?? 36))) {
    return {
      action: "none",
      reason: "manual-override-active",
    };
  }

  if (cooldownActive && (macThermalLevel === null || macThermalLevel < severeThreshold) && (roomTemp === null || roomTemp < Number(guard.roomRestartTemp ?? 34))) {
    return {
      action: "none",
      reason: "cooldown-active",
    };
  }

  if (recentActionActive && (macThermalLevel === null || macThermalLevel < severeThreshold) && (roomTemp === null || roomTemp < Number(guard.roomRestartTemp ?? 34))) {
    return {
      action: "none",
      reason: "recent-action-debounce",
    };
  }

  const wantsStart = (
    (macThermalLevel !== null && macThermalLevel >= startThreshold) ||
    (roomTemp !== null && roomTemp >= Number(guard.roomStartThreshold ?? 31))
  );

  if (!input.acOn && wantsStart) {
    if (inQuietHours && (macThermalLevel === null || macThermalLevel < severeThreshold) && (roomTemp === null || roomTemp < Number(guard.roomQuietStartThreshold ?? 35))) {
      return {
        action: "none",
        reason: "quiet-hours-blocked-start",
      };
    }

    const targetTemp = Number(
      macThermalLevel !== null && macThermalLevel >= severeThreshold
        ? guard.severeTargetTemp ?? 18
        : roomTemp !== null && roomTemp >= 35
          ? guard.hotRoomTargetTemp ?? 20
          : guard.targetTemp ?? 24
    );

    return {
      action: "start",
      reason: macThermalLevel !== null ? "mac-thermal-trigger" : "room-heat-trigger",
      targetTemp: targetTemp,
      mode: "COOL",
      fan: macThermalLevel !== null && macThermalLevel >= severeThreshold ? "HIGH" : "AUTO",
    };
  }

  if (input.acOn) {
    const coolEnough = (
      macThermalLevel !== null && macThermalLevel <= stopThreshold
    ) || (
      roomTemp !== null && roomTemp <= Number(guard.roomStopThreshold ?? 27)
    );

    if (coolEnough && (guard.active === true || macThermalLevel !== null)) {
      return {
        action: "stop",
        reason: macThermalLevel !== null ? "mac-thermal-recovered" : "room-cooled",
      };
    }

    if (inQuietHours && guard.active === true) {
      return {
        action: "stop",
        reason: "quiet-hours-stop",
      };
    }

    if (macThermalLevel !== null && macThermalLevel >= startThreshold && roomTemp !== null && roomTemp > Number(guard.stagedTemp ?? 23)) {
      return {
        action: "adjust",
        reason: "reduce-to-comfort",
        targetTemp: Number(guard.stagedTemp ?? 23),
        mode: "COOL",
        fan: "AUTO",
      };
    }
  }

  return {
    action: "none",
    reason: "no-change",
  };
}

export async function getMacThermalLevel(): Promise<number | null> {
  try {
    const { stdout } = await execAsync("sysctl -n machdep.xcpm.cpu_thermal_level");
    const level = parseInt(stdout.trim(), 10);
    return Number.isFinite(level) ? level : null;
  } catch {
    return null;
  }
}

export function normalizeSmartThingsDevice(device: any): SmartThingsDeviceSnapshot {
  const capabilities: string[] = Array.isArray(device?.components)
    ? device.components.flatMap((component: any) =>
        Array.isArray(component?.capabilities)
          ? component.capabilities.map((cap: any) => cap?.id).filter(Boolean)
          : []
      )
    : [];

  const name = device?.label || device?.name || "SmartThings Device";
  const rawType = String(device?.deviceTypeName || device?.label || device?.name || "").toLowerCase();
  const capSet = new Set(capabilities.map(cap => String(cap).toLowerCase()));

  let type: SmartThingsDeviceSnapshot["type"] = "other";
  if (rawType.includes("monitor") || rawType.includes("display")) type = "monitor";
  else if (rawType.includes("tv") || capSet.has("tvchannel") || capSet.has("switch")) type = "tv";
  else if (rawType.includes("light") || capSet.has("switchlevel") || capSet.has("colorcontrol")) type = "light";
  else if (capSet.has("switch")) type = "switch";
  else if (capSet.has("sensor")) type = "sensor";

  return {
    id: device?.deviceId || device?.id,
    name,
    type,
    online: device?.roomId !== undefined ? true : device?.deviceState?.healthStatus !== "offline",
    capabilities,
    lastSeen: new Date().toISOString(),
  };
}

export async function fetchSmartThingsDevices(token: string): Promise<SmartThingsDeviceSnapshot[]> {
  const data = await smartThingsJson<{ items?: any[] }>("/devices", token, {}, "Unable to load SmartThings devices");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(normalizeSmartThingsDevice);
}

export async function fetchSmartThingsLocations(token: string): Promise<SmartThingsLocationSnapshot[]> {
  const data = await smartThingsJson<{ items?: any[] }>("/locations", token, {}, "Unable to load SmartThings locations");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((location: any) => ({
    id: location?.locationId || location?.id,
    name: location?.name || location?.locationName || "SmartThings Location",
    countryCode: location?.countryCode,
  }));
}

export async function fetchSmartThingsScenes(token: string): Promise<SmartThingsSceneSnapshot[]> {
  const data = await smartThingsJson<{ items?: any[] }>("/scenes", token, {}, "Unable to load SmartThings scenes");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((scene: any) => ({
    id: scene?.sceneId || scene?.id,
    name: scene?.name || scene?.sceneName || "SmartThings Scene",
    locationId: scene?.locationId,
    lastExecutedAt: scene?.lastExecutedAt || scene?.lastExecuted || undefined,
  }));
}

export async function fetchSmartThingsRooms(token: string, locationId: string): Promise<SmartThingsRoomSnapshot[]> {
  const data = await smartThingsJson<{ items?: any[] }>(`/locations/${locationId}/rooms`, token, {}, "Unable to load SmartThings rooms");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((room: any) => ({
    id: room?.roomId || room?.id,
    name: room?.name || room?.roomName || "SmartThings Room",
    locationId: room?.locationId || locationId,
    deviceCount: room?.deviceCount ?? room?.devices?.length ?? undefined,
  }));
}

export async function fetchSmartThingsRoomDevices(token: string, locationId: string, roomId: string): Promise<SmartThingsDeviceSnapshot[]> {
  const data = await smartThingsJson<{ items?: any[] }>(`/locations/${locationId}/rooms/${roomId}/devices`, token, {}, "Unable to load SmartThings room devices");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(normalizeSmartThingsDevice);
}

export async function executeSmartThingsScene(token: string, sceneId: string) {
  return smartThingsJson(`/scenes/${sceneId}/execute`, token, {
    method: "POST",
  }, "SmartThings scene execution failed");
}

export async function fetchSmartThingsModes(token: string, locationId: string): Promise<SmartThingsModeSnapshot[]> {
  const data = await smartThingsJson<{ items?: any[] }>(`/locations/${locationId}/modes`, token, {}, "Unable to load SmartThings modes");
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((mode: any) => ({
    id: mode?.modeId || mode?.id,
    name: mode?.name || mode?.label || "SmartThings Mode",
    locationId: mode?.locationId || locationId,
    current: Boolean(mode?.current),
  }));
}

export async function fetchSmartThingsCurrentMode(token: string, locationId: string): Promise<SmartThingsModeSnapshot | null> {
  const mode = await smartThingsJson<any>(`/locations/${locationId}/modes/current`, token, {}, "Unable to load SmartThings current mode", true);
  if (!mode) return null;
  return {
    id: mode?.modeId || mode?.id,
    name: mode?.name || mode?.label || "Current Mode",
    locationId: mode?.locationId || locationId,
    current: true,
  };
}

export async function setSmartThingsCurrentMode(token: string, locationId: string, modeId: string) {
  return smartThingsJson(`/locations/${locationId}/modes/current`, token, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ modeId }),
  }, "SmartThings mode change failed");
}

export async function sendSmartThingsCommand(
  token: string,
  deviceId: string,
  capability: string,
  command: string,
  args: any[] = []
) {
  return smartThingsJson(`/devices/${deviceId}/commands`, token, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      commands: [
        {
          component: "main",
          capability,
          command,
          arguments: args,
        },
      ],
    }),
  }, "SmartThings command failed");
}

export function buildSmartThingsPresetActions(device: SmartThingsDeviceSnapshot) {
  const caps = new Set(device.capabilities.map(cap => cap.toLowerCase()));
  return {
    canPower: caps.has("switch"),
    canDim: caps.has("switchlevel"),
    canColorTemp: caps.has("colortemperature"),
    canMedia: caps.has("mediaplayback"),
    canMute: caps.has("audiomute"),
    canChannel: caps.has("tvchannel"),
  };
}
