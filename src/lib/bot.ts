/**
 * Gravity Bot Engine 🤖
 * 
 * Central hub for Telegram, Hardware (WiZ/MirIAE), and IFTT automation.
 * Dedicated Port: 3030
 */

import { TelegramAdapter } from './adapters/telegram';
import { MiraieAdapter } from './adapters/miraie';
import { WizAdapter } from './adapters/wiz';
import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);
const ROOT_DIR = "/Users/paranjay/Developer/iftt";
const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');

declare const Bun: any;

function getDuration(timestamp: string): string {
  if (!timestamp) return '0m';
  try {
    const start = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diffMinutes = Math.floor((now - start) / 60000);
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  } catch (e) { return '0m'; }
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveConfig(config: any) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }
  catch (e) { console.error('Failed to save config', e); }
}

let config: any;
let bot: TelegramAdapter;
let miraie: MiraieAdapter | null = null;
let wiz: WizAdapter | null = null;

const authCheck = (chatId: number) => config.authorizedUsers?.includes(chatId);

async function main() {
  config = loadConfig();
  console.log('🤖 Gravity Hub: Starting Pulse...');

  const TELEGRAM_TOKEN = config.telegram?.token;
  if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN not set');
    process.exit(1);
  }
  
  bot = new TelegramAdapter(TELEGRAM_TOKEN);
  await bot.initialize().catch(() => console.error('Telegram init failed'));

  if (config.miraie?.mobile && config.miraie?.password) {
    miraie = new MiraieAdapter(config.miraie.mobile, config.miraie.password);
    await miraie.initialize().catch(() => console.warn('❄️ AC Offline'));
  }

  if (config.wiz?.ip) {
    wiz = new WizAdapter(config.wiz.ip);
  }

  // 📝 COMMAND REGISTRATION
  bot.registerCommand({
    command: 'status',
    description: 'Show current states',
    handler: async (chatId) => {
      if (!authCheck(chatId)) return;
      const ac = config.stats?.ac || { status: 'OFF' };
      const light = config.stats?.light || { status: 'OFF' };
      const acDur = getDuration(ac.lastChanged);
      const lightDur = getDuration(light.lastChanged);
      
      const dashboard = `🏗 *Gravity Mission Control*\n━━━━━━━━━━━━━━\n❄️ AC: *${ac.status}* (${acDur})\n💡 Light: *${light.status}* (${lightDur})\n\n🤖 *System State*\n🌡 Temp: ${ac.actmp || '--'}°C | Mode: ${ac.acmd || '--'}\n🌈 Hub Aura: ${config.mediaAura ? 'ON' : 'OFF'}\n🤖 Auto-Pilot: ${config.autoAc ? 'AC' : ''} ${config.autoLight ? 'LIGHT' : ''}`;
      await bot.sendMessage(chatId, dashboard, { parse_mode: 'Markdown' });
    }
  });

  bot.registerCommand({
    command: 'ac',
    description: 'AC: on|off|cool|dry|<temp>',
    handler: async (chatId, args) => {
      if (!authCheck(chatId)) return;
      const cmd = args[0];
      const deviceId = miraie?.devices[0]?.deviceId;
      if (!deviceId) return await bot.sendMessage(chatId, "❌ Miraie Offline");

      if (cmd === 'on') await miraie?.controlDevice(deviceId, { ps: 'on' });
      else if (cmd === 'off') await miraie?.controlDevice(deviceId, { ps: 'off' });
      else if (cmd === 'cool') await miraie?.controlDevice(deviceId, { acmd: 'cool' });
      else if (!isNaN(parseInt(cmd))) await miraie?.controlDevice(deviceId, { actmp: cmd });

      config.stats = config.stats || {};
      config.stats.ac = { ...config.stats.ac, status: cmd.toUpperCase(), lastChanged: new Date().toISOString() };
      saveConfig(config);
      await bot.sendMessage(chatId, `❄️ AC updated to: *${cmd.toUpperCase()}*`);
    }
  });

  bot.registerCommand({
    command: 'lights',
    description: 'Lights: on|off|<dim>|<color>',
    handler: async (chatId, args) => {
      if (!authCheck(chatId)) return;
      const cmd = args[0];
      if (cmd === 'on') await wiz?.executeAction({ type: 'control', payload: { state: true } });
      else if (cmd === 'off') await wiz?.executeAction({ type: 'control', payload: { state: false } });
      
      config.stats = config.stats || {};
      config.stats.light = { status: cmd.toUpperCase(), lastChanged: new Date().toISOString() };
      saveConfig(config);
      await bot.sendMessage(chatId, `💡 Lights: *${cmd.toUpperCase()}*`);
    }
  });

  bot.registerCommand({
    command: 'control',
    description: 'Manage Automation Settings',
    handler: async (chatId) => {
      if (!authCheck(chatId)) return;
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: `AC Auto: ${config.autoAc ? '✅' : '❌'}`, callback_data: 'toggle_auto_ac' }],
            [{ text: `Light Auto: ${config.autoLight ? '✅' : '❌'}`, callback_data: 'toggle_auto_light' }],
            [{ text: `Media Aura: ${config.mediaAura ? '✅' : '❌'}`, callback_data: 'toggle_aura' }]
          ]
        }
      };
      await bot.sendMessage(chatId, "🎛 *Automation Management*", opts);
    }
  });

  bot.onCallback = async (cb: any) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    if (data === 'toggle_auto_ac') config.autoAc = !config.autoAc;
    if (data === 'toggle_auto_light') config.autoLight = !config.autoLight;
    if (data === 'toggle_aura') config.mediaAura = !config.mediaAura;
    saveConfig(config);
    await bot.answerCallbackQuery(cb.id, "Setting Updated");
    // Trigger /control again to refresh UI
    const matched = bot.getHandlers().find(h => h.command === 'control');
    if (matched) await matched.handler(chatId, [], cb.message, (t) => bot.sendMessage(chatId, t));
  };

  // 🚀 MAIN API (Port 3030)
  try {
    (Bun as any).serve({
      port: 3030,
      async fetch(req: any) {
        const url = new URL(req.url);
        if (url.pathname === '/status') {
          return new Response(JSON.stringify(config.stats), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        return new Response("Gravity Hub Active (Port 3030)", { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    });
    console.log('🌐 Hub API (3030) Operational.');
  } catch(e) { console.warn('API 3030 error'); }

  bot.startPolling();

  const PLATFORM = os.platform() === 'darwin' ? 'Local Mac' : 'Remote Hub';
  const startTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  
  const ac = config.stats?.ac || { status: 'OFF' };
  const light = config.stats?.light || { status: 'OFF' };
  
  const startMsg = `🟢 *Gravity Hub: ONLINE*\n━━━━━━━━━━━━━━\n🏗 Platform: *${PLATFORM}*\n⏰ Started: *${startTime} IST*\n❄️ AC: *${ac.status}* (${getDuration(ac.lastChanged)}) | 💡 Light: *${light.status}* (${getDuration(light.lastChanged)})\n━━━━━━━━━━━━━━\nUse /help for commands.`;
  
  for (const userId of (config.authorizedUsers || [])) {
    try { bot.sendMessage(userId, startMsg, { parse_mode: 'Markdown' }); } catch {}
  }
  console.log(`🚀 Gravity Hub ONLINE [${PLATFORM}]. Polling started.`);

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
