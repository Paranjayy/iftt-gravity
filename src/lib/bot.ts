/**
 * Gravity Bot Engine 🤖
 * 
 * Central hub for Telegram, Hardware (WiZ/MirIAE), and IFTT automation.
 * Dedicated Port: 3030
 */

import { TelegramAdapter } from './adapters/telegram';
import { MiraieAdapter } from './adapters/miraie';
import { WizAdapter } from './adapters/wiz';
import { WeatherEngine } from './weather';
import { CodexSDK } from './codex';
import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import os from 'os';

const execAsync = promisify(exec);
const ROOT_DIR = "/Users/paranjay/Developer/iftt";
const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
const LOG_PATH = path.join(ROOT_DIR, 'house_log.md');

declare const Bun: any;

async function speak(text: string) {
  try { await execAsync(`say "${text.replace(/"/g, '')}"`); }
  catch (e) { console.warn('Voice output failed'); }
}

async function getSystemIdleTime(): Promise<number> {
  try {
    const { stdout } = await execAsync("ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'");
    return parseFloat(stdout.trim()) || 0;
  } catch { return 0; }
}

async function getSpotifyStatus(): Promise<string | null> {
  if (os.platform() !== 'darwin') return null;
  try {
    const script = `
      if application "Spotify" is running then
        tell application "Spotify"
          try
            set tName to name of current track
            set aName to artist of current track
            set pState to player state as string
            if pState is "playing" then
              return tName & " - " & aName
            end if
          end try
        end tell
      end if
      return "stopped"
    `;
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const res = stdout.trim();
    return (res === "stopped" || res === "") ? null : res;
  } catch { return null; }
}

async function getBatteryStatus(): Promise<{ level: number, isPlugged: boolean } | null> {
  try {
    const { stdout } = await execAsync("pmset -g batt");
    const level = parseInt(stdout.match(/\d+%/)?.[0] || '0');
    const isPlugged = stdout.includes('AC Power');
    return { level, isPlugged };
  } catch { return null; }
}

function logActivity(text: string) {
  const stamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const entry = `[${stamp}] ${text}\n`;
  fs.appendFileSync(LOG_PATH, entry);
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveConfig(config: any) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }
  catch (e) { console.error('Failed to save config', e); }
}

function isAuthorized(msg: any) {
  const config = loadConfig();
  const userId = msg.from?.id || msg.chat?.id;
  return config.authorizedUsers?.includes(userId);
}

function calculatePgvclBill(units: number) {
  let bill = units * 4.05; // Base
  bill += units * 2.50; // FPPPA
  bill *= 1.18; // 18% Tax
  return bill.toFixed(2);
}

// 🤖 Heartbeat / Pulse tracking
function updateBotPulse(config: any) {
  config.stats = config.stats || {};
  config.stats.bot = config.stats.bot || {};
  config.stats.bot.lastPulse = new Date().toISOString();
  saveConfig(config);
}

let config: any;
let bot: any;
let miraie: MiraieAdapter | null = null;
let wiz: WizAdapter | null = null;

async function triggerScene(name: string) {
  console.log(`🎬 Triggering scene: ${name}`);
  const deviceId = miraie?.devices[0]?.deviceId;
  
  if (name === 'chill') {
    if (deviceId) await miraie?.controlDevice(deviceId, { ps: 'on', actmp: '24', acmd: 'cool' });
    await wiz?.executeAction({ type: 'control', payload: { state: true, r: 0, g: 191, b: 255, dimming: 50 } });
  } else if (name === 'tv') {
    await wiz?.executeAction({ type: 'control', payload: { state: true, r: 155, g: 48, b: 255, dimming: 10 } });
  } else if (name === 'home') {
    await wiz?.executeAction({ type: 'control', payload: { state: true, temp: 2700, dimming: 100 } });
  } else if (name === 'away') {
    if (deviceId) await miraie?.controlDevice(deviceId, { ps: 'off' });
    await wiz?.executeAction({ type: 'control', payload: { state: false } });
  }
}

async function main() {
  config = loadConfig();
  console.log('🤖 Gravity Bot Hub: Starting Pulse...');

  const TELEGRAM_TOKEN = config.telegram?.token;
  if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN not set');
    process.exit(1);
  }
  
  bot = new TelegramAdapter(TELEGRAM_TOKEN);

  if (config.miraie?.mobile && config.miraie?.password) {
    miraie = new MiraieAdapter(config.miraie.mobile, config.miraie.password);
    await miraie.initialize().catch(() => console.warn('❄️ AC Offline'));
  }

  if (config.wiz?.ip) {
    wiz = new WizAdapter(config.wiz.ip);
  }

  // 🚀 MAIN API (Port 3030)
  try {
    (Bun as any).serve({
      port: 3030,
      async fetch(req: any) {
        const url = new URL(req.url);
        const sceneName = url.pathname.startsWith('/scene/') ? url.pathname.split('/').pop() : null;

        if (url.pathname === '/status') {
          return new Response(JSON.stringify(config.stats), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        
        if (url.pathname === '/control/aura/toggle') {
          config.mediaAura = !config.mediaAura;
          saveConfig(config);
          return new Response(JSON.stringify({ status: 'toggled', mediaAura: config.mediaAura }), { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/control/auto/ac') {
          config.autoAc = !config.autoAc;
          saveConfig(config);
          return new Response(JSON.stringify({ status: 'toggled', autoAc: config.autoAc }), { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/control/auto/light') {
          config.autoLight = !config.autoLight;
          saveConfig(config);
          return new Response(JSON.stringify({ status: 'toggled', autoLight: config.autoLight }), { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (sceneName) {
          await triggerScene(sceneName);
          return new Response(`Gravity: Scene ${sceneName} Active`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        return new Response("Gravity Main Hub Active (Port 3030)", { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    });
    console.log('🌐 Hub API (3030) Operational.');
  } catch(e) { console.warn('API 3030 error'); }

  // 🏥 Health & Maintenance
  setInterval(() => {
    updateBotPulse(config);
  }, 60000);

  bot.startPolling();

  const PLATFORM = os.platform() === 'darwin' ? 'Local Mac' : 'Remote Hub';
  const startTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  
  const acText = config.stats?.ac?.status || config.stats?.ac || 'OFF';
  const lightText = config.stats?.light?.status || config.stats?.light || 'OFF';
  
  const startMsg = `🟢 *Gravity Hub: ONLINE*\n━━━━━━━━━━━━━━\n🏗 Platform: *${PLATFORM}*\n⏰ Started: *${startTime} IST*\n❄️ AC: *${acText.toString().toUpperCase()}* | 💡 Light: *${lightText.toString().toUpperCase()}*\n━━━━━━━━━━━━━━\nType /help for God Mode v4.6`;
  
  for (const userId of (config.authorizedUsers || [])) {
    try { bot.sendMessage(userId, startMsg, { parse_mode: 'Markdown' }); } catch {}
  }
  console.log(`🚀 Gravity Hub ONLINE [${PLATFORM}]. Polling started.`);

  // ── Shutdown Guardian ─────────────────────────────
  const shutdown = async (signal: string) => {
    const stopTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const stopMsg = `🔴 *Gravity went OFFLINE*\n━━━━━━━━━━━━━━\n⏰ Stopped: *${stopTime} IST*\n❄️ Signal: \`${signal}\`\n━━━━━━━━━━━━━━\nHub will not respond until restarted.`;
    
    for (const userId of (config.authorizedUsers || [])) {
      try { await bot.sendMessage(userId, stopMsg, { parse_mode: 'Markdown' }); } catch {}
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
