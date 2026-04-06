import dgram from 'dgram';
import { Adapter, Device, Action } from '../types';

const WIZ_PORT = 38899;
const UDP_TIMEOUT = 3000;

export interface WizState {
  state?: boolean;
  dimming?: number;   // 0–100 (0 = dim to minimum, use state:false for off)
  r?: number; g?: number; b?: number;
  temp?: number;      // color temp 2200–6500K
  sceneId?: number;
}

// Built-in WiZ scenes
export const WIZ_SCENES: Record<string, number> = {
  'Ocean': 1, 'Romance': 2, 'Sunset': 3, 'Party': 4, 'Fireplace': 5,
  'Cozy': 6, 'Forest': 7, 'Pastel': 8, 'Wake Up': 9, 'Bedtime': 10,
  'Warm White': 11, 'Cool White': 12, 'Night Light': 13, 'Focus': 14,
  'Relax': 15, 'True colors': 17, 'TV time': 18, 'Plantgrowth': 19, 'Spring': 20,
};

function sendUDP(ip: string, message: object, expectResponse = false): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const buf = Buffer.from(JSON.stringify(message));
    const timer = setTimeout(() => {
      socket.close();
      if (expectResponse) reject(new Error(`WiZ UDP timeout — is ${ip} on the same network?`));
      else resolve(null); // fire-and-forget: timeout is fine
    }, UDP_TIMEOUT);

    if (expectResponse) {
      socket.on('message', (msg) => {
        clearTimeout(timer);
        socket.close();
        try { resolve(JSON.parse(msg.toString())); }
        catch { resolve(msg.toString()); }
      });
    }

    socket.send(buf, 0, buf.length, WIZ_PORT, ip, (err) => {
      if (err) { clearTimeout(timer); socket.close(); reject(err); return; }
      if (!expectResponse) { clearTimeout(timer); socket.close(); resolve(null); }
    });
  });
}

export class WizAdapter extends Adapter {
  name = 'Philips WiZ';
  private bulbIp: string;

  constructor(bulbIp: string) {
    super();
    this.bulbIp = bulbIp;
  }

  async initialize(): Promise<void> {
    await this.getPilot(); // will throw if unreachable
  }

  /** Read current bulb state */
  async getPilot(): Promise<any> {
    const res = await sendUDP(this.bulbIp, { method: 'getPilot', params: {} }, true);
    return res?.result;
  }

  /** Set bulb state */
  async setPilot(params: WizState): Promise<void> {
    const payload: any = { method: 'setPilot', params: {} };
    if (params.state !== undefined) payload.params.state = params.state;
    if (params.dimming !== undefined) payload.params.dimming = Math.min(100, Math.max(0, params.dimming));
    if (params.r !== undefined) { payload.params.r = params.r; payload.params.g = params.g; payload.params.b = params.b; }
    if (params.temp !== undefined) payload.params.temp = Math.min(6500, Math.max(2200, params.temp));
    if (params.sceneId !== undefined) payload.params.sceneId = params.sceneId;
    await sendUDP(this.bulbIp, payload, false);
  }

  async turnOn() { await this.setPilot({ state: true }); }
  async turnOff() { await this.setPilot({ state: false }); }
  async setBrightness(pct: number) { await this.setPilot({ state: pct > 0, dimming: pct }); }
  async setColor(r: number, g: number, b: number) { await this.setPilot({ state: true, r, g, b }); }
  async setWhite(temp: number) { await this.setPilot({ state: true, temp }); }
  async setScene(name: string) {
    const id = WIZ_SCENES[name];
    if (!id) throw new Error(`Unknown WiZ scene: ${name}`);
    await this.setPilot({ state: true, sceneId: id });
  }

  async getDevices(): Promise<Device[]> {
    return [{ id: `wiz-${this.bulbIp}`, name: 'WiZ Bulb', type: 'light', status: 'online', lastSeen: new Date() }];
  }

  async executeAction(action: Action): Promise<void> {
    const p = action.payload;
    const params: WizState = {};
    if (p.state !== undefined) params.state = p.state;
    if (p.dimming !== undefined) params.dimming = p.dimming;
    if (p.brightness !== undefined) params.dimming = p.brightness;
    if (p.r !== undefined) { params.r = p.r; params.g = p.g; params.b = p.b; }
    if (p.temp !== undefined) params.temp = p.temp;
    if (p.scene !== undefined) { 
      const id = WIZ_SCENES[p.scene];
      if (id) params.sceneId = id;
    }
    
    // If we have any params, use setPilot
    if (Object.keys(params).length > 0) {
      await this.setPilot(params);
    } else {
      await this.turnOn();
    }
  }
}
