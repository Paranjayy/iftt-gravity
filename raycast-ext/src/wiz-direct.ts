import dgram from "node:dgram";
import { networkInterfaces } from "node:os";

export type WizDevice = { ip?: string | null; online?: boolean; mac?: string | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function localAddressFor(ip: string): string | undefined {
  const subnet = ip.split(".").slice(0, 3).join(".");
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry && entry.family === "IPv4" && !entry.internal))
    .map((entry) => entry.address);
  return addresses.find((address) => address.startsWith(`${subnet}.`)) || addresses[0];
}

/** Directed broadcast per interface + global. Directed ones follow the routing
 *  table, so they survive VPN/tunnel interfaces that swallow 255.255.255.255. */
function broadcastTargets(): string[] {
  const targets = new Set<string>(["255.255.255.255"]);
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      const ip = net.address.split(".").map(Number);
      const mask = net.netmask.split(".").map(Number);
      if (ip.length !== 4 || mask.length !== 4) continue;
      targets.add(ip.map((octet, i) => octet | (~mask[i] & 0xff)).join("."));
    }
  }
  return [...targets];
}

function isUnreachable(error: unknown): boolean {
  const err = error as NodeJS.ErrnoException;
  const msg = String(err?.message || error || "");
  return err?.code === "EHOSTUNREACH" || err?.code === "ENETUNREACH" ||
    msg.includes("EHOSTUNREACH") || msg.includes("ENETUNREACH") || msg.includes("timed out");
}

/** Send WiZ LAN UDP from Raycast's interactive process, not the background hub. */
export async function sendWizPilot(ip: string, params: Record<string, unknown>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("WiZ command timed out"));
    }, 3_000);
    socket.bind(0, localAddressFor(ip), () => {
      socket.send(Buffer.from(JSON.stringify({ method: "setPilot", params })), 38899, ip, (error) => {
        clearTimeout(timer);
        socket.close();
        if (error) reject(error);
        else resolve();
      });
    });
  });
}

/** Read the live pilot state. 1s timeout — fast on LAN, fast-fail on dead IP. */
export async function getWizPilot(ip: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("WiZ status timed out"));
    }, 1_000);
    socket.on("message", (message) => {
      clearTimeout(timer);
      socket.close();
      try {
        resolve((JSON.parse(message.toString())?.result || {}) as Record<string, unknown>);
      } catch {
        reject(new Error("WiZ returned invalid status"));
      }
    });
    socket.bind(0, localAddressFor(ip), () => {
      socket.send(Buffer.from(JSON.stringify({ method: "getPilot", params: {} })), 38899, ip, (error) => {
        if (error) {
          clearTimeout(timer);
          socket.close();
          reject(error);
        }
      });
    });
  });
}

/** Find bulbs on the LAN via getPilot broadcast. Returns live ip + mac pairs. */
export async function discoverWizLan(timeoutMs = 1_200): Promise<{ mac: string | null; ip: string }[]> {
  return new Promise((resolve) => {
    const found = new Map<string, { mac: string | null; ip: string }>();
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const finish = () => {
      try { socket.close(); } catch { /* already closed */ }
      resolve([...found.values()]);
    };
    const timer = setTimeout(finish, timeoutMs);
    socket.on("error", () => { clearTimeout(timer); finish(); });
    socket.on("message", (message, rinfo) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed?.result?.mac) {
          found.set(rinfo.address, { mac: String(parsed.result.mac).toLowerCase(), ip: rinfo.address });
        }
      } catch { /* ignore non-JSON */ }
    });
    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
        const msg = Buffer.from(JSON.stringify({ method: "getPilot", params: {} }));
        for (const target of broadcastTargets()) {
          socket.send(msg, 0, msg.length, 38899, target);
        }
      } catch { /* send failure handled by timeout */ }
    });
  });
}

async function healIp(preferredIp: string, mac?: string | null, hubFallback?: (params: Record<string, unknown>) => Promise<void>): Promise<string> {
  const normMac = mac?.replace(/:/g, "").toLowerCase();
  // 1. UDP broadcast discovery — fast, no router login needed
  try {
    const bulbs = await discoverWizLan();
    const match = (normMac && bulbs.find((b) => b.mac === normMac)) || bulbs[0];
    if (match) return match.ip;
  } catch { /* ignore, try hub */ }
  // 2. Hub fallback — the hub has its own heal chain
  if (hubFallback) {
    try {
      await hubFallback({});
    } catch { /* ignore */ }
  }
  throw new Error(`WiZ bulb unreachable at ${preferredIp}`);
}

/**
 * Liveness-first send. Probes the IP once (1s) before sending, so a dead
 * IP costs ~2.5s (probe + discover + send) instead of9+ seconds of retry loops.
 *
 *  1. Quick probe — if alive, send directly (<150ms total).
 *  2. Probe failed — discover by MAC, send to the real IP (~2.5s).
 *  3. Still failing — hub fallback (~3.5s).
 */
export async function sendWizPilotResilient(
  ip: string,
  params: Record<string, unknown>,
  opts: {
    mac?: string | null;
    hubFallback?: (params: Record<string, unknown>) => Promise<void>;
  } = {},
): Promise<void> {
  // 1. Quick liveness probe (1s timeout)
  let targetIp = ip;
  try {
    await getWizPilot(ip);
  } catch (e) {
    if (!isUnreachable(e)) throw e;
    targetIp = await healIp(ip, opts.mac, opts.hubFallback);
  }

  // 2. Send to the (possibly healed) IP
  try {
    await sendWizPilot(targetIp, params);
  } catch (e) {
    if (!isUnreachable(e)) throw e;
    // Rare: probe passed but send failed (bulb WiFi dozed in between).
    // One short retry after ARP warms up.
    await sleep(200);
    try {
      await sendWizPilot(targetIp, params);
    } catch {
      // Try healing one more time
      targetIp = await healIp(targetIp, opts.mac, opts.hubFallback);
      await sendWizPilot(targetIp, params);
    }
  }
}

/** getPilot with the same heal chain. Returns { pilot, ip } where ip may be the healed address. */
export async function getWizPilotResilient(
  ip: string,
  opts: { mac?: string | null } = {},
): Promise<{ pilot: Record<string, unknown>; ip: string }> {
  try {
    return { pilot: await getWizPilot(ip), ip };
  } catch (e) {
    if (!isUnreachable(e)) throw e;
    const normMac = opts.mac?.replace(/:/g, "").toLowerCase();
    const bulbs = await discoverWizLan().catch(() => [] as { mac: string | null; ip: string }[]);
    const match = (normMac && bulbs.find((b) => b.mac === normMac)) || bulbs[0];
    if (match) {
      return { pilot: await getWizPilot(match.ip), ip: match.ip };
    }
    throw e;
  }
}
