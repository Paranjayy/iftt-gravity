import { test, expect } from "bun:test";
import { validateRule, genId } from "./types";
import { RuleStore } from "./store";

test("genId returns unique ids", () => {
  expect(genId()).not.toBe(genId());
});

test("validateRule accepts a valid time rule", () => {
  const rule = validateRule({
    name: "AC off", mode: "time", time: "23:00", days: "daily",
    actions: [{ kind: "named", name: "ac_off" }],
  });
  expect(rule.id).toBeTruthy();
  expect(rule.enabled).toBe(true);
});

test("validateRule rejects bad time", () => {
  expect(() => validateRule({ name: "x", mode: "time", time: "25:99", actions: [] })).toThrow(/time/i);
});

test("validateRule rejects empty actions", () => {
  expect(() => validateRule({ name: "x", mode: "manual", actions: [] })).toThrow(/action/i);
});

test("validateRule rejects device action missing payload", () => {
  expect(() => validateRule({ name: "x", mode: "manual", actions: [{ kind: "device", deviceId: "wiz:philips-a70", type: "control" }] })).toThrow(/payload/i);
});

test("validateRule rejects bad op", () => {
  expect(() => validateRule({ name: "x", mode: "state", trigger: { entity: "a", op: "~", value: 1 }, actions: [{ kind: "named", name: "ac_on" }] })).toThrow(/op/i);
});

test("RuleStore persists via config save", () => {
  const saved: any[] = [];
  const config = { rules: [] as any[], save: () => saved.push([...config.rules]) };
  const store = new RuleStore(config as any);
  const r = validateRule({ name: "A", mode: "time", time: "09:00", actions: [{ kind: "named", name: "bulb_on" }] });
  store.save(r);
  expect(config.rules.length).toBe(1);
  store.save(validateRule({ name: "B", mode: "manual", actions: [{ kind: "scene", scene: "TV" }] }));
  expect(config.rules.length).toBe(2);
  store.remove(r.id);
  expect(config.rules.length).toBe(1);
  expect(saved.length).toBe(3);
});

import { istNow, dayFilterPasses, conditionPasses, RulesEngine } from "./engine";
import { EntityStore, Entity } from "../entities";
import { Rule, RuleAction } from "./types";

test("istNow gives hhmm, dow, dayName", () => {
  const d = new Date("2026-08-13T10:30:00+05:30");
  const n = istNow(d);
  expect(n.hhmm).toBe("10:30");
  expect(typeof n.dow).toBe("number");
  expect(typeof n.dayName).toBe("string");
});

test("dayFilterPasses handles daily/weekdays/weekends/comma list", () => {
  expect(dayFilterPasses(undefined, 3, "wednesday")).toBe(true);
  expect(dayFilterPasses("daily", 0, "sunday")).toBe(true);
  expect(dayFilterPasses("weekdays", 0, "sunday")).toBe(false);
  expect(dayFilterPasses("weekdays", 3, "wednesday")).toBe(true);
  expect(dayFilterPasses("weekends", 0, "sunday")).toBe(true);
  expect(dayFilterPasses("weekends", 3, "wednesday")).toBe(false);
  expect(dayFilterPasses("monday,wednesday", 3, "wednesday")).toBe(true);
  expect(dayFilterPasses("monday,wednesday", 2, "tuesday")).toBe(false);
});

test("conditionPasses evaluates ops", () => {
  const on: Entity = { id: "a", name: "A", domain: "light", state: "on", attributes: {}, lastUpdated: 0 };
  expect(conditionPasses({ entity: "a", op: "eq", value: "on" }, on)).toBe(true);
  expect(conditionPasses({ entity: "a", op: "ne", value: "off" }, on)).toBe(true);
  expect(conditionPasses({ entity: "a", op: "eq", value: "off" }, on)).toBe(false);
  const temp: Entity = { id: "t", name: "T", domain: "ac", state: "24", attributes: {}, lastUpdated: 0 };
  expect(conditionPasses({ entity: "t", op: "gt", value: 23 }, temp)).toBe(true);
  expect(conditionPasses({ entity: "t", op: "lt", value: 20 }, temp)).toBe(false);
  expect(conditionPasses({ entity: "ghost", op: "eq", value: "x" }, undefined)).toBe(false);
  expect(conditionPasses({ entity: "ghost", op: "ne", value: "x" }, undefined)).toBe(true);
});

test("RulesEngine fires a due time rule once per slot", async () => {
  const fired: string[] = [];
  const store = new EntityStore();
  const config = { save: () => {} };
  const engine = new RulesEngine(async (a: RuleAction) => { fired.push(a.kind === "named" ? a.name : a.kind); }, store, config);
  const rule: Rule = { id: "r1", name: "AC off", enabled: true, mode: "time", time: "23:00", days: "daily", actions: [{ kind: "named", name: "ac_off" }] };
  const at = new Date("2026-08-13T23:00:00+05:30");
  await engine.fire(rule, at);
  expect(fired).toEqual(["ac_off"]);
  expect(rule.lastRun).toBe(at.getTime());
  expect(rule.lastStatus).toBe("ok");
});

test("RulesEngine records error status when an action throws", async () => {
  const store = new EntityStore();
  const config = { save: () => {} };
  const engine = new RulesEngine(async () => { throw new Error("boom"); }, store, config);
  const rule: Rule = { id: "r2", name: "Bad", enabled: true, mode: "manual", actions: [{ kind: "named", name: "ac_on" }] };
  await engine.fire(rule, new Date());
  expect(rule.lastStatus).toBe("error");
  expect(rule.lastError).toContain("boom");
});

test("check() fires time rule only when hhmm matches and day filter passes", async () => {
  const fired: string[] = [];
  const store = new EntityStore();
  const config: any = { save: () => {} };
  const engine = new RulesEngine(async (a: RuleAction) => { fired.push(a.kind === "named" ? a.name : a.kind); }, store, config);
  const rule: Rule = { id: "r3", name: "9am", enabled: true, mode: "time", time: "09:00", days: "weekdays", actions: [{ kind: "named", name: "bulb_on" }] };
  const rules = [rule];
  config.rules = rules;
  await engine.check(new Date("2026-08-14T09:00:00+05:30")); // Aug 14, 2026 is Friday (weekday)
  expect(fired).toEqual(["bulb_on"]);
  fired.length = 0;
  await engine.check(new Date("2026-08-15T09:00:00+05:30")); // Aug 15, 2026 is Saturday (weekend)
  expect(fired).toEqual([]);
});
