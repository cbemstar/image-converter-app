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
  
  // Add content
  notif.innerHTML = `
    <div style="display:flex;align-items:center;">
      <span style="margin-right:8px;font-size:16px;">${icon}</span>
      <span>${message}</span>
    </div>
    <button style="background:none;border:none;color:#cde5da;cursor:pointer;font-size:16px;margin-left:10px;">×</button>
  `;
  
  // Add close button functionality
  const closeBtn = notif.querySelector('button');
  closeBtn.addEventListener('click', () => {
    notif.style.opacity = '0';
    setTimeout(() => {
      if (notif.parentNode) {
        notifContainer.removeChild(notif);
      }
    }, 300);
  });
  
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
  tr.innerHTML = `
    <td colspan="7" class="py-2 px-4 text-left break-words">❌ <strong>${filename}</strong> – ${err && err.message ? err.message : err}</td>`;
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
  const quota = getQuotaInfo();
  const left = Math.max(0, 100 - quota.used);
  const quotaStatus = document.getElementById('quota-status');
  const upgradeBtn = document.getElementById('upgrade-btn');
  
  if (quotaStatus) {
    quotaStatus.textContent = `Free quota: ${left} of 100 images left (resets in ${Math.ceil((24*60*60*1000 - (Date.now() - quota.start))/3600000)}h)`;
  }
  
  // Show upgrade button if quota is low or zero
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
    if (!button.classList.contains('hidden')) {
      button.style.display = 'inline-block';
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