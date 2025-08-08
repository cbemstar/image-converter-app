/**
 * Unified Navigation System
 * Enhances existing navigation with authentication and consistent behavior
 * Does NOT create duplicate navigation - only enhances existing ones
 */

class UnifiedNavigation {
  constructor() {
    // Prevent multiple instances
    if (window.unifiedNavigationInstance) {
      console.warn('UnifiedNavigation already initialized, returning existing instance');
      return window.unifiedNavigationInstance;
    }

    this.authManager = null;
    this.isInitialized = false;
    this.navigationEnhanced = false;
    this.duplicatePreventionActive = true;
    
    // Store instance globally to prevent duplicates
    window.unifiedNavigationInstance = this;
    
    this.init();
  }

  async init() {
    // Add safeguards to prevent multiple navigation script initializations
    if (!this.addNavigationInitializationSafeguards()) {
      console.log('Navigation initialization prevented due to existing initialization');
      return;
    }

    await this.waitForAuthManager();
    
    // Debug path resolution if in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      this.debugPathResolution();
    }
    
    // Detect and prevent duplicate navigation elements before enhancement
    this.detectAndPreventDuplicateElements();
    
    this.enhanceExistingNavigation();
    this.setupEventListeners();
    this.updateAuthUI();
    this.fixButtonHoverStates();
    
    // Enhanced auth state synchronization
    this.setupAuthStateSynchronization();
    
