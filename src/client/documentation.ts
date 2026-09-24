import { el } from './lib/dom.js';
import { ApiClient } from './lib/api.js';
import { ENGINES } from '../shared/search.js';
import { SITE, localizePage } from './lib/site.js';
import { SiteNav } from './components/nav.js';
import { $ } from './lib/dom.js';

function row(cells: (string | Node)[], classes: (string | undefined)[] = []): HTMLTableRowElement {
  return el('tr', {}, ...cells.map((cell, i) => el('td', { className: classes[i] ?? '' }, cell)));
}

const code = (text: string): HTMLElement => el('code', {}, text);
const link = (href: string, text: string): HTMLAnchorElement => el('a', { href }, text);

/** Fills the two generated tables on the documentation page. */
class DocsPage {
  readonly api = new ApiClient();

  renderBangs(): void {
    const body = document.querySelector<HTMLTableSectionElement>('#bang-table tbody');
    if (!body) return;
    body.replaceChildren(
      ...ENGINES.map((e) =>
        row([code(`!${e.bang}`), e.label, code(`${SITE.label(e.bang)}/…`), link(`/${e.bang}`, SITE.label(e.bang))], [undefined, undefined, 'col-path']),
      ),
    );
  }

  async renderAliases(): Promise<void> {
    const body = document.querySelector<HTMLTableSectionElement>('#alias-table tbody');
    const empty = document.querySelector<HTMLElement>('#alias-table-empty');
    if (!body || !empty) return;
    const aliases = await this.api.listAliases().catch(() => []);
    body.replaceChildren(
      ...aliases.map((a) =>
        row(
          [code(`!${a.name}`), a.description || a.name, code(`${SITE.label(a.name)}/…`), link(`/${a.name}`, SITE.label(a.name))],
          [undefined, undefined, 'col-path'],
        ),
      ),
    );
    empty.hidden = aliases.length > 0;
    const table = body.closest('table');
    if (table) table.hidden = aliases.length === 0;
  }
}

localizePage();
const page = new DocsPage();
void new SiteNav($('.page-nav'), page.api).init();
page.renderBangs();
void page.renderAliases();
