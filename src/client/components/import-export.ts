import { $, errorText } from '../lib/dom.js';
import type { ApiClient } from '../lib/api.js';

/** The Export / Import toolbar at the bottom of the aliases page. */
export class ImportExport {
  private readonly button: HTMLButtonElement;
  private readonly file: HTMLInputElement;
  private readonly message: HTMLElement;

  constructor(root: ParentNode, private readonly api: ApiClient, private readonly onImported: () => Promise<void>) {
    this.button = $('#import-btn', root);
    this.file = $('#import-file', root);
    this.message = $('#toolbar-msg', root);

    this.button.addEventListener('click', () => this.file.click());
    this.file.addEventListener('change', () => void this.importSelected());
  }

  private async importSelected(): Promise<void> {
    const file = this.file.files?.[0];
    this.file.value = '';
    if (!file) return;
    this.message.textContent = 'Importing…';
    try {
      const payload: unknown = JSON.parse(await file.text());
      const result = await this.api.importAliases(payload);
      this.message.textContent = `Imported aliases: ${result.added} added, ${result.updated} updated. Profiles: ${result.users.added} added, ${result.users.updated} updated.`;
      await this.onImported();
    } catch (err) {
      this.message.textContent = `Import failed: ${errorText(err)}`;
    }
  }
}
