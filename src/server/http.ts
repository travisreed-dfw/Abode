import type { IncomingMessage, ServerResponse } from 'node:http';

/** Error carrying an HTTP status so the app can turn it into a response. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Params = Record<string, string>;

/** Plenty for any single alias or profile; imports pass their own, larger limit. */
export const DEFAULT_BODY_LIMIT = 64 * 1024;

/**
 * Everything a route handler needs about one request, plus small helpers for
 * the response. Handlers never touch req/res directly for the common cases.
 */
export class Context {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly url: URL;
  params: Params = {};

  constructor(req: IncomingMessage, res: ServerResponse) {
    this.req = req;
    this.res = res;
    this.url = new URL(req.url ?? '/', 'http://localhost');
  }

  get method(): string {
    return this.req.method ?? 'GET';
  }

  get pathname(): string {
    return this.url.pathname;
  }

  json(status: number, body: unknown, headers: Record<string, string> = {}): void {
    this.res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
    this.res.end(JSON.stringify(body));
  }

  empty(status: number, headers: Record<string, string> = {}): void {
    this.res.writeHead(status, headers);
    this.res.end();
  }

  bytes(status: number, body: Buffer, contentType: string, headers: Record<string, string> = {}): void {
    this.res.writeHead(status, { 'content-type': contentType, ...headers });
    this.res.end(body);
  }

  /** 302 (not 301) so browsers never cache a redirect whose target later changes. */
  redirect(location: string): void {
    // setHeader (not writeHead's map) so the access log can read it back afterwards.
    this.res.setHeader('location', location);
    this.res.writeHead(302, { 'cache-control': 'no-store' });
    this.res.end();
  }

  /**
   * Cross-site HTML forms can only send urlencoded, multipart or text/plain
   * bodies, so insisting on a JSON content type blocks CSRF against the API
   * without any tokens.
   */
  requireJson(): void {
    const type = this.req.headers['content-type'] ?? '';
    if (!/^application\/json\b/i.test(type)) {
      throw new HttpError(415, 'Send a JSON body with "content-type: application/json".');
    }
  }

  async body(limit: number = DEFAULT_BODY_LIMIT): Promise<unknown> {
    this.requireJson();
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of this.req) {
      size += chunk.length;
      if (size > limit) throw new HttpError(413, 'Request body too large.');
      chunks.push(chunk as Buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.trim() === '') return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new HttpError(400, 'Body must be valid JSON.');
    }
  }

  async object(limit: number = DEFAULT_BODY_LIMIT): Promise<Record<string, unknown>> {
    const parsed = await this.body(limit);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, 'Body must be a JSON object.');
    }
    return parsed as Record<string, unknown>;
  }
}

export type Handler = (ctx: Context) => Promise<void> | void;
