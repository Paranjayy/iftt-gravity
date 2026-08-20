import { CommandHandler } from './adapters/telegram';
import { HomeAssistantAdapter, HAEntityState } from './adapters/homeassistant';

function getAdapter(): HomeAssistantAdapter | null {
  return (global as any).haAdapter || null;
}

function stateIcon(state: string): string {
  const icons: Record<string, string> = {
    on: '🟢', off: '🔴', open: '🟢', closed: '🔴',
    playing: '▶️', paused: '⏸️', idle: '⏹️',
    cool: '❄️', heat: '🔥', auto: '🤖', dry: '💨',
    unavailable: '⚠️', unknown: '❓',
  };
  return icons[state] || '•';
}

function fmtTemp(temp: any): string {
  return temp !== undefined ? `${temp}°` : '?';
}

function fmtBrightness(level: any): string {
  if (level === undefined) return '';
  const pct = Math.round((level / 255) * 100);
  return `${pct}%`;
}

// ── /ha ──────────────────────────────────────────────────────

export const haCommand: CommandHandler = {
  command: 'ha',
  description: '🏠 Home Assistant — entity overview',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha || !ha.isConnected()) {
      return send('❌ Home Assistant not connected. Check `config.json` → `homeAssistant`.');
    }

    const counts = ha.getDomainCounts();
    const lines: string[] = [`*🏠 Home Assistant*\n_${ha.getEntityCount()} entities_\n`];

    const domainLabels: Record<string, string> = {
      light: '💡 Lights',
      climate: '❄️ Climate',
      switch: '🔘 Switches',
      sensor: '📊 Sensors',
      media_player: '📺 Media',
      cover: '🪟 Covers',
      binary_sensor: '📡 Binary Sensors',
      automation: '🤖 Automations',
      scene: '🎬 Scenes',
      script: '📜 Scripts',
      input_boolean: '🔘 Input Booleans',
      input_number: '🔢 Input Numbers',
      fan: '🌀 Fans',
    };

    for (const [domain, count] of Object.entries(counts).sort()) {
      const label = domainLabels[domain] || `📦 ${domain}`;
      lines.push(`${label}: ${count}`);
    }

    await send(lines.join('\n'));
  },
};

// ── /ha_lights ───────────────────────────────────────────────

export const haLightsCommand: CommandHandler = {
  command: 'ha_lights',
  description: '💡 HA lights — list & control',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha || !ha.isConnected()) return send('❌ HA not connected');

    const lights = ha.getStatesByDomain('light');
    if (lights.length === 0) return send('💡 No HA lights found');

    if (args.length >= 2) {
      // /ha_light <name> on/off/brightness
      const nameQuery = args[0];
      const cmd = args[1];
      const light = lights.find(l =>
        (l.attributes.friendly_name || l.entity_id).toLowerCase().includes(nameQuery.toLowerCase())
      );
      if (!light) return send(`❌ Light "${nameQuery}" not found`);

      try {
        if (cmd === 'on') await ha.turnOn(light.entity_id);
        else if (cmd === 'off') await ha.turnOff(light.entity_id);
        else if (cmd === 'toggle') await ha.toggle(light.entity_id);
        else if (!isNaN(Number(cmd))) {
          await ha.setLightBrightness(light.entity_id, Number(cmd));
        } else {
          return send(`Usage: /ha_light <name> on|off|toggle|<brightness 0-100>`);
        }
        const name = light.attributes.friendly_name || light.entity_id;
        await send(`✅ ${name}: ${cmd}`);
      } catch (e: any) {
        await send(`❌ Error: ${e.message}`);
      }
      return;
    }

    // List all lights
    const lines = lights.map(l => {
      const name = l.attributes.friendly_name || l.entity_id;
      const icon = stateIcon(l.state);
      const brightness = fmtBrightness(l.attributes.brightness);
      const temp = l.attributes.color_temp ? `${l.attributes.color_temp}K` : '';
      const extra = [brightness, temp].filter(Boolean).join(', ');
      return `${icon} *${name}* — ${l.state}${extra ? ` (${extra})` : ''}`;
    });

    await send(`*💡 HA Lights*\n\n${lines.join('\n')}\n\n_Control: /ha_light <name> on|off|toggle|<0-100>_`);
  },
};

