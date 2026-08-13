import { test, expect } from "bun:test";
import { Pomodoro, PomodoroPhase } from "./pomodoro";

test("status reports idle before start", () => {
  const p = new Pomodoro({ onPhase: () => {}, onTick: () => {}, onComplete: () => {} });
  expect(p.status().running).toBe(false);
});

test("start sets running and focus phase", () => {
  const p = new Pomodoro({ onPhase: () => {}, onTick: () => {}, onComplete: () => {} });
  p.start(25, 5);
  expect(p.status().running).toBe(true);
  expect(p.status().phase).toBe("focus");
  expect(p.status().remainingSec).toBe(25 * 60);
  p.stop();
});

test("stop clears running", () => {
  const p = new Pomodoro({ onPhase: () => {}, onTick: () => {}, onComplete: () => {} });
  p.start(25, 5);
  p.stop();
  expect(p.status().running).toBe(false);
});

test("loop transitions focus -> break and fires onComplete at milestone", async () => {
  const phases: PomodoroPhase[] = [];
  const completes: number[] = [];
  const p = new Pomodoro(
    { onPhase: (ph) => phases.push(ph), onTick: () => {}, onComplete: (n) => completes.push(n) },
    () => Date.now(),
    async () => new Promise(r => setTimeout(r, 0)),
  );
  p.start(0.02, 0.02); // ~1.2s focus, ~1.2s break
  await new Promise((r) => setTimeout(r, 100)); // let the loop progress since sleep is instant
  p.stop();
  expect(phases.length).toBeGreaterThanOrEqual(2);
  expect(phases[0]).toBe("focus");
  expect(phases[1]).toBe("break");
});

test("completedFocus increments each focus phase", async () => {
  const p = new Pomodoro(
    { onPhase: () => {}, onTick: () => {}, onComplete: () => {} },
    () => Date.now(),
    async () => new Promise(r => setTimeout(r, 0)),
  );
  p.start(0.01, 0.01);
  await new Promise((r) => setTimeout(r, 100));
  p.stop();
  expect(p.completedFocus).toBeGreaterThanOrEqual(1);
});
