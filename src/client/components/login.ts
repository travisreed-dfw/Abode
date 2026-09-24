import { $, errorText, setMessage } from '../lib/dom.js';
import type { ApiClient } from '../lib/api.js';
import type { User } from '../../shared/types.js';

/** The "Login or register" card. Calls `onLogin` with the profile on success. */
export class LoginView {
  private readonly root: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly username: HTMLInputElement;
  private readonly loginBtn: HTMLButtonElement;
  private readonly registerBtn: HTMLButtonElement;
  private readonly error: HTMLElement;

  constructor(root: HTMLElement, private readonly api: ApiClient, private readonly onLogin: (user: User) => void) {
    this.root = root;
    this.form = $('#login-form', root);
    this.username = $('#username', root);
    this.loginBtn = $('#login-btn', root);
    this.registerBtn = $('#register-btn', root);
    this.error = $('#login-error', root);

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit('login');
    });
    this.registerBtn.addEventListener('click', () => {
      if (this.form.reportValidity()) void this.submit('register');
    });
  }

  show(): void {
    this.root.hidden = false;
    this.username.value = '';
    this.username.focus();
  }

  hide(): void {
    this.root.hidden = true;
  }

  private async submit(kind: 'login' | 'register'): Promise<void> {
    setMessage(this.error, null);
    this.loginBtn.disabled = this.registerBtn.disabled = true;
    try {
      const user = kind === 'login' ? await this.api.login(this.username.value) : await this.api.register(this.username.value);
      this.onLogin(user);
    } catch (err) {
      setMessage(this.error, errorText(err));
    } finally {
      this.loginBtn.disabled = this.registerBtn.disabled = false;
    }
  }
}
