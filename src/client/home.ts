import { $ } from './lib/dom.js';
import { ApiClient } from './lib/api.js';
import { LoginView } from './components/login.js';
import { SearchBar } from './components/search-bar.js';
import { BookmarkGrid, BookmarkEditor } from './components/bookmarks.js';
import { localizePage } from './lib/site.js';
import { SiteNav } from './components/nav.js';
import { InstallTip } from './components/install-tip.js';
import type { BookmarkView, User } from '../shared/types.js';

/** The start page: login card, then search bar + bookmarks for the signed-in profile. */
class HomePage {
  private readonly api = new ApiClient();
  private readonly login: LoginView;
  private readonly dashboard: HTMLElement;
  private readonly nav: SiteNav;
  // Created before any await so Chrome's early beforeinstallprompt event isn't missed.
  private readonly installTip = new InstallTip($('#install-tip'));
  private readonly editBtn: HTMLButtonElement;
  private readonly grid: BookmarkGrid;
  private readonly editor: BookmarkEditor;
  private search: SearchBar | null = null;
  private user: User | null = null;
  private bookmarks: BookmarkView[] = [];
  private aliasNames: string[] = [];
  private poll: number | null = null;

  constructor() {
    this.login = new LoginView($('#login-view'), this.api, (user) => this.showDashboard(user));
    this.dashboard = $('#dashboard-view');
    this.editBtn = $('#edit-bookmarks-btn', this.dashboard);
    this.nav = new SiteNav($('.page-nav', this.dashboard), this.api, () => {
      this.user = null;
      if (this.poll !== null) window.clearInterval(this.poll);
      this.poll = null;
      this.dashboard.hidden = true;
      this.login.show();
    });
    this.grid = new BookmarkGrid(this.dashboard);
    this.editor = new BookmarkEditor(
      this.dashboard,
      async (update) => { this.bookmarks = await this.api.saveBookmarks(update); },
      () => this.closeEditor(),
    );

    this.editBtn.addEventListener('click', () => {
      if (!this.user) return;
      this.editor.open(this.bookmarks, this.user.name);
      this.grid.visible = false;
      this.editBtn.hidden = true;
    });
  }

  async boot(): Promise<void> {
    const [me, aliases] = await Promise.all([
      this.api.me().catch(() => null),
      this.api.listAliases().catch(() => []),
    ]);
    this.aliasNames = aliases.map((a) => a.name);
    if (me) this.showDashboard(me);
    else this.login.show();
    this.installTip.render();
  }

  private showDashboard(user: User): void {
    this.user = user;
    this.login.hide();
    void this.refreshBookmarks();
    if (this.poll === null) this.poll = window.setInterval(() => void this.refreshBookmarks(), 60_000);
    this.dashboard.hidden = false;
    this.nav.setUser(user);
    if (!this.search) {
      this.search = new SearchBar(this.dashboard, user.searchEngine, async (searchEngine) => {
        this.user = await this.api.updateProfile({ searchEngine });
      });
    } else {
      this.search.setEngine(user.searchEngine);
    }
    this.search.setAliasNames(this.aliasNames);
    // A previous session may have logged out mid-edit; close() also restores the grid.
    if (this.editor.isOpen) this.editor.close();
    else this.closeEditor();
    this.search.focus();
  }

  /** Reloads bookmarks (and their status dots). Leaves an open editor alone. */
  private async refreshBookmarks(): Promise<void> {
    if (!this.user) return;
    try {
      this.bookmarks = await this.api.listBookmarks();
    } catch {
      return;
    }
    if (!this.editor.isOpen) this.grid.render(this.bookmarks);
  }

  private closeEditor(): void {
    this.grid.visible = true;
    this.editBtn.hidden = false;
    if (this.user) this.grid.render(this.bookmarks);
  }
}

localizePage();
void new HomePage().boot();
