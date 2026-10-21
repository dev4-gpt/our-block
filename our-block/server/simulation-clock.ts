/** Skip overlapping work without discarding the time spent waiting for storage. */
export class SimulationClock {
  private last: number;
  private busy = false;
  constructor(now: number) {
    this.last = now;
  }
  begin(now: number): number | undefined {
    if (this.busy) return;
    this.busy = true;
    // Cap catch-up after machine suspension; normal save latency is retained.
    const dt = Math.max(0, Math.min(2, (now - this.last) / 1000));
    this.last = now;
    return dt;
  }
  end() {
    this.busy = false;
  }
}
