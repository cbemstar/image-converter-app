// core.js - Main application logic for image converter

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
} from '../../utils.js';

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

// Authentication variables
let supabase = null;
let authManager = null;
let usageTracker = null;
let quotaManager = null;
let stripeManager = null;

// Sanitize filenames to prevent XSS
function sanitizeFilename(name) {
  return name.replace(/[<>&"'`]/g, '');
}

// Initialize Supabase client and authentication
async function initializeAuth() {
  try {
    // Wait for public config to be loaded
    if (!window.PUBLIC_ENV) {
      console.log('Waiting for public config...');
      await new Promise(resolve => {
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

    console.log('Initializing Supabase client...');
    
    // Create Supabase client
    supabase = createClient(
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

    // Make supabase client available globally
    window.supabaseClient = { getClient: () => supabase };

    // Initialize AuthManager if available
    if (window.AuthManager) {
      authManager = new window.AuthManager(window.supabaseClient);
      window.authManager = authManager;
    } else {
      // Fallback: create basic auth management
      setupBasicAuthManagement();
    }

    // Initialize usage tracking and quota management
    await initializeQuotaSystem();

    console.log('✅ Authentication initialized successfully');

  } catch (error) {
    console.error('❌ Authentication initialization failed:', error);
    // Continue without auth - app should still work for anonymous users
  }
}

// Initialize quota and usage tracking system
async function initializeQuotaSystem() {
  try {
    // Initialize usage tracker
    if (window.usageTracker) {
      usageTracker = window.usageTracker;
    } else if (window.useUsage) {
      const { usageTracker: tracker } = window.useUsage();
      usageTracker = tracker;
    }

    // Initialize quota manager
    if (window.quotaManager) {
      quotaManager = window.quotaManager;
    }

    // Initialize Stripe manager
    if (window.stripeManager) {
      stripeManager = window.stripeManager;
    }

    // Set up usage tracking UI
    await setupUsageDisplay();

    console.log('✅ Quota system initialized');

  } catch (error) {
    console.error('❌ Quota system initialization failed:', error);
  }
}

// Basic auth management fallback
function setupBasicAuthManagement() {
  // Listen for auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session?.user?.email || 'No user');
    updateAuthUI(session);
  });

  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    updateAuthUI(session);
  });

  // Add sign out handler
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="signout"]')) {
      e.preventDefault();
      handleSignOut();
    }
  });

  // Add dropdown toggle handler
  document.addEventListener('click', (e) => {
    if (e.target.matches('.dropdown-toggle') || e.target.closest('.dropdown-toggle')) {
      e.preventDefault();
      toggleUserDropdown();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      closeUserDropdown();
    }
  });
}

