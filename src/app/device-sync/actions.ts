"use server";

import fs from "fs/promises";
import path from "path";
import { MiraieAdapter } from "../../lib/adapters/miraie";
import { HomeyAdapter } from "../../lib/adapters/homey";

const CONFIG_PATH = path.join(process.cwd(), "config.json");

async function readConfig(): Promise<any> {
  try { return JSON.parse(await fs.readFile(CONFIG_PATH, "utf-8")); }
  catch { return {}; }
}

async function writeConfig(config: any): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function getDashboardData() {
  return readConfig();
}

// ─── MirAie ───────────────────────────────────────────
export async function linkMiraie(mobile: string, password: string) {
  try {
    const m = mobile.trim().replace(/^\+91/, "").replace(/^91/, "").replace(/\s/g, "");
    const adapter = new MiraieAdapter(m, password);
    const { token, userId } = await adapter.login();
    const devices = await adapter.fetchDevices();

    if (!devices.length)
      return { success: false, error: "Logged in but no AC devices found on this account." };

    const config = await readConfig();
    config.miraie = {
      mobile: m, password, accessToken: token, userId,
      devices: devices.map(d => ({
        id: d.deviceId, name: d.deviceName, online: d.activeStatus,
        topicPub: d.topic.pub, topicSub: d.topic.sub,
      })),
      linkedAt: new Date().toISOString(),
    };
    await writeConfig(config);
    return { success: true, deviceCount: devices.length, devices: config.miraie.devices };
  } catch (err: any) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error("MirAie error:", JSON.stringify(err.response?.data ?? err.message));
    return { success: false, error: msg || "Login failed. Check mobile number and password." };
  }
}

export async function controlMiraieAC(deviceId: string, command: {
  power?: boolean; temperature?: number; mode?: "COOL" | "DRY" | "FAN" | "AUTO" | "HEAT";
}) {
  try {
    const config = await readConfig();
    if (!config.miraie) return { success: false, error: "MirAie not linked." };
    const adapter = new MiraieAdapter(config.miraie.mobile, config.miraie.password);
    await adapter.login();
    await adapter.fetchDevices();
    await adapter.controlDevice(deviceId, {
      ...(command.power !== undefined && { ps: command.power ? "on" : "off" }),
      ...(command.temperature && { actmp: command.temperature }),
      ...(command.mode && { acmd: command.mode.toLowerCase() }),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Telegram ────────────────────────────────────────
export async function linkTelegram(token: string, chatId: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) return { success: false, error: "Invalid bot token. Get one from @BotFather." };

    const config = await readConfig();
    config.telegram = {
      token, chatId: chatId.trim(),
      username: data.result.username,
      botName: data.result.first_name,
      linkedAt: new Date().toISOString(),
    };
    await writeConfig(config);
    
    // Send a test message
    if (chatId.trim()) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId.trim(), text: "⚡ Gravity connected! Bot is live." }),
      });
    }
    return { success: true, username: data.result.username, botName: data.result.first_name };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── WiZ ─────────────────────────────────────────────
// WiZ uses local UDP which only works at runtime from Node server, not buildtime
// We store the IP and test it via a UDP ping server-side
export async function linkWiz(ip: string, name?: string) {
  try {
    const cleanIp = ip.trim();
    if (!cleanIp.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/))
      return { success: false, error: "Enter a valid local IP address (e.g. 192.168.1.105)" };

    // We save first, then test on first use (UDP only works on LAN, not in Actions sandbox)
    const config = await readConfig();
    config.wiz = {
      ip: cleanIp,
      name: name || "Bedroom Light",
      linkedAt: new Date().toISOString(),
    };
    await writeConfig(config);
    return { success: true, ip: cleanIp };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Homey ────────────────────────────────────────────
export async function linkHomey(token: string, homeyId: string) {
  try {
    const adapter = new HomeyAdapter(token, homeyId.trim());
    const devices = await adapter.fetchDevices();

    const config = await readConfig();
    config.homey = {
      token, homeyId: homeyId.trim(),
      deviceCount: devices.length,
      devices: devices.slice(0, 20).map(d => ({
        id: d.id, name: d.name, class: d.class, available: d.available,
      })),
      linkedAt: new Date().toISOString(),
    };
    await writeConfig(config);
    return { success: true, deviceCount: devices.length };
  } catch (err: any) {
    const msg = err.response?.data?.error || err.message;
    return { success: false, error: msg || "Failed to connect to Homey. Check token and Homey ID." };
  }
}

// ─── Legacy compat ────────────────────────────────────
export async function saveDeviceSettings(deviceType: string, settings: any) {
  if (deviceType === "miraie") return linkMiraie(settings.mobile || settings.email, settings.password);
  if (deviceType === "telegram") return linkTelegram(settings.token, settings.chatId || "");
  if (deviceType === "wiz") return linkWiz(settings.ip, settings.name);
  if (deviceType === "homey") return linkHomey(settings.token, settings.homeyId);
  const config = await readConfig();
  config[deviceType] = { ...config[deviceType], ...settings, updatedAt: new Date().toISOString() };
  await writeConfig(config);
  return { success: true };
}
