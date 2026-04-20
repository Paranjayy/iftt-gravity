/**
 * Gravity Bot Engine
 * 
 * This is the central "brain" of the Gravity Telegram bot.
 * Run this via: bun src/lib/bot.ts
 * 
 * Commands registered:
 *   /ac on|off|cool|dry|fan|auto|<temp>
 *   /lights on|off|<brightness 1-100>|red|blue|green|warm|cool
 *   /status — show all device states
 */

import { TelegramAdapter } from './adapters/telegram';
import { MiraieAdapter } from './adapters/miraie';
import { WizAdapter } from './adapters/wiz';
import { WeatherEngine } from './weather';
import { CodexSDK } from './codex';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import os from 'os';

const execAsync = promisify(exec);
const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const LOG_PATH = path.join(process.cwd(), 'house_log.md');
const WISHLIST_PATH = path.join(process.cwd(), 'house_wishlist.md');
const VAULT_PATH = path.join(process.cwd(), 'prompt_vault.md');
declare const Bun: any;

async function speak(text: string) {
  try { await execAsync(`say "${text.replace(/"/g, '')}"`); }
  catch (e) { console.warn('Voice output failed (not on Mac?)'); }
}

async function getSystemIdleTime(): Promise<number> {
  try {
    const { stdout } = await execAsync("ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'");
    return parseFloat(stdout.trim()) || 0;
  } catch { return 0; }
}

function logActivity(text: string) {
  const stamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const entry = `[${stamp}] ${text}\n`;
  fs.appendFileSync(LOG_PATH, entry);
}

let lastBriefDate = "";
let lastEveningDate = "";

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveConfig(config: any) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }
  catch (e) { console.error('Failed to save config', e); }
}

// 🛡️ Notification Manager (Anti-Spam / Quiet Mode)
class NotificationManager {
  constructor(private bot: TelegramAdapter, private config: any) {}

  public async notify(text: string, priority: 'low' | 'high' | 'critical' = 'low') {
    const now = new Date();
    const istTime = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const [hour] = istTime.split(':').map(Number);

    // Quiet Hours: 11 PM to 7 AM
    const isQuietHours = hour >= 23 || hour < 7;
    
    // Only send if high priority, critical, or not quiet hours
    if (priority === 'critical' || priority === 'high' || !isQuietHours) {
      for (const userId of (this.config.authorizedUsers || [])) {
        try { await this.bot.sendMessage(userId, text, { parse_mode: 'Markdown' }); } catch {}
      }
    } else {
      logActivity(`[Suppressed] Quiet Mode: ${text.substring(0, 30)}...`);
    }
  }
}

// 🕰️ Gravity Scheduler (Cron / Solar / One-time)
class GravityScheduler {
  private jobs: any[] = [];
  
  constructor(private config: any, private actions: Record<string, Function>) {
    this.refresh();
  }

  public refresh() {
    this.jobs = this.config.scheduler || [];
  }

  public async check() {
    const now = new Date();
    const istTime = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    for (const job of this.jobs) {
      if (job.time === istTime && (job.days === 'daily' || job.days.includes(day))) {
        if (job.lastRun === istTime) continue;
        
        console.log(`[Scheduler] Triggering: ${job.name || job.action}`);
        const action = this.actions[job.action];
        if (action) {
          try { await action(job.params); } catch (e) { console.error(`Job ${job.action} failed:`, e); }
        }
        job.lastRun = istTime;

        // If it's a 'once' job, remove it after execution
        if (job.once) {
          this.config.scheduler = this.config.scheduler.filter((j: any) => j.id !== job.id);
          saveConfig(this.config);
          this.refresh();
        }
      }
    }
  }
}

// 🤖 Heartbeat / Pulse tracking for bot offtime calculation
function updateBotPulse(config: any) {
  config.stats.bot = config.stats.bot || {};
  config.stats.bot.lastPulse = new Date().toISOString();
  fs.writeFileSync(path.join(process.cwd(), 'config.json'), JSON.stringify(config, null, 2));
}

let config: any;
let bot: TelegramAdapter;

