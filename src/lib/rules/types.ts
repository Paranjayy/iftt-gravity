export type RuleMode = 'time' | 'state' | 'manual';

export interface RuleCondition {
  entity: string;
  op: 'eq' | 'ne' | 'gt' | 'lt';
  value: string | number;
}

export type RuleAction =
  | { kind: 'named'; name: string; params?: any }
  | { kind: 'scene'; scene: string }
  | { kind: 'device'; deviceId: string; type: 'control'; payload: any };

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  mode: RuleMode;
  time?: string;
  days?: string;
  trigger?: RuleCondition;
  scene?: string;
  actions: RuleAction[];
  conditions?: RuleCondition[];
  lastRun?: number;
  lastStatus?: 'ok' | 'error';
  lastError?: string;
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const OPS = ['eq', 'ne', 'gt', 'lt'];

export function validateRule(input: any): Rule {
  if (!input || typeof input.name !== 'string' || input.name.trim() === '') {
    throw new Error('Rule name is required');
  }
  if (!['time', 'state', 'manual'].includes(input.mode)) {
    throw new Error('Rule mode must be time, state, or manual');
  }
  if (input.mode === 'time') {
    if (typeof input.time !== 'string' || !/^\d{2}:\d{2}$/.test(input.time)) {
      throw new Error('Time rules need a valid time (HH:MM)');
    }
    const [h, m] = input.time.split(':').map(Number);
    if (h > 23 || m > 59) throw new Error('Time rules need a valid time (HH:MM)');
  }
  if (input.mode === 'state' && !input.trigger?.entity) {
    throw new Error('State rules need a trigger entity');
  }
  if (input.trigger && !OPS.includes(input.trigger.op)) {
    throw new Error(`Trigger op must be one of: ${OPS.join(', ')}`);
  }
  for (const c of input.conditions || []) {
    if (!OPS.includes(c.op)) throw new Error(`Condition op must be one of: ${OPS.join(', ')}`);
  }
  if (!Array.isArray(input.actions) || input.actions.length === 0) {
    throw new Error('Rule needs at least one action');
  }
  for (const a of input.actions) {
    if (a.kind === 'named' && typeof a.name !== 'string') throw new Error('named action needs a name');
    if (a.kind === 'scene' && typeof a.scene !== 'string') throw new Error('scene action needs a scene name');
    if (a.kind === 'device' && (typeof a.deviceId !== 'string' || !a.payload)) throw new Error('device action needs deviceId and payload');
    if (!['named', 'scene', 'device'].includes(a.kind)) throw new Error('Unknown action kind: ' + a.kind);
  }
  const rule: Rule = {
    id: input.id || genId(),
    name: input.name.trim(),
    enabled: input.enabled !== false,
    mode: input.mode,
    actions: input.actions,
  };
  if (input.time !== undefined) rule.time = input.time;
  if (input.days !== undefined) rule.days = input.days;
  if (input.trigger !== undefined) rule.trigger = input.trigger;
  if (input.scene !== undefined) rule.scene = input.scene;
  if (input.conditions !== undefined) rule.conditions = input.conditions;
  if (input.lastRun !== undefined) rule.lastRun = input.lastRun;
  if (input.lastStatus !== undefined) rule.lastStatus = input.lastStatus;
  if (input.lastError !== undefined) rule.lastError = input.lastError;
  return rule;
}
