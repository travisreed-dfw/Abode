import { $, el } from '../lib/dom.js';
import { ENGINES, resolveSearch } from '../../shared/search.js';

/** Engine dropdown + query box. Navigation and persistence are delegated via callbacks. */
export class SearchBar {
  private readonly form: HTMLFormElement;
  private readonly select: HTMLSelectElement;
  private readonly input: HTMLInputElement;
  private engineId: string;
  private aliasNames: readonly string[] = [];

  constructor(
    root: ParentNode,
    engineId: string,
    private readonly onEngineChange: (engineId: string) => Promise<void>,
    private readonly navigate: (url: string) => void = (url) => { location.href = url; },
  ) {
    this.form = $('#search-form', root);
    this.select = $('#engine-select', root);
    this.input = $('#search-input', root);
    this.engineId = engineId;

    this.select.replaceChildren(...ENGINES.map((e) => el('option', { value: e.id }, e.label)));
    this.select.value = engineId;

    this.select.addEventListener('change', async () => {
      const previous = this.engineId;
      this.engineId = this.select.value;
      try {
        await this.onEngineChange(this.engineId);
      } catch (err) {
        this.engineId = previous;
        this.select.value = previous;
        alert(err instanceof Error ? err.message : String(err));
      }
      this.input.focus();
    });

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = resolveSearch(this.input.value, this.engineId, this.aliasNames);
      if (url) this.navigate(url);
    });
  }

  setAliasNames(names: readonly string[]): void {
    this.aliasNames = names;
  }

  setEngine(engineId: string): void {
    this.engineId = engineId;
    this.select.value = engineId;
  }

  focus(): void {
    this.input.focus();
  }
}
