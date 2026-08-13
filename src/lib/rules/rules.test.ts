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
