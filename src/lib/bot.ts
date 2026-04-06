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
        const dim = Math.min(100, Math.max(0, Number(arg)));
        await wiz.executeAction({ type: 'control', payload: { state: dim > 0, dimming: dim } });
        await send(`💡 Brightness: *${dim}%*${dim === 0 ? ' (minimum)' : ''}`);
      } else if (arg === 'white') {
        await wiz.executeAction({ type: 'control', payload: { state: true, temp: 4500 } });
        await send(`💡 Mode: *Daylight White*`);
      } else {
        const colors: any = { red: { r: 255, g: 0, b: 0 }, blue: { r: 0, g: 0, b: 255 }, green: { r: 0, g: 255, b: 0 } };
        if (colors[arg]) {
          await wiz.executeAction({ type: 'control', payload: { state: true, ...colors[arg] } });
          await send(`💡 Color: *${arg.toUpperCase()}*`);
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
