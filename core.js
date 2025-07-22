// core.js - Main application logic for image converter

import { 
  showNotification, 
  showError, 
  getQuotaInfo, 
  setQuotaInfo, 
  updateQuotaStatus, 
  canProcessImages, 
  isHeic, 
  isRaw, 
  isAvif, 
  checkHeicSupport, 
  checkWasmSupport,
  toggleStripeAccordion,
  initImageProcessingLibraries,
  formatFileSize
} from './utils.js';

import { 
  initSpecialFormatLibraries, 
  initAvifLibraries 
} from './special-formats.js';

import { 
  hybridConvert, 
  processImages 
} from './conversions.js';

// Global variables
let _selectedFiles = [];
window._selectedFiles = _selectedFiles; // Expose to window for other modules

// DOM elements - These will be initialized when DOM is loaded
let dropArea;
let fileElem;
let downloadLink;
let previewTable;
let previewTbody;
let maxWidthInput;
let maxHeightInput;
let qualityInput;
let outputFormatInput;
let resolutionPreset;
let verticalRatioToggle;
let progressStatus;
let progressBar;
let convertImagesBtn;
let selectAllCheckbox;
let bulkRenameBtn;
let bulkRenameBase;
let bulkRenameStart;
let showBulkRenameLink;
let bulkRenameControls;
let upgradeBtn;
let downloadSelectedBtn;

// Navigation and modal elements
let navLoginBtn;
let navLogoutBtn;
let mobileMenuButton;
let mobileMenu;
let loginModal;
let closeLoginModal;
let modalSignupBtn;
let modalLoginBtn;
let forgotPasswordLink;
// Sidebar and tool search are now handled in layout.js

// Modal elements for image preview (Lightbox Gallery) - These will be initialized when DOM is loaded
let imageModal;
let modalImg;
let modalCaption;
let modalPrev;
let modalNext;
let closeModalBtn;
let galleryImages = [];
let galleryIndex = 0;

// Supabase config (replace with your own project keys)
const SUPABASE_URL = 'https://ggadqklbeiyccnqzwiac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnYWRxa2xiZWl5Y2NucXp3aWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3ODMwMjQsImV4cCI6MjA2NzM1OTAyNH0.w7PNMVWoyP514d55j1g-yE4aZG7QP_1BfyCT8fphQEY';
let supabase;

// Initialize Supabase if available
function initSupabase() {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Listen for auth state changes
    if (supabase && supabase.auth) {
      supabase.auth.onAuthStateChange((event, session) => {
        updateAuthUI(!!session);
        
        if (session) {
          // Reset quota for logged in users
          localStorage.setItem('imgQuota', JSON.stringify({ start: Date.now(), used: 0 }));
          updateQuotaStatus();
          
          // Close login modal if open
          if (loginModal) {
            loginModal.style.display = 'none';
          }
        }
      });
      
      // Check the current session state
      supabase.auth.getSession().then(({ data }) => {
        updateAuthUI(!!data.session);
      });
    }
    
    return true;
  }
  return false;
}

// Update UI based on authentication state
function updateAuthUI(isLoggedIn) {
  // Update navigation buttons
  if (navLoginBtn && navLogoutBtn) {
    navLoginBtn.style.display = isLoggedIn ? 'none' : 'inline-flex';
    navLogoutBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';
  }
  
  // Update legacy auth controls for backwards compatibility
  const legacyLogoutBtn = document.querySelector('#auth-controls button.bg-red-500');
  if (legacyLogoutBtn) {
    legacyLogoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
  }
}

// Debug mode: auto-reset quota when URL contains '?debug'
function initDebugMode() {
  if (window.location.search.includes('debug')) {
    localStorage.setItem('imgQuota', JSON.stringify({ start: Date.now(), used: 0 }));
    console.log('Debug: quota reset to 0');
  }
}