async function main() {
  config = loadConfig();
  
  // Session Stats
  let sessionAcMinutes = 0;
  let sessionLightMinutes = 0;
  if (!config.hubToken) {
    config.hubToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    saveConfig(config);
  }

  let isPhoneOnline = true; // tracking state
  let offlineCounter = 0;
  let offlineSince: number | null = null; // Debounce tracking

  const TELEGRAM_TOKEN = config.telegram?.token || process.env.TELEGRAM_TOKEN;
  if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN not set in .env.local or config.json');
    process.exit(1);
  }

  // Init adapters
  bot = new TelegramAdapter(TELEGRAM_TOKEN);
  const notifier = new NotificationManager(bot, config);

  // Initialize Codex SDK
  const codex = config.codexExportPath ? new CodexSDK(config.codexExportPath) : null;

  // Initialize Scheduler Actions
  const scheduler = new GravityScheduler(config, {
    ac_on: async () => {
      const d = miraie?.devices[0]?.deviceId;
      if (d) await miraie?.controlDevice(d, { ki: 1, cnt: "an", sid: "1", ps: 'on' });
    },
    ac_off: async () => {
      const d = miraie?.devices[0]?.deviceId;
      if (d) await miraie?.controlDevice(d, { ki: 1, cnt: "an", sid: "1", ps: 'off' });
    },
    bulb_on: async () => wiz?.executeAction({ type: 'control', payload: { state: true } }),
    bulb_off: async () => wiz?.executeAction({ type: 'control', payload: { state: false } }),
    bulb_dim: async (params: any) => wiz?.executeAction({ type: 'control', payload: { state: true, dimming: params.dim || 50 } }),
    scene: async (params: any) => triggerScene(params.name),
    speak: async (params: any) => speak(params.text),
    // 💤 Adaptive Sleep Curve (ACS)
    // Automated temp stepping: 11PM (24) -> 2AM (25) -> 5AM (26)
    sleep_curve: async () => {
      if (!miraie || miraie.devices.length === 0) return;
      const hour = new Date().getHours();
      let temp = '24';
      if (hour >= 2 && hour < 5) temp = '25';
      if (hour >= 5) temp = '26';
      
      await miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: temp, acmd: 'cool' });
      logActivity(`💤 ACS: Sleep curve pivot. Room set to ${temp}°C.`);
    }
  });

  // 🧱 RESILIENT STARTUP: Background all network tasks
  console.log('🧱 Intelligence Core: Waking up...');
  
  (async () => {
    try {
      await bot.initialize();
      console.log('✅ Telegram: Connected');
      
      // 🪄 Sync Command Suggestions (Slash menu)
      bot.setMyCommands([
        { command: 'status', description: 'Show all device states' },
        { command: 'ac', description: 'AC: on|off|cool|dry|<temp>' },
        { command: 'lights', description: 'Lights: on|off|<dim>|<color>' },
        { command: 'scene', description: 'Scenes: tv|home|away|party|list' },
        { command: 'history', description: 'Show energy usage history' },
        { command: 'ping', description: 'Check Hub health' },
        { command: 'test_feedback', description: 'Trial Sensory Feedback' },
        { command: 'login', description: 'Get secure token for dashboard' },
      ]).catch(() => {});
    } catch (e) {
      console.warn('⚠️ Telegram handshake delayed...');
    }
  })();

  // 🌙 Sleep Intelligence (Adaptive Sleep Curve)

  // 🌙 Sleep Intelligence (Adaptive Sleep Curve)
  class SleepCurveManager {
    private timers: NodeJS.Timeout[] = [];
    private active = false;
    public isActive() { return this.active; }
    public async start(chatId: string | number) {
      this.cancel();
      this.active = true;
      logActivity("Adaptive Sleep Curve: Initialized (24°C)");
      // Step 1: 2 hours later -> 25C
      this.timers.push(setTimeout(async () => {
        if (!this.active) return;
        await this.setTemp('25');
        await bot.sendMessage(chatId as number, "🌙 *Gravity ACS*: Phase 1 - Raising to 25°C for deep sleep.", { parse_mode: 'Markdown' });
      }, 2 * 60 * 60 * 1000));
      // Step 2: 4 hours later -> 26C
      this.timers.push(setTimeout(async () => {
        if (!this.active) return;
        await this.setTemp('26');
        await bot.sendMessage(chatId as number, "🌙 *Gravity ACS*: Phase 2 - Raising to 26°C for early morning comfort.", { parse_mode: 'Markdown' });
      }, 4 * 60 * 60 * 1000));
      // Final: 6 hours later -> 27C
      this.timers.push(setTimeout(async () => {
        if (!this.active) return;
        await this.setTemp('27');
        this.active = false;
        await bot.sendMessage(chatId as number, "☀️ *Gravity ACS*: Final Phase - Morning optimize at 27°C.", { parse_mode: 'Markdown' });
      }, 6 * 60 * 60 * 1000));
    }
    public cancel() {
      if (this.active) logActivity("Sleep Curve: Cancelled by override");
      this.timers.forEach(t => clearTimeout(t));
      this.timers = [];
      this.active = false;
    }
    private async setTemp(temp: string) {
      if (miraie && miraie.devices.length > 0) {
        // Comfort Index: If outdoor humidity > 70%, use DRY mode instead of COOL
        const weather = await new WeatherEngine().getWeather();
        const mode = (weather?.humidity || 0) > 70 ? 'dry' : 'cool';
        await miraie.controlDevice(miraie.devices[0].deviceId, { actmp: temp, acmd: mode });
        logActivity(`🌙 ACS: Set to ${temp}°C [Mode: ${mode.toUpperCase()} (Humidity: ${weather?.humidity || '?'}%)]`);
      }
    }
  }
  const sleepManager = new SleepCurveManager();

  let miraie: MiraieAdapter | null = null;
  if (config.miraie?.mobile && config.miraie?.password) {
    try {
      miraie = new MiraieAdapter(config.miraie.mobile, config.miraie.password);
      miraie.initialize()
        .then(() => console.log(`❄️ AC: Connected (${miraie?.devices.length} devices)`))
        .catch(() => console.warn('❄️ AC: Offline (Skipped)'));
      
      // Recovery: Seed historical data if missing
      if (!config.stats.dailyLog || config.stats.dailyLog.length === 0) {
        config.stats.dailyLog = [
          { date: '07/04/2026', ac: '0.0', light: '5.1' },
          { date: '10/04/2026', ac: '0.0', light: '2.4' }
        ];
        saveConfig(config);
      }
    } catch (e) {
      console.warn('⚠️ MirAie Setup failed');
    }
  }

  let wiz: WizAdapter | null = null;
  if (config.wiz?.ip) {
    try {
      wiz = new WizAdapter(config.wiz.ip);
      console.log('💡 Lights: Adapter ready');
    } catch (e) {
      console.warn('⚠️ Wiz Setup failed');
    }
  }

  // Calculate Bot Offtime
  const nowIso = new Date().toISOString();
  config.stats.bot = config.stats.bot || {};
  const lastPulse = config.stats.bot.lastPulse;
  let botOfftime = "Unknown";
  if (lastPulse) {
    const diff = Date.now() - new Date(lastPulse).getTime();
    if (diff > 120000) { // If more than 2 mins have passed since last pulse
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      botOfftime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    } else {
      botOfftime = "None (Restarted quickly)";
    }
  }
  config.stats.bot.bootedAt = nowIso;
  config.stats.bot.offtimeBeforeBoot = botOfftime;
  saveConfig(config);
  
  // Start Heartbeat
  setInterval(() => updateBotPulse(config), 60000);

  if (!config.stats.history) config.stats.history = [];
  // Ensure at least one point exists on boot
  if (config.stats.history.length === 0) {
    const stamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    config.stats.history.push({ time: stamp, ac: config.stats.acMinutes || 0, lights: config.stats.lightMinutes || 0 });
  }

  // Helper to calculate duration string
  const getDurationString = (lastChangedIso: string) => {
    if (!lastChangedIso) return "Unknown";
    const diff = Date.now() - new Date(lastChangedIso).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Helper to update state with timestamp
  const updateDeviceState = (type: 'ac' | 'light', status: string, isBotCommand = false) => {
    if (!config.stats[type]) config.stats[type] = { status: 'unknown', lastChanged: new Date().toISOString() };
    if (config.stats[type].status !== status) {
      config.stats[type].status = status;
      config.stats[type].lastChanged = new Date().toISOString();
      logActivity(`${type.toUpperCase()} State: ${status.toUpperCase()} (${isBotCommand ? 'Bot' : 'Manual/Remote'})`);
      
      // Reset AC monitor on state change
      if (type === 'ac') {
        acEfficiencyData.startTime = status === 'on' ? Date.now() : null;
        acEfficiencyData.startTemp = null;
        acEfficiencyData.alerted = false;
      }

      // If the change was manual (remote) or bot-triggered, it's still a habit pattern!
      recordHabit(`${type}_${status}`);
    }
  };

  // 💡 Blink Light Helper (Visual Alerts v4.7)
  async function blinkLight(blinks = 3, color = { r: 255, g: 0, b: 0 }) {
    if (!wiz) return;
    try {
      const originalPilot = await (wiz as any).getPilot();
      for (let i = 0; i < blinks; i++) {
        await (wiz as any).setPilot({ state: true, r: color.r, g: color.g, b: color.b, dimming: 100 });
        await new Promise(r => setTimeout(r, 800));
        await (wiz as any).setPilot({ state: true, dimming: 10 });
        await new Promise(r => setTimeout(r, 800));
      }
      if (originalPilot) {
        await (wiz as any).setPilot({
          state: originalPilot.state,
          dimming: originalPilot.dimming,
          r: originalPilot.r,
          g: originalPilot.g,
          b: originalPilot.b,
          temp: originalPilot.temp,
          sceneId: originalPilot.sceneId
        });
      }
    } catch (e) { console.error('Blink failed', e); }
  }

  let acEfficiencyData = {
    startTime: null as number | null,
    startTemp: null as number | null,
    alerted: false
  };

  // 🧠 Habit Recorder: Track manual intent
  const recordHabit = (command: string) => {
    const now = new Date();
    const day = now.getDay(); // 0-6
    const time = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
    if (!config.habits) config.habits = [];
    config.habits.push({ command, day, time, date: now.toISOString() });
    if (config.habits.length > 500) config.habits.shift();
    saveConfig(config);
  };

  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'start',
    description: 'Start Gravity Mission Control',
    handler: async (chatId, args, msg, send) => {
      // Forward to the interactive control panel immediately
      const matched = (bot as any).getHandlers().find((h: any) => h.command === 'control');
      if (matched) await matched.handler(chatId, [], msg, send);
    }
  });

  bot.registerCommand({
    command: 'pgvcl',
    description: 'Show latest PGVCL bill details',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      
      const pg = config.stats.pgvcl;
      
      // Fallback: Estimation Engine (v4.0.0 High-Fidelity)
      if (!pg || !config.pgvcl?.consumerId || config.pgvcl.consumerId === 'ENTER_ID') {
        const units = (config.stats.acMinutes / 60 * 1.65) + (config.stats.lightMinutes / 60 * 0.012);
        const bill = calculatePgvclBill(units);
        const roundedBill = Math.round(Number(bill));
        
        await send(`⚡ *Gravity Energy Insight (Estimation)*\n\n💰 Est. Month-to-Date: *₹${roundedBill}*\n🔌 Est. Usage: *${units.toFixed(1)} Units*\n⚠️ _Mode: Autonomous Estimation (Link PGVCL for live data)_`);
        return;
      }
      
      const estimate = calculatePgvclBill(Number(pg.units) || 0);
      await send(`⚡ *PGVCL Utility Status*\n\n💰 Scraped Bill: *₹${pg.amount}*\n🔌 Usage: *${pg.units} Units*\n📅 Scanned: _${new Date(pg.scannedAt).toLocaleString('en-IN')}_\n\n🧮 *Gravity Estimate*: *₹${estimate}*\n_(Includes Slabs, FPPPA & 18% Duty)_`);
    }
  });

  // ❄️ Mission Control Panel (Interactive v2.0)
  bot.registerCommand({
    command: 'control',
    description: 'Open the Interactive Control Panel',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      
      const subCommand = args[0];
      const deviceId = miraie?.devices[0]?.deviceId;
      const isCallback = !!(msg as any).callback_query_id;

      if (subCommand) {
        if (subCommand === 'ac_on') {
          if (deviceId) await miraie?.controlDevice(deviceId as string, { ps: 'on' });
          updateDeviceState('ac', 'on', true);
          recordHabit('ac_on');
        } else if (subCommand === 'ac_off') {
          if (deviceId) await miraie?.controlDevice(deviceId as string, { ps: 'off' });
          updateDeviceState('ac', 'off');
          recordHabit('ac_off');
        } else if (subCommand === 'bulb_on') {
          await wiz?.executeAction({ type: 'control', payload: { state: true } });
          updateDeviceState('light', 'on');
          recordHabit('light_on');
        } else if (subCommand === 'bulb_off') {
          await wiz?.executeAction({ type: 'control', payload: { state: false } });
          updateDeviceState('light', 'off');
          recordHabit('light_off');
        } else if (subCommand === 'temp_up' || subCommand === 'temp_down') {
           const s = deviceId ? await miraie?.getDeviceStatus(deviceId) : null;
           const cur = parseInt(s?.actmp || '24');
           const finalTemp = Math.min(30, Math.max(16, subCommand === 'temp_up' ? cur + 1 : cur - 1));
           if (deviceId) await miraie?.controlDevice(deviceId as string, { actmp: String(finalTemp), ps: 'on' });
        }

        // If it was a button click, we want to REFRESH the control panel instead of sending a new one
        if (msg.callback_query_id || args.includes('refresh')) {
           // We'll regenerate it below
        } else {
          return await send('✅ Command Sent');
        }
      }

      // Generate the Panel Content
      const acStatus = config.stats.ac?.status || 'unknown';
      const lightStatus = config.stats.light?.status || 'unknown';
      const acTemp = (await miraie?.getDeviceStatus(deviceId as string))?.actmp || '??';
      
      const panelText = `🎮 *Gravity Mission Control*\n━━━━━━━━━━━━━━\n❄️ *AC*: ${acStatus.toUpperCase()} (${acTemp}°C)\n💡 *Light*: ${lightStatus.toUpperCase()}\n━━━━━━━━━━━━━━\n_Panel auto-refreshes on click._`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: acStatus === 'on' ? '🚫 AC OFF' : '❄️ AC ON', callback_data: `control:ac_${acStatus === 'on' ? 'off' : 'on'}:refresh` },
            { text: lightStatus === 'on' ? '🌑 Light OFF' : '💡 Light ON', callback_data: `control:bulb_${lightStatus === 'on' ? 'off' : 'on'}:refresh` }
          ],
          [
            { text: '🌡️ Temp -1°', callback_data: 'control:temp_down:refresh' },
            { text: '🌡️ Temp +1°', callback_data: 'control:temp_up:refresh' }
          ],
          [
            { text: '📅 Schedules', callback_data: 'schedule' },
            { text: '🧠 Habits', callback_data: 'habits' }
          ],
          [
            { text: '✨ Today', callback_data: 'today' },
            { text: '📊 Status', callback_data: 'status' }
          ]
        ]
      };

      if (isCallback) {
        // Edit existing message for smooth transitions
        try {
          await (bot as any).sendRequest('editMessageText', {
            chat_id: chatId,
            message_id: (msg as any).message_id,
            text: panelText,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        } catch (e) {
          // Fallback if edit fails (e.g. content same)
          await (bot as any).sendMessage(chatId, panelText, { reply_markup: keyboard });
        }
      } else {
        await (bot as any).sendMessage(chatId, panelText, { reply_markup: keyboard });
      }
    }
  });

  // ── Presence Detection & Automations ───────────────
  const weather = new WeatherEngine();
  setInterval(async () => {
    const phoneIp = config.phoneIp || '192.168.29.50';
    try {
      await execAsync(`ping -c 1 -t 1 ${phoneIp}`).catch(() => {});
      const { stdout } = await execAsync(`arp -a`);
      const isPresent = stdout.includes(`(${phoneIp})`);

      if (isPresent) {
        if (!isPhoneOnline) {
          isPhoneOnline = true;
          offlineCounter = 0;
          logActivity("📱 Presence: Phone detected (HOME)");
          await triggerScene('HOME');
          
          const now = new Date();
          const hour = now.getHours();
          const dateStr = now.toDateString();
          if (hour >= 5 && hour < 11 && lastBriefDate !== dateStr) {
            lastBriefDate = dateStr;
            setTimeout(() => triggerScene('MORNING_BRIEF'), 5000);
          }
        } else {
          offlineCounter = 0;
        }
      } else {
        offlineCounter++;
        if (offlineCounter >= 4) {
          if (isPhoneOnline) {
            isPhoneOnline = false;
            logActivity("🚶 Presence: Phone disconnected (AWAY)");
          }
          
          // 🕰️ Run Scheduler Check
          await scheduler.check();

          // 🛡️ Ghost Sentry Check
          if (config.sentryActive !== false && !isPhoneOnline) {
             const idle = await getSystemIdleTime();
             if (idle < 10) { // Active movement detected
                const stamp = new Date().toLocaleTimeString();
                logActivity("🚨 SENTRY: Unauthorized activity detected!");
                speak("Warning! Unauthorized access. Alerting the owner.");
                await notifier.notify(`🚨 *GHOST SENTRY*: Activity detected while you are AWAY!\nTimestamp: \`${stamp}\`\nIdle Time: \`${idle.toFixed(1)}s\``, 'critical');
             }
          }
        }
      }
    } catch (e) {
      console.warn('Presence check failed', e);
    }
  }, 60000);

  // ──────────────────────────────────────────────────────
  // PGVCL Scraper (Hourly)
  // ──────────────────────────────────────────────────────
  setInterval(async () => {
    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto('https://www.pgvcl.com/consumer/index.php');
      // Scraper logic here...
      await browser.close();
    } catch (e) { console.error('PGVCL Scrape failed', e); }
  }, 3600000);

  // PGVCL Tariff Estimator (GERC 2024-25 RGP)
  const calculatePgvclBill = (units: number) => {
    let energyCharge = 0;
    if (units <= 50) energyCharge = units * 3.05;
    else if (units <= 100) energyCharge = (50 * 3.05) + (units - 50) * 3.50;
    else if (units <= 250) energyCharge = (50 * 3.05) + (50 * 3.50) + (units - 100) * 4.15;
    else energyCharge = (50 * 3.05) + (50 * 3.50) + (150 * 4.15) + (units - 250) * 5.20;
    
    const fpppa = units * 2.90; // Approx FPPPA
    const fixed = 50; // Fixed charge
    const subtotal = energyCharge + fpppa + fixed;
    const duty = subtotal * 0.15; // 15% Duty
    return (subtotal + duty).toFixed(2);
  };

  // ──────────────────────────────────────────────────────
  // Hourly Stats Persistence (For Dashboard Charts)
  // ──────────────────────────────────────────────────────
  setInterval(() => {
    const now = new Date();
    const stamp = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    config.stats.history.push({
      time: stamp,
      ac: config.stats.acMinutes || 0,
      lights: config.stats.lightMinutes || 0
    });

    // Keep last 24 points (1 day if hourly, or last 24 entries)
    if (config.stats.history.length > 24) config.stats.history.shift();
    
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }, 3600000); // Every 1 hour


  const isAuthorized = (msg: any) => {
    const auth = config.authorizedUsers || [];
    if (auth.length === 0) {
      config.authorizedUsers = [msg.from.id];
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      return true;
    }
    const isOwner = auth.includes(msg.from.id) || msg.from?.username === "paranjayy";
    const isGuest = config.guests?.some((g: any) => g.id === msg.from.id && g.expires > Date.now());
    return isOwner || isGuest;
  };

  const triggerScene = async (sceneId: string, extra?: any) => {
    sleepManager.cancel();
    const promises = [];
    logActivity(`🎬 Scene Trigger: ${sceneId}`);
    switch (sceneId) {
      case 'TV':
      case 'TV_TIME':
        logActivity("🎬 Scene: TV TIME (God Build)");
        if (wiz) {
          // Classic TV Bias lighting (Warm/Comfortable)
          promises.push(wiz.executeAction({ type: 'control', payload: { state: true, scene: 'TV time', dimming: 30 } }));
        }
        if (miraie && miraie.devices.length > 0) {
          // Quiet mode for movies
          await miraie.controlDevice(miraie.devices[0].deviceId, { ps: 'on', actmp: '24', acmd: 'cool', acfs: 'low' });
        }
        speak("Cinematic mode active. Enjoy your movie.");
        break;
      case "FOCUS":
        speak("Focus mode engaged. Time for deep work.");
        if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, temp: 6500, dimming: 100 } }));
        if (miraie && miraie.devices.length > 0) {
          const d = miraie.devices[0].deviceId;
          promises.push(miraie.controlDevice(d, { ps: 'on', actmp: '25', acmd: 'cool' }));
        }
        break;
      case "DINNER":
        speak("Dinner mode. Bon appetit.");
        if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, scene: 'Fireplace' } }));
        break;
      case "AWAY":
        speak("Goodbye. Everything is secured.");
        if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: false } }));
        if (miraie && miraie.devices.length > 0) promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ps: 'off' }));
        break;
      case "HOME":
        speak("Welcome back. Powering up your sanctuary.");
        if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, temp: 4500, dimming: 80 } }));
        if (miraie && miraie.devices.length > 0) promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ps: 'on', actmp: '25', acmd: 'cool' }));
        break;
      case "MORNING_BRIEF":
        const hours = (config.stats.acMinutes / 60).toFixed(1);
        const bill = calculatePgvclBill(Number(config.stats.pgvcl?.units || 0));
        speak(`Good morning Master. Hub is at peak health. AC ran for ${hours} hours. Current bill estimate is ${bill} rupees. System is autonomous.`);
        await (bot as any).sendMessage(config.telegram.chatId, `☀️ *Morning Briefing*\n\n❄️ AC Runtime: *${hours}h*\n🔌 Energy Rank: *S-Tier*\n💰 Estimated Bill: *₹${bill}*\n\nWelcome back to the grid.`, { parse_mode: 'Markdown' });
        break;
    }
    await Promise.all(promises);
  };


  // ──────────────────────────────────────────────────────
  // /whoami — Get your ID
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'whoami',
    description: 'Get your Telegram ID',
    handler: async (chatId, args, msg, send) => {
      await send(`👤 Your ID: \`${msg.from.id}\`\nUsername: @${msg.from.username || 'N/A'}`);
    }
  });

  bot.registerCommand({
    command: 'search',
    description: 'Search Telegram history via Codex SDK',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const query = args.join(' ');
      if (!query) return await send('Usage: /search [query]');
      
      if (!codex) return await send('❌ Codex SDK not initialized (missing export path).');
      
      const results = codex.search(query);
      if (results.length === 0) return await send(`🔍 No results found for "${query}"`);
      
      let response = `🔍 *Codex Search Results:* "${query}"\n━━━━━━━━━━━━━━\n`;
      results.forEach((r, i) => {
        const date = new Date(r.timestamp).toLocaleDateString('en-IN');
        response += `${i+1}. [${date}] ${r.content.substring(0, 100)}${r.content.length > 100 ? '...' : ''}\n\n`;
      });
      await send(response);
    }
  });

  bot.registerCommand({
    command: 'codex',
    description: 'Show Codex SDK stats and pins',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (!codex) return await send('❌ Codex SDK not initialized.');
      
      const stats = codex.getStats();
      const pins = codex.getPinned();
      
      let response = `🧠 *Codex Orchestrator Intelligence*\n━━━━━━━━━━━━━━\n`;
      response += `📊 *Stats*:\n`;
      response += `- Messages: \`${stats.totalMessages}\`\n`;
      response += `- Participants: \`${stats.participants.join(', ')}\`\n`;
      response += `- Media: \`${Object.entries(stats.mediaCounts).map(([k, v]) => `${k}:${v}`).join(', ')}\`\n\n`;
      
      if (pins.length > 0) {
        response += `📌 *Top Pinned Messages*:\n`;
        pins.slice(0, 3).forEach(p => {
          response += `- ${p.content.substring(0, 60)}...\n`;
        });
      }
      
      await send(response);
    }
  });

  bot.registerCommand({
    command: 'broadcast',
    description: 'Speak a message on the house speakers',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const text = args.join(' ');
      if (!text) return await send('Usage: /broadcast [message]');
      await speak(text);
      await send(`📢 *Broadcasting:* "${text}"`);
    }
  });

  bot.registerCommand({
    command: 'remember',
    description: 'Save a note to config',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (!config.notes) config.notes = [];
      config.notes.push({ text: args.join(' '), date: new Date().toISOString() });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      await send('✅ Note saved.');
    }
  });

  bot.registerCommand({
    command: 'guest',
    description: 'Generate a 1-hour guest access PIN',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      config.guestPin = { pin, expires: Date.now() + 3600000 }; // 1 hour
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      await send(`🔑 *Guest PIN:* \`${pin}\`\nValid for 1 hour for anyone to join via bot.`);
    }
  });

  bot.registerCommand({
    command: 'join',
    description: 'Join house as guest using a PIN',
    handler: async (chatId, args, msg, send) => {
      const pinArg = args[0];
      if (!pinArg) return await send('Usage: /join [PIN]');
      if (config.guestPin && config.guestPin.pin === pinArg && config.guestPin.expires > Date.now()) {
        if (!config.guests) config.guests = [];
        config.guests.push({ id: msg.from.id, expires: Date.now() + 3600000 });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        await send('🔓 *Access Granted!* You are now a guest for 1 hour.');
        speak(`A new guest has joined the house.`);
      } else {
        await send('❌ Invalid or expired PIN.');
      }
    }
  });

  bot.registerCommand({
    command: 'party',
    description: 'High energy party mode',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      speak("Party mode activated! Let's get loud!");
      if (wiz) await wiz.executeAction({ type: 'control', payload: { state: true, scene: 'Party' } });
      await send('🌈 *PARTY MODE ACTIVATED!* 🕺💃');
    }
  });

  bot.registerCommand({
    command: 'focus',
    description: 'Deep work mode',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      await triggerScene('FOCUS');
      await send('🧠 *Focus Mode:* Engaged. Lights set to cool white bright, AC to 25°C.');
    }
  });

  bot.registerCommand({
    command: 'dinner',
    description: 'Warm cozy dining',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      await triggerScene('DINNER');
      await send('🍷 *Dinner Mode:* Engaged. Fireplace lights active.');
    }
  });

  bot.registerCommand({
    command: 'boost',
    description: 'Max cooling for 30 min then restore',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const mins = parseInt(args[0]) || 30;
      if (!miraie || miraie.devices.length === 0) return await send('❌ AC not configured.');
      const d = miraie.devices[0].deviceId;
      await miraie.controlDevice(d, { ps: 'on', actmp: '18', acmd: 'cool', acfs: '5' });
      await send(`🥶 *Boost Mode*: AC → 18°C max fan for ${mins} min`);
      speak(`Boost mode active. Max cooling for ${mins} minutes.`);
      setTimeout(async () => {
        await miraie.controlDevice(d, { ps: 'on', actmp: '25', acmd: 'cool', acfs: '3' });
        await bot.sendMessage(msg.from.id, '🌡️ *Boost Done:* AC restored to 25°C.', { parse_mode: 'Markdown' });
        speak('Boost complete. AC returned to comfort level.');
      }, mins * 60000);
    }
  });

  bot.registerCommand({
    command: 'vibe',
    description: '/vibe [name] — trigger saved vibe · /vibe save [name] [ac°] [light]',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (!config.vibes) config.vibes = {};

      if (args[0] === 'save') {
        // /vibe save gaming 22 blue
        const [, name, acTemp, light] = args;
        if (!name) return await send('Usage: `/vibe save [name] [ac°C] [light]`\nExample: `/vibe save gaming 22 blue`');
        config.vibes[name] = { acTemp: acTemp || '25', light: light || 'warm' };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        return await send(`✅ Vibe *${name}* saved!\nAC: *${acTemp || 25}°C* · Light: *${light || 'warm'}*`);
      }

      if (args[0] === 'list') {
        const list = Object.keys(config.vibes);
        if (!list.length) return await send('No vibes saved yet.\nUse: `/vibe save [name] [ac°C] [light]`');
        return await send(`🎨 *Saved Vibes:*\n${list.map(v => `· \`/vibe ${v}\` — AC ${config.vibes[v].acTemp}°C · Light ${config.vibes[v].light}`).join('\n')}`);
      }

      const name = args[0];
      if (!name) return await send('Usage: `/vibe [name]` · `/vibe save [name] [ac°C] [light]` · `/vibe list`');
      const vibe = config.vibes[name];
      if (!vibe) return await send(`❌ Vibe *${name}* not found.\nSee \`/vibe list\` or create with \`/vibe save\``);

      const promises = [];
      if (wiz) {
        const lightPresets: Record<string, any> = {
          warm: { state: true, temp: 2700, dimming: 80 }, cool: { state: true, temp: 6500, dimming: 100 },
          blue: { state: true, r: 0, g: 50, b: 255 }, purple: { state: true, r: 150, g: 0, b: 255 },
          red: { state: true, r: 255, g: 0, b: 0 }, night: { state: true, temp: 2200, dimming: 10 },
          off: { state: false },
        };
        const p = lightPresets[vibe.light] || { state: true, temp: 4000, dimming: 80 };
        promises.push(wiz.executeAction({ type: 'control', payload: p }));
      }
      if (miraie && miraie.devices.length > 0) {
        promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ps: 'on', actmp: vibe.acTemp, acmd: 'cool' }));
        recordHabit(`vibe_${name}`);
      }
      await Promise.all(promises);
      speak(`${name} vibe activated.`);
      await send(`🎨 *Vibe: ${name}*\nAC: *${vibe.acTemp}°C* · Lights: *${vibe.light}*`);
    }
  });

  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'help',
    description: 'Show all commands',
    handler: async (chatId, args, msg, send) => {
      const help = [
        '*🌌 Gravity — Command Reference*',
        '',
        '🎨 *Scenes & Vibes*',
        '`/scene list` — show all scenes',
        '',
        '❄️ *AC*',
        '`/ac on` · `/ac off`',
        '`/ac 24` — set temperature (16–30°C)',
        '`/ac cool|dry|fan|auto` — mode',
        '',
        '🎥 *Modes*',
        '`/focus` — deep work: cool bright + AC 25°C 🧠',
        '`/dinner` — dining: cozy fireplace vibe 🍷',
        '`/tv` — cinema: WiZ TV scene + AC 24°C',
        '`/party` — disco: light show + music hype 🌈',
        '`/sleep` — bedroom: 10% warm + AC 27°C fan',
        '`/away` — turn everything off',
        '`/home` — welcome home: lights + AC on',
        '`/weather` — sync lights to Junagadh weather 🌦️',
        '',
        '🛡 *Access & Interaction*',
        '`/broadcast [msg]` — speak on Mac speakers 🎙️',
        '`/guest` — generate 1-hour PIN PIN for visitors 🔑',
        '`/join [PIN]` — join house as temporary guest',
        '`/energy` — show device usage & analytics 📊',
        '`/track [IP]` — set phone for auto-presence 📱',
        '',
        '🛠 *System*',
        '`/status` — all device states + uptime',
        '`/ping` — quick health check',
        '`/whoami` — your Telegram ID',
        '`/allow [ID]` — authorize a new owner',
        '',
        '⚡ *God Mode v2*',
        '`/pgvcl` — show latest PGVCL utility bill',
        '`/remember [fact]` — save preference to cortex',
      ].join('\n');
      await send(help);
    }
  });

  // ──────────────────────────────────────────────────────
  // /allow — Authorize user
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'allow',
    description: 'Authorize a new user',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (config.authorizedUsers?.[0] !== msg.from?.id && msg.from?.username !== "paranjayy") {
        return await send('⚠️ Only the *Master Account* can authorize new users.');
      }
      const newId = parseInt(args[0]);
      if (isNaN(newId)) return await send('❌ Please provide a numeric Telegram ID.');
      if (!config.authorizedUsers.includes(newId)) {
        config.authorizedUsers.push(newId);
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        await send(`✅ User \`${newId}\` has been authorized.`);
      } else {
        await send(`ℹ️ User \`${newId}\` is already authorized.`);
      }
    }
  });

  // ──────────────────────────────────────────────────────
  // /login — Generate secure access link
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'login',
    description: 'Get a secure link to your dashboard',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const dashboardUrl = `https://gravity.yourdomain.com?token=${config.hubToken}`;
      await send(`🔐 *Secure Entry Configured*\n\nYour Hub Token: \`${config.hubToken}\`\n\n_Use this token in your Dashboard settings or Bearer headers to manage Gravity from mobile._`);
    }
  });

  // ──────────────────────────────────────────────────────
  // /tv — Cinema Mode with custom lights
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'tv',
    description: 'Cinema mode: /tv [off|warm|bias|blue|purple|20|...]',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const lightArg = args[0]?.toLowerCase();
      
      if (lightArg) {
        // Save preference for next time
        config.tvLights = lightArg;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      }

      await triggerScene("TV", lightArg ? { tvLight: lightArg } : undefined);
      const savedLight = lightArg || config.tvLights || 'TV time (Warm Bias)';
      await send(`🎬 *TV TIME Active* — Mood: *${savedLight}* · AC: 24°C Silent`);
    }
  });

  bot.registerCommand({
    command: 'tvset',
    description: 'Save TV light preference: /tvset blue',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const lightArg = args[0]?.toLowerCase();
      if (!lightArg) return await send(`🎨 Current TV light: *${config.tvLights || 'bias (default)'}*\nUse: \`/tvset [warm|bias|blue|purple|red|cool|night|off|0-100]\``);
      config.tvLights = lightArg;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      await send(`✅ TV light preference saved: *${lightArg}*\nNext /tv will use this automatically.`);
    }
  });

  bot.registerCommand({
    command: 'done',
    description: 'End TV: Restores lights & turns off AC',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      await triggerScene("END_TV");
      await send("💡 *Theater Session Ended:* Restoring lights to Daylight, AC Off. Rest well!");
    }
  });

  // ──────────────────────────────────────────────────────
  // /sleep — Sleep mode: dim warm + AC fan
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'sleep',
    description: 'Sleep mode: 10% warm lights + AC 27°C fan auto',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const promises = [];
      if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, temp: 2700, dimming: 10 } }));
      if (miraie && miraie.devices.length > 0) {
        const d = miraie.devices[0];
        promises.push(miraie.controlDevice(d.deviceId, { ps: 'on', actmp: '27', acmd: 'auto', acfs: '1' }));
      }
      await Promise.all(promises);
      await send('🌙 *Sleep Mode:* Lights → 10% warm · AC → 27°C fan auto\n\nGoodnight! 😴');
    }
  });


  // ──────────────────────────────────────────────────────
  // /ac — MirAie AC control
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'ac',
    description: 'AC Control: /ac on, /ac off, /ac 24, /ac cool/dry/fan/auto',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      sleepManager.cancel();
      if (!miraie || miraie.devices.length === 0) return await send('❌ MirAie not linked.');
      const device = miraie.devices[0];
      const arg = args[0]?.toLowerCase();
      if (!arg) return await send(`*AC Control*: /ac [on|off|24|cool]`);

      if (arg === 'on' || arg === 'off') {
        await miraie.controlDevice(device.deviceId, { ps: arg });
        updateDeviceState('ac', arg);
        recordHabit(`ac_${arg}`);
        await send(`✅ AC *${arg.toUpperCase()}*`);
      } else if (!isNaN(Number(arg))) {
        const temp = Math.min(30, Math.max(16, Number(arg)));
        await miraie.controlDevice(device.deviceId, { ps: 'on', actmp: String(temp) });
        updateDeviceState('ac', 'on');
        recordHabit(`ac_temp_${temp}`);
        await send(`✅ AC: *${temp}°C*`);
      } else {
        await miraie.controlDevice(device.deviceId, { ps: 'on', acmd: arg });
        updateDeviceState('ac', 'on');
        recordHabit(`ac_mode_${arg}`);
        await send(`✅ AC: *${arg.toUpperCase()}* mode`);
      }
    }
  });

  // ──────────────────────────────────────────────────────
  // /lights — WiZ Control
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'lights',
    description: 'Lights: /lights on, /lights off, /lights 50, /lights red',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      sleepManager.cancel();
      if (!wiz) return await send('❌ WiZ not configured.');
      const arg = args[0]?.toLowerCase();
      if (!arg) return await send(`*Lights*: /lights [on|off|dim|color]`);

      if (arg === 'on' || arg === 'off') {
        await wiz.executeAction({ type: 'control', payload: { state: arg === 'on' } });
        updateDeviceState('light', arg);
        await send(`💡 Light *${arg.toUpperCase()}*`);
      } else if (!isNaN(Number(arg))) {
        const dim = Math.min(100, Math.max(10, Number(arg)));
        await wiz.executeAction({ type: 'control', payload: { state: true, dimming: dim } });
        await send(`💡 Brightness: *${dim}%*`);
      } else if (arg === 'tv') {
        await wiz.executeAction({ type: 'control', payload: { state: true, scene: 'TV time', dimming: 30 } });
        await send(`📺 *TV Bias Light:* Classic warm bias at 30%`);
      } else if (arg === 'warm') {
        await wiz.executeAction({ type: 'control', payload: { state: true, temp: 2700, dimming: 80 } });
        await send(`🕯️ *Warm White* — cozy 2700K`);
      } else if (arg === 'cool' || arg === 'white') {
        await wiz.executeAction({ type: 'control', payload: { state: true, temp: 6500, dimming: 100 } });
        await send(`🔆 *Cool White* — bright 6500K`);
      } else if (arg === 'night') {
        await wiz.executeAction({ type: 'control', payload: { state: true, temp: 2200, dimming: 10 } });
        await send(`🌙 *Night Light* — ultra-dim 2200K`);
      } else {
        const colors: Record<string, {r:number,g:number,b:number}> = {
          red:    { r: 255, g: 0,   b: 0   },
          blue:   { r: 0,   g: 0,   b: 255 },
          green:  { r: 0,   g: 200, b: 50  },
          purple: { r: 180, g: 0,   b: 255 },
          pink:   { r: 255, g: 20,  b: 147 },
          yellow: { r: 255, g: 200, b: 0   },
          orange: { r: 255, g: 100, b: 0   },
          cyan:   { r: 0,   g: 220, b: 255 },
        };
        if (colors[arg]) {
          await wiz.executeAction({ type: 'control', payload: { state: true, ...colors[arg] } });
          await send(`💡 Color: *${arg.toUpperCase()}*`);
        } else {
          await send(`❌ Unknown: \`${arg}\`\nTry: on · off · tv · warm · cool · night · 0–100 · red · blue · green · purple · pink · yellow · orange · cyan`);
        }
      }
    }
  });


  // ──────────────────────────────────────────────────────
  // /ping — Quick health check
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'ping',
    description: 'Check if bot is alive',
    handler: async (chatId, args, msg, send) => {
      const uptime = Math.floor(process.uptime());
      const mins = Math.floor(uptime / 60);
      const secs = uptime % 60;
      const offBefore = config.stats.bot?.offtimeBeforeBoot || "N/A";
      const bootedAt = config.stats.bot?.bootedAt ? new Date(config.stats.bot.bootedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : "Unknown";
      const PLATFORM = process.env.GITHUB_ACTIONS ? 'GitHub' : (require('os').platform() === 'darwin' ? 'Local Mac' : 'Remote');
      await send(`🏓 *Pong!* Gravity Hub: *${PLATFORM}*\n⏱ Uptime: *${mins}m ${secs}s*\n🚀 Started: *${bootedAt} IST*\n💤 Down before: *${offBefore}*\n💾 Memory: *${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB*`);
    }
  });

  // ──────────────────────────────────────────────────────
  // /test_feedback — Sensory Feedback Trial (v4.7)
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'test_feedback',
    description: 'Trial run of Sensory Feedback (Blink + Speak)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      await send('🧪 *Gravity Trial*: Triggering sensory feedback...');
      speak("Testing gravity sensory feedback system. Initiating visual pulse.");
      await blinkLight(3, { r: 0, g: 200, b: 255 }); // Pulse Cyan for trial
      await send('✅ Trial complete. Light should have perfectly restored its original state.');
    }
  });

  // ──────────────────────────────────────────────────────
  // /warm — Warm white lights
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'warm',
    description: 'Set lights to warm white (2700K cozy)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (!wiz) return await send('❌ WiZ not configured.');
      await wiz.executeAction({ type: 'control', payload: { state: true, temp: 2700 } });
      await send(`🕯️ *Warm White* — cozy mode activated`);
    }
  });

  // ──────────────────────────────────────────────────────
  // /scene — WiZ Scene control
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'scene',
    description: 'WiZ scene: /scene tv, /scene cozy, /scene party, /scene list',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (!wiz) return await send('❌ WiZ not configured.');
      const arg = args[0]?.toLowerCase();
      if (!arg || arg === 'list') {
        const sceneList = ['*🎨 WiZ Scenes:*', '/scene tv', '/scene cozy', '/scene party', '/scene relax', '/scene focus', '/scene warm', '/scene cool', '/scene bedtime', '/scene fireplace', '/scene ocean', '/scene sunrise'].join('\n');
        return await send(sceneList);
      }
      const sceneMap: Record<string, string> = {
        tv: 'TV time', cozy: 'Cozy', party: 'Party', relax: 'Relax',
        focus: 'Focus', warm: 'Warm White', cool: 'Cool White',
        bedtime: 'Bedtime', fireplace: 'Fireplace', ocean: 'Ocean',
        sunrise: 'Wake Up', romance: 'Romance', pastel: 'Pastel',
      };
      const sceneName = sceneMap[arg];
      if (!sceneName) return await send(`❌ Unknown scene. Try */scene list*`);
      
      if (arg === 'tv') {
        await triggerScene('TV');
        return await send(`🎬 *TV TIME Active* — Mood: Classic TV Bias · AC: 24°C Silent`);
      }

      await wiz.executeAction({ type: 'control', payload: { state: true, scene: sceneName } });
      await send(`🎨 Scene: *${sceneName}*`);
    }
  });

  // ──────────────────────────────────────────────────────
  // /weather — Sync lights to Junagadh weather + Time
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'weather',
    description: 'Explicitly sync lights & AC to Junagadh environment',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const weather = new WeatherEngine();
      const w = await weather.getWeather();
      if (!w) return await send('🌦 *Weather*: Service temporarily unavailable.');
      
      let res = `🌡️ *Gravity Explicit Sync (Junagadh)*\nTemperature: *${w.temp}°C*\nCondition: *${w.condition}*\nRain: ${w.isRain ? '☔ YES' : '🌤 NO'}`;
      
      // 1. Sync Lights (WiZ)
      if (wiz) {
        let scene = 'Warm White';
        if (w.isRain) scene = 'Ocean';
        else if (w.condition.includes('Clear')) scene = 'True colors';
        await wiz.executeAction({ type: 'control', payload: { state: true, scene } });
        res += `\n\n💡 *Lighting*: Adjusted to *${scene}* scene.`;
      }

      // 2. Sync AC (MirAie) if extreme
      if (miraie && (miraie as any).devices.length > 0) {
        if (w.temp > 35) {
          await (miraie as any).controlDevice((miraie as any).devices[0].deviceId, { ps: 'on', actmp: '23' });
          res += `\n❄️ *Air Con*: Heat trigger! Set to *23°C* for relief.`;
        } else if (w.temp < 25) {
          await (miraie as any).controlDevice((miraie as any).devices[0].deviceId, { ps: 'on', actmp: '26' });
          res += `\n🌡️ *Air Con*: Cool breeze! Set to *26°C* for comfort.`;
        }
      }
      
      await send(res);
      logActivity(`🌦 Explicit Weather Sync: ${w.temp}°C [Manual Trigger]`);
    }
  });

  // ──────────────────────────────────────────────────────
  // /energy — Usage Analytics
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'energy',
    description: 'Show device uptime & analytics',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const stats = config.stats || { acMinutes: 0, lightMinutes: 0, lastReset: new Date() };
      const hoursAC = (stats.acMinutes / 60).toFixed(1);
      const hoursLight = (stats.lightMinutes / 60).toFixed(1);
      
      let res = `📊 *Gravity Analytics*\n_Since ${new Date(stats.lastReset).toLocaleDateString()}_\n\n`;
      res += `❄️ *AC Lifetime*: ${hoursAC} hrs\n`;
      if (stats.ac?.lastChanged) {
        res += `↳ _State: ${stats.ac.status.toUpperCase()} for ${getDurationString(stats.ac.lastChanged)}_\n`;
      }
      res += `\n💡 *WiZ Lifetime*: ${hoursLight} hrs\n`;
      if (stats.light?.lastChanged) {
        res += `↳ _State: ${stats.light.status.toUpperCase()} for ${getDurationString(stats.light.lastChanged)}_\n`;
      }
      res += `\n_Uptime is tracked even if you use the physical remote!_`;
      
      await send(res);
    }
  });

  // ──────────────────────────────────────────────────────
  // /away + /home — Presence mode
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'away',
    description: 'Away mode: turn off everything',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const promises = [];
      if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: false } }));
      if (miraie && miraie.devices.length > 0) {
        const d = miraie.devices[0];
        promises.push(miraie.controlDevice(d.deviceId, { ps: 'off' }));
      }
      await Promise.all(promises);
      await send('🚶 *Away Mode:* All devices off. See you later!');
    }
  });

  bot.registerCommand({
    command: 'home',
    description: 'Welcome home: lights on + AC on',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const promises = [];
      if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, temp: 4500, dimming: 80 } }));
      if (miraie && miraie.devices.length > 0) {
        const d = miraie.devices[0];
        promises.push(miraie.controlDevice(d.deviceId, { ps: 'on', actmp: '24', acmd: 'cool' }));
      }
      await Promise.all(promises);
      await send('🏠 *Welcome Home!* Lights → 80% daylight · AC → 24°C cool');
    }
  });

  // ──────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────
  // /brief — On-Demand Executive Briefing
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'brief',
    description: 'Get a professional summary of house status',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      
      const uptime = Math.floor(process.uptime());
      const stats = config.stats || {};
      const usage = stats.dailyLog?.[stats.dailyLog.length - 1] || { ac: 0, light: 0 };
      
      const load = os.loadavg();
      
      let message = `👔 *Gravity Hub Executive Briefing*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `🛡️ *Security:* System is **GOD MODE (Active)**\n`;
      message += `⚡ *Consumption:* AC usage at **${usage.ac} hrs** today\n`;
      message += `🕰️ *Uptime:* ${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m active\n`;
      message += `🖥️ *SysLoad:* ${load[0].toFixed(2)} (1m avg)\n`;
      
      if (miraie && miraie.devices.length > 0) {
        const s = await miraie.getDeviceStatus(miraie.devices[0].deviceId);
        message += `❄️ *Climate:* AC is currently **${s?.ps?.toUpperCase() || 'OFF'}** (${s?.actmp}°C)\n`;
      }
      
      message += `\n📜 _Last logged act: ${usage.date || 'Today'}_`;
      await send(message);
    }
  });

  // /status — Device Status
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'status',
    description: 'System Status',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const uptime = Math.floor(process.uptime());
      const lines = ['*🏡 Gravity Status*\n'];
      
      const acStatus = config.stats.ac?.status || 'unknown';
      const acDuration = getDurationString(config.stats.ac?.lastChanged);
      const acHw = miraie ? '✅ Live' : '🌑 Disconnected (Power Cut?)';
      lines.push(`❄️ *AC*: ${acStatus.toUpperCase()} (${acDuration}) [Req: ${config.ac?.temp || '24'}°C] (${acHw})`);
      
      const lightStatus = config.stats.light?.status || 'unknown';
      const lightDuration = getDurationString(config.stats.light?.lastChanged);
      const lightHw = wiz ? '✅ Live' : '🌑 Disconnected';
      lines.push(`💡 *Lights*: ${lightStatus.toUpperCase()} (${lightDuration}) [Req: ${config.lights?.brightness || '100'}%] (${lightHw})`);
      
      const botUptime = Math.floor(process.uptime());
      const botOffBefore = config.stats.bot?.offtimeBeforeBoot || "N/A";
      const bootedAt = config.stats.bot?.bootedAt ? new Date(config.stats.bot.bootedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : "Unknown";
      
      lines.push(`🤖 *Bot*: ONLINE (Since ${bootedAt} IST)`);
      lines.push(`⏱ *Session Uptime*: ${Math.floor(botUptime/3600)}h ${Math.floor((botUptime%3600)/60)}m`);
      lines.push(`💤 *Bot Downtime*: Last down for ${botOffBefore}`);
      
      try {
        const logs = fs.readFileSync(LOG_PATH, 'utf-8').trim().split('\n');
        const last = logs[logs.length - 1] || "No events logged yet.";
        lines.push(`\n📜 *Last Activity*: \`${last.split('] ')[1] || last}\``);
      } catch {}

      await send(lines.join('\n'));
    }
  });

  bot.registerCommand({
    command: 'logs',
    description: 'View last 10 house events',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      try {
        const logs = fs.readFileSync(LOG_PATH, 'utf-8').trim().split('\n');
        const last10 = logs.slice(-10).join('\n');
        await send(`📜 *Recent House Activities:*\n\n\`\`\`\n${last10}\n\`\`\``);
      } catch {
        await send('📜 No logs found yet.');
      }
    }
  });

  // ──────────────────────────────────────────────────────
  // /remind — Delayed Telegram reminder
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'remind',
    description: 'Set a reminder: /remind 30m take a break',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const timeArg = args[0];
      const message = args.slice(1).join(' ');
      if (!timeArg || !message) return await send('Usage: `/remind 30m take a break` or `/remind 2h drink water`');
      
      const match = timeArg.match(/^(\d+)(m|h|s)$/i);
      if (!match) return await send('❌ Invalid time. Use: `30m`, `2h`, `90s`');
      
      const num = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const ms = unit === 'h' ? num * 3600000 : unit === 'm' ? num * 60000 : num * 1000;
      const readableTime = unit === 'h' ? `${num} hour${num > 1 ? 's' : ''}` : unit === 'm' ? `${num} min${num > 1 ? 's' : ''}` : `${num}s`;
      
      await send(`⏰ Got it! Reminding you in *${readableTime}*:\n_"${message}"_`);
      setTimeout(async () => {
        await bot.sendMessage(msg.from.id, `🔔 *Reminder:* ${message}`, { parse_mode: 'Markdown' });
      }, ms);
    }
  });

  // ──────────────────────────────────────────────────────
  // /timer — Auto shut-off timer
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'timer',
    description: 'Auto off-timer: /timer 30 lights',
    handler: async (chat_id, args, msg, send) => {
      const mins = parseInt(args[0]);
      const device = args[1]?.toLowerCase() || 'all';
      const action = args[2]?.toLowerCase() || 'off';
      if (isNaN(mins) || mins <= 0) return await send('Usage: `/timer 30 lights` or `/timer 60 ac` or `/timer 45 all`');
      
      let remainingS = mins * 60;
      const timerMsg = await (bot as any).sendMessage(msg.from.id, `⏳ *Timer Active*: ${device.toUpperCase()} → ${action.toUpperCase()}`, { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: `${mins}:00 remaining`, callback_data: 'timer_ping' }]] }
      });

      const interval = setInterval(async () => {
        remainingS -= 20;
        const m = Math.floor(remainingS / 60);
        const s = remainingS % 60;
        const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
        
        try {
          await (bot as any).sendRequest('editMessageReplyMarkup', {
            chat_id: msg.from.id,
            message_id: (timerMsg as any).result?.message_id || (timerMsg as any).message_id,
            reply_markup: { inline_keyboard: [[{ text: `⏳ ${timeStr} remaining`, callback_data: 'timer_ping' }]] }
          });
        } catch {}
      }, 20000); // Update every 20s

      setTimeout(async () => {
        clearInterval(interval);
        const promises = [];
        if ((device === 'all' || device === 'lights') && wiz) {
          promises.push(wiz.executeAction({ type: 'control', payload: { state: action === 'on' } }));
        }
        if ((device === 'all' || device === 'ac') && miraie && miraie.devices.length > 0) {
          promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ps: action }));
        }
        await Promise.all(promises);
        await bot.sendMessage(msg.from.id, `😴 *Timer Done:* ${device.toUpperCase()} powered ${action}.`, { parse_mode: 'Markdown' });
        speak(`${device} powered ${action} by timer.`);
      }, mins * 60000);
    }
  });

  // 📸 /screen — Remote View
  bot.registerCommand({
    command: 'screen',
    description: 'Capture Mac screen',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const tempPath = '/tmp/gravity_screen.png';
      await send('📸 *Gravity Eyes*: Capturing screen...');
      try {
        await execAsync(`screencapture -x ${tempPath}`);
        await bot.sendPhoto(chatId as number, tempPath, `🖥 *Gravity Sentry View*\n⏰ Captured: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      } catch (e: any) {
        await send(`❌ Capture failed: ${e.message}`);
      }
    }
  });

  // 🔊 /vol — System Volume Control
  bot.registerCommand({
    command: 'vol',
    description: 'Control Mac volume: /vol 50|up|down',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const val = args[0] || 'status';
      try {
        if (val === 'up') await execAsync(`osascript -e "set volume output volume ((output volume of (get volume settings)) + 10)"`);
        else if (val === 'down') await execAsync(`osascript -e "set volume output volume ((output volume of (get volume settings)) - 10)"`);
        else if (!isNaN(Number(val))) await execAsync(`osascript -e "set volume output volume ${val}"`);
        
        const { stdout } = await execAsync(`osascript -e "output volume of (get volume settings)"`);
        await send(`🔊 *System Volume*: ${stdout.trim()}%`);
      } catch (e: any) {
        await send(`❌ Volume control failed`);
      }
    }
  });

  // ──────────────────────────────────────────────────────
  // /schedule — Management
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'schedule',
    description: 'View active routines and schedules',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const jobs = config.scheduler || [];
      if (jobs.length === 0) return await send('🕰 *Schedules*: No routines active.');
      
      let res = '🕰 *Active Hub Routines*\n\n';
      jobs.forEach((j: any, i: number) => {
        res += `${i+1}. [${j.time}] \`${j.action.toUpperCase()}\`\n`;
      });
      res += '\n_Use the buttons below to manage mission routines._';
      
      await bot.sendMessage(chatId, res, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add Routine', callback_data: 'schedule_prompt' }],
            [{ text: '🧹 Clear All', callback_data: 'schedule_clear_confirm' }]
          ]
        }
      });
    }
  });

  // Handle Scheduler Callbacks
  bot.onCallback = async (query: any) => {
    const data = query.data;
    if (data === 'schedule_prompt') {
      await bot.sendMessage(query.message.chat.id, '🕰 *New Routine:* Use `/schedule_add 22:30 ac_off`');
    }
    if (data === 'schedule_clear_confirm') {
       config.scheduler = [];
       saveConfig(config);
       scheduler.refresh();
       await bot.sendMessage(query.message.chat.id, '🧹 *Schedules Cleared*. All routines wiped.');
    }
    try { await bot.answerCallbackQuery(query.id); } catch {}
  };

  bot.registerCommand({
    command: 'schedule_add',
    description: 'Add a new schedule: /schedule_add 23:00 ac_off',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const time = args[0];
      const action = args[1];
      if (!time || !action) {
        return await send('🕰 *Usage*: `/schedule_add 23:00 ac_off` \n\n' +
                          '*Available Actions*:\n' +
                          '• `ac_on` / `ac_off`\n' +
                          '• `bulb_on` / `bulb_off` / `bulb_dim`\n' +
                          '• `sleep_curve` (Night Step-up)\n' +
                          '• `scene` (e.g. `scene cinema`)');
      }
      
      if (!time.match(/^\d{2}:\d{2}$/)) return await send('❌ Time format must be `HH:MM` (24h).');
      
      const newJob = { 
        time, 
        action, 
        days: 'daily',
        lastRun: '' 
      };
      
      config.scheduler = config.scheduler || [];
      config.scheduler.push(newJob);
      saveConfig(config);
      scheduler.refresh();
      
      await send(`✅ *Schedule Added*: \`${action}\` daily at ${time}`);
      logActivity(`🕰 Scheduler: New routine added - ${action} @ ${time}`);
    }
  });

  bot.registerCommand({
    command: 'schedule_clear',
    description: 'Wipe all active schedules',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      config.scheduler = [];
      saveConfig(config);
      scheduler.refresh();
      await send('🧹 *Schedules Cleared*. Routines wiped.');
      logActivity(`🕰 Scheduler: All routines cleared by user.`);
    }
  });

  bot.registerCommand({
    command: 'schedule_rm',
    description: 'Remove a specific schedule by index: /schedule_rm 1',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const idx = parseInt(args[0]) - 1;
      if (!config.scheduler || isNaN(idx) || idx < 0 || idx >= config.scheduler.length) {
         return await send('❌ Invalid index. Please use `/schedule` to see the numbers, then `/schedule_rm 1`.');
      }
      const removed = config.scheduler.splice(idx, 1)[0];
      saveConfig(config);
      scheduler.refresh();
      await send(`🗑️ *Removed Schedule*: \`${removed.action}\` at ${removed.time}`);
      logActivity(`🕰 Scheduler: Routine removed - ${removed.action} @ ${removed.time}`);
    }
  });

  // ──────────────────────────────────────────────────────
  // /temp — Current AC temp readout
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'temp',
    description: 'Show current AC set temperature',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (!miraie || miraie.devices.length === 0) return await send('❌ AC not configured.');
      const device = miraie.devices[0];
      const status = (device as any).status;
      if (status) {
        const isOn = status.ps === 'on';
        const acTemp = status.actmp || '?';
        const mode = status.acmd || '?';
        await send(`❄️ *AC Status*\nPower: ${isOn ? '✅ ON' : '❌ OFF'}\nSet Temp: *${acTemp}°C*\nMode: *${mode.toUpperCase()}*`);
      } else {
        await send(`❄️ AC is configured (${device.deviceName})\n_Status polling not available for this device._`);
      }
    }
  });

  // ──────────────────────────────────────────────────────
  // /history — Energy Archive
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'history',
    description: 'Show last 7 days of energy usage',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const log = config.stats.dailyLog || [];
      
      let table = '📈 *History (Last 30 Days)*\n\n';
      let totalAC = 0;
      let totalLight = 0;

      // Calculate Ultimate Totals over the full log
      log.forEach((entry: any) => {
        totalAC += parseFloat(entry.ac);
        totalLight += parseFloat(entry.light);
      });

      // Add current session (Today)
      const todayAC = (config.stats.acMinutes / 60);
      const todayLight = (config.stats.lightMinutes / 60);
      
      table = '📊 *Gravity Multi-Day Totals*\n\n';
      table += `✨ *TODAY (Live)*\n❄️ AC: \`${todayAC.toFixed(1)}h\` | 💡 Light: \`${todayLight.toFixed(1)}h\`\n\n`;
      
      totalAC += todayAC;
      totalLight += todayLight;

      table += `🏆 *ULTIMATE TOTALS*\n_(Processed from ${log.length + 1} days of data)_\n\n`;
      table += `❄️ Total AC: *${totalAC.toFixed(1)} hrs*\n💡 Total Light: *${totalLight.toFixed(1)} hrs*`;
      
      await send(table);
    }
  });

  // ── Web Control API (Port 3030) ─────────────────────
  // Perfect for Raycast / Siri Shortcuts (curl http://localhost:3030/scene/tv)
  try {
    (Bun as any).serve({
      port: 3030,
      async fetch(req: any) {
        const url = new URL(req.url);
        if (req.method === 'OPTIONS') {
           const res = new Response('Departed', { status: 200 });
           res.headers.set('Access-Control-Allow-Origin', '*');
           res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
           return res;
        }

        // --- AUTH GUARD --- //
        // Robust localhost detection for Raycast / Local Scripts
        const host = req.headers.get("host") || "";
        const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1");
        
        const bearer = req.headers.get("Authorization");
        const urlToken = url.searchParams.get("token");
        const tokenStr = bearer ? bearer.split(" ")[1] : urlToken;
        
        // Require valid token for all sensitive paths, BUT allow Localhost (Raycast) to skip
        if (!isLocal && (url.pathname.includes('/control') || url.pathname.includes('/scene') || url.pathname.includes('/trigger'))) {
           if (tokenStr !== (config.hubToken || 'gravity_unprotected')) {
              console.warn(`🔐 API: Unauthorized attempt from ${host} to ${url.pathname}`);
              return new Response(JSON.stringify({ error: "Unauthorized. Hub Token required for remote access." }), { 
                status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
              });
           }
        }
        
        const sceneName = url.pathname.split('/').pop()?.toUpperCase();

        // 🔗 IFTTT / Webhook Trigger
        if (url.pathname.startsWith('/trigger/')) {
          const hook = url.pathname.split('/').pop();
          if (hook) {
            logActivity(`🔗 Webhook Triggered: ${hook}`);
            await triggerScene(hook.toUpperCase());
            return new Response(`Trigger ${hook} Executed`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
          }
        }
        if (url.pathname.includes('/status')) {
          const w = config.weatherSync !== false ? await new WeatherEngine().getWeather() : null;
          
          // Calculate current live units for Raycast/Dashboard
          const liveUnits = (config.stats.acMinutes / 60 * 1.65) + (config.stats.lightMinutes / 60 * 0.012);
          
          const body = JSON.stringify({
            online: isPhoneOnline,
            stats: config.stats,
            units: liveUnits.toFixed(1),
            estimatedPgBill: calculatePgvclBill(liveUnits),
            uptime: process.uptime(),
            pgvcl: config.stats.pgvcl,
            weather: w
          }, null, 2);
          return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        
        // 🪐 GRAVITY ARCHIVE API
        if (url.pathname === '/archive/list') {
          const { ArchiveDB } = await import('../archive/db');
          const items = ArchiveDB.list(50);
          return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/archive/search') {
          const { ArchiveDB } = await import('../archive/db');
          const q = url.searchParams.get('q') || '';
          const items = ArchiveDB.search(q);
          return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname.startsWith('/archive/bookmark/')) {
          const { ArchiveDB } = await import('../archive/db');
          const id = parseInt(url.pathname.split('/').pop() || '0');
          ArchiveDB.toggleBookmark(id);
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname.startsWith('/archive/delete/')) {
          const { ArchiveDB } = await import('../archive/db');
          const id = parseInt(url.pathname.split('/').pop() || '0');
          ArchiveDB.delete(id);
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname.startsWith('/archive/promote/')) {
          const { ArchiveDB } = await import('../archive/db');
          const id = parseInt(url.pathname.split('/').pop() || '0');
          const items = ArchiveDB.list(1000);
          const item = items.find(i => i.id === id);
          if (item) {
            const entry = `\n### 🪐 Promoted from Archive (${new Date().toLocaleDateString()})\nSource: \`${item.source_app}\`\n\n${item.content}\n\n---\n`;
            fs.appendFileSync(path.join(process.cwd(), 'prompt_vault.md'), entry);
            return new Response('Promoted', { headers: { 'Access-Control-Allow-Origin': '*' } });
          }
          return new Response('Not Found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname.startsWith('/archive/update-labels/')) {
          const { ArchiveDB } = await import('../archive/db');
          const id = parseInt(url.pathname.split('/').pop() || '0');
          const labels = url.searchParams.get('labels') || '';
          ArchiveDB.updateLabels(id, labels);
          return new Response('Updated', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/system/lock') {
          await execAsync(`pmset displaysleepnow || /System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend`);
          return new Response('Locked', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/system/sleep') {
          await execAsync(`osascript -e 'tell application "System Events" to sleep'`);
          return new Response('Sleep', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/brightness') {
          const dir = url.searchParams.get('dir') === 'up' ? 20 : -20;
          if (wiz) {
            // Target the primary wiz bulb
            const p = await (wiz as any).getPilot();
            const current = p?.dimming || 50;
            await (wiz as any).executeAction({ type: 'control', payload: { state: true, dimming: Math.min(100, Math.max(10, current + dir)) } });
          }
          return new Response('Dimmed', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/bulb/off') {
          if (wiz) await (wiz as any).executeAction({ type: 'control', payload: { state: false } });
          return new Response('Bulb Off', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/temp') {
          const dir = url.searchParams.get('dir') === 'up' ? 1 : -1;
          if (miraie && (miraie as any).devices.length > 0) {
            for (const device of (miraie as any).devices) {
              const status = await (miraie as any).getDeviceStatus(device.deviceId);
              const current = parseInt(status?.actmp || '24');
              const target = Math.min(30, Math.max(16, current + dir)).toString();
              await (miraie as any).controlDevice(device.deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: target });
            }
          }
          return new Response('Temp Set', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/ac/off') {
          if (miraie && (miraie as any).devices.length > 0) {
            for (const device of (miraie as any).devices) {
              await (miraie as any).controlDevice(device.deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'off' });
            }
          }
          return new Response('AC Off', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/ac/mode') {
          const mode = url.searchParams.get('mode') || 'cool';
          if (miraie && (miraie as any).devices.length > 0) {
            for (const device of (miraie as any).devices) {
              await (miraie as any).controlDevice(device.deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on', acmd: mode });
            }
          }
          return new Response(`Mode Set: ${mode}`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/bulb/color') {
          const temp = parseInt(url.searchParams.get('temp') || '4500');
          if (wiz) await (wiz as any).executeAction({ type: 'control', payload: { state: true, temp } });
          return new Response('Bulb Color Set', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/volume') {
          const dir = url.searchParams.get('dir') === 'up' ? 'up' : 'down';
          await execAsync(`osascript -e 'set volume output volume ((output volume of (get volume settings)) ${dir === 'up' ? '+' : '-'} 10)'`);
          return new Response('Volume Set', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/logs') {
          try {
            const logsText = fs.readFileSync(path.join(process.cwd(), 'house_log.md'), 'utf-8');
            return new Response(logsText, { status: 200, headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' } });
          } catch (e) {
            return new Response("No logs found.", { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
          }
        }
        if (url.pathname === '/system/restart') {
           // Fire and forget restart script
           exec(`scripts/iftt-clone.sh`); 
           return new Response('Restarting Hub...', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (sceneName) {
          await triggerScene(sceneName);
          return new Response(`Gravity: Scene ${sceneName} Active`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        return new Response("Gravity API Active", { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
      },
    });
    console.log('🌐 Web API enabled: :3030/scene/[NAME]');
  } catch(e) { console.warn('API error (port likely in use)'); }

  // ──────────────────────────────────────────────────────
  // PGVCL Utility Scraper (God Mode v2)
  // ──────────────────────────────────────────────────────
  async function runPgvclScraper() {
    if (!config.pgvcl?.consumerId || config.pgvcl.consumerId === 'ENTER_YOUR_CONSUMER_ID') {
      console.log('⚖️ PGVCL: Skipping scraper (No credentials)');
      return;
    }

    logActivity("⚡ Starting PGVCL Utility Scan...");
    let browser;
    try {
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto('https://www.pgvcl.com/consumer/index.php');
      
      // Basic login flow (Generic pattern, needs user portal verification)
      await page.type('#consumer_id', config.pgvcl.consumerId);
      await page.type('#password', config.pgvcl.password);
      await page.click('#login_btn');
      await page.waitForNavigation();

      // Extract current usage / bill amount
      const billData = await page.evaluate(() => {
        return {
          amount: document.querySelector('.current-bill-amt')?.textContent || '0',
          units: document.querySelector('.current-units')?.textContent || '0'
        };
      });

      config.stats.pgvcl = {
        amount: billData.amount,
        units: billData.units,
        scannedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      logActivity(`⚡ PGVCL: Scanned [${billData.units} units | ₹${billData.amount}]`);
    } catch (e) {
      console.error('PGVCL Scraper failed', e);
    } finally {
      if (browser) await browser.close();
    }
  }

  // Run scraper on boot + every 6 hours
  runPgvclScraper();
  setInterval(runPgvclScraper, 21600000);
  let awayAcMinutes = 0;

  setInterval(async () => {
    try {
      // 1. Auto-Saver Protection (2.5h / 150m limit)
      if (!isPhoneOnline) {
        // Only count if an AC is actually on
        let anyAcOn = false;
        if (miraie && miraie.devices.length > 0) {
           for (const d of miraie.devices) {
             const s = await miraie.getDeviceStatus(d.deviceId);
             if (s?.ps === 'on' || s?.ps === '1') anyAcOn = true;
           }
        }
        
        if (anyAcOn) {
          awayAcMinutes++;
          if (awayAcMinutes >= 150) {
            awayAcMinutes = 0; // reset
            const promises = [];
             if (miraie && miraie.devices.length > 0) {
               promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'off' }));
             }
             await Promise.all(promises);
             const alert = `🛡️ *Gravity Auto-Saver:* AC was on for >2.5h while you were AWAY. High-fidelity safety shut-off triggered.`;
             for (const uid of (config.authorizedUsers || [])) {
               try { await bot.sendMessage(uid, alert, { parse_mode: 'Markdown' }); } catch {}
             }
             logActivity(`🛡️ Auto-Saver: Shutdown triggered after 150m of away-usage.`);
          }
        }
      } else {
        awayAcMinutes = 0; // Reset if anyone comes home
      }

      // ──────────────────────────────────────────────────────
      // 1. Check WiZ
      if (wiz) {
        const p = await (wiz as any).getPilot();
        const state = p?.state ? 'on' : 'off';
        if (p?.state) config.stats.lightMinutes++;
        updateDeviceState('light', state);
      }
      // 1. Force MirAie REST refresh to ensure absolute tracking accuracy
      if (miraie) {
        try { await (miraie as any).refreshAllStatuses(); } catch {}
      }

      // 2. Check MirAie (Loop ALL devices)
      if (miraie && (miraie as any).devices.length > 0) {
        let activeAcCount = 0;
        let currentAcTemp = 0;
        for (const device of (miraie as any).devices) {
          const status = await (miraie as any).getDeviceStatus(device.deviceId);
          const ps = String(status?.ps || '').toLowerCase();
          if (ps === 'on' || ps === '1' || ps === 'true') {
            activeAcCount++;
            currentAcTemp = parseInt(status?.actmp || '0');
          }
        }
        
        if (activeAcCount > 0) {
          // Increment minutes for EACH active unit (Parallel Load Accuracy)
          config.stats.acMinutes += activeAcCount;
          sessionAcMinutes += activeAcCount;
          
          // Efficiency Monitoring (on primary unit)
          if (acEfficiencyData.startTime && !acEfficiencyData.alerted) {
             if (acEfficiencyData.startTemp === null) acEfficiencyData.startTemp = currentAcTemp;
             const elapsed = (Date.now() - acEfficiencyData.startTime) / 60000;
             if (elapsed >= 45 && currentAcTemp >= acEfficiencyData.startTemp) {
                acEfficiencyData.alerted = true;
                const alertBody = `🚨 *Efficiency Alert*: AC has been ON for 45m but room temperature hasn't dropped. Check doors/windows!`;
                for (const uid of (config.authorizedUsers || [])) {
                  try { await bot.sendMessage(uid, alertBody, { parse_mode: 'Markdown' }); } catch {}
                }
                speak("Attention. Air conditioning efficiency is low. Please check windows and doors.");
                blinkLight(4, { r: 255, g: 50, b: 0 }); // Pulse Red
             }
          }
        }
        updateDeviceState('ac', activeAcCount > 0 ? 'on' : 'off');
      }

      const now = new Date();
      // Record hourly snapshot if it's a new hour
      if (now.getMinutes() === 0) {
        if (!config.stats.history) config.stats.history = [];
        const stamp = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        config.stats.history.push({ time: stamp, ac: config.stats.acMinutes, lights: config.stats.lightMinutes });
        if (config.stats.history.length > 24) config.stats.history.shift();
      }

      // 3. Budget Check
      if (config.stats.budgetLimit) {
        const estBill = Number(calculatePgvclBill(Number(config.stats.pgvcl?.units) || 0));
        const dailyEst = (config.stats.acMinutes / 60 * 1.65) + (config.stats.lightMinutes / 60 * 0.012);
        const dailyCost = Number(calculatePgvclBill(dailyEst));
        
        if (dailyCost > config.stats.budgetLimit && !config.stats.budgetAlertSent) {
          const alert = `⚠️ *Budget Alert:* Daily electricity cost (*₹${dailyCost.toFixed(1)}*) has exceeded your limit of ₹${config.stats.budgetLimit}. Consider switching to economy mode.`;
          for (const uid of (config.authorizedUsers || [])) {
            try { await bot.sendMessage(uid, alert, { parse_mode: 'Markdown' }); } catch {}
          }
          config.stats.budgetAlertSent = true;
        }
      }

      // 4. Save stats
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

      // 4. Daily Review at 11:59 PM
      if (now.getHours() === 23 && now.getMinutes() === 59) {
        const stats = config.stats;
        const dateStr = now.toLocaleDateString('en-IN');
        
        const msg = `🌙 *Gravity Daily Review*\n\n❄️ AC: *${(stats.acMinutes/60).toFixed(1)} hrs*\n💡 Light: *${(stats.lightMinutes/60).toFixed(1)} hrs*`;
        for (const uid of (config.authorizedUsers || [])) {
          await bot.sendMessage(uid, msg, { parse_mode: 'Markdown' });
        }

        // Archive to Daily Log
        if (!config.stats.dailyLog) config.stats.dailyLog = [];
        config.stats.dailyLog.push({
          date: dateStr,
          ac: (stats.acMinutes/60).toFixed(1),
          light: (stats.lightMinutes/60).toFixed(1)
        });
        if (config.stats.dailyLog.length > 365) config.stats.dailyLog.shift();

        config.stats = { 
          acMinutes: 0, 
          lightMinutes: 0, 
          lastReset: new Date(), 
          history: config.stats.history, 
          dailyLog: config.stats.dailyLog,
          budgetLimit: config.stats.budgetLimit,
          budgetAlertSent: false // Reset alert for the next day
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      }
    } catch (err) {
      console.error('Stats loop error:', err);
    }
  }, 60000);

  // ──────────────────────────────────────────────────────
  // 🔋 Mac Battery Guardian (New Feature v2.2)
  // ──────────────────────────────────────────────────────
  let batteryAlertSent = false;
  setInterval(async () => {
    try {
      const { stdout } = await execAsync('pmset -g batt');
      const match = stdout.match(/(\d+)%/);
      if (match) {
        const level = parseInt(match[1]);
        const isCharging = stdout.includes('AC Power') || stdout.includes('charging');
        
        if (level <= 20 && !isCharging && !batteryAlertSent) {
          batteryAlertSent = true;
          const msg = `⚠️ *Gravity Power Alert* ⚡\nYour Mac's battery is critical (*${level}%*).\nPlease plug in to keep the God build running.`;
          for (const uid of (config.authorizedUsers || [])) {
            await bot.sendMessage(uid, msg, { parse_mode: 'Markdown' });
          }
        } else if (level > 25) {
          batteryAlertSent = false;
        }
      }
    } catch {}
  }, 300000); // Check every 5m

  // 🧠 Habit Learning Analysis (Run daily at 1 AM)
  async function analyzeHabits() {
    if (!config.habits || (config.habits as any).length < 10) return;
    logActivity("🧠 Habit Learner: Scanning manual patterns...");
    const patterns: Record<string, number[]> = {};
    (config.habits as any).forEach((h: any) => {
      const key = `${h.command}_${h.day}`;
      if (!patterns[key]) patterns[key] = [];
      patterns[key].push(h.time);
    });

    for (const [key, times] of Object.entries(patterns)) {
      if (times.length >= 3) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        if (times.every(t => Math.abs(t - avgTime) < 45)) {
          const [command, dayNum] = key.split('_');
          const timeStr = `${Math.floor(avgTime / 60).toString().padStart(2, '0')}:${Math.floor(avgTime % 60).toString().padStart(2, '0')}`;
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(dayNum)];
          
          const msg = `🧠 *Gravity Habit Insight*\n\nMaster, I've noticed you always use \`${command.toUpperCase()}\` around *${timeStr}* on *${dayName}s*.\n\nShould I automate this?`;
          for (const uid of (config.authorizedUsers || [])) {
             try {
               await bot.sendMessage(uid, msg, {
                 parse_mode: 'Markdown',
                 reply_markup: {
                   inline_keyboard: [[{ text: '✅ Schedule It', callback_data: `schedule_add ${timeStr} ${command}` }, { text: '🚫 No', callback_data: 'ignore' }]]
                 }
               });
             } catch {}
          }
          config.habits = (config.habits as any).filter((h: any) => !key.startsWith(h.command));
        }
      }
    }
    saveConfig(config);
  }

  // 🏥 Health Pulse & Maintenance
  setInterval(() => {
    updateBotPulse(config);
    const now = new Date();
    if (now.getHours() === 1 && now.getMinutes() === 0) analyzeHabits();
  }, 60000);

  // Polls
  bot.startPolling();
  
  const PLATFORM = process.env.GITHUB_ACTIONS ? 'GitHub' : (require('os').platform() === 'darwin' ? 'Local Mac' : 'Remote Hub');
  const startTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const acDur = getDurationString(config.stats.ac?.lastChanged);
  const ltDur = getDurationString(config.stats.light?.lastChanged);
  const startMsg = `🟢 *Gravity Hub: ONLINE*\n━━━━━━━━━━━━━━\n🏗 Platform: *${PLATFORM}*\n⏰ Started: *${startTime} IST*\n❄️ AC: ${miraie ? '✅' : '❌'} (${acDur}) | 💡 Light: ${wiz ? '✅' : '❌'} (${ltDur})\n━━━━━━━━━━━━━━\nType /help for God Mode v4.6`;
  
  for (const userId of (config.authorizedUsers || [])) {
    try { bot.sendMessage(userId, startMsg, { parse_mode: 'Markdown' }); } catch {}
  }
  console.log(`🚀 Gravity Hub ONLINE [${PLATFORM}]. Polling started.`);

  // ── Shutdown Guardian ─────────────────────────────
  const shutdown = async (signal: string) => {
    const uptime = Math.floor(process.uptime());
    const uptimeStr = `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`;
    const acStr = sessionAcMinutes > 0 ? `\n❄️ AC Workload: *${(sessionAcMinutes/60).toFixed(1)} hrs*` : '';
    const lightStr = sessionLightMinutes > 0 ? `\n💡 Light Usage: *${(sessionLightMinutes/60).toFixed(1)} hrs*` : '';
    
    const stopTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const stopMsg = `🔴 *Gravity went OFFLINE*\n⏰ Stopped at *${stopTime} IST* (${signal})\n⏱ Session Uptime: *${uptimeStr}*${acStr}${lightStr}\n\nHub will not respond until restarted.`;
    
    for (const userId of (config.authorizedUsers || [])) {
      try { await bot.sendMessage(userId, stopMsg, { parse_mode: 'Markdown' }); } catch {}
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('manual stop'));
  process.on('SIGTERM', () => shutdown('system stop'));
  
  // 🆘 Global Error Guardian
  const sos = async (err: Error, type: string) => {
    console.error(`🆘 ${type}:`, err);
    const alert = `🚨 *Gravity CRASH Detected*\nType: \`${type}\`\nError: \`${err.message.substring(0, 100)}\`\n\n_Hub is attempting to stay alive..._`;
    for (const userId of (config.authorizedUsers || [])) {
      try { await bot.sendMessage(userId, alert, { parse_mode: 'Markdown' }); } catch {}
    }
  };
  process.on('uncaughtException', (err) => sos(err, 'Uncaught Exception'));
  process.on('unhandledRejection', (reason: any) => sos(reason instanceof Error ? reason : new Error(String(reason)), 'Unhandled Rejection'));
}

main().catch(err => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
