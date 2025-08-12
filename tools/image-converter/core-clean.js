// core-clean.js - Consolidated image converter logic with proper auth and quota management

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Global state
let supabaseClient = null;
let authManager = null;
let currentUser = null;
let selectedFiles = [];
let guestUsage = { used: 0, lastReset: Date.now() };

// Constants
const GUEST_QUOTA_LIMIT = 3;
const GUEST_QUOTA_RESET_HOURS = 24;

// Initialize the application
async function initializeApp() {
  console.log('🚀 Initializing Image Converter...');
  
  try {
    // Wait for configuration to load
    await waitForConfig();
    
    // Initialize Supabase
    await initializeSupabase();
    
    // Initialize authentication
    await initializeAuth();
    
    // Initialize UI
    initializeUI();
    
    // Initialize quota system
    initializeQuotaSystem();
    
    console.log('✅ Image Converter initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize Image Converter:', error);
    // Continue with limited functionality
    initializeUI();
  }
}

// Wait for configuration to be available
function waitForConfig() {
  return new Promise((resolve) => {
    const checkConfig = () => {
      if (window.PUBLIC_ENV) {
        resolve();
      } else {
        setTimeout(checkConfig, 100);
      }
    };
    checkConfig();
  });
}

// Initialize Supabase client
async function initializeSupabase() {
  if (!window.PUBLIC_ENV?.SUPABASE_URL || !window.PUBLIC_ENV?.SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration missing');
  }
  
  supabaseClient = createClient(
    window.PUBLIC_ENV.SUPABASE_URL,
    window.PUBLIC_ENV.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
  
  // Make available globally
  window.supabaseClient = { getClient: () => supabaseClient };
  
  console.log('✅ Supabase client initialized');
}

// Initialize authentication
async function initializeAuth() {
  try {
    // Use existing AuthManager if available
    if (window.AuthManager && !window.authManager) {
      authManager = new window.AuthManager(window.supabaseClient);
      window.authManager = authManager;
    } else if (window.authManager) {
      authManager = window.authManager;
    }
    
    // Set up auth state listener
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email || 'No user');
      handleAuthStateChange(event, session);
    });
    
    // Get initial session
    const { data: { session } } = await supabaseClient.auth.getSession();
    handleAuthStateChange('INITIAL', session);
    
    console.log('✅ Authentication initialized');
    
  } catch (error) {
    console.error('❌ Authentication initialization failed:', error);
  }
}

// Handle authentication state changes
function handleAuthStateChange(event, session) {
  currentUser = session?.user || null;
  updateAuthUI(session);
  updateQuotaDisplay();
  
  // Notify other components
  document.dispatchEvent(new CustomEvent('authStateChanged', {
    detail: { event, session, user: currentUser }
  }));
}

// Update authentication UI
function updateAuthUI(session) {
  const authRequiredElements = document.querySelectorAll('[data-auth-required]');
  const guestOnlyElements = document.querySelectorAll('[data-guest-only]');
  
  if (session && session.user) {
    // Show authenticated UI
    authRequiredElements.forEach(el => {
      el.style.display = 'flex';
      el.classList.remove('hidden');
    });
    
    guestOnlyElements.forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    });
    
    // Update user info
    updateUserInfo(session.user);
    
  } else {
    // Show guest UI
    authRequiredElements.forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    });
    
    guestOnlyElements.forEach(el => {
      el.style.display = 'flex';
      el.classList.remove('hidden');
    });
  }
}