// File handling function
async function handleFiles(files) {
  if (!files.length) return;
  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/') || isRaw(f) || isHeic(f));
  if (!imageFiles.length) {
    showNotification('Please select image files only.', 'error');
    return;
  }

  toggleTableHeader(false);
  
  // Hide download buttons and bulk rename tool when new files are loaded
  const downloadButtonsContainer = document.querySelector('.download-btns-responsive');
  const bulkRenameLink = document.getElementById('show-bulk-rename');
  
  if (downloadButtonsContainer) {
    downloadButtonsContainer.style.display = 'none';
  }
  
  if (bulkRenameLink) {
    bulkRenameLink.classList.add('hidden');
  }
  
  // Check for HEIC files and show browser compatibility warning if needed
  const hasHeicFiles = imageFiles.some(file => isHeic(file));
  if (hasHeicFiles) {
    const heicSupport = checkHeicSupport();
    if (heicSupport === 'limited' || heicSupport === 'unknown') {
      showNotification('Your browser has limited HEIC support. If conversion fails, try Chrome or Edge.', 'warning');
    }
  }
  
  // Check for RAW files and ensure RAW-WASM is loaded
  const hasRawFiles = imageFiles.some(file => isRaw(file));
  if (hasRawFiles && !window.RawWasm) {
    showNotification('RAW image processing library not fully loaded. Some RAW files may not convert properly.', 'warning');
  }
  
  // Check for AVIF files and ensure AVIF decoder is available
  const hasAvifFiles = imageFiles.some(file => isAvif(file));
  if (hasAvifFiles && !window.avifDecInit) {
    try {
      if (typeof avifDec !== 'undefined') {
        await avifDec.default();
        window.avifDecInit = true;
      } else {
        showNotification('AVIF decoder not available. AVIF files may not convert properly.', 'warning');
      }
    } catch (e) {
      showNotification('Failed to initialize AVIF decoder. AVIF files may not convert properly.', 'warning');
    }
  }
  
  const quota = getQuotaInfo();
  if (quota.used >= 100) {
    if (progressStatus) progressStatus.textContent = '';
    if (progressBar) progressBar.style.width = '0';
    updateQuotaStatus();
    toggleStripeAccordion(true);
    return;
  }
  
  // Allow up to 25MB for in-browser, >25MB for Supabase
  const validFiles = imageFiles.filter(f => f.size <= 100*1024*1024); // allow up to 100MB for pro, but hybrid logic will route
  let canProcess = Math.min(validFiles.length, 100 - quota.used);
  if (imageFiles.length > 100 || validFiles.length > 100 || canProcess < validFiles.length) {
    showNotification('You selected more than 100 images. Only the first 100 within your quota will be processed.', 'warning');
  }
  if (canProcess === 0) {
    showNotification('No images can be processed (quota or size limit).', 'error');
    updateQuotaStatus();
    return;
  }
  
  _selectedFiles = validFiles.slice(0, canProcess);
  window._selectedFiles = _selectedFiles; // Update global reference
  
  // Clear and show table
  if (previewTbody) {
    previewTbody.innerHTML = '';

    _selectedFiles.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = e => {
        const tr = document.createElement('tr');
        tr.dataset.rowIndex = i + 1;
        tr.innerHTML = `
        <td data-label="Select"><input type="checkbox" class="select-image" data-index="${i+1}" checked></td>
        <td data-label="#">${i+1}</td>
        <td data-label="Preview">
          <span class="preview-img-container">
            <img class="preview" src="${e.target.result}" alt="preview">
            <span class="magnify-icon" data-img="${e.target.result}">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="#cde5da" stroke-width="2" fill="none"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#cde5da" stroke-width="2"/></svg>
            </span>
          </span>
        </td>
        <td data-label="Filename" class="break-words whitespace-normal max-w-[180px] sm:max-w-xs filename-cell">${_selectedFiles[i].filename || file.name}</td>
        <td data-label="Rename"><button class="rename-btn" data-index="${i+1}">Rename</button></td>
        <td data-label="Size" class="size-cell">-</td>
        <td data-label="Actions">
          <button class="convert-single-btn" data-index="${i+1}">Convert</button>
          <a class="download-btn ml-2" data-index="${i+1}" style="display: none;">Download</a>
        </td>`;
        previewTbody.appendChild(tr);

        // Add magnify icon click handler
        const magnifyIcon = tr.querySelector('.magnify-icon');
        if (magnifyIcon) {
          magnifyIcon.addEventListener('click', function() {
            openImageModal(e.target.result, file.name, i);
          });
        }

        // Make row clickable to toggle checkbox
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', function(e) {
          // Don't toggle if clicking on interactive elements
          if (e.target.tagName === 'BUTTON' || 
              e.target.tagName === 'A' || 
              e.target.tagName === 'INPUT' ||
              e.target.closest('.magnify-icon') ||
              e.target.tagName === 'SVG' ||
              e.target.tagName === 'CIRCLE' ||
              e.target.tagName === 'LINE') {
            return;
          }
          
          // Toggle checkbox
          const checkbox = this.querySelector('.select-image');
          if (checkbox) {
            checkbox.checked = !checkbox.checked;
            
            // Trigger change event to update UI
            const event = new Event('change', { bubbles: true });
            checkbox.dispatchEvent(event);
          }
        });

        // Add rename button handler
        const renameBtn = tr.querySelector('.rename-btn');
        if (renameBtn) {
          renameBtn.addEventListener('click', function() {
            const cell = tr.querySelector('.filename-cell');
            const currentName = cell.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'border rounded px-2 py-1 w-full';
            input.style.backgroundColor = '#172f37';
            input.style.color = '#cde5da';
            input.style.border = '1px solid #cde5da';
            
            cell.textContent = '';
            cell.appendChild(input);
            input.focus();
            
            function saveRename() {
              const newName = input.value.trim();
              if (newName && newName !== currentName) {
                _selectedFiles[i].filename = newName;
                cell.textContent = newName;
              } else {
                cell.textContent = currentName;
              }
            }
            
            input.addEventListener('blur', saveRename);
            input.addEventListener('keypress', function(e) {
              if (e.key === 'Enter') {
                saveRename();
              }
            });
          });
        }

        // Add convert single button handler
        const convertSingleBtn = tr.querySelector('.convert-single-btn');
        if (convertSingleBtn) {
          convertSingleBtn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'), 10) - 1;
            if (index >= 0 && index < _selectedFiles.length) {
              processSingleImage(index);
            }
          });
        }
      };
      reader.readAsDataURL(file);
    });
  }
  
  // Show Convert All button and update label
  if (convertImagesBtn) {
    convertImagesBtn.classList.remove('hidden');
    convertImagesBtn.style.display = 'block';
    updateButtonText();
  }

  // Setup magnify icon click handlers for lightbox
  setupMagnifyHandlers();
  toggleTableHeader(true);
}

