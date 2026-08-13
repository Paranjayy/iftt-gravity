import { test, expect } from "bun:test";
import { findMissedTimeRules, findFailedRules, RuleSentry } from "./sentry";
import { Rule } from "./types";

function mkRule(partial: Partial<Rule>): Rule {
  return { id: "r", name: "r", enabled: true, mode: "time", actions: [], ...partial } as Rule;
}

test("findMissedTimeRules flags a rule whose slot passed today without lastRun", () => {
  const now = new Date("2026-08-13T23:30:00+05:30");
  const rules = [mkRule({ id: "a", time: "23:00", days: "daily" })];
  expect(findMissedTimeRules(rules, now).map((r) => r.id)).toEqual(["a"]);
});

test("findMissedTimeRules does not flag if lastRun matches today's slot", () => {
  const now = new Date("2026-08-13T23:30:00+05:30");
  const lastRun = new Date("2026-08-13T23:00:00+05:30").getTime();
  const rules = [mkRule({ id: "a", time: "23:00", days: "daily", lastRun })];
  expect(findMissedTimeRules(rules, now)).toEqual([]);
});

test("findMissedTimeRules does not flag a future slot", () => {
  const now = new Date("2026-08-13T10:00:00+05:30");
  const rules = [mkRule({ id: "a", time: "23:00", days: "daily" })];
  expect(findMissedTimeRules(rules, now)).toEqual([]);
});

test("findMissedTimeRules respects day filter", () => {
  const now = new Date("2026-08-15T23:30:00+05:30"); // Saturday
  const rules = [mkRule({ id: "a", time: "23:00", days: "weekdays" })];
  expect(findMissedTimeRules(rules, now)).toEqual([]);
});

test("findFailedRules returns error rules", () => {
  const rules = [
    mkRule({ id: "ok", lastStatus: "ok" }),
    mkRule({ id: "bad", lastStatus: "error", lastError: "boom" }),
  ];
  expect(findFailedRules(rules).map((r) => r.id)).toEqual(["bad"]);
});

test("RuleSentry alerts once per 30min and flashes", async () => {
  const now = new Date("2026-08-13T23:05:00+05:30").getTime();
  let flashes = 0;
  let notified: string[] = [];
  const config: any = { sentry: { enabled: true, lastAlertedAt: {} }, save: () => {} };
  const sentry = new RuleSentry(config, { redFlash: async () => { flashes++; } }, async (t) => { notified.push(t); });
  const rules = [mkRule({ id: "a", time: "23:00", days: "daily" })];
  await sentry.check(rules, new Date(now));
  expect(flashes).toBe(1);
  expect(notified.length).toBe(1);
  expect(config.sentry.lastAlertedAt.a).toBeGreaterThan(0);
  // second check within 30 min: no duplicate
  await sentry.check(rules, new Date(now + 60_000));
  expect(flashes).toBe(1);
  // after 30 min: alerts again
  await sentry.check(rules, new Date(now + 31 * 60_000));
  expect(flashes).toBe(2);
});

test("RuleSentry respects disabled flag", async () => {
  let flashes = 0;
  const config: any = { sentry: { enabled: false, lastAlertedAt: {} }, save: () => {} };
  const sentry = new RuleSentry(config, { redFlash: async () => { flashes++; } }, async () => {});
  await sentry.check([mkRule({ id: "a", time: "23:00", days: "daily" })], new Date("2026-08-13T23:30:00+05:30"));
  expect(flashes).toBe(0);
});
