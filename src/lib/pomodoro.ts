export type PomodoroPhase = 'focus' | 'break';

export class Pomodoro {
  private runningFlag = false;
  private currentPhase: PomodoroPhase | null = null;
  private remaining = 0;
  private _completedFocus = 0;
  private loopId = 0;

  constructor(
    private opts: { onPhase: (phase: PomodoroPhase, remainingSec: number) => void; onTick: (phase: PomodoroPhase, remainingSec: number) => void; onComplete: (completedFocus: number) => void },
    private clock: () => number = Date.now,
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  get completedFocus() {
    return this._completedFocus;
  }

  status() {
    return { running: this.runningFlag, phase: this.currentPhase, remainingSec: this.remaining };
  }

  start(focusMin = 25, breakMin = 5) {
    this.stop();
    const id = ++this.loopId;
    this.runningFlag = true;
    this.currentPhase = 'focus';
    this.remaining = Math.max(1, Math.round(focusMin * 60));
    this._completedFocus = 0;
    this.opts.onPhase(this.currentPhase, this.remaining);
    this.runLoop(id, focusMin, breakMin);
  }

  stop() {
    this.runningFlag = false;
    this.loopId++;
  }

  private async runLoop(id: number, focusMin: number, breakMin: number) {
    while (this.runningFlag && id === this.loopId) {
      if (this.currentPhase === 'focus') {
        const secs = Math.max(1, Math.round(focusMin * 60));
        await this.runPhase(id, 'focus', secs);
        if (!this.runningFlag || id !== this.loopId) return;
        this._completedFocus++;
        if (this._completedFocus % 4 === 0) this.opts.onComplete(this._completedFocus);
        this.currentPhase = 'break';
        this.remaining = Math.max(1, Math.round(breakMin * 60));
        this.opts.onPhase(this.currentPhase, this.remaining);
      } else {
        const secs = Math.max(1, Math.round(breakMin * 60));
        await this.runPhase(id, 'break', secs);
        if (!this.runningFlag || id !== this.loopId) return;
        this.currentPhase = 'focus';
        this.remaining = Math.max(1, Math.round(focusMin * 60));
        this.opts.onPhase(this.currentPhase, this.remaining);
      }
    }
  }

  private async runPhase(id: number, phase: PomodoroPhase, totalSec: number) {
    for (let s = totalSec; s > 0; s--) {
      if (!this.runningFlag || id !== this.loopId) return;
      this.remaining = s;
      this.opts.onTick(phase, s);
      await this.sleep(1000);
    }
  }
}