// Process a single image
async function processSingleImage(index) {
  const file = _selectedFiles[index];
  if (!file) return;
  
  const format = outputFormatInput.value;
  const maxW = parseInt(maxWidthInput.value, 10) || 99999;
  const maxH = parseInt(maxHeightInput.value, 10) || 99999;
  const quality = parseFloat(qualityInput.value) || 0.9;
  
  // Get row for this file
  const tr = document.querySelector(`#preview-tbody tr[data-row-index="${index + 1}"]`);
  if (!tr) return;
  
  // Update UI to show processing
  const convertBtn = tr.querySelector('.convert-single-btn');
  const sizeCell = tr.querySelector('.size-cell');
  if (convertBtn) convertBtn.textContent = 'Processing...';
  if (sizeCell) sizeCell.textContent = 'Processing...';
  
  try {
    const { blob, filename } = await hybridConvert(file, maxW, maxH, quality, format);
    
    // Update file size display
    if (sizeCell) {
      const size = formatFileSize(blob.size);
      const reduction = (100 - (blob.size / file.size * 100)).toFixed(1);
      sizeCell.innerHTML = `${size}<br><span style="color:#7fd7c4;font-size:0.85em;">${reduction}% smaller</span>`;
    }
    
    // Enable download button
    const downloadBtn = tr.querySelector('.download-btn');
    if (downloadBtn) {
      downloadBtn.classList.remove('hidden');
      downloadBtn.style.display = 'inline-block';
      downloadBtn.href = URL.createObjectURL(blob);
      downloadBtn.download = filename;
      downloadBtn.textContent = 'Download';
    }
    
    // Update convert button
    if (convertBtn) convertBtn.textContent = 'Convert';
    
    // Show the Bulk Rename Tool link and Download All as ZIP button
    const bulkRenameLink = document.getElementById('show-bulk-rename');
    const downloadLink = document.getElementById('download-link');
    const downloadSelected = document.getElementById('download-selected');
    
    if (bulkRenameLink && bulkRenameLink.classList.contains('hidden')) {
      bulkRenameLink.classList.remove('hidden');
    }
    
    // Check if there's at least one converted image with download button visible
    const hasConverted = document.querySelector('.download-btn[style*="inline-block"]');
    
    if (hasConverted) {
      // Generate a ZIP file with all converted images
      const zip = new JSZip();
      let addedFiles = 0;
      
      // Find all download buttons and add their blobs to ZIP
      document.querySelectorAll('a.download-btn[style*="inline-block"]').forEach(async (btn) => {
        if (btn.href && btn.href.startsWith('blob:')) {
          try {
            const response = await fetch(btn.href);
            const blob = await response.blob();
            const filename = btn.download || `image_${addedFiles}.${format}`;
            zip.file(filename, blob);
            addedFiles++;
          } catch (err) {
            console.error('Error adding file to ZIP:', err);
          }
        }
      });
      
      // Show the download buttons container
      const downloadButtonsContainer = document.querySelector('.download-btns-responsive');
      if (downloadButtonsContainer) {
        downloadButtonsContainer.style.display = 'flex';
      }
      
      if (downloadLink) {
        zip.generateAsync({ type: 'blob' }).then(zipBlob => {
          downloadLink.href = URL.createObjectURL(zipBlob);
        });
      }
    }
    
    // Update quota
    const quota = getQuotaInfo();
    quota.used += 1;
    setQuotaInfo(quota);
    updateQuotaStatus();
  } catch (err) {
    console.error(`Error converting image ${file.name}:`, err);
    showError(index + 1, file.name, err);
    if (convertBtn) convertBtn.textContent = 'Failed';
    if (sizeCell) sizeCell.textContent = 'Error';
  }
}

