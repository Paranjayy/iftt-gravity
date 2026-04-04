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

  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || config.telegram?.token;
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

  // ──────────────────────────────────────────────────────
  // /ac — MirAie AC control
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'ac',
    description: 'Control AC: /ac on | off | 24 | cool | dry | fan | auto',
    handler: async (chatId, args, send) => {
      if (!miraie || miraie.devices.length === 0) {
        await send('❌ MirAie not linked. Go to the Gravity dashboard → Device Sync to connect.');
        return;
      }

      const device = miraie.devices[0];
      const arg = args[0]?.toLowerCase();

      if (!arg) {
        await send(`*AC Controls*\n/ac on — Turn on\n/ac off — Turn off\n/ac 24 — Set temperature\n/ac cool|dry|fan|auto — Set mode`);
        return;
      }

      if (arg === 'on') {
        await miraie.controlDevice(device.deviceId, { ps: '1' });
        await send(`✅ AC *ON* — ${device.deviceName}`);
      } else if (arg === 'off') {
        await miraie.controlDevice(device.deviceId, { ps: '0' });
        await send(`✅ AC *OFF* — ${device.deviceName}`);
      } else if (!isNaN(Number(arg))) {
        const temp = Math.min(30, Math.max(16, Number(arg)));
        await miraie.controlDevice(device.deviceId, { tm: temp });
        await send(`✅ AC temperature set to *${temp}°C*`);
      } else {
        const modeMap: Record<string, string> = { cool: '0', dry: '1', fan: '2', auto: '3', heat: '4' };
        const md = modeMap[arg];
        if (!md) { await send(`Unknown AC command: \`${arg}\``); return; }
        await miraie.controlDevice(device.deviceId, { md });
        await send(`✅ AC mode: *${arg.toUpperCase()}*`);
      }
    }
  });

  // ──────────────────────────────────────────────────────
  // /lights — WiZ bulb control
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'lights',
    description: 'Control lights: /lights on | off | 50 | red | blue | warm',
    handler: async (chatId, args, send) => {
      if (!wiz) {
        await send('❌ WiZ not configured. Add bulb IP in Device Sync.');
        return;
      }

      const arg = args[0]?.toLowerCase();
      if (!arg) {
        await send(`*Light Controls*\n/lights on|off\n/lights 50 — brightness %\n/lights red|blue|green|warm|cool`);
        return;
      }

      const colorMap: Record<string, { r: number; g: number; b: number }> = {
        red: { r: 255, g: 0, b: 0 },
        green: { r: 0, g: 255, b: 0 },
        blue: { r: 0, g: 0, b: 255 },
        purple: { r: 128, g: 0, b: 128 },
        orange: { r: 255, g: 100, b: 0 },
      };

      if (arg === 'on') {
        await wiz.executeAction({ type: 'light', payload: { state: true } });
        await send('✅ Lights *ON*');
      } else if (arg === 'off') {
        await wiz.executeAction({ type: 'light', payload: { state: false } });
        await send('✅ Lights *OFF*');
      } else if (arg === 'warm') {
        await wiz.executeAction({ type: 'light', payload: { state: true, temp: 2700 } });
        await send('✅ Lights: *Warm White* 🟡');
      } else if (arg === 'cool') {
        await wiz.executeAction({ type: 'light', payload: { state: true, temp: 6000 } });
        await send('✅ Lights: *Cool White* ⚪');
      } else if (!isNaN(Number(arg))) {
        const brightness = Math.min(100, Math.max(10, Number(arg)));
        await wiz.executeAction({ type: 'light', payload: { state: true, brightness } });
        await send(`✅ Lights: *${brightness}% brightness*`);
      } else if (colorMap[arg]) {
        const { r, g, b } = colorMap[arg];
        await wiz.executeAction({ type: 'light', payload: { state: true, r, g, b } });
        await send(`✅ Lights: *${arg.toUpperCase()}* 🎨`);
      } else {
        await send(`Unknown lights command: \`${arg}\``);
      }
    }
  });

  // ──────────────────────────────────────────────────────
  // /status — Device Status
  // ──────────────────────────────────────────────────────
  bot.registerCommand({
    command: 'status',
    description: 'Show status of all connected devices',
    handler: async (chatId, args, send) => {
      const lines = ['*🏠 Gravity — Device Status*\n'];
      lines.push(`❄️ *MirAie AC*: ${miraie ? `✅ Linked (${miraie.devices.length} device(s))` : '❌ Not linked'}`);
      lines.push(`💡 *WiZ Lights*: ${wiz ? '✅ Configured' : '❌ Not configured'}`);
      lines.push(`🤖 *Telegram Bot*: ✅ @${bot.botInfo?.username || 'unknown'}`);
      await send(lines.join('\n'));
    }
  });

  // Start polling
  await bot.startPolling();
  console.log('🚀 Gravity Bot Engine running. Send /start to your Telegram bot to begin.');
}

main().catch(err => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
