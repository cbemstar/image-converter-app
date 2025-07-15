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
  initImageProcessingLibraries
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
    return true;
  }
  return false;
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
    alert('Please select image files only.');
    return;
  }
  
  // Hide download buttons and bulk rename tool when new files are loaded
  const downloadLink = document.getElementById('download-link');
  const downloadSelected = document.getElementById('download-selected');
  const bulkRenameLink = document.getElementById('show-bulk-rename');
  
  if (downloadLink) {
    downloadLink.classList.add('hidden');
    downloadLink.style.display = 'none';
  }
  
  if (downloadSelected) {
    downloadSelected.classList.add('hidden');
    downloadSelected.style.display = 'none';
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
  if (quota.used >= 10) {
    if (progressStatus) progressStatus.textContent = '';
    if (progressBar) progressBar.style.width = '0';
    updateQuotaStatus();
    toggleStripeAccordion(true);
    return;
  }
  
  // Allow up to 25MB for in-browser, >25MB for Supabase
  const validFiles = imageFiles.filter(f => f.size <= 100*1024*1024); // allow up to 100MB for pro, but hybrid logic will route
  let canProcess = Math.min(validFiles.length, 10 - quota.used);
  if (imageFiles.length > 10 || validFiles.length > 10 || canProcess < validFiles.length) {
    alert('You selected more than 10 images. Only the first 10 within your quota will be processed.');
  }
  if (canProcess === 0) {
    alert('No images can be processed (quota or size limit).');
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
          <a class="download-btn hidden ml-2" data-index="${i+1}">Download</a>
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
            
            input.addEventListener('blur', function() {
              const newName = input.value.trim();
              cell.textContent = newName || currentName;
              if (newName && newName !== currentName) {
                _selectedFiles[i].filename = newName;
              }
            });
            
            input.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') {
                input.blur();
              }
              if (e.key === 'Escape') {
                input.value = currentName;
                input.blur();
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
    updateButtonText();
  }
  
  // Setup magnify icon click handlers for lightbox
  setupMagnifyHandlers();
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
      const size = (blob.size / 1024).toFixed(1);
      const reduction = (100 - (blob.size / file.size * 100)).toFixed(1);
      sizeCell.innerHTML = `${size} KB<br><span style="color:#7fd7c4;font-size:0.85em;">${reduction}% smaller</span>`;
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
    const hasConverted = document.querySelector('.download-btn:not(.hidden)');
    
    if (hasConverted) {
      // Generate a ZIP file with all converted images
      const zip = new JSZip();
      let addedFiles = 0;
      
      // Find all download buttons and add their blobs to ZIP
      document.querySelectorAll('a.download-btn:not(.hidden)').forEach(async (btn) => {
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
      
      // Create download link for all files if there's at least one
      if (downloadLink && downloadLink.classList.contains('hidden')) {
        zip.generateAsync({ type: 'blob' }).then(zipBlob => {
          downloadLink.href = URL.createObjectURL(zipBlob);
          downloadLink.classList.remove('hidden');
          downloadLink.style.display = 'inline-block';
        });
      }
      
      // Show the Download Selected button
      if (downloadSelected && downloadSelected.classList.contains('hidden')) {
        downloadSelected.classList.remove('hidden');
        downloadSelected.style.display = 'inline-block';
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
  convertImagesBtn.textContent = `Convert ${selectedCount} Image${selectedCount !== 1 ? 's' : ''}`;
  
  // Show or hide the button based on selection
  convertImagesBtn.style.display = selectedCount > 0 ? 'block' : 'none';
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
      const downloadBtn = document.querySelector(`a.download-btn[data-index="${index}"]:not(.hidden)`);
      
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

// Authentication functionality
function setupAuth() {
  window.signUp = async function(email, password) {
    if (!supabase) {
      alert('Authentication service not available');
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
      });
      
      if (error) throw error;
      
      alert('Sign up successful! Please check your email for verification.');
    } catch (err) {
      alert('Sign up failed: ' + err.message);
    }
  };
  
  window.signIn = async function(email, password) {
    if (!supabase) {
      alert('Authentication service not available');
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      if (error) throw error;
      
      alert('Logged in successfully!');
      
      // Update UI for logged in state
      document.getElementById('auth-email').style.display = 'none';
      document.getElementById('auth-password').style.display = 'none';
      document.querySelector('button.bg-blue-500').style.display = 'none';
      document.querySelector('button.bg-green-500').style.display = 'none';
      document.querySelector('button.bg-red-500').style.display = 'inline-block';
      
      // Reset quota for logged in users
      localStorage.setItem('imgQuota', JSON.stringify({ start: Date.now(), used: 0 }));
      updateQuotaStatus();
      
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };
  
  window.signOut = async function() {
    if (!supabase) {
      alert('Authentication service not available');
      return;
    }
    
    try {
      await supabase.auth.signOut();
      
      // Update UI for logged out state
      document.getElementById('auth-email').style.display = 'inline-block';
      document.getElementById('auth-password').style.display = 'inline-block';
      document.querySelector('button.bg-blue-500').style.display = 'inline-block';
      document.querySelector('button.bg-green-500').style.display = 'inline-block';
      document.querySelector('button.bg-red-500').style.display = 'none';
      
      alert('Logged out successfully');
    } catch (err) {
      alert('Logout failed: ' + err.message);
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
        
        if (!selectedIndices.length) {
          showNotification('No images selected for conversion', 'error');
          return;
        }
        
        // Get files to process
        const filesToProcess = selectedIndices.map(i => _selectedFiles[i]);
        
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
  setupAuth();
  
  console.log('Image conversion app initialized');
}); 