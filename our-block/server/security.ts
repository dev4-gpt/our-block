import type { ServerResponse } from "node:http";

export function securityHeaders(
  res: ServerResponse,
  production: boolean,
  host = "",
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  if (!production) return; // Vite's development runtime needs a different policy.
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  // Some WebKit versions need an explicit secure WebSocket origin alongside 'self'.
  const socketOrigin = /^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host)
    ? ` wss://${host}`
    : "";
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self'${socketOrigin}`,
      "img-src 'self' data:",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'self' https://app.joinhandshake.com https://ai.joinhandshake.com",
    ].join("; "),
  );
}

/** Bounds pending handshakes separately from admitted players. Never trusts forwarding headers. */
export class AdmissionGate {
  private pending = new Map<object, string>();
  constructor(
    private limit = 8,
    private perSource = 4,
  ) {}
  reserve(connection: object, source: string) {
    if (
      this.pending.size >= this.limit ||
      [...this.pending.values()].filter((value) => value === source).length >=
        this.perSource
    )
      return false;
    this.pending.set(connection, source);
    return true;
  }
  release(connection: object) {
    this.pending.delete(connection);
  }
}
