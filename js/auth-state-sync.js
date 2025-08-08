/**
 * Authentication State Synchronization Utility
 * Ensures all tool pages properly listen for auth state changes and update UI immediately
 * Provides error handling for failed authentication state updates
 */

class AuthStateSynchronizer {
  constructor() {
    this.isInitialized = false;
    this.syncListeners = [];
    this.errorHandlers = [];
    this.retryAttempts = 0;
    this.maxRetryAttempts = 3;
    this.retryDelay = 1000;
    this.lastSuccessfulSync = null;
    this.authBroadcastChannel = null;
    
    this.init();
  }

  /**
   * Initialize the auth state synchronizer
   */
  async init() {
    try {
      console.log('Initializing AuthStateSynchronizer');
      
      // Wait for required dependencies
      await this.waitForDependencies();
      
      // Setup global auth state listeners
      this.setupGlobalAuthStateListeners();
      
      // Setup error recovery mechanisms
      this.setupErrorRecovery();
      
      // Setup cross-component synchronization
      this.setupCrossComponentSync();
      
      // Validate initial auth state
      this.validateInitialAuthState();
      
      this.isInitialized = true;
      console.log('AuthStateSynchronizer initialized successfully');
      
    } catch (error) {
      console.error('Error initializing AuthStateSynchronizer:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Wait for required dependencies to be available
   */
  async waitForDependencies() {
    const dependencies = ['authManager', 'unifiedNavigation'];
    const maxWait = 10000; // 10 seconds
    const checkInterval = 100;
    let waited = 0;

    return new Promise((resolve, reject) => {
      const checkDependencies = () => {
        const missing = dependencies.filter(dep => !window[dep]);
        
        if (missing.length === 0) {
          console.log('All auth sync dependencies available');
          resolve();
        } else if (waited >= maxWait) {
          console.warn('Some auth sync dependencies not available:', missing);
          resolve(); // Continue anyway
        } else {
          waited += checkInterval;
          setTimeout(checkDependencies, checkInterval);
        }
      };
      
      checkDependencies();
    });
  }

  /**
   * Setup global authentication state listeners
   */
  setupGlobalAuthStateListeners() {
    try {
      // Listen to AuthManager events
      if (window.authManager) {
        window.authManager.addAuthStateListener((event, session, user) => {
          this.handleGlobalAuthStateChange(event, session, user);
        });
        console.log('Added global auth state listener to AuthManager');
      }

      // Listen to custom auth events
      document.addEventListener('authStateChange', (event) => {
        this.handleCustomAuthStateEvent(event);
      });

      // Listen to auth UI update events
      document.addEventListener('authUIUpdated', (event) => {
        this.handleAuthUIUpdateEvent(event);
      });

      // Listen to storage events for cross-tab sync
      window.addEventListener('storage', (event) => {
        if (event.key && event.key.includes('supabase.auth')) {
          this.handleStorageAuthEvent(event);
        }
      });

      console.log('Global auth state listeners setup complete');
    } catch (error) {
      console.error('Error setting up global auth state listeners:', error);
    }
  }

  /**
   * Handle global authentication state changes with enhanced cross-tab sync
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleGlobalAuthStateChange(event, session, user) {
    try {
      console.log('Global auth state change:', event, user?.email || 'No user');
      
      // Broadcast to other tabs first (before local processing)
      this.broadcastAuthStateChange(event, session, user);
      
      // Notify all registered sync listeners
      this.notifySyncListeners(event, session, user);
      
      // Perform immediate UI synchronization
      this.performImmediateUISync(event, session, user);
      
      // Validate that sync was successful
      this.validateSyncSuccess(event, session, user);
      
      // Store successful sync timestamp for health checks
      this.lastSuccessfulSync = Date.now();
      
    } catch (error) {
      console.error('Error handling global auth state change:', error);
      this.handleSyncError(error, event, session, user);
    }
  }

  /**
   * Handle custom auth state events
   * @param {CustomEvent} event - Custom auth event
   */
  handleCustomAuthStateEvent(event) {
    try {
      const { event: authEvent, session, user } = event.detail;
      console.log('Custom auth state event received:', authEvent);
      
      // Additional processing for custom events
      this.processCustomAuthEvent(authEvent, session, user);
      
    } catch (error) {
      console.error('Error handling custom auth state event:', error);
    }
  }

  /**
   * Handle auth UI update events
   * @param {CustomEvent} event - Auth UI update event
   */
  handleAuthUIUpdateEvent(event) {
    try {
      const { isAuthenticated, user, session } = event.detail;
      console.log('Auth UI update event received, authenticated:', isAuthenticated);
      
      // Validate that UI is in correct state
      this.validateUIState(isAuthenticated, user, session);
      
    } catch (error) {
      console.error('Error handling auth UI update event:', error);
    }
  }

  /**
   * Handle storage-based auth events (cross-tab sync)
   * @param {StorageEvent} event - Storage event
   */
  handleStorageAuthEvent(event) {
    try {
      console.log('Storage auth event detected:', event.key);
      
      // Small delay to allow auth manager to process the change
      setTimeout(() => {
        if (window.authManager) {
          const isAuthenticated = window.authManager.isAuthenticated();
          const session = window.authManager.getCurrentSession();
          const user = window.authManager.getCurrentUser();
          
          this.performImmediateUISync('storage-sync', session, user);
        }
      }, 500);
      
    } catch (error) {
      console.error('Error handling storage auth event:', error);
    }
  }

  /**
   * Perform immediate UI synchronization with enhanced error handling and validation
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  performImmediateUISync(event, session, user) {
    const startTime = performance.now();
    
    try {
      const isAuthenticated = !!session;
      console.log(`Starting immediate UI sync for event: ${event}, authenticated: ${isAuthenticated}`);
      
      // Pre-sync validation
      this.validatePreSyncConditions();
      
      // Update all auth-dependent elements immediately with error isolation
      this.updateAuthElementsWithErrorIsolation(isAuthenticated);
      
      // Update user-specific elements with error isolation
      if (isAuthenticated && user) {
        this.updateUserElementsWithErrorIsolation(user);
      } else {
        this.clearUserElementsWithErrorIsolation();
      }
      
      // Update navigation state with error isolation
      this.updateNavigationStateWithErrorIsolation(isAuthenticated, user);
      
      // Update tool-specific features with error isolation
      this.updateToolFeaturesWithErrorIsolation(isAuthenticated, user);
      
      // Post-sync validation
      this.validatePostSyncState(isAuthenticated, user);
      
      // Dispatch completion event
      this.dispatchSyncCompletionEvent(event, isAuthenticated, user);
      
      const endTime = performance.now();
      console.log(`Immediate UI sync completed for event: ${event} in ${(endTime - startTime).toFixed(2)}ms`);
      
    } catch (error) {
      const endTime = performance.now();
      console.error(`Error performing immediate UI sync after ${(endTime - startTime).toFixed(2)}ms:`, error);
      
      // Enhanced error context
      error.syncContext = {
        event,
        isAuthenticated: !!session,
        hasUser: !!user,
        syncDuration: endTime - startTime,
        timestamp: Date.now()
      };
      
      throw error; // Re-throw to trigger error handling
    }
  }

  /**
   * Validate conditions before starting sync
   */
  validatePreSyncConditions() {
    try {
      // Check if DOM is ready
      if (document.readyState === 'loading') {
        console.warn('DOM still loading during auth sync');
      }
      
      // Check if required elements exist
      const authElements = document.querySelectorAll('[data-auth-required]');
      const guestElements = document.querySelectorAll('[data-guest-only]');
      
      if (authElements.length === 0 && guestElements.length === 0) {
        console.warn('No auth-dependent elements found on page');
      }
      
      // Check if auth manager is available
      if (!window.authManager) {
        console.warn('AuthManager not available during sync');
      }
      
    } catch (error) {
      console.warn('Error validating pre-sync conditions:', error);
    }
  }

  /**
   * Update auth elements with error isolation
   * @param {boolean} isAuthenticated - Whether user is authenticated
   */
  updateAuthElementsWithErrorIsolation(isAuthenticated) {
    try {
      const authRequiredElements = document.querySelectorAll('[data-auth-required]');
      const guestOnlyElements = document.querySelectorAll('[data-guest-only]');

      // Update auth-required elements with individual error handling
      authRequiredElements.forEach((el, index) => {
        try {
          if (isAuthenticated) {
            el.style.display = el.dataset.authDisplay || 'block';
            el.classList.remove('hidden');
            el.setAttribute('aria-hidden', 'false');
          } else {
            el.style.display = 'none';
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
          }
        } catch (elementError) {
          console.warn(`Error updating auth-required element ${index}:`, elementError);
        }
      });

      // Update guest-only elements with individual error handling
      guestOnlyElements.forEach((el, index) => {
        try {
          if (isAuthenticated) {
            el.style.display = 'none';
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
          } else {
            el.style.display = el.dataset.guestDisplay || 'block';
            el.classList.remove('hidden');
            el.setAttribute('aria-hidden', 'false');
          }
        } catch (elementError) {
          console.warn(`Error updating guest-only element ${index}:`, elementError);
        }
      });

      console.log(`Updated ${authRequiredElements.length} auth-required and ${guestOnlyElements.length} guest-only elements`);

    } catch (error) {
      console.error('Error updating auth elements:', error);
      throw new Error(`Auth elements update failed: ${error.message}`);
    }
  }

  /**
   * Update user elements with error isolation
   * @param {Object} user - User object
   */
  updateUserElementsWithErrorIsolation(user) {
    try {
      const userInfoElements = document.querySelectorAll('[data-user-info]');
      let successCount = 0;
      
      userInfoElements.forEach((el, index) => {
        try {
          const infoType = el.dataset.userInfo;
          switch (infoType) {
            case 'email':
              el.textContent = user.email || '';
              el.setAttribute('title', user.email || '');
              break;
            case 'name':
              const displayName = user.user_metadata?.full_name || 
                               user.email?.split('@')[0] || 
                               'User';
              el.textContent = displayName;
              el.setAttribute('title', displayName);
              break;
            case 'avatar':
              if (el.tagName === 'IMG') {
                const avatarUrl = user.user_metadata?.avatar_url || 
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=0066cc&color=fff`;
                el.src = avatarUrl;
                el.style.display = 'block';
                el.setAttribute('alt', `Avatar for ${user.email || 'User'}`);
              }
              break;
            default:
              console.warn(`Unknown user info type: ${infoType}`);
          }
          successCount++;
        } catch (elementError) {
          console.warn(`Error updating user info element ${index} (${el.dataset.userInfo}):`, elementError);
        }
      });

      console.log(`Updated ${successCount}/${userInfoElements.length} user info elements`);

    } catch (error) {
      console.error('Error updating user elements:', error);
      throw new Error(`User elements update failed: ${error.message}`);
    }
  }

  /**
   * Clear user elements with error isolation
   */
  clearUserElementsWithErrorIsolation() {
    try {
      const userInfoElements = document.querySelectorAll('[data-user-info]');
      let successCount = 0;
      
      userInfoElements.forEach((el, index) => {
        try {
          const infoType = el.dataset.userInfo;
          switch (infoType) {
            case 'email':
            case 'name':
              el.textContent = '';
              el.removeAttribute('title');
              break;
            case 'avatar':
              if (el.tagName === 'IMG') {
                el.style.display = 'none';
                el.src = '';
                el.removeAttribute('alt');
              }
              break;
          }
          successCount++;
        } catch (elementError) {
          console.warn(`Error clearing user info element ${index}:`, elementError);
        }
      });

      console.log(`Cleared ${successCount}/${userInfoElements.length} user info elements`);

    } catch (error) {
      console.error('Error clearing user elements:', error);
      throw new Error(`User elements clearing failed: ${error.message}`);
    }
  }

  /**
   * Update navigation state with error isolation
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  updateNavigationStateWithErrorIsolation(isAuthenticated, user) {
    try {
      // Update navigation dropdowns
      const dropdowns = document.querySelectorAll('.dropdown');
      dropdowns.forEach((dropdown, index) => {
        try {
          if (isAuthenticated) {
            dropdown.classList.remove('disabled');
            dropdown.removeAttribute('aria-disabled');
          } else {
            dropdown.classList.add('disabled');
            dropdown.setAttribute('aria-disabled', 'true');
          }
        } catch (elementError) {
          console.warn(`Error updating dropdown ${index}:`, elementError);
        }
      });

      // Update dashboard links
      const dashboardLinks = document.querySelectorAll('[data-dashboard-access]');
      dashboardLinks.forEach((link, index) => {
        try {
          if (isAuthenticated) {
            link.classList.remove('disabled');
            link.removeAttribute('disabled');
            link.removeAttribute('aria-disabled');
          } else {
            link.classList.add('disabled');
            link.setAttribute('disabled', 'true');
            link.setAttribute('aria-disabled', 'true');
          }
        } catch (elementError) {
          console.warn(`Error updating dashboard link ${index}:`, elementError);
        }
      });

      console.log(`Updated ${dropdowns.length} dropdowns and ${dashboardLinks.length} dashboard links`);

    } catch (error) {
      console.error('Error updating navigation state:', error);
      // Don't throw here as navigation updates are less critical
    }
  }

  /**
   * Update tool features with error isolation
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  updateToolFeaturesWithErrorIsolation(isAuthenticated, user) {
    try {
      // Update premium features
      const premiumFeatures = document.querySelectorAll('[data-premium-feature]');
      premiumFeatures.forEach((feature, index) => {
        try {
          if (isAuthenticated) {
            feature.classList.remove('premium-locked');
            feature.removeAttribute('aria-disabled');
          } else {
            feature.classList.add('premium-locked');
            feature.setAttribute('aria-disabled', 'true');
          }
        } catch (elementError) {
          console.warn(`Error updating premium feature ${index}:`, elementError);
        }
      });

      // Update auth-dependent tool features
      const authFeatures = document.querySelectorAll('[data-auth-feature]');
      authFeatures.forEach((feature, index) => {
        try {
          if (isAuthenticated) {
            feature.classList.remove('disabled');
            feature.removeAttribute('disabled');
            feature.removeAttribute('aria-disabled');
          } else {
            feature.classList.add('disabled');
            feature.setAttribute('disabled', 'true');
            feature.setAttribute('aria-disabled', 'true');
          }
        } catch (elementError) {
          console.warn(`Error updating auth feature ${index}:`, elementError);
        }
      });

      console.log(`Updated ${premiumFeatures.length} premium features and ${authFeatures.length} auth features`);

    } catch (error) {
      console.error('Error updating tool features:', error);
      // Don't throw here as tool feature updates are less critical
    }
  }

  /**
   * Validate state after sync completion
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  validatePostSyncState(isAuthenticated, user) {
    try {
      const validation = {
        authElementsCorrect: this.validateAuthElementsState(isAuthenticated),
        userElementsCorrect: this.validateUserElementsState(isAuthenticated, user),
        navigationCorrect: this.validateNavigationState(isAuthenticated),
        overallValid: true
      };

      validation.overallValid = validation.authElementsCorrect && 
                               validation.userElementsCorrect && 
                               validation.navigationCorrect;

      if (!validation.overallValid) {
        console.warn('Post-sync validation failed:', validation);
        // Attempt immediate correction
        this.correctPostSyncIssues(validation, isAuthenticated, user);
      } else {
        console.log('Post-sync validation passed');
      }

    } catch (error) {
      console.warn('Error validating post-sync state:', error);
    }
  }

  /**
   * Validate auth elements state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @returns {boolean} True if auth elements are in correct state
   */
  validateAuthElementsState(isAuthenticated) {
    try {
      const authElements = document.querySelectorAll('[data-auth-required]');
      const guestElements = document.querySelectorAll('[data-guest-only]');

      for (const el of authElements) {
        const isVisible = el.style.display !== 'none' && !el.classList.contains('hidden');
        if (isAuthenticated && !isVisible) return false;
        if (!isAuthenticated && isVisible) return false;
      }

      for (const el of guestElements) {
        const isVisible = el.style.display !== 'none' && !el.classList.contains('hidden');
        if (isAuthenticated && isVisible) return false;
        if (!isAuthenticated && !isVisible) return false;
      }

      return true;
    } catch (error) {
      console.warn('Error validating auth elements state:', error);
      return false;
    }
  }

  /**
   * Validate user elements state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   * @returns {boolean} True if user elements are in correct state
   */
  validateUserElementsState(isAuthenticated, user) {
    try {
      const userElements = document.querySelectorAll('[data-user-info]');

      for (const el of userElements) {
        const infoType = el.dataset.userInfo;
        if (isAuthenticated && user) {
          switch (infoType) {
            case 'email':
              if (el.textContent !== (user.email || '')) return false;
              break;
            case 'name':
              const expectedName = user.user_metadata?.full_name || 
                                 user.email?.split('@')[0] || 
                                 'User';
              if (el.textContent !== expectedName) return false;
              break;
            case 'avatar':
              if (el.tagName === 'IMG' && el.style.display === 'none') return false;
              break;
          }
        } else {
          // When not authenticated, user elements should be empty/hidden
          switch (infoType) {
            case 'email':
            case 'name':
              if (el.textContent !== '') return false;
              break;
            case 'avatar':
              if (el.tagName === 'IMG' && el.style.display !== 'none') return false;
              break;
          }
        }
      }

      return true;
    } catch (error) {
      console.warn('Error validating user elements state:', error);
      return false;
    }
  }

  /**
   * Validate navigation state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @returns {boolean} True if navigation is in correct state
   */
  validateNavigationState(isAuthenticated) {
    try {
      const dashboardLinks = document.querySelectorAll('[data-dashboard-access]');

      for (const link of dashboardLinks) {
        const isDisabled = link.classList.contains('disabled') || link.hasAttribute('disabled');
        if (isAuthenticated && isDisabled) return false;
        if (!isAuthenticated && !isDisabled) return false;
      }

      return true;
    } catch (error) {
      console.warn('Error validating navigation state:', error);
      return false;
    }
  }

  /**
   * Correct issues found in post-sync validation
   * @param {Object} validation - Validation results
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  correctPostSyncIssues(validation, isAuthenticated, user) {
    try {
      console.log('Correcting post-sync issues...');

      if (!validation.authElementsCorrect) {
        this.updateAuthElementsWithErrorIsolation(isAuthenticated);
      }

      if (!validation.userElementsCorrect) {
        if (isAuthenticated && user) {
          this.updateUserElementsWithErrorIsolation(user);
        } else {
          this.clearUserElementsWithErrorIsolation();
        }
      }

      if (!validation.navigationCorrect) {
        this.updateNavigationStateWithErrorIsolation(isAuthenticated, user);
      }

      console.log('Post-sync issue correction completed');
    } catch (error) {
      console.error('Error correcting post-sync issues:', error);
    }
  }

  /**
   * Dispatch sync completion event
   * @param {string} event - Auth event type
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  dispatchSyncCompletionEvent(event, isAuthenticated, user) {
    try {
      const completionEvent = new CustomEvent('authSyncCompleted', {
        detail: {
          originalEvent: event,
          isAuthenticated,
          user,
          timestamp: Date.now(),
          syncId: Math.random().toString(36).substr(2, 9)
        }
      });

      document.dispatchEvent(completionEvent);
      window.dispatchEvent(completionEvent);
    } catch (error) {
      console.warn('Error dispatching sync completion event:', error);
    }
  }

  /**
   * Update authentication-dependent elements
   * @param {boolean} isAuthenticated - Whether user is authenticated
   */
  updateAuthElements(isAuthenticated) {
    try {
      const authRequiredElements = document.querySelectorAll('[data-auth-required]');
      const guestOnlyElements = document.querySelectorAll('[data-guest-only]');

      authRequiredElements.forEach(el => {
        if (isAuthenticated) {
          el.style.display = el.dataset.authDisplay || 'block';
          el.classList.remove('hidden');
        } else {
          el.style.display = 'none';
          el.classList.add('hidden');
        }
      });

      guestOnlyElements.forEach(el => {
        if (isAuthenticated) {
          el.style.display = 'none';
          el.classList.add('hidden');
        } else {
          el.style.display = el.dataset.guestDisplay || 'block';
          el.classList.remove('hidden');
        }
      });

    } catch (error) {
      console.error('Error updating auth elements:', error);
    }
  }

  /**
   * Update user-specific elements
   * @param {Object} user - User object
   */
  updateUserElements(user) {
    try {
      const userInfoElements = document.querySelectorAll('[data-user-info]');
      
      userInfoElements.forEach(el => {
        const infoType = el.dataset.userInfo;
        switch (infoType) {
          case 'email':
            el.textContent = user.email || '';
            break;
          case 'name':
            el.textContent = user.user_metadata?.full_name || 
                           user.email?.split('@')[0] || 
                           'User';
            break;
          case 'avatar':
            if (el.tagName === 'IMG') {
              const avatarUrl = user.user_metadata?.avatar_url || 
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=0066cc&color=fff`;
              el.src = avatarUrl;
              el.style.display = 'block';
            }
            break;
        }
      });

    } catch (error) {
      console.error('Error updating user elements:', error);
    }
  }

  /**
   * Clear user-specific elements
   */
  clearUserElements() {
    try {
      const userInfoElements = document.querySelectorAll('[data-user-info]');
      
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

    } catch (error) {
      console.error('Error clearing user elements:', error);
    }
  }

  /**
   * Update navigation state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  updateNavigationState(isAuthenticated, user) {
    try {
      // Update navigation dropdowns
      const dropdowns = document.querySelectorAll('.dropdown');
      dropdowns.forEach(dropdown => {
        if (isAuthenticated) {
          dropdown.classList.remove('disabled');
        } else {
          dropdown.classList.add('disabled');
        }
      });

      // Update dashboard links
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

    } catch (error) {
      console.error('Error updating navigation state:', error);
    }
  }

  /**
   * Update tool-specific features
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  updateToolFeatures(isAuthenticated, user) {
    try {
      // Update premium features
      const premiumFeatures = document.querySelectorAll('[data-premium-feature]');
      premiumFeatures.forEach(feature => {
        if (isAuthenticated) {
          feature.classList.remove('premium-locked');
        } else {
          feature.classList.add('premium-locked');
        }
      });

      // Update auth-dependent tool features
      const authFeatures = document.querySelectorAll('[data-auth-feature]');
      authFeatures.forEach(feature => {
        if (isAuthenticated) {
          feature.classList.remove('disabled');
          feature.removeAttribute('disabled');
        } else {
          feature.classList.add('disabled');
          feature.setAttribute('disabled', 'true');
        }
      });

    } catch (error) {
      console.error('Error updating tool features:', error);
    }
  }

  /**
   * Validate that synchronization was successful
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  validateSyncSuccess(event, session, user) {
    try {
      const isAuthenticated = !!session;
      
      // Check auth-required elements
      const authRequiredElements = document.querySelectorAll('[data-auth-required]');
      let authElementsValid = true;
      
      authRequiredElements.forEach(el => {
        const isVisible = el.style.display !== 'none' && !el.classList.contains('hidden');
        if (isAuthenticated && !isVisible) {
          console.warn('Auth-required element not visible when authenticated:', el);
          authElementsValid = false;
        } else if (!isAuthenticated && isVisible) {
          console.warn('Auth-required element visible when not authenticated:', el);
          authElementsValid = false;
        }
      });

      // Check guest-only elements
      const guestOnlyElements = document.querySelectorAll('[data-guest-only]');
      let guestElementsValid = true;
      
      guestOnlyElements.forEach(el => {
        const isVisible = el.style.display !== 'none' && !el.classList.contains('hidden');
        if (isAuthenticated && isVisible) {
          console.warn('Guest-only element visible when authenticated:', el);
          guestElementsValid = false;
        } else if (!isAuthenticated && !isVisible) {
          console.warn('Guest-only element not visible when not authenticated:', el);
          guestElementsValid = false;
        }
      });

      if (!authElementsValid || !guestElementsValid) {
        console.warn('Auth sync validation failed, attempting correction...');
        this.correctSyncState(isAuthenticated, user);
      } else {
        console.log('Auth sync validation passed');
        this.retryAttempts = 0; // Reset retry counter on success
      }

    } catch (error) {
      console.error('Error validating sync success:', error);
    }
  }

  /**
   * Correct synchronization state if validation failed
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  correctSyncState(isAuthenticated, user) {
    try {
      console.log('Correcting auth sync state');
      
      // Force update all elements
      this.updateAuthElements(isAuthenticated);
      
      if (isAuthenticated && user) {
        this.updateUserElements(user);
      } else {
        this.clearUserElements();
      }
      
      // Re-validate after correction
      setTimeout(() => {
        this.validateSyncSuccess('correction', isAuthenticated ? {} : null, user);
      }, 100);
      
    } catch (error) {
      console.error('Error correcting sync state:', error);
    }
  }

  /**
   * Handle synchronization errors with enhanced recovery mechanisms
   * @param {Error} error - The error that occurred
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleSyncError(error, event, session, user) {
    try {
      console.error('Auth sync error:', error);
      
      // Log detailed error information for debugging
      this.logDetailedErrorInfo(error, event, session, user);
      
      // Notify error handlers
      this.notifyErrorHandlers(error, event, session, user);
      
      // Attempt different recovery strategies based on error type
      const recoveryStrategy = this.determineRecoveryStrategy(error);
      
      if (this.retryAttempts < this.maxRetryAttempts) {
        this.retryAttempts++;
        console.log(`Retrying auth sync (attempt ${this.retryAttempts}/${this.maxRetryAttempts}) using strategy: ${recoveryStrategy}`);
        
        // Use different retry strategies
        this.executeRecoveryStrategy(recoveryStrategy, event, session, user);
      } else {
        console.error('Max retry attempts reached for auth sync');
        this.handleMaxRetriesReached(error, event, session, user);
      }
      
    } catch (handlingError) {
      console.error('Error handling sync error:', handlingError);
      // Last resort: attempt basic fallback
      this.attemptBasicFallback(event, session, user);
    }
  }

  /**
   * Log detailed error information for debugging
   * @param {Error} error - The error that occurred
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  logDetailedErrorInfo(error, event, session, user) {
    try {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        event,
        hasSession: !!session,
        hasUser: !!user,
        userEmail: user?.email,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        retryAttempt: this.retryAttempts,
        authManagerAvailable: !!window.authManager,
        unifiedNavigationAvailable: !!window.unifiedNavigation,
        domElementCounts: {
          authRequired: document.querySelectorAll('[data-auth-required]').length,
          guestOnly: document.querySelectorAll('[data-guest-only]').length,
          userInfo: document.querySelectorAll('[data-user-info]').length
        }
      };
      
      console.group('Auth Sync Error Details');
      console.table(errorInfo);
      console.groupEnd();
      
      // Store error info for potential reporting
      this.storeErrorForReporting(errorInfo);
      
    } catch (loggingError) {
      console.warn('Error logging detailed error info:', loggingError);
    }
  }

  /**
   * Determine the best recovery strategy based on error type
   * @param {Error} error - The error that occurred
   * @returns {string} Recovery strategy name
   */
  determineRecoveryStrategy(error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('element') || errorMessage.includes('dom')) {
      return 'dom-refresh';
    } else if (errorMessage.includes('auth') || errorMessage.includes('session')) {
      return 'auth-refresh';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'network-retry';
    } else if (errorMessage.includes('timeout')) {
      return 'delayed-retry';
    } else {
      return 'standard-retry';
    }
  }

  /**
   * Execute the determined recovery strategy
   * @param {string} strategy - Recovery strategy to execute
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  executeRecoveryStrategy(strategy, event, session, user) {
    try {
      switch (strategy) {
        case 'dom-refresh':
          this.executeDOMRefreshStrategy(event, session, user);
          break;
        case 'auth-refresh':
          this.executeAuthRefreshStrategy(event, session, user);
          break;
        case 'network-retry':
          this.executeNetworkRetryStrategy(event, session, user);
          break;
        case 'delayed-retry':
          this.executeDelayedRetryStrategy(event, session, user);
          break;
        default:
          this.executeStandardRetryStrategy(event, session, user);
      }
    } catch (strategyError) {
      console.error(`Error executing recovery strategy ${strategy}:`, strategyError);
      // Fallback to standard retry
      this.executeStandardRetryStrategy(event, session, user);
    }
  }

  /**
   * Execute DOM refresh recovery strategy
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  executeDOMRefreshStrategy(event, session, user) {
    console.log('Executing DOM refresh recovery strategy');
    
    // Wait for DOM to be stable, then retry
    setTimeout(() => {
      // Re-query DOM elements in case they changed
      this.refreshDOMReferences();
      this.performImmediateUISync(event, session, user);
    }, 500);
  }

  /**
   * Execute auth refresh recovery strategy
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  executeAuthRefreshStrategy(event, session, user) {
    console.log('Executing auth refresh recovery strategy');
    
    // Get fresh auth state from AuthManager
    setTimeout(() => {
      if (window.authManager) {
        const freshSession = window.authManager.getCurrentSession();
        const freshUser = window.authManager.getCurrentUser();
        this.performImmediateUISync(event, freshSession, freshUser);
      } else {
        this.performImmediateUISync(event, session, user);
      }
    }, 200);
  }

  /**
   * Execute network retry recovery strategy
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  executeNetworkRetryStrategy(event, session, user) {
    console.log('Executing network retry recovery strategy');
    
    // Wait longer for network issues to resolve
    setTimeout(() => {
      this.performImmediateUISync(event, session, user);
    }, this.retryDelay * 2);
  }

  /**
   * Execute delayed retry recovery strategy
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  executeDelayedRetryStrategy(event, session, user) {
    console.log('Executing delayed retry recovery strategy');
    
    // Use exponential backoff for timeout issues
    const delay = this.retryDelay * Math.pow(2, this.retryAttempts - 1);
    setTimeout(() => {
      this.performImmediateUISync(event, session, user);
    }, delay);
  }

  /**
   * Execute standard retry recovery strategy
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  executeStandardRetryStrategy(event, session, user) {
    console.log('Executing standard retry recovery strategy');
    
    setTimeout(() => {
      this.performImmediateUISync(event, session, user);
    }, this.retryDelay * this.retryAttempts);
  }

  /**
   * Refresh DOM element references
   */
  refreshDOMReferences() {
    try {
      // Force re-query of commonly used elements
      const authElements = document.querySelectorAll('[data-auth-required]');
      const guestElements = document.querySelectorAll('[data-guest-only]');
      const userElements = document.querySelectorAll('[data-user-info]');
      
      console.log('Refreshed DOM references:', {
        authElements: authElements.length,
        guestElements: guestElements.length,
        userElements: userElements.length
      });
    } catch (error) {
      console.warn('Error refreshing DOM references:', error);
    }
  }

  /**
   * Store error information for potential reporting
   * @param {Object} errorInfo - Error information to store
   */
  storeErrorForReporting(errorInfo) {
    try {
      // Store in sessionStorage for debugging (limit to last 10 errors)
      const storedErrors = JSON.parse(sessionStorage.getItem('auth_sync_errors') || '[]');
      storedErrors.push(errorInfo);
      
      // Keep only last 10 errors
      if (storedErrors.length > 10) {
        storedErrors.splice(0, storedErrors.length - 10);
      }
      
      sessionStorage.setItem('auth_sync_errors', JSON.stringify(storedErrors));
    } catch (storageError) {
      console.warn('Error storing error info:', storageError);
    }
  }

  /**
   * Attempt basic fallback when all else fails
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  attemptBasicFallback(event, session, user) {
    try {
      console.log('Attempting basic fallback for auth sync');
      
      const isAuthenticated = !!session;
      
      // Very basic show/hide logic
      document.querySelectorAll('[data-auth-required]').forEach(el => {
        try {
          el.style.display = isAuthenticated ? 'block' : 'none';
        } catch (e) {
          console.warn('Error in basic fallback for auth element:', e);
        }
      });
      
      document.querySelectorAll('[data-guest-only]').forEach(el => {
        try {
          el.style.display = isAuthenticated ? 'none' : 'block';
        } catch (e) {
          console.warn('Error in basic fallback for guest element:', e);
        }
      });
      
      console.log('Basic fallback completed');
    } catch (fallbackError) {
      console.error('Basic fallback also failed:', fallbackError);
    }
  }

  /**
   * Handle case when max retries are reached
   * @param {Error} error - The original error
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  handleMaxRetriesReached(error, event, session, user) {
    try {
      // Show user-friendly error message
      if (window.authManager && typeof window.authManager.showAuthMessage === 'function') {
        window.authManager.showAuthMessage(
          'There was an issue updating the interface. Please refresh the page if problems persist.',
          'warning'
        );
      }
      
      // Dispatch error event for other components
      const errorEvent = new CustomEvent('authSyncError', {
        detail: {
          error: error.message,
          event,
          session,
          user,
          retryAttempts: this.retryAttempts
        }
      });
      
      document.dispatchEvent(errorEvent);
      
    } catch (handlingError) {
      console.error('Error handling max retries reached:', handlingError);
    }
  }

  /**
   * Setup error recovery mechanisms
   */
  setupErrorRecovery() {
    try {
      // Setup periodic health check
      setInterval(() => {
        this.performHealthCheck();
      }, 60000); // Every minute
      
      // Setup page visibility change handler
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.performHealthCheck();
        }
      });
      
      console.log('Error recovery mechanisms setup complete');
    } catch (error) {
      console.error('Error setting up error recovery:', error);
    }
  }