// Update authentication UI
function updateAuthUI(session) {
  const authRequiredElements = document.querySelectorAll('[data-auth-required]');
  const guestOnlyElements = document.querySelectorAll('[data-guest-only]');
  const userInfoElements = document.querySelectorAll('[data-user-info]');

  if (session && session.user) {
    console.log('Showing authenticated UI for:', session.user.email);
    
    // Show auth-required elements
    authRequiredElements.forEach(el => {
      el.style.display = 'flex';
      el.classList.remove('hidden');
    });

    // Hide guest-only elements
    guestOnlyElements.forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    });

    // Update user info elements
    userInfoElements.forEach(el => {
      const infoType = el.dataset.userInfo;
      switch (infoType) {
        case 'email':
          el.textContent = session.user.email || '';
          break;
        case 'name':
          el.textContent = session.user.user_metadata?.full_name || 
                         session.user.email?.split('@')[0] || 
                         'User';
          break;
        case 'avatar':
          if (el.tagName === 'IMG') {
            const avatarUrl = session.user.user_metadata?.avatar_url || 
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.email || 'User')}&background=0066cc&color=fff`;
            el.src = avatarUrl;
            el.style.display = 'block';
          }
          break;
      }
    });

  } else {
    console.log('Showing guest UI');
    
    // Hide auth-required elements
    authRequiredElements.forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    });

    // Show guest-only elements
    guestOnlyElements.forEach(el => {
      el.style.display = 'flex';
      el.classList.remove('hidden');
    });

    // Clear user info elements
    userInfoElements.forEach(el => {
      const infoType = el.dataset.userInfo;
      switch (infoType) {
        case 'email':
        case 'name':
          el.textContent = '';
          break;
        case 'avatar':
          if (el.tagName === 'IMG') {
            el.style.display = 'none';
            el.src = '';
          }
          break;
      }
    });
  }
}

// Handle sign out
async function handleSignOut() {
  try {
    console.log('Signing out...');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    console.log('✅ Signed out successfully');
    closeUserDropdown();
    
  } catch (error) {
    console.error('❌ Sign out error:', error);
    alert('Error signing out: ' + error.message);
  }
}

// Toggle user dropdown menu
function toggleUserDropdown() {
  const dropdown = document.querySelector('.dropdown-content');
  const toggle = document.querySelector('.dropdown-toggle');
  
  if (dropdown && toggle) {
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    toggle.setAttribute('aria-expanded', isVisible ? 'false' : 'true');
  }
}

// Close user dropdown menu
function closeUserDropdown() {
  const dropdown = document.querySelector('.dropdown-content');
  const toggle = document.querySelector('.dropdown-toggle');
  
  if (dropdown && toggle) {
    dropdown.style.display = 'none';
    toggle.setAttribute('aria-expanded', 'false');
  }
}

// Authentication Guards and Quota Integration
// ==========================================

/**
 * Check if user can perform conversions based on authentication and quota
 * Requirements: 5.1-5.6, 6.1-6.3
 */
async function checkConversionQuota(requestedCount = 1) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Guest user - use localStorage quota
      return checkGuestQuota(requestedCount);
    }

    // Authenticated user - check server-side quota
    return await checkAuthenticatedUserQuota(user, requestedCount);

  } catch (error) {
    console.error('Error checking conversion quota:', error);
    return {
      allowed: false,
      error: 'QUOTA_CHECK_FAILED',
      message: 'Unable to check quota. Please try again.',
      remaining: 0,
      maxFileSize: 25 * 1024 * 1024 // 25MB default
    };
  }
}

/**
 * Check quota for guest users
 */
function checkGuestQuota(requestedCount) {
  const guestQuota = getGuestUsageFromStorage();
  const remaining = Math.max(0, 3 - guestQuota.used); // Guest limit: 3 conversions
  
  return {
    allowed: remaining >= requestedCount,
    error: remaining < requestedCount ? 'QUOTA_EXCEEDED' : null,
    message: remaining < requestedCount ? 'Guest users can convert up to 3 images. Sign in for more conversions.' : null,
    remaining: remaining,
    maxFileSize: 25 * 1024 * 1024, // 25MB for guests
    isGuest: true,
    plan: 'guest'
  };
}

/**
 * Check quota for authenticated users
 */
async function checkAuthenticatedUserQuota(user, requestedCount) {
  try {
    // Use usage tracker if available
    if (usageTracker) {
      await usageTracker.fetchUsage();
      const currentUsage = usageTracker.getCurrentUsage();
      
      if (currentUsage) {
        const remaining = currentUsage.remainingConversions;
        const planLimits = getPlanLimits(currentUsage.planName);
        
        return {
          allowed: remaining >= requestedCount,
          error: remaining < requestedCount ? 'QUOTA_EXCEEDED' : null,
          message: remaining < requestedCount ? `You've used all ${currentUsage.conversionsLimit} conversions this month. Upgrade for more.` : null,
          remaining: remaining,
          maxFileSize: planLimits.maxFileSize,
          plan: currentUsage.planName.toLowerCase(),
          conversionsUsed: currentUsage.conversionsUsed,
          conversionsLimit: currentUsage.conversionsLimit
        };
      }
    }

    // Fallback: use quota manager
    if (quotaManager) {
      const quotaCheck = await quotaManager.checkConversionQuota();
      const planLimits = quotaManager.getCurrentPlanLimits();
      
      return {
        allowed: quotaCheck.allowed,
        error: quotaCheck.allowed ? null : 'QUOTA_EXCEEDED',
        message: quotaCheck.allowed ? null : 'Monthly conversion limit reached. Upgrade for more conversions.',
        remaining: quotaCheck.remaining || 0,
        maxFileSize: planLimits.maxFileSize,
        plan: 'free' // Default fallback
      };
    }

    // Final fallback: assume free plan with basic limits
    return {
      allowed: true,
      remaining: 10, // Free plan default
      maxFileSize: 25 * 1024 * 1024,
      plan: 'free'
    };

  } catch (error) {
    console.error('Error checking authenticated user quota:', error);
    return {
      allowed: false,
      error: 'QUOTA_CHECK_FAILED',
      message: 'Unable to verify your quota. Please try again.',
      remaining: 0,
      maxFileSize: 25 * 1024 * 1024
    };
  }
}

