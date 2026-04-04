import axios from 'axios';
import mqtt from 'mqtt';
import { Adapter, Device, Action } from '../types';

// Correct endpoint — reverse-engineered from the MirAie Android app
const AUTH_URL = 'https://auth.miraie.in/simplifi/v1/userManagement/login';
const HOME_URL = 'https://app.miraie.in/simplifi/v1/homeManagement/homes';

// Correct clientId from the MirAie Android app (rkzofficial/miraie-ac research)
const CLIENT_ID = 'PBcMcfG19njNCL8AOgvRzIC8AjQa';

export interface MiraieDevice {
  deviceId: string;
  deviceName: string;
  activeStatus: boolean;
  deviceTypeCode: string;
  homeId: string;
  topic: {
    pub: string;
    sub: string;
  };
}

export interface MiraieStatus {
  ki?: number;
  cnt?: string;
  sid?: string;
  ps?: string;  // power: 'on'=on, 'off'=off
  actmp?: number;  // temperature setpoint (16–30)
  acmd?: string;  // mode: 'cool', 'dry', 'fan', 'auto', 'heat'
  acfs?: string; // fan speed: '1'=low, '2'=med, '3'=high, '4'=auto
  acvs?: string; // vert swing: '0'=off, '4'=swing
}

export class MiraieAdapter extends Adapter {
  name = 'Panasonic MirAie';
  private accessToken: string | null = null;
  private userId: string | null = null;
  public devices: MiraieDevice[] = [];

  constructor(private mobile?: string, private password?: string) {
    super();
  }

  async initialize(): Promise<void> {
    if (this.mobile && this.password) {
      await this.login();
      await this.fetchDevices();
    }
  }

  async login(): Promise<{ token: string; userId: string }> {
    if (!this.mobile || !this.password) throw new Error('Credentials missing');

    // Exact payload — no clientSecret, no appVersion, no empty-string scope
    const res = await axios.post(AUTH_URL, {
      clientId: CLIENT_ID,
      mobile: this.mobile,
      password: this.password,
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    this.accessToken = res.data.accessToken;
    this.userId = res.data.userId;

    if (!this.accessToken) throw new Error('Login failed: no token returned');

    return { token: this.accessToken, userId: this.userId! };
  }

  private get headers() {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async fetchDevices(): Promise<MiraieDevice[]> {
    if (!this.accessToken) await this.login();

    const res = await axios.get(HOME_URL, { headers: this.headers });
    const homes = res.data;
    const allDevices: MiraieDevice[] = [];

    for (const home of homes) {
      const spaces = home.spaces || [];
      for (const space of spaces) {
        for (const device of (space.devices || [])) {
          allDevices.push({
            deviceId: device.deviceId,
            deviceName: device.deviceName || 'Panasonic AC',
            activeStatus: device.activeStatus,
            deviceTypeCode: device.deviceTypeCode,
            homeId: home.homeId,
            topic: {
              pub: `v1/${home.homeId}/${device.deviceId}/control`,
              sub: `v1/${home.homeId}/${device.deviceId}/status`,
            },
          });
        }
      }
    }

    this.devices = allDevices;
    return allDevices;
  }

  async getDevices(): Promise<Device[]> {
    if (this.devices.length === 0) await this.fetchDevices();
    return this.devices.map(d => ({
      id: d.deviceId,
      name: d.deviceName,
      type: 'ac',
      status: d.activeStatus ? 'online' : 'offline',
      lastSeen: new Date(),
    }));
  }

  async controlDevice(deviceId: string, command: Partial<MiraieStatus>): Promise<void> {
    if (!this.accessToken) await this.login();

    const device = this.devices.find(d => d.deviceId === deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);

    return new Promise((resolve, reject) => {
      const client = mqtt.connect('mqtts://mqtt.miraie.in:8883', {
        username: device.homeId, // Broker uses Home ID as username
        password: this.accessToken!, // Broker uses access token as password
        clientId: 'ha-mirae-mqtt-' + Math.floor(Math.random() * 1000)
      });

      client.on('connect', () => {
        client.publish(device.topic.pub, JSON.stringify(command), (err) => {
          client.end();
          if (err) reject(err);
          else resolve();
        });
      });

      client.on('error', (err) => {
        client.end();
        reject(err);
      });
    });
  }

  async executeAction(action: Action): Promise<void> {
    const { deviceId, status, temperature, mode } = action.payload;
    if (!this.accessToken) await this.login();

    await this.controlDevice(deviceId, {
      ki: 1, cnt: "an", sid: "1",
      ...(status && { ps: status === 'ON' ? 'on' : 'off' }),
      ...(temperature && { actmp: temperature }),
      ...(mode && { acmd: mode.toLowerCase() }),
    });
  }
}
