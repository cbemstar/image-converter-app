// js/breadcrumb-simple.js
// Simple breadcrumb implementation that works without ES6 modules

function createBreadcrumb() {
  const breadcrumb = document.createElement('nav');
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');
  breadcrumb.className = 'flex';
  
  const list = document.createElement('ol');
  list.className = 'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground';
  list.setAttribute('role', 'list');
  
  breadcrumb.appendChild(list);
  return { breadcrumb, list };
}

function createBreadcrumbItem() {
  const item = document.createElement('li');
  item.className = 'inline-flex items-center gap-1.5';
  return item;
}

function createBreadcrumbLink(href, text, isCurrentPage = false) {
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

function createBreadcrumbSeparator() {
  const separator = document.createElement('svg');
  separator.className = 'size-3.5';
  separator.setAttribute('aria-hidden', 'true');
  separator.innerHTML = `
    <path d="m6 17 5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  `;
  return separator;
}

function createBreadcrumbPage(text) {
  const page = document.createElement('span');
  page.className = 'font-normal text-foreground';
  page.textContent = text;
  page.setAttribute('aria-current', 'page');
  return page;
}

function formatSegmentText(segment) {
  // Convert URL segments to readable text
  const textMap = {
    'tools': 'Tools',
    'image-converter': 'Image Converter',
    'background-remover': 'Background Remover',
    'google-ads-rsa-preview': 'Google Ads RSA Preview',
    'campaign-structure': 'Campaign Structure',
    'bulk-match-editor': 'Bulk Match Type Editor',
    'json-formatter': 'JSON Formatter',
    'color-palette': 'Colour Palette Extractor',
    'pdf-merger': 'PDF Merger',
    'utm-builder': 'UTM Builder',
    'qr-generator': 'QR Code Generator',
    'pdf-ocr': 'PDF OCR',
    'uuid-generator': 'UUID Generator',
    'timestamp-converter': 'Timestamp Converter',
    'meta-tag-generator': 'Meta Tag Generator',
    'robots-txt': 'Robots.txt Tool',
    'text-case-converter': 'Text Case Converter',
    'layout-tool': 'Layout Generator',
    'request-tool': 'Request a Tool'
  };
  
  // Convert kebab-case to Title Case if no mapping exists
  if (textMap[segment]) {
    return textMap[segment];
  }
  
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateBreadcrumbs() {
  const currentPath = window.location.pathname;
  const pathSegments = currentPath.split('/').filter(segment => segment);
  
  // Create breadcrumb container
  const { breadcrumb, list } = createBreadcrumb();
  
  // Always start with Home
  const homeItem = createBreadcrumbItem();
  const homeLink = createBreadcrumbLink('/', 'Home');
  homeItem.appendChild(homeLink);
  list.appendChild(homeItem);
  
  // Add separator after home
  if (pathSegments.length > 0) {
    list.appendChild(createBreadcrumbSeparator());
  }
  
  // Build breadcrumb path
  let currentUrl = '';
  pathSegments.forEach((segment, index) => {
    currentUrl += '/' + segment;
    
    const item = createBreadcrumbItem();
    
    // Check if this is the last segment (current page)
    if (index === pathSegments.length - 1) {
      // Current page - don't make it a link
      const pageText = formatSegmentText(segment);
      const pageElement = createBreadcrumbPage(pageText);
      item.appendChild(pageElement);
    } else {
      // Intermediate page - make it a link
      const linkText = formatSegmentText(segment);
      const link = createBreadcrumbLink(currentUrl, linkText);
      item.appendChild(link);
      
      // Add separator
      list.appendChild(createBreadcrumbSeparator());
    }
    
    list.appendChild(item);
  });
  
  return breadcrumb;
}

function injectBreadcrumbs(containerSelector = '#breadcrumbs') {
  const container = document.querySelector(containerSelector);
  if (container) {
    console.log('Breadcrumb container found, injecting breadcrumbs...');
    const breadcrumbs = generateBreadcrumbs();
    container.appendChild(breadcrumbs);
    console.log('Breadcrumbs injected successfully');
  } else {
    console.log('Breadcrumb container not found:', containerSelector);
  }
}

// Auto-inject breadcrumbs when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking for breadcrumb container...');
  // Check if breadcrumb container exists
  if (document.querySelector('#breadcrumbs')) {
    console.log('Breadcrumb container found, injecting...');
    injectBreadcrumbs();
  } else {
    console.log('No breadcrumb container found on this page');
  }
});

// Also try to inject on window load as a fallback
window.addEventListener('load', () => {
  console.log('Window loaded, checking for breadcrumb container...');
  if (document.querySelector('#breadcrumbs')) {
    console.log('Breadcrumb container found on window load, injecting...');
    injectBreadcrumbs();
  }
});
