/**
 * WiZ Registry — multi-bulb adapter that uses the link catalog + LAN
 * discovery to find and control all known WiZ bulbs.
 *
 * This is the NEW preferred adapter. The single-IP `WizAdapter` is
 * kept for backward compat but `WizRegistry` is what the bot uses
 * when the link JSON is present.
 *
 * Per-bulb state is tracked in memory and refreshed by the discovery
 * loop (every 30s). The /status endpoint reports per-bulb state.
 */

import { Device, Action } from '../types';
import {
  loadWizLink,
  findDeviceByMac,
  findRoomById,
  deviceLabel,
  discoverBulbs,
  findBulbIp,
  WizLinkDevice,
} from './wiz-link';
import dgram from 'dgram';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { networkInterfaces } from 'os';

const WIZ_PORT = 38899;
const DEFAULT_DISCOVERY_INTERVAL = 30_000; // 30s
const COMMAND_TIMEOUT = 3000; // 3s
const execFileAsync = promisify(execFile);

/**
 * WiZ commands are unicast LAN UDP. On macOS an unspecified UDP bind may use
 * a stale/default interface, while binding to the Wi-Fi address works
 * reliably. Prefer an IPv4 address in the bulb's subnet, then any active LAN
 * IPv4 address as a reasonable fallback.
 */
function localAddressFor(ip: string): string | undefined {
  const subnet = ip.split('.').slice(0, 3).join('.');
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry && entry.family === 'IPv4' && !entry.internal))
    .map((entry) => entry.address);
  return addresses.find((address) => address.startsWith(`${subnet}.`)) || addresses[0];
}

/**
 * macOS occasionally leaves a long-running LaunchAgent's UDP socket on a
 * stale route even though a fresh process can immediately reach the bulb.
 * This is a last-resort transport fallback, not the normal control path.
 */
async function sendFromFreshProcess(ip: string, message: object): Promise<void> {
  const encoded = Buffer.from(JSON.stringify(message)).toString('base64');
  const localAddress = localAddressFor(ip) || '';
  const program = [
    "const d=require('dgram');",
    "const [ip,payload,address]=process.argv.slice(-3);",
    "const s=d.createSocket('udp4');",
    "const done=(e)=>{try{s.close()}catch{};if(e){console.error(e.message);process.exit(1)}process.exit(0)};",
    "s.bind(0,address||undefined,()=>s.send(Buffer.from(payload,'base64'),38899,ip,done));",
  ].join('');
  await execFileAsync(process.execPath, ['-e', program, '--', ip, encoded, localAddress], { timeout: COMMAND_TIMEOUT });
}

function sendUDP(ip: string, message: object, expectResponse = false, timeoutMs = COMMAND_TIMEOUT): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const buf = Buffer.from(JSON.stringify(message));
    let sent = false;
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      if (expectResponse) reject(new Error(`WiZ UDP timeout — is ${ip} on the same network?`));
      else resolve(null);
    }, timeoutMs);
    if (expectResponse) {
      socket.on('message', (msg) => {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        try { resolve(JSON.parse(msg.toString())); }
        catch { resolve(msg.toString()); }
      });
    }
    // On macOS/Bun, an unbound UDP command socket can intermittently select
    // a stale route and throw EHOSTUNREACH while discovery still works. Bind
    // an ephemeral local port first, like the working discovery socket does.
    socket.bind(0, localAddressFor(ip), () => {
      if (sent) return;
      sent = true;
      socket.send(buf, 0, buf.length, WIZ_PORT, ip, (err) => {
        if (err) {
          clearTimeout(timer);
          try { socket.close(); } catch {}
          reject(err);
          return;
        }
        if (!expectResponse) {
          clearTimeout(timer);
          try { socket.close(); } catch {}
          resolve(null);
        }
      });
    });
  });
}

export interface BulbState {
  mac: string;
  name: string; // friendly: "Office · A70 12W"
  ip: string | null;
  online: boolean;
  state: boolean | null; // on/off
  sceneId: number | null;
  dimming: number | null;
  temp: number | null;
  r: number | null;
  g: number | null;
  b: number | null;
  c: number | null;
  w: number | null;
  speed: number | null;
  rssi: number | null;
  lastSeen: number; // ms epoch
  traits: WizLinkDevice['traits'] | null;
}

/** A locally configured bulb. This keeps WiZ usable even when the temporary
 * mobile-app link export has expired or was never captured. */
export interface ManualWizBulb {
  ip: string;
  mac?: string;
  name?: string;
}

