/**
 * Response security headers (T29, spec section 24). One place builds the CSP so the static server and the API agree.
 * There is no wasm, no unsafe-eval, no unsafe-inline and no inline script or style in the built page.
 */
export function contentSecurityPolicy(publicOrigin: string): string {
  const u = new URL(publicOrigin);
  const ws = `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' ${ws}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}

export function securityHeaders(publicOrigin: string): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(publicOrigin),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}

/** Exact match against the allowlist. A missing Origin (non-browser client) is reported separately so callers choose. */
export function originOk(origin: string | null | undefined, allowed: readonly string[]): "ok" | "missing" | "foreign" {
  if (origin === undefined || origin === null || origin === "") return "missing";
  return allowed.includes(origin) ? "ok" : "foreign";
}
