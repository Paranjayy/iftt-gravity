import { Rule } from './types';
import { istNow, dayFilterPasses } from './engine';

export function findMissedTimeRules(rules: Rule[], now: Date): Rule[] {
  const t = istNow(now);
  const missed: Rule[] = [];
  for (const rule of rules) {
    if (!rule.enabled || rule.mode !== 'time' || !rule.time) continue;
    if (rule.time > t.hhmm) continue; // slot not reached yet today
    if (!dayFilterPasses(rule.days, t.dow, t.dayName)) continue;
    const ranToday = rule.lastRun !== undefined && istNow(new Date(rule.lastRun)).hhmm === rule.time;
    if (!ranToday) missed.push(rule);
  }
  return missed;
}

export function findFailedRules(rules: Rule[]): Rule[] {
  return rules.filter((r) => r.enabled && r.lastStatus === 'error' && r.lastError);
}

export class RuleSentry {
  constructor(
    private config: any,
    private cue: { redFlash: () => Promise<void> },
    private notify: (text: string) => Promise<void>,
  ) {}

  enabled() {
    return this.config.sentry?.enabled !== false;
  }

  async check(rules: Rule[], now: Date) {
    if (!this.enabled()) return;
    const t = now.getTime();
    const alertState = this.config.sentry || (this.config.sentry = { enabled: true, lastAlertedAt: {} });
    const alertedAt = alertState.lastAlertedAt || (alertState.lastAlertedAt = {});
    const alerts = [...findMissedTimeRules(rules, now), ...findFailedRules(rules)];
    for (const rule of alerts) {
      const last = alertedAt[rule.id] || 0;
      if (t - last < 30 * 60 * 1000) continue;
      alertedAt[rule.id] = t;
      const why = rule.lastStatus === 'error'
        ? `failed: ${rule.lastError}`
        : `missed its ${rule.time} slot today`;
      console.warn(`[Sentry] ${rule.name} ${why}`);
      try { await this.cue.redFlash(); } catch (e) { console.error('[Sentry] flash failed', e); }
      await this.notify(`⚠️ *Automation Sentry*\nRule *"${rule.name}"* ${why}.`);
    }
    if (typeof this.config.save === 'function') this.config.save();
  }
}
