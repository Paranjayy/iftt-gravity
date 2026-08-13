import { test, expect } from "bun:test";
import { CueLayer, BulbSnapshot } from "./cues";

function makeLayer() {
  const pilot: any = { state: true, dimming: 20, sceneId: 13, temp: 6500, r: undefined, g: undefined, b: undefined };
  const calls: any[] = [];
  const sleeps: number[] = [];
  const layer = new CueLayer(
    async () => ({ ...pilot }),
    async (p) => { calls.push(p); Object.assign(pilot, p); },
    async (ms) => { sleeps.push(ms); },
  );
  return { layer, pilot, calls, sleeps };
}

test("snapshotBulb reads full pilot", async () => {
  const { layer } = makeLayer();
  const snap = await layer.snapshotBulb();
  expect(snap).toEqual({ state: true, dimming: 20, sceneId: 13, temp: 6500 });
});

test("snapshotBulb returns null when pilot missing", async () => {
  const layer = new CueLayer(async () => null, async () => {});
  expect(await layer.snapshotBulb()).toBeNull();
});

test("restoreBulb pushes exact snapshot", async () => {
  const { layer, calls } = makeLayer();
  const snap: BulbSnapshot = { state: true, dimming: 20, sceneId: 13, temp: 6500 };
  await layer.restoreBulb(snap);
  expect(calls[calls.length - 1]).toEqual(snap);
});

test("cueAndRestore blinks then restores original pilot", async () => {
  const { layer, calls } = makeLayer();
  await layer.cueAndRestore({ times: 2, onMs: 100, offMs: 50, color: { r: 255, g: 0, b: 0 } });
  const onCalls = calls.filter((c) => c.r !== undefined);
  expect(onCalls.length).toBe(2);
  const final = calls[calls.length - 1];
  expect(final.dimming).toBe(20);
  expect(final.sceneId).toBe(13);
});

test("cueAndRestore skips when no pilot", async () => {
  const layer = new CueLayer(async () => null, async () => { throw new Error("should not be called"); });
  await layer.cueAndRestore({ times: 3 });
});

test("cueAndRestore still restores if a blink fails", async () => {
  let failOnce = true;
  let restored = false;
  const layer = new CueLayer(
    async () => ({ state: true, dimming: 30 }),
    async (p) => {
      if (failOnce) { failOnce = false; throw new Error("offline"); }
      if (p.dimming === 30) restored = true;
    },
  );
  await layer.cueAndRestore({ times: 2, onMs: 50, offMs: 50 });
  expect(restored).toBe(true);
});
