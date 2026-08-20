import { Adapter, Device, Action } from '../types';
import { entityStore, Entity } from '../entities';
import mqtt from 'mqtt';

export interface HAConfig {
  url: string;
  token: string;
  mqtt?: {
    host: string;
    port?: number;
    username?: string;
    password?: string;
  };
  exposeToHA?: boolean;
  discoveryPrefix?: string;
  enabled?: boolean;
}

export interface HAEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

interface WSMessage {
  id: number;
  type: string;
  event?: any;
  success?: boolean;
  result?: any;
}

const DOMAIN_MAP: Record<string, Entity['domain']> = {
  light: 'light',
  climate: 'ac',
  switch: 'switch',
  media_player: 'media_player',
  cover: 'cover',
  sensor: 'sensor',
  binary_sensor: 'sensor',
  input_boolean: 'switch',
  input_number: 'sensor',
  fan: 'light',
  automation: 'switch',
  scene: 'switch',
  script: 'switch',
};

export class HomeAssistantAdapter extends Adapter {
  name = 'Home Assistant';
  private config: HAConfig;
  private ws: WebSocket | null = null;
  private wsId = 0;
  private wsCallbacks = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsReconnectDelay = 1000;
  private states = new Map<string, HAEntityState>();
  private connected = false;
  private mqttClient: mqtt.MqttClient | null = null;

  constructor(config: HAConfig) {
    super();
    this.config = {
      discoveryPrefix: 'homeassistant',
      exposeToHA: true,
      ...config,
    };
  }

  private get apiBase() {
    return this.config.url.replace(/\/$/, '');
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.url || !this.config.token) {
      console.log('⚠️  Home Assistant: URL or token not configured, skipping');
      return;
    }

