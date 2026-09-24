import { ENGINES } from '../../shared/search.js';
import { SITE } from '../lib/site.js';

/** The "built-in search shortcuts" line on the aliases page. */
export function renderBuiltins(target: HTMLElement): void {
  target.replaceChildren('Built-in search shortcuts, also usable as !bangs on the home page: ');
  ENGINES.forEach((e, i) => {
    if (i > 0) target.append(', ');
    const link = document.createElement('a');
    link.href = `/${e.bang}`;
    link.title = `${SITE.label(e.bang)}/<words> searches ${e.label}`;
    link.textContent = SITE.label(e.bang);
    target.append(link, ` ${e.label}`);
  });
  const docs = document.createElement('a');
  docs.href = '/documentation';
  docs.textContent = 'Full documentation.';
  target.append(`. Add words after the name to search, e.g. ${SITE.label('yt')}/kitty cats. `, docs);
}
