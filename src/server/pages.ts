/**
 * Top-level files served from public/. Their names are also reserved as alias
 * names (see validation.ts), so adding a page here reserves it automatically.
 */
export const PAGES: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/aliases': { file: 'aliases.html', type: 'text/html; charset=utf-8' },
  '/documentation': { file: 'documentation.html', type: 'text/html; charset=utf-8' },
};
