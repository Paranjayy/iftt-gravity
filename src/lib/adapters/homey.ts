import { Adapter, Device, Action } from '../types';

export class HomeyAdapter extends Adapter {
  name = 'Homey';
  private api: any = null;
  private token: string;
  private homeyId: string;

  constructor(token: string, homeyId: string) {
    super();
    this.token = token.trim();
    this.homeyId = homeyId.trim();
  }

  async initialize(): Promise<void> {
    // We already have the token and homeyId
  }

  async fetchDevices() {
    let activeHomeyId = this.homeyId;

    // Zero-ID Discovery: Automatically search for your Hub using the Token
    if (!activeHomeyId || activeHomeyId.startsWith('67555')) {
      const discoveryPaths = [
        `https://api.athom.com/v1/user/me/homeys`,
        `https://api.athom.com/v1/homeys` // Alternate legacy path
      ];

      for (const dPath of discoveryPaths) {
        try {
          const hRes = await fetch(dPath, { headers: { 'Authorization': `Bearer ${this.token}` } });
          if (hRes.ok) {
            const list = await hRes.json();
            const hubs = Array.isArray(list) ? list : list.data || [];
            if (hubs.length > 0) {
              activeHomeyId = hubs[0].id;
              break;
            }
          }
        } catch (e) {}
      }
    }

    const endpoints = [
      `https://api.athom.com/homey/${activeHomeyId}/api/manager/devices`,
      `https://api.athom.com/v1/homey/${activeHomeyId}/api/manager/devices`, // Versioned path
      `https://api.athom.com/homey/cloud/api/manager/devices`
    ];

    let lastError = "";
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { 
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          return Object.values(data);
        }
        lastError = `${res.statusText} (${res.status}) on ${url}`;
      } catch (err: any) {
        lastError = err.message;
      }
    }

    throw new Error(`Homey Connection Failed after trying all cloud paths. Last Error: ${lastError}. Make sure you copied your HOMEY ID (by clicking its name), NOT your Account ID.`);
  }

  async getDevices(): Promise<Device[]> {
    const devices = await this.fetchDevices();
    return devices.map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.class === 'light' ? 'light' : d.class === 'tv' ? 'tv' : 'light',
      status: d.available ? 'online' : 'offline',
      lastSeen: new Date(),
    }));
  }

  async setCapability(deviceId: string, capability: string, value: any): Promise<void> {
    const res = await fetch(`https://api.athom.com/homey/${this.homeyId}/api/manager/devices/device/${deviceId}/capability/${capability}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    });

    if (!res.ok) {
      throw new Error(`Homey control error: ${res.statusText}`);
    }
  }

  async executeAction(action: Action): Promise<void> {
    const { deviceId, capability, value } = action.payload;
    await this.setCapability(deviceId, capability, value);
  }
}
