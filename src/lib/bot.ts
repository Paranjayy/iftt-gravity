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

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return {}; }
}

async function main() {
  const config = loadConfig();

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
    return auth.includes(msg.from.id) || msg.from?.username === "paranjayy";
  };

  const triggerScene = async (sceneId: string) => {
    if (sceneId === "TV") {
      if (wiz) await wiz.executeAction({ type: 'control', payload: { state: true, scene: 'TV time' } });
      if (miraie && miraie.devices.length > 0) {
        // Send power-on, then settings
        await miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on' });
        await miraie.controlDevice(miraie.devices[0].deviceId, { ki: 1, cnt: "an", sid: "1", ps: 'on', actmp: '24', acmd: 'cool' });
      }
    }
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
        '`/tv` — cinema: WiZ TV scene + AC 24°C',
        '`/done` — end cinema: daylight + AC off',
        '`/sleep` — 10% warm + AC 27°C fan',
        '`/away` — turn everything off',
        '`/home` — welcome home: lights + AC on',
        '`/weather` — sync lights to current weather 🌦️',
        '',
        '🛠 *System*',
        '`/status` — all device states + uptime',
        '`/ping` — quick health check',
        '`/whoami` — your Telegram ID',
        '`/allow [ID]` — authorize a new user',
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
      } else if (arg === 'white') {
        await wiz.executeAction({ type: 'control', payload: { state: true, temp: 4500 } });
        await send(`💡 Mode: *Daylight White*`);
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
          await send(`❌ Unknown: \`${arg}\`\nTry: on · off · 0–100 · white · red · blue · green · purple · pink · yellow · orange · cyan`);
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
  // /weather — Sync lights to current weather
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'weather',
    description: 'Sync lights to current weather (auto scene)',
    handler: async (chatId, args, msg, send) => {
      if (!isAuthorized(msg)) return await send('⛔ *Access Denied.*');
      if (!wiz) return await send('❌ WiZ not configured.');
      try {
        // wttr.in — no API key needed!
        const res = await fetch('https://wttr.in/?format=j1');
        const data: any = await res.json();
        const code = Number(data.current_condition[0].weatherCode);
        const tempC = data.current_condition[0].temp_C;
        const desc = data.current_condition[0].weatherDesc[0].value;
        const city = data.nearest_area[0].areaName[0].value;

        // Weather code → scene mapping
        let scene = '', emoji = '';
        if ([200,201,202,210,211,212,221,230,231,232].includes(code)) {
          scene = 'Party'; emoji = '⛈️'; // thunderstorm
        } else if ([300,301,302,310,311,312,313,314,321].includes(code)) {
          scene = 'Ocean'; emoji = '🌧️'; // drizzle
        } else if ([500,501,502,503,504,511,520,521,522,531].includes(code)) {
          scene = 'Ocean'; emoji = '🌧️'; // rain → deep blue
        } else if ([600,601,602,611,612,613,615,616,620,621,622].includes(code)) {
          scene = 'Cool White'; emoji = '❄️'; // snow → cool white
        } else if ([800].includes(code)) {
          scene = 'True colors'; emoji = '☀️'; // clear → vivid daylight
        } else if ([801,802].includes(code)) {
          scene = 'Relax'; emoji = '⛅'; // partly cloudy → warm
        } else {
          scene = 'Warm White'; emoji = '☁️'; // cloudy → soft warm
        }

        await wiz.executeAction({ type: 'control', payload: { state: true, scene } });
        await send(`${emoji} *${desc}* in ${city} — ${tempC}°C\n\n💡 Set scene: *${scene}*`);
      } catch {
        await send('❌ Could not fetch weather. Try again later.');
      }
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

  // Start polling
  await bot.startPolling();
  console.log('🚀 Gravity Bot Engine running. Commands refreshed.');

  // ── Startup Notification ────────────────────────────
  // Tell all authorized users the bot just came online
  const startTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const startMsg = `🟢 *Gravity is ONLINE*\n⏰ Started at *${startTime} IST*\n❄️ AC: ${miraie ? '✅' : '❌'} | 💡 WiZ: ${wiz ? '✅' : '❌'}\n\nType /ping to check status anytime.`;
  for (const userId of (config.authorizedUsers || [])) {
    try { await bot.sendMessage(userId, startMsg, 'Markdown'); } catch {}
  }

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
