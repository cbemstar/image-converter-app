// utils.js - Utility functions for the image converter

// Notification system
export function showNotification(message, type = 'info') {
  // Create notification container if it doesn't exist
  let notifContainer = document.getElementById('notification-container');
  if (!notifContainer) {
    notifContainer = document.createElement('div');
    notifContainer.id = 'notification-container';
    notifContainer.style.position = 'fixed';
    notifContainer.style.top = '20px';
    notifContainer.style.right = '20px';
    notifContainer.style.zIndex = '1000';
    notifContainer.style.maxWidth = '300px';
    document.body.appendChild(notifContainer);
  }

  // Create notification element
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.style.backgroundColor = type === 'error' ? '#ff5c5c' : type === 'success' ? '#4CAF50' : '#172f37';
  notif.style.color = '#cde5da';
  notif.style.padding = '12px 16px';
  notif.style.marginBottom = '10px';
  notif.style.borderRadius = '8px';
  notif.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  notif.style.borderLeft = `4px solid ${type === 'error' ? '#ff0000' : type === 'success' ? '#2E7D32' : '#7fd7c4'}`;
  notif.style.fontWeight = '500';
  notif.style.display = 'flex';
  notif.style.alignItems = 'center';
  notif.style.justifyContent = 'space-between';

  // Add icon based on type
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';

  // Build content elements
  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.alignItems = 'center';

  const iconSpan = document.createElement('span');
  iconSpan.style.marginRight = '8px';
  iconSpan.style.fontSize = '16px';
  iconSpan.textContent = icon;

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  content.appendChild(iconSpan);
  content.appendChild(messageSpan);

  const closeBtn = document.createElement('button');
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#cde5da';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.marginLeft = '10px';
  closeBtn.textContent = '×';

  // Add close button functionality
  closeBtn.addEventListener('click', () => {
    notif.style.opacity = '0';
    setTimeout(() => {
      if (notif.parentNode) {
        notifContainer.removeChild(notif);
      }
    }, 300);
  });

  notif.appendChild(content);
  notif.appendChild(closeBtn);

  // Add to container
  notifContainer.appendChild(notif);

  // Add animation
  notif.style.transition = 'opacity 0.3s ease';
  notif.style.opacity = '0';
  setTimeout(() => {
    notif.style.opacity = '1';
  }, 10);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notif.parentNode) {
      notif.style.opacity = '0';
      setTimeout(() => {
        if (notif.parentNode) {
          notifContainer.removeChild(notif);
        }
      }, 300);
    }
  }, 5000);
}

// Error display in table
export function showError(index, filename, err) {
  const previewTbody = document.getElementById('preview-tbody');
  if (!previewTbody) return;

  const tr = document.createElement('tr');
  tr.classList.add('error-row');

  const td = document.createElement('td');
  td.colSpan = 7;
  td.className = 'py-2 px-4 text-left break-words';

  const strong = document.createElement('strong');
  strong.textContent = filename;

  td.appendChild(document.createTextNode('❌ '));
  td.appendChild(strong);
  td.appendChild(document.createTextNode(' – ' + (err && err.message ? err.message : err)));

  tr.appendChild(td);
  previewTbody.appendChild(tr);
}

// Quota management
export function getQuotaInfo() {
  const now = Date.now();
  let quota = JSON.parse(localStorage.getItem('imgQuota') || '{}');
  if (!quota.start || typeof quota.used !== 'number') {
    quota = { start: now, used: 0 };
    localStorage.setItem('imgQuota', JSON.stringify(quota));
  } else if (now - quota.start > 24*60*60*1000) {
    quota = { start: now, used: 0 };
    localStorage.setItem('imgQuota', JSON.stringify(quota));
  }
  return quota;
}

export function setQuotaInfo(quota) {
  localStorage.setItem('imgQuota', JSON.stringify(quota));
}

export function updateQuotaStatus() {
  let left;
  if (window.imageAuth && typeof window.imageAuth.getRemainingConversions === 'function') {
    left = window.imageAuth.getRemainingConversions();
  } else {
    const quota = getQuotaInfo();
    left = Math.max(0, 100 - quota.used);
  }

  const quotaStatus = document.getElementById('quota-status');
  const upgradeBtn = document.getElementById('upgrade-btn');

  if (quotaStatus) {
    quotaStatus.textContent = `${left} free conversions remaining. Quota resets every 24 hours.`;
  }

  if (upgradeBtn) {
    upgradeBtn.style.display = (left <= 2) ? 'inline-block' : 'none';
  }
}