  /**
   * Perform comprehensive health check on auth state synchronization
   */
  performHealthCheck() {
    try {
      if (!this.isInitialized || !window.authManager) {
        console.warn('Health check skipped: not initialized or no auth manager');
        return;
      }
      
      const healthCheckStart = performance.now();
      console.log('Starting auth sync health check');
      
      const isAuthenticated = window.authManager.isAuthenticated();
      const user = window.authManager.getCurrentUser();
      const session = window.authManager.getCurrentSession();
      
      // Check if last sync was too long ago
      const timeSinceLastSync = Date.now() - (this.lastSuccessfulSync || 0);
      const maxSyncAge = 5 * 60 * 1000; // 5 minutes
      
      if (timeSinceLastSync > maxSyncAge) {
        console.warn(`Last successful sync was ${Math.round(timeSinceLastSync / 1000)}s ago, forcing refresh`);
        this.performImmediateUISync('health-check-refresh', session, user);
      }
      
      // Validate current state
      const validationResult = this.validateSyncSuccess('health-check', session, user);
      
      // Check for common issues
      this.checkForCommonIssues(isAuthenticated, user, session);
      
      // Update health check metrics
      this.updateHealthCheckMetrics(healthCheckStart, validationResult);
      
      console.log(`Auth sync health check completed in ${(performance.now() - healthCheckStart).toFixed(2)}ms`);
      
    } catch (error) {
      console.warn('Error during auth sync health check:', error);
      
      // Attempt recovery from health check failure
      this.recoverFromHealthCheckFailure(error);
    }
  }

