/**
 * WiZ link catalog.
 *
 * Reads the JSON payload captured from the WiZ mobile app's
 * "Local Integrations → Get the link" feature. That link is a 15-min
 * S3 presigned URL pointing to a JSON with:
 *   - home_id, region, udp_signing_key
 *   - rooms[]  (id, name, type)
 *   - devices[] (id, mac, name, room_id, traits, fw_version)
 *
 * This file does NOT contain an API guide or SDK — the data alone is
 * the registration key. What we get out of it:
 *   1. A known list of device MACs (so LAN-discovered bulbs can be
 *      identified by their friendly name + room)
 *   2. Per-device traits (dimmable, color-capable, etc.)
 *   3. The home_id + region pair, useful for any future cloud work
 *
 * No public WiZ cloud API exists. The "signing key" is used by the
 * official mobile app for UDP+REST hybrid control, not exposed publicly.
 * So the practical use of this data is: enrich our local UDP control
 * with the device catalog.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import dgram from "dgram";

const DISCOVERY_TIMEOUT = 4000; // ms
const WIZ_DISCOVERY_PORT = 38899;
const DEFAULT_LINK_PATHS = [
  // Repo-local (gitignored)
  path.join(process.cwd(), "raycast-ext", ".secrets"),
  // User home
  path.join(os.homedir(), ".config", "raycast-ext", ".secrets"),
  path.join(os.homedir(), ".homepulse", "wiz"),
];

export interface WizLinkDevice {
  device_id: number;
  type: string;
  room_id: number | null;
  group_id: number | null;
  name: string;
  mac_address: string; // lower-case, no colons
  fw_version: string;
  traits: {
    is_dimmable?: boolean;
    is_tunable_white?: boolean;
    white_range?: [number, number];
    is_tunable_color?: boolean;
    supports_light_mode?: boolean;
  };
}

export interface WizLinkRoom {
  room_id: number;
  name: string;
  type: string;
}

export interface WizLinkFile {
  name: string;
  home_id: number;
  region: string;
  udp_signing_key: string;
  version: string;
  creation_date: string;
  update_date: string;
  rooms: WizLinkRoom[];
  devices: WizLinkDevice[];
}

let _cached: { link: WizLinkFile; path: string; loadedAt: number } | null = null;
const CACHE_TTL = 60_000; // 1 min

/**
 * Find the most recent wiz-link-*.json file in the known locations.
 */
