import type { Alias, AliasInput, BookmarkView, BookmarksUpdate, ImportResult, ProfileSummary, User, UserInput } from '../../shared/types.js';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Typed wrapper over the server's JSON API. */
export class ApiClient {
  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `Request failed (${res.status})`;
      throw new ApiError(res.status, message);
    }
    return data as T;
  }

  // ---- aliases ----
  listAliases(): Promise<Alias[]> { return this.call('GET', '/api/aliases'); }
  createAlias(input: AliasInput): Promise<Alias> { return this.call('POST', '/api/aliases', input); }
  updateAlias(name: string, input: AliasInput): Promise<Alias> {
    return this.call('PUT', `/api/aliases/${encodeURIComponent(name)}`, input);
  }
  deleteAlias(name: string): Promise<void> { return this.call('DELETE', `/api/aliases/${encodeURIComponent(name)}`); }
  importAliases(payload: unknown): Promise<ImportResult> { return this.call('POST', '/api/import', payload); }

  // ---- profile ----
  me(): Promise<User> { return this.call('GET', '/api/me'); }
  login(username: string): Promise<User> { return this.call('POST', '/api/login', { username }); }
  register(username: string): Promise<User> { return this.call('POST', '/api/register', { username }); }
  logout(): Promise<void> { return this.call('POST', '/api/logout'); }
  updateProfile(input: UserInput): Promise<User> { return this.call('PUT', '/api/me', input); }

  // ---- bookmarks ----
  listBookmarks(): Promise<BookmarkView[]> { return this.call('GET', '/api/bookmarks'); }
  saveBookmarks(update: BookmarksUpdate): Promise<BookmarkView[]> { return this.call('PUT', '/api/bookmarks', update); }

  // ---- profile management ----
  listProfiles(): Promise<ProfileSummary[]> { return this.call('GET', '/api/users'); }
  deleteProfile(name: string): Promise<void> { return this.call('DELETE', `/api/users/${encodeURIComponent(name)}`); }
}
