export interface BulbSnapshot {
  state?: boolean;
  dimming?: number;
  sceneId?: number;
  temp?: number;
  r?: number;
  g?: number;
  b?: number;
}

export interface BlinkSpec {
  times?: number;
  onMs?: number;
  offMs?: number;
  color?: { r: number; g: number; b: number };
  dim?: number;
}

export class CueLayer {
  constructor(
    private getPilot: () => Promise<any | null>,
    private setPilot: (params: any) => Promise<void>,
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async snapshotBulb(): Promise<BulbSnapshot | null> {
    const p = await this.getPilot();
    if (!p) return null;
    const snap: BulbSnapshot = {};
    if (p.state !== undefined) snap.state = p.state;
    if (p.dimming !== undefined) snap.dimming = p.dimming;
    if (p.sceneId !== undefined) snap.sceneId = p.sceneId;
    if (p.temp !== undefined) snap.temp = p.temp;
    if (p.r !== undefined) snap.r = p.r;
    if (p.g !== undefined) snap.g = p.g;
    if (p.b !== undefined) snap.b = p.b;
    return snap;
  }

  async restoreBulb(snap: BulbSnapshot) {
    await this.setPilot(snap);
  }

  async blink(spec: BlinkSpec = {}) {
    const times = spec.times ?? 2;
    const onMs = spec.onMs ?? 400;
    const offMs = spec.offMs ?? 200;
    const on = spec.color ? { state: true, dimming: spec.dim ?? 100, r: spec.color.r, g: spec.color.g, b: spec.color.b } : { state: true, dimming: spec.dim ?? 100 };
    for (let i = 0; i < times; i++) {
      try {
        await this.setPilot(on);
      } catch (e) {
        console.error('[Cue] blink failed:', e);
        return;
      }
      await this.sleep(onMs);
      try {
        await this.setPilot({ state: false });
      } catch (e) {
        console.error('[Cue] blink off failed:', e);
        return;
      }
      if (i < times - 1) await this.sleep(offMs);
    }
  }

  async cueAndRestore(spec: BlinkSpec = {}) {
    const snap = await this.snapshotBulb();
    if (!snap) return;
    await this.blink(spec);
    try {
      await this.restoreBulb(snap);
    } catch (e) {
      console.error('[Cue] restore failed:', e);
    }
  }
}
