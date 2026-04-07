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

const execAsync = promisify(exec);
const CONFIG_PATH = path.join(process.cwd(), 'config.json');
declare const Bun: any;

async function speak(text: string) {
  try { await execAsync(`say "${text.replace(/"/g, '')}"`); }
  catch (e) { console.warn('Voice output failed (not on Mac?)'); }
}

let lastBriefDate = "";
let lastEveningDate = "";

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return {}; }
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

  let miraie: MiraieAdapter | null = null;
  if (config.miraie?.mobile && config.miraie?.password) {
    miraie = new MiraieAdapter(config.miraie.mobile, config.miraie.password);
    await miraie.login();
    await miraie.fetchDevices();
    console.log(`❄️  MirAie ready: ${miraie.devices.length} device(s)`);
  }

  let wiz: WizAdapter | null = null;
  if (config.wiz?.ip) {
    wiz = new WizAdapter(config.wiz.ip);
    await wiz.initialize();
    console.log(`💡 WiZ ready: ${config.wiz.ip}`);
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

  const triggerScene = async (sceneId: string) => {
    const promises = [];
    if (sceneId === "TV") {
      speak("Entering Cinema Mode. Enjoy the movie.");
      if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, scene: 'TV time' } }));
      if (miraie && miraie.devices.length > 0) {
        const d = miraie.devices[0].deviceId;
        promises.push(miraie.controlDevice(d, { ki: 1, cnt: "an", sid: "1", ps: 'on' }));
        promises.push(miraie.controlDevice(d, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: '24', acmd: 'cool' }));
      }
    } else if (sceneId === "FOCUS") {
      speak("Focus mode engaged. Time for deep work.");
      if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, temp: 6500, dimming: 100 } }));
      if (miraie && miraie.devices.length > 0) {
        const d = miraie.devices[0].deviceId;
        promises.push(miraie.controlDevice(d, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: '25', acmd: 'cool' }));
      }
    } else if (sceneId === "DINNER") {
      speak("Dinner mode. Bon appetit.");
      if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, scene: 'Fireplace' } }));
      // Leave AC as is or turn it off, let's keep it comfortable.
    } else if (sceneId === "AWAY") {
      speak("Goodbye. Everything is secured.");
      if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: false } }));
      if (miraie && miraie.devices.length > 0) promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'off' }));
    } else if (sceneId === "HOME") {
      speak("Welcome back. Powering up your sanctuary.");
      if (wiz) promises.push(wiz.executeAction({ type: 'control', payload: { state: true, temp: 4500, dimming: 80 } }));
      if (miraie && miraie.devices.length > 0) promises.push(miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: '25', acmd: 'cool' }));
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

  // ──────────────────────────────────────────────────────
  // /help — Command reference
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
  // /tv — Cinema Mode
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'tv',
    description: 'TV Time: Official WiZ Scene & 24°C AC',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      await triggerScene("TV");
      await send("🍿 *Cinema Mode Activated:* Syncing WiZ Scene 18 & AC 24°C...");
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
        await wiz.executeAction({ type: 'control', payload: { state: true, temp: 2700, dimming: 30 } });
        await send(`📺 *TV Bias Light* — warm 2700K at 30%`);
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
      lines.push(`❄️ *AC*: ${miraie ? `✅ Live (${miraie.devices.length} device)` : '❌ Offline'}`);
      lines.push(`💡 *Lights*: ${wiz ? `✅ ${config.wiz.ip}` : '❌ Offline'}`);
      lines.push(`🤖 *Bot*: ✅ Online`);
      lines.push(`⏱ *Uptime*: ${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`);
      await send(lines.join('\n'));
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

  // Start polling
  await bot.startPolling();
  console.log('🚀 Gravity Bot Engine running. Commands refreshed.');

  // ── Startup Notification ────────────────────────────
  const startTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const startMsg = `🟢 *Gravity is ONLINE*\n⏰ Started at *${startTime} IST*\n❄️ AC: ${miraie ? '✅' : '❌'} | 💡 WiZ: ${wiz ? '✅' : '❌'}\n\nType /ping to check status anytime.`;
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

  // ── Presence Detection & Automations ───────────────
  setInterval(async () => {
    if (!config.phoneIp) return;
    try {
      await execAsync(`ping -c 1 -W 2000 ${config.phoneIp}`);
      
      const now = new Date();
      const dateStr = now.toDateString();
      
      if (!isPhoneOnline) {
        isPhoneOnline = true;
        offlineCounter = 0;
        await triggerScene('HOME');
        
        // 🌅 Morning Briefing (First connection after 5 AM and before 10 AM)
        if (now.getHours() >= 5 && now.getHours() < 10 && lastBriefDate !== dateStr) {
          lastBriefDate = dateStr;
          try {
            const weather = await fetch('https://wttr.in/Junagadh?format=j1').then(r => r.json());
            const cur = weather.current_condition[0];
            const brief = `Good morning Paranjay. It is currently ${cur.temp_C} degrees and ${cur.weatherDesc[0].value} in Junagadh. Your home sanctuary is ready. Have a productive day!`;
            speak(brief);
          } catch { speak("Good morning Paranjay. Welcome home."); }
        } else {
          speak("Welcome home. Phone detected on network. Resetting house state.");
        }

        for (const uid of (config.authorizedUsers || [])) {
          await bot.sendMessage(uid, '📱 *Welcome Home!* Phone detected on network. Resetting house state.', 'Markdown');
        }
      } else {
        // 🌇 Sunset Routine (If home at 6:30 PM)
        if (now.getHours() === 18 && now.getMinutes() >= 30 && lastEveningDate !== dateStr) {
          lastEveningDate = dateStr;
          speak("The sun is setting. Transitioning to evening lighting mode.");
          if (wiz) await wiz.executeAction({ type: 'control', payload: { state: true, scene: 'Cozy' } });
          for (const uid of (config.authorizedUsers || [])) {
            await bot.sendMessage(uid, '🌇 *Golden Hour:* Setting cozy dinner lighting.', 'Markdown');
          }
        }
      }
    } catch {
      if (isPhoneOnline) {
        offlineCounter++;
        if (offlineCounter >= 3) { // Gone for 3 mins
          isPhoneOnline = false;
          await triggerScene('AWAY');
          speak("Goodbye. Everything is secured. Energy saving mode active.");
          for (const uid of (config.authorizedUsers || [])) {
            await bot.sendMessage(uid, '🚶 *Away Detect:* Phone logged out. Gravity entering energy save mode.', 'Markdown');
          }
        }
      }
    }
  }, 60000);

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
            uptime: process.uptime()
          }, null, 2);
          return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
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

  // ── Energy Monitor ────────────────────────
  // Poll objects every 60 seconds to detect "ON" state
  // Even if turned on via physical remote!
  // Initialize stats if missing
  if (!config.stats) {
    config.stats = { acMinutes: 0, lightMinutes: 0, lastReset: new Date() };
  }

  setInterval(async () => {
    try {
      // 1. Check WiZ
      if (wiz) {
        const p = await (wiz as any).getPilot(); // adapter.getPilot()
        if (p?.state) config.stats.lightMinutes++;
      }
      // 2. Check MirAie
      if (miraie && miraie.devices.length > 0) {
        const device = miraie.devices[0];
        if (device.status?.ps === 'on') config.stats.acMinutes++;
      }
      // 3. Save stats
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

      // 4. Daily Review at 11:59 PM
      const now = new Date();
      if (now.getHours() === 23 && now.getMinutes() === 59) {
        const stats = config.stats;
        const msg = `🌙 *Gravity Daily Review*\n_Today's stats:_\n\n❄️ AC: *${(stats.acMinutes/60).toFixed(1)} hrs*\n💡 Light: *${(stats.lightMinutes/60).toFixed(1)} hrs*\n\nStats reset for tomorrow. Goodnight!`;
        for (const uid of (config.authorizedUsers || [])) {
          await bot.sendMessage(uid, msg, 'Markdown');
        }
        config.stats = { acMinutes: 0, lightMinutes: 0, lastReset: new Date() };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      }
    } catch (err) {
      console.warn('Stats loop error');
    }
  }, 60000);

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