// Update button text based on selected images
function updateButtonText() {
  if (!convertImagesBtn) return;
  
  const selectedCount = document.querySelectorAll('.select-image:checked').length;
  const totalImages = _selectedFiles ? _selectedFiles.length : 0;
  
  // If no images are selected, show "Convert All Images"
  // If specific images are selected, show "Convert X Images"
  if (selectedCount === 0 || selectedCount === totalImages) {
    convertImagesBtn.textContent = `Convert All Images`;
  } else {
    convertImagesBtn.textContent = `Convert ${selectedCount} Image${selectedCount !== 1 ? 's' : ''}`;
  }
  
  // Always show the button if there are images uploaded
  convertImagesBtn.style.display = totalImages > 0 ? 'block' : 'none';
}

// Show or hide table header
function toggleTableHeader(show) {
  const thead = document.querySelector('#preview-table thead');
  if (thead) {
    thead.style.display = show ? 'table-header-group' : 'none';
  }
}

// Lightbox functionality
function openImageModal(src, caption, index) {
  if (!imageModal) return;
  
  // Collect all images for gallery navigation
  galleryImages = [];
  const allMagnifyIcons = document.querySelectorAll('.magnify-icon');
  allMagnifyIcons.forEach((icon, idx) => {
    galleryImages.push({
      src: icon.getAttribute('data-img'),
      caption: _selectedFiles[idx]?.name || `Image ${idx + 1}`
    });
  });
  
  galleryIndex = index;
  modalImg.src = src;
  modalCaption.textContent = caption;
  imageModal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
  
  updateModalNavButtons();
}

function updateModalNavButtons() {
  if (galleryImages.length <= 1) {
    modalPrev.style.display = 'none';
    modalNext.style.display = 'none';
    return;
  }
  
  modalPrev.style.display = 'flex';
  modalNext.style.display = 'flex';
}

function navigateModal(direction) {
  galleryIndex = (galleryIndex + direction + galleryImages.length) % galleryImages.length;
  const image = galleryImages[galleryIndex];
  if (image) {
    modalImg.src = image.src;
    modalCaption.textContent = image.caption;
  }
}

function closeModal() {
  imageModal.style.display = 'none';
  document.body.style.overflow = ''; // Restore scrolling
}

function setupMagnifyHandlers() {
  document.querySelectorAll('.magnify-icon').forEach((icon, i) => {
    icon.addEventListener('click', function() {
      const img = this.getAttribute('data-img');
      const filename = _selectedFiles[i]?.name || `Image ${i + 1}`;
      openImageModal(img, filename, i);
    });
  });
}

// Bulk rename functionality
function setupBulkRename() {
  if (!showBulkRenameLink || !bulkRenameControls || !bulkRenameBtn) return;
  
  // Toggle display of bulk rename controls
  showBulkRenameLink.addEventListener('click', function(e) {
    e.preventDefault();
    bulkRenameControls.style.display = bulkRenameControls.style.display === 'none' ? 'flex' : 'none';
  });
  
  // Bulk rename button click handler
  bulkRenameBtn.addEventListener('click', function() {
    const base = bulkRenameBase.value.trim() || 'Image';
    const start = parseInt(bulkRenameStart.value, 10) || 1;
    
    // Get all checkboxes that are checked
    const checkedRows = document.querySelectorAll('.select-image:checked');
    
    checkedRows.forEach((checkbox, i) => {
      const index = parseInt(checkbox.getAttribute('data-index'), 10) - 1;
      if (index >= 0 && index < _selectedFiles.length) {
        // Create new filename
        const newName = `${base}_${start + i}`;
        _selectedFiles[index].filename = newName;
        
        // Update UI
        const row = document.querySelector(`tr[data-row-index="${index + 1}"]`);
        if (row) {
          const filenameCell = row.querySelector('.filename-cell');
          if (filenameCell) filenameCell.textContent = newName;
        }
      }
    });
    
    showNotification(`Renamed ${checkedRows.length} files using pattern: ${base}_N`, 'success');
  });
}