  /**
   * Check for common auth sync issues
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   * @param {Object} session - Auth session
   */
  checkForCommonIssues(isAuthenticated, user, session) {
    try {
      const issues = [];
      
      // Check for missing auth elements
      const authElements = document.querySelectorAll('[data-auth-required]');
      const guestElements = document.querySelectorAll('[data-guest-only]');
      
      if (authElements.length === 0 && guestElements.length === 0) {
        issues.push('No auth-dependent elements found on page');
      }
      
      // Check for inconsistent auth state
      if (isAuthenticated && !user) {
        issues.push('Authenticated but no user object available');
      }
      
      if (isAuthenticated && !session) {
        issues.push('Authenticated but no session available');
      }
      
      // Check for UI inconsistencies
      const visibleAuthElements = Array.from(authElements).filter(el => 
        el.style.display !== 'none' && !el.classList.contains('hidden')
      );
      
      const visibleGuestElements = Array.from(guestElements).filter(el => 
        el.style.display !== 'none' && !el.classList.contains('hidden')
      );
      
      if (isAuthenticated && visibleGuestElements.length > 0) {
        issues.push(`${visibleGuestElements.length} guest elements visible when authenticated`);
      }
      
      if (!isAuthenticated && visibleAuthElements.length > 0) {
        issues.push(`${visibleAuthElements.length} auth elements visible when not authenticated`);
      }
      
      // Log issues if found
      if (issues.length > 0) {
        console.warn('Auth sync issues detected:', issues);
        
        // Attempt to fix issues
        this.fixCommonIssues(issues, isAuthenticated, user, session);
      }
      
    } catch (error) {
      console.warn('Error checking for common issues:', error);
    }
  }

