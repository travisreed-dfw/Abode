/** Data shapes shared by the server, the browser code and the tests. */

export type Alias = {
  name: string;
  url: string;
  description: string;
  hits: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A bookmark button. Personal ones show only for their owner; shared ones show for everyone. */
export type Bookmark = {
  id: string;
  label: string;
  url: string;
  /** Optional section name on the home page; '' means ungrouped. */
  group: string;
  owner: string;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServiceStatus = 'up' | 'down' | null;

/** A bookmark as one profile sees it: with that profile's hidden flag and the live status. */
export type BookmarkView = Bookmark & { hidden: boolean; status: ServiceStatus; editable: boolean };

export type User = {
  name: string;
  searchEngine: string;
  theme: string;
  /** Bookmark ids this profile has hidden from its home page. */
  hidden: string[];
  /** Bookmark ids in this profile's display order; unknown ids follow in creation order. */
  order: string[];
  /** Group names this profile has collapsed on its home page. */
  collapsed: string[];
  createdAt: string;
  updatedAt: string;
};

export type AliasInput = { name?: unknown; url?: unknown; description?: unknown };
export type UserInput = { searchEngine?: unknown; theme?: unknown; collapsed?: unknown };
export type BookmarkInput = { id?: unknown; label?: unknown; url?: unknown; group?: unknown; shared?: unknown };
/**
 * What the editor saves. `bookmarks` are upserted (no id = create), `remove`
 * lists ids to delete explicitly, `hidden` and `order` are this profile's own.
 * Nothing is ever deleted by leaving it out.
 */
export type BookmarksUpdate = { bookmarks?: unknown; remove?: unknown; hidden?: unknown; order?: unknown };

export type ImportCounts = { added: number; updated: number };
/** Result of an import: alias counts at the top level (older clients), profile and bookmark counts nested. */
export type ImportResult = ImportCounts & { users: ImportCounts; bookmarks: ImportCounts };
/** What the profile list shows; bookmarks are summarised as a count of the ones the profile owns. */
export type ProfileSummary = { name: string; searchEngine: string; theme: string; bookmarks: number; createdAt: string };
export type Backup = { exportedAt: string; aliases: Alias[]; users: User[]; bookmarks: Bookmark[] };
export type Health = { ok: true; aliases: number; users: number; docker: boolean; uptimeSeconds: number };
