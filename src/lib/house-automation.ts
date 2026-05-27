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

  if (manualOverrideActive && (macThermalLevel === null || macThermalLevel < severeThreshold) && (roomTemp === null || roomTemp < Number(guard.roomOverrideTemp ?? 36))) {
    return {
      action: "none",
      reason: "manual-override-active",
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
  const res = await fetch("https://api.smartthings.com/v1/devices", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Unable to load SmartThings devices");
  }
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(normalizeSmartThingsDevice);
}

export async function fetchSmartThingsLocations(token: string): Promise<SmartThingsLocationSnapshot[]> {
  const res = await fetch("https://api.smartthings.com/v1/locations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Unable to load SmartThings locations");
  }
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((location: any) => ({
    id: location?.locationId || location?.id,
    name: location?.name || location?.locationName || "SmartThings Location",
    countryCode: location?.countryCode,
  }));
}

export async function sendSmartThingsCommand(
  token: string,
  deviceId: string,
  capability: string,
  command: string,
  args: any[] = []
) {
  const res = await fetch(`https://api.smartthings.com/v1/devices/${deviceId}/commands`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || "SmartThings command failed");
  }

  return res.json().catch(() => ({}));
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
