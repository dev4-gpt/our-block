const fields: Record<string, string[]> = {
  move: ["x", "z"],
  activity: ["target"],
  buy: ["target", "account"],
  upgrade: ["target", "account"],
  bill: ["account"],
  approve: ["target"],
  cancel: ["target"],
  decline: ["target"],
  transfer: ["item", "qty", "direction"],
  give: ["item", "qty", "player"],
  deposit: ["qty"],
  refund: ["target"],
  accept: ["target"],
  renegotiate: ["target"],
  complete: ["target"],
  abandon: ["target"],
  ping: ["target", "text"],
  ack: ["target"],
  next: [],
  "return-kitchen": [],
  "negotiate-bill": [],
  companion: ["item"],
  fit: ["item"],
  test: [],
};
export function validateCommand(m: any) {
  if (
    !m ||
    typeof m !== "object" ||
    Array.isArray(m) ||
    !Object.hasOwn(fields, m.type)
  )
    throw Error("Invalid action type.");
  const allowed = new Set(["v", "id", "revision", "type", ...fields[m.type]]);
  if (
    Object.keys(m).some((k) => !allowed.has(k)) ||
    m.v !== 1 ||
    typeof m.id !== "string" ||
    !m.id.length ||
    m.id.length > 99 ||
    !Number.isSafeInteger(m.revision) ||
    m.revision < 0
  )
    throw Error("Invalid command shape.");
  for (const [key, value] of Object.entries(m)) {
    if (
      ["target", "item", "player", "text", "account", "direction"].includes(
        key,
      ) &&
      (typeof value !== "string" || value.length > 120)
    )
      throw Error("Invalid action field.");
  }
  if (m.direction !== undefined && !["take", "store"].includes(m.direction))
    throw Error("Invalid transfer direction.");
  if (m.account !== undefined && !["shared", "personal"].includes(m.account))
    throw Error("Invalid account.");
  for (const key of ["x", "z", "qty"])
    if (
      m[key] !== undefined &&
      (typeof m[key] !== "number" || !Number.isFinite(m[key]))
    )
      throw Error("Invalid numeric field.");
  return m;
}
export function errorCode(message: string) {
  return message.startsWith("STALE:")
    ? "STALE"
    : message.startsWith("CAPACITY:")
      ? "CAPACITY"
      : message.startsWith("READ_ONLY:")
        ? "READ_ONLY"
        : /Save|storage|database/i.test(message)
          ? "STORAGE"
          : "RULE";
}
/** No X-Forwarded-For trust: default to the actual transport peer, even behind a proxy. */
export class Budget {
  private buckets = new Map<string, { at: number; n: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}
  take(key: string, now = Date.now()) {
    if (this.buckets.size > 10000)
      for (const [k, v] of this.buckets)
        if (now - v.at > this.windowMs) this.buckets.delete(k);
    const b = this.buckets.get(key);
    if (!b || now - b.at >= this.windowMs) {
      if (this.buckets.size >= 10000) return false;
      this.buckets.set(key, { at: now, n: 1 });
      return true;
    }
    return ++b.n <= this.limit;
  }
}