// ── /ha_ac ───────────────────────────────────────────────────

export const haAcCommand: CommandHandler = {
  command: 'ha_ac',
  description: '❄️ HA climate — list & control',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha || !ha.isConnected()) return send('❌ HA not connected');

    const climates = ha.getStatesByDomain('climate');
    if (climates.length === 0) return send('❄️ No HA climate entities found');

    if (args.length >= 2) {
      const nameQuery = args[0];
      const cmd = args[1];
      const climate = climates.find(c =>
        (c.attributes.friendly_name || c.entity_id).toLowerCase().includes(nameQuery.toLowerCase())
      );
      if (!climate) return send(`❌ Climate "${nameQuery}" not found`);

      try {
        if (cmd === 'on') await ha.turnOn(climate.entity_id);
        else if (cmd === 'off') await ha.turnOff(climate.entity_id);
        else if (!isNaN(Number(cmd))) {
          await ha.setClimateTemp(climate.entity_id, Number(cmd));
        } else {
          // Mode: cool, heat, auto, dry, fan_only
          await ha.setClimateMode(climate.entity_id, cmd.toLowerCase());
        }
        const name = climate.attributes.friendly_name || climate.entity_id;
        await send(`✅ ${name}: ${cmd}`);
      } catch (e: any) {
        await send(`❌ Error: ${e.message}`);
      }
      return;
    }

    const lines = climates.map(c => {
      const name = c.attributes.friendly_name || c.entity_id;
      const icon = stateIcon(c.state);
      const temp = fmtTemp(c.attributes.current_temperature);
      const target = fmtTemp(c.attributes.temperature);
      const mode = c.state !== 'off' ? c.state : '';
      return `${icon} *${name}*\n   ${temp} → ${target} ${mode ? `(${mode})` : ''}`;
    });

    await send(`*❄️ HA Climate*\n\n${lines.join('\n\n')}\n\n_Control: /ha_ac <name> on|off|<temp>|cool|heat|auto|dry>_`);
  },
};

// ── /ha_switch ───────────────────────────────────────────────

export const haSwitchCommand: CommandHandler = {
  command: 'ha_switch',
  description: '🔘 HA switches — toggle',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha || !ha.isConnected()) return send('❌ HA not connected');

    const switches = [
      ...ha.getStatesByDomain('switch'),
      ...ha.getStatesByDomain('input_boolean'),
    ];

    if (args.length >= 1) {
      const nameQuery = args[0];
      const cmd = args[1] || 'toggle';
      const sw = switches.find(s =>
        (s.attributes.friendly_name || s.entity_id).toLowerCase().includes(nameQuery.toLowerCase())
      );
      if (!sw) return send(`❌ Switch "${nameQuery}" not found`);

      try {
        if (cmd === 'on') await ha.turnOn(sw.entity_id);
        else if (cmd === 'off') await ha.turnOff(sw.entity_id);
        else await ha.toggle(sw.entity_id);
        const name = sw.attributes.friendly_name || sw.entity_id;
        await send(`✅ ${name}: toggled`);
      } catch (e: any) {
        await send(`❌ Error: ${e.message}`);
      }
      return;
    }

    const lines = switches.map(s => {
      const name = s.attributes.friendly_name || s.entity_id;
      const icon = stateIcon(s.state);
      return `${icon} *${name}* — ${s.state}`;
    });

    await send(`*🔘 HA Switches*\n\n${lines.join('\n')}\n\n_Toggle: /ha_switch <name> [on|off|toggle]_`);
  },
};

// ── /ha_cover ────────────────────────────────────────────────

