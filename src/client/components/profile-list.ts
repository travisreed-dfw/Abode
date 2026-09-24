import { $, el, errorText, icon, setMessage } from '../lib/dom.js';
import type { ApiClient } from '../lib/api.js';
import { getEngine } from '../../shared/search.js';
import type { ProfileSummary } from '../../shared/types.js';

/**
 * Lists profiles with a two-step delete: tick the box and type the exact
 * username before the button enables. Removing a profile also removes its
 * bookmarks, so it deserves more friction than deleting an alias.
 */
export class ProfileList {
  private readonly list: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly title: HTMLElement;
  private profiles: ProfileSummary[] = [];
  private confirming: string | null = null;

  constructor(root: ParentNode, private readonly api: ApiClient, private readonly onDeleted: (name: string) => void = () => {}) {
    this.list = $('#profile-list', root);
    this.empty = $('#profiles-empty', root);
    this.title = $('#profiles-title', root);
  }

  async refresh(): Promise<void> {
    this.profiles = await this.api.listProfiles();
    this.render();
  }

  render(): void {
    this.list.replaceChildren(...this.profiles.map((p) => (p.name === this.confirming ? this.confirmRow(p) : this.viewRow(p))));
    this.empty.hidden = this.profiles.length > 0;
    this.title.textContent = `Profiles (${this.profiles.length})`;
  }

  private viewRow(p: ProfileSummary): HTMLLIElement {
    const engine = getEngine(p.searchEngine)?.label ?? p.searchEngine;
    const bookmarks = `${p.bookmarks} ${p.bookmarks === 1 ? 'bookmark' : 'bookmarks'}`;
    const meta = el('div', { className: 'alias-meta' }, `${engine} · ${bookmarks} · since ${new Date(p.createdAt).toLocaleDateString()}`);
    const deleteBtn = el('button', { type: 'button', className: 'danger' }, icon('trash'), 'Delete');
    deleteBtn.addEventListener('click', () => {
      this.confirming = p.name;
      this.render();
    });
    return el('li', {}, el('span', { className: 'alias-name profile-name' }, p.name), meta, el('div', { className: 'actions' }, deleteBtn));
  }

  private confirmRow(p: ProfileSummary): HTMLLIElement {
    const check = el('input', { type: 'checkbox', id: `confirm-check-${p.name}` });
    const checkLabel = el('label', { htmlFor: check.id, className: 'confirm-check' }, check,
      ` I understand this permanently removes ${p.name} and its ${p.bookmarks} ${p.bookmarks === 1 ? 'bookmark' : 'bookmarks'}.`);
    const typed = el('input', { placeholder: `Type ${p.name} to confirm`, spellcheck: false, autocomplete: 'off', className: 'confirm-name' });
    const deleteBtn = el('button', { type: 'submit', className: 'danger', disabled: true }, icon('trash'), 'Delete profile');
    const cancelBtn = el('button', { type: 'button' }, 'Cancel');
    const error = el('p', { className: 'error row-error', hidden: true });

    const update = (): void => {
      deleteBtn.disabled = !(check.checked && typed.value.trim().toLowerCase() === p.name);
    };
    check.addEventListener('change', update);
    typed.addEventListener('input', update);

    const cancel = (): void => {
      this.confirming = null;
      this.render();
    };
    cancelBtn.addEventListener('click', cancel);

    const form = el('form', { className: 'confirm-form' }, checkLabel, typed, deleteBtn, cancelBtn, error);
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cancel();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (deleteBtn.disabled) return;
      deleteBtn.disabled = true;
      setMessage(error, null);
      try {
        await this.api.deleteProfile(p.name);
        this.confirming = null;
        this.onDeleted(p.name);
        await this.refresh();
      } catch (err) {
        setMessage(error, errorText(err));
        update();
      }
    });

    const li = el('li', { className: 'editing confirming' }, el('span', { className: 'alias-name profile-name' }, p.name), form);
    queueMicrotask(() => typed.focus());
    return li;
  }
}
