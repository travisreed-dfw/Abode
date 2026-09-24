import { $, errorText, setMessage } from '../lib/dom.js';
import { SITE } from '../lib/site.js';
import type { ApiClient } from '../lib/api.js';

/** The "add alias" form at the top of the aliases page, including the ?new= prefill. */
export class AliasForm {
  private readonly form: HTMLFormElement;
  private readonly name: HTMLInputElement;
  private readonly url: HTMLInputElement;
  private readonly description: HTMLInputElement;
  private readonly error: HTMLElement;
  private readonly hint: HTMLElement;

  constructor(root: ParentNode, private readonly api: ApiClient, private readonly onCreated: () => Promise<void>) {
    this.form = $('#add-form', root);
    this.name = $('#add-name', root);
    this.url = $('#add-url', root);
    this.description = $('#add-description', root);
    this.error = $('#add-error', root);
    this.hint = $('#hint', root);

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit();
    });
  }

  /** Prefill from /aliases?new=<name>, then tidy the address bar. */
  applyPrefill(search: string = location.search): void {
    const name = new URLSearchParams(search).get('new');
    if (!name) return;
    this.name.value = name;
    setMessage(this.hint, `${SITE.label(name)} doesn't exist yet. Add it below.`);
    this.url.focus();
    history.replaceState(null, '', '/aliases');
  }

  private async submit(): Promise<void> {
    const button = this.form.querySelector('button');
    if (button) button.disabled = true;
    setMessage(this.error, null);
    try {
      await this.api.createAlias({
        name: SITE.cleanAliasName(this.name.value),
        url: this.url.value,
        description: this.description.value,
      });
      this.form.reset();
      this.hint.hidden = true;
      this.name.focus();
      await this.onCreated();
    } catch (err) {
      setMessage(this.error, errorText(err));
    } finally {
      if (button) button.disabled = false;
    }
  }
}