  /**
   * Fix common auth sync issues
   * @param {Array} issues - List of detected issues
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   * @param {Object} session - Auth session
   */
  fixCommonIssues(issues, isAuthenticated, user, session) {
    try {
      console.log('Attempting to fix common auth sync issues');
      
      // Force a complete UI sync to fix most issues
      this.performImmediateUISync('issue-fix', session, user);
      
      // Log the fix attempt
      console.log('Common issues fix attempt completed');
      
    } catch (error) {
      console.error('Error fixing common issues:', error);
    }
  }

  /**
   * Update health check metrics
   * @param {number} startTime - Health check start time
   * @param {boolean} validationResult - Whether validation passed
   */
  updateHealthCheckMetrics(startTime, validationResult) {
    try {
      const duration = performance.now() - startTime;
      
      // Store metrics in sessionStorage for debugging
      const metrics = JSON.parse(sessionStorage.getItem('auth_sync_metrics') || '{}');
      
      if (!metrics.healthChecks) {
        metrics.healthChecks = [];
      }
      
      metrics.healthChecks.push({
        timestamp: Date.now(),
        duration: Math.round(duration),
        validationPassed: validationResult,
        url: window.location.href
      });
      
      // Keep only last 20 health checks
      if (metrics.healthChecks.length > 20) {
        metrics.healthChecks = metrics.healthChecks.slice(-20);
      }
      
      sessionStorage.setItem('auth_sync_metrics', JSON.stringify(metrics));
      
    } catch (error) {
      console.warn('Error updating health check metrics:', error);
    }
  }