// Download selected functionality
function setupDownloadSelected() {
  if (!downloadSelectedBtn) return;
  
  downloadSelectedBtn.addEventListener('click', async function() {
    const checkedRows = document.querySelectorAll('.select-image:checked');
    if (!checkedRows.length) {
      showNotification('No images selected for download', 'error');
      return;
    }
    
    // Create a ZIP with selected images
    const zip = new JSZip();
    let addedFiles = 0;
    
    // Show loading indicator
    downloadSelectedBtn.innerHTML = `
      <span style="display: inline-flex; align-items: center; gap: 8px;">
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        Creating ZIP...
      </span>
    `;
    downloadSelectedBtn.disabled = true;
    
    // Find all download buttons for selected rows and add their blobs to ZIP
    for (const checkbox of checkedRows) {
      const index = parseInt(checkbox.getAttribute('data-index'), 10);
      const downloadBtn = document.querySelector(`a.download-btn[data-index="${index}"][style*="inline-block"]`);
      
      if (downloadBtn && downloadBtn.href && downloadBtn.href.startsWith('blob:')) {
        try {
          // Get the blob from the URL
          const response = await fetch(downloadBtn.href);
          const blob = await response.blob();
          
          // Get the filename
          const filename = downloadBtn.download || `image_${index}.${outputFormatInput.value}`;
          
          // Add to ZIP
          zip.file(filename, blob);
          addedFiles++;
        } catch (err) {
          console.error('Error adding file to ZIP:', err);
        }
      }
    }
    
    if (addedFiles === 0) {
      showNotification('No converted images to download. Convert images first.', 'error');
      
      // Reset button
      downloadSelectedBtn.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2v16h-8l-4 4-4-4H2V2z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          Download Selected
        </span>
      `;
      downloadSelectedBtn.disabled = false;
      return;
    }
    
    // Generate and download ZIP
    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      
      // Create temporary download link
      const tempLink = document.createElement('a');
      tempLink.href = zipUrl;
      tempLink.download = 'selected_images.zip';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(zipUrl);
      
      showNotification(`Downloaded ${addedFiles} images as ZIP`, 'success');
      
      // Reset button
      downloadSelectedBtn.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2v16h-8l-4 4-4-4H2V2z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          Download Selected
        </span>
      `;
      downloadSelectedBtn.disabled = false;
    } catch (err) {
      showNotification('Error creating ZIP file', 'error');
      console.error('ZIP generation error:', err);
      
      // Reset button on error
      downloadSelectedBtn.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2v16h-8l-4 4-4-4H2V2z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          Download Selected
        </span>
      `;
      downloadSelectedBtn.disabled = false;
    }
  });
}

// Select all functionality
function setupSelectAll() {
  if (!selectAllCheckbox) return;
  
  // Select all checkbox handler
  selectAllCheckbox.addEventListener('change', function() {
    const isChecked = this.checked;
    document.querySelectorAll('.select-image').forEach(checkbox => {
      checkbox.checked = isChecked;
    });
    updateButtonText();
  });
  
  // Individual checkbox change handler
  document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('select-image')) {
      updateButtonText();
      
      // Update "select all" checkbox state
      const allCheckboxes = document.querySelectorAll('.select-image');
      const checkedCheckboxes = document.querySelectorAll('.select-image:checked');
      
      if (allCheckboxes.length === checkedCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else if (checkedCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }
  });
}

// Info popup functionality
function setupInfoPopups() {
  // RAW info popup
  const showRawInfoLink = document.getElementById('show-raw-info');
  const rawInfoModal = document.getElementById('raw-info-modal');
  const closeRawInfo = document.getElementById('close-raw-info');
  
  if (showRawInfoLink && rawInfoModal && closeRawInfo) {
    showRawInfoLink.addEventListener('click', (e) => {
      e.preventDefault();
      rawInfoModal.style.display = 'block';
    });
    
    closeRawInfo.addEventListener('click', () => {
      rawInfoModal.style.display = 'none';
    });
  }
  
  // HEIC info popup
  const showHeicInfoLink = document.getElementById('show-heic-info');
  const heicInfoModal = document.getElementById('heic-info-modal');
  const closeHeicInfo = document.getElementById('close-heic-info');
  
  if (showHeicInfoLink && heicInfoModal && closeHeicInfo) {
    showHeicInfoLink.addEventListener('click', (e) => {
      e.preventDefault();
      heicInfoModal.style.display = 'block';
    });
    
    closeHeicInfo.addEventListener('click', () => {
      heicInfoModal.style.display = 'none';
    });
  }
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === rawInfoModal) rawInfoModal.style.display = 'none';
    if (e.target === heicInfoModal) heicInfoModal.style.display = 'none';
  });
}

// Upgrade button functionality
function setupUpgradeButton() {
  if (!upgradeBtn) return;
  
  upgradeBtn.addEventListener('click', function() {
    toggleStripeAccordion(document.getElementById('stripe-accordion').style.display === 'none');
  });
}

// Navigation functionality
function setupNavigation() {
  // Mobile menu toggle
  if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', function() {
      mobileMenu.classList.toggle('hidden');
    });
  }
  
  // Navigation login button
  if (navLoginBtn && loginModal) {
    navLoginBtn.addEventListener('click', function() {
      loginModal.style.display = 'block';
    });
  }
  
  // Navigation logout button
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener('click', function() {
      if (typeof window.signOut === 'function') {
        window.signOut();
      }
    });
  }
}

// Sidebar functionality moved to layout.js
// Tool search functionality moved to layout.js

// FAQ accordion functionality
function setupFaqs() {
  document.querySelectorAll('#faqs .faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const answer = btn.nextElementSibling;
      if (answer) answer.classList.toggle('hidden', expanded);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-chevron-down', expanded);
        icon.classList.toggle('fa-chevron-up', !expanded);
      }
    });
  });
}

// Login modal functionality
function setupLoginModal() {
  if (!loginModal) return;
  
  // Close modal handlers
  if (closeLoginModal) {
    closeLoginModal.addEventListener('click', function() {
      loginModal.style.display = 'none';
    });
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === loginModal) {
      loginModal.style.display = 'none';
    }
  });
  
  let signUpMode = false;
  const fullNameField = document.getElementById('full-name-field');
  if (fullNameField) {
    fullNameField.style.display = 'none';
  }

  // Modal signup button
  if (modalSignupBtn) {
    modalSignupBtn.addEventListener('click', function() {
      const email = document.getElementById('modal-email').value;
      const password = document.getElementById('modal-password').value;
      const fullName = document.getElementById('modal-full-name').value;

      if (!signUpMode) {
        signUpMode = true;
        if (fullNameField) fullNameField.style.display = 'block';
        return;
      }

      if (!email || !password || !fullName) {
        showNotification('Please fill out all fields', 'error');
        return;
      }

      if (typeof window.signUp === 'function') {
        window.signUp(email, password, fullName);
      } else {
        showNotification('Sign up functionality not available. Please refresh the page.', 'error');
      }
    });
  }

  // Modal login button
  if (modalLoginBtn) {
    modalLoginBtn.addEventListener('click', function() {
      const email = document.getElementById('modal-email').value;
      const password = document.getElementById('modal-password').value;

      if (fullNameField) {
        fullNameField.style.display = 'none';
      }
      signUpMode = false;

      if (!email || !password) {
        showNotification('Please enter both email and password', 'error');
        return;
      }
      
      if (typeof window.signIn === 'function') {
        window.signIn(email, password);
      } else {
        showNotification('Login functionality not available. Please refresh the page.', 'error');
      }
    });
  }

  const googleBtn = document.getElementById('google-login-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', function() {
      if (typeof window.signInWithGoogle === 'function') {
        window.signInWithGoogle();
      } else {
        showNotification('Google sign in unavailable. Please refresh the page.', 'error');
      }
    });
  }
  
  // Forgot password link
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', function(e) {
      e.preventDefault();
      const email = document.getElementById('modal-email').value;
      if (!email) {
        showNotification('Enter your email above to reset your password', 'error');
        return;
      }
      if (typeof window.resetPassword === 'function') {
        window.resetPassword(email);
      }
    });
  }
}

// Authentication functionality
function setupAuth() {
  window.signUp = async function(email, password, fullName) {
    if (!supabase) {
      showNotification('Authentication service not available', 'error');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: fullName || '' } }
      });

      if (error) {
        if (/exists|registered/i.test(error.message)) {
          showNotification('This email is already registered. Please sign in or use "Forgot your password".', 'error');
          return;
        }
        throw error;
      }
      
      showNotification('Sign up successful! Please check your email for verification.', 'success');

      // Clear form and close modal
      const emailField = document.getElementById('modal-email');
      const passwordField = document.getElementById('modal-password');
      const nameField = document.getElementById('modal-full-name');
      if (emailField) emailField.value = '';
      if (passwordField) passwordField.value = '';
      if (nameField) nameField.value = '';
      if (loginModal) loginModal.style.display = 'none';
      if (typeof fullNameField !== 'undefined') {
        fullNameField.style.display = 'none';
      }
      signUpMode = false;
      
    } catch (err) {
      showNotification('Sign up failed: ' + err.message, 'error');
    }
  };
  
  window.signIn = async function(email, password) {
    if (!supabase) {
      showNotification('Authentication service not available', 'error');
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      if (error) throw error;
      
      showNotification('Logged in successfully!', 'success');
      
      // Clear form and close modal
      const emailField = document.getElementById('modal-email');
      const passwordField = document.getElementById('modal-password');
      const nameField = document.getElementById('modal-full-name');
      if (emailField) emailField.value = '';
      if (passwordField) passwordField.value = '';
      if (nameField) nameField.value = '';
      if (loginModal) loginModal.style.display = 'none';
      
    } catch (err) {
      showNotification('Login failed: ' + err.message, 'error');
    }
  };

  window.signInWithGoogle = async function() {
    if (!supabase) {
      showNotification('Authentication service not available', 'error');
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (err) {
      showNotification('Google sign in failed: ' + err.message, 'error');
    }
  };

  window.resetPassword = async function(email) {
    if (!supabase) {
      showNotification('Authentication service not available', 'error');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      showNotification('Password reset email sent', 'success');
    } catch (err) {
      showNotification('Password reset failed: ' + err.message, 'error');
    }
  };

  window.signOut = async function() {
    if (!supabase) {
      showNotification('Authentication service not available', 'error');
      return;
    }
    
    try {
      await supabase.auth.signOut();
      showNotification('Logged out successfully', 'success');
    } catch (err) {
      showNotification('Logout failed: ' + err.message, 'error');
    }
  };
}

// Main setup function
function setupEventListeners() {
  // Drop area functionality
  if (dropArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, () => {
        dropArea.classList.add('border-blue-600');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, () => {
        dropArea.classList.remove('border-blue-600');
      }, false);
    });
    
    dropArea.addEventListener('drop', (e) => {
      handleFiles(e.dataTransfer.files);
    }, false);
    
    // File input change handler
    if (fileElem) {
      fileElem.addEventListener('change', () => {
        handleFiles(fileElem.files);
      });
    }
    
    // Convert button click handler
    if (convertImagesBtn) {
      convertImagesBtn.addEventListener('click', async () => {
        // Get selected files
        const selectedIndices = [];
        document.querySelectorAll('.select-image:checked').forEach(checkbox => {
          const index = parseInt(checkbox.getAttribute('data-index'), 10) - 1;
          if (index >= 0 && index < _selectedFiles.length) {
            selectedIndices.push(index);
          }
        });
        
        // If no specific images are selected, process all images
        // If specific images are selected, process only those
        let filesToProcess;
        if (selectedIndices.length === 0) {
          // Process all images
          filesToProcess = _selectedFiles;
        } else {
          // Process only selected images
          filesToProcess = selectedIndices.map(i => _selectedFiles[i]);
        }
        
        if (!filesToProcess.length) {
          showNotification('No images to convert', 'error');
          return;
        }
        
        // Get conversion parameters
        const maxW = parseInt(maxWidthInput.value, 10) || 99999;
        const maxH = parseInt(maxHeightInput.value, 10) || 99999;
        const quality = parseFloat(qualityInput.value) || 0.9;
        const format = outputFormatInput.value;
        
        // Process images
        await processImages(filesToProcess, maxW, maxH, quality, format);
      });
    }
  }
  
  // Modal navigation
  if (modalPrev) {
    modalPrev.addEventListener('click', () => navigateModal(-1));
  }
  
  if (modalNext) {
    modalNext.addEventListener('click', () => navigateModal(1));
  }
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }
  
  // Format-specific options
  if (outputFormatInput) {
    outputFormatInput.addEventListener('change', function() {
      const formatOptions = document.getElementById('format-options');
      formatOptions.innerHTML = '';
      
      if (this.value === 'webp') {
        formatOptions.style.display = 'flex';
        const losslessOption = document.createElement('div');
        losslessOption.innerHTML = `
          <label class="flex items-center gap-2">
            <input type="checkbox" id="webp-lossless" class="rounded">
            <span>Lossless</span>
          </label>
        `;
        formatOptions.appendChild(losslessOption);
      } else {
        formatOptions.style.display = 'none';
      }
    });
  }

  // Resolution preset handling
  if (resolutionPreset) {
    resolutionPreset.addEventListener('change', () => {
      const val = resolutionPreset.value;
      if (val) {
        const [w, h] = val.split('x').map(n => parseInt(n, 10));
        if (!isNaN(w)) maxWidthInput.value = w;
        if (!isNaN(h)) maxHeightInput.value = h;
      }
    });
  }

  // Vertical 2:1 toggle
  if (verticalRatioToggle) {
    const updateVerticalRatio = () => {
      if (verticalRatioToggle.checked) {
        const w = parseInt(maxWidthInput.value, 10) || 0;
        maxHeightInput.value = w * 2;
      }
    };

    verticalRatioToggle.addEventListener('change', updateVerticalRatio);
    if (maxWidthInput) maxWidthInput.addEventListener('input', updateVerticalRatio);
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize DOM references
  dropArea = document.getElementById('drop-area');
  fileElem = document.getElementById('fileElem');
  downloadLink = document.getElementById('download-link');
  previewTable = document.getElementById('preview-table');
  previewTbody = document.getElementById('preview-tbody');
  maxWidthInput = document.getElementById('max-width');
  maxHeightInput = document.getElementById('max-height');
  qualityInput = document.getElementById('quality');
  outputFormatInput = document.getElementById('output-format');
  resolutionPreset = document.getElementById('resolution-preset');
  verticalRatioToggle = document.getElementById('toggle-vertical-2-1');
  progressStatus = document.getElementById('progress-status');
  progressBar = document.getElementById('progress-bar');
  convertImagesBtn = document.getElementById('convert-images-btn');
  selectAllCheckbox = document.getElementById('select-all');
  bulkRenameBtn = document.getElementById('bulk-rename-btn');
  bulkRenameBase = document.getElementById('bulk-rename-base');
  bulkRenameStart = document.getElementById('bulk-rename-start');
  showBulkRenameLink = document.getElementById('show-bulk-rename');
  bulkRenameControls = document.getElementById('bulk-rename-controls');
  upgradeBtn = document.getElementById('upgrade-btn');
  downloadSelectedBtn = document.getElementById('download-selected');
  
  // Ensure download buttons are hidden on page load
  const downloadButtonsContainer = document.querySelector('.download-btns-responsive');
  if (downloadButtonsContainer) {
    downloadButtonsContainer.style.display = 'none';
  }
  
  // Initialize navigation and modal references
  navLoginBtn = document.getElementById('nav-login-btn');
  navLogoutBtn = document.getElementById('nav-logout-btn');
  mobileMenuButton = document.getElementById('mobile-menu-button');
  mobileMenu = document.getElementById('mobile-menu');
  loginModal = document.getElementById('login-modal');
  closeLoginModal = document.getElementById('close-login-modal');
  modalSignupBtn = document.getElementById('modal-signup-btn');
  modalLoginBtn = document.getElementById('modal-login-btn');
  forgotPasswordLink = document.getElementById('forgot-password-link');
  
  // Initialize modal references
  imageModal = document.getElementById('image-modal');
  if (imageModal) {
    modalImg = imageModal.querySelector('img');
    modalCaption = document.getElementById('modal-caption');
    modalPrev = document.getElementById('modal-prev');
    modalNext = document.getElementById('modal-next');
    closeModalBtn = imageModal.querySelector('.close-modal');
  }
  
  // Initialize functionality
  initDebugMode();
  await initImageProcessingLibraries();
  await initSpecialFormatLibraries();
  initSupabase();
  updateQuotaStatus();
  setupEventListeners();
  setupBulkRename();
  setupDownloadSelected();
  setupSelectAll();
  setupInfoPopups();
  setupUpgradeButton();
  setupNavigation();
  setupFaqs();
  setupLoginModal();
  setupAuth();
  
  console.log('Image conversion app initialized');
}); 