/**
 * Get guest usage from localStorage
 */
function getGuestUsageFromStorage() {
  const stored = localStorage.getItem('guestImageQuota');
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  let guestData;
  
  if (stored) {
    try {
      guestData = JSON.parse(stored);
      
      // Reset daily if more than 24 hours have passed
      if (now - guestData.lastReset > oneDay) {
        guestData = { used: 0, lastReset: now };
        localStorage.setItem('guestImageQuota', JSON.stringify(guestData));
      }
    } catch (error) {
      guestData = { used: 0, lastReset: now };
      localStorage.setItem('guestImageQuota', JSON.stringify(guestData));
    }
  } else {
    guestData = { used: 0, lastReset: now };
    localStorage.setItem('guestImageQuota', JSON.stringify(guestData));
  }

  return guestData;
}

/**
 * Update guest usage in localStorage
 */
function updateGuestUsage(increment = 1) {
  const current = getGuestUsageFromStorage();
  const newUsage = {
    used: current.used + increment,
    lastReset: current.lastReset
  };
  
  localStorage.setItem('guestImageQuota', JSON.stringify(newUsage));
  return newUsage;
}

/**
 * Get plan limits based on plan name
 */
function getPlanLimits(planName) {
  const limits = {
    guest: {
      maxFileSize: 25 * 1024 * 1024, // 25MB
      monthlyConversions: 3
    },
    free: {
      maxFileSize: 25 * 1024 * 1024, // 25MB
      monthlyConversions: 10
    },
    pro: {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      monthlyConversions: 1000
    },
    unlimited: {
      maxFileSize: 250 * 1024 * 1024, // 250MB
      monthlyConversions: -1 // Unlimited
    }
  };

  const plan = planName ? planName.toLowerCase() : 'free';
  return limits[plan] || limits.free;
}

/**
 * Record a successful conversion
 */
async function recordConversion() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Update guest usage
      updateGuestUsage(1);
      updateUsageDisplay();
      return;
    }

    // For authenticated users, the server-side Edge Function handles the increment
    // We just need to refresh the usage display
    if (usageTracker) {
      await usageTracker.recordConversion();
    }
    
    updateUsageDisplay();

  } catch (error) {
    console.error('Error recording conversion:', error);
  }
}

/**
 * Show upgrade prompt when quota is exceeded
 */
function showUpgradePrompt(quotaInfo) {
  const { plan, isGuest } = quotaInfo;
  
  if (isGuest) {
    showGuestUpgradePrompt();
  } else {
    showAuthenticatedUpgradePrompt(plan);
  }
}

/**
 * Show upgrade prompt for guest users
 */
function showGuestUpgradePrompt() {
  const modal = createUpgradeModal({
    title: 'Sign In for More Conversions',
    message: 'Guest users can convert up to 3 images per day. Sign in to get 10 free conversions per month and access to premium plans.',
    primaryAction: {
      text: 'Sign In',
      action: () => redirectToAuth()
    },
    secondaryAction: {
      text: 'View Plans',
      action: () => window.open('/pricing.html', '_blank')
    }
  });
  
  document.body.appendChild(modal);
}

/**
 * Show upgrade prompt for authenticated users
 */
function showAuthenticatedUpgradePrompt(currentPlan) {
  const planInfo = {
    free: {
      title: 'Upgrade to Pro',
      message: 'You\'ve used all your free conversions this month. Upgrade to Pro for 1,000 conversions per month.',
      upgradeTarget: 'pro'
    },
    pro: {
      title: 'Upgrade to Unlimited',
      message: 'You\'ve reached your Pro plan limit. Upgrade to Unlimited for unlimited conversions.',
      upgradeTarget: 'unlimited'
    }
  };

  const info = planInfo[currentPlan] || planInfo.free;
  
  const modal = createUpgradeModal({
    title: info.title,
    message: info.message,
    primaryAction: {
      text: 'Upgrade Now',
      action: () => initiateUpgrade(info.upgradeTarget)
    },
    secondaryAction: {
      text: 'Manage Billing',
      action: () => openCustomerPortal()
    }
  });
  
  document.body.appendChild(modal);
}