  /**
   * Recover from health check failure
   * @param {Error} error - Health check error
   */
  recoverFromHealthCheckFailure(error) {
    try {
      console.log('Attempting recovery from health check failure');
      
      // Try basic auth state refresh
      if (window.authManager) {
        const session = window.authManager.getCurrentSession();
        const user = window.authManager.getCurrentUser();
        
        // Attempt basic fallback sync
        this.attemptBasicFallback('health-check-recovery', session, user);
      }
      
    } catch (recoveryError) {
      console.error('Recovery from health check failure also failed:', recoveryError);
    }
  }

  /**
   * Setup cross-component synchronization with enhanced cross-tab support
   */
  setupCrossComponentSync() {
    try {
      // Listen for component-specific auth events
      document.addEventListener('componentAuthUpdate', (event) => {
        this.handleComponentAuthUpdate(event);
      });
      
      // Setup cross-tab synchronization
      this.setupCrossTabSync();
      
      // Setup page visibility change handling
      this.setupPageVisibilityHandling();
      
      console.log('Cross-component sync setup complete');
    } catch (error) {
      console.error('Error setting up cross-component sync:', error);
    }
  }

  /**
   * Setup cross-tab synchronization
   */
  setupCrossTabSync() {
    try {
      // Listen for storage events (cross-tab communication)
      window.addEventListener('storage', (event) => {
        this.handleStorageEvent(event);
      });

      // Listen for focus events to sync when tab becomes active
      window.addEventListener('focus', () => {
        this.handleTabFocus();
      });

      // Setup broadcast channel for modern browsers
      if (typeof BroadcastChannel !== 'undefined') {
        this.setupBroadcastChannel();
      }

      console.log('Cross-tab sync setup complete');
    } catch (error) {
      console.warn('Error setting up cross-tab sync:', error);
    }
  }