export class WizRegistry {
  name = 'Philips WiZ (multi-bulb)';
  private bulbs = new Map<string, BulbState>(); // keyed by lower-case mac
  private lastDiscoveryAt = 0;
  private discoveryTimer: NodeJS.Timeout | null = null;
  private commandQueues = new Map<string, Promise<unknown>>();

  constructor(private readonly manualBulbs: ManualWizBulb[] = []) {}

  /** Expose last-discovery timestamp (read-only) for status endpoints. */
  getLastDiscoveryTime(): number { return this.lastDiscoveryAt; }

  /** Initialize by loading the link + doing first discovery. */
  async initialize(): Promise<void> {
    const link = loadWizLink();
    if (!link && this.manualBulbs.length === 0) {
      console.warn('💡 Wiz: no link file or manually configured bulbs found');
      return;
    }

    const seeds = link
      ? link.devices.map((d) => ({
          mac: d.mac_address,
          name: deviceLabel(d.mac_address),
          ip: null as string | null,
          traits: d.traits,
        }))
      : this.manualBulbs.map((d, index) => ({
          // A MAC is strongly preferred for discovery. The deterministic
          // fallback still gives a static-IP bulb a stable identity.
          mac: (d.mac || `manual-${index}-${d.ip}`).toLowerCase().replace(/:/g, ''),
          name: d.name || `WiZ bulb ${index + 1}`,
          ip: d.ip,
          traits: null,
        }));

    for (const d of seeds) {
      const mac = d.mac.toLowerCase().replace(/:/g, '');
      this.bulbs.set(mac, {
        mac,
        name: d.name,
        ip: d.ip,
        online: false,
        state: null,
        sceneId: null,
        dimming: null,
        temp: null,
        r: null,
        g: null,
        b: null,
        c: null,
        w: null,
        speed: null,
        rssi: null,
        lastSeen: 0,
        traits: d.traits,
      });
    }
    console.log(`💡 Wiz: ${this.bulbs.size} bulb(s) registered from ${link ? 'link catalog' : 'local config'}`);
    await this.refresh();
    // Start background discovery
    if (this.discoveryTimer) clearInterval(this.discoveryTimer);
    this.discoveryTimer = setInterval(() => {
      this.refresh().catch((e) => console.warn(`💡 Wiz: refresh failed: ${e.message}`));
    }, DEFAULT_DISCOVERY_INTERVAL);
  }

  /** Refresh state via discovery + unicast to each known bulb. */
  async refresh(): Promise<void> {
    const discovered = await discoverBulbs();
    for (const bulb of this.bulbs.values()) {
      const mac = bulb.mac;
      const found = discovered.find((x) => x.mac === mac);
      if (found) {
        bulb.ip = found.ip;
        bulb.online = true;
        bulb.state = found.state;
        bulb.sceneId = found.sceneId;
        bulb.dimming = found.dimming ?? null;
        bulb.temp = found.temp ?? null;
        bulb.r = found.r ?? null;
        bulb.g = found.g ?? null;
        bulb.b = found.b ?? null;
        bulb.c = found.c ?? null;
        bulb.w = found.w ?? null;
        bulb.speed = found.speed ?? null;
        bulb.rssi = found.rssi;
        bulb.lastSeen = found.respondedAt;
      } else {
        // Try unicast to last-known IP
        if (bulb.ip) {
          try {
            const pilot = await sendUDP(bulb.ip, { method: 'getPilot', params: {} }, true, COMMAND_TIMEOUT);
            const r = pilot?.result;
            if (r?.mac?.toLowerCase() === mac) {
              bulb.online = true;
              bulb.state = r.state;
              bulb.sceneId = r.sceneId;
              bulb.dimming = r.dimming ?? null;
              bulb.temp = r.temp ?? null;
              bulb.r = r.r ?? null;
              bulb.g = r.g ?? null;
              bulb.b = r.b ?? null;
              bulb.c = r.c ?? null;
              bulb.w = r.w ?? null;
              bulb.speed = r.speed ?? null;
              bulb.rssi = r.rssi ?? null;
              bulb.lastSeen = Date.now();
            } else {
              bulb.online = false;
            }
          } catch {
            bulb.online = false;
          }
        } else {
          bulb.online = false;
        }
      }
    }
    this.lastDiscoveryAt = Date.now();
  }

  /** Return all known bulbs and their current state. */
  getAll(): BulbState[] {
    return Array.from(this.bulbs.values());
  }