/**
 * Create upgrade modal
 */
function createUpgradeModal({ title, message, primaryAction, secondaryAction }) {
  const modal = document.createElement('div');
  modal.className = 'upgrade-modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div class="upgrade-modal" style="
      background: var(--background);
      border: 2px solid var(--foreground);
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      text-align: center;
    ">
      <h3 style="color: var(--foreground); margin-bottom: 16px;">${title}</h3>
      <p style="color: var(--foreground); margin-bottom: 24px; line-height: 1.5;">${message}</p>
      <div class="modal-actions" style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn btn-primary primary-action">${primaryAction.text}</button>
        ${secondaryAction ? `<button class="btn btn-secondary secondary-action">${secondaryAction.text}</button>` : ''}
        <button class="btn btn-outline close-modal">Close</button>
      </div>
    </div>
  `;

  // Add event listeners
  modal.querySelector('.primary-action').addEventListener('click', () => {
    primaryAction.action();
    modal.remove();
  });

  if (secondaryAction) {
    modal.querySelector('.secondary-action').addEventListener('click', () => {
      secondaryAction.action();
      modal.remove();
    });
  }

  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  return modal;
}

/**
 * Initiate upgrade process
 */
async function initiateUpgrade(planType) {
  try {
    if (!stripeManager) {
      console.error('Stripe manager not available');
      showNotification('Billing system not available. Please try again later.', 'error');
      return;
    }

    await stripeManager.purchasePlan(planType, {
      successUrl: `${window.location.origin}/tools/image-converter/index.html?upgrade=success`,
      cancelUrl: `${window.location.href}?upgrade=canceled`
    });

  } catch (error) {
    console.error('Error initiating upgrade:', error);
    showNotification('Failed to start upgrade process. Please try again.', 'error');
  }
}

/**
 * Open Customer Portal
 */
async function openCustomerPortal() {
  try {
    if (!stripeManager) {
      console.error('Stripe manager not available');
      showNotification('Billing system not available. Please try again later.', 'error');
      return;
    }

    await stripeManager.redirectToCustomerPortal({
      returnUrl: window.location.href
    });

  } catch (error) {
    console.error('Error opening Customer Portal:', error);
    showNotification('Failed to open billing portal. Please try again.', 'error');
  }
}

/**
 * Redirect to authentication page
 */
function redirectToAuth() {
  const currentUrl = encodeURIComponent(window.location.href);
  window.location.href = `/auth.html?callback=${currentUrl}`;
}

/**
 * Set up usage display in the UI
 */
async function setupUsageDisplay() {
  try {
    const usageContainer = document.getElementById('usage-counter');
    if (!usageContainer) {
      console.warn('Usage counter container not found');
      return;
    }

    // Initial display
    await updateUsageDisplay();

    // Set up periodic updates
    setInterval(updateUsageDisplay, 30000); // Update every 30 seconds

  } catch (error) {
    console.error('Error setting up usage display:', error);
  }
}

/**
 * Update usage display in the UI
 */
async function updateUsageDisplay() {
  try {
    const usageContainer = document.getElementById('usage-counter');
    if (!usageContainer) return;

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Guest user display
      const guestUsage = getGuestUsageFromStorage();
      const remaining = Math.max(0, 3 - guestUsage.used);
      
      usageContainer.innerHTML = `
        <div class="usage-display guest">
          <div class="usage-text">
            <span class="usage-count">${remaining} of 3</span>
            <span class="usage-label">free conversions remaining</span>
          </div>
          <div class="usage-bar">
            <div class="usage-fill" style="width: ${(guestUsage.used / 3) * 100}%"></div>
          </div>
          <div class="usage-actions">
            <button class="btn btn-sm btn-primary" onclick="redirectToAuth()">Sign In for More</button>
          </div>
        </div>
      `;
      return;
    }

    // Authenticated user display
    if (usageTracker) {
      const currentUsage = usageTracker.getCurrentUsage();
      if (currentUsage) {
        const percentage = (currentUsage.conversionsUsed / currentUsage.conversionsLimit) * 100;
        const isUnlimited = currentUsage.conversionsLimit === -1;
        
        usageContainer.innerHTML = `
          <div class="usage-display authenticated">
            <div class="usage-text">
              <span class="usage-count">
                ${isUnlimited ? 'Unlimited' : `${currentUsage.remainingConversions} of ${currentUsage.conversionsLimit}`}
              </span>
              <span class="usage-label">conversions remaining</span>
            </div>
            ${!isUnlimited ? `
              <div class="usage-bar">
                <div class="usage-fill ${percentage >= 90 ? 'critical' : percentage >= 75 ? 'warning' : 'normal'}" 
                     style="width: ${Math.min(percentage, 100)}%"></div>
              </div>
            ` : ''}
            <div class="usage-info">
              <span class="plan-name">${currentUsage.planName} Plan</span>
              ${currentUsage.periodEnd ? `<span class="reset-date">Resets ${new Date(currentUsage.periodEnd).toLocaleDateString()}</span>` : ''}
            </div>
            ${currentUsage.remainingConversions <= 0 ? `
              <div class="usage-actions">
                <button class="btn btn-sm btn-primary" onclick="initiateUpgrade('pro')">Upgrade Plan</button>
              </div>
            ` : ''}
          </div>
        `;
      }
    }

  } catch (error) {
    console.error('Error updating usage display:', error);
  }
}

// Make functions available globally for compatibility
window.checkConversionQuota = checkConversionQuota;
window.recordConversion = recordConversion;
window.showUpgradePrompt = showUpgradePrompt;
window.initiateUpgrade = initiateUpgrade;
window.openCustomerPortal = openCustomerPortal;
window.redirectToAuth = redirectToAuth;

// DOM elements - These will be initialized when DOM is loaded
let dropArea;
let fileElem;
let downloadLink;
let previewTable;
let previewTbody;
let maxWidthInput;
let maxHeightInput;
let targetSizeInput;
let sizeUnitSelect;
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

// Supabase client instance (initialized from supabase-client.js)
let supabase;

// Initialize Supabase if available
function initSupabase() {
  if (!window.supabaseClient) {
    console.error('Supabase client not initialized.');
    return false;
  }

  supabase = window.supabaseClient.getClient();

  if (!supabase) {
    console.error('Supabase client unavailable.');
    return false;
  }

  // Listen for auth state changes
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

  return true;
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
  
  // Check quota using integrated system
  const quotaCheck = await checkConversionQuota(imageFiles.length);
  if (!quotaCheck.allowed) {
    if (progressStatus) progressStatus.textContent = '';
    if (progressBar) progressBar.style.width = '0';
    
    if (quotaCheck.error === 'QUOTA_EXCEEDED') {
      showUpgradePrompt(quotaCheck);
    } else {
      showNotification(quotaCheck.message || 'Cannot process images at this time.', 'error');
    }
    return;
  }
  
  // Use quota check results for file processing
  const validFiles = imageFiles.filter(f => f.size <= quotaCheck.maxFileSize);
  let canProcess = Math.min(validFiles.length, quotaCheck.remaining);
  
  if (imageFiles.length > canProcess) {
    showNotification(`You selected ${imageFiles.length} images. Only ${canProcess} can be processed within your quota.`, 'warning');
  }
  
  if (canProcess === 0) {
    showNotification('No images can be processed (quota or size limit).', 'error');
    showUpgradePrompt(quotaCheck);
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

        // Select checkbox cell
        const selectCell = document.createElement('td');
        selectCell.setAttribute('data-label', 'Select');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'select-image';
        checkbox.dataset.index = i + 1;
        checkbox.checked = true;
        selectCell.appendChild(checkbox);
        tr.appendChild(selectCell);

        // Index cell
        const indexCell = document.createElement('td');
        indexCell.setAttribute('data-label', '#');
        indexCell.textContent = i + 1;
        tr.appendChild(indexCell);

        // Preview cell with magnify icon
        const previewCell = document.createElement('td');
        previewCell.setAttribute('data-label', 'Preview');
        const previewContainer = document.createElement('span');
        previewContainer.className = 'preview-img-container';
        const img = document.createElement('img');
        img.className = 'preview';
        img.src = e.target.result;
        img.alt = 'preview';
        const magnifyIcon = document.createElement('span');
        magnifyIcon.className = 'magnify-icon';
        magnifyIcon.dataset.img = e.target.result;
        magnifyIcon.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="#cde5da" stroke-width="2" fill="none"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#cde5da" stroke-width="2"/></svg>';
        previewContainer.appendChild(img);
        previewContainer.appendChild(magnifyIcon);
        previewCell.appendChild(previewContainer);
        tr.appendChild(previewCell);

        // Filename cell
        const filenameCell = document.createElement('td');
        filenameCell.setAttribute('data-label', 'Filename');
        filenameCell.className = 'break-words whitespace-normal max-w-[180px] sm:max-w-xs filename-cell';
        const displayName = sanitizeFilename(_selectedFiles[i].filename || file.name);
        filenameCell.textContent = displayName;
        tr.appendChild(filenameCell);

        // Rename cell
        const renameCell = document.createElement('td');
        renameCell.setAttribute('data-label', 'Rename');
        const renameBtn = document.createElement('button');
        renameBtn.className = 'rename-btn';
        renameBtn.dataset.index = i + 1;
        renameBtn.textContent = 'Rename';
        renameCell.appendChild(renameBtn);
        tr.appendChild(renameCell);

        // Size cell
        const sizeCell = document.createElement('td');
        sizeCell.setAttribute('data-label', 'Size');
        sizeCell.className = 'size-cell';
        sizeCell.textContent = '-';
        tr.appendChild(sizeCell);

        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.setAttribute('data-label', 'Actions');
        const convertBtn = document.createElement('button');
        convertBtn.className = 'convert-single-btn';
        convertBtn.dataset.index = i + 1;
        convertBtn.textContent = 'Convert';
        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'download-btn ml-2';
        downloadBtn.dataset.index = i + 1;
        downloadBtn.style.display = 'none';
        downloadBtn.textContent = 'Download';
        actionsCell.appendChild(convertBtn);
        actionsCell.appendChild(downloadBtn);
        tr.appendChild(actionsCell);

        previewTbody.appendChild(tr);

        // Add magnify icon click handler
        magnifyIcon.addEventListener('click', function() {
          openImageModal(e.target.result, sanitizeFilename(file.name), i);
        });

        // Add individual convert button handler
        convertBtn.addEventListener('click', async function(ev) {
          ev.stopPropagation();
          
          // Check conversion quota with authentication guards
          const quotaCheck = await checkConversionQuota(1);
          if (!quotaCheck.allowed) {
            showUpgradePrompt(quotaCheck);
            return;
          }
          
          const fileIndex = parseInt(this.dataset.index, 10) - 1;
          const fileToConvert = _selectedFiles[fileIndex];
          
          if (!fileToConvert) {
            showNotification('File not found', 'error');
            return;
          }
          
          // Check file size against plan limits
          if (fileToConvert.size > quotaCheck.maxFileSize) {
            const maxSizeMB = Math.round(quotaCheck.maxFileSize / (1024 * 1024));
            showNotification(`File too large. Maximum size for your plan is ${maxSizeMB}MB.`, 'error');
            return;
          }
          
          // Get conversion parameters
          const maxW = parseInt(maxWidthInput.value, 10) || 99999;
          const maxH = parseInt(maxHeightInput.value, 10) || 99999;
          const sizeVal = parseFloat(targetSizeInput.value) || 500;
          const targetBytes = (sizeUnitSelect.value === 'MB' ? sizeVal * 1024 * 1024 : sizeVal * 1024);
          const format = outputFormatInput.value;
          
          try {
            this.textContent = 'Converting...';
            this.disabled = true;
            
            // Process single image
            await processImages([fileToConvert], maxW, maxH, targetBytes, format);
            
            // Record successful conversion
            await recordConversion();
            
            this.textContent = 'Convert';
            this.disabled = false;
            
          } catch (error) {
            console.error('Individual conversion failed:', error);
            showNotification('Conversion failed: ' + error.message, 'error');
            this.textContent = 'Convert';
            this.disabled = false;
          }
        });

        // Make row clickable to toggle checkbox
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', function(ev) {
          if (ev.target.tagName === 'BUTTON' ||
              ev.target.tagName === 'A' ||
              ev.target.tagName === 'INPUT' ||
              ev.target.closest('.magnify-icon') ||
              ev.target.tagName === 'SVG' ||
              ev.target.tagName === 'CIRCLE' ||
              ev.target.tagName === 'LINE') {
            return;
          }
          const cb = this.querySelector('.select-image');
          if (cb) {
            cb.checked = !cb.checked;
            const event = new Event('change', { bubbles: true });
            cb.dispatchEvent(event);
          }
        });

        // Add rename button handler
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
            const newName = sanitizeFilename(input.value.trim());
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

        // Add convert single button handler
        convertBtn.addEventListener('click', function() {
          const index = parseInt(this.getAttribute('data-index'), 10) - 1;
          if (index >= 0 && index < _selectedFiles.length) {
            processSingleImage(index);
          }
        });
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
  
  // Check conversion quota before processing
  const quotaCheck = await checkConversionQuota(1);
  if (!quotaCheck.allowed) {
    showUpgradePrompt(quotaCheck);
    return;
  }
  
  // Check file size against plan limits
  if (file.size > quotaCheck.maxFileSize) {
    const maxSizeMB = Math.round(quotaCheck.maxFileSize / (1024 * 1024));
    showNotification(`File too large. Maximum size for your plan is ${maxSizeMB}MB.`, 'error');
    return;
  }
  
  const format = outputFormatInput.value;
  const maxW = parseInt(maxWidthInput.value, 10) || 99999;
  const maxH = parseInt(maxHeightInput.value, 10) || 99999;
  const sizeVal = parseFloat(targetSizeInput.value) || 500;
  const targetBytes = (sizeUnitSelect.value === 'MB' ? sizeVal * 1024 * 1024 : sizeVal * 1024);
  
  // Get row for this file
  const tr = document.querySelector(`#preview-tbody tr[data-row-index="${index + 1}"]`);
  if (!tr) return;
  
  // Update UI to show processing
  const convertBtn = tr.querySelector('.convert-single-btn');
  const sizeCell = tr.querySelector('.size-cell');
  if (convertBtn) convertBtn.textContent = 'Processing...';
  if (sizeCell) sizeCell.textContent = 'Processing...';
  
  try {
    const { blob, filename } = await hybridConvert(file, maxW, maxH, targetBytes, format);
    
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
    
    // Record successful conversion
    await recordConversion();
    
  } catch (err) {
    const safeName = sanitizeFilename(file.name);
    console.error(`Error converting image ${safeName}:`, err);
    showError(index + 1, safeName, err);
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
      caption: sanitizeFilename(_selectedFiles[idx]?.filename || _selectedFiles[idx]?.name || `Image ${idx + 1}`)
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
      const filename = sanitizeFilename(_selectedFiles[i]?.filename || _selectedFiles[i]?.name || `Image ${i + 1}`);
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
    const base = sanitizeFilename(bulkRenameBase.value.trim() || 'Image');
    const start = parseInt(bulkRenameStart.value, 10) || 1;
    
    // Get all checkboxes that are checked
    const checkedRows = document.querySelectorAll('.select-image:checked');
    
    checkedRows.forEach((checkbox, i) => {
      const index = parseInt(checkbox.getAttribute('data-index'), 10) - 1;
      if (index >= 0 && index < _selectedFiles.length) {
        // Create new filename
        const newName = sanitizeFilename(`${base}_${start + i}`);
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
        // Check usage limit before processing
        if (!window.canConvert()) {
          window.showUpgradeModal();
          return;
        }
        
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
        
        // Track tool usage
        if (window.toolIntegration) {
          window.toolIntegration.trackToolUsage('conversion_started', {
            file_count: filesToProcess.length,
            output_format: outputFormatInput.value
          });
        }
        
        // Get conversion parameters
        const maxW = parseInt(maxWidthInput.value, 10) || 99999;
        const maxH = parseInt(maxHeightInput.value, 10) || 99999;
        const sizeVal = parseFloat(targetSizeInput.value) || 500;
        const targetBytes = (sizeUnitSelect.value === 'MB' ? sizeVal * 1024 * 1024 : sizeVal * 1024);
        const format = outputFormatInput.value;

        try {
          // Process images
          await processImages(filesToProcess, maxW, maxH, targetBytes, format);
          
          // Record successful conversion
          window.recordConversion();
          
        } catch (error) {
          console.error('Conversion failed:', error);
          showNotification('Conversion failed: ' + error.message, 'error');
        }
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
  targetSizeInput = document.getElementById('target-size');
  sizeUnitSelect = document.getElementById('size-unit');
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
  
  // Initialize authentication first
  await initializeAuth();
  
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
  // setupAuth(); // Removed - using new auth system
  
  // Initialize tool integration
  if (window.initializeToolIntegration) {
    window.initializeToolIntegration({
      name: 'image-converter',
      type: 'conversion',
      requiresAuth: false, // Allow guest usage but encourage sign up
      quotaType: 'conversions',
      trackUsage: true
    });
  }
  
  // Initialize usage tracking display
  if (window.imageAuth) {
    window.imageAuth.updateUI();
  }
  
  console.log('Image conversion app initialized');
});

export { handleFiles, sanitizeFilename };
export function setPreviewTbody(elem) { previewTbody = elem; }
//
 Initialize main convert button with authentication guards
document.addEventListener('DOMContentLoaded', function() {
  // Initialize DOM elements
  convertImagesBtn = document.getElementById('convert-images-btn');
  
  if (convertImagesBtn) {
    convertImagesBtn.addEventListener('click', async function() {
      const selectedCheckboxes = document.querySelectorAll('.select-image:checked');
      const selectedCount = selectedCheckboxes.length;
      
      if (selectedCount === 0) {
        showNotification('Please select at least one image to convert.', 'error');
        return;
      }
      
      // Check conversion quota with authentication guards
      const quotaCheck = await checkConversionQuota(selectedCount);
      if (!quotaCheck.allowed) {
        showUpgradePrompt(quotaCheck);
        return;
      }
      
      // Check if we can process all selected images
      if (quotaCheck.remaining < selectedCount) {
        const message = `You can only convert ${quotaCheck.remaining} more images this month. ${selectedCount} images selected.`;
        showNotification(message, 'warning');
        
        // Ask user if they want to convert only the allowed amount
        const proceed = confirm(`Convert only ${quotaCheck.remaining} images?`);
        if (!proceed) return;
      }
      
      // Disable button during processing
      const originalText = this.textContent;
      this.textContent = 'Converting...';
      this.disabled = true;
      
      try {
        // Get selected files
        const selectedFiles = [];
        selectedCheckboxes.forEach((checkbox, index) => {
          const fileIndex = parseInt(checkbox.dataset.index, 10) - 1;
          if (fileIndex >= 0 && fileIndex < _selectedFiles.length) {
            const file = _selectedFiles[fileIndex];
            
            // Check file size against plan limits
            if (file.size <= quotaCheck.maxFileSize) {
              selectedFiles.push({ file, index: fileIndex });
            } else {
              const maxSizeMB = Math.round(quotaCheck.maxFileSize / (1024 * 1024));
              showNotification(`Skipping ${file.name} - exceeds ${maxSizeMB}MB limit for your plan.`, 'warning');
            }
          }
        });
        
        if (selectedFiles.length === 0) {
          showNotification('No files can be processed within your plan limits.', 'error');
          return;
        }
        
        // Limit to quota remaining
        const filesToProcess = selectedFiles.slice(0, quotaCheck.remaining);
        
        // Process files sequentially to avoid overwhelming the system
        let processed = 0;
        let failed = 0;
        
        for (const { file, index } of filesToProcess) {
          try {
            await processSingleImage(index);
            processed++;
            
            // Update button text with progress
            this.textContent = `Converting... (${processed}/${filesToProcess.length})`;
            
          } catch (error) {
            console.error(`Failed to process ${file.name}:`, error);
            failed++;
          }
        }
        
        // Show completion message
        if (processed > 0) {
          showNotification(`Successfully converted ${processed} images${failed > 0 ? ` (${failed} failed)` : ''}.`, 'success');
        } else {
          showNotification('No images were converted successfully.', 'error');
        }
        
      } catch (error) {
        console.error('Batch conversion error:', error);
        showNotification('An error occurred during batch conversion.', 'error');
      } finally {
        // Re-enable button
        this.textContent = originalText;
        this.disabled = false;
      }
    });
  }
  
  // Initialize authentication and quota system
  initializeAuth();
});