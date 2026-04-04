import axios from 'axios';
import { Adapter, Device, Action } from '../types';

// Homey Web API — works with personal access token from homey.app/developer
// Create one at: https://tools.developer.homey.app/tools/devices
const HOMEY_CLOUD_URL = 'https://api.homey.app/v1';

export interface HomeyDevice {
  id: string;
  name: string;
  class: string;        // 'light', 'socket', 'sensor', etc.
  zone: string;
  available: boolean;
  capabilities: string[];
  capabilitiesObj: Record<string, { value: any; lastChanged: string }>;
}

export class HomeyAdapter extends Adapter {
  name = 'Homey';
  private token: string;
  private homeyId: string;
  public devices: HomeyDevice[] = [];

  constructor(token: string, homeyId: string) {
    super();
    this.token = token;
    this.homeyId = homeyId;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  private get baseUrl() {
    // For Homey Pro local: http://<homey-ip>/api
    // For cloud: https://api.homey.app/v1/homey/{homeyId}
    return `${HOMEY_CLOUD_URL}/homey/${this.homeyId}`;
  }

  async initialize(): Promise<void> {
    // Verify token works by fetching device count
    await this.fetchDevices();
  }

  async fetchDevices(): Promise<HomeyDevice[]> {
    const res = await axios.get(`${this.baseUrl}/devices`, { headers: this.headers });
    this.devices = Object.values(res.data) as HomeyDevice[];
    return this.devices;
  }

  async getDevices(): Promise<Device[]> {
    if (!this.devices.length) await this.fetchDevices();
    return this.devices.map(d => ({
      id: d.id,
      name: d.name,
      type: d.class === 'light' ? 'light' : d.class === 'tv' ? 'tv' : 'light',
      status: d.available ? 'online' : 'offline',
      lastSeen: new Date(),
    }));
  }

  /** Set a capability value on a device */
  async setCapability(deviceId: string, capability: string, value: any): Promise<void> {
    await axios.put(
      `${this.baseUrl}/devices/${deviceId}/capabilities/${capability}`,
      { value },
      { headers: this.headers }
    );
  }

  /** Turn a device on or off */
  async setOnOff(deviceId: string, on: boolean): Promise<void> {
    await this.setCapability(deviceId, 'onoff', on);
  }

  /** Set light brightness (0–1) */
  async setBrightness(deviceId: string, brightness: number): Promise<void> {
    await this.setCapability(deviceId, 'dim', Math.min(1, Math.max(0, brightness)));
  }

  /** Set light color temp (0=cold, 1=warm) */
  async setLightTemperature(deviceId: string, temp: number): Promise<void> {
    await this.setCapability(deviceId, 'light_temperature', temp);
  }

  /** Run a Flow by name or ID */
  async triggerFlow(flowId: string): Promise<void> {
    await axios.post(
      `${this.baseUrl}/flow/${flowId}/trigger`,
      {},
      { headers: this.headers }
    );
  }

  async executeAction(action: Action): Promise<void> {
    const { deviceId, capability, value } = action.payload;
    await this.setCapability(deviceId, capability, value);
  }
}
