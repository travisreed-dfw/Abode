import { $, errorText, setMessage } from './lib/dom.js';
import { ApiClient } from './lib/api.js';
import { AliasForm } from './components/alias-form.js';
import { AliasList } from './components/alias-list.js';
import { ImportExport } from './components/import-export.js';
import { renderBuiltins } from './components/builtins.js';
import { ProfileList } from './components/profile-list.js';
import { SiteNav } from './components/nav.js';
import { localizePage } from './lib/site.js';

/** The alias manager page. */
class AliasesPage {
  private readonly api = new ApiClient();
  private readonly list = new AliasList(document, this.api);
  private readonly nav = new SiteNav($('.page-nav'), this.api);
  private readonly profiles = new ProfileList(document, this.api, (name) => {
    // Deleting your own profile logs you out server-side; reflect that in the nav.
    if (this.nav.current?.name === name) this.nav.setUser(null);
  });
  private readonly form = new AliasForm(document, this.api, () => this.list.refresh());

  constructor() {
    new ImportExport(document, this.api, () => this.refreshAll());
    void this.nav.init();
  }

  private async refreshAll(): Promise<void> {
    await Promise.all([this.list.refresh(), this.profiles.refresh()]);
  }

  async boot(): Promise<void> {
    renderBuiltins($('#builtins'));
    this.form.applyPrefill();
    try {
      await this.refreshAll();
    } catch (err) {
      setMessage($('#add-error'), `Could not load: ${errorText(err)}`);
    }
  }
}

localizePage();
void new AliasesPage().boot();