export const haCoverCommand: CommandHandler = {
  command: 'ha_cover',
  description: '🪟 HA covers — open/close/stop',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha || !ha.isConnected()) return send('❌ HA not connected');

    const covers = ha.getStatesByDomain('cover');
    if (covers.length === 0) return send('🪟 No HA covers found');

    if (args.length >= 1) {
      const nameQuery = args[0];
      const cmd = args[1] || 'toggle';
      const cover = covers.find(c =>
        (c.attributes.friendly_name || c.entity_id).toLowerCase().includes(nameQuery.toLowerCase())
      );
      if (!cover) return send(`❌ Cover "${nameQuery}" not found`);

      try {
        if (cmd === 'open') await ha.coverOpen(cover.entity_id);
        else if (cmd === 'close') await ha.coverClose(cover.entity_id);
        else if (cmd === 'stop') await ha.coverStop(cover.entity_id);
        else if (!isNaN(Number(cmd))) await ha.setCoverPosition(cover.entity_id, Number(cmd));
        else await ha.toggle(cover.entity_id);
        const name = cover.attributes.friendly_name || cover.entity_id;
        await send(`✅ ${name}: ${cmd}`);
      } catch (e: any) {
        await send(`❌ Error: ${e.message}`);
      }
      return;
    }

    const lines = covers.map(c => {
      const name = c.attributes.friendly_name || c.entity_id;
      const icon = stateIcon(c.state);
      const pos = c.attributes.current_position !== undefined ? `${c.attributes.current_position}%` : '';
      return `${icon} *${name}* — ${c.state}${pos ? ` (${pos})` : ''}`;
    });

    await send(`*🪟 HA Covers*\n\n${lines.join('\n')}\n\n_Control: /ha_cover <name> open|close|stop|<0-100>_`);
  },
};

// ── /ha_media ────────────────────────────────────────────────

export const haMediaCommand: CommandHandler = {
  command: 'ha_media',
  description: '📺 HA media players — control',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha || !ha.isConnected()) return send('❌ HA not connected');

    const players = ha.getStatesByDomain('media_player');
    if (players.length === 0) return send('📺 No HA media players found');

    if (args.length >= 1) {
      const nameQuery = args[0];
      const cmd = args[1] || 'toggle';
      const player = players.find(p =>
        (p.attributes.friendly_name || p.entity_id).toLowerCase().includes(nameQuery.toLowerCase())
      );
      if (!player) return send(`❌ Media player "${nameQuery}" not found`);

      try {
        if (cmd === 'on') await ha.turnOn(player.entity_id);
        else if (cmd === 'off') await ha.turnOff(player.entity_id);
        else if (cmd === 'play' || cmd === 'pause') await ha.mediaPlayPause(player.entity_id);
        else if (cmd === 'next') await ha.mediaNext(player.entity_id);
        else if (cmd === 'prev') await ha.mediaPrevious(player.entity_id);
        else if (!isNaN(Number(cmd))) await ha.setMediaPlayerVolume(player.entity_id, Number(cmd));
        else await ha.toggle(player.entity_id);
        const name = player.attributes.friendly_name || player.entity_id;
        await send(`✅ ${name}: ${cmd}`);
      } catch (e: any) {
        await send(`❌ Error: ${e.message}`);
      }
      return;
    }

    const lines = players.map(p => {
      const name = p.attributes.friendly_name || p.entity_id;
      const icon = stateIcon(p.state);
      const vol = p.attributes.volume_level !== undefined
        ? `Vol ${Math.round(p.attributes.volume_level * 100)}%`
        : '';
      const source = p.attributes.source || '';
      return `${icon} *${name}* — ${p.state}\n   ${[vol, source].filter(Boolean).join(' | ')}`;
    });

    await send(`*📺 HA Media Players*\n\n${lines.join('\n\n')}\n\n_Control: /ha_media <name> on|off|play|next|prev|<volume 0-100>_`);
  },
};

// ── /ha_sensors ──────────────────────────────────────────────

