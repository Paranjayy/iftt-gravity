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
import { getFrequentedStats } from './stats';
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
const IPL_ROOT = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/public/data/balls";let lastIplEventTs = 0;
let lastIplBallId = "";
let lastIplPhase = "";
let lastIplOver = "";
let lastIplScore = "";
let lastIplMatchId = "";
let lastIplWicketBall = false; // true = next ball after wicket
let lastIplProjected = 0;
let lastIplMilestones = new Set<string>();
let lastCommentaryMsgId: number | null = null;
let lastGitMsgIds: Record<string, number> = {};
let lastSpotifyTrack = "";
let lastGitHubCheck = 0;
let lastMarketCheck = 0;
let lastIssCheck = 0;
let lastGoldenHourCheck = 0;
let lastFocusShieldCheck = 0;
let lastBlinkSignal = { text: "None", time: Date.now() };
let preMusicLightState: any = null;
let isPhoneOnline = false;
let batteryAlertSent = false;
let globalLastAction: string = 'None';
let globalLastActionTime: number = Date.now();

const formatAction = (cmd: string, config: any) => {
  const map: Record<string, string> = {
    'ac_on': 'AC ❄️: ✅ ON', 'ac_off': 'AC 🚫: ❌ OFF',
    'bulb_on': 'Lights 💡: ✅ ON', 'bulb_off': 'Lights 🌑: ❌ OFF',
    'temp_up': 'Temp 🌡️ +1°', 'temp_down': 'Temp 🌡️ -1°',
    'bright_up': 'Brighten ➕', 'bright_down': 'Dim ➖',
    'bulb_warm': 'Warm Aura 🕯️', 'bulb_cool': 'Cool Aura ❄️',
    'bulb_tv': 'TV Mode 🌘', 
    'aura_toggle': `Aura Sync 🌈: ${config.mediaAura !== false ? '✅ ON' : '❌ OFF'}`,
    'cricket_toggle': `Cricket Mode 🏏: ${config.cricketMode ? '✅ ON' : '❌ OFF'}`, 
    'github_pulse_toggle': `Git Pulse 🐙: ${config.githubPulse.enabled ? '✅ ON' : '❌ OFF'}`,
    'market_pulse_toggle': `Market Pulse 📈: ${config.marketPulse.enabled ? '✅ ON' : '❌ OFF'}`, 
    'iss_pulse_toggle': `ISS Alert 🛰️: ${config.issPulse.enabled ? '✅ ON' : '❌ OFF'}`,
    'golden_hour_toggle': `Golden Hour 🌅: ${config.goldenHour.enabled ? '✅ ON' : '❌ OFF'}`, 
    'focus_shield_toggle': `Focus Shield 🛡️: ${config.focusShield.enabled ? '✅ ON' : '❌ OFF'}`,
    'cricket_scores_toggle': `Scores 📊: ${config.automaticScoreUpdates ? '✅ ON' : '❌ OFF'}`, 
    'ac_mode_powerful': 'Powerful Mode ⚡',
    'ac_mode_eco': 'Economy Mode 🍃', 
    'auto_ac': `Auto Pilot 🤖: ${config.autoAc ? '✅ ON' : '❌ OFF'}`,
    'ac_swing': 'Swing 🔄', 
    'ac_tv': 'TV Mode (Quiet) 🌘',
    'moon_toggle': `Moon Phase 🌑: ${config.moonPhaseMood?.enabled ? '✅ ON' : '❌ OFF'}`,
    'solar_toggle': `Solar Rhythm 🌅: ${config.solarRhythm?.enabled ? '✅ ON' : '❌ OFF'}`,
    'karaoke_toggle': `Karaoke 🎤: ${config.karaokeMode?.enabled ? '✅ ON' : '❌ OFF'}`,
    'boot_greet_toggle': `Boot Greet 👋: ${config.bootGreet !== false ? '✅ ON' : '❌ OFF'}`
  };
  return map[cmd] || cmd.replace(/_/g, ' ');
};

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

async function getNetworkJitter(): Promise<number | null> {
  try {
    const { stdout } = await execAsync("ping -c 1 8.8.8.8 | awk -F'/' 'END{print $5}'");
    return parseFloat(stdout.trim()) || null;
  } catch { return null; }
}

