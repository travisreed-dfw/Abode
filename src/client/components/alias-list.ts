import { $, el, errorText, icon, setMessage } from '../lib/dom.js';
import { relativeTime } from '../lib/format.js';
import { SITE } from '../lib/site.js';
import type { ApiClient } from '../lib/api.js';
import type { Alias } from '../../shared/types.js';

/** Filterable list of aliases with inline edit and delete. */
export class AliasList {
  private readonly list: HTMLUListElement;
  private readonly title: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly noMatch: HTMLElement;
  private readonly filter: HTMLInputElement;
  private aliases: Alias[] = [];
  private editingName: string | null = null;

  constructor(root: ParentNode, private readonly api: ApiClient) {
    this.list = $('#alias-list', root);
    this.title = $('#list-title', root);
    this.empty = $('#empty', root);
    this.noMatch = $('#no-match', root);
    this.filter = $('#search', root);

    this.filter.addEventListener('input', () => this.render());
    this.filter.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.filter.value = '';
        this.render();
      }
    });
  }

  async refresh(): Promise<void> {
    this.aliases = await this.api.listAliases();
    this.render();
  }

  private matches(alias: Alias, needle: string): boolean {
    if (!needle) return true;
    const haystack = `${alias.name} ${alias.url} ${alias.description}`.toLowerCase();
    return needle.split(/\s+/).every((word) => haystack.includes(word));
  }

  render(): void {
    const needle = this.filter.value.trim().toLowerCase();
    const visible = this.aliases.filter((a) => this.matches(a, needle));
    this.list.replaceChildren(...visible.map((a) => (a.name === this.editingName ? this.editRow(a) : this.viewRow(a))));
    this.empty.hidden = this.aliases.length > 0;
    this.noMatch.hidden = this.aliases.length === 0 || visible.length > 0;
    this.title.textContent = needle ? `Aliases (${visible.length} of ${this.aliases.length})` : `Aliases (${this.aliases.length})`;
  }

  private viewRow(alias: Alias): HTMLLIElement {
    const link = el('a', { className: 'alias-name', href: `/${alias.name}` }, SITE.label(alias.name));
    const target = el('a', { className: 'alias-url', href: alias.url, title: alias.url }, icon('external'), alias.url);
    const details = el('div', { className: 'alias-details' }, target);
    if (alias.description) details.append(el('div', { className: 'alias-description' }, alias.description));

    const hits = `${alias.hits} ${alias.hits === 1 ? 'hit' : 'hits'}`;
    const meta = el(
      'div',
      { className: 'alias-meta', title: alias.lastUsedAt ? `Last used ${new Date(alias.lastUsedAt).toLocaleString()}` : '' },
      `${hits} · ${relativeTime(alias.lastUsedAt)}`,
    );

    const editBtn = el('button', { type: 'button' }, icon('pencil'), 'Edit');
    editBtn.addEventListener('click', () => {
      this.editingName = alias.name;
      this.render();
    });

    const deleteBtn = el('button', { type: 'button', className: 'danger' }, icon('trash'), 'Delete');
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete ${SITE.label(alias.name)}?`)) return;
      deleteBtn.disabled = true;
      try {
        await this.api.deleteAlias(alias.name);
        await this.refresh();
      } catch (err) {
        deleteBtn.disabled = false;
        alert(errorText(err));
      }
    });

    return el('li', {}, link, details, meta, el('div', { className: 'actions' }, editBtn, deleteBtn));
  }

  private editRow(alias: Alias): HTMLLIElement {
    const nameInput = el('input', { name: 'name', value: alias.name, required: true, maxLength: 64, spellcheck: false });
    const urlInput = el('input', { name: 'url', type: 'url', value: alias.url, required: true, spellcheck: false });
    const descriptionInput = el('input', {
      name: 'description', className: 'description-field', value: alias.description,
      placeholder: 'Description (optional)', maxLength: 200,
    });
    const saveBtn = el('button', { type: 'submit', className: 'primary' }, icon('check'), 'Save');
    const cancelBtn = el('button', { type: 'button' }, 'Cancel');
    const rowError = el('p', { className: 'error row-error', hidden: true });

    const form = el(
      'form',
      { className: 'edit-form' },
      el('label', { className: 'name-field' }, el('span', { className: 'prefix' }, `${SITE.name}/`), nameInput),
      urlInput,
      saveBtn,
      cancelBtn,
      descriptionInput,
      rowError,
    );

    const cancel = (): void => {
      this.editingName = null;
      this.render();
    };
    cancelBtn.addEventListener('click', cancel);
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cancel();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      saveBtn.disabled = true;
      setMessage(rowError, null);
      try {
        await this.api.updateAlias(alias.name, {
          name: SITE.cleanAliasName(nameInput.value),
          url: urlInput.value,
          description: descriptionInput.value,
        });
        this.editingName = null;
        await this.refresh();
      } catch (err) {
        saveBtn.disabled = false;
        setMessage(rowError, errorText(err));
      }
    });

    const li = el('li', { className: 'editing' }, form);
    queueMicrotask(() => urlInput.focus());
    return li;
  }
}