export const haSensorsCommand: CommandHandler = {
  command: 'ha_sensors',
  description: '📊 HA sensors — read all',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha || !ha.isConnected()) return send('❌ HA not connected');

    const sensors = [
      ...ha.getStatesByDomain('sensor'),
      ...ha.getStatesByDomain('binary_sensor'),
    ];

    if (sensors.length === 0) return send('📊 No HA sensors found');

    // Group by area/device
    const grouped = new Map<string, HAEntityState[]>();
    for (const s of sensors) {
      const area = s.attributes.device_class || s.entity_id.split('.')[0];
      if (!grouped.has(area)) grouped.set(area, []);
      grouped.get(area)!.push(s);
    }

    const lines: string[] = [`*📊 HA Sensors (${sensors.length})*\n`];

    for (const [area, entities] of grouped) {
      lines.push(`*${area.toUpperCase()}*`);
      for (const s of entities.slice(0, 10)) {
        const name = s.attributes.friendly_name || s.entity_id;
        const unit = s.attributes.unit_of_measurement || '';
        lines.push(`  • ${name}: ${s.state}${unit ? ` ${unit}` : ''}`);
      }
      if (entities.length > 10) lines.push(`  _...and ${entities.length - 10} more_`);
      lines.push('');
    }

    await send(lines.join('\n'));
  },
};

// ── /ha_sync ─────────────────────────────────────────────────

export const haSyncCommand: CommandHandler = {
  command: 'ha_sync',
  description: '🔄 Force re-sync all HA entities',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha || !ha.isConnected()) return send('❌ HA not connected');

    await send('🔄 Re-syncing HA entities...');
    await ha.fetchAllStates();
    const count = ha.getEntityCount();
    await send(`✅ Synced ${count} entities from Home Assistant`);
  },
};

// ── /ha_status ───────────────────────────────────────────────

export const haStatusCommand: CommandHandler = {
  command: 'ha_status',
  description: '📡 HA connection status',
  handler: async (chatId, args, msg, send) => {
    const ha = getAdapter();
    if (!ha) {
      return send('📡 *HA Status:* Not configured\n\nAdd `homeAssistant` section to `config.json`.');
    }

    const connected = ha.isConnected();
    const count = ha.getEntityCount();
    const counts = ha.getDomainCounts();

    const lines = [
      `📡 *Home Assistant Status*`,
      '',
      `Connection: ${connected ? '✅ Connected' : '❌ Disconnected'}`,
      `Entities: ${count}`,
      '',
      `*By domain:*`,
    ];

    for (const [domain, n] of Object.entries(counts).sort()) {
      lines.push(`  ${domain}: ${n}`);
    }

    await send(lines.join('\n'));
  },
};

// ── /ha_help ─────────────────────────────────────────────────

export const haHelpCommand: CommandHandler = {
  command: 'ha_help',
  description: '❓ HA commands help',
  handler: async (chatId, args, msg, send) => {
    await send(
      `*🏠 Home Assistant Commands*\n\n` +
      `/ha — Entity overview\n` +
      `/ha_lights — List HA lights\n` +
      `/ha_light <name> on|off|toggle|<0-100> — Control light\n` +
      `/ha_ac — List climate entities\n` +
      `/ha_ac <name> on|off|<temp>|cool|heat|auto — Control AC\n` +
      `/ha_switch — List switches\n` +
      `/ha_switch <name> [on|off] — Toggle switch\n` +
      `/ha_cover — List covers\n` +
      `/ha_cover <name> open|close|stop|<0-100> — Control cover\n` +
      `/ha_media — List media players\n` +
      `/ha_media <name> on|off|play|next|<vol> — Control player\n` +
      `/ha_sensors — Show all sensor readings\n` +
      `/ha_sync — Force re-sync entities\n` +
      `/ha_status — Connection status\n` +
      `/ha_help — This help`
    );
  },
};

export const haCommands: CommandHandler[] = [
  haCommand,
  haLightsCommand,
  haAcCommand,
  haSwitchCommand,
  haCoverCommand,
  haMediaCommand,
  haSensorsCommand,
  haSyncCommand,
  haStatusCommand,
  haHelpCommand,
];