async function getBatteryStatus(): Promise<{ level: number, isPlugged: boolean } | null> {
  if (os.platform() !== 'darwin') return null;
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

function wishlistActivity(text: string) {
  const stamp = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const entry = `\n- [${stamp}] User: "${text}"`;
  fs.appendFileSync(WISHLIST_PATH, entry);
  logActivity(`🧠 Cortex: Wishlist updated - ${text}`);
}

function cleanDOM(html: string) {
  // Surgical strip of scripts, styles, and data-attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/ style="[^"]*"/gi, '')
    .replace(/ data-[a-z0-9-]+="[^"]*"/gi, '')
    .trim();
}

async function archiveClipboard(text: string) {
  try {
     fetch('http://localhost:3031/archive/hoard', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ text, source: "System" })
     }).catch(() => {});
  } catch(e) {}
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
      // 📱 Telegram Mobile
      for (const userId of (this.config.authorizedUsers || [])) {
        try { await this.bot.sendMessage(userId, text, { parse_mode: 'Markdown' }); } catch {}
      }
      
      // 💻 Native Mac (if running locally)
      if (process.platform === 'darwin') {
        const cleanText = text.replace(/[*_`#]/g, '').replace(/"/g, '\\"');
        const { exec } = require('child_process');
        exec(`osascript -e 'display notification "${cleanText}" with title "🌌 Gravity Hub" subtitle "${priority.toUpperCase()} Priority"'`);
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
let bot: any;
let lastGlobalSignal: { text: string, time: number } | null = null;
let lastLevelActions: Record<string, { text: string, time: number }> = {};

async function main() {
  config = loadConfig();
  if (config.commentaryMode === undefined) config.commentaryMode = false;
  if (!config.rejectedHabits) config.rejectedHabits = [];
  if (!config.deliveryWatch) config.deliveryWatch = { enabled: false };
  if (config.githubPulse.silent === undefined) config.githubPulse.silent = false;
  if (config.bootGreet === undefined) config.bootGreet = true;
  const CLIPBOARD_ONLY = process.env.CLIPBOARD_ONLY === 'true';
  
  // 📝 PID Lock for reliable shutdown
  fs.writeFileSync('/tmp/gravity-hub.pid', process.pid.toString());
  
  // Session Stats
  let sessionAcMinutes = 0;
  let sessionLightMinutes = 0;

  let offlineCounter = 0;
  let offlineSince: number | null = null; // Debounce tracking
  
  const TELEGRAM_TOKEN = config.telegram?.token || process.env.TELEGRAM_TOKEN;

  if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN not set');
    process.exit(1);
  }
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
  console.log('🧱 Gravity Hub: Waking up...');
  
  (async () => {
    try {
      await bot.initialize();
      console.log('✅ Telegram: Connected');
      
      // 🪄 Sync Command Suggestions (Slash menu v4.9.2)
      bot.setMyCommands([
        { command: 'status', description: 'Show current states' },
        { command: 'tv', description: '🌘 Cinematic Mode (Dimmest & Cool)' },
        { command: 'ac', description: 'AC: on|off|cool|dry|<temp>' },
        { command: 'lights', description: 'Lights: on|off|<dim>|<color>' },
        { command: 'media', description: '🎬 Media Exposure (Music Sync)' },
        { command: 'flows', description: '⚡ Manage Automation' },
        { command: 'auto_ac', description: '❄️ Toggle Auto-Pilot AC' },
        { command: 'auto_light', description: '🌅 Toggle Auto-Pilot Lights' },
        { command: 'scene', description: 'Scenes: tv|home|away|party|list' },
        { command: 'ping', description: 'Check Gravity health' },
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
  if (!CLIPBOARD_ONLY && config.miraie?.mobile && config.miraie?.password) {
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
  if (!CLIPBOARD_ONLY && config.wiz?.ip) {
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
  const getDurationString = (lastChangedIso: string | number) => {
    if (!lastChangedIso || lastChangedIso === "null" || lastChangedIso === "undefined" || lastChangedIso === "0") return "Just now";
    // Handle both ISO strings and numeric timestamps (as strings or numbers)
    let dateObj: Date;
    const num = Number(lastChangedIso);
    if (!isNaN(num) && num > 0) {
      dateObj = new Date(num);
    } else {
      dateObj = new Date(lastChangedIso);
    }
    const diff = Date.now() - dateObj.getTime();
    if (isNaN(diff) || diff < 0) return "Just now";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return dateObj.toLocaleDateString('en-IN');
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return "Just now";
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
  async function blinkLight(blinks = 2, color = { r: 255, g: 0, b: 0 }) {
    if (!wiz) return;
    try {
      const originalPilot = await (wiz as any).getPilot();
      for (let i = 0; i < blinks; i++) {
        await (wiz as any).setPilot({ state: true, r: color.r, g: color.g, b: color.b, dimming: 100 });
        await new Promise(r => setTimeout(r, 400));
        await (wiz as any).setPilot({ state: true, dimming: 10 });
        await new Promise(r => setTimeout(r, 400));
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
 
   // 💡 Pulse Light Helper (Subtle Atmosphere Shift)

  // 🌬️ Breathe Light Helper (Gentle Glow)
  async function breatheLight(color = { r: 0, g: 255, b: 255 }, cycles = 1) {
    if (!wiz) return;
    try {
      const original = await (wiz as any).getPilot();
      for (let i = 0; i < cycles; i++) {
        // Fade in
        await (wiz as any).setPilot({ state: true, r: color.r, g: color.g, b: color.b, dimming: 100 });
        await new Promise(r => setTimeout(r, 800));
        // Fade out slightly
        await (wiz as any).setPilot({ state: true, r: color.r, g: color.g, b: color.b, dimming: 20 });
        await new Promise(r => setTimeout(r, 800));
      }
      if (original) await (wiz as any).setPilot(original);
    } catch (e) { }
  }
   async function pulseLight(dimTo = 70, duration = 400) {
     if (!wiz) return;
     try {
       const originalPilot = await (wiz as any).getPilot();
       await (wiz as any).setPilot({ state: true, dimming: dimTo });
       await new Promise(r => setTimeout(r, duration));
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
     } catch (e) { console.error('Pulse failed', e); }
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
    command: 'media',
    description: 'Activate Media Exposure (High-fidelity cinematic aura)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      
      config.mediaAura = config.mediaAura === false ? true : false;
      saveConfig(config);
      
      const status = config.mediaAura ? 'ON (Syncing with Spotify) 🌈' : 'OFF (Stable Mode) 💡';
      await send(`🎬 *Media Exposure:* Liquid Aura is now *${status}*`);
      logActivity(`🎬 Media Sync: Liquid Aura toggled to ${status} via Telegram.`);
    }
  });

  bot.registerCommand({
    command: 'auto_ac',
    description: 'Toggle Autonomous AC (Weather-aware)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      config.autoAc = !config.autoAc;
      saveConfig(config);
      await send(`❄️ *Auto-AC:* Sovereignty is now *${config.autoAc ? 'ENABLED' : 'DISABLED'}*`);
    }
  });

  bot.registerCommand({
    command: 'auto_light',
    description: 'Toggle Autonomous Lighting (Sunset-aware)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      config.autoLight = !config.autoLight;
      saveConfig(config);
      await send(`💡 *Auto-Light:* Sovereignty is now *${config.autoLight ? 'ENABLED' : 'DISABLED'}*`);
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

  bot.registerCommand({
    command: 'flows',
    description: 'Manage Automations',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      
      const flows = config.zapit_flows || [];
      if (flows.length === 0) {
        return await send('⚡ *Gravity Flows*\n\nNo active flows found.');
      }

      let text = `⚡ *Gravity: Active Automations*\n━━━━━━━━━━━━━━\n`;
      flows.forEach((f: any, i: number) => {
        text += `${i+1}. *${f.id}* [Trigger: \`${f.trigger}\`]\n   🎁 Action: \`${f.action}\`\n\n`;
      });
      await send(text);
    }
  });
  
  bot.registerCommand({
    command: 'habit',
    description: 'View Habit Intelligence & Patterns',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const matched = (bot as any).getHandlers().find((h: any) => h.command === 'control');
      if (matched) await matched.handler(chatId, ['none', 'level', 'habits'], msg, send);
    }
  });

  bot.registerCommand({
    command: 'habits',
    description: 'Alias for /habit',
    handler: async (chatId, args, msg, send) => {
      const matched = (bot as any).getHandlers().find((h: any) => h.command === 'habit');
      if (matched) await matched.handler(chatId, args, msg, send);
    }
  });

  // ❄️ Mission Control Panel (Interactive v2.0)
  bot.registerCommand({
    command: 'control',
    description: 'Open the Interactive Control Panel',
    handler: async (chatId, args, msg, _send) => {
      if (!isAuthorized(msg)) return await _send('⛔ *Access Denied.*');
      // 🛡️ Ensure config pulses are initialized to prevent crashes
      config.githubPulse = config.githubPulse || { enabled: false };
      config.marketPulse = config.marketPulse || { enabled: false };
      config.issPulse = config.issPulse || { enabled: false };
      config.goldenHour = config.goldenHour || { enabled: false };
      config.focusShield = config.focusShield || { enabled: false, apps: ['Discord', 'YouTube', 'Twitter'] };
      config.moonPhaseMood = config.moonPhaseMood || { enabled: false };
      config.solarRhythm = config.solarRhythm || { enabled: false, wakeTime: '07:30', sleepTime: '23:30' };
      config.karaokeMode = config.karaokeMode || { enabled: false };
      config.weatherAura = config.weatherAura || { enabled: false };
      config.stats = config.stats || {};

      const send = async (text: string, opts: any = {}) => {
        try {
          if (msg.callback_query) {
            await (bot as any).sendRequest('editMessageText', {
              chat_id: chatId,
              message_id: msg.message_id,
              text,
              ...opts
            });
          } else {
            await (bot as any).sendMessage(chatId, text, opts);
          }
        } catch (e) {
          console.error('⚠️ Control Send Error:', e);
          await (bot as any).sendMessage(chatId, text, opts);
        }
      };
      
      const subCommand = args[0];
      const deviceId = miraie?.devices[0]?.deviceId;
      const isCallback = !!(msg as any).callback_query_id;
      
      const levelIdx = args.indexOf('level');
      const menuLevel = (levelIdx !== -1 && args[levelIdx + 1]) ? args[levelIdx + 1] : 'root';

      if (subCommand && subCommand !== 'none') {
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
           recordHabit(subCommand);
        } else if (subCommand === 'bright_up' || subCommand === 'bright_down') {
           const p = await wiz?.getPilot();
           const cur = p?.dimming || 50;
           await wiz?.executeAction({ type: 'control', payload: { state: true, dimming: Math.min(100, Math.max(10, subCommand === 'bright_up' ? cur + 10 : cur - 10)) } });
           recordHabit(subCommand);
        } else if (subCommand === 'bulb_warm' || subCommand === 'bulb_cool') {
           await wiz?.executeAction({ type: 'control', payload: { state: true, temp: subCommand === 'bulb_warm' ? 2700 : 6500 } });
           recordHabit(subCommand);
        } else if (subCommand === 'aura_toggle') {
           config.mediaAura = !config.mediaAura;
           saveConfig(config);
           recordHabit(subCommand);
        } else if (subCommand === 'auto_ac') {
           config.autoAc = !config.autoAc;
           saveConfig(config);
           recordHabit(subCommand);
        } else if (subCommand.startsWith('ac_mode_')) {
           const mode = subCommand.replace('ac_mode_', '') === 'powerful' ? 'powerful' : 'cool';
           if (deviceId) await miraie?.controlDevice(deviceId as string, { ps: 'on', acmd: mode });
           recordHabit(subCommand);
        } else if (subCommand === 'ac_swing') {
           // Toggle vertical swing
           const s = deviceId ? await miraie?.getDeviceStatus(deviceId) : null;
           const newSwing = s?.acvs === 'on' ? 'off' : 'on';
           if (deviceId) await miraie?.controlDevice(deviceId as string, { acvs: newSwing });
        } else if (subCommand.startsWith('color_')) {
           const color = subCommand.replace('color_', '');
           const colors: any = { red: { r: 255, g: 0, b: 0 }, blue: { r: 0, g: 0, b: 255 }, green: { r: 0, g: 255, b: 0 }, gold: { r: 255, g: 215, b: 0 } };
           if (wiz && colors[color]) await wiz.executeAction({ type: 'control', payload: { state: true, ...colors[color] } });
        } else if (subCommand === 'bulb_tv') {
           if (wiz) await wiz.executeAction({ type: 'control', payload: { state: true, scene: 'TV time', dimming: 10 } });
           recordHabit(subCommand);
        } else if (subCommand === 'cricket_toggle') {
           config.cricketMode = !config.cricketMode;
           saveConfig(config);
           recordHabit(subCommand);
        } else if (subCommand === 'github_pulse_toggle') {
            config.githubPulse.enabled = !config.githubPulse.enabled;
            saveConfig(config);
        } else if (subCommand === 'github_silent_toggle') {
            config.githubPulse.silent = !config.githubPulse.silent;
            saveConfig(config);
        } else if (subCommand === 'market_pulse_toggle') {
            config.marketPulse.enabled = !config.marketPulse.enabled;
            saveConfig(config);
        } else if (subCommand === 'iss_pulse_toggle') {
            config.issPulse.enabled = !config.issPulse.enabled;
            saveConfig(config);
        } else if (subCommand === 'golden_hour_toggle') {
            config.goldenHour.enabled = !config.goldenHour.enabled;
            saveConfig(config);
        } else if (subCommand === 'focus_shield_toggle') {
            config.focusShield.enabled = !config.focusShield.enabled;
            saveConfig(config);
         } else if (subCommand === 'moon_toggle') {
             config.moonPhaseMood.enabled = !config.moonPhaseMood.enabled;
             saveConfig(config);
         } else if (subCommand === 'solar_toggle') {
             config.solarRhythm.enabled = !config.solarRhythm.enabled;
             saveConfig(config);
         } else if (subCommand === 'karaoke_toggle') {
             config.karaokeMode.enabled = !config.karaokeMode.enabled;
             saveConfig(config);
         } else if (subCommand === 'weather_aura_toggle') {
             config.weatherAura.enabled = !config.weatherAura.enabled;
             saveConfig(config);
        } else if (subCommand === 'cricket_scores_toggle') {
           config.automaticScoreUpdates = !config.automaticScoreUpdates;
           saveConfig(config);
           recordHabit(subCommand);
        } else if (subCommand === 'cricket_live') {
            await bot.sendChatAction(chatId, "typing").catch(() => {});
            const ipl = await getLatestIplData();
            if (!ipl || !ipl.latestBall) {
              await bot.sendMessage(chatId, "🏏 *Cricket Pulse:* No live match detected or engine offline.");
            } else {
              const summary = formatIplSummary(ipl);
              await bot.sendMessage(chatId, summary, { parse_mode: "Markdown" });
            }
           return;
        } else if (subCommand === 'ac_tv') {
           await triggerScene('TV');
           recordHabit(subCommand);
        } else if (subCommand === 'commentary_toggle') {
           config.commentaryMode = !config.commentaryMode;
           saveConfig(config);
        } else if (subCommand === 'log_stats') {
           const stats = getFrequentedStats();
           await bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
           return;
        } else if (subCommand === 'delivery_watch_toggle') {
            config.deliveryWatch.enabled = !config.deliveryWatch.enabled;
            saveConfig(config);
        } else if (subCommand === 'delivery_test') {
            await notifier.notify(`📦 *DELIVERY ALERT:* Your package is out for delivery! (Test Signal)`, 'high');
            return;
        } else if (subCommand === 'github_silent_toggle') {
            config.githubPulse.silent = !config.githubPulse.silent;
            saveConfig(config);
        } else if (subCommand === 'boot_greet_toggle') {
            config.bootGreet = !config.bootGreet;
            saveConfig(config);
        } else if (subCommand.startsWith('ignore:')) {
           const habitKey = subCommand.replace('ignore:', '');
           if (!config.rejectedHabits) config.rejectedHabits = [];
           if (!config.rejectedHabits.includes(habitKey)) {
              config.rejectedHabits.push(habitKey);
              saveConfig(config);
           }
           await bot.sendMessage(chatId, "🚫 Understood. I'll stop suggesting this pattern.");
           return;
        } else if (subCommand === 'habits_reset_rejected') {
           config.rejectedHabits = [];
           saveConfig(config);
           await bot.sendMessage(chatId, "🔄 *Rejected patterns cleared.* I will scan everything again.");
           // Fall through to refresh menu
        }
        
        const formatted = formatAction(subCommand, config);
        lastLevelActions[menuLevel] = { text: formatted, time: Date.now() };
        globalLastAction = formatted;

        // If it was a button click, we want to REFRESH the control panel instead of sending a new one
        if (isCallback || args.includes('refresh')) {
           // We'll regenerate it below
        } else {
          return await send('✅ Command Sent');
        }
      }

    // 🛰️ The Sovereign Dashboard Engine
    const acStats = config.stats?.ac || { status: 'off', actmp: '24' };
    const lightStats = config.stats?.light || { status: 'off' };
    const actionStr = globalLastAction !== 'None' ? `${globalLastAction} (${getDurationString(String(globalLastActionTime))})` : 'None';
    const signalStr = lastGlobalSignal ? `\n📡 *Last Signal:* ${lastGlobalSignal.text} (${getDurationString(String(lastGlobalSignal.time))})` : '';
    const blinkStr = lastBlinkSignal.text !== 'None' ? `\n⚡ *Recent Blink:* ${lastBlinkSignal.text} (${getDurationString(String(lastBlinkSignal.time))})` : '';
    const liveStr = lastIplScore ? `\n🏏 *Live Score:* ${lastIplScore}` : '';
    
    let dashboard = `🌌 *Gravity Mission Control*\n━━━━━━━━━━━━━━\n❄️ AC: *${acStats.status.toUpperCase()}* (${acStats.actmp || '24'}°C) — _${getDurationString(config.stats.ac?.lastChanged)}_\n💡 Light: *${lightStats.status.toUpperCase()}* — _${getDurationString(config.stats.light?.lastChanged)}_\nRecent: *${actionStr}*${signalStr}${blinkStr}${liveStr}\n━━━━━━━━━━━━━━\n_Select a Vault for granular control._`;
    let keyboard: any = { inline_keyboard: [] };

    // 🏗️ Multi-Level Menu Dispatcher (Parse level from [..., 'level', 'root'])
    // menuLevel is already calculated at the top of the handler

    if (menuLevel === 'root') {
      keyboard.inline_keyboard = [
        [
          { text: acStats.status === 'on' ? '🚫 AC OFF' : '❄️ AC ON', callback_data: `control:ac_${acStats.status === 'on' ? 'off' : 'on'}:level:root` },
          { text: lightStats.status === 'on' ? '🌑 Light OFF' : '💡 Light ON', callback_data: `control:bulb_${lightStats.status === 'on' ? 'off' : 'on'}:level:root` }
        ],
        [
          { text: '🌡️ Climate Control', callback_data: 'control:none:level:ac' },
          { text: '💡 Lighting Vault', callback_data: 'control:none:level:light' }
        ],
        [
          { text: '🎭 Scene Intelligence', callback_data: 'control:none:level:scenes' },
          { text: '📡 Signal Vault', callback_data: 'control:none:level:intel' }
        ],
        [
          { text: '📅 Schedules', callback_data: 'control:none:level:schedules' },
          { text: '🧠 Habits', callback_data: 'control:none:level:habits' }
        ],
        [
          { text: '✨ Today', callback_data: 'control:none:level:today_intel' },
          { text: '📊 Status', callback_data: 'control:none:level:status_intel' }
        ]
      ];
    } else if (menuLevel === 'main') {
        // Redirect main to root for robustness
        return await (bot as any).getHandlers().find((h: any) => h.command === 'control').handler(chatId, ['none', 'level', 'root'], msg, send);
    } else if (menuLevel === 'intel') {
      const recentAction = lastLevelActions['intel'];
      const actionStr = recentAction ? `${recentAction.text} (${getDurationString(String(recentAction.time))})` : 'None';
      const signalStr = lastGlobalSignal ? `\n📡 *Last Signal:* ${lastGlobalSignal.text} (${getDurationString(String(lastGlobalSignal.time))})` : '';
      const blinkStr = lastBlinkSignal.text !== 'None' ? `\n⚡ *Recent Blink:* ${lastBlinkSignal.text} (${getDurationString(String(lastBlinkSignal.time))})` : '';
      
      dashboard = `📡 *Signal Vault*\n━━━━━━━━━━━━━━\nRecent: *${actionStr}*${signalStr}${blinkStr}\n━━━━━━━━━━━━━━\n_Toggle real-world event synchronization._`;
      keyboard.inline_keyboard = [
        [
          { text: config.githubPulse.enabled ? '🐙 Git: ✅ ON' : '🐙 Git: ❌ OFF', callback_data: 'control:github_pulse_toggle:level:intel' },
          { text: config.marketPulse.enabled ? '📈 Market: ✅ ON' : '📈 Market: ❌ OFF', callback_data: 'control:market_pulse_toggle:level:intel' }
        ],
        [
          { text: '🏏 Cricket Vault', callback_data: 'control:none:level:cricket' },
          { text: '🔔 Notifications', callback_data: 'control:none:level:notifications' }
        ],
        [
          { text: config.moonPhaseMood?.enabled ? '🌑 Moon: ✅ ON' : '🌑 Moon: ❌ OFF', callback_data: 'control:moon_toggle:level:intel' },
          { text: config.solarRhythm?.enabled ? '🌅 Solar: ✅ ON' : '🌅 Solar: ❌ OFF', callback_data: 'control:solar_toggle:level:intel' }
        ],
        [
          { text: config.issPulse.enabled ? '🛰️ ISS: ✅ ON' : '🛰️ ISS: ❌ OFF', callback_data: 'control:iss_pulse_toggle:level:intel' },
          { text: config.goldenHour.enabled ? '🌅 Golden: ✅ ON' : '🌅 Golden: ❌ OFF', callback_data: 'control:golden_hour_toggle:level:intel' }
        ],
        [
          { text: config.focusShield.enabled ? '🛡️ Shield: ✅ ON' : '🛡️ Shield: ❌ OFF', callback_data: 'control:focus_shield_toggle:level:intel' },
          { text: config.karaokeMode?.enabled ? '🎤 Karaoke: ✅ ON' : '🎤 Karaoke: ❌ OFF', callback_data: 'control:karaoke_toggle:level:intel' }
        ],
        [
          { text: config.weatherAura?.enabled ? '🌦️ Weather: ✅ ON' : '🌦️ Weather: ❌ OFF', callback_data: 'control:weather_aura_toggle:level:intel' },
          { text: config.commentaryMode ? '💬 Commentary: ✅ ON' : '💬 Commentary: ❌ OFF', callback_data: 'control:commentary_toggle:level:intel' }
        ],
        [
          { text: config.bootGreet !== false ? '👋 Boot Greet: ✅ ON' : '🔇 Boot Greet: ❌ OFF', callback_data: 'control:boot_greet_toggle:level:intel' },
          { text: '🔙 Back', callback_data: 'control:none:level:root' }
        ]
      ];
    } else if (menuLevel === 'cricket') {
      const actionStr = globalLastAction !== 'None' ? `${globalLastAction} (${getDurationString(String(globalLastActionTime))})` : 'None';
      const signalStr = lastGlobalSignal ? `\n📡 *Last Signal:* ${lastGlobalSignal.text} (${getDurationString(String(lastGlobalSignal.time))})` : '';
      const blinkStr = lastBlinkSignal.text !== 'None' ? `\n⚡ *Recent Blink:* ${lastBlinkSignal.text} (${getDurationString(String(lastBlinkSignal.time))})` : '';
      const projTrend = lastIplProjected > 0 ? ` (Proj: ${lastIplProjected})` : '';
      const liveStr = lastIplScore ? `\n🏏 *Live Score:* ${lastIplScore}${projTrend}` : '';
      
      dashboard = `🏏 *Cricket Vault*\n━━━━━━━━━━━━━━\nMode: *${config.cricketMode === 'commentary' ? 'LIGHTS + AUDIO' : (config.cricketMode ? 'LIGHTS ONLY' : 'OFF')}*\nScores: *${config.automaticScoreUpdates ? 'ENABLED' : 'DISABLED'}*\nRecent: *${actionStr}*${signalStr}${blinkStr}${liveStr}\n━━━━━━━━━━━━━━\n_Precision IPL & International match sync._`;
      keyboard.inline_keyboard = [
        [
          { text: '💡 Lights Only', callback_data: 'control:cricket_mode_lights:level:cricket' },
          { text: '🎙️ Lights + Audio', callback_data: 'control:cricket_mode_commentary:level:cricket' }
        ],
        [
          { text: '🌑 Mode: OFF', callback_data: 'control:cricket_mode_off:level:cricket' },
          { text: config.automaticScoreUpdates ? '📊 Scores: ✅ ON' : '📊 Scores: ❌ OFF', callback_data: 'control:cricket_scores_toggle:level:cricket' }
        ],
        [
          { text: '📣 Live Score', callback_data: 'control:cricket_live:level:cricket' }
        ],
        [
          { text: '🔙 Back', callback_data: 'control:none:level:intel' }
        ]
      ];
    } else if (menuLevel === 'notifications') {
      dashboard = `🔔 *Notification Center*\n━━━━━━━━━━━━━━\nGit Silent: *${config.githubPulse.silent ? 'ENABLED' : 'DISABLED'}*\nBoot Greet: *${config.bootGreet ? 'ENABLED' : 'DISABLED'}*\n━━━━━━━━━━━━━━\n_Silence the noise, keep the pulse._`;
      keyboard.inline_keyboard = [
        [
          { text: config.githubPulse.silent ? '🔇 Git Silent: ✅ ON' : '🔔 Git Silent: ❌ OFF', callback_data: 'control:github_silent_toggle:level:notifications' },
          { text: config.bootGreet ? '👋 Boot Greet: ✅ ON' : '🔇 Boot Greet: ❌ OFF', callback_data: 'control:boot_greet_toggle:level:notifications' }
        ],
        [
          { text: '🔙 Back', callback_data: 'control:none:level:intel' }
        ]
      ];
    } else if (menuLevel === 'light') {
      dashboard = `💡 *Lighting Vault*\n━━━━━━━━━━━━━━\nStatus: *${lightStats.status.toUpperCase()}*\nAura: *${config.mediaAura !== false ? 'SYNC' : 'STATIC'}*\nRecent: *${lastLevelActions['light']?.text || 'None'}*\n━━━━━━━━━━━━━━\n_Adjust brightness or atmosphere._`;
      keyboard.inline_keyboard = [
        [
          { text: '➕ Brighten', callback_data: 'control:bright_up:level:light' },
          { text: '➖ Dim', callback_data: 'control:bright_down:level:light' }
        ],
        [
          { text: '🔴 Red', callback_data: 'control:color_red:level:light' },
          { text: '🔵 Blue', callback_data: 'control:color_blue:level:light' },
          { text: '🟢 Green', callback_data: 'control:color_green:level:light' },
          { text: '🟡 Gold', callback_data: 'control:color_gold:level:light' }
        ],
        [
          { text: '❄️ Cool (6K)', callback_data: 'control:bulb_cool:level:light' },
          { text: '🕯️ Warm (2K)', callback_data: 'control:bulb_warm:level:light' }
        ],
        [
          { text: '🌘 TV Mode', callback_data: 'control:bulb_tv:level:light' },
          { text: config.cricketMode ? '🏏 Cricket: ✅ ON' : '🏏 Cricket: ❌ OFF', callback_data: 'control:cricket_toggle:level:light' }
        ],
        [
          { text: config.automaticScoreUpdates ? '📊 Scores: ✅ ON' : '📊 Scores: ❌ OFF', callback_data: 'control:cricket_scores_toggle:level:light' },
          { text: config.mediaAura !== false ? '🌈 Aura: ✅ ON' : '🌈 Aura: ❌ OFF', callback_data: 'control:aura_toggle:level:light' }
        ],
        [
          { text: config.githubPulse.enabled ? '🐙 Git: ✅ ON' : '🐙 Git: ❌ OFF', callback_data: 'control:github_pulse_toggle:level:light' },
          { text: config.marketPulse.enabled ? '📈 Market: ✅ ON' : '📈 Market: ❌ OFF', callback_data: 'control:market_pulse_toggle:level:light' }
        ],
        [
          { text: config.focusShield.enabled ? '🛡️ Shield: ✅ ON' : '🛡️ Shield: ❌ OFF', callback_data: 'control:focus_shield_toggle:level:light' },
          { text: config.deliveryWatch?.enabled ? '📦 Delivery: ✅ ON' : '📦 Delivery: ❌ OFF', callback_data: 'control:delivery_watch_toggle:level:light' }
        ],
        [
          { text: '🔙 Back to Hub', callback_data: 'control:none:level:root' }
        ]
      ];
    } else if (menuLevel === 'scenes') {
      dashboard = `🎭 *Gravity: Scene Selection*\n━━━━━━━━━━━━━━\nRecent: *${lastLevelActions['scenes']?.text || 'None'}*\n━━━━━━━━━━━━━━\nSelect a multi-device orchestration flow.`;
      keyboard.inline_keyboard = [
        [
          { text: '📽️ TV Mode', callback_data: 'scene:tv:level:scenes' },
          { text: '🧠 Focus', callback_data: 'scene:focus:level:scenes' }
        ],
        [
          { text: '🏠 Home', callback_data: 'scene:home:level:scenes' },
          { text: '🏃 Away', callback_data: 'scene:away:level:scenes' }
        ],
        [
          { text: config.cricketMode ? '🏏 Stop Cricket Mode' : '🏏 Start Cricket Mode', callback_data: 'control:cricket_toggle:level:scenes' }
        ],
        [
          { text: '🔙 Back to Hub', callback_data: 'control:none:level:root' }
        ]
      ];
    } else if (menuLevel === 'ac') {
      dashboard = `❄️ *Climate Control*\n━━━━━━━━━━━━━━\nStatus: *${acStats.status.toUpperCase()}* (${acStats.actmp || '24'}°C)\nAuto-Guard: *${config.autoAc ? 'ACTIVE' : 'OFF'}*\nRecent: *${lastLevelActions['ac']?.text || 'None'}*\n━━━━━━━━━━━━━━\n_Precision cooling & modes._`;
      keyboard.inline_keyboard = [
        [
          { text: '🌡️ Temp -1°', callback_data: 'control:temp_down:level:ac' },
          { text: '🌡️ Temp +1°', callback_data: 'control:temp_up:level:ac' }
        ],
        [
          { text: '⚡ Powerful', callback_data: 'control:ac_mode_powerful:level:ac' },
          { text: '🍃 Economy', callback_data: 'control:ac_mode_eco:level:ac' }
        ],
        [
          { text: config.autoAc ? '🤖 Auto Pilot: ✅ ON' : '🤖 Auto Pilot: ❌ OFF', callback_data: 'control:auto_ac:level:ac' },
          { text: '🔄 Swing', callback_data: 'control:ac_swing:level:ac' }
        ],
        [
          { text: '🌘 TV Mode (Quiet)', callback_data: 'control:ac_tv:level:ac' }
        ],
        [
          { text: '🔙 Back to Hub', callback_data: 'control:none:level:root' }
        ]
      ];
    } else if (menuLevel === 'habits') {
      const habits = config.habits || [];
      const suggestions: string[] = [];
      if (habits.length > 20) {
        // Simple suggestion engine: find actions done 3+ times at the same hour
        const hourMap: Record<string, number> = {};
        habits.forEach((h: any) => {
          const hour = Math.floor(h.time / 60);
          const key = `${h.command}@${hour}`;
          hourMap[key] = (hourMap[key] || 0) + 1;
        });
        Object.entries(hourMap).forEach(([key, count]) => {
          if (count >= 3) {
             const [cmd, hour] = key.split('@');
             const timeStr = `${hour.padStart(2, '0')}:00`;
             const exists = (config.scheduler || []).some((j: any) => j.time === timeStr && j.action === cmd);
             if (!exists) suggestions.push(`💡 Schedule *${cmd}* at *${timeStr}*? (Count: ${count})`);
          }
        });
      }
      dashboard = `🧠 *Habit Intelligence*\n━━━━━━━━━━━━━━\nTracking: *${habits.length} events*\nRejected: *${config.rejectedHabits?.length || 0} patterns*\n\n*Unreviewed Suggestions:*\n${suggestions.length ? suggestions.join('\n') : '_No new patterns detected yet._'}`;
      keyboard.inline_keyboard = [
        [
          { text: '📊 Full Analysis', callback_data: 'habits_full' },
          { text: '🗑️ Clear Data', callback_data: 'habits_clear' }
        ],
        [
          { text: '🔄 Reset Rejected', callback_data: 'control:habits_reset_rejected:level:habits' },
          { text: '🔙 Back', callback_data: 'control:none:level:root' }
        ]
      ];
    } else if (menuLevel === 'schedules') {
      const jobs = config.scheduler || [];
      dashboard = `📅 *Sovereign Schedules*\n━━━━━━━━━━━━━━\nActive: *${jobs.length} routines*\n\n${jobs.map((j: any) => `• ${j.time} [${j.days}] -> *${j.action}*`).join('\n')}`;
      keyboard.inline_keyboard = [
        [
          { text: '➕ Add Routine', callback_data: 'schedule_add' },
          { text: '🗑️ Manage All', callback_data: 'schedule_manage' }
        ],
        [
          { text: '🔙 Back to Hub', callback_data: 'control:none:level:root' }
        ]
      ];
    } else if (menuLevel === 'today_intel') {
       // Today summary
       const matched = (bot as any).getHandlers().find((h: any) => h.command === 'today');
       if (matched) return await matched.handler(chatId, [], msg, send);
    } else if (menuLevel === 'status_intel') {
       const recentAction = lastLevelActions['status_intel'];
       const actionStr = recentAction ? `${recentAction.text} (${getDurationString(recentAction.time)})` : 'None';
       dashboard = `📊 *System Status*\n━━━━━━━━━━━━━━\nRecent: *${actionStr}*\n━━━━━━━━━━━━━━\n_Toggle system-level responses._`;
       keyboard.inline_keyboard = [
         [
           { text: config.bootGreet ? '👋 Greet: ✅ ON' : '👋 Greet: ❌ OFF', callback_data: 'control:boot_greet_toggle:level:status_intel' },
           { text: '📜 View Logs', callback_data: 'control:none:level:root' } // Placeholder
         ],
         [
           { text: '🔙 Back', callback_data: 'control:none:level:intel' }
         ]
       ];
    }

    if (isCallback) {
      try {
        await (bot as any).sendRequest('editMessageText', {
          chat_id: chatId,
          message_id: (msg as any).message_id,
          text: dashboard,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } catch (e) {}
    } else {
      await (bot as any).sendMessage(chatId, dashboard, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    }
  });

  // ── Presence Detection & Automations ───────────────
  if (!CLIPBOARD_ONLY) {
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
  }

  // 🛡️ Gravity Auto-Pilot: Environment & Hardware Engine
  setInterval(async () => {
    try {
      const now = new Date();
      const hour = now.getHours();

      // 0. Rapid Hardware Sync (Analog Remote Awareness)
      if (miraie && miraie.devices.length > 0) {
        const s = await miraie.getDeviceStatus(miraie.devices[0].deviceId);
        const actualAcStatus = (s?.ps === 'on' || s?.ps === '1' || s?.ps === 'true') ? 'on' : 'off';
        updateDeviceState('ac', actualAcStatus);
      }
      if (wiz) {
        const p = await (wiz as any).getPilot();
        updateDeviceState('light', p?.state ? 'on' : 'off');
      }

      // 1. Auto-AC Logic (Weather Sensitive)
      if (config.autoAc) {
        const w: any = await (weather as any).getWeather();
        if (w) {
          if (w.temp > 31 && config.stats.ac?.status === 'off' && isPhoneOnline) {
            await triggerScene('chill');
            await notifier.notify(`🌡️ *Sovereignty:* External temp hit *${w.temp}°C*. I've engaged your AC to keep the God Build cool.`, 'low');
          } else if (w.temp < 27 && config.stats.ac?.status === 'on') {
            const d = miraie?.devices[0]?.deviceId;
            if (d) await miraie?.controlDevice(d, { ps: 'off' });
            updateDeviceState('ac', 'off');
            await notifier.notify(`🍃 *Sovereignty:* External temp dropped to *${w.temp}°C*. Turning off the AC to balance the room.`, 'low');
          }
        }
      }

      // 2. Auto-Light Logic (Sunset & Bedtime)
      if (config.autoLight) {
        // Sunset Pulse (Approx 6:30 PM - 7:30 PM)
        if (hour === 18 && config.stats.lightStatus === 'off' && isPhoneOnline) {
          await (wiz as any).setPilot({ state: true, temp: 3000, dimming: 80 });
          updateDeviceState('light', 'on');
          await notifier.notify(`🌅 *Sovereignty:* Golden Hour detected. Waking up the Hub lights.`, 'low');
        }
        // Bedtime Pulse (12:30 AM)
        if (hour === 0 && config.stats.lightStatus === 'on' && !isPhoneOnline) {
           await (wiz as any).setPilot({ state: false });
           updateDeviceState('light', 'off');
           await notifier.notify(`🌙 *Sovereignty:* Late-night silence. Turning off the lights for you.`, 'low');
        }
      }
    } catch {}
  }, 30000); // 🚀 Rapid Hardware Sync: 30 seconds

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
  const calculatePgvclBill = (units: number, includeFixed = true) => {
    let energyCharge = 0;
    if (units <= 50) energyCharge = units * 3.05;
    else if (units <= 100) energyCharge = (50 * 3.05) + (units - 50) * 3.50;
    else if (units <= 250) energyCharge = (50 * 3.05) + (50 * 3.50) + (units - 100) * 4.15;
    else energyCharge = (50 * 3.05) + (50 * 3.50) + (150 * 4.15) + (units - 250) * 5.20;
    
    const fpppa = units * 2.90; // Approx FPPPA
    const fixed = includeFixed ? 50 : 0; // Monthly fixed charge
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
          // 📺 Authentic 'TV time' WiZ Scene (10% dimming)
          promises.push(wiz.executeAction({ type: 'control', payload: { state: true, scene: 'TV time', dimming: 10 } }));
        if (miraie && miraie.devices.length > 0) {
          // ❄️ Silent Movie cooling
          promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ps: 'on', actmp: '24', acmd: 'cool', acfs: 'low' }));
        }
        speak("Cinematic mode active. Enjoy your movie.");
        break;
      case 'CRICKET':
      case 'IPL':
        config.cricketMode = !config.cricketMode;
        saveConfig(config);
        speak(`Cricket mode ${config.cricketMode ? 'activated' : 'deactivated'}.`);
        break;
      case "WORK":
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
      case "CHILL":
      case "chill":
        logActivity("🎬 Scene: CHILL (Media Aura)");
        if (wiz) {
           // Deep Purple/Lounge Vibe
           promises.push(wiz.executeAction({ type: 'control', payload: { 
             state: true, 
             r: 155, g: 48, b: 255, 
             dimming: 40 
           }}));
        }
        break;
      case "MORNING_BRIEF":
        const hours = (config.stats.acMinutes / 60).toFixed(1);
        const lhours = (config.stats.lightMinutes / 60).toFixed(1);
        const dailyEst = (config.stats.acMinutes / 60 * 1.65) + (config.stats.lightMinutes / 60 * 0.012);
        const bill = calculatePgvclBill(dailyEst);
        speak(`Good morning Master. Hub is at peak health. AC ran for ${hours} hours today. Current bill estimate for today is ${bill} rupees. System is autonomous.`);
        await (bot as any).sendMessage(config.telegram.chatId, `☀️ *Morning Briefing*\n\n❄️ AC Runtime: *${hours}h*\n💡 Light Runtime: *${lhours}h*\n🔌 Energy Rank: *S-Tier*\n💰 Est. Today: *₹${bill}*\n\nWelcome back to the grid.`, { parse_mode: 'Markdown' });
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
    command: 'tv',
    description: 'Cinematic mode (Dimmest & Cool)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      await triggerScene('TV_TIME');
      await send('📽️ *TV Mode:* Engaged. Lights dimmed to 10%, AC silent & cool.');
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
        '`/control` — Master Panel (Lights, Scenes, Signal Vault)',
        '`/status` — live hub telemetry',
        '',
        '🏏 *Cricket & Sports*',
        '`/ipl` — live score & win forecast',
        '`/results` — recent match results',
        '`/upcoming` — future IPL schedule',
        '`/match <num>` — specific match details',
        '`/team <name>` — team-specific pulse',
        '`/cricket mode <lights|commentary|off>`',
        '`/cricket follow <player|team>` — notify on mentions',
        '',
        '📈 *Signal Intelligence*',
        '`/trending` — fetch GitHub top repos',
        '`/odds` — prediction markets (Poly/Kalshi)',
        '`/polymarket` · `/kalshi` — direct market pulse',
        '`/follow <key>` — alerts for specific markets',
        '`/track <type> <sym>` — market pulse for stocks/crypto',
        '`/deliver` — simulate a delivery arrival 🚚',
        '',
        '🧠 *Habit Intelligence*',
        '`/habit` — dashboard & optimization suggestions',
        '`/habits` — view recorded manual patterns',
        '',
        '📜 *Activity & Records*',
        '`/log` · `/logs` — view recent house activity',
        '`/wish` — add to Gravity Wishlist',
        '',
        '🕰 *Intelligence Loops*',
        'ISS, GitHub Pulse, Market Swings, and Golden Hour are fully automated.',
        'Use `/control` -> **📡 Signal Vault** to toggle them.',
        '`/broadcast [msg]` — speak on Mac speakers 🎙️',
        '`/guest` — generate 1-hour PIN PIN for visitors 🔑',
        '`/join [PIN]` — join house as temporary guest',
        '`/energy` — show device usage & analytics 📊',
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
        await wiz.executeAction({ type: 'control', payload: { state: true, scene: 'TV time', dimming: 10 } });
        await send(`📺 *TV Mode:* Authentic WiZ 'TV time' scene at 10%`);
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
      await breatheLight({ r: 0, g: 255, b: 255 }, 2); // Cyan Breathe
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
    description: 'WiZ scene: /scene tv, /scene cozy, /scene party, /scene relax, /scene focus, /scene warm, /scene cool, /scene bedtime, /scene fireplace, /scene ocean, /scene sunrise',
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
  // Unified Sensory Pulse Integration
  // ──────────────────────────────────────────────────────

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
      const acH = (stats.acMinutes / 60).toFixed(1);
      const ltH = (stats.lightMinutes / 60).toFixed(1);
      const dailyEst = (stats.acMinutes / 60 * 1.65) + (stats.lightMinutes / 60 * 0.012);
      const bill = calculatePgvclBill(dailyEst);
      
      const load = os.loadavg();
      
      let message = `👔 *Gravity Hub Executive Briefing*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `🛡️ *Security:* System is **GOD MODE (Active)**\n`;
      message += `❄️ *AC Usage:* **${acH} hrs** today\n`;
      message += `💡 *Light Usage:* **${ltH} hrs** today\n`;
      message += `💰 *Est. Cost:* **₹${bill}** today\n`;
      message += `🕰️ *Uptime:* ${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m active\n`;
      message += `🖥️ *SysLoad:* ${load[0].toFixed(2)} (1m avg)\n`;
      
      if (miraie && miraie.devices.length > 0) {
        const s = await miraie.getDeviceStatus(miraie.devices[0].deviceId);
        message += `🌡️ *Climate:* AC is currently **${s?.ps?.toUpperCase() || 'OFF'}** (${s?.actmp || '?' }°C)\n`;
      }
      
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
      
      lines.push(`⏱ *Session Uptime*: ${Math.floor(botUptime/3600)}h ${Math.floor((botUptime%3600)/60)}m`);
      lines.push(`💤 *Bot Downtime*: Last down for ${botOffBefore}`);
      
      const spotify = await getSpotifyStatus();
      if (spotify) {
        lines.push(`\n🎵 *Spotify*: ${spotify}`);
      }

      const jitter = await getNetworkJitter();
      const batt = await getBatteryStatus();
      
      let systemHealth = [];
      if (jitter) systemHealth.push(jitter > 150 ? `📡 Network: Jittery (${jitter.toFixed(0)}ms)` : `📡 Network: Stable`);
      if (batt) systemHealth.push(batt.isPlugged ? `🔌 Power: Multi-Source` : `🔋 Power: Battery (${batt.level}%)`);
      
      if (systemHealth.length > 0) {
        lines.push(`\n⚙️ *System Health*:\n${systemHealth.join('\n')}`);
      }
      
      try {
        const logs = fs.readFileSync(LOG_PATH, 'utf-8').trim().split('\n');
        const last = logs[logs.length - 1] || "No events logged yet.";
        lines.push(`\n📜 *Last Activity*: \`${last.split('] ')[1] || last}\``);
      } catch {}

      await send(lines.join('\n'));
    }
  });

  // 🌦️ /weather — Gravity Weather Intelligence (Unified)
  bot.registerCommand({
    command: 'weather',
    description: 'Junagadh weather, AQI & Sensory Sync',
    handler: async (chatId, args, msg, send) => {
      await send('🌦 *Gravity Weather*: Synchronizing with local sensors...');
      try {
        const w = await new WeatherEngine().getWeather();
        if (!w) return await send('❌ Weather data unavailable.');
        
        const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        let res = `🌦 *Junagadh Intelligence Pulse* [${now}]\n\n`;
        res += `🌡️ Temp: *${w.temp}°C*\n`;
        res += `💧 Humidity: *${w.humidity}%*\n`;
        res += `☁️ Condition: *${w.condition}*\n`;
        res += `☔ Rain: *${w.isRain ? 'YES' : 'NO'}*\n`;
        if (w.aqi) res += `🌫️ AQI: *${w.aqi}* (${w.aqi < 50 ? 'Good' : w.aqi < 100 ? 'Moderate' : 'Poor'})\n`;
        res += `\n🌅 Sunrise: \`${w.sunrise}\`\n`;
        res += `🌇 Sunset: \`${w.sunset}\`\n`;
        
        // 🧬 Sensory Sync Logic
        if (wiz) {
          let scene = 'Warm White';
          if (w.isRain) scene = 'Ocean';
          else if (w.condition.includes('Clear')) scene = 'True colors';
          await wiz.executeAction({ type: 'control', payload: { state: true, scene } });
          res += `\n💡 *Lighting*: Synced to *${scene}*`;
        }

        if (miraie && (miraie as any).devices.length > 0) {
          const device = (miraie as any).devices[0];
          if (w.temp > 32) {
             await (miraie as any).controlDevice(device.deviceId, { ps: 'on', actmp: '24', acmd: 'cool' });
             res += `\n❄️ *AC*: Cooling engaged (*24°C*)`;
          } else if (w.temp < 25) {
             await (miraie as any).controlDevice(device.deviceId, { ps: 'on', actmp: '26', acmd: 'cool' });
             res += `\n🌡️ *AC*: Warming engaged (*26°C*)`;
          }
        }
        
        res += `\n\n_Last Sensor Sync: ${new Date(w.updatedAt).toLocaleTimeString('en-IN')}_`;
        await send(res);
      } catch (e: any) {
        await send(`❌ Weather sync failed: ${e.message}`);
      }
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

  // 📜 /logs — Activity Stream (Cleaned)
  bot.registerCommand({
    command: 'logs',
    description: 'Show last N activity log entries (default 10)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const count = parseInt(args[0] || '10');
      try {
        const data = fs.readFileSync(LOG_PATH, 'utf-8');
        const lines = data.trim().split('\n').filter(l => l.length > 0).slice(-count);
        const filtered = lines.map(l => l.replace(/\[.*\]\s*/, '🔹 ')).join('\n');
        const text = `📜 *Recent Activity (Last ${lines.length})*\n━━━━━━━━━━━━━━\n${filtered || '_No logs found._'}`;
        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
      } catch (e) {
        await send('❌ Failed to read log file.');
      }
    }
  });

  bot.registerCommand({
    command: 'log',
    description: 'Alias for /logs or add entry: /log hello',
    handler: async (chatId, args, msg, send) => {
       if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
       if (args.length > 0 && isNaN(Number(args[0]))) {
         const text = args.join(' ');
         logActivity(`🧠 Cortex: User Log - ${text}`);
         await send('✅ *Log Entry Added.*');
       } else {
         const matched = (bot as any).getHandlers().find((h: any) => h.command === 'logs');
         if (matched) await matched.handler(chatId, args, msg, send);
       }
    }
  });

  // 🧠 /wish — Add to Wishlist
  bot.registerCommand({
    command: 'wish',
    description: 'Add a feature request to Gravity Wishlist',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const text = args.join(' ');
      if (!text) return await send('✏️ Usage: `/wish I want a coffee machine`');
      wishlistActivity(text);
      await send('🧠 *Wish Captured.* Added to Gravity Wishlist.');
    }
  });

  // 📋 /wishlist — View Wishlist
  bot.registerCommand({
    command: 'wishlist',
    description: 'View the current Gravity Wishlist',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      try {
        const data = fs.readFileSync(WISHLIST_PATH, 'utf-8');
        // Just show the last 20 lines to keep it clean
        const lines = data.split('\n').slice(-30).join('\n');
        await send(`🧠 *Gravity Wishlist (Recent)*\n━━━━━━━━━━━━━━\n${lines}`);
      } catch (e) {
        await send('❌ Failed to read wishlist.');
      }
    }
  });

  // ✨ /today — Quick Stats
  bot.registerCommand({
    command: 'today',
    description: 'Show today\'s energy usage and costs',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const stats = config.stats;
      const acH = (stats.acMinutes / 60).toFixed(1);
      const ltH = (stats.lightMinutes / 60).toFixed(1);
      const units = (stats.acMinutes / 60 * 1.65) + (stats.lightMinutes / 60 * 0.012);
      const bill = calculatePgvclBill(units, false); // Exclude fixed charge for daily view
      
      const res = [
        `✨ *Gravity Today's Usage*`,
        `━━━━━━━━━━━━━━`,
        `❄️ AC Runtime: *${acH} hrs*`,
        `💡 Light Runtime: *${ltH} hrs*`,
        `🔌 Est. Consumption: *${units.toFixed(2)} units*`,
        `💰 Est. Energy Cost: *₹${bill}*`,
        `━━━━━━━━━━━━━━`,
        `_Note: Excludes monthly fixed charges._`,
        `_Last Reset: ${new Date(stats.lastReset || Date.now()).toLocaleTimeString('en-IN')}_`
      ].join('\n');
      await send(res);
    }
  });

  // 🏏 /cricket — Toggle IPL Mode / Score Updates
  bot.registerCommand({
    command: 'cricket',
    description: 'Toggle IPL Mode / Score Updates',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const sub = args[0]?.toLowerCase();
      
      if (sub === 'mode') {
        const mode = args[1]?.toLowerCase();
        if (mode === 'commentary') {
          config.cricketMode = 'commentary';
          await send('🏏 *Cricket Mode:* LIGHTS + COMMENTARY 🎙️');
        } else if (mode === 'lights') {
          config.cricketMode = true;
          await send('🏏 *Cricket Mode:* LIGHTS ONLY 💡');
        } else {
          config.cricketMode = false;
          await send('🏏 *Cricket Mode:* OFF 🌑');
        }
        saveConfig(config);
        return;
      }

      if (sub === 'player' || sub === 'follow') {
        const name = args.slice(1).join(' ').toLowerCase();
        if (!name) return await send('❌ Usage: `/cricket follow <player name>`');
        config.cricketFollow = config.cricketFollow || [];
        if (config.cricketFollow.includes(name)) {
          config.cricketFollow = config.cricketFollow.filter((n: string) => n !== name);
          await send(`✅ Stopped following: *${name.toUpperCase()}*`);
        } else {
          config.cricketFollow.push(name);
          await send(`✅ Now following: *${name.toUpperCase()}*`);
        }
        saveConfig(config);
        return;
      }

      if (sub === 'scores') {
        config.automaticScoreUpdates = !config.automaticScoreUpdates;
        saveConfig(config);
        return await send(`📊 Automatic Score Updates: *${config.automaticScoreUpdates ? 'ENABLED' : 'DISABLED'}*`);
      }

      // Cycle Logic: Lights -> Commentary -> Off
      if (args.length === 0) {
        if (!config.cricketMode) {
          config.cricketMode = true; // Lights Only
          await send('🏏 *Cricket Mode:* LIGHTS ONLY 💡');
        } else if (config.cricketMode === true) {
          config.cricketMode = 'commentary';
          await send('🏏 *Cricket Mode:* LIGHTS + COMMENTARY 🎙️');
        } else {
          config.cricketMode = false;
          await send('🏏 *Cricket Mode:* OFF 🌑');
        }
        saveConfig(config);
        logActivity(`🏏 Cricket Mode Cycle: ${config.cricketMode}`);
        return;
      }
    }
  });

  // 📈 /track — Add stock/crypto to Market Pulse
  bot.registerCommand({
    command: 'track',
    description: 'Track stock/crypto. Tip: Use .NS for India (e.g. TCS.NS)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const type = args[0]?.toLowerCase();
      const symbol = args[1]?.toLowerCase();
      if (type === 'stock') {
        if (!config.marketPulse.stocks.includes(symbol.toUpperCase())) {
          config.marketPulse.stocks.push(symbol.toUpperCase());
          saveConfig(config); await send(`✅ Added Stock: *${symbol.toUpperCase()}*`);
        } else { await send('⚠️ Stock already being tracked.'); }
      } else if (type === 'crypto') {
        if (!config.marketPulse.crypto.includes(symbol)) {
          config.marketPulse.crypto.push(symbol);
          saveConfig(config); await send(`✅ Added Crypto: *${symbol}*`);
        } else { await send('⚠️ Crypto already being tracked.'); }
      } else {
        await send('❌ *Usage:* /track <stock|crypto> <symbol>\n\n💡 *Tips:*\n• US Stocks: `AAPL`\n• Indian Stocks: `RELIANCE.NS`\n• Crypto: `bitcoin`');
      }
    }
  });

  // 📉 /untrack — Remove stock/crypto from Market Pulse
  bot.registerCommand({
    command: 'untrack',
    description: 'Remove a stock or crypto from Market Pulse',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const type = args[0]?.toLowerCase();
      const symbol = args[1]?.toLowerCase();
      if (type === 'stock') {
        config.marketPulse.stocks = config.marketPulse.stocks.filter(s => s !== symbol.toUpperCase());
        saveConfig(config); await send(`✅ Removed Stock: *${symbol.toUpperCase()}*`);
      } else if (type === 'crypto') {
        config.marketPulse.crypto = config.marketPulse.crypto.filter(c => c !== symbol);
        saveConfig(config); await send(`✅ Removed Crypto: *${symbol}*`);
      } else { await send('❌ Usage: /untrack <stock|crypto> <symbol>'); }
    }
  });

  // 🔥 /trending — GitHub Trends
  bot.registerCommand({
    command: 'trending',
    description: 'Fetch top trending repositories on GitHub',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const lang = args[0] || '';
      await send(`🔍 *Scraping GitHub Trending* ${lang ? 'for ' + lang : ''}...`);
      try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`https://github.com/trending/${lang}`, { waitUntil: 'networkidle2' });
        const repos = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('article.Box-row'));
          return items.slice(0, 5).map(item => ({
            name: item.querySelector('h2 a')?.innerText.trim().replace(/\s+/g, ''),
            desc: item.querySelector('p')?.innerText.trim() || 'No description',
            link: 'https://github.com' + item.querySelector('h2 a')?.getAttribute('href')
          }));
        });
        await browser.close();
        if (repos.length === 0) return await send('❌ No trending repos found.');
        let res = `🔥 *GitHub Trending* ${lang ? '(' + lang + ')' : ''}\n━━━━━━━━━━━━━━\n`;
        repos.forEach((r, i) => {
          res += `${i+1}. [${r.name}](${r.link})\n_${r.desc.slice(0, 80)}..._\n\n`;
        });
        await send(res, { parse_mode: 'Markdown', disable_web_page_preview: true });
      } catch (e) {
        await send('❌ Scraper failed: ' + e.message);
      }
    }
  });

  // 🔮 /odds — Prediction Markets (v4.8)
  const oddsHandler = async (chatId: number, args: string[], msg: any, send: any, forceSource?: 'poly' | 'kalshi') => {
    if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
    const query = args.join(' ').toLowerCase();
    const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
    
    await send(`🔮 *Consulting the Oracles...* [${dateStr}]`);
    
    try {
      let res = `🔮 *Gravity Oracle Pulse*\n📅 *${dateStr}*\n━━━━━━━━━━━━━━\n`;
      
      if (!forceSource || forceSource === 'poly') {
        const polyRes = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20');
        const polyMarkets = await polyRes.json();
        const polyFiltered = (polyMarkets as any).filter((m: any) => !query || m.question.toLowerCase().includes(query)).slice(0, 6);
        
        res += `*Polymarket (% probability)*\n`;
        polyFiltered.forEach((m: any) => {
          const prob = m.outcomePrices ? (JSON.parse(m.outcomePrices)[0] * 100).toFixed(0) : '?';
          const url = m.slug ? `[${m.question.slice(0, 45)}...](https://polymarket.com/event/${m.slug})` : m.question.slice(0, 45);
          res += `• ${url}: *${prob}%*\n`;
        });
      }

      if (!forceSource || forceSource === 'kalshi') {
        if (!forceSource) res += '\n';
        try {
          const kalshiRes = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=20');
          const kalshiMarkets = await kalshiRes.json();
          // Kalshi v2 often wraps in .markets, but some endpoints return the array directly
          const markets = Array.isArray(kalshiMarkets) ? kalshiMarkets : (kalshiMarkets.markets || []);
          
          if (markets.length > 0) {
            const kalFiltered = markets.filter((m: any) => !query || (m.title || '').toLowerCase().includes(query)).slice(0, 6);
            if (kalFiltered.length > 0) {
              res += `*Kalshi (% probability)*\n`;
              kalFiltered.forEach((m: any) => {
                const prob = (m.yes_price || m.last_price || 0);
                const title = m.title || m.question || 'Untitled';
                const url = m.ticker ? `[${title.slice(0, 45)}...](https://kalshi.com/markets/${m.ticker})` : title.slice(0, 45);
                res += `• ${url}: *${prob}%*\n`;
              });
            }
          }
        } catch (e) {
          logActivity(`⚠️ Kalshi Error: ${e.message}`);
          res += `_Kalshi Oracle is currently silent._\n`;
        }
      }

      await bot.sendMessage(chatId, res, { parse_mode: 'Markdown', disable_web_page_preview: true });
    } catch (e) { await send('❌ Oracle failure: ' + e.message); }
  };

  bot.registerCommand({
    command: 'odds',
    description: 'Check top prediction market odds (Global)',
    handler: (chatId, args, msg, send) => oddsHandler(chatId, args, msg, send)
  });

  bot.registerCommand({
    command: 'polymarket',
    description: 'Check Polymarket odds specifically',
    handler: (chatId, args, msg, send) => oddsHandler(chatId, args, msg, send, 'poly')
  });

  bot.registerCommand({
    command: 'kalshi',
    description: 'Check Kalshi odds specifically',
    handler: (chatId, args, msg, send) => oddsHandler(chatId, args, msg, send, 'kalshi')
  });

  // 🔮 /follow — Follow keyword
  bot.registerCommand({
    command: 'follow',
    description: 'Follow a prediction market keyword for Oracle Pulse alerts',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const keyword = args.join(' ').toLowerCase();
      if (!keyword) return await send('❌ Usage: /follow <keyword>');
      if (!config.predictionPulse.markets.includes(keyword)) {
        config.predictionPulse.markets.push(keyword);
        saveConfig(config); await send(`✅ Now following: *${keyword}* for Oracle alerts.`);
      } else { await send('⚠️ Already following this keyword.'); }
    }
  });

  // 🔮 /unfollow — Unfollow keyword
  bot.registerCommand({
    command: 'unfollow',
    description: 'Stop following a prediction market keyword',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const keyword = args.join(' ').toLowerCase();
      config.predictionPulse.markets = config.predictionPulse.markets.filter(m => m !== keyword);
      saveConfig(config); await send(`✅ Unfollowed: *${keyword}*`);
    }
  });

  // 🚚 /deliver — Simulate Delivery
  bot.registerCommand({
    command: 'deliver',
    description: 'Simulate a delivery arrival for visual alert testing',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      await send('🚚 *Simulating Delivery Arrival...*');
      await blinkLight(3, { r: 255, g: 165, b: 0 }); // Orange Pulse
    }
  });

  // 🏟️ /ipl — Quick Score Overview
  bot.registerCommand({
    command: 'ipl',
    description: 'Manual score check from Gravity Engine',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const CENTERS_PATH = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/src/data/scraped/match_centers.json";
      try {
        let feed: any = {};
        if (fs.existsSync(IPL_FEED)) {
           feed = JSON.parse(fs.readFileSync(IPL_FEED, 'utf-8'));
        }
        
        let res = `🏟️ *Gravity IPL Intel*\n━━━━━━━━━━━━━━\n`;
        if (feed.currentScore) {
           res += `🏏 *Score:* ${feed.currentScore}\n`;
           res += `🎾 Latest: *${feed.latestEvent?.run || 'N/A'}*\n`;
           res += `🎙️ _${feed.latestEvent?.commentary || 'Waiting for pulse...'}_ \n\n`;
        }

        // Try to get pairs from match_centers for the current match
        if (fs.existsSync(CENTERS_PATH)) {
           const centers = JSON.parse(fs.readFileSync(CENTERS_PATH, 'utf-8'));
           // Assuming matchNum 1 for now or find the latest 'ongoing' one
           const latest = centers[centers.length - 1];
           if (latest && latest.innings) {
             const batting = latest.innings.find((i: any) => i.type === 'batting');
             const bowling = latest.innings.find((i: any) => i.type === 'bowling');
             if (batting) {
               const pairs = batting.rows.filter((r: any) => r[1] === 'not out').map((r: any) => r[0]);
               if (pairs.length) res += `🏏 *Batting:* ${pairs.join(' & ')}\n`;
             }
             if (bowling) {
               const bowler = bowling.rows[bowling.rows.length - 1][0];
               res += `🎾 *Bowling:* ${bowler}\n`;
             }
           }
        }
        
        if (feed.winForecast) {
          res += `\n🔮 *Win Forecast:* ${feed.winForecast.team1}% vs ${feed.winForecast.team2}%\n`;
        }
        res += `━━━━━━━━━━━━━━\n_Data Source: Gravity Pulse Engine_`;
        await send(res);
      } catch (e) {
        await send('❌ Failed to fetch IPL feed.');
      }
    }
  });

  // 🏆 /results — Recent Match Results
  bot.registerCommand({
    command: 'results',
    description: 'Show recent IPL match results',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const RESULTS_PATH = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/src/data/scraped/parsed_matches.json";
      const CENTERS_PATH = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/src/data/scraped/match_centers.json";
      try {
        if (!fs.existsSync(RESULTS_PATH)) return await send('⚠️ *Gravity Archive:* No match history found.');
        const matches = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
        const centers = fs.existsSync(CENTERS_PATH) ? JSON.parse(fs.readFileSync(CENTERS_PATH, 'utf-8')) : [];
        
        const recent = matches.filter((m: any) => m.status === 'completed').slice(-3).reverse();
        
        let res = `🏆 *Recent IPL Results*\n━━━━━━━━━━━━━━\n`;
        recent.forEach((m: any) => {
          const center = centers.find((c: any) => c.matchNum === m.matchNum);
          res += `📍 *${m.name}*\n`;
          res += `⚔️ ${m.team1.toUpperCase()} ${m.score1} vs ${m.team2.toUpperCase()} ${m.score2}\n`;
          res += `✅ ${m.result}\n`;
          if (center && center.potmText) res += `🌟 _${center.potmText}_\n`;
          
          if (center && center.innings) {
             const batting = center.innings.find((i: any) => i.type === 'batting');
             if (batting) {
                const lastPair = batting.rows.filter((r: any) => r[1] === 'not out').map((r: any) => r[0]);
                if (lastPair.length) res += `🏏 *Last Stand:* ${lastPair.join(' & ')}\n`;
             }
          }
          res += `\n`;
        });
        res += `━━━━━━━━━━━━━━\n_Sync complete with Engine Archive._`;
        await send(res);
      } catch (e) {
        await send('❌ Failed to read match history.');
      }
    }
  });

  // 📅 /upcoming — Future Matches
  bot.registerCommand({
    command: 'upcoming',
    description: 'Show scheduled IPL matches',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const PATH = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/src/data/scraped/parsed_matches.json";
      try {
        if (!fs.existsSync(PATH)) return await send('⚠️ No schedule found.');
        const matches = JSON.parse(fs.readFileSync(PATH, 'utf-8'));
        const upcoming = matches.filter((m: any) => m.status === 'scheduled').slice(0, 5);
        
        let res = `📅 *Upcoming IPL Fixtures*\n━━━━━━━━━━━━━━\n`;
        upcoming.forEach((m: any) => {
          res += `🔹 *Match ${m.matchNum}:* ${m.name}\n`;
          res += `📍 ${m.city} | ⏰ ${m.time}\n\n`;
        });
        res += `━━━━━━━━━━━━━━\n_Use /match <number> for details._`;
        await send(res);
      } catch (e) { await send('❌ Error fetching schedule.'); }
    }
  });

  // ⚔️ /match — Specific Match Details
  bot.registerCommand({
    command: 'match',
    description: 'Get details for a specific match number',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const num = parseInt(args[0]);
      if (isNaN(num)) return await send('❌ Usage: `/match <number>`');
      
      const PATH = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/src/data/scraped/parsed_matches.json";
      const CENTERS_PATH = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/src/data/scraped/match_centers.json";
      try {
        const matches = JSON.parse(fs.readFileSync(PATH, 'utf-8'));
        const m = matches.find((x: any) => x.matchNum === num);
        if (!m) return await send('❌ Match not found.');
        
        let res = `🏏 *Match ${m.matchNum} Intelligence*\n━━━━━━━━━━━━━━\n`;
        res += `⚔️ *${m.name}*\n`;
        res += `📍 ${m.city} | ${m.time}\n`;
        res += `📊 Status: *${m.status.toUpperCase()}*\n`;
        
        if (m.status === 'completed') {
           res += `🔢 Score: ${m.score1} vs ${m.score2}\n`;
           res += `✅ Result: ${m.result}\n`;
        }
        
        const centers = fs.existsSync(CENTERS_PATH) ? JSON.parse(fs.readFileSync(CENTERS_PATH, 'utf-8')) : [];
        const center = centers.find((c: any) => c.matchNum === num);
        if (center && center.url) res += `\n🔗 [Full Scorecard](${center.url})\n`;
        
        res += `━━━━━━━━━━━━━━`;
        await send(res);
      } catch (e) { await send('❌ Error.'); }
    }
  });

  // 🛡️ /team — Team Pulse
  bot.registerCommand({
    command: 'team',
    description: 'Show upcoming/recent matches for a team',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const team = args.join(' ').toLowerCase();
      if (!team) return await send('❌ Usage: `/team <name>` (e.g. RCB)');
      
      const PATH = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/src/data/scraped/parsed_matches.json";
      try {
        const matches = JSON.parse(fs.readFileSync(PATH, 'utf-8'));
        const filter = matches.filter((m: any) => m.name.toLowerCase().includes(team));
        if (!filter.length) return await send('❌ No matches found for this team.');
        
        const recent = filter.filter((m: any) => m.status === 'completed').slice(-2).reverse();
        const next = filter.filter((m: any) => m.status === 'scheduled').slice(0, 2);
        
        let res = `🛡️ *${team.toUpperCase()} Pulse*\n━━━━━━━━━━━━━━\n`;
        if (recent.length) {
          res += `⏪ *Recent:*\n`;
          recent.forEach((m: any) => res += `• vs ${m.name.replace(new RegExp(team, 'gi'), '').replace('vs', '').trim()}: ${m.result}\n`);
        }
        if (next.length) {
          res += `\n⏩ *Next:*\n`;
          next.forEach((m: any) => res += `• ${m.time} | vs ${m.name.replace(new RegExp(team, 'gi'), '').replace('vs', '').trim()}\n`);
        }
        res += `━━━━━━━━━━━━━━`;
        await send(res);
      } catch (e) { await send('❌ Error.'); }
    }
  });

  // ✏️ /jot — Quick Hoard
  bot.registerCommand({
    command: 'jot',
    description: 'Quickly save a thought to Gravity Archive',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const text = args.join(' ');
      if (!text) return await send('✏️ Usage: `/jot My thought here`');
      
      try {
        await fetch('http://localhost:3031/archive/hoard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, meta: { type: 'jot' }, source: 'Telegram' })
        });
        await send('✅ *Jot Stored.* Sent to Sovereign Vault.');
      } catch (e) {
        await send('❌ Archive engine is offline.');
      }
    }
  });

  // 🕰️ /schedule — Management
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

  // 🎨 /aura — Media Sync
  bot.registerCommand({
    command: 'aura',
    description: 'Toggle Media Aura sync',
    handler: async (chatId, args, msg, send) => {
       if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
       config.mediaAura = !config.mediaAura;
       saveConfig(config);
       await send(`🎨 *Media Aura*: **${config.mediaAura ? 'ENABLED' : 'DISABLED'}**`);
    }
  });

  // ❄️ /temp — AC Status
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

  // 📈 /history — Usage History
  bot.registerCommand({
    command: 'history',
    description: 'Show multi-day energy totals',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const log = config.stats.dailyLog || [];
      const todayAC = (config.stats.acMinutes / 60);
      const todayLight = (config.stats.lightMinutes / 60);
      
      let totalAC = todayAC;
      let totalLight = todayLight;
      log.forEach((entry: any) => {
        totalAC += parseFloat(entry.ac || 0);
        totalLight += parseFloat(entry.light || 0);
      });

      let table = '📊 *Gravity Multi-Day Totals*\n\n';
      table += `✨ *TODAY (Live)*\n❄️ AC: \`${todayAC.toFixed(1)}h\` | 💡 Light: \`${todayLight.toFixed(1)}h\`\n\n`;
      table += `🏆 *ULTIMATE TOTALS*\n_(Processed from ${log.length + 1} days of data)_\n\n`;
      table += `❄️ Total AC: *${totalAC.toFixed(1)} hrs*\n💡 Total Light: *${totalLight.toFixed(1)} hrs*`;
      await send(table);
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

  // 🪐 God Commands v4.9.2
  bot.registerCommand({
    command: 'aura',
    description: 'Toggle Media Aura sync',
    handler: async (chatId, args, msg, send) => {
       if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
       config.mediaAura = !config.mediaAura;
       saveConfig(config);
       await send(`🎨 *Media Aura*: **${config.mediaAura ? 'ENABLED' : 'DISABLED'}**`);
    }
  });

  bot.registerCommand({
    command: 'schedule_add',
       // ... existing command registrations
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
        if (url.pathname.startsWith('/media_aura/')) {
          const state = url.pathname.split('/').pop()?.toLowerCase();
          config.mediaAura = (state === 'on');
          saveConfig(config);
          logActivity(`🎵 Media Aura: Remote toggle -> ${state.toUpperCase()}`);
          return new Response(`Media Aura: ${state}`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.includes('/status')) {
          const w = config.weatherSync !== false ? await new WeatherEngine().getWeather() : null;
          const spotify = await getSpotifyStatus();
          const jitter = await getNetworkJitter();
          const batt = await getBatteryStatus();
          
          // Calculate current live units and durations
          const liveUnits = (config.stats.acMinutes / 60 * 1.65) + (config.stats.lightMinutes / 60 * 0.012);
          const acDur = getDurationString(config.stats.ac?.lastChanged);
          const lightDur = getDurationString(config.stats.light?.lastChanged);
          
          const body = JSON.stringify({
            online: isPhoneOnline,
            stats: config.stats,
            units: liveUnits.toFixed(1),
            estimatedPgBill: Math.round(Number(calculatePgvclBill(liveUnits))),
            ac_duration: acDur,
            light_duration: lightDur,
            uptime: process.uptime(),
            pgvcl: config.stats.pgvcl,
            weather: w,
            solis: { today: "18.7", current: "0.0", battery: "100%", status: "SLEEPING (NIGHT)" },
            spotify,
            jitter,
            battery: batt,
            autoAc: config.autoAc,
            autoLight: config.autoLight,
            mediaAura: config.mediaAura !== false,
            platform: 'Local Mac',
            archive: { status: 'ONLINE', pulse: '5s' }
          }, null, 2);
          return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        // ⚡ ZAPIT AUTOMATION GATEWAY (Dynamic Flows v2.0)
        if (url.pathname.startsWith('/zapit/')) {
           const triggerKey = url.pathname.split('/').pop()?.toLowerCase();
           console.log(`⚡ ZAPIT: Incoming trigger [${triggerKey}]`);
           
           // 1. Search for custom flows in config
           const flows = config.zapit_flows || [];
           const matchedFlow = flows.find((f: any) => f.trigger.toLowerCase() === triggerKey);
           
           if (matchedFlow) {
              logActivity(`⚡ ZAPIT: Executing Flow [${matchedFlow.id}] triggered by [${triggerKey}]`);
              if (matchedFlow.action === 'scene') await triggerScene(matchedFlow.params?.scene);
              if (matchedFlow.action === 'speak') speak(matchedFlow.params?.text);
              if (matchedFlow.action === 'ac_off') {
                const d = miraie?.devices[0]?.deviceId;
                if (d) await miraie?.controlDevice(d, { ps: 'off' });
              }
              
              return new Response(JSON.stringify({ status: 'executed', flow: matchedFlow.id }), { 
                 headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
              });
           }

           // 2. Fallback to hardcoded legacy triggers
           if (triggerKey === 'aura') {
             await triggerScene('chill');
             return new Response(JSON.stringify({ status: 'triggered', event: 'aura' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
           }

           return new Response(JSON.stringify({ status: 'error', message: 'No matching flow or legacy trigger found' }), { 
              status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
           });
        }
        if (url.pathname === '/control/aura/toggle') {
           config.mediaAura = config.mediaAura === false ? true : false;
           saveConfig(config);
           return new Response(JSON.stringify({ status: 'toggled', mediaAura: config.mediaAura }), { 
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
           });
        }
        if (url.pathname === '/control/auto/ac') {
           config.autoAc = !config.autoAc;
           saveConfig(config);
           return new Response(JSON.stringify({ status: 'toggled', autoAc: config.autoAc }), { 
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
           });
        }
        if (url.pathname === '/control/auto/light') {
           config.autoLight = !config.autoLight;
           saveConfig(config);
           return new Response(JSON.stringify({ status: 'toggled', autoLight: config.autoLight }), { 
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
           });
        }

        // 🪐 GRAVITY ARCHIVE API
        if (url.pathname === '/archive/add') {
          const body: any = await req.json();
          if (body.text) {
             archiveClipboard(body.text);
             return new Response('Added', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
          }
          return new Response('Empty', { status: 400 });
        }
        if (url.pathname === '/archive/search' || url.pathname === '/archive/list') {
          const clipsPath = path.join(process.cwd(), 'gravity-archive', 'clips.json');
          let clips = [];
          try {
            const data = fs.readFileSync(clipsPath, 'utf-8');
            clips = JSON.parse(data);
          } catch (e) { clips = []; }
          
          const q = url.searchParams.get('q')?.toLowerCase();
          const filter = url.searchParams.get('filter') || 'recent';
          
          let results = q ? clips.filter((c: any) => String(c.text).toLowerCase().includes(q)) : clips;

          // 🕰️ Apply Time & Bookmark Filters
          const now = new Date();
          if (filter === 'today') {
            const todayStr = now.toLocaleDateString();
            results = results.filter((c: any) => new Date(c.timestamp).toLocaleDateString() === todayStr);
          } else if (filter === 'bookmarks') {
             results = results.filter((c: any) => c.isBookmarked);
          } else if (filter === 'recent') {
             results = results.slice(-100);
          }
          
          return new Response(JSON.stringify(results.reverse()), { 
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
          });
        }

        if (url.pathname.startsWith('/archive/bookmark/')) {
          const clipsPath = path.join(process.cwd(), 'gravity-archive', 'clips.json');
          const id = url.pathname.split('/').pop();
          if (!fs.existsSync(clipsPath)) return new Response('Not Found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
          
          const clips = JSON.parse(fs.readFileSync(clipsPath, 'utf-8'));
          const idx = clips.findIndex((c: any) => String(c.id) === id);
          if (idx !== -1) {
            clips[idx].isBookmarked = !clips[idx].isBookmarked;
            fs.writeFileSync(clipsPath, JSON.stringify(clips, null, 2));
          }
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/delete/')) {
          const clipsPath = path.join(process.cwd(), 'gravity-archive', 'clips.json');
          const id = url.pathname.split('/').pop();
          if (!fs.existsSync(clipsPath)) return new Response('Not Found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
          
          let clips = JSON.parse(fs.readFileSync(clipsPath, 'utf-8'));
          clips = clips.filter((c: any) => String(c.id) !== id);
          fs.writeFileSync(clipsPath, JSON.stringify(clips, null, 2));
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname.startsWith('/archive/label/')) {
          const clipsPath = path.join(process.cwd(), 'gravity-archive', 'clips.json');
          const id = url.pathname.split('/').pop();
          const label = url.searchParams.get('label') || '';
          if (!fs.existsSync(clipsPath)) return new Response('Not Found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
          
          const clips = JSON.parse(fs.readFileSync(clipsPath, 'utf-8'));
          const idx = clips.findIndex((c: any) => String(c.id) === id);
          if (idx !== -1) {
            clips[idx].label = label;
            fs.writeFileSync(clipsPath, JSON.stringify(clips, null, 2));
          }
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/promote/')) {
          const clipsPath = path.join(process.cwd(), 'gravity-archive', 'clips.json');
          const id = url.pathname.split('/').pop();
          if (!fs.existsSync(clipsPath)) return new Response('Not Found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
          
          const clips = JSON.parse(fs.readFileSync(clipsPath, 'utf-8'));
          const item = clips.find((c: any) => String(c.id) === id);
          if (item) {
            const entry = `\n### 🪐 Promoted [${new Date().toLocaleDateString()}]\nLabel: \`${item.label || 'None'}\`\n\n${item.text}\n\n---\n`;
            fs.appendFileSync(path.join(process.cwd(), 'GRAVITY_MANIFEST.md'), entry);
            return new Response('Promoted', { headers: { 'Access-Control-Allow-Origin': '*' } });
          }
          return new Response('Not Found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
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
        if (url.pathname === '/control/bulb/on' || url.pathname === '/control/bulb_on') {
          await wiz?.executeAction({ type: 'control', payload: { state: true } });
          updateDeviceState('light', 'on', true);
          return new Response('Bulb On', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/bulb/off' || url.pathname === '/control/bulb_off') {
          if (wiz) await (wiz as any).executeAction({ type: 'control', payload: { state: false } });
          updateDeviceState('light', 'off', true);
          return new Response('Bulb Off', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/bulb_tv') {
          if (wiz) await wiz.executeAction({ type: 'control', payload: { state: true, scene: 'TV time', dimming: 10 } });
          return new Response('Bulb TV Mode Set', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/ac_tv' || url.pathname === '/scene/tv' || url.pathname === '/scene/TV') {
          await triggerScene('TV');
          return new Response('Global TV Mode Set', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
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
        if (url.pathname === '/control/ac/on' || url.pathname === '/control/ac_on') {
          const deviceId = miraie?.devices[0]?.deviceId;
          if (deviceId) await miraie?.controlDevice(deviceId as string, { ps: 'on' });
          updateDeviceState('ac', 'on', true);
          return new Response('AC On', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/ac/off' || url.pathname === '/control/ac_off') {
          const deviceId = miraie?.devices[0]?.deviceId;
          if (deviceId) await miraie?.controlDevice(deviceId as string, { ps: 'off' });
          updateDeviceState('ac', 'off', true);
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
          const r = parseInt(url.searchParams.get('r') || '0');
          const g = parseInt(url.searchParams.get('g') || '0');
          const b = parseInt(url.searchParams.get('b') || '0');
          if (wiz) {
            if (url.searchParams.has('r')) {
              await (wiz as any).executeAction({ type: 'control', payload: { state: true, r, g, b } });
            } else {
              await (wiz as any).executeAction({ type: 'control', payload: { state: true, temp } });
            }
          }
          return new Response('Bulb Color Set', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/ac/powerful') {
          const ps = url.searchParams.get('ps') === 'on' ? 'powerful' : 'cool';
          if (miraie && (miraie as any).devices.length > 0) {
            for (const device of (miraie as any).devices) {
              await (miraie as any).controlDevice(device.deviceId, { ps: 'on', acmd: ps });
            }
          }
          return new Response(`Powerful Set: ${ps}`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/ac/timer') {
          const mins = parseInt(url.searchParams.get('mins') || '0');
          if (miraie && (miraie as any).devices.length > 0) {
            for (const device of (miraie as any).devices) {
              await (miraie as any).controlDevice(device.deviceId, { actmr: mins > 0 ? String(mins) : '0' });
            }
          }
          return new Response(`Timer Set: ${mins}m`, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
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
        if (url.pathname === '/control/ac/swing') {
          const deviceId = miraie?.devices[0]?.deviceId;
          if (deviceId) {
            const s = await miraie?.getDeviceStatus(deviceId);
            const newSwing = s?.acvs === 'on' ? 'off' : 'on';
            await miraie?.controlDevice(deviceId, { acvs: newSwing });
          }
          return new Response('AC Swing Toggled', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/control/restart') {
          exec(`scripts/iftt-clone.sh`);
          return new Response('Restarting Hub...', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/archive/sync') {
          // This usually triggers a crawl/sync
          exec(`scripts/archive-start.sh`);
          return new Response('Vault Sync Started', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/cricket/trigger') {
           // Force re-run internal logic
           lastIplEventTs = 0;
           return new Response('Cricket Trigger Force Run', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
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

  // 📋 Hyper-Fast Clipboard Sentry (Instant Recall)
  setInterval(async () => {
    try {
      const { stdout } = await execAsync('pbpaste');
      const currentClip = stdout.trim();
      
      // 🛡️ ASCII Shield: Ignore terminal logos and high-symbol noise
      const isNoise = (text: string) => {
        const lines = text.split('\n');
        if (lines.length > 4) {
          const symbols = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
          const ratio = symbols / text.length;
          if (ratio > 0.25) return true; // Likely ASCII Art/Logo
        }
        return false;
      };

      if (currentClip && currentClip !== config.lastClip && currentClip.length > 3 && !isNoise(currentClip)) {
        config.lastClip = currentClip;
        archiveClipboard(currentClip);
        // Only log if it's the full hub, to keep CLIPBOARD_ONLY silent
        if (!CLIPBOARD_ONLY) {
          logActivity(`📋 Memory Archive: New clip captured (${currentClip.substring(0, 20)}...)`);
        }
      }
    } catch (e) { /* Sentry silent */ }
  }, 1000);

  setInterval(async () => {
    try {
      // 1. Battery Guardian (Blink Red if < 15% & unplugged)
      const batt = await getBatteryStatus();
      if (batt && batt.level < 15 && !batt.isPlugged) {
         if (!config.stats.lowBattAlerted) {
            config.stats.lowBattAlerted = true;
            speak("Hub battery is critical. Please plug in.");
            blinkLight(3, { r: 255, g: 0, b: 0 }); // Periodic Red Alert
         }
      } else if (batt && (batt.level > 20 || batt.isPlugged)) {
         config.stats.lowBattAlerted = false;
      }

       // 1.5 IPL Live Pulse (Legacy File-based) - Removed in favor of high-frequency loop

      // 2. Media Aura Sync (Liquid Aura 2.0 - Dynamic Cycling)
      const currentSpotify = await getSpotifyStatus();
      if (config.mediaAura !== false) {
        const isAd = currentSpotify?.toLowerCase().includes('advertisement') || currentSpotify?.toLowerCase().includes('spotify');
        
        if (currentSpotify && currentSpotify !== lastSpotifyTrack && !isAd) {
          if (!lastSpotifyTrack) {
            preMusicLightState = JSON.parse(JSON.stringify(config.stats.light || {}));
          }
          
          // Liquid Aura: Massive Prism Palette (10+ Colors)
          const palette = [
            { r: 255, g: 0, b: 127 },  // Neon Pink
            { r: 155, g: 48, b: 255 },  // Deep Purple
            { r: 0, g: 191, b: 255 },   // Cyber Blue
            { r: 255, g: 105, b: 180 }, // Hot Pink
            { r: 0, g: 255, b: 127 },   // Spring Green
            { r: 255, g: 69, b: 0 },    // Orange Red
            { r: 138, g: 43, b: 226 },  // Blue Violet
            { r: 0, g: 255, b: 255 },   // Aqua
            { r: 255, g: 20, b: 147 },  // Deep Pink
            { r: 75, g: 0, b: 130 },    // Indigo
            { r: 255, g: 215, b: 0 },   // gold
            { r: 50, g: 205, b: 50 }    // Lime Green
          ];
          const color = palette[Math.floor(Math.random() * palette.length)];
          
          await wiz?.executeAction({ type: 'control', payload: { 
            state: true, r: color.r, g: color.g, b: color.b, dimming: 40 
          }});
          
          logActivity(`🎵 Liquid Aura: ${currentSpotify} -> Prism Pulse. 🌈`);
        } else if ((!currentSpotify || isAd) && lastSpotifyTrack) {
          // Restore original state
          if (preMusicLightState && preMusicLightState.status === 'on') {
             await wiz?.executeAction({ type: 'control', payload: { 
               state: true, 
               dimming: preMusicLightState.brightness || 100,
               r: preMusicLightState.r, g: preMusicLightState.g, b: preMusicLightState.b 
             }});
          } else {
             await wiz?.executeAction({ type: 'control', payload: { state: false } });
          }
          logActivity(`🎵 Liquid Aura: Restored original atmosphere.`);
          preMusicLightState = null;
        }
      }
      lastSpotifyTrack = currentSpotify || "";
    } catch (e) { 
      /* Aura silent */ 
    }

    // 3. Auto-Saver Protection (2.5h / 150m limit)
    try {
      if (!CLIPBOARD_ONLY) {
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
      }

      // 4. Deep Device Sync (Pulse Check)
      if (miraie && miraie.devices.length > 0) {
        const s = await miraie.getDeviceStatus(miraie.devices[0].deviceId);
        const actualAcStatus = (s?.ps === 'on' || s?.ps === '1') ? 'on' : 'off';
        updateDeviceState('ac', actualAcStatus);
      }
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
        const dailyUnits = (stats.acMinutes / 60 * 1.65) + (stats.lightMinutes / 60 * 0.012);
        const dailyCost = calculatePgvclBill(dailyUnits);
        
        const msg = `🌙 *Gravity Daily Review*\n\n❄️ AC: *${(stats.acMinutes/60).toFixed(1)} hrs*\n💡 Light: *${(stats.lightMinutes/60).toFixed(1)} hrs*\n🔌 Energy: *${dailyUnits.toFixed(1)} units*\n💰 Est. Cost: *₹${dailyCost}*`;
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
        if (config.rejectedHabits?.includes(key)) continue;
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
                   inline_keyboard: [[{ text: '✅ Schedule It', callback_data: `schedule_add ${timeStr} ${command}` }, { text: '🚫 No', callback_data: `ignore:${key}` }]]
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

  // ── 📡 Signal Intelligence Hub (Vibe Engine v4.6.2) ──
  setInterval(async () => {
    try {
        // 1. ISS Pulse
        if (config.issPulse?.enabled && (Date.now() - ((global as any).lastIssCheck || 0) > 300000)) {
           (global as any).lastIssCheck = Date.now();
           const res = await fetch('http://api.open-notify.org/iss-now.json');
           const data = await res.json();
           const { latitude, longitude } = (data as any).iss_position;
           const dist = Math.sqrt(Math.pow(latitude - 21.5, 2) + Math.pow(longitude - 70.4, 2));
           if (dist < 5) {
             logActivity("🛰️ ISS overhead detected!");
             lastGlobalSignal = { text: "🛰️ ISS Overhead", time: Date.now() };
             await blinkLight(2, { r: 255, g: 255, b: 255 }); // White Flash
             await (bot as any).sendMessage(config.telegram.chatId, "🛰️ *Sovereignty:* The International Space Station is currently over your Hub.");
           }
        }

        // 2. Prediction Oracle Pulse
        if (config.predictionPulse?.enabled && (Date.now() - ((global as any).lastPredictionCheck || 0) > 600000)) {
           (global as any).lastPredictionCheck = Date.now();
           const res = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20');
           const markets = await res.json();
           for (const m of (markets as any)) {
             const isFollowed = config.predictionPulse.markets.some((k: string) => m.question.toLowerCase().includes(k.toLowerCase()));
             if (isFollowed) {
               const price = m.outcomePrices ? JSON.parse(m.outcomePrices)[0] : 0.5;
               const prob = parseFloat(price);
               const lastProb = config.predictionPulse.lastOdds[m.id] || prob;
               if (Math.abs(prob - lastProb) > 0.15) {
                 logActivity(`🔮 Oracle Pulse: Sentiment Shift on ${m.question}`);
                 lastGlobalSignal = { text: `🔮 Oracle: ${m.question.slice(0, 20)}...`, time: Date.now() };
                 await blinkLight(2, { r: 255, g: 0, b: 255 }); // Magenta Pulse
                 await (bot as any).sendMessage(config.telegram.chatId, `🔮 *ORACLE ALERT:* Sentiment shift detected on "${m.question}"\nProb: *${(prob*100).toFixed(0)}%* (was ${(lastProb*100).toFixed(0)}%)`);
               }
               config.predictionPulse.lastOdds[m.id] = prob; saveConfig(config);
             }
           }
        }

        // 3. Market Pulse (Moon Alert)
        if (config.marketPulse?.enabled && (Date.now() - ((global as any).lastMarketCheck || 0) > 900000)) {
           (global as any).lastMarketCheck = Date.now();
           for (const symbol of config.marketPulse.crypto) {
             const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&include_24hr_change=true`);
             const data = await res.json();
             const change = data[symbol]?.usd_24h_change || 0;
             if (change > 10) {
               logActivity(`🚀 MOON ALERT: ${symbol.toUpperCase()} is pumping!`);
               lastGlobalSignal = { text: `🚀 Moon: ${symbol.toUpperCase()}`, time: Date.now() };
               await blinkLight(5, { r: 255, g: 215, b: 0 }); // Gold Pulse
               await (bot as any).sendMessage(config.telegram.chatId, `🚀 *MOON ALERT:* ${symbol.toUpperCase()} is up *${change.toFixed(1)}%*! 🌕`);
             }
           }
        }

        // 4. GitHub Pulse (Sovereign Watcher)
        if (config.githubPulse?.enabled && (Date.now() - ((global as any).lastGitCheck || 0) > 300000)) {
           (global as any).lastGitCheck = Date.now();
           const username = 'paranjayy';
           try {
             const res = await fetch(`https://api.github.com/users/${username}/events/public`);
             const events: any = await res.json();
             if (Array.isArray(events) && events.length > 0) {
               const lastId = config.githubPulse.lastEventId;
               const currentEvent = events[0];
               if (currentEvent.id !== lastId) {
                 if (currentEvent.type === 'PushEvent' || currentEvent.type === 'CreateEvent') {
                   logActivity(`🐙 GitHub Pulse: Activity detected for ${username}`);
                   await blinkLight(3, { r: 120, g: 0, b: 255 }); // Purple Blink
                   const repoName = currentEvent.repo.name.split('/').pop();
                   await (bot as any).sendMessage(config.telegram.chatId, `🐙 *GITHUB PULSE:* New code pushed to \`${repoName}\`!\n_Sensory sync engaged._`);
                 }
                 config.githubPulse.lastEventId = currentEvent.id;
                 saveConfig(config);
               }
             }
           } catch (e) { console.error("Git Pulse Error:", e); }
        }

        // 5. Wikipedia Rabbit Hole
        const h = new Date().getHours();
        if (h === 22 && !(global as any).wikiToday) {
          (global as any).wikiToday = true;
          const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary');
          const page = await res.json();
          await breatheLight({ r: 0, g: 255, b: 255 }, 2); // Cyan Breathe
          await (bot as any).sendMessage(config.telegram.chatId, `🧠 *Nightly Rabbit Hole*\n\n*${(page as any).title}*\n${(page as any).extract}\n\n🔗 [Read More](${(page as any).content_urls.desktop.page})`, { parse_mode: 'Markdown' });
        }
        if (h !== 22) (global as any).wikiToday = false;
        
        // 6. Moon Phase Mood (Circadian Night)
        if (config.moonPhaseMood?.enabled && h >= 0 && h < 4) {
           const lp = 2551442.8; 
           const now = new Date();
           const new_moon = new Date(2000, 0, 6, 18, 14, 0);
           const phase = ((now.getTime() - new_moon.getTime()) / 1000) % lp / lp;
           const dimming = Math.round(5 + (35 * (1 - Math.abs(2 * phase - 1))));
           if (config.stats.light?.status === 'on' && (global as any).lastMoonDim !== dimming) {
              (global as any).lastMoonDim = dimming;
              await wiz.setDimming(dimming);
              logActivity(`🌑 Moon Mood: Phase ${phase.toFixed(2)}, Dimming to ${dimming}%`);
           }
        }

        // 7. Focus Shield (Mac Process Monitor)
        if (config.focusShield?.enabled && (Date.now() - ((global as any).lastShieldCheck || 0) > 15000)) {
           (global as any).lastShieldCheck = Date.now();
           try {
             const { stdout: psOut } = await execAsync('ps -axco command');
             const detected = config.focusShield.apps.filter(app => psOut.toLowerCase().includes(app.toLowerCase()));
             if (detected.length > 0) {
                logActivity(`🛡️ Focus Shield: Procrastination detected (${detected.join(', ')})`);
                await blinkLight(2, { r: 255, g: 0, b: 0 }); // Red Alert
                await notifier.notify(`🛡️ *FOCUS SHIELD:* Master, I detect \`${detected.join(', ')}\` is active. Get back to work!`, 'high');
             }
           } catch {}
        }

        // 8. Solar Rhythms (Wake/Sleep)
        const nowTime = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
        if (config.solarRhythm?.enabled) {
           if (nowTime === config.solarRhythm.sleepTime && !(global as any).sleepTriggered) {
              (global as any).sleepTriggered = true;
              logActivity("🌅 Solar Rhythm: Commencing sleep transition...");
              await wiz.setDimming(5); 
           }
           if (nowTime === config.solarRhythm.wakeTime && !(global as any).wakeTriggered) {
              (global as any).wakeTriggered = true;
              logActivity("🌅 Solar Rhythm: Commencing sunrise simulation...");
              await wiz.turnOn();
              await wiz.setDimming(10);
              setTimeout(() => wiz.setDimming(50), 300000); 
           }
           if (nowTime !== config.solarRhythm.sleepTime) (global as any).sleepTriggered = false;
           if (nowTime !== config.solarRhythm.wakeTime) (global as any).wakeTriggered = false;
        }

        // 9. Weather Pulse (Aura Sync)
        if (config.weatherAura?.enabled && (Date.now() - ((global as any).lastWeatherCheck || 0) > 1800000)) {
           (global as any).lastWeatherCheck = Date.now();
           try {
             const res = await fetch('https://wttr.in/Mumbai?format=j1');
             const weather = await res.json();
             const desc = (weather as any).current_condition[0].weatherDesc[0].value.toLowerCase();
             logActivity(`🌦️ Weather Aura: ${desc}`);
             if (desc.includes('rain') || desc.includes('drizzle')) {
                await wiz.setPilot(config.wiz.ip, { r: 0, g: 100, b: 255 }); 
             } else if (desc.includes('clear') || desc.includes('sunny')) {
                await wiz.setPilot(config.wiz.ip, { temp: 3000 }); 
             } else if (desc.includes('cloud') || desc.includes('overcast')) {
                await wiz.setPilot(config.wiz.ip, { temp: 5000 }); 
             }
           } catch {}
        }

    } catch (e) {}
  }, 60000);


  // 🏥 Health Pulse & Maintenance
  if (!CLIPBOARD_ONLY) {
    setInterval(() => {
      updateBotPulse(config);
      const now = new Date();
      if (now.getHours() === 1 && now.getMinutes() === 0) analyzeHabits();
    }, 60000);

    // Polls
    bot.startPolling();
    
    const PLATFORM = process.env.GITHUB_ACTIONS ? 'GitHub' : (require('os').platform() === 'darwin' ? 'Local Mac' : 'Remote Hub');
    const startTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    
    // Calculate Off-time since last pulse
    let offTimeStr = "";
    try {
      const lastPulse = config.bot?.lastPulse;
      if (lastPulse) {
        const last = new Date(lastPulse).getTime();
        const diffMs = Date.now() - last;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) offTimeStr = "<1m";
        else offTimeStr = diffMins > 1440 ? `${Math.floor(diffMins/1440)}d ${Math.floor((diffMins%1440)/60)}h` : (diffMins > 60 ? `${Math.floor(diffMins/60)}h ${diffMins%60}m` : `${diffMins}m`);
      } else {
        offTimeStr = "first boot";
      }
    } catch(e) { offTimeStr = "??"; }

    // COMMIT PULSE IMMEDIATELY ON WAKEUP
    config.bot = { ...config.bot, lastPulse: new Date().toISOString() };
    saveConfig(config);

    
    const acStatusEmoji = (config.stats.ac?.status === 'on') ? '✅' : '❌';
    const ltStatusEmoji = (config.stats.light?.status === 'on') ? '✅' : '❌';
    const acDur = getDurationString(config.stats.ac?.lastChanged);
    const ltDur = getDurationString(config.stats.light?.lastChanged);
    const startMsg = `🟢 *Gravity Hub: ONLINE* — _Off for ${offTimeStr || '??' }_\n━━━━━━━━━━━━━━\n🏗 Platform: *${PLATFORM}*\nStarted: *${startTime} IST*\n❄️ AC: ${acStatusEmoji} (${acDur}) | 💡 Light: ${ltStatusEmoji} (${ltDur})\n━━━━━━━━━━━━━━\nType /help for God Mode v4.6`;
    
    if (config.bootGreet !== false) {
      for (const userId of (config.authorizedUsers || [])) {
        try { bot.sendMessage(userId, startMsg, { parse_mode: 'Markdown' }); } catch {}
      }
    }
    console.log(`🚀 Gravity Hub ONLINE [${PLATFORM}]. Polling started.`);

    // 💓 Sovereign Heartbeat & Persistence
    setInterval(() => {
      config.bot = { ...config.bot, lastPulse: new Date().toISOString() };
      saveConfig(config);
    }, 30000); // 30s Beat

    // ──────────────────────────────────────────────────────
    // Hyper-Live Cricket Engine (5s Frequency)
    // ──────────────────────────────────────────────────────
    const runIplPulse = async () => {
      if (!config.cricketMode && !config.automaticScoreUpdates) return;
      try {
        const config = loadConfig();
        if (config.authorizedUsers?.[0]) {
          await bot.sendChatAction(config.authorizedUsers[0], 'typing').catch(() => {});
        }
        const ipl = await getLatestIplData();
        if (ipl && ipl.latestBall) {
          const ball = ipl.latestBall;

          // Match change → reset commentary thread so new match gets a fresh msg
          if (ipl.matchId && ipl.matchId !== lastIplMatchId) {
            lastIplMatchId = ipl.matchId;
            lastIplBallId = "";
            lastIplOver = "";
            lastCommentaryMsgId = null;
            lastIplWicketBall = false;
            lastIplProjected = 0;
            lastIplScore = "";
            lastIplMilestones.clear();
          }

          // First boot seed — don't fire stale events
          if (lastIplBallId === "") {
            lastIplBallId = ball.ballId;
            const derivedScore = ball.totalRuns !== undefined ? `${ball.totalRuns}/${ball.totalWickets} (${ball.over} ov)` : (ipl.score || "");
            lastIplScore = derivedScore;
            lastIplOver = ball.over.split('.')[0];
            return;
          }

          if (ball.ballId !== lastIplBallId) {
            const prevWasWicket = lastIplWicketBall;
            lastIplBallId = ball.ballId;
            const liveHeaderScore = ball.totalRuns !== undefined ? `${ball.totalRuns}/${ball.totalWickets}` : ipl.score;
            lastIplScore = liveHeaderScore;
            const run = String(ball.run).toUpperCase();
            lastIplWicketBall = ball.isWicket;

            // Trend and Projection
            let trend = "";
            const currentProj = parseInt(ipl.projected || "0");
            if (currentProj > 0 && lastIplProjected > 0) {
              if (currentProj > lastIplProjected) trend = " 📈";
              else if (currentProj < lastIplProjected) trend = " 📉";
            }
            if (currentProj > 0) lastIplProjected = currentProj;

            // Build rich over-ball breakdown
            const overBallsStr = (ipl.currentOverBalls || []).map((b: any) => {
              const r = String(b.run).toUpperCase();
              if (b.isWicket) return 'W';
              if (r === '6') return '6';
              if (r === '4') return '4';
              if (r === '0') return '·';
              if (r.includes('WD')) return 'Wd';
              if (r.includes('NB')) return 'Nb';
              if (r.includes('LB')) return 'Lb';
              return r;
            }).join(' | ');
            const overDisplay = overBallsStr ? `\n🎯 *Over ${ball.over.split('.')[0]}:* ${overBallsStr}` : '';

            // Rich summary block
            const probBlock = ipl.winProb ? `\n📊 *Win Prob:* ${ipl.winProb}` : '';
            const partnerBlock = ipl.partnership ? `\n🤝 *Partner:* ${ipl.partnership}` : '';
            const rateBlock = ipl.target
              ? `*Target:* ${ipl.target} | *Need:* ${parseInt(ipl.target) - (parseInt(ipl.latestBall?.totalRuns || '0'))} off ${Math.max(0, 120 - Math.round(parseFloat(ball.over) * 6))} balls\n*CRR:* ${ipl.crr} | *RRR:* ${ipl.rrr}${ipl.projected ? ` | *Proj:* ~${ipl.projected}${trend}` : ''}`
              : `*CRR:* ${ipl.crr}${ipl.projected ? ` | *Proj:* ~${ipl.projected}${trend}` : ''}`;
            const pairBlock = `*🏏 Bat:* ${ipl.batters || 'N/A'}\n*⚾ Bowl:* ${ipl.bowler || 'N/A'}`;
            const summaryText = `\n━━━━━━━━━━━━━━\n${rateBlock}\n${pairBlock}${partnerBlock}${probBlock}${overDisplay}`;

            // Deriving a more accurate "Live" header score (Fixing summary lag)
            const liveHeaderScore = ball.totalRuns !== undefined ? `${ball.totalRuns}/${ball.totalWickets} (${ball.over} ov)` : ipl.score;
            lastIplScore = liveHeaderScore;

            // 1. Over Change Alert (new over starts)
            const currentOver = ball.over.split('.')[0];
            if (currentOver && currentOver !== lastIplOver) {
              lastIplOver = currentOver;
              lastBlinkSignal = { text: 'Over Started', time: Date.now() };
              if (config.cricketMode) await blinkLight(2, { r: 255, g: 255, b: 255 });
            }

            // 2. Toss
            if (run.includes('TOSS') || (ball.commentary || '').toLowerCase().includes('toss won')) {
              lastGlobalSignal = { text: 'IPL Toss', time: Date.now() };
              lastBlinkSignal = { text: 'Toss Blink', time: Date.now() };
              if (config.cricketMode) await blinkLight(3, { r: 0, g: 255, b: 255 });
              await sendConsolidatedCommentary(`🪙 *TOSS:* _${ball.commentary}_`);
              return;
            }

            // 3. Post-wicket awareness pulse (first ball after wicket, before checking 4/6)
            if (prevWasWicket && !ball.isWicket && run !== '6' && run !== '4') {
              if (config.cricketMode) await pulseLight(85, 500);
            }

            const baseSummary = formatIplSummary(ipl);

            // 4. Main event dispatch
            if (ball.isWicket) {
              lastGlobalSignal = { text: 'IPL Wicket', time: Date.now() };
              lastBlinkSignal = { text: 'Wicket Red Blink', time: Date.now() };
              if (config.cricketMode) await blinkLight(3, { r: 255, g: 0, b: 0 });
              if (config.automaticScoreUpdates) await sendConsolidatedCommentary(`☝️ *WICKET!* (${ball.over})\n${baseSummary}`);
            } else if (run === '6') {
              lastGlobalSignal = { text: 'IPL Sixer', time: Date.now() };
              lastBlinkSignal = { text: 'Sixer Gold Blink', time: Date.now() };
              if (config.cricketMode) await blinkLight(3, { r: 255, g: 215, b: 0 });
              if (config.automaticScoreUpdates) await sendConsolidatedCommentary(`🚀 *SIX!* (${ball.over})\n${baseSummary}`);
            } else if (run === '4') {
              lastGlobalSignal = { text: 'IPL Four', time: Date.now() };
              lastBlinkSignal = { text: 'Four Blue Blink', time: Date.now() };
              if (config.cricketMode) await blinkLight(2, { r: 0, g: 100, b: 255 });
              if (config.automaticScoreUpdates) await sendConsolidatedCommentary(`🔥 *FOUR!* (${ball.over})\n${baseSummary}`);
            } else {
              // Normal ball
              if (config.cricketMode) await pulseLight(70, 350);
              if (config.automaticScoreUpdates) await sendConsolidatedCommentary(baseSummary);
            }

            // 5. Milestone Detection (50s/100s)
            (ipl.inningsData?.Batsmen || []).forEach(async (b: any) => {
              const r = parseInt(b.Runs || '0');
              const key = `${ipl.matchId}-${b.FullName}-${r}`;
              if ((r === 50 || r === 100) && !lastIplMilestones.has(key)) {
                lastIplMilestones.add(key);
                lastGlobalSignal = { text: `⭐ Milestone: ${b.FullName} (${r})`, time: Date.now() };
                if (config.cricketMode) await blinkLight(4, { r: 120, g: 0, b: 255 }); // Purple for Stars
                await (bot as any).sendMessage(config.telegram.chatId, `⭐ *MILESTONE:* ${b.FullName} reaches *${r}* runs! 👏\nMatch: ${ipl.matchName}`);
              }
            });
          }
        }
      } catch (e) { }
    };

    runIplPulse();
    setInterval(runIplPulse, 3000); // 3s hyper-sync
  }

  const shutdown = async (signal: string) => {
    const uptime = Math.floor(process.uptime());
    const uptimeStr = `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`;
    const acFinal = config.stats.ac?.status?.toUpperCase() || 'OFF';
    const lightFinal = config.stats.light?.status?.toUpperCase() || 'OFF';
    const acDur = getDurationString(config.stats.ac?.lastChanged);
    const lightDur = getDurationString(config.stats.light?.lastChanged);
    const stopTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const stopMsg = `🔴 *Gravity went OFFLINE*\n━━━━━━━━━━━━━━\n⏰ Stopped: *${stopTime} IST*\n❄️ AC Status: *${acFinal}* (${acDur})\n💡 Light Status: *${lightFinal}* (${lightDur})\n⏱ Session Uptime: *${uptimeStr}*\n━━━━━━━━━━━━━━\nHub will not respond until restarted.`;
    if (config.bootGreet !== false) {
      for (const userId of (config.authorizedUsers || [])) {
        try { await bot.sendMessage(userId, stopMsg, { parse_mode: 'Markdown' }); } catch {}
      }
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('manual stop'));
  process.on('SIGTERM', () => shutdown('system stop'));
  const sos = async (err: Error, type: string) => {
    console.error(`🆘 ${type}:`, err);
    const alert = `🚨 *Gravity CRASH Detected*\nType: \`${type}\`\nError: \`${err.message.substring(0, 100)}\`\n\n_Hub is attempting to stay alive..._`;
    for (const userId of (config.authorizedUsers || [])) {
      try { await bot.sendMessage(userId, alert, { parse_mode: 'Markdown' }); } catch {}
    }
  };
  process.on('uncaughtException', (err) => sos(err, 'Uncaught Exception'));
  process.on('unhandledRejection', (reason: any) => sos(reason instanceof Error ? reason : new Error(String(reason)), 'Unhandled Rejection'));
  const allCommands = bot.getHandlers().map((h: any) => ({ command: h.command, description: h.description }));
  await bot.setMyCommands(allCommands).catch((e: Error) => console.error('Failed to sync TG commands:', e));
  setInterval(() => { config = loadConfig(); scheduler.refresh(); }, 3600000);
}

async function sendConsolidatedCommentary(text: string) {
  const config = loadConfig();
  if (lastCommentaryMsgId) {
    try { await (bot as any).editMessageText(text, { chat_id: config.telegram.chatId, message_id: lastCommentaryMsgId, parse_mode: 'Markdown' }); }
    catch { const sent = await (bot as any).sendMessage(config.telegram.chatId, text, { parse_mode: 'Markdown' }); lastCommentaryMsgId = sent.message_id; }
  } else {
    const sent = await (bot as any).sendMessage(config.telegram.chatId, text, { parse_mode: 'Markdown' });
    lastCommentaryMsgId = sent.message_id;
  }
}

function formatIplSummary(ipl: any) {
  const ball = ipl.latestBall;
  if (!ball) return "🏏 *Cricket Pulse:* No live match detected.";
  
  // Trend and Projection
  let trend = "";
  const currentProj = parseInt(ipl.projected || "0");
  if (currentProj > 0 && lastIplProjected > 0) {
    if (currentProj > lastIplProjected) trend = " 📈";
    else if (currentProj < lastIplProjected) trend = " 📉";
  }

  // Build rich over-ball breakdown
  const overBallsStr = (ipl.currentOverBalls || []).map((b: any) => {
    const r = String(b.run).toUpperCase();
    if (b.isWicket) return 'W';
    if (r === '6') return '6';
    if (r === '4') return '4';
    if (r === '0') return '·';
    if (r.includes('WD')) return 'Wd';
    if (r.includes('NB')) return 'Nb';
    if (r.includes('LB')) return 'Lb';
    return r;
  }).join(' | ');
  const overDisplay = overBallsStr ? `\n🎯 *Over ${ball.over.split('.')[0]}:* ${overBallsStr}` : '';

  const probBlock = ipl.winProb ? `\n📊 *Win Prob:* ${ipl.winProb}` : '';
  const partnerBlock = ipl.partnership ? `\n🤝 *Partner:* ${ipl.partnership}` : '';
  const rateBlock = ipl.target
    ? `*Target:* ${ipl.target} | *Need:* ${parseInt(ipl.target) - (parseInt(ball.totalRuns || '0'))} off ${Math.max(0, 120 - Math.round(parseFloat(ball.over) * 6))} balls\n*CRR:* ${ipl.crr} | *RRR:* ${ipl.rrr}${ipl.projected ? ` | *Proj:* ~${ipl.projected}${trend}` : ''}`
    : `*CRR:* ${ipl.crr}${ipl.projected ? ` | *Proj:* ~${ipl.projected}${trend}` : ''}`;
  const pairBlock = `*🏏 Bat:* ${ipl.batters || 'N/A'}\n*⚾ Bowl:* ${ipl.bowler || 'N/A'}`;
  
  const liveHeaderScore = ball.totalRuns !== undefined ? `${ball.totalRuns}/${ball.totalWickets} (${ball.over} ov)` : ipl.score;
  const runEmoji = String(ball.run).toUpperCase() === '0' ? '·' : String(ball.run).toUpperCase().includes('WD') ? '🌀 Wd' : String(ball.run).toUpperCase().includes('NB') ? '📌 Nb' : String(ball.run).toUpperCase().includes('LB') ? '🦵 Lb' : `${ball.run} run${ball.run === '1' ? '' : 's'}`;

  return `🏏 *LIVE:* ${liveHeaderScore} — ${runEmoji}\n_${ball.commentary}_\n━━━━━━━━━━━━━━\n${rateBlock}\n${pairBlock}${partnerBlock}${probBlock}${overDisplay}`;
}

function parseJsonp(text: string) {
  if (!text) return null;
  // Standard JSONP callback(data)
  const match = text.match(/^[^(]+\(([\s\S]*)\)[^)]*$/);
  if (match) { try { return JSON.parse(match[1]); } catch (e) {} }
  // Loose search for any JSON object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) { 
    try { 
      const candidate = text.substring(firstBrace, lastBrace + 1);
      return JSON.parse(candidate); 
    } catch (e) {} 
  }
  // Try cleaning up common JSONP artifacts like quotes or semi-colons
  try {
    const cleaned = text.trim().replace(/^[^({]+/, '').replace(/[^)}]+$/, '');
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
       return JSON.parse(cleaned.substring(1, cleaned.length - 1));
    }
  } catch (e) {}
  return null;
}

async function fetchOfficialIpl(url: string) {
  try {
    const buster = `cb_${Date.now()}`;
    const finalUrl = url.includes('?') ? `${url}&cb=${buster}` : `${url}?cb=${buster}`;
    const res = await fetch(finalUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    return parseJsonp(text);
  } catch (e) { return null; }
}

async function getLatestIplData() {
  try {
    const comp = await fetchOfficialIpl('https://scores.iplt20.com/ipl/mc/competition.js');
    const competition = comp?.competition?.find((i: any) => String(i.SeasonName) === '2026' || String(i.SeasonID) === '19');
    if (!competition) return null;
    const scheduleUrl = `${competition.feedsource}/${competition.CompetitionID}-matchschedule.js`;
    const scheduleData = await fetchOfficialIpl(scheduleUrl);
    const matches = scheduleData?.Matchsummary || [];
    // Multi-match support: collect all live matches, pick the most recent live one.
    // On double-header days (Sat/Sun), this ensures we track the currently live game.
    const liveMatches = matches.filter((m: any) => {
      const s = (m.MatchStatus || '').toLowerCase();
      return s === 'live' || s === 'in progress';
    });
    // Pick the live match with the highest RowNo (most recently started)
    const liveMatch = liveMatches.sort((a: any, b: any) => b.RowNo - a.RowNo)[0];
    // Fallback: next upcoming, then most-recently-completed
    const targetMatch = liveMatch ||
      matches.filter((m: any) => (m.MatchStatus || '').toLowerCase() === 'upcoming').sort((a: any, b: any) => a.RowNo - b.RowNo)[0] ||
      matches.sort((a: any, b: any) => b.RowNo - a.RowNo)[0];
    if (!targetMatch) return null;
    const [inn1, inn2] = await Promise.all([
      fetchOfficialIpl(`${competition.feedsource}/${targetMatch.MatchID}-Innings1.js`),
      fetchOfficialIpl(`${competition.feedsource}/${targetMatch.MatchID}-Innings2.js`)
    ]);
    const i1 = inn1?.Innings1 || { OverHistory: [], Batsmen: [], Bowlers: [] };
    const i2 = inn2?.Innings2 || { OverHistory: [], Batsmen: [], Bowlers: [] };
    const activeInnings = i2.OverHistory.length > 0 ? i2 : i1;
    const balls: any[] = activeInnings.OverHistory || [];
    const latestBall = balls[balls.length - 1];

    // Batter/Bowler pair
    const batterPair = (activeInnings.Batsmen || []).filter((b: any) => b.IsBatting === '1' || b.IsBatting === 1).map((b: any) => `${b.FullName || b.Name} (${b.Runs}/${b.Balls})`).join(' & ') || 'N/A';
    const activeBowler = (activeInnings.Bowlers || []).find((b: any) => b.IsBowling === '1' || b.IsBowling === 1);
    const bowlerStr = activeBowler ? `${activeBowler.FullName || activeBowler.Name} (${activeBowler.Wickets}/${activeBowler.RunsConceded})` : 'N/A';

    const crr = targetMatch.CRR || '0.00';
    const rrr = targetMatch.RRR || '0.00';
    const target = targetMatch.Target || '';

    // Current over ball-by-ball breakdown (balls from the current over)
    const currentOverNo = latestBall ? String(latestBall.OverNo) : '';
    const currentOverBalls = currentOverNo
      ? balls.filter((b: any) => String(b.OverNo) === currentOverNo).map((b: any) => ({
          run: b.ActualRuns || b.BallRuns || b.Runs || '0',
          isWicket: String(b.IsWicket) === '1'
        }))
      : [];

    // Projected score (first innings only)
    let projected = 0;
    if (latestBall && !target) {
      try {
        const ovNum = parseInt(latestBall.OverNo) + (parseInt(latestBall.BallNo || '0') / 6);
        if (ovNum > 0) projected = Math.round((parseInt(latestBall.TotalRuns || '0') / ovNum) * 20);
      } catch(e) {}
    }

    return {
      matchId: String(targetMatch.MatchID),
      matchName: targetMatch.MatchName,
      status: targetMatch.MatchStatus?.toLowerCase(),
      innings: [i1, i2],
      crr, rrr, target,
      projected: projected > 0 ? String(projected) : '',
      batters: batterPair,
      bowler: bowlerStr,
      currentOverBalls,
      winProb: targetMatch.Equation || targetMatch.WinProbability || '',
      partnership: activeInnings.CurrentPartnership || '',
      inningsData: activeInnings,
      latestBall: latestBall ? {
        ballId: latestBall.BallID || latestBall.BallUniqueID || `${latestBall.OverNo}.${latestBall.BallNo}`,
        over: `${latestBall.OverNo}.${latestBall.BallNo}`,
        run: latestBall.ActualRuns || latestBall.BallRuns || latestBall.Runs || '0',
        isWicket: String(latestBall.IsWicket) === '1',
        commentary: latestBall.Commentry || latestBall.NewCommentry || '',
        totalRuns: latestBall.TotalRuns,
        totalWickets: latestBall.TotalWickets
      } : null,
      score: i2.OverHistory.length > 0 ? targetMatch.SecondBattingSummary : targetMatch.FirstBattingSummary
    };
  } catch (e) {
    const IPL_ROOT = "/Users/paranjay/Downloads/2work/dev/Web_Apps/ipl-2026-engine/public/data/balls";
    if (!fs.existsSync(IPL_ROOT)) return null;
    const files = fs.readdirSync(IPL_ROOT).filter(f => f.startsWith('match_') && f.endsWith('.json'));
    if (files.length === 0) return null;
    files.sort((a, b) => parseInt(b.split('_')[1]) - parseInt(a.split('_')[1]));
    const data = JSON.parse(fs.readFileSync(path.join(IPL_ROOT, files[0]), 'utf-8'));
    const inn = data.innings[data.innings.length - 1];
    const ball = inn.balls[inn.balls.length - 1];
    return {
      matchId: data.matchId,
      status: data.status,
      latestBall: ball ? {
        ballId: `${ball.overNumber}.${ball.ballNumber}`,
        over: `${ball.overNumber}.${ball.ballNumber}`,
        run: String(ball.runs),
        isWicket: ball.isWicket,
        commentary: ball.commentary,
        totalRuns: ball.totalRuns,
        totalWickets: ball.totalWickets
      } : null,
      score: `${inn.battingTeam}: ${inn.totalRuns}/${inn.totalWickets} (${inn.overs} ov)`
    };
  }
}

main().catch(err => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
