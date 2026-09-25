import { $, el, errorText, icon, setMessage } from '../lib/dom.js';
import { hueFor } from '../lib/format.js';
import type { BookmarkView, BookmarksUpdate } from '../../shared/types.js';

export function letterTile(label: string): HTMLElement {
  const tile = el('span', { className: 'bm-letter' }, (label.trim()[0] ?? '?').toUpperCase());
  tile.style.setProperty('--tile-hue', String(hueFor(label)));
  return tile;
}

function iconFor(bookmark: BookmarkView): HTMLElement {
  const wrap = el('span', { className: 'bm-icon' });
  if (!/^https?:\/\//i.test(bookmark.url)) {
    wrap.append(letterTile(bookmark.label));
  } else {
    const img = el('img', { alt: '', src: `/api/icon?url=${encodeURIComponent(bookmark.url)}`, loading: 'lazy' });
    img.addEventListener('error', () => img.replaceWith(letterTile(bookmark.label)));
    wrap.append(img);
  }
  if (bookmark.status) {
    const dot = el('span', { className: `bm-status ${bookmark.status}`, title: bookmark.status === 'up' ? 'Service is up' : 'Service is not responding' });
    wrap.append(dot);
  }
  return wrap;
}

function tile(b: BookmarkView): HTMLAnchorElement {
  const title = b.owner === 'docker' ? `${b.url} (Docker container)` : b.shared && b.owner ? `${b.url} (shared by ${b.owner})` : b.url;
  return el('a', { className: 'bookmark', href: b.url, title }, iconFor(b), el('span', { className: 'bm-label' }, b.label));
}

/**
 * The bookmark buttons: ungrouped ones first, then one collapsible section per
 * group, in the order groups first appear in the profile's bookmark order.
 * Which sections are collapsed is saved to the profile via `onCollapse`.
 */
export class BookmarkGrid {
  private readonly root: HTMLElement;
  private readonly empty: HTMLElement;
  private collapsed = new Set<string>();

  constructor(root: ParentNode, private readonly onCollapse: (collapsed: string[]) => Promise<void> = async () => {}) {
    this.root = $('#bookmarks', root);
    this.empty = $('#bookmarks-empty', root);
  }

  setCollapsed(groups: readonly string[]): void {
    this.collapsed = new Set(groups);
  }

  render(bookmarks: BookmarkView[]): void {
    const shown = bookmarks.filter((b) => !b.hidden);
    const ungrouped = shown.filter((b) => !b.group);
    const groups: string[] = [];
    for (const b of shown) if (b.group && !groups.includes(b.group)) groups.push(b.group);

    const parts: HTMLElement[] = [];
    if (ungrouped.length) parts.push(el('div', { className: 'bookmark-grid' }, ...ungrouped.map(tile)));
    for (const name of groups) {
      const items = shown.filter((b) => b.group === name);
      const isCollapsed = this.collapsed.has(name);
      const header = el('button', { type: 'button', className: 'group-header' },
        icon('arrow-down'), el('span', { className: 'group-name' }, name), el('span', { className: 'group-count' }, String(items.length)));
      header.setAttribute('aria-expanded', String(!isCollapsed));
      const body = el('div', { className: 'bookmark-grid', hidden: isCollapsed }, ...items.map(tile));
      header.addEventListener('click', async () => {
        const nowCollapsed = !body.hidden;
        body.hidden = nowCollapsed;
        header.setAttribute('aria-expanded', String(!nowCollapsed));
        section.classList.toggle('is-collapsed', nowCollapsed);
        if (nowCollapsed) this.collapsed.add(name); else this.collapsed.delete(name);
        try {
          await this.onCollapse([...this.collapsed]);
        } catch {
          // the section still toggled locally; the next load will use the saved state
        }
      });
      const section = el('section', { className: 'bookmark-group' + (isCollapsed ? ' is-collapsed' : '') }, header, body);
      parts.push(section);
    }
    this.root.replaceChildren(...parts);
    this.empty.hidden = shown.length > 0;
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
    if (!value) this.empty.hidden = true;
  }
}

type Draft = { id?: string; label: string; url: string; group: string; shared: boolean; hidden: boolean; editable: boolean; owner?: string };

/**
 * Inline editor. Every row is a bookmark this profile can see; Shared makes it
 * appear for everyone, Hidden removes it from this profile's page only, and
 * the arrows set this profile's order. Rows owned by someone else and not
 * shared never appear; shared rows by others can be edited but their hide
 * state stays personal.
 */
export class BookmarkEditor {
  private readonly form: HTMLFormElement;
  private readonly rows: HTMLElement;
  private readonly addBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;
  private readonly error: HTMLElement;
  private draft: Draft[] = [];
  private removed: string[] = [];
  private me = '';