  /**
   * Setup broadcast channel for cross-tab communication
   */
  setupBroadcastChannel() {
    try {
      this.authBroadcastChannel = new BroadcastChannel('auth-state-sync');
      
      this.authBroadcastChannel.addEventListener('message', (event) => {
        this.handleBroadcastMessage(event);
      });

      console.log('Broadcast channel setup complete');
    } catch (error) {
      console.warn('Error setting up broadcast channel:', error);
    }
  }

  /**
   * Handle broadcast messages from other tabs
   * @param {MessageEvent} event - Broadcast message event
   */
  handleBroadcastMessage(event) {
    try {
      const { type, data } = event.data;
      
      if (type === 'auth-state-change') {
        console.log('Received auth state change from another tab:', data);
        
        // Small delay to avoid conflicts with local auth manager
        setTimeout(() => {
          if (window.authManager) {
            const currentSession = window.authManager.getCurrentSession();
            const currentUser = window.authManager.getCurrentUser();
            
            // Only sync if there's a meaningful difference
            if (this.shouldSyncFromBroadcast(data, currentSession, currentUser)) {
              this.performImmediateUISync('cross-tab-sync', currentSession, currentUser);
            }
          }
        }, 100);
      }
    } catch (error) {
      console.warn('Error handling broadcast message:', error);
    }
  }

