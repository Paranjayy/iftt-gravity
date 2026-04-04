"use server";

import fs from "fs/promises";
import path from "path";
import { MiraieAdapter } from "../../lib/adapters/miraie";

const CONFIG_PATH = path.join(process.cwd(), "config.json");

async function readConfig(): Promise<any> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function writeConfig(config: any): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function getDashboardData() {
  return readConfig();
}

export async function linkMiraie(mobile: string, password: string) {
  try {
    const adapter = new MiraieAdapter(mobile, password);
    const { token, userId } = await adapter.login();
    const devices = await adapter.fetchDevices();

    if (devices.length === 0) {
      return { success: false, error: "Logged in but no AC devices found on this account." };
    }

    const config = await readConfig();
    config.miraie = {
      mobile,
      password,   // stored locally only — never sent to any 3rd party
      accessToken: token,
      userId,
      devices: devices.map(d => ({
        id: d.deviceId,
        name: d.deviceName,
        online: d.activeStatus,
        topicPub: d.topic.pub,
        topicSub: d.topic.sub,
      })),
      linkedAt: new Date().toISOString(),
    };
    await writeConfig(config);

    return {
      success: true,
      deviceCount: devices.length,
      devices: config.miraie.devices,
    };
  } catch (err: any) {
    console.error("MirAie link error:", err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data?.message || "Login failed. Check your mobile number and password.",
    };
  }
}

export async function controlMiraieAC(deviceId: string, command: {
  power?: boolean;
  temperature?: number;
  mode?: 'COOL' | 'DRY' | 'FAN' | 'AUTO' | 'HEAT';
}) {
  try {
    const config = await readConfig();
    if (!config.miraie) return { success: false, error: "MirAie not linked yet." };

    const adapter = new MiraieAdapter(config.miraie.mobile, config.miraie.password);
    await adapter.login();
    await adapter.fetchDevices();

    await adapter.controlDevice(deviceId, {
      ...(command.power !== undefined && { ps: command.power ? '1' : '0' }),
      ...(command.temperature && { tm: command.temperature }),
      ...(command.mode && { md: { COOL: '0', DRY: '1', FAN: '2', AUTO: '3', HEAT: '4' }[command.mode] }),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveDeviceSettings(deviceType: string, settings: any) {
  try {
    if (deviceType === "miraie") {
      return linkMiraie(settings.mobile || settings.email, settings.password);
    }
    const config = await readConfig();
    config[deviceType] = { ...config[deviceType], ...settings, updatedAt: new Date().toISOString() };
    await writeConfig(config);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
