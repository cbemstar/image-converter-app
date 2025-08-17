// components/ui/breadcrumb.js
// Adapted from shadcn/ui for static HTML

export function createBreadcrumb() {
  const breadcrumb = document.createElement('nav');
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');
  breadcrumb.className = 'flex';
  
  const list = document.createElement('ol');
  list.className = 'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground';
  list.setAttribute('role', 'list');
  
  breadcrumb.appendChild(list);
  return { breadcrumb, list };
}

export function createBreadcrumbItem() {
  const item = document.createElement('li');
  item.className = 'inline-flex items-center gap-1.5';
  return item;
}

export function createBreadcrumbLink(href, text, isCurrentPage = false) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  
  if (isCurrentPage) {
    link.className = 'font-normal text-foreground';
    link.setAttribute('aria-current', 'page');
  } else {
    link.className = 'transition-colors hover:text-foreground';
  }
  
  return link;
}

export function createBreadcrumbSeparator() {
  const separator = document.createElement('svg');
  separator.className = 'size-3.5';
  separator.setAttribute('aria-hidden', 'true');
  separator.innerHTML = `
    <path d="m6 17 5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  `;
  return separator;
}

export function createBreadcrumbEllipsis() {
  const ellipsis = document.createElement('svg');
  ellipsis.className = 'size-4';
  ellipsis.setAttribute('aria-hidden', 'true');
  ellipsis.innerHTML = `
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
    <circle cx="19" cy="12" r="1" fill="currentColor"/>
    <circle cx="5" cy="12" r="1" fill="currentColor"/>
  `;
  return ellipsis;
}

export function createBreadcrumbPage(text) {
  const page = document.createElement('span');
  page.className = 'font-normal text-foreground';
  page.textContent = text;
  page.setAttribute('aria-current', 'page');
  return page;
}
