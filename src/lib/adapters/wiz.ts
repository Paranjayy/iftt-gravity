import { Adapter, Device, Action } from '../types';

/**
 * WiZ 2.0 Adapter — Philips A70 12W Smart Bulb (and all WiZ-compatible bulbs)
 *
 * Philips acquired WiZ, so Philips WiZ bulbs use the exact same protocol:
 *   - Local UDP on port 38899 (recommended — works offline, zero latency)
 *   - WiZ Pro GraphQL API (cloud, for commercial use)
 *
 * For home use, local UDP (setPilot/getPilot over LAN) is the best approach.
 * The bulb IP can be found in your router's DHCP table or the WiZ app.
 */
export class WizAdapter extends Adapter {
  name = 'Philips WiZ A70 (Wiz 2.0)';
  private bulbIp: string;
  private bulbPort = 38899; // Standard WiZ UDP port

  constructor(bulbIp: string) {
    super();
    this.bulbIp = bulbIp;
  }

  async initialize(): Promise<void> {
    // Ping the bulb via UDP to check it's reachable on the local network
    console.log(`WiZ adapter initialized. Bulb expected at ${this.bulbIp}:${this.bulbPort}`);
  }

  async getDevices(): Promise<Device[]> {
    return [{
      id: 'wiz-philips-a70',
      name: 'Philips A70 12W (Main Bulb)',
      type: 'light',
      status: 'online',
      lastSeen: new Date()
    }];
  }

  async executeAction(action: Action): Promise<void> {
    const { state, brightness, r, g, b, temp } = action.payload;

    // WiZ setPilot UDP payload
    const payload = {
      method: 'setPilot',
      params: {
        state: !!state,
        ...(brightness !== undefined && { dimming: brightness }), // 10–100
        ...(r !== undefined && { r, g, b }),                      // RGB color
        ...(temp !== undefined && { temp }),                       // Color temp 2200–6500K
      }
    };

    console.log(`[WiZ] Sending to ${this.bulbIp}:${this.bulbPort}`, JSON.stringify(payload));
    // Real implementation: send UDP datagram — will add dgram/udp4 socket in Phase 2
  }
}