    this.isInitialized = true;
    console.log('Unified navigation initialized with duplication prevention and enhanced auth state synchronization');
  }

  async waitForAuthManager() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.authManager) {
          this.authManager = window.authManager;
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * Enhance existing navigation instead of creating new one
   */
  enhanceExistingNavigation() {
    // Prevent duplicate navigation enhancement
    if (this.navigationEnhanced) {
      console.log('Navigation already enhanced, skipping duplicate enhancement');
      return;
    }

    // Audit for existing navigation bars and prevent duplication
    if (!this.auditAndPreventNavigationDuplication()) {
      console.error('Navigation duplication detected or navigation structure invalid');
      return;
    }

    // Update existing navigation paths to use correct relative paths
    this.updateExistingNavigationPaths();
    
    // Check if navigation already has auth elements
    const existingAuthElements = document.querySelector('[data-auth-required], [data-guest-only]');
    
    if (existingAuthElements) {
      // Navigation already has auth elements, just enhance them
      console.log('Found existing auth elements, enhancing...');
      this.enhanceAuthElements();
      this.setupDropdownFunctionality();
    } else {
      // Only add auth elements if they don't exist
      console.log('No auth elements found, adding...');
      this.addAuthElementsToExistingNav();
    }

    // Mark navigation as enhanced
    this.navigationEnhanced = true;
    console.log('Navigation enhancement completed');
  }

  /**
   * Audit all pages to identify and prevent multiple navigation bars
   * @returns {boolean} True if navigation structure is valid and no duplicates found
   */
  auditAndPreventNavigationDuplication() {
    try {
      // Find all navigation elements
      const navElements = document.querySelectorAll('nav, [role="navigation"]');
      const navCount = navElements.length;

      console.log(`Found ${navCount} navigation element(s)`);

      if (navCount === 0) {
        console.error('No navigation elements found on page');
        return false;
      }

      if (navCount === 1) {
        // Single navigation - this is correct
        const nav = navElements[0];
        this.markNavigationAsManaged(nav);
        console.log('Single navigation element found - structure is valid');
        return true;
      }

      // Multiple navigation elements detected - need to consolidate
      console.warn(`Multiple navigation elements detected (${navCount}), attempting consolidation`);
      return this.consolidateNavigationElements(navElements);

    } catch (error) {
      console.error('Error during navigation duplication audit:', error);
      return false;
    }
  }

  /**
   * Consolidate multiple navigation elements into a single navigation bar
   * @param {NodeList} navElements - All navigation elements found
   * @returns {boolean} True if consolidation was successful
   */
  consolidateNavigationElements(navElements) {
    try {
      // Find the primary navigation (first one with proper structure)
      let primaryNav = null;
      let duplicateNavs = [];

      for (let nav of navElements) {
        if (this.isValidNavigationStructure(nav)) {
          if (!primaryNav) {
            primaryNav = nav;
            console.log('Identified primary navigation element');
          } else {
            duplicateNavs.push(nav);
          }
        } else {
          duplicateNavs.push(nav);
        }
      }

      if (!primaryNav) {
        console.error('No valid primary navigation found');
        return false;
      }

      // Remove duplicate navigation elements
      duplicateNavs.forEach((nav, index) => {
        console.log(`Removing duplicate navigation element ${index + 1}`);
        
        // Preserve any unique content before removing
        this.preserveUniqueNavigationContent(nav, primaryNav);
        
        // Remove the duplicate
        nav.remove();
      });

      // Mark the primary navigation as managed
      this.markNavigationAsManaged(primaryNav);
      
      console.log(`Navigation consolidation completed. Removed ${duplicateNavs.length} duplicate(s)`);
      return true;

    } catch (error) {
      console.error('Error consolidating navigation elements:', error);
      return false;
    }
  }

  /**
   * Check if a navigation element has valid structure
   * @param {Element} nav - Navigation element to validate
   * @returns {boolean} True if navigation structure is valid
   */
  isValidNavigationStructure(nav) {
    try {
      // Check for essential navigation components
      const hasToggle = nav.querySelector('#sidebar-toggle, [aria-label*="sidebar"], [aria-controls="sidebar"]');
      const hasLogo = nav.querySelector('a[href*="index.html"], .text-xl, .font-bold');
      const hasRightSection = nav.querySelector('.flex.items-center.gap-2');

      // A valid navigation should have at least a logo/brand and some structure
      return !!(hasLogo && hasRightSection);
    } catch (error) {
      console.warn('Error validating navigation structure:', error);
      return false;
    }
  }

  /**
   * Preserve unique content from duplicate navigation before removal
   * @param {Element} duplicateNav - Navigation element being removed
   * @param {Element} primaryNav - Primary navigation to merge content into
   */
  preserveUniqueNavigationContent(duplicateNav, primaryNav) {
    try {
      // Look for unique elements that might need to be preserved
      const uniqueElements = duplicateNav.querySelectorAll('[data-unique], .unique-nav-element');
      
      if (uniqueElements.length > 0) {
        console.log(`Preserving ${uniqueElements.length} unique elements from duplicate navigation`);
        
        // Find appropriate location in primary nav to add unique elements
        const rightSection = primaryNav.querySelector('.flex.items-center.gap-2:last-child');
        
        if (rightSection) {
          uniqueElements.forEach(element => {
            // Clone and append to primary navigation
            const clonedElement = element.cloneNode(true);
            rightSection.appendChild(clonedElement);
          });
        }
      }
    } catch (error) {
      console.warn('Error preserving unique navigation content:', error);
    }
  }

  /**
   * Mark navigation element as managed by UnifiedNavigation
   * @param {Element} nav - Navigation element to mark
   */
  markNavigationAsManaged(nav) {
    nav.setAttribute('data-unified-nav-managed', 'true');
    nav.setAttribute('data-unified-nav-version', '1.0');
    nav.setAttribute('data-unified-nav-timestamp', Date.now().toString());
  }

  /**
   * Add safeguards to prevent multiple navigation script initializations
   */
  addNavigationInitializationSafeguards() {
    try {
      // Check if navigation scripts have already been initialized
      if (document.body.hasAttribute('data-unified-nav-initialized')) {
        console.warn('Navigation scripts already initialized, preventing duplicate initialization');
        return false;
      }

      // Mark body as having navigation initialized
      document.body.setAttribute('data-unified-nav-initialized', 'true');
      document.body.setAttribute('data-unified-nav-init-time', Date.now().toString());

      // Add event listener to prevent future duplicate initializations
      document.addEventListener('unified-nav-init-attempt', (event) => {
        console.warn('Duplicate navigation initialization attempt prevented');
        event.preventDefault();
        event.stopPropagation();
      });

      return true;
    } catch (error) {
      console.error('Error adding navigation initialization safeguards:', error);
      return false;
    }
  }

  /**
   * Detect and prevent duplicate navigation elements during enhancement
   */
  detectAndPreventDuplicateElements() {
    try {
      // Check for duplicate auth elements
      const authRequiredElements = document.querySelectorAll('[data-auth-required]');
      const guestOnlyElements = document.querySelectorAll('[data-guest-only]');

      if (authRequiredElements.length > 1) {
        console.warn(`Found ${authRequiredElements.length} auth-required elements, removing duplicates`);
        this.removeDuplicateAuthElements(authRequiredElements, 'auth-required');
      }

      if (guestOnlyElements.length > 1) {
        console.warn(`Found ${guestOnlyElements.length} guest-only elements, removing duplicates`);
        this.removeDuplicateAuthElements(guestOnlyElements, 'guest-only');
      }

      // Check for duplicate dropdowns
      const dropdowns = document.querySelectorAll('.dropdown-toggle');
      if (dropdowns.length > 1) {
        console.warn(`Found ${dropdowns.length} dropdown toggles, removing duplicates`);
        this.removeDuplicateDropdowns(dropdowns);
      }

      return true;
    } catch (error) {
      console.error('Error detecting duplicate elements:', error);
      return false;
    }
  }

  /**
   * Remove duplicate auth elements, keeping only the first valid one
   * @param {NodeList} elements - Elements to deduplicate
   * @param {string} type - Type of elements for logging
   */
  removeDuplicateAuthElements(elements, type) {
    try {
      let keptElement = null;
      
      elements.forEach((element, index) => {
        if (index === 0 && this.isValidAuthElement(element)) {
          // Keep the first valid element
          keptElement = element;
          element.setAttribute('data-unified-nav-primary', 'true');
          console.log(`Kept primary ${type} element`);
        } else {
          // Remove duplicates
          console.log(`Removing duplicate ${type} element ${index}`);
          element.remove();
        }
      });

      if (!keptElement) {
        console.warn(`No valid ${type} element found to keep`);
      }
    } catch (error) {
      console.error(`Error removing duplicate ${type} elements:`, error);
    }
  }

  /**
   * Check if an auth element is valid and should be kept
   * @param {Element} element - Auth element to validate
   * @returns {boolean} True if element is valid
   */
  isValidAuthElement(element) {
    try {
      // Check if element has proper structure
      const hasContent = element.children.length > 0 || element.textContent.trim().length > 0;
      const hasValidParent = element.closest('nav') !== null;
      const isVisible = element.offsetParent !== null || getComputedStyle(element).display !== 'none';

      return hasContent && hasValidParent;
    } catch (error) {
      console.warn('Error validating auth element:', error);
      return false;
    }
  }

  /**
   * Remove duplicate dropdown elements
   * @param {NodeList} dropdowns - Dropdown elements to deduplicate
   */
  removeDuplicateDropdowns(dropdowns) {
    try {
      let keptDropdown = null;

      dropdowns.forEach((dropdown, index) => {
        if (index === 0 && this.isValidDropdown(dropdown)) {
          // Keep the first valid dropdown
          keptDropdown = dropdown;
          dropdown.setAttribute('data-unified-nav-primary-dropdown', 'true');
          console.log('Kept primary dropdown element');
        } else {
          // Remove duplicates
          console.log(`Removing duplicate dropdown ${index}`);
          const dropdownContainer = dropdown.closest('.dropdown');
          if (dropdownContainer) {
            dropdownContainer.remove();
          } else {
            dropdown.remove();
          }
        }
      });
    } catch (error) {
      console.error('Error removing duplicate dropdowns:', error);
    }
  }

  /**
   * Check if a dropdown element is valid
   * @param {Element} dropdown - Dropdown element to validate
   * @returns {boolean} True if dropdown is valid
   */
  isValidDropdown(dropdown) {
    try {
      const hasMenu = dropdown.nextElementSibling && dropdown.nextElementSibling.classList.contains('dropdown-content');
      const hasValidParent = dropdown.closest('nav') !== null;
      
      return hasMenu && hasValidParent;
    } catch (error) {
      console.warn('Error validating dropdown:', error);
      return false;
    }
  }

  /**
   * Enhance existing auth elements
   */
  enhanceAuthElements() {
    // Ensure proper avatar sources
    const avatars = document.querySelectorAll('[data-user-info="avatar"]');
    avatars.forEach(avatar => {
      if (!avatar.src || avatar.src.includes('placeholder')) {
        avatar.style.display = 'none';
      }
    });

    // Enhance sign-in buttons to store current tool page before redirect
    const signInBtns = document.querySelectorAll('[data-guest-only] a[href*="auth.html"]');
    signInBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.authManager && typeof this.authManager.storeToolPageForRedirect === 'function') {
          // Store current tool page for redirect after authentication
          this.authManager.storeToolPageForRedirect();
          console.log('Stored current tool page for post-auth redirect');
        }
      });
    });

    // Ensure sign out buttons work
    const signOutBtns = document.querySelectorAll('#signOutBtn, [data-action="signout"]');
    signOutBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.authManager) {
          await this.authManager.signOut();
        }
      });
    });
  }

  /**
   * Get resolved paths using PathResolver
   * @returns {Object} Object containing resolved paths
   */
  getResolvedPaths() {
    // Check if PathResolver is available
    if (typeof PathResolver !== 'undefined') {
      const currentPath = window.location.pathname;
      return {
        auth: PathResolver.resolveAuthPath(currentPath),
        dashboard: PathResolver.resolveDashboardPath(currentPath),
        profile: PathResolver.resolveProfilePath(currentPath),
        home: PathResolver.resolveHomePath(currentPath)
      };
    } else {
      // Fallback if PathResolver is not available
      console.warn('PathResolver not available, using fallback path calculation');
      return this.calculateFallbackPaths();
    }
  }

  /**
   * Get resolved paths with enhanced validation and fallback handling
   * @returns {Object} Object containing validated resolved paths
   */
  getResolvedPathsWithValidation() {
    const currentPath = window.location.pathname;
    
    // Try to use PathResolver first
    if (typeof PathResolver !== 'undefined') {
      try {
        const pathInfo = PathResolver.getAllPaths(currentPath);
        
        if (pathInfo.isValid) {
          console.log('PathResolver validation successful');
          return pathInfo.paths;
        } else {
          console.warn('PathResolver validation failed:', pathInfo.validation);
          // Use PathResolver paths anyway but log the validation issues
          return pathInfo.paths;
        }
      } catch (error) {
        console.error('Error using PathResolver:', error);
        return this.calculateFallbackPaths();
      }
    } else {
      console.warn('PathResolver not available, using fallback path calculation');
      return this.calculateFallbackPaths();
    }
  }

  /**
   * Get resolved paths with comprehensive enhanced validation
   * @returns {Object} Object containing validated resolved paths with enhanced checks
   */
  getResolvedPathsWithEnhancedValidation() {
    const currentPath = window.location.pathname;
    
    // Try to use PathResolver with comprehensive validation
    if (typeof PathResolver !== 'undefined') {
      try {
        const pathInfo = PathResolver.getAllPaths(currentPath);
        
        // Enhanced validation beyond PathResolver's basic checks
        const enhancedValidation = this.performEnhancedPathValidation(pathInfo.paths, currentPath);
        
        if (pathInfo.isValid && enhancedValidation.allValid) {
          console.log('Enhanced PathResolver validation successful');
          return pathInfo.paths;
        } else {
          console.warn('Enhanced PathResolver validation failed:', {
            pathResolverValidation: pathInfo.validation,
            enhancedValidation: enhancedValidation.details
          });
          
          // Attempt to correct invalid paths
          const correctedPaths = this.correctInvalidPaths(pathInfo.paths, enhancedValidation.details);
          return correctedPaths || pathInfo.paths;
        }
      } catch (error) {
        console.error('Error using enhanced PathResolver:', error);
        return this.calculateFallbackPaths();
      }
    } else {
      console.warn('PathResolver not available, using enhanced fallback path calculation');
      return this.calculateEnhancedFallbackPaths();
    }
  }

  /**
   * Perform enhanced path validation beyond basic PathResolver checks
   * @param {Object} paths - Object containing paths to validate
   * @param {string} currentPath - Current page path
   * @returns {Object} Enhanced validation results
   */
  performEnhancedPathValidation(paths, currentPath) {
    const validationDetails = {};
    let allValid = true;

    // Check each path type
    ['auth', 'dashboard', 'profile', 'home'].forEach(pathType => {
      const path = paths[pathType];
      const validation = {
        exists: !!path,
        isString: typeof path === 'string',
        hasHtmlExtension: path && path.endsWith('.html'),
        isRelative: path && !path.startsWith('/'),
        hasCorrectDepth: this.validatePathDepth(path, currentPath),
        isAccessible: this.validatePathAccessibility(path, currentPath)
      };

      validation.isValid = Object.values(validation).every(v => v === true);
      validationDetails[pathType] = validation;

      if (!validation.isValid) {
        allValid = false;
      }
    });

    return {
      allValid,
      details: validationDetails
    };
  }

  /**
   * Validate that a path has the correct depth for the current location
   * @param {string} path - Path to validate
   * @param {string} currentPath - Current page path
   * @returns {boolean} True if path depth is correct
   */
  validatePathDepth(path, currentPath) {
    if (!path || typeof path !== 'string') return false;

    try {
      // Count ../ in the path
      const upLevels = (path.match(/\.\.\//g) || []).length;
      
      // Calculate expected depth using PathResolver if available
      if (typeof PathResolver !== 'undefined') {
        const expectedDepth = PathResolver.getCurrentDepth(currentPath);
        return upLevels === expectedDepth;
      }

      // Fallback depth calculation
      const pathParts = currentPath.split('/').filter(part => part && part !== 'index.html');
      const expectedDepth = Math.max(0, pathParts.length - 1);
      return upLevels === expectedDepth;
    } catch (error) {
      console.warn('Error validating path depth:', error);
      return false;
    }
  }

  /**
   * Validate that a path is accessible from the current location
   * @param {string} path - Path to validate
   * @param {string} currentPath - Current page path
   * @returns {boolean} True if path should be accessible
   */
  validatePathAccessibility(path, currentPath) {
    if (!path || typeof path !== 'string') return false;

    try {
      // Basic accessibility checks
      if (path.includes('//')) {
        return false; // Double slashes are invalid
      }

      // Check for reasonable path length
      if (path.length > 200) {
        return false; // Suspiciously long path
      }

      // Validate file extension
      if (!path.endsWith('.html')) {
        return false;
      }

      // Skip complex relative path validation - basic checks above are sufficient

      return true;
    } catch (error) {
      console.warn('Error validating path accessibility:', error);
      return false;
    }
  }

  /**
   * Correct invalid paths based on validation details
   * @param {Object} paths - Original paths object
   * @param {Object} validationDetails - Validation details from enhanced validation
   * @returns {Object|null} Corrected paths or null if correction failed
   */
  correctInvalidPaths(paths, validationDetails) {
    const correctedPaths = { ...paths };
    let correctionsMade = false;

    Object.keys(validationDetails).forEach(pathType => {
      const validation = validationDetails[pathType];
      
      if (!validation.isValid) {
        console.log(`Attempting to correct invalid ${pathType} path:`, paths[pathType]);
        
        const correctedPath = this.correctNavigationPath(pathType, window.location.pathname);
        if (correctedPath && correctedPath !== paths[pathType]) {
          correctedPaths[pathType] = correctedPath;
          correctionsMade = true;
          console.log(`Corrected ${pathType} path to:`, correctedPath);
        }
      }
    });

    return correctionsMade ? correctedPaths : null;
  }

  /**
   * Calculate enhanced fallback paths with additional validation
   * @returns {Object} Object containing enhanced fallback paths
   */
  calculateEnhancedFallbackPaths() {
    const currentPath = window.location.pathname;
    const pathDepth = currentPath.split('/').length - 2;
    const basePath = pathDepth > 1 ? '../'.repeat(pathDepth - 1) : './';
    
    const fallbackPaths = {
      auth: `${basePath}auth.html`,
      dashboard: `${basePath}dashboard.html`,
      profile: `${basePath}profile.html`,
      home: `${basePath}index.html`
    };

    // Validate fallback paths
    const validation = this.performEnhancedPathValidation(fallbackPaths, currentPath);
    if (!validation.allValid) {
      console.warn('Even fallback paths failed enhanced validation:', validation.details);
      
      // Last resort: use minimal relative paths
      return {
        auth: './auth.html',
        dashboard: './dashboard.html',
        profile: './profile.html',
        home: './index.html'
      };
    }

    return fallbackPaths;
  }

  /**
   * Correct all navigation paths using PathResolver
   * @returns {Object|null} Corrected paths or null if correction failed
   */
  correctAllNavigationPaths() {
    const currentPath = window.location.pathname;
    
    try {
      if (typeof PathResolver !== 'undefined') {
        return {
          auth: PathResolver.resolveAuthPath(currentPath),
          dashboard: PathResolver.resolveDashboardPath(currentPath),
          profile: PathResolver.resolveProfilePath(currentPath),
          home: PathResolver.resolveHomePath(currentPath)
        };
      } else {
        // Fallback correction without PathResolver
        return this.calculateEnhancedFallbackPaths();
      }
    } catch (error) {
      console.error('Error correcting all navigation paths:', error);
      return null;
    }
  }

  /**
   * Log detailed path validation information for debugging
   * @param {Object} resolvedPaths - Resolved paths to log details for
   */
  logPathValidationDetails(resolvedPaths) {
    const currentPath = window.location.pathname;
    
    console.group('Enhanced Path Validation Details');
    console.log('Current Path:', currentPath);
    console.log('Resolved Paths:', resolvedPaths);
    
    if (typeof PathResolver !== 'undefined') {
      console.log('PathResolver Depth:', PathResolver.getCurrentDepth(currentPath));
      console.log('Is Tool Page:', PathResolver.isToolPage(currentPath));
      console.log('Tool Name:', PathResolver.getToolName(currentPath));
    }

    // Validate each path individually
    Object.keys(resolvedPaths).forEach(pathType => {
      const path = resolvedPaths[pathType];
      const isValid = this.isValidNavigationPath(path, currentPath);
      const depthValid = this.validatePathDepth(path, currentPath);
      const accessibilityValid = this.validatePathAccessibility(path, currentPath);
      
      console.log(`${pathType.toUpperCase()} Path Analysis:`, {
        path,
        isValid,
        depthValid,
        accessibilityValid,
        upLevels: (path.match(/\.\.\//g) || []).length
      });
    });
    
    console.groupEnd();
  }

  /**
   * Validate that added navigation links are working correctly
   */
  validateAddedNavigationLinks() {
    const currentPath = window.location.pathname;
    const addedLinks = document.querySelectorAll('[data-nav-link]');
    
    if (addedLinks.length === 0) {
      console.warn('No navigation links found to validate');
      return;
    }

    console.group('Added Navigation Links Validation');
    
    addedLinks.forEach(link => {
      const linkType = link.getAttribute('data-nav-link');
      const href = link.getAttribute('href');
      const isValid = this.isValidNavigationPath(href, currentPath);
      
      console.log(`${linkType} link:`, {
        href,
        isValid,
        element: link
      });

      if (!isValid) {
        console.warn(`Invalid ${linkType} link detected:`, href);
        
        // Attempt to fix the link
        const correctedPath = this.correctNavigationPath(linkType, currentPath);
        if (correctedPath) {
          link.setAttribute('href', correctedPath);
          console.log(`Corrected ${linkType} link to:`, correctedPath);
        }
      }
    });
    
    console.groupEnd();
  }

  /**
   * Setup enhanced authentication state synchronization across tool pages
   * Ensures all tool pages properly listen for auth state changes and update UI immediately
   */
  setupAuthStateSynchronization() {
    if (!this.authManager) {
      console.warn('AuthManager not available for auth state synchronization');
      return;
    }

    // Enhanced auth state listener with error handling and immediate UI updates
    const authStateListener = (event, session, user) => {
      try {
        console.log('Auth state change detected in UnifiedNavigation:', event, user?.email || 'No user');
        
        // Immediate UI update with enhanced error handling
        this.updateAuthUIWithErrorHandling(event, session, user);
        
        // Trigger custom event for other components to listen to
        this.dispatchAuthStateEvent(event, session, user);
        
        // Handle specific auth events
        this.handleSpecificAuthEvents(event, session, user);
        
        // Notify AuthStateSynchronizer if available
        this.notifyAuthStateSynchronizer(event, session, user);
        
      } catch (error) {
        console.error('Error in auth state listener:', error);
        this.handleAuthStateUpdateError(error, event, session);
      }
    };

    // Add the enhanced listener
    this.authManager.addAuthStateListener(authStateListener);
    
    // Store reference for cleanup if needed
    this.authStateListener = authStateListener;
    
    // Setup periodic auth state validation
    this.setupPeriodicAuthStateValidation();
    
    // Setup cross-tab auth state synchronization
    this.setupCrossTabAuthSync();
    
    // Setup integration with AuthStateSynchronizer
    this.setupAuthStateSynchronizerIntegration();
    
    console.log('Enhanced auth state synchronization setup complete');
  }

  /**
   * Notify AuthStateSynchronizer of auth state changes
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  notifyAuthStateSynchronizer(event, session, user) {
    try {
      if (window.authStateSynchronizer && typeof window.authStateSynchronizer.handleGlobalAuthStateChange === 'function') {
        // Let AuthStateSynchronizer handle the comprehensive sync
        window.authStateSynchronizer.handleGlobalAuthStateChange(event, session, user);
      }
    } catch (error) {
      console.warn('Error notifying AuthStateSynchronizer:', error);
    }
  }

  /**
   * Setup integration with AuthStateSynchronizer
   */
  setupAuthStateSynchronizerIntegration() {
    try {
      // Listen for auth sync completion events
      document.addEventListener('authSyncCompleted', (event) => {
        this.handleAuthSyncCompletion(event);
      });

      // Listen for auth sync errors
      document.addEventListener('authSyncError', (event) => {
        this.handleAuthSyncError(event);
      });

      // Add error handler to AuthStateSynchronizer if available
      if (window.authStateSynchronizer && typeof window.authStateSynchronizer.addErrorHandler === 'function') {
        window.authStateSynchronizer.addErrorHandler((error, authEvent, session, user) => {
          this.handleAuthStateSynchronizerError(error, authEvent, session, user);
        });
      }

      console.log('AuthStateSynchronizer integration setup complete');
    } catch (error) {
      console.warn('Error setting up AuthStateSynchronizer integration:', error);
    }
  }

  /**
   * Handle auth sync completion
   * @param {CustomEvent} event - Auth sync completion event
   */
  handleAuthSyncCompletion(event) {
    try {
      const { originalEvent, isAuthenticated, user, syncId } = event.detail;
      console.log(`Auth sync completed for event ${originalEvent} (ID: ${syncId})`);
      
      // Perform any additional navigation-specific updates
      this.performNavigationSpecificUpdates(isAuthenticated, user);
      
    } catch (error) {
      console.warn('Error handling auth sync completion:', error);
    }
  }

  /**
   * Handle auth sync errors
   * @param {CustomEvent} event - Auth sync error event
   */
  handleAuthSyncError(event) {
    try {
      const { error, event: authEvent, retryAttempts } = event.detail;
      console.warn(`Auth sync error for event ${authEvent} after ${retryAttempts} retries:`, error);
      
      // Show user-friendly message if sync keeps failing
      if (retryAttempts >= 3) {
        this.showAuthSyncErrorMessage();
      }
      
    } catch (error) {
      console.error('Error handling auth sync error:', error);
    }
  }

  /**
   * Handle AuthStateSynchronizer errors
   * @param {Error} error - The error that occurred
   * @param {string} authEvent - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleAuthStateSynchronizerError(error, authEvent, session, user) {
    try {
      console.warn('AuthStateSynchronizer error in UnifiedNavigation:', error);
      
      // Attempt fallback navigation update
      this.performFallbackNavigationUpdate(!!session, user);
      
    } catch (handlingError) {
      console.error('Error handling AuthStateSynchronizer error:', handlingError);
    }
  }

  /**
   * Perform navigation-specific updates after sync completion
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  performNavigationSpecificUpdates(isAuthenticated, user) {
    try {
      // Update navigation-specific elements that might not be covered by general sync
      this.updateNavigationBranding(isAuthenticated, user);
      this.updateNavigationAccessibility(isAuthenticated);
      this.updateNavigationAnalytics(isAuthenticated, user);
      
    } catch (error) {
      console.warn('Error performing navigation-specific updates:', error);
    }
  }

  /**
   * Update navigation branding based on auth state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  updateNavigationBranding(isAuthenticated, user) {
    try {
      // Update any personalized branding elements
      const brandingElements = document.querySelectorAll('[data-nav-branding]');
      brandingElements.forEach(el => {
        if (isAuthenticated && user) {
          el.classList.add('authenticated');
        } else {
          el.classList.remove('authenticated');
        }
      });
    } catch (error) {
      console.warn('Error updating navigation branding:', error);
    }
  }

  /**
   * Update navigation accessibility based on auth state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   */
  updateNavigationAccessibility(isAuthenticated) {
    try {
      // Update ARIA labels and roles based on auth state
      const navElement = document.querySelector('nav[role="navigation"]');
      if (navElement) {
        const authStatus = isAuthenticated ? 'authenticated' : 'guest';
        navElement.setAttribute('data-auth-status', authStatus);
      }
    } catch (error) {
      console.warn('Error updating navigation accessibility:', error);
    }
  }

  /**
   * Update navigation analytics based on auth state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  updateNavigationAnalytics(isAuthenticated, user) {
    try {
      // Update analytics tracking for navigation interactions
      if (window.gtag) {
        window.gtag('config', 'GA_MEASUREMENT_ID', {
          user_id: isAuthenticated ? user?.id : null,
          custom_map: {
            auth_status: isAuthenticated ? 'authenticated' : 'guest'
          }
        });
      }
    } catch (error) {
      console.warn('Error updating navigation analytics:', error);
    }
  }

  /**
   * Perform fallback navigation update when sync fails
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  performFallbackNavigationUpdate(isAuthenticated, user) {
    try {
      console.log('Performing fallback navigation update');
      
      // Basic navigation element updates
      const authNavElements = document.querySelectorAll('nav [data-auth-required]');
      const guestNavElements = document.querySelectorAll('nav [data-guest-only]');
      
      authNavElements.forEach(el => {
        el.style.display = isAuthenticated ? 'block' : 'none';
      });
      
      guestNavElements.forEach(el => {
        el.style.display = isAuthenticated ? 'none' : 'block';
      });
      
      console.log('Fallback navigation update completed');
    } catch (error) {
      console.error('Error performing fallback navigation update:', error);
    }
  }

  /**
   * Show user-friendly error message for persistent sync errors
   */
  showAuthSyncErrorMessage() {
    try {
      if (this.authManager && typeof this.authManager.showAuthMessage === 'function') {
        this.authManager.showAuthMessage(
          'There may be a temporary issue with the interface. Please refresh the page if you notice any problems.',
          'info'
        );
      }
    } catch (error) {
      console.warn('Error showing auth sync error message:', error);
    }
  }

  /**
   * Update auth UI with enhanced error handling
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  updateAuthUIWithErrorHandling(event, session, user) {
    try {
      // Call the standard updateAuthUI method
      this.updateAuthUI();
      
      // Additional UI updates specific to auth state changes
      this.updateUserSpecificElements(user);
      this.updateAuthDependentFeatures(!!session);
      
      // Validate that UI updates were successful
      this.validateAuthUIUpdate(!!session);
      
    } catch (error) {
      console.error('Error updating auth UI:', error);
      
      // Attempt fallback UI update
      this.fallbackAuthUIUpdate(!!session);
    }
  }

  /**
   * Update user-specific elements in the UI
   * @param {Object} user - User object
   */
  updateUserSpecificElements(user) {
    try {
      if (user) {
        // Update user name displays
        const nameElements = document.querySelectorAll('[data-user-info="name"]');
        nameElements.forEach(el => {
          const displayName = user.user_metadata?.full_name || 
                             user.email?.split('@')[0] || 
                             'User';
          el.textContent = displayName;
        });

        // Update user email displays
        const emailElements = document.querySelectorAll('[data-user-info="email"]');
        emailElements.forEach(el => {
          el.textContent = user.email || '';
        });

        // Update user avatar displays
        const avatarElements = document.querySelectorAll('[data-user-info="avatar"]');
        avatarElements.forEach(el => {
          if (el.tagName === 'IMG') {
            const avatarUrl = user.user_metadata?.avatar_url || 
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=0066cc&color=fff`;
            el.src = avatarUrl;
            el.style.display = 'block';
          }
        });
      }
    } catch (error) {
      console.warn('Error updating user-specific elements:', error);
    }
  }

  /**
   * Update features that depend on authentication state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   */
  updateAuthDependentFeatures(isAuthenticated) {
    try {
      // Update dashboard access indicators
      const dashboardLinks = document.querySelectorAll('[data-dashboard-access]');
      dashboardLinks.forEach(link => {
        if (isAuthenticated) {
          link.classList.remove('disabled');
          link.removeAttribute('disabled');
        } else {
          link.classList.add('disabled');
          link.setAttribute('disabled', 'true');
        }
      });

      // Update any premium feature indicators
      const premiumFeatures = document.querySelectorAll('[data-premium-feature]');
      premiumFeatures.forEach(feature => {
        if (isAuthenticated) {
          feature.classList.remove('premium-locked');
        } else {
          feature.classList.add('premium-locked');
        }
      });

    } catch (error) {
      console.warn('Error updating auth-dependent features:', error);
    }
  }

  /**
   * Validate that auth UI update was successful
   * @param {boolean} isAuthenticated - Whether user should be authenticated
   */
  validateAuthUIUpdate(isAuthenticated) {
    try {
      const authRequiredElements = document.querySelectorAll('[data-auth-required]');
      const guestOnlyElements = document.querySelectorAll('[data-guest-only]');

      let validationPassed = true;

      if (isAuthenticated) {
        // Check that auth-required elements are visible
        authRequiredElements.forEach(el => {
          if (el.style.display === 'none' || el.classList.contains('hidden')) {
            console.warn('Auth-required element not visible when authenticated:', el);
            validationPassed = false;
          }
        });

        // Check that guest-only elements are hidden
        guestOnlyElements.forEach(el => {
          if (el.style.display !== 'none' && !el.classList.contains('hidden')) {
            console.warn('Guest-only element visible when authenticated:', el);
            validationPassed = false;
          }
        });
      } else {
        // Check that auth-required elements are hidden
        authRequiredElements.forEach(el => {
          if (el.style.display !== 'none' && !el.classList.contains('hidden')) {
            console.warn('Auth-required element visible when not authenticated:', el);
            validationPassed = false;
          }
        });

        // Check that guest-only elements are visible
        guestOnlyElements.forEach(el => {
          if (el.style.display === 'none' || el.classList.contains('hidden')) {
            console.warn('Guest-only element not visible when not authenticated:', el);
            validationPassed = false;
          }
        });
      }

      if (!validationPassed) {
        console.warn('Auth UI validation failed, attempting correction...');
        this.correctAuthUIState(isAuthenticated);
      }

    } catch (error) {
      console.error('Error validating auth UI update:', error);
    }
  }

  /**
   * Correct auth UI state if validation failed
   * @param {boolean} isAuthenticated - Whether user should be authenticated
   */
  correctAuthUIState(isAuthenticated) {
    try {
      const authRequiredElements = document.querySelectorAll('[data-auth-required]');
      const guestOnlyElements = document.querySelectorAll('[data-guest-only]');

      if (isAuthenticated) {
        // Show auth-required elements
        authRequiredElements.forEach(el => {
          el.style.display = el.dataset.authDisplay || 'block';
          el.classList.remove('hidden');
        });

        // Hide guest-only elements
        guestOnlyElements.forEach(el => {
          el.style.display = 'none';
          el.classList.add('hidden');
        });
      } else {
        // Hide auth-required elements
        authRequiredElements.forEach(el => {
          el.style.display = 'none';
          el.classList.add('hidden');
        });

        // Show guest-only elements
        guestOnlyElements.forEach(el => {
          el.style.display = el.dataset.guestDisplay || 'block';
          el.classList.remove('hidden');
        });
      }

      console.log('Auth UI state corrected');
    } catch (error) {
      console.error('Error correcting auth UI state:', error);
    }
  }

  /**
   * Fallback auth UI update when main update fails
   * @param {boolean} isAuthenticated - Whether user is authenticated
   */
  fallbackAuthUIUpdate(isAuthenticated) {
    try {
      console.log('Attempting fallback auth UI update');
      
      // Simple show/hide based on auth state
      const authElements = document.querySelectorAll('[data-auth-required]');
      const guestElements = document.querySelectorAll('[data-guest-only]');

      authElements.forEach(el => {
        el.style.display = isAuthenticated ? 'block' : 'none';
      });

      guestElements.forEach(el => {
        el.style.display = isAuthenticated ? 'none' : 'block';
      });

      console.log('Fallback auth UI update completed');
    } catch (error) {
      console.error('Fallback auth UI update also failed:', error);
    }
  }

  /**
   * Dispatch custom auth state event for other components
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  dispatchAuthStateEvent(event, session, user) {
    try {
      const customEvent = new CustomEvent('authStateChange', {
        detail: {
          event,
          session,
          user,
          isAuthenticated: !!session,
          timestamp: Date.now()
        }
      });

      document.dispatchEvent(customEvent);
      window.dispatchEvent(customEvent);
      
    } catch (error) {
      console.warn('Error dispatching auth state event:', error);
    }
  }

  /**
   * Handle specific authentication events
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleSpecificAuthEvents(event, session, user) {
    try {
      switch (event) {
        case 'SIGNED_IN':
          this.handleSignInEvent(session, user);
          break;
        case 'SIGNED_OUT':
          this.handleSignOutEvent();
          break;
        case 'TOKEN_REFRESHED':
          this.handleTokenRefreshEvent(session, user);
          break;
        case 'USER_UPDATED':
          this.handleUserUpdateEvent(session, user);
          break;
        case 'initialized':
          this.handleAuthInitializedEvent(session, user);
          break;
      }
    } catch (error) {
      console.error('Error handling specific auth event:', error);
    }
  }

  /**
   * Handle sign in event
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleSignInEvent(session, user) {
    try {
      console.log('Handling sign in event in UnifiedNavigation');
      
      // Update navigation to show authenticated state
      this.updateAuthUI();
      
      // Show welcome message if not on auth page
      if (!window.location.pathname.includes('auth.html')) {
        this.showAuthMessage(`Welcome back, ${user.email}!`, 'success');
      }
      
      // Update any tool-specific authenticated features
      this.enableAuthenticatedFeatures();
      
    } catch (error) {
      console.error('Error handling sign in event:', error);
    }
  }

  /**
   * Handle sign out event
   */
  handleSignOutEvent() {
    try {
      console.log('Handling sign out event in UnifiedNavigation');
      
      // Update navigation to show guest state
      this.updateAuthUI();
      
      // Clear any user-specific data from UI
      this.clearUserSpecificData();
      
      // Disable authenticated features
      this.disableAuthenticatedFeatures();
      
    } catch (error) {
      console.error('Error handling sign out event:', error);
    }
  }

  /**
   * Handle token refresh event
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleTokenRefreshEvent(session, user) {
    try {
      // Silently update user info in case it changed
      this.updateUserSpecificElements(user);
    } catch (error) {
      console.error('Error handling token refresh event:', error);
    }
  }

  /**
   * Handle user update event
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleUserUpdateEvent(session, user) {
    try {
      // Update user-specific elements with new data
      this.updateUserSpecificElements(user);
    } catch (error) {
      console.error('Error handling user update event:', error);
    }
  }

  /**
   * Handle auth initialized event
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleAuthInitializedEvent(session, user) {
    try {
      console.log('Auth system initialized, updating navigation UI');
      this.updateAuthUI();
    } catch (error) {
      console.error('Error handling auth initialized event:', error);
    }
  }

  /**
   * Enable authenticated features
   */
  enableAuthenticatedFeatures() {
    try {
      // Enable any features that require authentication
      const authFeatures = document.querySelectorAll('[data-auth-feature]');
      authFeatures.forEach(feature => {
        feature.classList.remove('disabled');
        feature.removeAttribute('disabled');
      });
    } catch (error) {
      console.warn('Error enabling authenticated features:', error);
    }
  }

  /**
   * Disable authenticated features
   */
  disableAuthenticatedFeatures() {
    try {
      // Disable features that require authentication
      const authFeatures = document.querySelectorAll('[data-auth-feature]');
      authFeatures.forEach(feature => {
        feature.classList.add('disabled');
        feature.setAttribute('disabled', 'true');
      });
    } catch (error) {
      console.warn('Error disabling authenticated features:', error);
    }
  }

  /**
   * Clear user-specific data from UI
   */
  clearUserSpecificData() {
    try {
      // Clear user info displays
      const userInfoElements = document.querySelectorAll('[data-user-info]');
      userInfoElements.forEach(el => {
        const infoType = el.dataset.userInfo;
        switch (infoType) {
          case 'name':
          case 'email':
            el.textContent = '';
            break;
          case 'avatar':
            if (el.tagName === 'IMG') {
              el.style.display = 'none';
            }
            break;
        }
      });
    } catch (error) {
      console.warn('Error clearing user-specific data:', error);
    }
  }

  /**
   * Handle auth state update errors
   * @param {Error} error - The error that occurred
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   */
  handleAuthStateUpdateError(error, event, session) {
    try {
      console.error('Auth state update error:', error);
      
      // Attempt to recover by forcing a UI update
      setTimeout(() => {
        try {
          this.updateAuthUI();
          console.log('Attempted recovery from auth state update error');
        } catch (recoveryError) {
          console.error('Recovery attempt also failed:', recoveryError);
        }
      }, 1000);
      
      // Show user-friendly error message
      this.showAuthMessage('There was an issue updating the interface. Please refresh if problems persist.', 'warning');
      
    } catch (handlingError) {
      console.error('Error handling auth state update error:', handlingError);
    }
  }

  /**
   * Setup periodic auth state validation
   */
  setupPeriodicAuthStateValidation() {
    try {
      // Validate auth state every 30 seconds
      setInterval(() => {
        if (this.authManager && this.authManager.isInitialized) {
          const isAuthenticated = this.authManager.isAuthenticated();
          this.validateAuthUIUpdate(isAuthenticated);
        }
      }, 30000);
      
      console.log('Periodic auth state validation setup complete');
    } catch (error) {
      console.warn('Error setting up periodic auth state validation:', error);
    }
  }

  /**
   * Setup cross-tab authentication state synchronization
   */
  setupCrossTabAuthSync() {
    try {
      // Listen for storage events to sync auth state across tabs
      window.addEventListener('storage', (event) => {
        if (event.key === 'supabase.auth.token') {
          console.log('Auth token changed in another tab, updating UI');
          
          // Small delay to allow auth manager to process the change
          setTimeout(() => {
            if (this.authManager) {
              const isAuthenticated = this.authManager.isAuthenticated();
              this.updateAuthUIWithErrorHandling('cross-tab-sync', 
                this.authManager.getCurrentSession(), 
                this.authManager.getCurrentUser());
            }
          }, 500);
        }
      });
      
      console.log('Cross-tab auth synchronization setup complete');
    } catch (error) {
      console.warn('Error setting up cross-tab auth sync:', error);
    }
  }

  /**
   * Show authentication message to user
   * @param {string} message - Message to show
   * @param {string} type - Message type (success, error, warning, info)
   */
  showAuthMessage(message, type = 'info') {
    try {
      // Try to use existing toast system
      if (window.showToast) {
        window.showToast(message, type);
        return;
      }

      // Try to use auth manager's message system
      if (this.authManager && typeof this.authManager.showAuthMessage === 'function') {
        this.authManager.showAuthMessage(message, type);
        return;
      }

      // Fallback to console
      console.log(`Auth ${type}: ${message}`);
    } catch (error) {
      console.warn('Error showing auth message:', error);
    }
  }

  /**
   * Generate auth elements HTML template with enhanced calculated paths
   * @param {Object} resolvedPaths - Object containing resolved paths
   * @returns {string} HTML string for auth elements
   */
  generateAuthElementsHTML(resolvedPaths) {
    try {
      // Validate that we have all required paths
      const requiredPaths = ['auth', 'dashboard', 'profile'];
      const missingPaths = requiredPaths.filter(path => !resolvedPaths[path]);
      
      if (missingPaths.length > 0) {
        console.warn('Missing required paths:', missingPaths);
        // Use enhanced fallback paths for missing ones
        const fallbackPaths = this.calculateEnhancedFallbackPaths();
        missingPaths.forEach(path => {
          resolvedPaths[path] = fallbackPaths[path];
        });
      }

      // Enhanced path validation to ensure navigation links work from any tool location
      const validatedPaths = this.validateAndCorrectPaths(resolvedPaths);

      // Final validation before generating HTML
      const finalValidation = this.performFinalPathValidation(validatedPaths);
      if (!finalValidation.isValid) {
        console.error('Final path validation failed:', finalValidation.errors);
        throw new Error('Cannot generate auth HTML with invalid paths');
      }

      // Generate HTML with validated paths and enhanced attributes
      const authHTML = `
        <!-- Guest User -->
        <div data-guest-only class="flex items-center gap-2">
          <a href="${validatedPaths.auth}" 
             class="btn btn-outline btn-sm" 
             data-nav-link="auth"
             data-path-validated="true"
             title="Sign in to your account">
            <i class="fas fa-sign-in-alt mr-1"></i>
            Sign In
          </a>
        </div>
        
        <!-- Authenticated User -->
        <div data-auth-required class="flex items-center gap-2" style="display: none;">
          <div class="dropdown dropdown-end relative">
            <button class="btn btn-outline btn-sm dropdown-toggle" 
                    aria-label="User menu" 
                    aria-expanded="false"
                    title="User menu">
              <img data-user-info="avatar" 
                   class="w-6 h-6 rounded-full mr-2" 
                   alt="User avatar" 
                   style="display: none;">
              <span data-user-info="name" class="hidden sm:inline">User</span>
              <i class="fas fa-chevron-down ml-1"></i>
            </button>
            <ul class="dropdown-content menu p-2 shadow bg-background border border-border rounded-lg w-52 absolute right-0 top-full mt-1 z-50" 
                style="display: none;"
                role="menu">
              <li role="none">
                <a href="${validatedPaths.dashboard}" 
                   class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded" 
                   data-nav-link="dashboard"
                   data-path-validated="true"
                   data-dashboard-access="true"
                   role="menuitem"
                   title="Go to dashboard">
                  <i class="fas fa-tachometer-alt"></i>Dashboard
                </a>
              </li>
              <li role="none">
                <a href="${validatedPaths.profile}" 
                   class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded" 
                   data-nav-link="profile"
                   data-path-validated="true"
                   role="menuitem"
                   title="View and edit profile">
                  <i class="fas fa-user"></i>Profile
                </a>
              </li>
              <li role="none">
                <a href="#" 
                   data-action="signout" 
                   class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"
                   role="menuitem"
                   title="Sign out of your account">
                  <i class="fas fa-sign-out-alt"></i>Sign Out
                </a>
              </li>
            </ul>
          </div>
        </div>
      `;

      // Log successful HTML generation for debugging
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Successfully generated auth HTML with validated paths:', validatedPaths);
      }

      return authHTML;
    } catch (error) {
      console.error('Error generating auth elements HTML:', error);
      
      // Return minimal fallback HTML
      return `
        <div data-guest-only class="flex items-center gap-2">
          <a href="./auth.html" class="btn btn-outline btn-sm" data-nav-link="auth">
            <i class="fas fa-sign-in-alt mr-1"></i>
            Sign In
          </a>
        </div>
        <div data-auth-required class="flex items-center gap-2" style="display: none;">
          <span class="text-sm">Auth Error</span>
        </div>
      `;
    }
  }

  /**
   * Perform final validation before generating HTML
   * @param {Object} paths - Paths to validate
   * @returns {Object} Validation result
   */
  performFinalPathValidation(paths) {
    const errors = [];
    const requiredPaths = ['auth', 'dashboard', 'profile'];
    
    requiredPaths.forEach(pathType => {
      const path = paths[pathType];
      
      if (!path) {
        errors.push(`Missing ${pathType} path`);
      } else if (typeof path !== 'string') {
        errors.push(`${pathType} path is not a string: ${typeof path}`);
      } else if (!path.endsWith('.html')) {
        errors.push(`${pathType} path does not end with .html: ${path}`);
      } else if (path.startsWith('/')) {
        errors.push(`${pathType} path should be relative, not absolute: ${path}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate and correct paths to ensure navigation links work from any tool location
   * @param {Object} paths - Object containing paths to validate and correct
   * @returns {Object} Object containing validated and corrected paths
   */
  validateAndCorrectPaths(paths) {
    const currentPath = window.location.pathname;
    const validatedPaths = { ...paths };

    // Enhanced validation for each path
    Object.keys(validatedPaths).forEach(pathKey => {
      const path = validatedPaths[pathKey];
      
      if (!this.isValidNavigationPath(path, currentPath)) {
        console.warn(`Invalid path detected for ${pathKey}: ${path}, attempting correction`);
        
        // Try to correct the path
        const correctedPath = this.correctNavigationPath(pathKey, currentPath);
        if (correctedPath) {
          validatedPaths[pathKey] = correctedPath;
          console.log(`Corrected path for ${pathKey}: ${correctedPath}`);
        } else {
          console.error(`Could not correct path for ${pathKey}, using fallback`);
          const fallbackPaths = this.calculateFallbackPaths();
          validatedPaths[pathKey] = fallbackPaths[pathKey] || `../${pathKey}.html`;
        }
      }
    });

    return validatedPaths;
  }

  /**
   * Check if a navigation path is valid for the current location
   * @param {string} path - Path to validate
   * @param {string} currentPath - Current page path
   * @returns {boolean} True if path is valid
   */
  isValidNavigationPath(path, currentPath) {
    if (!path || typeof path !== 'string') {
      return false;
    }

    // Check basic format
    if (!path.endsWith('.html')) {
      return false;
    }

    // Don't allow absolute paths for navigation
    if (path.startsWith('/')) {
      return false;
    }

    // Use PathResolver validation if available
    if (typeof PathResolver !== 'undefined') {
      return PathResolver.validatePath(path, currentPath);
    }

    // Basic fallback validation
    return path.includes('.html') && !path.startsWith('/');
  }

  /**
   * Attempt to correct an invalid navigation path
   * @param {string} pathKey - Key identifying the type of path (auth, dashboard, profile)
   * @param {string} currentPath - Current page path
   * @returns {string|null} Corrected path or null if correction failed
   */
  correctNavigationPath(pathKey, currentPath) {
    try {
      // Map path keys to filenames
      const pathMap = {
        auth: 'auth.html',
        dashboard: 'dashboard.html',
        profile: 'profile.html',
        home: 'index.html'
      };

      const filename = pathMap[pathKey];
      if (!filename) {
        return null;
      }

      // Use PathResolver if available
      if (typeof PathResolver !== 'undefined') {
        switch (pathKey) {
          case 'auth':
            return PathResolver.resolveAuthPath(currentPath);
          case 'dashboard':
            return PathResolver.resolveDashboardPath(currentPath);
          case 'profile':
            return PathResolver.resolveProfilePath(currentPath);
          case 'home':
            return PathResolver.resolveHomePath(currentPath);
          default:
            return PathResolver.resolveRootFile(filename, currentPath);
        }
      }

      // Fallback correction
      const pathDepth = currentPath.split('/').length - 2;
      const basePath = pathDepth > 1 ? '../'.repeat(pathDepth - 1) : './';
      return `${basePath}${filename}`;
    } catch (error) {
      console.error('Error correcting navigation path:', error);
      return null;
    }
  }

  /**
   * Calculate fallback paths if PathResolver is not available
   * @returns {Object} Object containing fallback paths
   */
  calculateFallbackPaths() {
    const currentPath = window.location.pathname;
    const pathDepth = currentPath.split('/').length - 2;
    const basePath = pathDepth > 1 ? '../'.repeat(pathDepth - 1) : './';
    
    return {
      auth: `${basePath}auth.html`,
      dashboard: `${basePath}dashboard.html`,
      profile: `${basePath}profile.html`,
      home: `${basePath}index.html`
    };
  }

  /**
   * Validate navigation paths to ensure they work from current location
   * @param {Object} paths - Object containing paths to validate
   * @returns {boolean} True if all paths are valid
   */
  validateNavigationPaths(paths) {
    try {
      // Basic validation checks
      if (!paths || typeof paths !== 'object') {
        console.warn('Paths object is invalid or missing');
        return false;
      }

      const currentPath = window.location.pathname;
      const requiredPaths = ['auth', 'dashboard', 'profile'];
      let allValid = true;

      for (const pathKey of requiredPaths) {
        const path = paths[pathKey];
        
        if (!this.isValidNavigationPath(path, currentPath)) {
          console.warn(`Invalid navigation path for ${pathKey}:`, path);
          allValid = false;
        }
      }

      // Enhanced validation using PathResolver if available
      if (typeof PathResolver !== 'undefined') {
        try {
          const pathInfo = PathResolver.getAllPaths(currentPath);
          const resolverValidation = pathInfo.validation;
          
          // Check if PathResolver validation matches our paths
          for (const pathKey of requiredPaths) {
            if (resolverValidation[pathKey] === false) {
              console.warn(`PathResolver validation failed for ${pathKey}`);
              allValid = false;
            }
          }
        } catch (error) {
          console.warn('Error during PathResolver validation:', error);
          // Don't fail validation just because PathResolver had an error
        }
      }

      if (allValid) {
        console.log('All navigation paths validated successfully');
      } else {
        console.warn('Some navigation paths failed validation');
      }

      return allValid;
    } catch (error) {
      console.error('Path validation error:', error);
      return false;
    }
  }

  /**
   * Add auth elements to existing navigation with enhanced PathResolver integration and duplication prevention
   */
  addAuthElementsToExistingNav() {
    const nav = document.querySelector('nav[data-unified-nav-managed="true"]');
    if (!nav) {
      console.warn('No managed navigation element found to enhance');
      return;
    }

    // Check if auth elements already exist to prevent duplication
    const existingAuthElements = nav.querySelectorAll('[data-auth-required], [data-guest-only]');
    if (existingAuthElements.length > 0) {
      console.log('Auth elements already exist in navigation, skipping addition to prevent duplication');
      return;
    }

    // Find the right side of navigation (usually contains theme toggle)
    let rightSide = nav.querySelector('.flex.items-center.gap-2');
    if (!rightSide) {
      // Create right side if it doesn't exist
      const navContent = nav.querySelector('.flex.justify-between, .flex');
      if (navContent) {
        rightSide = document.createElement('div');
        rightSide.className = 'flex items-center gap-2';
        navContent.appendChild(rightSide);
      }
    }

    if (!rightSide) {
      console.warn('Could not find or create navigation right side container');
      return;
    }

    // Enhanced path resolution with comprehensive validation
    const resolvedPaths = this.getResolvedPathsWithEnhancedValidation();
    
    // Validate that all paths are working correctly before proceeding
    if (!this.validateNavigationPaths(resolvedPaths)) {
      console.warn('Path validation failed, attempting path correction...');
      const correctedPaths = this.correctAllNavigationPaths();
      if (correctedPaths && this.validateNavigationPaths(correctedPaths)) {
        console.log('Successfully corrected navigation paths');
        Object.assign(resolvedPaths, correctedPaths);
      } else {
        console.error('Failed to correct navigation paths, using fallback');
        Object.assign(resolvedPaths, this.calculateFallbackPaths());
      }
    }
    
    // Log path resolution for debugging
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('UnifiedNavigation: Using validated resolved paths:', resolvedPaths);
      this.logPathValidationDetails(resolvedPaths);
    }

    // Generate auth HTML template with validated calculated paths
    const authHTML = this.generateAuthElementsHTML(resolvedPaths);

    // Verify HTML generation was successful
    if (!authHTML || authHTML.trim() === '') {
      console.error('Failed to generate auth elements HTML');
      return;
    }

    // Add auth elements before theme toggle
    const themeToggle = rightSide.querySelector('#theme-toggle');
    if (themeToggle) {
      themeToggle.insertAdjacentHTML('beforebegin', authHTML);
    } else {
      rightSide.insertAdjacentHTML('beforeend', authHTML);
    }

    // Verify auth elements were added successfully
    const addedAuthElements = rightSide.querySelectorAll('[data-auth-required], [data-guest-only]');
    if (addedAuthElements.length === 0) {
      console.error('Failed to add auth elements to navigation');
      return;
    }

    // Set up new auth elements with enhanced error handling
    try {
      this.enhanceAuthElements();
      this.setupDropdownFunctionality();
      
      // Final validation of added navigation links
      this.validateAddedNavigationLinks();
      
      // Final duplication check after adding elements
      this.performFinalDuplicationCheck();
      
      console.log('Successfully enhanced navigation with auth elements and duplication prevention');
    } catch (error) {
      console.error('Error setting up auth elements:', error);
    }
  }

  /**
   * Perform final duplication check after adding elements
   */
  performFinalDuplicationCheck() {
    try {
      // Check for duplicate auth elements one more time
      const authRequiredElements = document.querySelectorAll('[data-auth-required]');
      const guestOnlyElements = document.querySelectorAll('[data-guest-only]');
      const dropdownToggles = document.querySelectorAll('.dropdown-toggle');

      let duplicatesFound = false;

      if (authRequiredElements.length > 1) {
        console.warn(`Final check: Found ${authRequiredElements.length} auth-required elements, removing duplicates`);
        this.removeDuplicateAuthElements(authRequiredElements, 'auth-required');
        duplicatesFound = true;
      }

      if (guestOnlyElements.length > 1) {
        console.warn(`Final check: Found ${guestOnlyElements.length} guest-only elements, removing duplicates`);
        this.removeDuplicateAuthElements(guestOnlyElements, 'guest-only');
        duplicatesFound = true;
      }

      if (dropdownToggles.length > 1) {
        console.warn(`Final check: Found ${dropdownToggles.length} dropdown toggles, removing duplicates`);
        this.removeDuplicateDropdowns(dropdownToggles);
        duplicatesFound = true;
      }

      if (!duplicatesFound) {
        console.log('Final duplication check passed - no duplicates found');
      } else {
        console.log('Final duplication check completed - duplicates removed');
      }

      // Mark navigation as fully processed
      const nav = document.querySelector('nav[data-unified-nav-managed="true"]');
      if (nav) {
        nav.setAttribute('data-unified-nav-processed', 'true');
        nav.setAttribute('data-unified-nav-final-check', Date.now().toString());
      }

    } catch (error) {
      console.error('Error during final duplication check:', error);
    }
  }

  /**
   * Fix button hover states across the app
   */
  fixButtonHoverStates() {
    // Add consistent hover styles
    const hoverStyles = `
      <style id="unified-nav-hover-styles">
        /* Consistent button hover states */
        .btn:hover,
        button:hover,
        #theme-toggle:hover,
        #sidebar-toggle:hover,
        #sidebar-close:hover,
        #mobile-menu-button:hover {
          background-color: var(--muted) !important;
          transform: none !important;
          transition: background-color 0.2s ease !important;
        }

        /* Outline buttons */
        .btn-outline:hover {
          background-color: var(--muted) !important;
          border-color: var(--border) !important;
        }

        /* Theme toggle specific */
        #theme-toggle {
          transition: background-color 0.2s ease;
        }

        #theme-toggle:hover {
          background-color: var(--muted);
        }

        /* Sidebar toggle */
        #sidebar-toggle,
        #sidebar-close {
          transition: background-color 0.2s ease;
        }

        #sidebar-toggle:hover,
        #sidebar-close:hover {
          background-color: var(--muted);
        }

        /* Mobile menu button */
        #mobile-menu-button {
          transition: background-color 0.2s ease;
        }

        #mobile-menu-button:hover {
          background-color: var(--muted);
        }

        /* Dropdown items */
        .dropdown-content a:hover,
        .menu li a:hover {
          background-color: var(--muted) !important;
        }

        /* Navigation links */
        nav a:hover {
          color: var(--primary) !important;
          transition: color 0.2s ease;
        }

        /* Fix any solid background hovers */
        .btn:not(.btn-primary):hover {
          background-color: var(--muted) !important;
          color: var(--foreground) !important;
        }
      </style>
    `;

    if (!document.getElementById('unified-nav-hover-styles')) {
      document.head.insertAdjacentHTML('beforeend', hoverStyles);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Handle mobile menu if it exists
    const mobileMenuBtn = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('show');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
          icon.className = mobileMenu.classList.contains('show') ? 'fas fa-times' : 'fas fa-bars';
        }
      });
    }

    // Sidebar is handled by layout.js - don't duplicate handlers

    // Set up dropdown functionality
    this.setupDropdownFunctionality();
  }

  /**
   * Set up dropdown functionality
   */
  setupDropdownFunctionality() {
    // Handle dropdown toggles
    document.addEventListener('click', (e) => {
      const dropdownToggle = e.target.closest('.dropdown-toggle');
      
      if (dropdownToggle) {
        e.preventDefault();
        e.stopPropagation();
        
        const dropdown = dropdownToggle.closest('.dropdown');
        const dropdownContent = dropdown.querySelector('.dropdown-content');
        
        if (dropdownContent) {
          const isVisible = dropdownContent.style.display === 'block';
          
          // Close all other dropdowns first
          document.querySelectorAll('.dropdown-content').forEach(content => {
            content.style.display = 'none';
          });
          
          // Toggle current dropdown
          dropdownContent.style.display = isVisible ? 'none' : 'block';
          dropdownToggle.setAttribute('aria-expanded', !isVisible);
          
          // Verify dashboard access when dropdown is opened
          if (!isVisible && this.authManager && this.authManager.isAuthenticated()) {
            this.verifyDashboardAccess();
          }
        }
      } else {
        // Close all dropdowns when clicking outside
        document.querySelectorAll('.dropdown-content').forEach(content => {
          content.style.display = 'none';
        });
        document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
          toggle.setAttribute('aria-expanded', 'false');
        });
      }
    });

    // Handle keyboard navigation for dropdowns
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close all dropdowns on Escape key
        document.querySelectorAll('.dropdown-content').forEach(content => {
          content.style.display = 'none';
        });
        document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
          toggle.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  /**
   * Update authentication UI
   */
  updateAuthUI() {
    if (!this.authManager) return;

    const isAuthenticated = this.authManager.isAuthenticated();
    const user = this.authManager.getCurrentUser();

    // Show/hide auth elements
    const authRequired = document.querySelectorAll('[data-auth-required]');
    const guestOnly = document.querySelectorAll('[data-guest-only]');

    authRequired.forEach(el => {
      el.style.display = isAuthenticated ? 'flex' : 'none';
    });

    guestOnly.forEach(el => {
      el.style.display = isAuthenticated ? 'none' : 'flex';
    });

    // Update user info and verify dashboard access
    if (isAuthenticated && user) {
      const avatars = document.querySelectorAll('[data-user-info="avatar"]');
      const userNames = document.querySelectorAll('[data-user-info="name"]');

      avatars.forEach(avatar => {
        if (user.user_metadata?.avatar_url) {
          avatar.src = user.user_metadata.avatar_url;
          avatar.style.display = 'block';
        } else {
          avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=3b82f6&color=fff&size=32`;
          avatar.style.display = 'block';
        }
      });

      userNames.forEach(nameEl => {
        nameEl.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
      });

      // Verify and update dashboard access
      this.verifyDashboardAccess();
      
      // Update user menu dropdown visibility
      this.updateUserMenuDropdown(true);
    } else {
      // Hide user menu dropdown for unauthenticated users
      this.updateUserMenuDropdown(false);
    }
  }

  /**
   * Update user menu dropdown visibility based on authentication state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   */
  updateUserMenuDropdown(isAuthenticated) {
    const userMenuDropdowns = document.querySelectorAll('[data-auth-required] .dropdown');
    
    userMenuDropdowns.forEach(dropdown => {
      const dropdownToggle = dropdown.querySelector('.dropdown-toggle');
      const dropdownContent = dropdown.querySelector('.dropdown-content');
      
      if (isAuthenticated) {
        // Enable dropdown functionality for authenticated users
        if (dropdownToggle) {
          dropdownToggle.removeAttribute('disabled');
          dropdownToggle.classList.remove('disabled');
          dropdownToggle.setAttribute('aria-label', 'User menu');
          dropdownToggle.style.cursor = 'pointer';
        }
        
        if (dropdownContent) {
          // Ensure dropdown content is properly structured
          dropdownContent.setAttribute('role', 'menu');
          
          // Verify all menu items have proper roles
          const menuItems = dropdownContent.querySelectorAll('li');
          menuItems.forEach(item => {
            item.setAttribute('role', 'none');
            const link = item.querySelector('a');
            if (link) {
              link.setAttribute('role', 'menuitem');
            }
          });
        }
        
        console.log('User menu dropdown enabled for authenticated user');
      } else {
        // Disable dropdown functionality for unauthenticated users
        if (dropdownToggle) {
          dropdownToggle.setAttribute('disabled', 'true');
          dropdownToggle.classList.add('disabled');
          dropdownToggle.setAttribute('aria-label', 'User menu (sign in required)');
          dropdownToggle.style.cursor = 'not-allowed';
        }
        
        if (dropdownContent) {
          // Hide dropdown content
          dropdownContent.style.display = 'none';
        }
        
        console.log('User menu dropdown disabled for unauthenticated user');
      }
    });
  }

  /**
   * Verify dashboard access and update UI accordingly
   */
  verifyDashboardAccess() {
    if (!this.authManager || !this.authManager.isAuthenticated()) {
      // Hide dashboard links for unauthenticated users
      this.hideDashboardLinks();
      return;
    }

    // Show dashboard links for authenticated users
    this.showDashboardLinks();
    
    // Verify dashboard links have correct paths
    this.validateDashboardLinks();
  }

  /**
   * Show dashboard links in user menu
   */
  showDashboardLinks() {
    const dashboardLinks = document.querySelectorAll('[data-dashboard-access="true"], [data-nav-link="dashboard"]');
    dashboardLinks.forEach(link => {
      // Ensure the parent menu item is visible
      const menuItem = link.closest('li');
      if (menuItem) {
        menuItem.style.display = 'block';
      }
      
      // Ensure the link itself is visible and enabled
      link.style.display = 'flex';
      link.removeAttribute('disabled');
      link.classList.remove('disabled');
      
      // Add visual indicator that dashboard is accessible
      if (!link.querySelector('.dashboard-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'dashboard-indicator sr-only';
        indicator.textContent = ' (Available)';
        link.appendChild(indicator);
      }
    });

    console.log('Dashboard access enabled for authenticated user');
  }

  /**
   * Hide dashboard links for unauthenticated users
   */
  hideDashboardLinks() {
    const dashboardLinks = document.querySelectorAll('[data-dashboard-access="true"], [data-nav-link="dashboard"]');
    dashboardLinks.forEach(link => {
      // Hide the entire menu item
      const menuItem = link.closest('li');
      if (menuItem) {
        menuItem.style.display = 'none';
      }
      
      // Disable the link
      link.style.display = 'none';
      link.setAttribute('disabled', 'true');
      link.classList.add('disabled');
      
      // Remove dashboard indicator
      const indicator = link.querySelector('.dashboard-indicator');
      if (indicator) {
        indicator.remove();
      }
    });

    console.log('Dashboard access hidden for unauthenticated user');
  }

  /**
   * Validate that dashboard links have correct relative paths
   */
  validateDashboardLinks() {
    const currentPath = window.location.pathname;
    const dashboardLinks = document.querySelectorAll('[data-nav-link="dashboard"]');
    
    dashboardLinks.forEach(link => {
      const href = link.getAttribute('href');
      
      // Check if the path is valid
      if (!this.isValidNavigationPath(href, currentPath)) {
        console.warn('Invalid dashboard link detected:', href);
        
        // Attempt to correct the path
        const correctedPath = this.correctNavigationPath('dashboard', currentPath);
        if (correctedPath) {
          link.setAttribute('href', correctedPath);
          console.log('Corrected dashboard link to:', correctedPath);
          
          // Add visual indicator that path was corrected
          link.setAttribute('data-path-corrected', 'true');
          link.setAttribute('title', 'Go to dashboard (path corrected)');
        } else {
          console.error('Could not correct dashboard link path');
          // Disable the link if we can't correct it
          link.setAttribute('disabled', 'true');
          link.classList.add('disabled');
          link.setAttribute('title', 'Dashboard unavailable (path error)');
        }
      } else {
        // Path is valid, ensure it's enabled
        link.removeAttribute('disabled');
        link.classList.remove('disabled');
        link.setAttribute('title', 'Go to dashboard');
        console.log('Dashboard link validated successfully:', href);
      }
    });
  }

  /**
   * Add breadcrumbs if needed
   */
  addBreadcrumbs() {
    const path = window.location.pathname;
    
    // Don't show breadcrumbs on home page
    if (path === '/' || path === '/index.html') return;

    // Check if breadcrumbs already exist
    if (document.querySelector('.breadcrumb')) return;

    const nav = document.querySelector('nav');
    if (!nav) return;

    const breadcrumbHTML = `
      <div class="breadcrumb bg-muted/50 border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav class="breadcrumb-nav py-2 text-sm" aria-label="Breadcrumb">
            ${this.generateBreadcrumbItems()}
          </nav>
        </div>
      </div>
    `;

    nav.insertAdjacentHTML('afterend', breadcrumbHTML);
  }

  /**
   * Generate breadcrumb items
   */
  generateBreadcrumbItems() {
    const path = window.location.pathname;
    const pathParts = path.split('/').filter(part => part);
    
    // Get home path using PathResolver if available
    const homePath = typeof PathResolver !== 'undefined' 
      ? PathResolver.resolveHomePath(path)
      : this.calculateRelativeHomePath(path);
    
    const breadcrumbs = [{ name: 'Home', url: homePath }];

    let currentPath = '';
    pathParts.forEach((part, index) => {
      currentPath += '/' + part;
      
      let name = part.replace('.html', '').replace('-', ' ');
      name = name.charAt(0).toUpperCase() + name.slice(1);
      
      if (part === 'tools') {
        name = 'Tools';
      } else if (pathParts[index - 1] === 'tools') {
        name = this.getToolDisplayName(part);
      }

      // Calculate relative URL for breadcrumb
      const relativeUrl = this.calculateRelativeBreadcrumbUrl(currentPath, path);

      breadcrumbs.push({
        name: name,
        url: relativeUrl,
        active: index === pathParts.length - 1
      });
    });

    return breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const separator = isLast ? '' : '<i class="fas fa-chevron-right mx-2 text-muted-foreground"></i>';
      
      if (isLast) {
        return `<span class="text-foreground font-medium">${crumb.name}</span>`;
      } else {
        return `<a href="${crumb.url}" class="text-muted-foreground hover:text-foreground">${crumb.name}</a>${separator}`;
      }
    }).join('');
  }

  /**
   * Calculate relative home path for breadcrumbs
   * @param {string} currentPath - Current page path
   * @returns {string} Relative path to home
   */
  calculateRelativeHomePath(currentPath) {
    const pathDepth = currentPath.split('/').length - 2;
    const basePath = pathDepth > 1 ? '../'.repeat(pathDepth - 1) : './';
    return `${basePath}index.html`;
  }

  /**
   * Calculate relative URL for breadcrumb items
   * @param {string} targetPath - Target path for breadcrumb
   * @param {string} currentPath - Current page path
   * @returns {string} Relative URL
   */
  calculateRelativeBreadcrumbUrl(targetPath, currentPath) {
    // If PathResolver is available, use it for more accurate calculation
    if (typeof PathResolver !== 'undefined') {
      const basePath = PathResolver.getBasePath(currentPath);
      // Remove leading slash from target path and combine with base path
      const cleanTargetPath = targetPath.replace(/^\/+/, '');
      return `${basePath}${cleanTargetPath}`;
    }
    
    // Fallback calculation
    const currentDepth = currentPath.split('/').length - 2;
    const targetDepth = targetPath.split('/').length - 1;
    
    if (currentDepth <= targetDepth) {
      // Going deeper or same level
      return targetPath;
    } else {
      // Going up levels
      const upLevels = currentDepth - targetDepth;
      const basePath = '../'.repeat(upLevels);
      return `${basePath}${targetPath.replace(/^\/+/, '')}`;
    }
  }

  /**
   * Debug path resolution information
   */
  debugPathResolution() {
    const currentPath = window.location.pathname;
    console.group('UnifiedNavigation Enhanced Path Resolution Debug');
    console.log('Current Path:', currentPath);
    
    if (typeof PathResolver !== 'undefined') {
      console.log('PathResolver available - using enhanced path resolution');
      PathResolver.debugPaths(currentPath);
      
      // Test both old and new path resolution methods
      const basicResolvedPaths = this.getResolvedPaths();
      const enhancedResolvedPaths = this.getResolvedPathsWithValidation();
      
      console.log('Basic Resolved Paths:', basicResolvedPaths);
      console.log('Enhanced Resolved Paths:', enhancedResolvedPaths);
      console.log('Basic Path Validation:', this.validateNavigationPaths(basicResolvedPaths));
      console.log('Enhanced Path Validation:', this.validateNavigationPaths(enhancedResolvedPaths));
      
      // Test path correction
      console.group('Path Correction Tests');
      const testPaths = {
        auth: '/auth.html', // Invalid absolute path
        dashboard: 'dashboard.html', // Missing relative prefix
        profile: '../profile.html' // May be incorrect depth
      };
      
      Object.keys(testPaths).forEach(pathKey => {
        const originalPath = testPaths[pathKey];
        const isValid = this.isValidNavigationPath(originalPath, currentPath);
        console.log(`${pathKey}: ${originalPath} - Valid: ${isValid}`);
        
        if (!isValid) {
          const correctedPath = this.correctNavigationPath(pathKey, currentPath);
          console.log(`  Corrected to: ${correctedPath}`);
        }
      });
      console.groupEnd();
      
    } else {
      console.warn('PathResolver not available, using fallback');
      const fallbackPaths = this.calculateFallbackPaths();
      console.log('Fallback Paths:', fallbackPaths);
      console.log('Fallback Path Validation:', this.validateNavigationPaths(fallbackPaths));
    }
    
    // Check existing navigation links
    console.group('Existing Navigation Links Analysis');
    const linkTypes = [
      { type: 'auth', selectors: ['a[href*="auth.html"]', 'a[data-nav-link="auth"]'] },
      { type: 'dashboard', selectors: ['a[href*="dashboard.html"]', 'a[data-nav-link="dashboard"]'] },
      { type: 'profile', selectors: ['a[href*="profile.html"]', 'a[data-nav-link="profile"]'] }
    ];
    
    linkTypes.forEach(({ type, selectors }) => {
      selectors.forEach(selector => {
        const links = document.querySelectorAll(selector);
        if (links.length > 0) {
          console.log(`Found ${links.length} ${type} links with selector: ${selector}`);
          links.forEach((link, index) => {
            const href = link.getAttribute('href');
            const isValid = this.isValidNavigationPath(href, currentPath);
            console.log(`  Link ${index + 1}: ${href} - Valid: ${isValid}`);
          });
        }
      });
    });
    console.groupEnd();
    
    console.groupEnd();
  }

  /**
   * Update existing navigation links with correct paths
   */
  updateExistingNavigationPaths() {
    const resolvedPaths = this.getResolvedPathsWithValidation();
    const currentPath = window.location.pathname;
    
    console.log('Updating existing navigation paths with:', resolvedPaths);

    // Update auth links with enhanced path resolution
    this.updateNavigationLinksOfType('auth', resolvedPaths.auth, [
      'a[href*="auth.html"]',
      'a[href="/auth.html"]',
      'a[href="./auth.html"]',
      'a[data-nav-link="auth"]'
    ]);

    // Update dashboard links
    this.updateNavigationLinksOfType('dashboard', resolvedPaths.dashboard, [
      'a[href*="dashboard.html"]',
      'a[href="/dashboard.html"]',
      'a[href="./dashboard.html"]',
      'a[data-nav-link="dashboard"]'
    ]);

    // Update profile links
    this.updateNavigationLinksOfType('profile', resolvedPaths.profile, [
      'a[href*="profile.html"]',
      'a[href="/profile.html"]',
      'a[href="./profile.html"]',
      'a[data-nav-link="profile"]'
    ]);

    // Update home links
    this.updateNavigationLinksOfType('home', resolvedPaths.home, [
      'a[href="/"]',
      'a[href="index.html"]',
      'a[href="/index.html"]',
      'a[href="./index.html"]',
      'a[data-nav-link="home"]'
    ]);

    // Validate updated links
    this.validateUpdatedNavigationLinks();
  }

  /**
   * Update navigation links of a specific type
   * @param {string} linkType - Type of link (auth, dashboard, profile, home)
   * @param {string} newPath - New path to set
   * @param {Array} selectors - Array of CSS selectors to find links
   */
  updateNavigationLinksOfType(linkType, newPath, selectors) {
    if (!newPath) {
      console.warn(`No path provided for ${linkType} links`);
      return;
    }

    let updatedCount = 0;
    
    selectors.forEach(selector => {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        const oldHref = link.href;
        link.href = newPath;
        updatedCount++;
        
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log(`Updated ${linkType} link: ${oldHref} -> ${newPath}`);
        }
      });
    });

    if (updatedCount > 0) {
      console.log(`Updated ${updatedCount} ${linkType} navigation links`);
    }
  }

  /**
   * Validate that updated navigation links are working correctly
   */
  validateUpdatedNavigationLinks() {
    const currentPath = window.location.pathname;
    const linkTypes = ['auth', 'dashboard', 'profile', 'home'];
    
    linkTypes.forEach(linkType => {
      const links = document.querySelectorAll(`a[data-nav-link="${linkType}"]`);
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!this.isValidNavigationPath(href, currentPath)) {
          console.warn(`Updated ${linkType} link may not work correctly: ${href}`);
        }
      });
    });
  }

  /**
   * Get tool display name
   */
  getToolDisplayName(toolName) {
    const toolNames = {
      'image-converter': 'Image Converter',
      'pdf-merger': 'PDF Merger',
      'background-remover': 'Background Remover',
      'qr-generator': 'QR Generator',
      'text-case-converter': 'Text Case Converter',
      'uuid-generator': 'UUID Generator',
      'json-formatter': 'JSON Formatter',
      'timestamp-converter': 'Timestamp Converter',
      'utm-builder': 'UTM Builder',
      'color-palette': 'Color Palette',
      'meta-tag-generator': 'Meta Tag Generator',
      'robots-txt': 'Robots.txt Generator'
    };

    return toolNames[toolName] || toolName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

// Initialize unified navigation with duplication prevention
if (typeof window !== 'undefined') {
  // Prevent multiple script initializations
  if (window.unifiedNavigationScriptLoaded) {
    console.warn('UnifiedNavigation script already loaded, preventing duplicate initialization');
  } else {
    window.unifiedNavigationScriptLoaded = true;
    
    // Dispatch event to notify of initialization attempt
    if (document.body && document.body.hasAttribute('data-unified-nav-initialized')) {
      const event = new CustomEvent('unified-nav-init-attempt', {
        detail: { timestamp: Date.now() }
      });
      document.dispatchEvent(event);
    } else {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          if (!window.unifiedNavigationInstance) {
            window.unifiedNavigation = new UnifiedNavigation();
          } else {
            console.log('Using existing UnifiedNavigation instance');
            window.unifiedNavigation = window.unifiedNavigationInstance;
          }
        });
      } else {
        if (!window.unifiedNavigationInstance) {
          window.unifiedNavigation = new UnifiedNavigation();
        } else {
          console.log('Using existing UnifiedNavigation instance');
          window.unifiedNavigation = window.unifiedNavigationInstance;
        }
      }
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnifiedNavigation;
}