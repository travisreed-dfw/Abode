import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * There are no passwords: the cookie simply remembers which profile this
 * browser picked. It is HttpOnly so page scripts learn the user via /api/me.
 */
export class CookieSession {
  private readonly name: string;
  private readonly maxAge: number;

  constructor(name = 'user', maxAgeSeconds = 60 * 60 * 24 * 365) {
    this.name = name;
    this.maxAge = maxAgeSeconds;
  }

  static parse(header: string | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    if (!header) return out;
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    }
    return out;
  }

  read(req: IncomingMessage): string | undefined {
    return CookieSession.parse(req.headers.cookie)[this.name];
  }

  set(res: ServerResponse, username: string): void {
    res.setHeader(
      'set-cookie',
      `${this.name}=${encodeURIComponent(username)}; Path=/; Max-Age=${this.maxAge}; SameSite=Lax; HttpOnly`,
    );
  }

  clear(res: ServerResponse): void {
    res.setHeader('set-cookie', `${this.name}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`);
  }
}
