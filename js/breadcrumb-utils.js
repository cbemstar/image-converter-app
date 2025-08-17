// js/breadcrumb-utils.js
// Utility functions for generating breadcrumbs across the site

import {
  createBreadcrumb,
  createBreadcrumbItem,
  createBreadcrumbLink,
  createBreadcrumbSeparator,
  createBreadcrumbPage
} from '../components/ui/breadcrumb.js';

export function generateBreadcrumbs() {
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

export function injectBreadcrumbs(containerSelector = '#breadcrumbs') {
  const container = document.querySelector(containerSelector);
  if (container) {
    const breadcrumbs = generateBreadcrumbs();
    container.appendChild(breadcrumbs);
  }
}

// Auto-inject breadcrumbs when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if breadcrumb container exists
  if (document.querySelector('#breadcrumbs')) {
    injectBreadcrumbs();
  }
});
