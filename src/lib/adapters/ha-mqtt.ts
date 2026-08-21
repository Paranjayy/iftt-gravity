import mqtt from 'mqtt';
import { MiraieAdapter } from './miraie';
import { WizAdapter } from './wiz';

export interface HaMqttConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  discoveryPrefix?: string;
}

const DEFAULT_PREFIX = 'homeassistant';
const NODE_ID = 'gravity_hub';

export class HaMqttPublisher {
  private client: mqtt.MqttClient | null = null;
  private prefix: string;
  private config: HaMqttConfig;
  private wizHandler?: (ip: string, cmd: string, value?: any) => Promise<void>;
  private miraieHandler?: (deviceId: string, cmd: Record<string, any>) => Promise<void>;
  private sceneHandler?: (sceneName: string) => Promise<void>;

  constructor(config: HaMqttConfig) {
    this.config = config;
    this.prefix = config.discoveryPrefix || DEFAULT_PREFIX;
  }

  /** Register callback to control WiZ bulbs via UDP */
  onWizCommand(handler: (ip: string, cmd: string, value?: any) => Promise<void>) {
    this.wizHandler = handler;
  }

  /** Register callback to control MirAie AC via MQTT */
  onMiraieCommand(handler: (deviceId: string, cmd: Record<string, any>) => Promise<void>) {
    this.miraieHandler = handler;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { host, port = 1883, username, password } = this.config;
      this.client = mqtt.connect(`mqtt://${host}:${port}`, {
        username,
        password,
        clientId: `gravity-mqtt-${Math.floor(Math.random() * 1000)}`,
        keepalive: 60,
      });

      this.client.on('connect', () => {
        console.log('📡 HA MQTT Publisher: connected');
        this.publishAvailability('online');
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('📡 HA MQTT Publisher error:', err.message);
        reject(err);
      });
    });
  }

  disconnect() {
    if (this.client) {
      this.publishAvailability('offline');
      this.client.end();
      this.client = null;
    }
  }

  private publishAvailability(status: 'online' | 'offline') {
    this.client?.publish('gravity/availability', status, { retain: true });
  }

  // ── MirAie AC → Climate Entity ─────────────────────────────

  publishMiraieClimate(device: MiraieAdapter, deviceId: string) {
    if (!this.client?.connected) return;

    const deviceObj = device.devices.find(d => d.deviceId === deviceId);
    if (!deviceObj) return;

    const slug = `miraie_${deviceId}`;
    const baseTopic = `gravity/${slug}`;

    // Discovery config
    const config = {
      name: deviceObj.deviceName || 'Panasonic AC',
      unique_id: `gravity_${slug}`,
      state_topic: `${baseTopic}/state`,
      command_topic: `${baseTopic}/set`,
      temperature_state_topic: `${baseTopic}/temp_state`,
      temperature_command_topic: `${baseTopic}/temp_set`,
      mode_state_topic: `${baseTopic}/mode_state`,
      mode_command_topic: `${baseTopic}/mode_set`,
      fan_mode_state_topic: `${baseTopic}/fan_state`,
      fan_mode_command_topic: `${baseTopic}/fan_set`,
      swing_mode_state_topic: `${baseTopic}/swing_state`,
      swing_mode_command_topic: `${baseTopic}/swing_set`,
      modes: ['cool', 'heat', 'auto', 'dry', 'fan_only', 'off'],
      fan_modes: ['low', 'medium', 'high', 'auto'],
      swing_modes: ['off', 'vertical'],
      min_temp: 16,
      max_temp: 30,
      temp_step: 1,
      availability_topic: 'gravity/availability',
      device: {
        identifiers: [`gravity_${slug}`],
        name: deviceObj.deviceName || 'Panasonic AC',
        manufacturer: 'Panasonic',
        model: 'MirAie',
        via_device: 'gravity_hub',
      },
    };

    this.client.publish(
      `${this.prefix}/climate/${NODE_ID}_${slug}/config`,
      JSON.stringify(config),
      { retain: true }
    );

    // Subscribe to commands
    this.client.subscribe(`${baseTopic}/set`);
    this.client.subscribe(`${baseTopic}/temp_set`);
    this.client.subscribe(`${baseTopic}/mode_set`);
    this.client.subscribe(`${baseTopic}/fan_set`);
    this.client.subscribe(`${baseTopic}/swing_set`);

    this.client.on('message', (topic, message) => {
      const msg = message.toString();
      if (topic === `${baseTopic}/set`) {
        if (msg === 'OFF') device.controlDevice(deviceId, { ps: 'off' });
        else device.controlDevice(deviceId, { ps: 'on' });
      } else if (topic === `${baseTopic}/temp_set`) {
        device.controlDevice(deviceId, { actmp: msg });
      } else if (topic === `${baseTopic}/mode_set`) {
        device.controlDevice(deviceId, { acmd: msg });
      } else if (topic === `${baseTopic}/fan_set`) {
        const fanMap: Record<string, string> = { low: '1', medium: '2', high: '3', auto: '4' };
        device.controlDevice(deviceId, { acfs: fanMap[msg] || '4' });
      } else if (topic === `${baseTopic}/swing_set`) {
        device.controlDevice(deviceId, { acvs: msg === 'vertical' ? '4' : '0' });
      }
    });

    // Publish current state
    this.publishMiraieState(deviceObj);
  }

  private publishMiraieState(deviceObj: any) {
    if (!this.client?.connected || !deviceObj.status) return;
    const slug = `miraie_${deviceObj.deviceId}`;
    const baseTopic = `gravity/${slug}`;
    const status = deviceObj.status;

    this.client.publish(`${baseTopic}/state`, status.ps === 'on' ? 'cool' : 'off', { retain: true });
    this.client.publish(`${baseTopic}/temp_state`, status.actmp || '24', { retain: true });
    this.client.publish(`${baseTopic}/mode_state`, status.acmd || 'cool', { retain: true });

    const fanMap: Record<string, string> = { '1': 'low', '2': 'medium', '3': 'high', '4': 'auto' };
    this.client.publish(`${baseTopic}/fan_state`, fanMap[status.acfs || '4'] || 'auto', { retain: true });
    this.client.publish(`${baseTopic}/swing_state`, status.acvs === '4' ? 'vertical' : 'off', { retain: true });
  }

  // ── WiZ Bulb → Light Entity ────────────────────────────────

  publishWizLight(bulbIp: string, name: string = 'WiZ Bulb') {
    if (!this.client?.connected) return;

    const slug = `wiz_${bulbIp.replace(/\./g, '_')}`;
    const baseTopic = `gravity/${slug}`;

    const config = {
      name,
      unique_id: `gravity_${slug}`,
      state_topic: `${baseTopic}/state`,
      command_topic: `${baseTopic}/set`,
      brightness_state_topic: `${baseTopic}/brightness`,
      brightness_command_topic: `${baseTopic}/brightness/set`,
      rgb_state_topic: `${baseTopic}/rgb`,
      rgb_command_topic: `${baseTopic}/rgb/set`,
      color_temp_state_topic: `${baseTopic}/color_temp`,
      color_temp_command_topic: `${baseTopic}/color_temp/set`,
      schema: 'json',
      availability_topic: 'gravity/availability',
      device: {
        identifiers: [`gravity_${slug}`],
        name,
        manufacturer: 'Philips WiZ',
        via_device: 'gravity_hub',
      },
    };

    this.client.publish(
      `${this.prefix}/light/${NODE_ID}_${slug}/config`,
      JSON.stringify(config),
      { retain: true }
    );

    this.client.subscribe(`${baseTopic}/set`);
    this.client.subscribe(`${baseTopic}/brightness/set`);
    this.client.subscribe(`${baseTopic}/rgb/set`);
    this.client.subscribe(`${baseTopic}/color_temp/set`);

    // Handle commands from HA
    this.client.on('message', (topic, message) => {
      const msg = message.toString();
      if (!topic.startsWith(baseTopic)) return;
      if (!this.wizHandler) return;

      if (topic === `${baseTopic}/set`) {
        this.wizHandler(bulbIp, msg === 'ON' ? 'on' : msg === 'OFF' ? 'off' : 'toggle');
      } else if (topic === `${baseTopic}/brightness/set`) {
        const brightness = Math.round((parseInt(msg) / 255) * 100);
        this.wizHandler(bulbIp, 'brightness', brightness);
      } else if (topic === `${baseTopic}/rgb/set`) {
        try {
          const rgb = JSON.parse(msg);
          this.wizHandler(bulbIp, 'color', rgb);
        } catch {}
      } else if (topic === `${baseTopic}/color_temp/set`) {
        this.wizHandler(bulbIp, 'temp', parseInt(msg));
      }
    });
  }

  publishWizState(bulbIp: string, state: { on: boolean; brightness: number; r?: number; g?: number; b?: number; temp?: number }) {
    if (!this.client?.connected) return;
    const slug = `wiz_${bulbIp.replace(/\./g, '_')}`;
    const baseTopic = `gravity/${slug}`;

    this.client.publish(`${baseTopic}/state`, state.on ? 'ON' : 'OFF', { retain: true });
    this.client.publish(`${baseTopic}/brightness`, String(Math.round(state.brightness * 2.55)), { retain: true });
    if (state.r !== undefined && state.g !== undefined && state.b !== undefined) {
      this.client.publish(`${baseTopic}/rgb`, JSON.stringify({ r: state.r, g: state.g, b: state.b }), { retain: true });
    }
    if (state.temp !== undefined) {
      this.client.publish(`${baseTopic}/color_temp`, String(state.temp), { retain: true });
    }
  }

  /** Register callback to trigger Gravity Hub scenes from HA */
  onSceneCommand(handler: (sceneName: string) => Promise<void>) {
    this.sceneHandler = handler;
  }

  /** Publish Gravity Hub scene as an HA button entity */
  publishSceneButton(sceneName: string) {
    if (!this.client?.connected) return;
    const slug = `scene_${sceneName.toLowerCase()}`;
    const baseTopic = `gravity/${slug}`;

    const label = sceneName.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

    const config = {
      name: `${label} (Gravity)`,
      unique_id: `gravity_${slug}`,
      command_topic: `${baseTopic}/set`,
      payload_press: 'ON',
      availability_topic: 'gravity/availability',
      device: {
        identifiers: ['gravity_hub'],
        name: 'Gravity Hub',
        via_device: 'gravity_hub',
      },
    };

    this.client.publish(
      `${this.prefix}/button/${NODE_ID}_${slug}/config`,
      JSON.stringify(config),
      { retain: true }
    );
    this.client.subscribe(`${baseTopic}/set`);

    this.client.on('message', (topic, message) => {
      if (topic !== `${baseTopic}/set` || !this.sceneHandler) return;
      if (message.toString() === 'ON') {
        this.sceneHandler!(sceneName).catch(() => {});
      }
    });
  }

  // ── Gravity Hub State Sensors ──────────────────────────────

  /** Publish Gravity Hub internal-state sensors (call once after connect) */
  publishStateSensors() {
    this.publishBinarySensor('gravity_work_mode', 'Work Mode', 'work_mode');
    this.publishBinarySensor('gravity_auto_ac', 'Auto-Pilot AC', 'auto_ac');
    this.publishValueSensor('gravity_ac_minutes', 'AC Usage Today', 'ac_minutes', 'min');
    this.publishValueSensor('gravity_light_minutes', 'Light Usage Today', 'light_minutes', 'min');
  }

  /** Push fresh values for the state sensors */
  updateStateSensors(state: { workMode?: boolean; autoAc?: boolean; acMinutes?: number; lightMinutes?: number }) {
    if (!this.client?.connected) return;
    if (state.workMode !== undefined) {
      this.client.publish('gravity/work_mode/state', state.workMode ? 'ON' : 'OFF', { retain: true });
    }
    if (state.autoAc !== undefined) {
      this.client.publish('gravity/auto_ac/state', state.autoAc ? 'ON' : 'OFF', { retain: true });
    }
    if (state.acMinutes !== undefined) {
      this.client.publish('gravity/ac_minutes/state', String(state.acMinutes), { retain: true });
    }
    if (state.lightMinutes !== undefined) {
      this.client.publish('gravity/light_minutes/state', String(state.lightMinutes), { retain: true });
    }
  }

  private publishBinarySensor(slug: string, name: string, key: string) {
    if (!this.client?.connected) return;
    const config = {
      name,
      unique_id: `gravity_${slug}`,
      state_topic: `gravity/${key}/state`,
      payload_on: 'ON',
      payload_off: 'OFF',
      availability_topic: 'gravity/availability',
      device: {
        identifiers: ['gravity_hub'],
        name: 'Gravity Hub',
        via_device: 'gravity_hub',
      },
    };
    this.client.publish(`${this.prefix}/binary_sensor/${NODE_ID}_${slug}/config`, JSON.stringify(config), { retain: true });
  }

  private publishValueSensor(slug: string, name: string, key: string, unit: string) {
    if (!this.client?.connected) return;
    const config = {
      name,
      unique_id: `gravity_${slug}`,
      state_topic: `gravity/${key}/state`,
      unit_of_measurement: unit,
      availability_topic: 'gravity/availability',
      device: {
        identifiers: ['gravity_hub'],
        name: 'Gravity Hub',
        via_device: 'gravity_hub',
      },
    };
    this.client.publish(`${this.prefix}/sensor/${NODE_ID}_${slug}/config`, JSON.stringify(config), { retain: true });
  }

  // ── Generic Entity ─────────────────────────────────────────

  publishSensor(entityId: string, name: string, value: string, unit?: string) {
    if (!this.client?.connected) return;
    const slug = entityId.replace(/[^a-zA-Z0-9]/g, '_');
    const baseTopic = `gravity/${slug}`;

    const config: any = {
      name,
      unique_id: `gravity_${slug}`,
      state_topic: `${baseTopic}/state`,
      availability_topic: 'gravity/availability',
      device: {
        identifiers: ['gravity_hub'],
        name: 'Gravity Hub',
        via_device: 'gravity_hub',
      },
    };
    if (unit) config.unit_of_measurement = unit;

    this.client.publish(
      `${this.prefix}/sensor/${NODE_ID}_${slug}/config`,
      JSON.stringify(config),
      { retain: true }
    );
    this.client.publish(`${baseTopic}/state`, value, { retain: true });
  }

  publishSwitch(entityId: string, name: string, state: boolean) {
    if (!this.client?.connected) return;
    const slug = entityId.replace(/[^a-zA-Z0-9]/g, '_');
    const baseTopic = `gravity/${slug}`;

    const config = {
      name,
      unique_id: `gravity_${slug}`,
      state_topic: `${baseTopic}/state`,
      command_topic: `${baseTopic}/set`,
      payload_on: 'ON',
      payload_off: 'OFF',
      availability_topic: 'gravity/availability',
      device: {
        identifiers: ['gravity_hub'],
        name: 'Gravity Hub',
        via_device: 'gravity_hub',
      },
    };

    this.client.publish(
      `${this.prefix}/switch/${NODE_ID}_${slug}/config`,
      JSON.stringify(config),
      { retain: true }
    );
    this.client.subscribe(`${baseTopic}/set`);
    this.client.publish(`${baseTopic}/state`, state ? 'ON' : 'OFF', { retain: true });
  }
}
