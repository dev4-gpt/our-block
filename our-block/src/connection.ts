export type JoinRequest = {
  name?: string;
  code?: string;
  mode?: string;
  token?: string;
};
type SocketLike = {
  readyState: number;
  onopen: ((e: any) => void) | null;
  onmessage: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onclose: ((e: any) => void) | null;
  send(data: string): void;
  close(): void;
};
type Options = {
  url: string;
  health: () => Promise<void>;
  socket: (url: string) => SocketLike;
  message: (message: any) => void;
  status: (text: string, ready: boolean) => void;
  uncertain: () => void;
  schedule?: (fn: () => void, ms: number) => any;
  cancel?: (handle: any) => void;
  now?: () => number;
};
/** Reconnects seats only. Economic commands are never queued or retransmitted. */
export class TownConnection {
  private ws?: SocketLike;
  private request?: JoinRequest;
  private timer: any;
  private deadline: any;
  private generation = 0;
  private attempts = 0;
  private retryStarted?: number;
  private budgetTimer: any;
  private ready = false;
  private stopped = true;
  private pending = new Set<string>();
  private movementTimer: any;
  constructor(private options: Options) {}
  private schedule(fn: () => void, ms: number) {
    return (this.options.schedule || setTimeout)(fn, ms);
  }
  private cancel(handle: any) {
    if (handle !== undefined) (this.options.cancel || clearTimeout)(handle);
  }
  start(request: JoinRequest) {
    this.stop();
    this.request = { ...request };
    this.stopped = false;
    this.attempts = 0;
    this.retryStarted = undefined;
    this.retry(this.generation);
    this.cancel(this.timer);
    this.attempts = 0;
    void this.open(this.generation);
  }
  stop() {
    this.stopped = true;
    this.ready = false;
    this.generation++;
    this.cancel(this.timer);
    this.cancel(this.deadline);
    this.cancel(this.budgetTimer);
    this.cancel(this.movementTimer);
    this.retryStarted = undefined;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.pending.clear();
  }
  send(command: { id: string; type: string; [key: string]: unknown }) {
    if (!this.ready || this.ws?.readyState !== 1) return false;
    if (!["move", "ping", "ack"].includes(command.type))
      this.pending.add(command.id);
    this.ws.send(JSON.stringify(command));
    if (command.type === "move") this.watchMovement(this.ws);
    return true;
  }
  /** Only expect updates during movement; idle towns generate no watchdog traffic. */
  private watchMovement(ws: SocketLike) {
    this.cancel(this.movementTimer);
    this.movementTimer = this.schedule(() => {
      if (this.stopped || this.ws !== ws) return;
      this.ready = false;
      // Detach the old socket: late frames must not overwrite the recovered view.
      ws.onclose = null;
      ws.onmessage = null;
      ws.close();
      this.retry(this.generation);
    }, 5000);
  }
  resume() {
    if (this.stopped || !this.ready || !this.ws) return;
    const ws = this.ws;
    this.ready = false;
    ws.onclose = null;
    ws.onmessage = null;
    ws.close();
    this.retry(this.generation);
  }
  private retry(generation: number) {
    if (this.stopped || generation !== this.generation) return;
    this.ready = false;
    this.cancel(this.movementTimer);
    if (this.pending.size) {
      this.pending.clear();
      this.options.uncertain();
    }
    if (this.retryStarted === undefined) {
      this.retryStarted = (this.options.now || Date.now)();
      this.budgetTimer = this.schedule(() => {
        if (this.ready || this.stopped || generation !== this.generation)
          return;
        this.cancel(this.timer);
        this.cancel(this.deadline);
        if (this.ws) {
          this.ws.onclose = null;
          this.ws.close();
        }
        this.generation++;
        this.options.status(
          "Unable to connect after 90 seconds. Use Reconnect to try again; no purchase was retried.",
          false,
        );
      }, 90000);
    }
    if (++this.attempts > 10) {
      this.options.status(
        "Unable to reconnect. Try again when the server is available.",
        false,
      );
      return;
    }
    this.options.status(
      "Waking the server or reconnecting… Your progress is saved.",
      false,
    );
    this.timer = this.schedule(
      () => void this.open(generation),
      Math.min(1000 * 2 ** (this.attempts - 1), 15000),
    );
  }
  private async open(generation: number) {
    if (this.stopped || generation !== this.generation) return;
    this.options.status(
      "Waking the server… Free hosting can take about a minute.",
      false,
    );
    try {
      await this.options.health();
    } catch {
      this.retry(generation);
      return;
    }
    if (this.stopped || generation !== this.generation) return;
    const ws = this.options.socket(this.options.url);
    this.ws = ws;
    let joinSent = false,
      joined = false,
      failedJoin = false;
    this.deadline = this.schedule(() => ws.close(), 20000);
    ws.onopen = () => {
      if (this.stopped || generation !== this.generation) {
        ws.close();
        return;
      }
      joinSent = true;
      ws.send(JSON.stringify({ type: "join", ...this.request }));
    };
    ws.onmessage = (e) => {
      if (this.stopped || generation !== this.generation || this.ws !== ws) return;
      let m: any;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "joined") {
        this.request = { code: m.code, token: m.token };
        joined = true;
        this.attempts = 0;
      }
      if (m.type === "state" && joined) {
        this.cancel(this.movementTimer);
        if (m.state?.players?.some((p: any) => p.online && p.target))
          this.watchMovement(ws);
        this.cancel(this.budgetTimer);
        this.retryStarted = undefined;
        this.cancel(this.deadline);
        this.ready = true;
        this.options.status("", true);
      }
      if (m.type === "result" || m.type === "error") {
        if (m.id) this.pending.delete(m.id);
      }
      if (m.type === "error" && !joined) {
        failedJoin = true;
        this.cancel(this.budgetTimer);
        this.cancel(this.deadline);
        ws.close();
        this.options.status(m.message, false);
      }
      this.options.message(m);
    };
    ws.onerror = () => {}; // close owns retries; never submit a second copy of an action.
    ws.onclose = (e) => {
      this.cancel(this.movementTimer);
      this.cancel(this.deadline);
      if (this.stopped || generation !== this.generation) return;
      this.ready = false;
      if (e.code === 4001) {
        this.cancel(this.budgetTimer);
        this.options.status(
          "This seat was opened elsewhere. Reconnect here only if you want to move it back.",
          false,
        );
        return;
      }
      if (failedJoin) return;
      if (joinSent && !this.request?.token) {
        this.cancel(this.budgetTimer);
        this.options.status(
          "The connection closed before a seat was confirmed. Check the invitation or start again; no purchase was retried.",
          false,
        );
        return;
      }
      this.retry(generation);
    };
  }
}
