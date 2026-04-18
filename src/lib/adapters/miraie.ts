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
  status?: MiraieStatus;
}

export interface MiraieStatus {
  ki?: number;
  cnt?: string;
  sid?: string;
  ps?: string;  // power: 'on'=on, 'off'=off
  actmp?: string;  // temperature setpoint (16–30)
  acmd?: string;  // mode: 'cool', 'dry', 'fan', 'auto', 'heat'
  acfs?: string; // fan speed: '1'=low, '2'=med, '3'=high, '4'=auto
  acvs?: string; // vert swing: '0'=off, '4'=swing
}

export class MiraieAdapter extends Adapter {
  name = 'Panasonic MirAie';
  private accessToken: string | null = null;
  private userId: string | null = null;
  public devices: MiraieDevice[] = [];
  private mqttClient?: mqtt.MqttClient;

  constructor(private mobile?: string, private password?: string) {
    super();
  }

  async initialize(): Promise<void> {
    if (this.mobile && this.password) {
      await this.login();
      await this.fetchDevices();
      this.startListening();
    }
  }

  private startListening() {
    if (!this.accessToken || this.devices.length === 0) return;
    
    this.mqttClient = mqtt.connect('mqtts://mqtt.miraie.in:8883', {
      username: this.devices[0].homeId,
      password: this.accessToken!,
      clientId: 'gravity-mirae-listener-' + Math.floor(Math.random() * 1000),
      keepalive: 60
    });

    this.mqttClient.on('connect', () => {
      this.devices.forEach(d => {
        this.mqttClient!.subscribe(d.topic.sub);
        // Request immediate status sync
        this.mqttClient!.publish(d.topic.pub, JSON.stringify({ get: 'status' }));
      });
    });

    this.mqttClient.on('message', (topic, message) => {
      const msgStr = message.toString();
      const device = this.devices.find(d => d.topic.sub === topic);
      
      // Forensic Log
      require('fs').appendFileSync('/tmp/gravity-mqtt-trace.log', `[${new Date().toISOString()}] TOPIC: ${topic} | MSG: ${msgStr}\n`);

      if (device) {
        try {
          const data = JSON.parse(msgStr);
          device.status = { ...device.status, ...(data.status || data) };
        } catch (e) {}
      }
    });

    this.mqttClient.on('error', (err) => {
      console.error('MirAie MQTT Listener Error:', err.message);
    });
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
            const topicPrefix = (device.topic && Array.isArray(device.topic) && device.topic.length > 0) 
              ? device.topic[0] 
              : `v1/${home.homeId}/${device.deviceId}`;
            allDevices.push({
              deviceId: device.deviceId,
              deviceName: device.deviceName || 'Panasonic AC',
              activeStatus: device.activeStatus,
              deviceTypeCode: device.deviceTypeCode,
              homeId: home.homeId,
              topic: {
                pub: `${topicPrefix}/control`,
                sub: `${topicPrefix}/status`,
              },
            });
        }
      }
    }

    this.devices = allDevices;
    // Initial status sync
    await this.refreshAllStatuses();
    return allDevices;
  }

  async refreshAllStatuses(): Promise<void> {
    for (const device of this.devices) {
      try {
        const res = await axios.get(`https://app.miraie.in/simplifi/v1/homeManagement/homes/devices/${device.deviceId}/status`, {
          headers: this.headers
        });
        if (res.data) {
          device.status = { ...device.status, ...(res.data.status || res.data) };
        }
      } catch (e) {
        // Fallback to MQTT if REST fails
      }
    }
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
        username: device.homeId, 
        password: this.accessToken!, 
        clientId: 'ha-mirae-mqtt-' + Math.floor(Math.random() * 1000)
      });

      client.on('connect', () => {
        // MirAie Mandatory Protocol Handshake
        const payload = { 
          ki: 1, 
          cnt: 'an', 
          sid: '1', 
          bz: 1, 
          ...command 
        };
        client.publish(device.topic.pub, JSON.stringify(payload), (err) => {
          client.end();
          if (err) reject(err);
          else {
            // Update local status cache for immediate feedback
            device.status = { ...device.status, ...command };
            resolve();
          }
        });
      });

      client.on('error', (err) => {
        client.end();
        reject(err);
      });
    });
  }

  async getDeviceStatus(deviceId: string): Promise<MiraieStatus | null> {
    const device = this.devices.find(d => d.deviceId === deviceId);
    return device?.status || { actmp: '24', ps: 'off' };
  }

  async executeAction(action: Action): Promise<void> {
    const { deviceId, status, temperature, mode } = action.payload;
    if (!this.accessToken) await this.login();

    await this.controlDevice(deviceId, {
      ki: 1, 
      cnt: "an", 
      sid: "1",
      bz: 1,
      ...(status !== undefined ? { ps: status === 'ON' ? 'on' : 'off' } : { ps: 'on' }),
      ...(temperature && { actmp: String(temperature) }),
      ...(mode && { acmd: mode.toLowerCase() }),
    });
  }
}