// Update user information in UI
function updateUserInfo(user) {
  const nameElements = document.querySelectorAll('[data-user-info="name"]');
  const avatarElements = document.querySelectorAll('[data-user-info="avatar"]');
  
  nameElements.forEach(el => {
    el.textContent = user.user_metadata?.full_name || 
                    user.email?.split('@')[0] || 
                    'User';
  });
  
  avatarElements.forEach(el => {
    if (el.tagName === 'IMG') {
      const avatarUrl = user.user_metadata?.avatar_url || 
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=0066cc&color=fff`;
      el.src = avatarUrl;
      el.style.display = 'block';
    }
  });
}

// Initialize UI components
function initializeUI() {
  // File input handling
  const fileElem = document.getElementById('fileElem');
  const dropArea = document.getElementById('drop-area');
  
  if (fileElem) {
    fileElem.addEventListener('change', handleFileSelect);
  }
  
  if (dropArea) {
    setupDropArea(dropArea);
  }
  
  // Dropdown handling
  setupDropdownHandling();
  
  // Sign out handling
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="signout"]')) {
      e.preventDefault();
      handleSignOut();
    }
  });
  
  // Convert button
  const convertBtn = document.getElementById('convert-images-btn');
  if (convertBtn) {
    convertBtn.addEventListener('click', handleConvertImages);
  }
  
  console.log('✅ UI initialized');
}

// Setup dropdown handling
function setupDropdownHandling() {
  document.addEventListener('click', (e) => {
    const dropdownToggle = e.target.closest('.dropdown-toggle');
    if (dropdownToggle) {
      e.preventDefault();
      toggleDropdown(dropdownToggle);
    } else if (!e.target.closest('.dropdown')) {
      // Close all dropdowns when clicking outside
      closeAllDropdowns();
    }
  });
}

// Toggle dropdown
function toggleDropdown(toggle) {
  const dropdown = toggle.nextElementSibling;
  if (!dropdown) return;
  
  const isOpen = dropdown.style.display === 'block';
  
  // Close all other dropdowns first
  closeAllDropdowns();
  
  if (!isOpen) {
    dropdown.style.display = 'block';
    toggle.setAttribute('aria-expanded', 'true');
  }
}

// Close all dropdowns
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-content').forEach(dropdown => {
    dropdown.style.display = 'none';
  });
  
  document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
    toggle.setAttribute('aria-expanded', 'false');
  });
}

// Handle sign out
async function handleSignOut() {
  try {
    if (authManager && authManager.signOut) {
      await authManager.signOut();
    } else if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    
    showNotification('Signed out successfully', 'success');
    
  } catch (error) {
    console.error('Sign out error:', error);
    showNotification('Error signing out', 'error');
  }
}

// Initialize quota system
function initializeQuotaSystem() {
  // Load guest usage from localStorage
  loadGuestUsage();
  
  // Update quota display
  updateQuotaDisplay();
  
  // Set up periodic quota refresh for authenticated users
  if (currentUser) {
    setInterval(updateQuotaDisplay, 30000); // Refresh every 30 seconds
  }
  
  console.log('✅ Quota system initialized');
}

// Load guest usage from localStorage
function loadGuestUsage() {
  try {
    const stored = localStorage.getItem('guestImageQuota');
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Check if quota should reset (24 hours)
      const hoursSinceReset = (Date.now() - parsed.lastReset) / (1000 * 60 * 60);
      if (hoursSinceReset >= GUEST_QUOTA_RESET_HOURS) {
        guestUsage = { used: 0, lastReset: Date.now() };
        saveGuestUsage();
      } else {
        guestUsage = parsed;
      }
    }
  } catch (error) {
    console.error('Error loading guest usage:', error);
    guestUsage = { used: 0, lastReset: Date.now() };
  }
}

// Save guest usage to localStorage
function saveGuestUsage() {
  try {
    localStorage.setItem('guestImageQuota', JSON.stringify(guestUsage));
  } catch (error) {
    console.error('Error saving guest usage:', error);
  }
}

// Update quota display
async function updateQuotaDisplay() {
  if (currentUser) {
    await updateAuthenticatedQuotaDisplay();
  } else {
    updateGuestQuotaDisplay();
  }
}

// Update authenticated user quota display
async function updateAuthenticatedQuotaDisplay() {
  try {
    // Fetch usage from Supabase
    const { data: usage, error } = await supabaseClient
      .from('user_usage')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    // Get user profile for plan info
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('subscription_plan')
      .eq('id', currentUser.id)
      .single();
    
    const plan = profile?.subscription_plan || 'free';
    const planLimits = getPlanLimits(plan);
    
    const usedConversions = usage?.conversions_used || 0;
    const limitConversions = planLimits.monthlyConversions;
    
    // Update UI elements
    const quotaUsedEl = document.getElementById('quota-used');
    const quotaLimitEl = document.getElementById('quota-limit');
    const currentPlanEl = document.getElementById('current-plan');
    const quotaResetEl = document.getElementById('quota-reset-date');
    
    if (quotaUsedEl) quotaUsedEl.textContent = usedConversions;
    if (quotaLimitEl) quotaLimitEl.textContent = limitConversions === -1 ? '∞' : limitConversions;
    if (currentPlanEl) currentPlanEl.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    
    if (quotaResetEl && usage?.period_end) {
      const resetDate = new Date(usage.period_end);
      quotaResetEl.textContent = resetDate.toLocaleDateString();
    }
    
  } catch (error) {
    console.error('Error updating authenticated quota display:', error);
    
    // Fallback display
    const quotaUsedEl = document.getElementById('quota-used');
    const quotaLimitEl = document.getElementById('quota-limit');
    const currentPlanEl = document.getElementById('current-plan');
    
    if (quotaUsedEl) quotaUsedEl.textContent = '0';
    if (quotaLimitEl) quotaLimitEl.textContent = '10';
    if (currentPlanEl) currentPlanEl.textContent = 'Free';
  }
}

// Update guest quota display
function updateGuestQuotaDisplay() {
  const guestQuotaUsedEl = document.getElementById('guest-quota-used');
  if (guestQuotaUsedEl) {
    guestQuotaUsedEl.textContent = guestUsage.used;
  }
}

// Get plan limits
function getPlanLimits(plan) {
  const limits = {
    guest: { monthlyConversions: 3, maxFileSize: 25 * 1024 * 1024 },
    free: { monthlyConversions: 10, maxFileSize: 25 * 1024 * 1024 },
    pro: { monthlyConversions: 1000, maxFileSize: 100 * 1024 * 1024 },
    unlimited: { monthlyConversions: -1, maxFileSize: 250 * 1024 * 1024 }
  };
  
  return limits[plan] || limits.free;
}

// Check if conversion is allowed
async function checkConversionQuota(fileCount = 1) {
  if (currentUser) {
    return await checkAuthenticatedQuota(fileCount);
  } else {
    return checkGuestQuota(fileCount);
  }
}

// Check authenticated user quota
async function checkAuthenticatedQuota(fileCount) {
  try {
    const { data: usage } = await supabaseClient
      .from('user_usage')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();
    
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('subscription_plan')
      .eq('id', currentUser.id)
      .single();
    
    const plan = profile?.subscription_plan || 'free';
    const planLimits = getPlanLimits(plan);
    const usedConversions = usage?.conversions_used || 0;
    
    if (planLimits.monthlyConversions === -1) {
      return { allowed: true, remaining: -1, plan };
    }
    
    const remaining = planLimits.monthlyConversions - usedConversions;
    const allowed = remaining >= fileCount;
    
    return {
      allowed,
      remaining,
      plan,
      message: allowed ? null : `You have used all ${planLimits.monthlyConversions} conversions for this month.`
    };
    
  } catch (error) {
    console.error('Error checking authenticated quota:', error);
    return { allowed: false, error: 'QUOTA_CHECK_FAILED', message: 'Unable to check quota. Please try again.' };
  }
}

// Check guest quota
function checkGuestQuota(fileCount) {
  const remaining = GUEST_QUOTA_LIMIT - guestUsage.used;
  const allowed = remaining >= fileCount;
  
  return {
    allowed,
    remaining,
    plan: 'guest',
    isGuest: true,
    message: allowed ? null : `Guest users can convert up to ${GUEST_QUOTA_LIMIT} images per day. Please sign in for more conversions.`
  };
}

// Record conversion usage
async function recordConversion(fileCount = 1) {
  if (currentUser) {
    await recordAuthenticatedConversion(fileCount);
  } else {
    recordGuestConversion(fileCount);
  }
  
  // Update quota display
  updateQuotaDisplay();
}

// Record authenticated user conversion
async function recordAuthenticatedConversion(fileCount) {
  try {
    const { error } = await supabaseClient.rpc('increment_user_usage', {
      user_id: currentUser.id,
      conversions_increment: fileCount
    });
    
    if (error) throw error;
    
  } catch (error) {
    console.error('Error recording authenticated conversion:', error);
  }
}

// Record guest conversion
function recordGuestConversion(fileCount) {
  guestUsage.used += fileCount;
  saveGuestUsage();
}

// Setup drop area
function setupDropArea(dropArea) {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  dropArea.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  e.currentTarget.classList.add('drag-over');
}

function unhighlight(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

function handleFileSelect(e) {
  const files = e.target.files;
  handleFiles(files);
}

// Handle selected files
async function handleFiles(files) {
  if (!files || files.length === 0) return;
  
  // Check quota before processing
  const quotaCheck = await checkConversionQuota(files.length);
  if (!quotaCheck.allowed) {
    showNotification(quotaCheck.message, 'error');
    if (quotaCheck.isGuest) {
      showUpgradePrompt();
    }
    return;
  }
  
  selectedFiles = Array.from(files);
  displayFilePreview();
  showConvertButton();
}

// Display file preview
function displayFilePreview() {
  const previewTable = document.getElementById('preview-table');
  const previewTableBody = document.getElementById('preview-table-body');
  
  if (!previewTable || !previewTableBody) return;
  
  previewTableBody.innerHTML = '';
  
  selectedFiles.forEach((file, index) => {
    const row = createPreviewRow(file, index);
    previewTableBody.appendChild(row);
  });
  
  previewTable.style.display = 'table';
}

// Create preview row
function createPreviewRow(file, index) {
  const row = document.createElement('tr');
  row.className = 'border-b hover:bg-gray-50';
  
  const fileUrl = URL.createObjectURL(file);
  
  row.innerHTML = `
    <td class="px-2 py-3">
      <input type="checkbox" class="select-image mr-2" data-index="${index}" checked>
      <span class="font-medium">${index + 1}</span>
    </td>
    <td class="px-2 py-3">
      <img src="${fileUrl}" alt="Preview" class="w-16 h-16 object-cover rounded border">
    </td>
    <td class="px-2 py-3">
      <span class="text-sm font-medium">${sanitizeFilename(file.name)}</span>
      <div class="text-xs text-gray-500">${formatFileSize(file.size)}</div>
    </td>
    <td class="px-2 py-3">
      <input type="text" class="rename-input border rounded px-2 py-1 text-sm w-full" 
             value="${getBaseName(file.name)}" data-index="${index}">
    </td>
    <td class="px-2 py-3">
      <span class="text-sm text-gray-600">Processing...</span>
    </td>
    <td class="px-2 py-3">
      <button class="text-red-600 hover:text-red-800 text-sm" onclick="removeFile(${index})">
        <i class="fas fa-trash"></i>
      </button>
    </td>
  `;
  
  return row;
}

// Show convert button
function showConvertButton() {
  const convertBtn = document.getElementById('convert-images-btn');
  if (convertBtn) {
    convertBtn.style.display = 'block';
    convertBtn.classList.remove('hidden');
  }
}

// Handle convert images
async function handleConvertImages() {
  const selectedIndices = getSelectedFileIndices();
  if (selectedIndices.length === 0) {
    showNotification('Please select at least one image to convert', 'warning');
    return;
  }
  
  // Check quota again
  const quotaCheck = await checkConversionQuota(selectedIndices.length);
  if (!quotaCheck.allowed) {
    showNotification(quotaCheck.message, 'error');
    return;
  }
  
  // Start conversion
  await convertSelectedImages(selectedIndices);
}

// Get selected file indices
function getSelectedFileIndices() {
  const checkboxes = document.querySelectorAll('.select-image:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
}

// Convert selected images
async function convertSelectedImages(indices) {
  const outputFormat = document.getElementById('output-format').value;
  const maxWidth = parseInt(document.getElementById('max-width').value);
  const maxHeight = parseInt(document.getElementById('max-height').value);
  const targetSize = parseInt(document.getElementById('target-size').value);
  const sizeUnit = document.getElementById('size-unit').value;
  
  let convertedCount = 0;
  
  for (const index of indices) {
    const file = selectedFiles[index];
    if (!file) continue;
    
    try {
      updateProgress(`Converting ${file.name}...`, (convertedCount / indices.length) * 100);
      
      const convertedBlob = await convertImage(file, {
        format: outputFormat,
        maxWidth,
        maxHeight,
        targetSize: sizeUnit === 'MB' ? targetSize * 1024 * 1024 : targetSize * 1024
      });
      
      // Update preview with result
      updatePreviewResult(index, convertedBlob);
      convertedCount++;
      
    } catch (error) {
      console.error(`Error converting ${file.name}:`, error);
      updatePreviewError(index, error.message);
    }
  }
  
  // Record usage
  await recordConversion(convertedCount);
  
  // Show completion
  updateProgress(`Successfully converted ${convertedCount} of ${indices.length} images!`, 100);
  showDownloadButtons();
  
  // Clear progress after delay
  setTimeout(() => {
    updateProgress('', 0);
  }, 3000);
}

// Convert single image
async function convertImage(file, options) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate dimensions
        let { width, height } = calculateDimensions(img.width, img.height, options.maxWidth, options.maxHeight);
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert image'));
          }
        }, `image/${options.format}`, 0.9);
        
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Calculate dimensions
function calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
  let width = originalWidth;
  let height = originalHeight;
  
  // Scale down if necessary
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  
  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

// Update progress
function updateProgress(message, percentage) {
  const progressStatus = document.getElementById('progress-status');
  const progressBar = document.getElementById('progress-bar');
  
  if (progressStatus) {
    progressStatus.textContent = message;
  }
  
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
    progressBar.style.background = percentage === 100 ? '#10b981' : '#3b82f6';
  }
}

// Update preview result
function updatePreviewResult(index, blob) {
  const row = document.querySelector(`tr:nth-child(${index + 1})`);
  if (!row) return;
  
  const sizeCell = row.cells[4];
  if (sizeCell) {
    sizeCell.innerHTML = `<span class="text-sm text-green-600">${formatFileSize(blob.size)}</span>`;
  }
}

// Update preview error
function updatePreviewError(index, errorMessage) {
  const row = document.querySelector(`tr:nth-child(${index + 1})`);
  if (!row) return;
  
  const sizeCell = row.cells[4];
  if (sizeCell) {
    sizeCell.innerHTML = `<span class="text-sm text-red-600">Error: ${errorMessage}</span>`;
  }
}

// Show download buttons
function showDownloadButtons() {
  const downloadBtns = document.querySelector('.download-btns-responsive');
  if (downloadBtns) {
    downloadBtns.style.display = 'flex';
  }
}

// Utility functions
function sanitizeFilename(name) {
  return name.replace(/[<>&"'`]/g, '');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getBaseName(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

function showNotification(message, type = 'info') {
  // Simple notification system
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function showUpgradePrompt() {
  const upgradeBtn = document.getElementById('upgrade-btn');
  if (upgradeBtn) {
    upgradeBtn.scrollIntoView({ behavior: 'smooth' });
    upgradeBtn.style.animation = 'pulse 2s infinite';
  }
}

// Global functions for HTML onclick handlers
window.removeFile = function(index) {
  selectedFiles.splice(index, 1);
  displayFilePreview();
  
  if (selectedFiles.length === 0) {
    const previewTable = document.getElementById('preview-table');
    const convertBtn = document.getElementById('convert-images-btn');
    
    if (previewTable) previewTable.style.display = 'none';
    if (convertBtn) convertBtn.style.display = 'none';
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}