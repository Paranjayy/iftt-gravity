import dgram from 'dgram';
import { networkInterfaces } from 'os';

const WIZ_PORT = 38899;

/** Find local subnet (192.168.29.X) */
export function getLocalSubnet(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal && net.address.startsWith('192.168.')) {
        return net.address.split('.').slice(0, 3).join('.');
      }
    }
  }
  return '192.168.29'; // Default for Jio
}

/** 
 * Scans the local network for WiZ bulbs.
 * Try broadcast first, then sequential subnet scan if broadcast is blocked by router.
 */
export async function discoverWizBulbs(timeout = 4000): Promise<{ ip: string; id: string }[]> {
  const found: { ip: string; id: string }[] = [];
  const subnet = getLocalSubnet();
  
  // 1. Shouting (UDP Broadcast) — Fast
  const broadcastPromise = new Promise<{ ip: string; id: string }[]>((resolve) => {
    const socket = dgram.createSocket('udp4');
    socket.bind(() => {
      socket.setBroadcast(true);
      const msg = JSON.stringify({ method: 'getPilot', params: {} });
      socket.send(msg, 0, msg.length, WIZ_PORT, '255.255.255.255');
    });

    const timer = setTimeout(() => { socket.close(); resolve(found); }, 2000);
    socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.result && !found.find(f => f.ip === rinfo.address)) {
          found.push({ ip: rinfo.address, id: data.result.mac || 'unknown' });
        }
      } catch {}
    });
  });

  await broadcastPromise;
  if (found.length > 0) return found;

  // 2. Sequential Subnet Scan — Thorough (if broadcast fails)
  console.log(`🔎 Broadcast blocked. Scanning subnet ${subnet}.0/24...`);
  const scanPromises = [];
  for (let i = 2; i < 255; i++) {
    const ip = `${subnet}.${i}`;
    scanPromises.push(new Promise<void>((resolve) => {
      const socket = dgram.createSocket('udp4');
      const msg = JSON.stringify({ method: 'getPilot', params: {} });
      const timer = setTimeout(() => { socket.close(); resolve(); }, 1500);

      socket.on('message', (m, rinfo) => {
        try {
          const data = JSON.parse(m.toString());
          if (data.result && !found.find(f => f.ip === rinfo.address)) {
            found.push({ ip: rinfo.address, id: data.result.mac || 'unknown' });
          }
        } catch {}
        clearTimeout(timer); socket.close(); resolve();
      });

      socket.send(msg, 0, msg.length, WIZ_PORT, ip, (err) => {
        if (err) { clearTimeout(timer); socket.close(); resolve(); }
      });
    }));
  }

  await Promise.all(scanPromises);
  return found;
}