  /**
   * Determine if we should sync based on broadcast data
   * @param {Object} broadcastData - Data from broadcast
   * @param {Object} currentSession - Current session
   * @param {Object} currentUser - Current user
   * @returns {boolean} True if sync is needed
   */
  shouldSyncFromBroadcast(broadcastData, currentSession, currentUser) {
    try {
      const broadcastAuth = broadcastData.isAuthenticated;
      const currentAuth = !!currentSession;
      
      // Sync if auth state differs
      if (broadcastAuth !== currentAuth) {
        return true;
      }
      
      // Sync if user changed
      if (broadcastAuth && broadcastData.userId !== currentUser?.id) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Error determining broadcast sync need:', error);
      return false;
    }
  }

  /**
   * Broadcast auth state change to other tabs
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  broadcastAuthStateChange(event, session, user) {
    try {
      if (this.authBroadcastChannel) {
        this.authBroadcastChannel.postMessage({
          type: 'auth-state-change',
          data: {
            event,
            isAuthenticated: !!session,
            userId: user?.id,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.warn('Error broadcasting auth state change:', error);
    }
  }

  /**
   * Handle storage events for cross-tab sync
   * @param {StorageEvent} event - Storage event
   */
  handleStorageEvent(event) {
    try {
      // Handle Supabase auth storage changes
      if (event.key && event.key.includes('supabase.auth')) {
        console.log('Supabase auth storage change detected');
        
        // Delay to allow auth manager to process the change
        setTimeout(() => {
          this.syncFromStorageChange();
        }, 200);
      }
    } catch (error) {
      console.warn('Error handling storage event:', error);
    }
  }

