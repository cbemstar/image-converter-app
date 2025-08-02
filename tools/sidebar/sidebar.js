const CACHE_KEY = 'reform-sidebar-tools';
const TTL_MS = 12 * 60 * 60 * 1000;
let toolsPromise;

/**
 * Fetch the list of tools with caching.
 * @returns {Promise<Array<{id:string,label:string,href:string}>>}
 */
export async function fetchTools() {
  if (!toolsPromise) {
    toolsPromise = (async () => {
      const cachedRaw = localStorage.getItem(CACHE_KEY);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw);
          if (cached.expiry > Date.now() && Array.isArray(cached.data)) {
            return cached.data;
          }
        } catch {
          // Ignore parse errors
        }
      }

      const response = await fetch('/tools/tools.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load tools');
      }
      const data = await response.json();
      const payload = { data, expiry: Date.now() + TTL_MS };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      return data;
    })().catch(err => {
      toolsPromise = null;
      throw err;
    });
  }
  return toolsPromise;
}

/**
 * Web component rendering the Reformately sidebar.
 */
export class ReformSidebar extends HTMLElement {
  constructor() {
    super();
    this._rendered = false;
  }

  async connectedCallback() {
    if (this._rendered) return;
    this._rendered = true;
    this.attachShadow({ mode: 'open' });
    try {
      const tools = await fetchTools();
      this.render(tools);
    } catch {
      this.remove();
    }
  }

  /**
   * Render sidebar links.
   * @param {Array<{id:string,label:string,href:string}>} tools
   */
  render(tools) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/tools/sidebar/sidebar.css';

    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Tool list');
    nav.className =
      'w-56 bg-zinc-800 text-white text-sm h-screen overflow-y-auto border-r border-zinc-700 py-4 px-3';

    const ul = document.createElement('ul');
    ul.className = 'space-y-1';

    const current = location.pathname.endsWith('/')
      ? location.pathname
      : `${location.pathname}/`;

    tools.forEach(tool => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = tool.href;
      a.textContent = tool.label;
      a.className =
        'block rounded px-2 py-1 hover:bg-zinc-700 focus:bg-zinc-700 outline-none';
      if (current === tool.href) {
        a.classList.add('bg-zinc-700/70', 'font-semibold');
      }
      li.appendChild(a);
      ul.appendChild(li);
    });

    nav.appendChild(ul);
    this.shadowRoot.append(link, nav);
  }
}

customElements.define('reform-sidebar', ReformSidebar);
