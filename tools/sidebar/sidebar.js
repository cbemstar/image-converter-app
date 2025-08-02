const CACHE_KEY = 'reform-tools';
const EXPIRY_KEY = `${CACHE_KEY}-expiry`;
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
let toolsPromise;

function getCachedTools() {
  const cached = localStorage.getItem(CACHE_KEY);
  const expiry = Number(localStorage.getItem(EXPIRY_KEY));
  if (!cached || !expiry || Date.now() >= expiry) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function saveTools(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + TTL_MS));
  } catch {
    // ignore storage errors
  }
}

/**
 * Fetches the tools manifest from the server and caches it.
 * @returns {Promise<Array<{id:string,label:string,href:string}>>} Resolves to the list of tools.
 */
export function fetchTools() {
  if (!toolsPromise) {
    toolsPromise = fetch('/tools/tools.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load tools');
        return res.json();
      })
      .then((data) => {
        saveTools(data);
        return data;
      })
      .finally(() => {
        toolsPromise = undefined;
      });
  }
  return toolsPromise;
}

/**
 * Sidebar navigation component listing available tools.
 */
export class ReformSidebar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.rendered = false;
  }

  async connectedCallback() {
    if (this.rendered) return;
    const cached = getCachedTools();
    if (cached) {
      this.render(cached);
      this.rendered = true;
    }

    try {
      const tools = await fetchTools();
      if (!cached || JSON.stringify(cached) !== JSON.stringify(tools)) {
        this.shadowRoot.innerHTML = '';
        this.render(tools);
        this.rendered = true;
      }
    } catch (err) {
      if (!this.rendered) this.remove();
    }
  }

  /**
   * Renders the sidebar links inside the shadow DOM.
   * @param {Array<{id:string,label:string,href:string}>} tools List of tools to display.
   * @returns {void}
   */
  render(tools) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Tool list');
    nav.setAttribute('part', 'container');
    nav.className =
      'w-56 bg-zinc-800 text-white text-sm h-screen overflow-y-auto border-r border-zinc-700 py-4 px-3 space-y-1';

    const current = window.location.pathname.replace(/\/$/, '');

    tools.forEach((tool) => {
      const a = document.createElement('a');
      a.href = tool.href;
      a.textContent = tool.label;
      a.className = 'block rounded px-2 py-1 hover:bg-zinc-700/50';
      const linkPath = new URL(tool.href, window.location.origin).pathname.replace(/\/$/, '');
      if (current === linkPath) {
        a.classList.add('bg-zinc-700/70', 'font-semibold');
      }
      nav.appendChild(a);
    });

    this.shadowRoot.append(nav);
  }
}

customElements.define('reform-sidebar', ReformSidebar);