function findLinkFile(): string | null {
  for (const dir of DEFAULT_LINK_PATHS) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs
        .readdirSync(dir)
        .filter((f) => /^wiz-link-\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort()
        .reverse();
      if (files.length > 0) {
        return path.join(dir, files[0]);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Load the WiZ link file. Cached for 1 min. Returns null if not found.
 */
export function loadWizLink(): WizLinkFile | null {
  if (_cached && Date.now() - _cached.loadedAt < CACHE_TTL) return _cached.link;
  const p = findLinkFile();
  if (!p) {
    _cached = null;
    return null;
  }
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw) as WizLinkFile;
    // Validate minimum shape
    if (!data.home_id || !Array.isArray(data.devices) || !data.udp_signing_key) {
      console.warn(`[WizLink] ${p} missing required fields`);
      _cached = null;
      return null;
    }
    _cached = { link: data, path: p, loadedAt: Date.now() };
    console.log(`[WizLink] loaded ${data.devices.length} device(s) from ${p}`);
    return data;
  } catch (e: any) {
    console.warn(`[WizLink] failed to load ${p}: ${e?.message || e}`);
    _cached = null;
    return null;
  }
}

/**
 * Get the path of the loaded link file (for debug / status).
 */
export function getWizLinkPath(): string | null {
  if (_cached) return _cached.path;
  return findLinkFile();
}

/**
 * Look up a device by MAC. Returns null if not in the link catalog.
 */
export function findDeviceByMac(mac: string): WizLinkDevice | null {
  const link = loadWizLink();
  if (!link) return null;
  const norm = mac.toLowerCase().replace(/:/g, "");
  return link.devices.find((d) => d.mac_address.toLowerCase() === norm) || null;
}

/**
 * Look up a room by id.
 */
export function findRoomById(roomId: number | null): WizLinkRoom | null {
  if (roomId == null) return null;
  const link = loadWizLink();
  if (!link) return null;
  return link.rooms.find((r) => r.room_id === roomId) || null;
}

/**
 * Find a device by friendly name (case-insensitive substring).
 */
export function findDeviceByName(name: string): WizLinkDevice | null {
  const link = loadWizLink();
  if (!link) return null;
  const q = name.toLowerCase();
  return (
    link.devices.find((d) => d.name.toLowerCase() === q) ||
    link.devices.find((d) => d.name.toLowerCase().includes(q)) ||
    null
  );
}

/**
 * Build a human-friendly label for a device: "Office · A70 12W"
 * Falls back to the raw device name if the room isn't known.
 */
export function deviceLabel(macOrName: string): string {
  const dev = findDeviceByMac(macOrName) || findDeviceByName(macOrName);
  if (!dev) return macOrName;
  const room = findRoomById(dev.room_id);
  return room ? `${room.name} · ${dev.name}` : dev.name;
}

// --- LAN discovery via UDP broadcast ---
// WiZ bulbs respond to a getPilot broadcast on port 38899 with their
// state. This lets us find their current IP even if DHCP changed it.

interface DiscoveredBulb {
  mac: string; // lower-case, no colons
  ip: string;
  rssi: number;
  state: boolean;
  sceneId: number;
  temp?: number;
  dimming?: number;
  r?: number; g?: number; b?: number;
  respondedAt: number;
}

let _discovered: DiscoveredBulb[] = [];
let _lastDiscovery: number = 0;
const DISCOVERY_CACHE_TTL = 30_000; // 30 sec

export async function discoverBulbs(timeoutMs = DISCOVERY_TIMEOUT): Promise<DiscoveredBulb[]> {
  if (Date.now() - _lastDiscovery < DISCOVERY_CACHE_TTL && _discovered.length > 0) {
    return _discovered;
  }
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const found = new Map<string, DiscoveredBulb>();
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      try { socket.close(); } catch {}
      _discovered = Array.from(found.values());
      _lastDiscovery = Date.now();
      resolve(_discovered);
    };
    socket.on("error", (e) => {
      console.warn(`[WizLink] discovery socket error: ${e.message}`);
      cleanup();
    });
    socket.on("message", (msg, rinfo) => {
      try {
        const m = JSON.parse(msg.toString());
        if (m?.result?.mac) {
          const mac = m.result.mac.toLowerCase();
          found.set(mac, {
            mac,
            ip: rinfo.address,
            rssi: m.result.rssi,
            state: m.result.state,
            sceneId: m.result.sceneId,
            temp: m.result.temp,
            dimming: m.result.dimming,
            r: m.result.r,
            g: m.result.g,
            b: m.result.b,
            respondedAt: Date.now(),
          });
        }
      } catch {
        // ignore
      }
    });
    socket.bind(WIZ_DISCOVERY_PORT, () => {
      try {
        socket.setBroadcast(true);
        const msg = Buffer.from(JSON.stringify({ method: "getPilot", params: {} }));
        socket.send(msg, 0, msg.length, WIZ_DISCOVERY_PORT, "255.255.255.255");
        // Also try the link's known devices directly (unicast)
        const link = loadWizLink();
        if (link) {
          for (const d of link.devices) {
            // Probe the last-known IP if we have it
            const lastIp = _discovered.find((b) => b.mac === d.mac_address)?.ip;
            if (lastIp) {
              socket.send(msg, 0, msg.length, WIZ_DISCOVERY_PORT, lastIp);
            }
          }
        }
      } catch (e) {
        console.warn(`[WizLink] broadcast send failed: ${(e as any).message}`);
      }
    });
    setTimeout(cleanup, timeoutMs);
  });
}

/**
 * Find the current IP for a MAC, first checking the link-catalog known
 * IPs (from prior discoveries / static config), then broadcasting.
 */
export async function findBulbIp(mac: string): Promise<string | null> {
  const norm = mac.toLowerCase().replace(/:/g, "");
  // Check cache
  const cached = _discovered.find((b) => b.mac === norm);
  if (cached && Date.now() - cached.respondedAt < DISCOVERY_CACHE_TTL) {
    return cached.ip;
  }
  // Trigger fresh discovery
  const bulbs = await discoverBulbs();
  const b = bulbs.find((x) => x.mac === norm);
  return b ? b.ip : null;
}

/**
 * Get the most recent cached discovery. Useful for status endpoints.
 */
export function getCachedDiscovery(): DiscoveredBulb[] {
  return _discovered;
}

export function getLastDiscoveryTime(): number {
  return _lastDiscovery;
}
