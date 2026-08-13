import { test, expect } from "bun:test";
import { EntityStore, Entity } from "./entities";

test("set + get round-trip", () => {
  const store = new EntityStore();
  const e: Entity = { id: "wiz:philips-a70", name: "Bedroom Light", domain: "light", state: "on", attributes: { dimming: 50 }, lastUpdated: 1 };
  store.set(e);
  expect(store.get("wiz:philips-a70")).toEqual(e);
  expect(store.get("missing")).toBeUndefined();
});

test("upsertState updates state, merges attributes, bumps lastUpdated", () => {
  const store = new EntityStore();
  store.set({ id: "a", name: "A", domain: "light", state: "off", attributes: { dimming: 10 }, lastUpdated: 0 });
  store.upsertState("a", "on", { dimming: 80 });
  const e = store.get("a")!;
  expect(e.state).toBe("on");
  expect(e.attributes.dimming).toBe(80);
  expect(e.lastUpdated).toBeGreaterThan(0);
});

test("upsertState on unknown id throws", () => {
  const store = new EntityStore();
  expect(() => store.upsertState("nope", "on")).toThrow();
});

test("all() returns insertion order", () => {
  const store = new EntityStore();
  store.set({ id: "a", name: "A", domain: "light", state: "off", attributes: {}, lastUpdated: 0 });
  store.set({ id: "b", name: "B", domain: "ac", state: "23", attributes: {}, lastUpdated: 0 });
  expect(store.all().map(e => e.id)).toEqual(["a", "b"]);
});