  /**
   * Sync auth state from storage changes
   */
  syncFromStorageChange() {
    try {
      if (window.authManager) {
        const session = window.authManager.getCurrentSession();
        const user = window.authManager.getCurrentUser();
        
        console.log('Syncing from storage change, authenticated:', !!session);
        this.performImmediateUISync('storage-change', session, user);
      }
    } catch (error) {
      console.warn('Error syncing from storage change:', error);
    }
  }

  /**
   * Handle tab focus events
   */
  handleTabFocus() {
    try {
      console.log('Tab focused, checking auth state');
      
      // Perform health check when tab becomes active
      setTimeout(() => {
        this.performHealthCheck();
      }, 100);
    } catch (error) {
      console.warn('Error handling tab focus:', error);
    }
  }

  /**
   * Setup page visibility change handling
   */
  setupPageVisibilityHandling() {
    try {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          console.log('Page became visible, performing auth sync check');
          
          // Check auth state when page becomes visible
          setTimeout(() => {
            this.performHealthCheck();
          }, 200);
        }
      });

      console.log('Page visibility handling setup complete');
    } catch (error) {
      console.warn('Error setting up page visibility handling:', error);
    }
  }

  /**
   * Handle component-specific auth updates
   * @param {CustomEvent} event - Component auth update event
   */
  handleComponentAuthUpdate(event) {
    try {
      const { component, isAuthenticated, user } = event.detail;
      console.log(`Component auth update from ${component}:`, isAuthenticated);
      
      // Sync other components if needed
      this.syncOtherComponents(component, isAuthenticated, user);
      
    } catch (error) {
      console.error('Error handling component auth update:', error);
    }
  }

  /**
   * Sync other components when one component updates
   * @param {string} sourceComponent - Component that triggered the update
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   */
  syncOtherComponents(sourceComponent, isAuthenticated, user) {
    try {
      // Dispatch sync event to other components
      const syncEvent = new CustomEvent('authSyncFromComponent', {
        detail: {
          sourceComponent,
          isAuthenticated,
          user,
          timestamp: Date.now()
        }
      });
      
      document.dispatchEvent(syncEvent);
      
    } catch (error) {
      console.error('Error syncing other components:', error);
    }
  }

  /**
   * Validate initial authentication state
   */
  validateInitialAuthState() {
    try {
      if (window.authManager && window.authManager.isInitialized) {
        const isAuthenticated = window.authManager.isAuthenticated();
        const user = window.authManager.getCurrentUser();
        const session = window.authManager.getCurrentSession();
        
        console.log('Validating initial auth state:', isAuthenticated);
        this.performImmediateUISync('initial-validation', session, user);
      }
    } catch (error) {
      console.error('Error validating initial auth state:', error);
    }
  }

  /**
   * Handle initialization error
   * @param {Error} error - Initialization error
   */
  handleInitializationError(error) {
    try {
      console.error('AuthStateSynchronizer initialization failed:', error);
      
      // Setup minimal fallback functionality
      this.setupFallbackSync();
      
    } catch (fallbackError) {
      console.error('Fallback sync setup also failed:', fallbackError);
    }
  }

  /**
   * Setup minimal fallback synchronization
   */
  setupFallbackSync() {
    try {
      // Basic auth state listener
      if (window.authManager) {
        window.authManager.addAuthStateListener((event, session, user) => {
          console.log('Fallback auth sync:', event);
          this.updateAuthElements(!!session);
        });
      }
      
      console.log('Fallback auth sync setup complete');
    } catch (error) {
      console.error('Error setting up fallback sync:', error);
    }
  }

  /**
   * Process custom auth events
   * @param {string} authEvent - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  processCustomAuthEvent(authEvent, session, user) {
    // Override in subclasses for custom processing
    console.log('Processing custom auth event:', authEvent);
  }

  /**
   * Validate UI state
   * @param {boolean} isAuthenticated - Whether user is authenticated
   * @param {Object} user - User object
   * @param {Object} session - Auth session
   */
  validateUIState(isAuthenticated, user, session) {
    // Additional UI validation can be added here
    console.log('Validating UI state:', isAuthenticated);
  }

  /**
   * Add sync listener
   * @param {Function} callback - Callback function
   */
  addSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  /**
   * Remove sync listener
   * @param {Function} callback - Callback function
   */
  removeSyncListener(callback) {
    this.syncListeners = this.syncListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify sync listeners
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  notifySyncListeners(event, session, user) {
    this.syncListeners.forEach(callback => {
      try {
        callback(event, session, user);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Add error handler
   * @param {Function} handler - Error handler function
   */
  addErrorHandler(handler) {
    this.errorHandlers.push(handler);
  }

  /**
   * Notify error handlers
   * @param {Error} error - The error that occurred
   * @param {string} event - Auth event type
   * @param {Object} session - Auth session
   * @param {Object} user - User object
   */
  notifyErrorHandlers(error, event, session, user) {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error, event, session, user);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.authStateSynchronizer = new AuthStateSynchronizer();
    });
  } else {
    window.authStateSynchronizer = new AuthStateSynchronizer();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthStateSynchronizer;
}