    try {
      await this.testConnection();
      await this.fetchAllStates();
      this.connectWebSocket();
      if (this.config.exposeToHA && this.config.mqtt) {
        this.connectMQTT();
      }
      console.log(`✅ Home Assistant connected: ${this.config.url}`);
    } catch (e: any) {
      console.error(`❌ Home Assistant init failed: ${e.message}`);
    }
  }

  private async testConnection(): Promise<void> {
    const res = await fetch(`${this.apiBase}/api/`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    if (data.message !== 'API running.') throw new Error('Unexpected response');
  }

  // ── REST API ───────────────────────────────────────────────

  private async apiGet(path: string): Promise<any> {
    const res = await fetch(`${this.apiBase}${path}`, { headers: this.headers });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`HA API ${path}: ${res.status} ${err}`);
    }
    return res.json();
  }

  private async apiPost(path: string, body: any): Promise<any> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`HA API ${path}: ${res.status} ${err}`);
    }
    return res.json();
  }

  // ── State Management ───────────────────────────────────────

  async fetchAllStates(): Promise<void> {
    const states: HAEntityState[] = await this.apiGet('/api/states');
    this.states.clear();
    for (const s of states) {
      this.states.set(s.entity_id, s);
      this.syncToEntityStore(s);
    }
    console.log(`🏠 HA: Synced ${this.states.size} entities`);
  }

  private syncToEntityStore(s: HAEntityState) {
    const domain = s.entity_id.split('.')[0];
    const gravityDomain = DOMAIN_MAP[domain];
    if (!gravityDomain) return;

    const entity: Entity = {
      id: `ha.${s.entity_id}`,
      name: s.attributes.friendly_name || s.entity_id,
      domain: gravityDomain,
      state: s.state,
      attributes: {
        ...s.attributes,
        ha_entity_id: s.entity_id,
        ha_domain: domain,
      },
      lastUpdated: Date.now(),
    };
    entityStore.set(entity);
  }

  getState(entityId: string): HAEntityState | undefined {
    return this.states.get(entityId);
  }

  getStatesByDomain(domain: string): HAEntityState[] {
    return Array.from(this.states.values()).filter(s => s.entity_id.startsWith(`${domain}.`));
  }

  // ── WebSocket ──────────────────────────────────────────────

  private connectWebSocket() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }

    const wsUrl = this.apiBase.replace(/^http/, 'ws') + '/api/websocket';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('🏠 HA WebSocket: connected');
      this.wsReconnectDelay = 1000;
    };

    this.ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      this.handleWSMessage(msg);
    };

    this.ws.onclose = () => {
      this.connected = false;
      console.log('🏠 HA WebSocket: disconnected, reconnecting...');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('🏠 HA WebSocket error:', err);
    };
  }

  private handleWSMessage(msg: WSMessage) {
    if (msg.type === 'auth_required') {
      this.wsSend({ type: 'auth', access_token: this.config.token });
    } else if (msg.type === 'auth_ok') {
      this.connected = true;
      console.log('🏠 HA WebSocket: authenticated');
      this.subscribeStateChanges();
    } else if (msg.type === 'auth_invalid') {
      console.error('🏠 HA WebSocket: auth failed');
      this.ws?.close();
    } else if (msg.type === 'result') {
      const cb = this.wsCallbacks.get(msg.id);
      if (cb) {
        this.wsCallbacks.delete(msg.id);
        if (msg.success) cb.resolve(msg.result);
        else cb.reject(new Error(msg.result?.message || 'WS request failed'));
      }
    } else if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
      this.handleStateChange(msg.event.data);
    }
  }

  private handleStateChange(data: { new_state: HAEntityState; old_state: HAEntityState }) {
    if (!data.new_state) return;
    const { entity_id } = data.new_state;
    this.states.set(entity_id, data.new_state);
    this.syncToEntityStore(data.new_state);
  }

  private subscribeStateChanges() {
    this.wsSend({ id: this.nextWsId(), type: 'subscribe_events', event_type: 'state_changed' });
  }

  private wsSend(msg: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }
      const id = this.nextWsId();
      this.wsCallbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...msg, id }));
      setTimeout(() => {
        if (this.wsCallbacks.has(id)) {
          this.wsCallbacks.delete(id);
          reject(new Error('WS request timeout'));
        }
      }, 10000);
    });
  }

  private nextWsId(): number {
    return ++this.wsId;
  }

  private scheduleReconnect() {
    if (this.wsReconnectTimer) return;
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connectWebSocket();
    }, this.wsReconnectDelay);
    this.wsReconnectDelay = Math.min(this.wsReconnectDelay * 2, 30000);
  }

  // ── Service Calls ──────────────────────────────────────────

  async callService(domain: string, service: string, entityId: string, data: Record<string, any> = {}): Promise<void> {
    await this.apiPost(`/api/services/${domain}/${service}`, {
      entity_id: entityId,
      ...data,
    });
  }

  // ── Device Control ─────────────────────────────────────────

  async turnOn(entityId: string, data: Record<string, any> = {}): Promise<void> {
    const domain = entityId.split('.')[0];
    await this.callService(domain, 'turn_on', entityId, data);
  }

  async turnOff(entityId: string): Promise<void> {
    const domain = entityId.split('.')[0];
    await this.callService(domain, 'turn_off', entityId);
  }

  async toggle(entityId: string): Promise<void> {
    const domain = entityId.split('.')[0];
    await this.callService(domain, 'toggle', entityId);
  }

  async setLightBrightness(entityId: string, brightness: number): Promise<void> {
    const haBrightness = Math.round((brightness / 100) * 255);
    await this.turnOn(entityId, { brightness: haBrightness });
  }

  async setLightColor(entityId: string, r: number, g: number, b: number): Promise<void> {
    await this.turnOn(entityId, { rgb_color: [r, g, b] });
  }

  async setLightTemperature(entityId: string, tempMired: number): Promise<void> {
    await this.turnOn(entityId, { color_temp: tempMired });
  }

  async setClimateTemp(entityId: string, temp: number): Promise<void> {
    await this.callService('climate', 'set_temperature', entityId, { temperature: temp });
  }

  async setClimateMode(entityId: string, mode: string): Promise<void> {
    await this.callService('climate', 'set_hvac_mode', entityId, { hvac_mode: mode });
  }

  async setClimateFanMode(entityId: string, fanMode: string): Promise<void> {
    await this.callService('climate', 'set_fan_mode', entityId, { fan_mode: fanMode });
  }

  async setCoverPosition(entityId: string, position: number): Promise<void> {
    await this.callService('cover', 'set_cover_position', entityId, { position });
  }

  async coverOpen(entityId: string): Promise<void> {
    await this.callService('cover', 'open_cover', entityId);
  }

  async coverClose(entityId: string): Promise<void> {
    await this.callService('cover', 'close_cover', entityId);
  }

  async coverStop(entityId: string): Promise<void> {
    await this.callService('cover', 'stop_cover', entityId);
  }

  async setMediaPlayerVolume(entityId: string, volumeLevel: number): Promise<void> {
    await this.callService('media_player', 'volume_set', entityId, { volume_level: volumeLevel / 100 });
  }

  async mediaPlayPause(entityId: string): Promise<void> {
    await this.callService('media_player', 'media_play_pause', entityId);
  }

  async mediaNext(entityId: string): Promise<void> {
    await this.callService('media_player', 'media_next_track', entityId);
  }

  async mediaPrevious(entityId: string): Promise<void> {
    await this.callService('media_player', 'media_previous_track', entityId);
  }

  // ── Adapter Interface ──────────────────────────────────────

  async getDevices(): Promise<Device[]> {
    const devices: Device[] = [];
    for (const [id, state] of this.states) {
      const domain = id.split('.')[0];
      const gravityDomain = DOMAIN_MAP[domain];
      if (!gravityDomain) continue;

      devices.push({
        id: `ha.${id}`,
        name: state.attributes.friendly_name || id,
        type: gravityDomain as any,
        status: state.state === 'unavailable' ? 'offline' : 'online',
        lastSeen: new Date(state.last_updated),
      });
    }
    return devices;
  }

  async executeAction(action: Action): Promise<void> {
    const entityId = action.payload?.entity_id || action.deviceId;
    if (!entityId) throw new Error('No entity_id provided');

    const cmd = action.type || action.payload?.command;
    switch (cmd) {
      case 'turn_on': return this.turnOn(entityId, action.payload?.data || {});
      case 'turn_off': return this.turnOff(entityId);
      case 'toggle': return this.toggle(entityId);
      case 'set_brightness': return this.setLightBrightness(entityId, action.payload?.brightness ?? 100);
      case 'set_color': return this.setLightColor(entityId, action.payload?.r ?? 255, action.payload?.g ?? 255, action.payload?.b ?? 255);
      case 'set_temperature': return this.setClimateTemp(entityId, action.payload?.temperature ?? 24);
      case 'set_mode': return this.setClimateMode(entityId, action.payload?.mode ?? 'auto');
      case 'set_fan_mode': return this.setClimateFanMode(entityId, action.payload?.fan_mode ?? 'auto');
      case 'set_position': return this.setCoverPosition(entityId, action.payload?.position ?? 100);
      case 'open': return this.coverOpen(entityId);
      case 'close': return this.coverClose(entityId);
      case 'stop': return this.coverStop(entityId);
      case 'set_volume': return this.setMediaPlayerVolume(entityId, action.payload?.volume ?? 50);
      case 'play_pause': return this.mediaPlayPause(entityId);
      default:
        // Generic service call
        if (action.payload?.service) {
          const [svcDomain, svcName] = action.payload.service.split('/');
          return this.callService(svcDomain, svcName, entityId, action.payload?.data || {});
        }
        throw new Error(`Unknown HA command: ${cmd}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getEntityCount(): number {
    return this.states.size;
  }

  getDomainCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const id of this.states.keys()) {
      const domain = id.split('.')[0];
      counts[domain] = (counts[domain] || 0) + 1;
    }
    return counts;
  }

  // ── MQTT Auto-Discovery (expose Gravity Hub to HA) ────────

  private connectMQTT() {
    if (!this.config.mqtt) return;
    const { host, port = 1883, username, password } = this.config.mqtt;

    this.mqttClient = mqtt.connect(`mqtt://${host}:${port}`, {
      username,
      password,
      clientId: `gravity-ha-${Math.floor(Math.random() * 1000)}`,
      keepalive: 60,
    });

    this.mqttClient.on('connect', () => {
      console.log('🏠 HA MQTT: connected');
      this.publishDiscovery();
    });

    this.mqttClient.on('error', (err) => {
      console.error('🏠 HA MQTT error:', err.message);
    });
  }

  async publishDiscovery() {
    if (!this.mqttClient || !this.mqttClient.connected) return;
    const prefix = this.config.discoveryPrefix!;
    const node = 'gravity-hub';

    // Publish MirAie AC units as climate entities
    try {
      const acEntities = this.states;
      for (const [id, state] of acEntities) {
        if (!id.startsWith('climate.')) continue;
        const slug = id.replace('climate.', '');
        const configTopic = `${prefix}/climate/${node}_${slug}/config`;
        const config = {
          name: state.attributes.friendly_name || slug,
          unique_id: `gravity_${slug}`,
          state_topic: `gravity/${slug}/state`,
          command_topic: `gravity/${slug}/set`,
          temperature_state_topic: `gravity/${slug}/temp_state`,
          temperature_command_topic: `gravity/${slug}/temp_set`,
          modes: ['cool', 'heat', 'auto', 'dry', 'off'],
          availability_topic: `gravity/availability`,
          device: {
            identifiers: ['gravity-hub'],
            name: 'Gravity Hub',
            manufacturer: 'Gravity',
          },
        };
        this.mqttClient.publish(configTopic, JSON.stringify(config), { retain: true });
      }
    } catch {}

    // Publish availability
    this.mqttClient?.publish('gravity/availability', 'online', { retain: true });
  }
}
