import { el, icon } from '../lib/dom.js';
import { applyTheme, clearTheme, themeOptions } from '../lib/theme.js';
import type { ApiClient } from '../lib/api.js';
import type { User } from '../../shared/types.js';

/**
 * The account end of every page's nav: theme picker, profile pill and Log out
 * when a profile is signed in, otherwise a Log in link to the home page.
 * The page links themselves stay in the HTML.
 */
export class SiteNav {
  private readonly slot: HTMLElement;
  private user: User | null = null;

  constructor(
    nav: HTMLElement,
    private readonly api: ApiClient,
    private readonly onLogout: () => void = () => location.assign('/'),
  ) {
    this.slot = el('span', { className: 'nav-account' });
    nav.append(this.slot);
  }

  /** Looks up the current profile and renders accordingly. */
  get current(): User | null {
    return this.user;
  }

  async init(): Promise<User | null> {
    const me = await this.api.me().catch(() => null);
    this.setUser(me);
    return me;
  }

  setUser(user: User | null): void {
    this.user = user;
    if (!user) {
      clearTheme();
      const login = el('a', { href: '/', className: 'nav-login' }, icon('user'), el('span', { className: 'nav-label' }, 'Log in'));
      login.setAttribute('aria-label', 'Log in');
      this.slot.replaceChildren(login);
      return;
    }
    applyTheme(user.theme);

    const select = el('select', { id: 'theme-select' }, ...themeOptions().map((t) => el('option', { value: t.id }, t.label)));
    select.setAttribute('aria-label', 'Color theme');
    select.value = user.theme;
    select.addEventListener('change', async () => {
      const previous = this.user?.theme ?? user.theme;
      applyTheme(select.value);
      try {
        this.user = await this.api.updateProfile({ theme: select.value });
      } catch (err) {
        applyTheme(previous);
        select.value = previous;
        alert(err instanceof Error ? err.message : String(err));
      }
    });

    const logout = el('button', { type: 'button', className: 'link-button' }, icon('logout'), el('span', { className: 'nav-label' }, 'Log out'));
    logout.setAttribute('aria-label', 'Log out');
    logout.addEventListener('click', async () => {
      await this.api.logout();
      this.user = null;
      clearTheme();
      this.onLogout();
    });

    this.slot.replaceChildren(
      el('span', { className: 'select-wrap theme-wrap' }, select),
      el('span', { className: 'user-name' }, user.name),
      logout,
    );
  }
}