export function canProcessImages(num, files) {
  const quota = getQuotaInfo();
  if (quota.used >= 100) return false;
  let valid = 0;
  for (let i = 0; i < files.length; i++) {
    if (files[i].size <= 5*1024*1024) valid++;
  }
  return Math.min(valid, 100 - quota.used);
}

// Format file size in KB or MB for readability
export function formatFileSize(bytes) {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${kb.toFixed(1)} KB`;
}

// Compress a canvas to roughly a target file size using binary search
export async function compressToTargetSize(canvas, mime, targetBytes) {
  if (!targetBytes || mime === 'image/png') {
    return new Promise(res => canvas.toBlob(res, mime));
  }
  let minQ = 0.1;
  let maxQ = 1.0;
  let bestBlob = null;
  for (let i = 0; i < 7; i++) {
    const q = (minQ + maxQ) / 2;
    const blob = await new Promise(r => canvas.toBlob(r, mime, q));
    if (!blob) break;
    if (blob.size > targetBytes) {
      maxQ = q;
    } else {
      bestBlob = blob;
      minQ = q;
      if (targetBytes - blob.size < targetBytes * 0.05) break;
    }
  }
  if (bestBlob) return bestBlob;
  return new Promise(res => canvas.toBlob(res, mime, minQ));
}

// Format detectors
export function isAvif(file) {
  return file.type === 'image/avif' || file.name.toLowerCase().endsWith('.avif');
}

export function isHeic(file) {
  return file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
}

export function isRaw(file) {
  return /\.(cr2|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$/i.test(file.name);
}

export function isTiff(file) {
  return file.type === 'image/tiff' || /\.(tif|tiff)$/i.test(file.name);
}

export function isBmp(file) {
  return file.type === 'image/bmp' || file.name.toLowerCase().endsWith('.bmp');
}

export function isGif(file) {
  return file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
}

export function isSvg(file) {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
}

export function isIco(file) {
  return file.type === 'image/x-icon' || file.name.toLowerCase().endsWith('.ico');
}

// Browser checks
export function checkHeicSupport() {
  const isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
  const isEdge = navigator.userAgent.indexOf("Edg") !== -1;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isFirefox = navigator.userAgent.indexOf("Firefox") !== -1;
  
  // Check for Safari 17+ which has native HEIC support
  let safariVersion = 0;
  if (isSafari) {
    const match = navigator.userAgent.match(/Version\/(\d+)/);
    if (match) safariVersion = parseInt(match[1], 10);
  }
  
  if (isSafari && safariVersion >= 17) {
    // Safari 17+ has native HEIC support
    return 'native';
  } else if (isChrome || isEdge) {
    // Chrome and Edge have good support through libraries
    return 'supported';
  } else if (isFirefox) {
    showNotification('Firefox has limited support for HEIC images. If conversion fails, try Chrome or Edge browser.', 'warning');
    return 'limited';
  } else {
    showNotification('Your browser may have limited support for HEIC images. Chrome or Edge recommended.', 'warning');
    return 'unknown';
  }
}

export function checkWasmSupport() {
  if (typeof WebAssembly !== 'object') {
    showNotification('Your browser does not support WebAssembly, which is required for some image formats. Please use a modern browser.', 'error');
    return false;
  }
  return true;
}

// Toggle Stripe pricing accordion
export function toggleStripeAccordion(show = false) {
  const accordion = document.getElementById('stripe-accordion');
  if (accordion) {
    accordion.style.display = show ? 'block' : 'none';
  }
}

// Fix download button display issues
export function fixDownloadButtonDisplay() {
  const downloadButtons = document.querySelectorAll('.download-btn');
  downloadButtons.forEach(button => {
    if (button.style.display === 'inline-block') {
      button.style.width = '100%';
      button.style.boxSizing = 'border-box';
    }
  });
}

// Initialize image processing libraries
export async function initImageProcessingLibraries() {
  let success = true;
  
  // Check WebAssembly support first
  if (!checkWasmSupport()) {
    return false;
  }
  
  // Initialize AVIF modules
  try {
    if (typeof avifDec !== 'undefined') {
      await avifDec.default();
      window.avifDecInit = true;
      console.log('AVIF decoder initialized successfully');
    }
    
    if (typeof avifEnc !== 'undefined') {
      await avifEnc.default();
      window.avifEncInit = true;
      console.log('AVIF encoder initialized successfully');
    }
  } catch (err) {
    console.error('Failed to initialize AVIF modules:', err);
    success = false;
  }
  
  return success;
} 