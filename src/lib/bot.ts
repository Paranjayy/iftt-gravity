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
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import { NextResponse } from 'next/server';

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

async function main() {
  const config = loadConfig();
  let isPhoneOnline = true; // tracking state
  let offlineCounter = 0;

  const TELEGRAM_TOKEN = config.telegram?.token || process.env.TELEGRAM_TOKEN;
  if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN not set in .env.local or config.json');
    process.exit(1);
  }

  // Init adapters
  const bot = new TelegramAdapter(TELEGRAM_TOKEN);
  await bot.initialize();

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
        await miraie.controlDevice(miraie.devices[0].deviceId, { actmp: temp });
      }
    }
  }
  const sleepManager = new SleepCurveManager();

  let miraie: MiraieAdapter | null = null;
  if (config.miraie?.mobile && config.miraie?.password) {
    try {
      miraie = new MiraieAdapter(config.miraie.mobile, config.miraie.password);
      await miraie.initialize();
      console.log(`❄️  MirAie ready: ${miraie.devices.length} device(s)`);
    
    // Recovery: Seed historical data if missing
    if (!config.stats.dailyLog || config.stats.dailyLog.length === 0) {
      config.stats.dailyLog = [
        { date: '07/04/2026', ac: '0.0', light: '5.1' },
        { date: '10/04/2026', ac: '0.0', light: '2.4' } // Based on last known 04/09 data
      ];
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    }
    } catch (e) {
      console.warn('⚠️  MirAie Init failed (Safe Mode)');
    }
  }

  if (!config.stats.history) config.stats.history = [];
  // Ensure at least one point exists on boot
  if (config.stats.history.length === 0) {
    const stamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    config.stats.history.push({ time: stamp, ac: config.stats.acMinutes || 0, lights: config.stats.lightMinutes || 0 });
  }

  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'start',
    description: 'Start Gravity Mission Control',
    handler: async (chatId, args, msg, send) => {
      // Forward to the interactive control panel immediately
      const matched = bot.getHandlers().find(h => h.command === 'control');
      if (matched) await matched.handler(chatId, [], msg, send);
    }
  });

  bot.registerCommand({
    command: 'pgvcl',
    description: 'Show latest PGVCL bill details',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const pg = config.stats.pgvcl;
      if (!pg) return await send('⌛ *PGVCL:* Data not fetched yet. Hub is scanning...');
      
      const estimate = calculatePgvclBill(Number(pg.units) || 0);
      await send(`⚡ *PGVCL Utility Status*\n\n💰 Scraped Bill: *₹${pg.amount}*\n🔌 Usage: *${pg.units} Units*\n📅 Scanned: _${new Date(pg.scannedAt).toLocaleString('en-IN')}_\n\n🧮 *Gravity Estimate*: *₹${estimate}*\n_(Includes Slabs, FPPPA & 18% Duty)_`);
    }
  });

  // ❄️ Mission Control Panel (Interactive)
  bot.registerCommand({
    command: 'control',
    description: 'Open the Interactive Control Panel',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      
      const subCommand = args[0];
      const deviceId = miraie?.devices[0]?.deviceId;

      // Handle Interactive Button Callbacks
      if (subCommand === 'ac_on') {
        const payload = { ki: 1, cnt: "an", sid: "1", ps: 'on' };
        await miraie?.controlDevice(deviceId, payload);
        return await send('✅ AC turned ON');
      }
      if (subCommand === 'ac_off') {
        const payload = { ki: 1, cnt: "an", sid: "1", ps: 'off' };
        await miraie?.controlDevice(deviceId, payload);
        return await send('🚫 AC turned OFF');
      }
      if (subCommand === 'bulb_on') {
        await wiz?.executeAction({ type: 'control', payload: { state: true } });
        return await send('💡 Bulb turned ON');
      }
      if (subCommand === 'bulb_off') {
        await wiz?.executeAction({ type: 'control', payload: { state: false } });
        return await send('🌑 Bulb turned OFF');
      }
      if (subCommand === 'temp_up' || subCommand === 'temp_down') {
        const s = await miraie?.getDeviceStatus(deviceId);
        const cur = parseInt(s?.actmp || '24');
        const target = subCommand === 'temp_up' ? cur + 1 : cur - 1;
        const finalTemp = Math.min(30, Math.max(16, target));
        const payload = { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: String(finalTemp) };
        await miraie?.controlDevice(deviceId, payload);
        return await send(`🌡️ AC Temp set to *${finalTemp}°C*`, 'Markdown');
      }

      // Automatically open the control panel if this is a direct message or /control command
      await bot.sendMessage(chatId, "❄️ *Gravity Mission Control*\nClick a button to command the hub.", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '❄️ AC ON', callback_data: 'control:ac_on' },
              { text: '🚫 AC OFF', callback_data: 'control:ac_off' }
            ],
            [
              { text: '💡 Bulb ON', callback_data: 'control:bulb_on' },
              { text: '🌑 Bulb OFF', callback_data: 'control:bulb_off' }
            ],
            [
              { text: '🌡️ Temp -', callback_data: 'control:temp_down' },
              { text: '🌡️ Temp +', callback_data: 'control:temp_up' }
            ],
            [
              { text: '🌙 Sleep Curve', callback_data: 'sleep' },
              { text: '📊 Status', callback_data: 'status' }
            ]
          ]
        }
      });
    }
  });

  // ── Presence Detection & Automations ───────────────
  setInterval(async () => {
    const phoneIp = config.phoneIp || '192.168.29.50';
    try {
      // Pinging first wakes up the device network stack
      await execAsync(`ping -c 1 -t 1 ${phoneIp}`).catch(() => {});
      // ARP check is more reliable for sleeping devices
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
          if (hour >= 5 && hour < 10 && lastBriefDate !== dateStr) {
            lastBriefDate = dateStr;
            setTimeout(() => triggerScene('MORNING_BRIEF'), 5000);
          }
        } else {
          offlineCounter = 0;
        }
      } else {
        offlineCounter++;
        if (offlineCounter >= 4) { // Gone for ~4 mins (more tolerant for ARP)
          if (isPhoneOnline) {
            isPhoneOnline = false;
            logActivity("🚶 Presence: Phone disconnected (AWAY)");
            await triggerScene('AWAY');
            speak("Goodbye. Energy saving mode active.");
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

  let wiz: WizAdapter | null = null;
  if (config.wiz?.ip) {
    try {
      wiz = new WizAdapter(config.wiz.ip);
      await wiz.initialize();
      console.log(`💡 WiZ ready: ${config.wiz.ip}`);
    } catch (e) {
      console.warn(`⚠️  WiZ Init failed for ${config.wiz.ip} (Safe Mode)`);
    }
  }

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
          await miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: 'an', sid: '1', ps: 'on', actmp: '24', acmd: 'cool', acfs: 'low' });
        }
        speak("Cinematic mode active. Enjoy your movie.");
        break;
      case "FOCUS":
        speak("Focus mode engaged. Time for deep work.");
        if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, temp: 6500, dimming: 100 } }));
        if (miraie && miraie.devices.length > 0) {
          const d = miraie.devices[0].deviceId;
          promises.push(miraie.controlDevice(d, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: '25', acmd: 'cool' }));
        }
        break;
      case "DINNER":
        speak("Dinner mode. Bon appetit.");
        if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, scene: 'Fireplace' } }));
        break;
      case "AWAY":
        speak("Goodbye. Everything is secured.");
        if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: false } }));
        if (miraie && miraie.devices.length > 0) promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'off' }));
        break;
      case "HOME":
        speak("Welcome back. Powering up your sanctuary.");
        if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, temp: 4500, dimming: 80 } }));
        if (miraie && miraie.devices.length > 0) promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: '25', acmd: 'cool' }));
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
      await miraie.controlDevice(d, { ki: 1, cnt: 'an', sid: '1', ps: 'on', actmp: '18', acmd: 'cool', acfs: '5' });
      await send(`🥶 *Boost Mode*: AC → 18°C max fan for ${mins} min`);
      speak(`Boost mode active. Max cooling for ${mins} minutes.`);
      setTimeout(async () => {
        await miraie.controlDevice(d, { ki: 1, cnt: 'an', sid: '1', ps: 'on', actmp: '25', acmd: 'cool', acfs: '3' });
        await bot.sendMessage(msg.from.id, '🌡️ *Boost Done:* AC restored to 25°C.', 'Markdown');
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
        promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: 'an', sid: '1', ps: 'on', actmp: vibe.acTemp, acmd: 'cool' }));
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
        '💡 *Lights*',
        '`/lights on` · `/lights off`',
        '`/lights 50` — brightness 0–100%',
        '`/lights red|blue|green|purple|pink|yellow|orange|cyan`',
        '`/lights white` — daylight white',
        '`/warm` — cozy 2700K',
        '',
        '🎨 *Scenes*',
        '`/scene list` — show all scenes',
        '`/scene tv|cozy|party|relax|focus|bedtime|fireplace|ocean`',
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
        promises.push(miraie.controlDevice(d.deviceId, { ki: 1, cnt: 'an', sid: '1', ps: 'on', actmp: '27', acmd: 'auto', acfs: '1' }));
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
        await miraie.controlDevice(device.deviceId, { ki: 1, cnt: "an", sid: "1", ps: arg });
        await send(`✅ AC *${arg.toUpperCase()}*`);
      } else if (!isNaN(Number(arg))) {
        const temp = Math.min(30, Math.max(16, Number(arg)));
        await miraie.controlDevice(device.deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: String(temp) });
        await send(`✅ AC: *${temp}°C*`);
      } else {
        await miraie.controlDevice(device.deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on', acmd: arg });
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
      await send(`🏓 *Pong!* Bot is alive\n⏱ Uptime: *${mins}m ${secs}s*\n💾 Memory: *${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB*`);
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
    description: 'Sync lights to Junagadh weather & Time-of-day',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (!wiz) return await send('❌ WiZ not configured.');
      try {
        const res = await fetch('https://wttr.in/Junagadh?format=j1');
        const data: any = await res.json();
        const code = Number(data.current_condition[0].weatherCode);
        const tempC = data.current_condition[0].temp_C;
        const desc = data.current_condition[0].weatherDesc[0].value;
        const hour = new Date().getHours(); // Local server time (should be IST on Mac)

        // Weather logic
        let scene = '', emoji = '';
        if ([200,201,202,210,211,212,221,230,231,232].includes(code)) { scene = 'Party'; emoji = '⛈️'; }
        else if ([300,301,302,310,311,312,313,314,321,500,501,502,503,504].includes(code)) { scene = 'Ocean'; emoji = '🌧️'; }
        else if (hour < 7 || hour > 19) { scene = 'Night Light'; emoji = '🌙'; } // Night time override
        else if (code === 800) { scene = 'True colors'; emoji = '☀️'; }
        else { scene = 'Warm White'; emoji = '☁️'; }

        await wiz.executeAction({ type: 'control', payload: { state: true, scene } });
        await send(`${emoji} *Junagadh:* ${desc} (${tempC}°C)\n🕓 Time: *${hour}:00*\n💡 Auto-Scene: *${scene}*`);
      } catch {
        await send('❌ Weather service down. Try again later.');
      }
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
      
      await send(`📊 *Gravity Analytics*\n_Since ${new Date(stats.lastReset).toLocaleDateString()}_\n\n❄️ *AC Lifetime*: ${hoursAC} hrs\n💡 *WiZ Lifetime*: ${hoursLight} hrs\n\n_Uptime is tracked even if you use the physical remote!_`);
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
        promises.push(miraie.controlDevice(d.deviceId, { ki: 1, cnt: 'an', sid: '1', ps: 'off' }));
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
        promises.push(miraie.controlDevice(d.deviceId, { ki: 1, cnt: 'an', sid: '1', ps: 'on', actmp: '24', acmd: 'cool' }));
      }
      await Promise.all(promises);
      await send('🏠 *Welcome Home!* Lights → 80% daylight · AC → 24°C cool');
    }
  });

  // ──────────────────────────────────────────────────────

  // /status — Device Status
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'status',
    description: 'System Status',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const uptime = Math.floor(process.uptime());
      const lines = ['*🏡 Gravity Status*\n'];
      lines.push(`❄️ *AC*: ${miraie ? `✅ Live` : '❌ Offline'}`);
      lines.push(`💡 *Lights*: ${wiz ? `✅` : '❌ Offline'}`);
      lines.push(`🤖 *Bot*: ✅ Online`);
      lines.push(`⏱ *Uptime*: ${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`);
      
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
        await bot.sendMessage(msg.from.id, `🔔 *Reminder:* ${message}`, 'Markdown');
      }, ms);
    }
  });

  // ──────────────────────────────────────────────────────
  // /timer — Auto shut-off timer
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'timer',
    description: 'Auto off-timer: /timer 30 lights',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const mins = parseInt(args[0]);
      const device = args[1]?.toLowerCase() || 'all';
      if (isNaN(mins) || mins <= 0) return await send('Usage: `/timer 30 lights` or `/timer 60 ac` or `/timer 45 all`');
      
      await send(`⏱ *Auto-off in ${mins} min* for: *${device.toUpperCase()}*\nGravity will handle it.`);
      setTimeout(async () => {
        const promises = [];
        if ((device === 'all' || device === 'lights') && wiz) {
          promises.push(wiz.executeAction({ type: 'control', payload: { state: false } }));
        }
        if ((device === 'all' || device === 'ac') && miraie && miraie.devices.length > 0) {
          promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: 'an', sid: '1', ps: 'off' }));
        }
        await Promise.all(promises);
        await bot.sendMessage(msg.from.id, `😴 *Timer Done:* ${device.toUpperCase()} powered off.`, 'Markdown');
        speak(`${device} powered off by timer.`);
      }, mins * 60000);
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

  // Start polling
  await bot.startPolling();
  console.log('🚀 Gravity Bot Engine running. Commands refreshed.');

  // ── Startup Notification ────────────────────────────
  const startTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const startMsg = `🟢 *Gravity is ONLINE*\n⏰ Started at *${startTime} IST*\n❄️ AC: ${miraie ? '✅' : '❌'} | 💡 Light: ${wiz ? '✅' : '❌'}\n\nType /ping to check status anytime.`;
  for (const userId of (config.authorizedUsers || [])) {
    try { await bot.sendMessage(userId, startMsg, 'Markdown'); } catch {}
  }

  // ── Daily Noon Heartbeat ────────────────────────────
  // Confirms the bot is alive every day at 12:00 PM IST
  setInterval(async () => {
    const now = new Date();
    const istHour = (now.getUTCHours() + 5) % 24;
    const istMin = (now.getUTCMinutes() + 30) % 60;
    if (istHour === 12 && istMin < 2) {
      const stats = config.stats || { acMinutes: 0, lightMinutes: 0 };
      const ping = `🌞 *Gravity Daily Ping*\n_Bot is alive and healthy._\n\n❄️ AC today: *${(stats.acMinutes/60).toFixed(1)}h*\n💡 Lights today: *${(stats.lightMinutes/60).toFixed(1)}h*\n⏱ Uptime: *${Math.floor(process.uptime()/3600)}h*`;
      for (const uid of (config.authorizedUsers || [])) {
        try { await bot.sendMessage(uid, ping, 'Markdown'); } catch {}
      }
    }
  }, 60000);


  // ──────────────────────────────────────────────────────
  // /track — Presence IP
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'track',
    description: 'Set your Phone IP for auto-away/welcome',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const ip = args[0];
      if (!ip) return await send(`🏠 *Current Tracking:* \`${config.phoneIp || 'None'}\`\nUse: \`/track [IP]\``);
      config.phoneIp = ip;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      await send(`✅ Tracking your device at *${ip}*\nGravity will now auto-manage house presence.`);
    }
  });

  // ──────────────────────────────────────────────────────
  // /remember — Cortex Memory System
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'remember',
    description: 'Save a persistent preference: /remember I like the AC at 22',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const memory = args.join(' ');
      if (!memory) return await send('Usage: `/remember [FACT]`');
      
      if (!config.preferences.habits) config.preferences.habits = [];
      config.preferences.habits.push({
        fact: memory,
        at: new Date().toISOString()
      });
      
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      await send(`🧠 *Memory Saved:* I will keep this in my God Build Cortex.\n_"${memory}"_`);
      logActivity(`🧠 Cortex: Memory added - ${memory}`);
    }
  });

  // ──────────────────────────────────────────────────────
  // /system — Mac System Monitor (New Feature v2.3)
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'system',
    description: 'Monitor the Mac Hub (Battery, CPU, Uptime)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      
      const { stdout: batt } = await execAsync('pmset -g batt');
      const { stdout: load } = await execAsync('uptime');
      
      const battLevel = batt.match(/(\d+)%/)?.[1] || 'Unknown';
      const isCharging = batt.includes('AC Power') || batt.includes('charging');
      const loadAvg = load.split('load averages:')[1] || 'Unknown';
      
      const sysMsg = `🖥 *Gravity System Status* ⚡\n\n🔋 Battery: *${battLevel}%* ${isCharging ? '(Charging 🔌)' : '(Unplugged 🔋)'}\n🚀 CPU Load: _${loadAvg.trim()}_\n🕒 Uptime: *${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m*\n💾 Hub: *ONLINE*`;
      await send(sysMsg);
    }
  });

  // ──────────────────────────────────────────────────────
  // /lock & /sleep — Mac Security Control (New Feature v2.4)
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'lock',
    description: 'Lock your Mac screen instantly',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      try {
        await execAsync('pmset displaysleepnow');
        await send('🔐 *Mac Screen Locked.*');
        logActivity('🔐 Mac Screen-Locked (Via Telegram)');
      } catch { await send('❌ Failed to lock Mac.'); }
    }
  });

  bot.registerCommand({
    command: 'sleep',
    description: 'Put Mac to sleep',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      try {
        await send('💤 *Putting Mac to Sleep...* 💡 (HUB MAY GO OFFLINE)');
        logActivity('💤 Mac Sleep Triggered');
        await execAsync('pmset sleepnow');
      } catch { await send('❌ Failed to sleep Mac.'); }
    }
  });

  bot.registerCommand({
    command: 'say',
    description: 'Make the Mac speak out loud',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const text = args.join(' ');
      if (!text) return await send('⚠️ Please provide a message: `/say Hello`');
      try {
        await speak(text);
        await send(`🗣 *Mac says:* "${text}"`);
        logActivity(`🗣 Mac Speech via Telegram: ${text}`);
      } catch { await send('❌ Failed to speak.'); }
    }
  });

  // ──────────────────────────────────────────────────────
  // /wish — AI Cortex Wishlist System
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'wish',
    description: 'Archive a feature request or prompt: /wish Add solar tracking',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      const wish = args.join(' ');
      if (!wish) return await send('Usage: `/wish [prompt/feature]`');
      
      const entry = `\n- [ ] [${new Date().toLocaleDateString()}] User: "${wish}"`;
      fs.appendFileSync(WISHLIST_PATH, entry);
      
      await send(`🗒 *Evolution Insight Added:* I have archived this in my God Build Cortex.\n_"${wish}"_`);
      logActivity(`🧠 Cortex: Wishlist updated - ${wish}`);
    }
  });
  setInterval(async () => {
    const devices = config.familyDevices || (config.phoneIp ? [{name: 'Phone', ip: config.phoneIp}] : []);
    if (devices.length === 0) return;
    try {
      let anyPresent = false;
      for (const dev of devices) {
        // Double-check: Ping + ARP Table lookup
        await execAsync(`ping -c 1 -W 500 ${dev.ip}`).catch(() => {});
        const { stdout } = await execAsync(`arp -a`);
        if (stdout.includes(`(${dev.ip})`)) {
          anyPresent = true;
          break;
        }
      }
      
      const now = new Date();
      const dateStr = now.toDateString();
      
      if (anyPresent) {
        if (!isPhoneOnline) {
          isPhoneOnline = true;
          offlineCounter = 0;
          logActivity("📱 Presence: Member detected (HOME)");
          await triggerScene('HOME');
          
          if (now.getHours() >= 5 && now.getHours() < 10 && lastBriefDate !== dateStr) {
            lastBriefDate = dateStr;
            try {
              const weather = await fetch('https://wttr.in/Junagadh?format=j1').then(r => r.json());
              const cur = weather.current_condition[0];
              const brief = `Good morning Paranjay. It is currently ${cur.temp_C} degrees in Junagadh. Welcome home.`;
              speak(brief);
            } catch { speak("Good morning. Welcome home."); }
          } else {
            speak("Welcome home.");
          }

          for (const uid of (config.authorizedUsers || [])) {
            await bot.sendMessage(uid, '🏠 *Welcome Home!* Member detected on network.', { parse_mode: 'Markdown' });
          }
        } else {
          offlineCounter = 0;
        }
      } else {
        offlineCounter++;
        if (offlineCounter >= 5) { // Gone for ~5 mins (more tolerant for ARP)
          if (isPhoneOnline) {
            isPhoneOnline = false;
            logActivity("🚶 Presence: House Vacant (AWAY)");
            await triggerScene('AWAY');
            speak("Goodbye. House secured.");
            for (const uid of (config.authorizedUsers || [])) {
              await bot.sendMessage(uid, '🚶 *Away Detect:* House vacant. Energy saving mode active.', { parse_mode: 'Markdown' });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Presence loop error', e);
    }
  }, 60000);

  // ──────────────────────────────────────────────────────
  // 👻 Ghost Sentry (Security v2.6)
  // ──────────────────────────────────────────────────────
  let ghostAlertSent = false;
  setInterval(async () => {
    if (isPhoneOnline) {
      ghostAlertSent = false;
      return;
    }
    try {
      const { stdout } = await execAsync("ioreg -c IOHIDSystem | grep HIDIdleTime | head -n 1");
      const match = stdout.match(/HIDIdleTime" = (\d+)/);
      if (match) {
        const idleNano = BigInt(match[1]);
        const idleSecs = Number(idleNano / 1000000000n);
        if (idleSecs < 10 && !ghostAlertSent) {
          ghostAlertSent = true;
          const msg = `⚠️ *Gravity: Ghost Alert* 👻\nActivity detected at the Hub Mac while you are AWAY.\n_Idle Time: ${idleSecs.toFixed(1)}s_`;
          for (const uid of (config.authorizedUsers || [])) {
            await bot.sendMessage(uid, msg, 'Markdown');
          }
        } else if (idleSecs > 60) {
          ghostAlertSent = false;
        }
      }
    } catch {}
  }, 10000); // Check every 10s

  // Raw text "Insight Intelligence" - Capture requests without /wish
  bot.onMessage = async (msg: any) => {
    if (!msg.text) return;
    
    // 💾 Prompt Vault (v2.5) - Archive for future AI context
    const vaultEntry = `\n- [${new Date().toLocaleString()}] "${msg.text}"`;
    fs.appendFileSync(VAULT_PATH, vaultEntry);
    
    // 📈 Atomic Stats
    config.stats = config.stats || {};
    config.stats.prompts = (config.stats.prompts || 0) + 1;
    saveConfig(config);

    if (msg.text.startsWith('/')) return;
    
    // If it looks like a request or a fact, store it!
    const text = msg.text.trim();
    if (text.length > 5 && (text.includes(' ') || text.toLowerCase().includes('want'))) {
      const entry = `\n- [ ] [${new Date().toLocaleDateString()}] Insight: "${text}"`;
      fs.appendFileSync(WISHLIST_PATH, entry);
      logActivity(`🧠 Insight Captured (No command): ${text}`);
    }
  };

  // ── Web Control API (Port 3030) ─────────────────────
  // Perfect for Raycast / Siri Shortcuts (curl http://localhost:3030/scene/tv)
  try {
    (Bun as any).serve({
      port: 3030,
      async fetch(req: any) {
        const url = new URL(req.url);
        const sceneName = url.pathname.split('/').pop()?.toUpperCase();
        if (url.pathname.includes('/status')) {
          const body = JSON.stringify({
            online: isPhoneOnline,
            stats: config.stats,
            estimatedPgBill: calculatePgvclBill(Number(config.stats.pgvcl?.units) || 0),
            uptime: process.uptime(),
            pgvcl: config.stats.pgvcl
          }, null, 2);
          return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/system/lock') {
          await execAsync(`pmset displaysleepnow || /System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend`);
          return new Response('Locked', { status: 200 });
        }
        if (url.pathname === '/system/sleep') {
          await execAsync(`osascript -e 'tell application "System Events" to sleep'`);
          return new Response('Sleep', { status: 200 });
        }
        if (url.pathname === '/control/brightness') {
          const dir = url.searchParams.get('dir') === 'up' ? 20 : -20;
          if (wiz) {
            // Target the primary wiz bulb
            const p = await (wiz as any).getPilot();
            const current = p?.dimming || 50;
            await (wiz as any).executeAction({ type: 'control', payload: { state: true, dimming: Math.min(100, Math.max(10, current + dir)) } });
          }
          return new Response('Dimmed', { status: 200 });
        }
        if (url.pathname === '/control/bulb/off') {
          if (wiz) await (wiz as any).executeAction({ type: 'control', payload: { state: false } });
          return new Response('Bulb Off', { status: 200 });
        }
        if (url.pathname === '/control/temp') {
          const dir = url.searchParams.get('dir') === 'up' ? 1 : -1;
          if (miraie && (miraie as any).devices.length > 0) {
            for (const device of (miraie as any).devices) {
              const status = await (miraie as any).getDeviceStatus(device.deviceId);
              const current = parseInt(status?.actmp || '24');
              const target = Math.min(30, Math.max(16, current + dir)).toString();
              await (miraie as any).controlDevice(device.deviceId, { actmp: target });
            }
          }
          return new Response('Temp Set', { status: 200 });
        }
        if (url.pathname === '/control/ac/off') {
          if (miraie && (miraie as any).devices.length > 0) {
            for (const device of (miraie as any).devices) {
              await (miraie as any).controlDevice(device.deviceId, { ps: 'off' });
            }
          }
          return new Response('AC Off', { status: 200 });
        }
        if (url.pathname === '/control/volume') {
          const dir = url.searchParams.get('dir') === 'up' ? 'up' : 'down';
          await execAsync(`osascript -e 'set volume output volume ((output volume of (get volume settings)) ${dir === 'up' ? '+' : '-'} 10)'`);
          return new Response('Volume Set', { status: 200 });
        }
        if (sceneName) {
          await triggerScene(sceneName);
          return new Response(`Gravity: Scene ${sceneName} Active`, { status: 200 });
        }
        return new Response("Gravity API Active", { status: 200 });
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
      // This is a placeholder for the exact selectors after user confirmation
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
  // Poll objects every 60 seconds to detect "ON" state
  // Even if turned on via physical remote!
  // Initialize stats if missing
  if (!config.stats) {
    config.stats = { acMinutes: 0, lightMinutes: 0, lastReset: new Date() };
  }

  setInterval(async () => {
    try {
      // 1. Check WiZ (Loop all bulbs if we add array support later, current: single ip)
      if (wiz) {
        const p = await (wiz as any).getPilot();
        if (p?.state) config.stats.lightMinutes++;
      }
      // 1. Force MirAie REST refresh to ensure absolute tracking accuracy
      if (miraie) {
        try { await (miraie as any).refreshAllStatuses(); } catch {}
      }

      // 2. Check MirAie (Loop ALL devices)
      if (miraie && (miraie as any).devices.length > 0) {
        for (const device of (miraie as any).devices) {
          const status = await (miraie as any).getDeviceStatus(device.deviceId);
          const ps = String(status?.ps || '').toLowerCase();
          if (ps === 'on' || ps === '1' || ps === 'true') {
            config.stats.acMinutes++;
            break; // Count as 1 active AC minute for the house
          }
        }
      }

      const now = new Date();
      // Record hourly snapshot if it's a new hour
      if (now.getMinutes() === 0) {
        if (!config.stats.history) config.stats.history = [];
        const stamp = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        config.stats.history.push({ time: stamp, ac: config.stats.acMinutes, lights: config.stats.lightMinutes });
        if (config.stats.history.length > 24) config.stats.history.shift();
      }

      // 3. Save stats
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

      // 4. Daily Review at 11:59 PM
      if (now.getHours() === 23 && now.getMinutes() === 59) {
        const stats = config.stats;
        const dateStr = now.toLocaleDateString('en-IN');
        
        const msg = `🌙 *Gravity Daily Review*\n\n❄️ AC: *${(stats.acMinutes/60).toFixed(1)} hrs*\n💡 Light: *${(stats.lightMinutes/60).toFixed(1)} hrs*`;
        for (const uid of (config.authorizedUsers || [])) {
          await bot.sendMessage(uid, msg, 'Markdown');
        }

        // Archive to Daily Log
        if (!config.stats.dailyLog) config.stats.dailyLog = [];
        config.stats.dailyLog.push({
          date: dateStr,
          ac: (stats.acMinutes/60).toFixed(1),
          light: (stats.lightMinutes/60).toFixed(1)
        });
        if (config.stats.dailyLog.length > 365) config.stats.dailyLog.shift();

        config.stats = { acMinutes: 0, lightMinutes: 0, lastReset: new Date(), history: config.stats.history, dailyLog: config.stats.dailyLog };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      }
    } catch (err) {
      console.warn('Stats loop error');
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
            await bot.sendMessage(uid, msg, 'Markdown');
          }
        } else if (level > 25) {
          batteryAlertSent = false;
        }
      }
    } catch {}
  }, 300000); // Check every 5m

  // ── Shutdown Notification ───────────────────────────
  // Notify on SIGINT / SIGTERM (Ctrl+C, process kill)
  const shutdown = async (signal: string) => {
    const stopTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const stopMsg = `🔴 *Gravity went OFFLINE*\n⏰ Stopped at *${stopTime} IST* (${signal})\n\nBot will not respond until restarted.`;
    for (const userId of (config.authorizedUsers || [])) {
      try { await bot.sendMessage(userId, stopMsg, 'Markdown'); } catch {}
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('manual stop'));
  process.on('SIGTERM', () => shutdown('system stop'));
}

main().catch(err => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
