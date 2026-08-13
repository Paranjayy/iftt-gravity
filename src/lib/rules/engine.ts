import { EntityStore, Entity } from '../entities';
import { Rule, RuleAction, RuleCondition } from './types';

export function istNow(now: Date) {
  const hhmm = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  return { hhmm, dow: now.getDay(), dayName };
}

export function dayFilterPasses(days: string | undefined, dow: number, dayName: string): boolean {
  if (!days || days === 'daily') return true;
  if (days === 'weekdays') return dow >= 1 && dow <= 5;
  if (days === 'weekends') return dow === 0 || dow === 6;
  return days.toLowerCase().split(',').map((s) => s.trim()).includes(dayName);
}

export function conditionPasses(cond: RuleCondition, entity: Entity | undefined): boolean {
  if (!entity) return cond.op === 'ne';
  const cur = String(entity.state);
  const want = String(cond.value);
  switch (cond.op) {
    case 'eq': return cur === want;
    case 'ne': return cur !== want;
    case 'gt': {
      const a = Number(cur), b = Number(cond.value);
      return !Number.isNaN(a) && !Number.isNaN(b) ? a > b : cur > want;
    }
    case 'lt': {
      const a = Number(cur), b = Number(cond.value);
      return !Number.isNaN(a) && !Number.isNaN(b) ? a < b : cur < want;
    }
  }
}

export class RulesEngine {
  constructor(
    private executeAction: (a: RuleAction) => Promise<void>,
    private store: EntityStore,
    private config: any,
  ) {}

  async check(now: Date) {
    const rules = (this.config.rules || []) as Rule[];
    const t = istNow(now);
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.mode === 'time') {
        if (rule.time !== t.hhmm) continue;
        if (!dayFilterPasses(rule.days, t.dow, t.dayName)) continue;
        const slot = t.hhmm;
        const lastSlot = rule.lastRun ? istNow(new Date(rule.lastRun)).hhmm : null;
        if (lastSlot === slot) continue;
        if (!this.conditionsPass(rule, now)) continue;
        await this.fire(rule, now);
      } else if (rule.mode === 'state' && rule.trigger) {
        const entity = this.store.get(rule.trigger.entity);
        if (entity && entity.lastUpdated > (rule.lastRun || 0)) {
          if (conditionPasses(rule.trigger, entity)) {
            if (!this.conditionsPass(rule, now)) continue;
            await this.fire(rule, now);
          }
        }
      }
    }
  }

  private conditionsPass(rule: Rule, now: Date): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;
    return rule.conditions.every((c) => conditionPasses(c, this.store.get(c.entity)));
  }

  async fire(rule: Rule, now: Date) {
    let ok = true;
    let err: string | undefined;
    for (const action of rule.actions) {
      try {
        await this.executeAction(action);
      } catch (e: any) {
        ok = false;
        err = e?.message || String(e);
        console.error(`[Rules] ${rule.name} action failed:`, e);
      }
    }
    rule.lastRun = now.getTime();
    rule.lastStatus = ok ? 'ok' : 'error';
    rule.lastError = err;
    if (typeof this.config.save === 'function') this.config.save();
  }
}