  constructor(
    root: ParentNode,
    private readonly onSave: (update: BookmarksUpdate) => Promise<void>,
    private readonly onClose: () => void,
  ) {
    this.form = $('#bookmark-editor', root);
    this.rows = $('#editor-rows', root);
    this.addBtn = $('#add-row-btn', root);
    this.cancelBtn = $('#cancel-edit-btn', root);
    this.error = $('#editor-error', root);

    this.cancelBtn.addEventListener('click', () => this.close());
    this.addBtn.addEventListener('click', () => {
      this.draft.push({ label: '', url: '', group: '', shared: false, hidden: false, editable: true });
      this.renderRows();
      const inputs = this.rows.querySelectorAll('input[type="text"], input:not([type])');
      (inputs[inputs.length - 2] as HTMLInputElement | undefined)?.focus();
    });
    this.form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setMessage(this.error, null);
      const kept = this.draft.filter((b) => b.label.trim() || b.url.trim());
      try {
        await this.onSave({
          bookmarks: kept.filter((b) => b.editable).map((b) => ({ id: b.id, label: b.label, url: b.url, group: b.group, shared: b.shared })),
          remove: this.removed,
          hidden: kept.filter((b) => b.hidden && b.id).map((b) => b.id),
          order: kept.filter((b) => b.id).map((b) => b.id),
        });
        this.close();
      } catch (err) {
        setMessage(this.error, errorText(err));
      }
    });
  }

  get isOpen(): boolean {
    return !this.form.hidden;
  }

  open(bookmarks: BookmarkView[], me: string): void {
    this.me = me;
    this.draft = bookmarks.map((b) => ({ id: b.id, label: b.label, url: b.url, group: b.group, shared: b.shared, hidden: b.hidden, editable: b.editable, owner: b.owner }));
    this.removed = [];
    if (this.draft.length === 0) this.draft.push({ label: '', url: '', group: '', shared: false, hidden: false, editable: true });
    setMessage(this.error, null);
    this.renderRows();
    this.form.hidden = false;
    this.rows.querySelector('input')?.focus();
  }

  close(): void {
    this.form.hidden = true;
    this.onClose();
  }

  private move(from: number, to: number): void {
    if (to < 0 || to >= this.draft.length) return;
    const [row] = this.draft.splice(from, 1);
    this.draft.splice(to, 0, row);
    this.renderRows();
  }

  private renderRows(): void {
    const groupNames = [...new Set(this.draft.map((b) => b.group).filter((g) => g))].sort();
    const datalist = el('datalist', { id: 'group-names' }, ...groupNames.map((g) => el('option', { value: g })));
    this.rows.replaceChildren(
      datalist,
      ...this.draft.map((b, i) => {
        const label = el('input', { value: b.label, placeholder: 'Label', maxLength: 40, required: true, className: 'bm-edit-label', disabled: !b.editable });
        const url = el('input', { value: b.url, placeholder: 'https://example.com or /alias', required: true, className: 'bm-edit-url', spellcheck: false, disabled: !b.editable });
        const group = el('input', { value: b.group, placeholder: 'Group (optional)', maxLength: 40, className: 'bm-edit-group', disabled: !b.editable });
        group.setAttribute('list', 'group-names');
        label.addEventListener('input', () => { b.label = label.value; });
        url.addEventListener('input', () => { b.url = url.value; });
        group.addEventListener('input', () => { b.group = group.value; });

        const mine = !b.id || b.owner === this.me;
        const shared = el('input', { type: 'checkbox', checked: b.shared, disabled: !b.editable || !mine });
        shared.addEventListener('change', () => { b.shared = shared.checked; });
        const hidden = el('input', { type: 'checkbox', checked: b.hidden, disabled: !b.id });
        hidden.addEventListener('change', () => { b.hidden = hidden.checked; });
        const flags = el('span', { className: 'bm-flags' },
          el('label', { className: 'bm-flag', title: mine ? 'Show this bookmark on everyone\'s home page' : `Only ${b.owner} can change this` }, shared, ' Shared'),
          el('label', { className: 'bm-flag', title: 'Keep it, but don\'t show it on my page' }, hidden, ' Hidden'),
        );

        const up = el('button', { type: 'button', className: 'icon-button', title: 'Move up', disabled: i === 0 }, icon('arrow-up', 'Move up'));
        const down = el('button', { type: 'button', className: 'icon-button', title: 'Move down', disabled: i === this.draft.length - 1 }, icon('arrow-down', 'Move down'));
        up.addEventListener('click', () => this.move(i, i - 1));
        down.addEventListener('click', () => this.move(i, i + 1));

        const remove = el('button', { type: 'button', className: 'danger', title: b.editable ? 'Remove for everyone who sees it' : 'Only its owner can remove it', disabled: !b.editable }, icon('close'), 'Remove');
        remove.addEventListener('click', () => {
          if (b.shared && b.id && !confirm(`Remove "${b.label}" for everyone? Untick Shared or tick Hidden to keep it for others.`)) return;
          if (b.id) this.removed.push(b.id);
          this.draft.splice(i, 1);
          this.renderRows();
        });

        const owner = b.owner === 'docker'
          ? el('span', { className: 'bm-owner' }, 'from Docker: edit its labels to change; you can still hide or move it')
          : b.owner && b.shared && b.owner !== this.me ? el('span', { className: 'bm-owner' }, `shared by ${b.owner}`) : '';
        return el('div', { className: 'editor-row' + (b.hidden ? ' is-hidden' : '') }, letterTile(b.label || '?'), label, url, group, flags, el('span', { className: 'bm-move' }, up, down), remove, owner);
      }),
    );
  }
}
