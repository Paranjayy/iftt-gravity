import { NextResponse } from "next/server";
import {
  readHouseConfig,
  writeHouseConfig,
  getPrimaryMiraieDevice,
  getMacThermalLevel,
  evaluateCoolingDecision,
  fetchSmartThingsDevices,
  fetchSmartThingsLocations,
  fetchSmartThingsScenes,
  fetchSmartThingsRooms,
  fetchSmartThingsRoomDevices,
  fetchSmartThingsModes,
  fetchSmartThingsCurrentMode,
  executeSmartThingsScene,
  setSmartThingsCurrentMode,
  sendSmartThingsCommand,
} from "../../../lib/house-automation";
import { controlMiraieAC } from "../../../app/device-sync/actions";

export async function GET() {
  try {
    const config = await readHouseConfig();
    return NextResponse.json({
      automation: config.automation ?? {},
      miraie: {
        linked: Boolean(config.miraie?.devices?.length),
        deviceId: getPrimaryMiraieDevice(config),
        devices: config.miraie?.devices ?? [],
      },
      smartthings: {
        linked: Boolean(config.smartthings?.devices?.length),
        deviceCount: config.smartthings?.devices?.length ?? 0,
        devices: config.smartthings?.devices ?? [],
        lastSyncedAt: config.smartthings?.lastSyncedAt ?? null,
        locationId: config.smartthings?.locationId ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load house status" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const config = await readHouseConfig();
    const action = String(body.action || body.command || "").toLowerCase();

    if (action === "thermal-check") {
      const macThermalLevel = await getMacThermalLevel();
      const acOn = Boolean(config.automation?.acGuard?.active || config.stats?.ac?.status === "on");
      const decision = evaluateCoolingDecision({
        now: new Date(),
        macThermalLevel,
        roomTemp: typeof body.roomTemp === "number" ? body.roomTemp : null,
        acOn,
        config,
      });

      const deviceId = getPrimaryMiraieDevice(config);
      if (deviceId && decision.action === "start") {
        await controlMiraieAC(deviceId, {
          power: true,
          temperature: decision.targetTemp ?? 24,
          mode: decision.mode ?? "COOL",
          source: "automation",
        });
      } else if (deviceId && decision.action === "adjust") {
        await controlMiraieAC(deviceId, {
          power: true,
          temperature: decision.targetTemp ?? 23,
          mode: decision.mode ?? "COOL",
          source: "automation",
        });
      } else if (deviceId && decision.action === "stop") {
        await controlMiraieAC(deviceId, {
          power: false,
          source: "automation",
        });
      }

      return NextResponse.json({
        success: true,
        macThermalLevel,
        decision,
      });
    }

    if (action === "ac-start" || action === "ac-stop") {
      const deviceId = body.deviceId || getPrimaryMiraieDevice(config);
      if (!deviceId) return NextResponse.json({ success: false, error: "No MirAie device linked" }, { status: 400 });
      const payload =
        action === "ac-start"
          ? { power: true, temperature: Number(body.temperature ?? 24), mode: String(body.mode ?? "COOL").toUpperCase() as "COOL" | "DRY" | "FAN" | "AUTO" | "HEAT", source: "automation" as const }
          : { power: false, source: "automation" as const };
      const result = await controlMiraieAC(deviceId, payload);
      return NextResponse.json(result);
    }

    if (action === "smartthings-command") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      const result = await sendSmartThingsCommand(
        config.smartthings.token,
        body.deviceId,
        body.capability,
        body.name || body.command,
        Array.isArray(body.arguments) ? body.arguments : []
      );
      return NextResponse.json({ success: true, result });
    }

    if (action === "smartthings-scenes") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      const scenes = await fetchSmartThingsScenes(config.smartthings.token);
      return NextResponse.json({ success: true, scenes });
    }

    if (action === "smartthings-locations") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      const locations = await fetchSmartThingsLocations(config.smartthings.token);
      return NextResponse.json({ success: true, locations });
    }

    if (action === "smartthings-rooms") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      const locationId = String(body.locationId || config.smartthings?.locationId || "").trim();
      if (!locationId) {
        return NextResponse.json({ success: false, error: "Missing SmartThings locationId" }, { status: 400 });
      }
      const rooms = await fetchSmartThingsRooms(config.smartthings.token, locationId);
      return NextResponse.json({ success: true, rooms });
    }

    if (action === "smartthings-room-devices") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      const locationId = String(body.locationId || config.smartthings?.locationId || "").trim();
      const roomId = String(body.roomId || "").trim();
      if (!locationId) {
        return NextResponse.json({ success: false, error: "Missing SmartThings locationId" }, { status: 400 });
      }
      if (!roomId) {
        return NextResponse.json({ success: false, error: "Missing SmartThings roomId" }, { status: 400 });
      }
      const devices = await fetchSmartThingsRoomDevices(config.smartthings.token, locationId, roomId);
      return NextResponse.json({ success: true, devices });
    }

    if (action === "smartthings-execute-scene") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      if (!body.sceneId) {
        return NextResponse.json({ success: false, error: "Missing sceneId" }, { status: 400 });
      }
      const result = await executeSmartThingsScene(config.smartthings.token, String(body.sceneId));
      return NextResponse.json({ success: true, result });
    }

    if (action === "smartthings-modes" || action === "smartthings-current-mode") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      const locationId = String(body.locationId || config.smartthings?.locationId || "").trim();
      if (!locationId) {
        return NextResponse.json({ success: false, error: "Missing SmartThings locationId" }, { status: 400 });
      }
      if (action === "smartthings-current-mode") {
        const mode = await fetchSmartThingsCurrentMode(config.smartthings.token, locationId);
        return NextResponse.json({ success: true, mode });
      }
      const modes = await fetchSmartThingsModes(config.smartthings.token, locationId);
      const currentMode = await fetchSmartThingsCurrentMode(config.smartthings.token, locationId);
      return NextResponse.json({ success: true, modes, currentMode });
    }

    if (action === "smartthings-set-mode") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      const locationId = String(body.locationId || config.smartthings?.locationId || "").trim();
      if (!locationId) {
        return NextResponse.json({ success: false, error: "Missing SmartThings locationId" }, { status: 400 });
      }
      if (!body.modeId) {
        return NextResponse.json({ success: false, error: "Missing modeId" }, { status: 400 });
      }
      const result = await setSmartThingsCurrentMode(config.smartthings.token, locationId, String(body.modeId));
      return NextResponse.json({ success: true, result });
    }

    if (action === "smartthings-sync") {
      if (!config.smartthings?.token) {
        return NextResponse.json({ success: false, error: "SmartThings not linked" }, { status: 400 });
      }
      const devices = await fetchSmartThingsDevices(config.smartthings.token);
      config.smartthings.devices = devices.slice(0, 50).map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        online: device.online,
        capabilities: device.capabilities,
      }));
      config.smartthings.deviceCount = devices.length;
      config.smartthings.lastSyncedAt = new Date().toISOString();
      await writeHouseConfig(config);
      return NextResponse.json({ success: true, deviceCount: devices.length, devices: config.smartthings.devices, lastSyncedAt: config.smartthings.lastSyncedAt });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "House automation failed" }, { status: 500 });
  }
}
