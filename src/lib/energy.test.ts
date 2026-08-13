import { test, expect } from "bun:test";
import { calculatePgvclBill, estimateSceneCostPerHour, DEVICE_KW } from "./energy";

test("calculatePgvclBill matches known slab math", () => {
  // 1 unit: energy 3.05 + fpppa 2.85 + fixed 35 = 40.90, +15% = 47.035 -> 47.03
  expect(calculatePgvclBill(1)).toBe("47.03");
  expect(calculatePgvclBill(1, false)).toBe("6.79"); // 5.90 * 1.15 = 6.785 -> rounds to 6.79 on some engines
});

test("estimateSceneCostPerHour sums AC + bulb", () => {
  const { kw, rupeesPerHour } = estimateSceneCostPerHour([
    { kind: "device", deviceId: "mir:panasonic-ac", type: "control", payload: { ps: "on" } },
    { kind: "device", deviceId: "wiz:philips-a70", type: "control", payload: { state: true } },
  ]);
  expect(kw).toBeCloseTo(DEVICE_KW.ac + DEVICE_KW.light, 5);
  expect(rupeesPerHour).toBeGreaterThan(0);
});

test("estimateSceneCostPerHour handles scene action approximation", () => {
  const { kw } = estimateSceneCostPerHour([{ kind: "scene", scene: "TV_TIME" }]);
  expect(kw).toBeCloseTo(DEVICE_KW.ac + DEVICE_KW.light, 5);
});

test("unknown device contributes zero", () => {
  const { kw } = estimateSceneCostPerHour([{ kind: "device", deviceId: "st:samsung-tv", type: "control", payload: {} }]);
  expect(kw).toBe(0);
});