  /** Get one bulb's state by MAC or friendly name. */
  find(query: string): BulbState | null {
    const q = query.toLowerCase();
    for (const b of this.bulbs.values()) {
      if (b.mac === q) return b;
      if (b.name.toLowerCase() === q) return b;
    }
    for (const b of this.bulbs.values()) {
      if (b.name.toLowerCase().includes(q) || b.mac.includes(q.replace(/:/g, ''))) return b;
    }
    return null;
  }

  /** Convert to the unified Device[] shape for /status. */
  async getDevices(): Promise<Device[]> {
    return this.getAll().map((b) => ({
      id: `wiz-${b.mac}`,
      name: b.name,
      type: 'light' as const,
      status: b.online ? (b.state ? 'active' as const : 'online' as const) : 'offline' as const,
      lastSeen: new Date(b.lastSeen || Date.now()),
    }));
  }

  /** Send a pilot command to a specific bulb by MAC or name. */
  async setPilot(query: string, params: any): Promise<void> {
    const key = this.find(query)?.mac || query.toLowerCase();
    const previous = this.commandQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => undefined).then(() => this.setPilotNow(query, params));
    this.commandQueues.set(key, current);
    try {
      await current;
    } finally {
      if (this.commandQueues.get(key) === current) this.commandQueues.delete(key);
    }
  }

  /** The non-concurrent command path. Use setPilot() to serialize callers. */
  private async setPilotNow(query: string, params: any): Promise<void> {
    const bulb = this.find(query);
    if (!bulb) throw new Error(`No WiZ bulb matching "${query}"`);
    if (!bulb.ip) {
      // Try to discover it
      const ip = await findBulbIp(bulb.mac);
      if (!ip) throw new Error(`WiZ bulb ${bulb.name} is unreachable (no IP)`);
      bulb.ip = ip;
    }
    const payload: any = { method: 'setPilot', params: {} };
    if (params.state !== undefined) payload.params.state = params.state;
    if (params.dimming !== undefined) payload.params.dimming = Math.min(100, Math.max(0, params.dimming));
    if (params.r !== undefined) { payload.params.r = params.r; payload.params.g = params.g; payload.params.b = params.b; }
    if (params.temp !== undefined) payload.params.temp = Math.min(6500, Math.max(2200, params.temp));
    if (params.sceneId !== undefined) payload.params.sceneId = params.sceneId;
    if (params.speed !== undefined) payload.params.speed = params.speed;
    if (params.c !== undefined) payload.params.c = params.c;
    if (params.w !== undefined) payload.params.w = params.w;
    try {
      await sendUDP(bulb.ip, payload, false);
    } catch (error: any) {
      // A fresh discovery repairs DHCP/route churn. Retry exactly once so a
      // scene remains responsive and a persistent failure is still surfaced.
      if (error?.code !== 'EHOSTUNREACH') throw error;
      await this.refresh();
      const refreshed = this.find(query);
      if (!refreshed?.ip) throw error;
      try {
        await sendUDP(refreshed.ip, payload, false);
      } catch (retryError: any) {
        if (retryError?.code !== 'EHOSTUNREACH') throw retryError;
        await sendFromFreshProcess(refreshed.ip, payload);
      }
    }
    bulb.lastSeen = Date.now();
    // Optimistic update: assume the command succeeded
    if (params.state !== undefined) bulb.state = params.state;
    if (params.dimming !== undefined) bulb.dimming = params.dimming;
    if (params.r !== undefined) { bulb.r = params.r; bulb.g = params.g; bulb.b = params.b; }
    if (params.temp !== undefined) bulb.temp = params.temp;
    if (params.sceneId !== undefined) bulb.sceneId = params.sceneId;
    if (params.speed !== undefined) bulb.speed = params.speed;
    if (params.c !== undefined) bulb.c = params.c;
    if (params.w !== undefined) bulb.w = params.w;
  }

  async turnOn(query: string) { return this.setPilot(query, { state: true }); }
  async turnOff(query: string) { return this.setPilot(query, { state: false }); }
  async setBrightness(query: string, pct: number) { return this.setPilot(query, { state: pct > 0, dimming: pct }); }
  async setColor(query: string, r: number, g: number, b: number) { return this.setPilot(query, { state: true, r, g, b }); }
  async setWhite(query: string, temp: number) { return this.setPilot(query, { state: true, temp }); }

  /**
   * Legacy single-bulb interface — returns the pilot of the FIRST
   * known bulb. Used by the existing posture/hydration pulse effects.
   * The first bulb is the one with the lowest MAC (stable order).
   */
  async getPilot(): Promise<any | null> {
    const first = this.getAll()[0];
    if (!first || !first.ip) return null;
    try {
      const res = await sendUDP(first.ip, { method: 'getPilot', params: {} }, true);
      return res?.result || null;
    } catch {
      return null;
    }
  }

  /** Pulse the first bulb (legacy compatibility for posture/hydration). */
  async pulseFirst(dimming: number, durationMs: number, color?: { r: number; g: number; b: number }) {
    const first = this.getAll()[0];
    if (!first) return;
    return this.pulseLight(first.mac, dimming, durationMs, color);
  }

  /**
   * Pulse ALL online bulbs in parallel. Best-effort: bulbs that fail
   * are silently skipped. Returns count of bulbs pulsed.
   */
  async pulseAll(dimming: number, durationMs: number, color?: { r: number; g: number; b: number }): Promise<number> {
    const all = this.getAll().filter((b) => b.online && b.ip);
    if (all.length === 0) return 0;
    const results = await Promise.allSettled(
      all.map((b) => this.pulseLight(b.mac, dimming, durationMs, color)),
    );
    return results.filter((r) => r.status === 'fulfilled').length;
  }

  async pulseLight(query: string, dimming = 100, durationMs = 2000, color?: { r: number; g: number; b: number }) {
    // Pulse: turn on, full brightness (or color), hold, then restore
    const bulb = this.find(query);
    if (!bulb) return;
    const wasOn = bulb.state;
    const prevDimming = bulb.dimming;
    const prevColor = bulb.r !== undefined && bulb.g !== undefined && bulb.b !== undefined
      ? { r: bulb.r, g: bulb.g, b: bulb.b } : null;
    try {
      if (color) {
        await this.setPilot(query, { state: true, dimming, r: color.r, g: color.g, b: color.b });
      } else {
        await this.setPilot(query, { state: true, dimming });
      }
    } catch (e) {
      // best-effort, swallow
    }
    setTimeout(async () => {
      try {
        if (wasOn && prevDimming !== null) {
          await this.setPilot(query, { state: true, dimming: prevDimming });
        } else {
          await this.setPilot(query, { state: false });
        }
        if (prevColor && color) {
          await this.setPilot(query, { state: true, dimming: prevDimming ?? 100, r: prevColor.r, g: prevColor.g, b: prevColor.b });
        }
      } catch {
        // best-effort restore
      }
    }, durationMs);
  }



  /** Execute a generic Action (compatibility with Adapter interface). */
  async executeAction(action: Action): Promise<void> {
    const p = action.payload;
    // Older scene code did not provide a device ID and used the conceptual
    // “first bulb”. Resolve that intent here instead of passing the literal
    // string to find(), which made TV mode and other scenes fail.
    const target = action.deviceId || this.getAll().find((bulb) => bulb.online)?.mac || this.getAll()[0]?.mac;
    if (!target) throw new Error('No WiZ bulbs are configured');
    const params: any = {};
    if (p.state !== undefined) params.state = p.state;
    if (p.dimming !== undefined || p.brightness !== undefined) params.dimming = p.dimming ?? p.brightness;
    if (p.r !== undefined) { params.r = p.r; params.g = p.g; params.b = p.b; }
    if (p.temp !== undefined) params.temp = p.temp;
    if (p.sceneId !== undefined) params.sceneId = p.sceneId;
    if (p.scene) {
      // map scene name to id
      // Import from wiz.ts for consistency
      const SCENES: Record<string, number> = {
        'Cozy': 6, 'Warm White': 11, 'Daylight': 12, 'Cool White': 13,
        'Night Light': 13, 'Focus': 14, 'Relax': 15, 'True colors': 17,
        'TV time': 18, 'Plantgrowth': 19,
        'Ocean': 1, 'Romance': 2, 'Sunset': 3, 'Party': 4, 'Fireplace': 5,
        'Forest': 7, 'Pastel': 8, 'Spring': 20, 'Summer': 21, 'Fall': 22,
        'Deepdive': 23, 'Jungle': 24, 'Mojito': 25, 'Club': 26,
        'Christmas': 27, 'Halloween': 28, 'Candlelight': 29,
        'Golden white': 30, 'Pulse': 31, 'Steampunk': 32,
        'Wake Up': 9, 'Bedtime': 10,
      };
      const id = SCENES[p.scene];
      if (id) params.sceneId = id;
    }
    if (Object.keys(params).length === 0) {
      // Default: toggle
      const bulb = this.find(target);
      if (bulb?.state === true) await this.turnOff(target);
      else await this.turnOn(target);
      return;
    }
    await this.setPilot(target, params);
  }
}
