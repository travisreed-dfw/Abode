import { el, icon } from '../lib/dom.js';

const DISMISS_KEY = 'alias.installTipDismissed';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

/**
 * A one-line nudge to install the page as an app. It only ever renders on
 * phones and tablets (the stylesheet hides it above 640px), never once the
 * page is already running installed, and never again after being dismissed.
 * On Android/Chrome the button triggers the real install prompt; on iOS,
 * which has no such API, it explains the Share menu route.
 */
export class InstallTip {
  private readonly root: HTMLElement;
  private prompt: BeforeInstallPromptEvent | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.prompt = e as BeforeInstallPromptEvent;
      this.render();
    });
  }

  static get shouldShow(): boolean {
    if (window.matchMedia('(display-mode: standalone)').matches) return false;
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return false;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return false;
    } catch {
      // storage unavailable: just show it
    }
    return true;
  }

  render(): void {
    if (!InstallTip.shouldShow) {
      this.root.hidden = true;
      return;
    }
    const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const dismiss = el('button', { type: 'button', className: 'link-button' }, icon('close', 'Dismiss'));
    dismiss.addEventListener('click', () => {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        // fine
      }
      this.root.hidden = true;
    });

    let body: (Node | string)[];
    if (this.prompt) {
      const install = el('button', { type: 'button', className: 'primary' }, icon('download'), 'Install');
      install.addEventListener('click', async () => {
        await this.prompt?.prompt();
        this.root.hidden = true;
      });
      body = ['Add this page to your home screen.', install];
    } else if (isApple) {
      body = ['Add to your home screen: tap ', icon('upload', 'Share'), ' Share, then ', el('strong', {}, 'Add to Home Screen'), '.'];
    } else {
      body = ['Add to your home screen from the browser menu: ', el('strong', {}, 'Install app'), ' or ', el('strong', {}, 'Add to Home screen'), '.'];
    }
    this.root.replaceChildren(el('span', { className: 'install-body' }, ...body), dismiss);
    this.root.hidden = false;
  }
}
