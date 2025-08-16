/**
 * Authentication Loader
 * Lightweight script to load authentication on any page
 * Include this on every page that needs authentication
 */

(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    scriptsToLoad: [
      'js/public-config.js',
      'js/supabase-client.js',
      'js/auth-manager.js',
      'js/unified-navigation.js',
      'js/auth-state-sync.js',
      'js/auth-guards.js'
    ],
    loadTimeout: 10000 // 10 seconds
  };
  
  // Track loaded scripts
  let loadedScripts = 0;
  let totalScripts = CONFIG.scriptsToLoad.length;
  
  // Get base path for script loading
  function getBasePath() {
    const pathParts = window.location.pathname.split('/');
    const depth = pathParts.length - 2;
    return depth > 0 ? '../'.repeat(depth) : './';
  }
  
  // Load script with promise
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = getBasePath() + src;
      script.onload = () => {
        console.log('✅ Loaded:', src);
        resolve(src);
      };
      script.onerror = () => {
        console.error('❌ Failed to load:', src);
        reject(new Error(`Failed to load ${src}`));
      };
      
      // Add to head
      document.head.appendChild(script);
      
      // Timeout fallback
      setTimeout(() => {
        reject(new Error(`Timeout loading ${src}`));
      }, CONFIG.loadTimeout);
    });
  }
  
  // Load all authentication scripts
  async function loadAuthScripts() {
    try {
      console.log('🔄 Loading authentication scripts...');
      
      // Load scripts sequentially to ensure proper order
      for (const script of CONFIG.scriptsToLoad) {
        await loadScript(script);
        loadedScripts++;
      }
      
      console.log('✅ All authentication scripts loaded successfully');
      
      // Dispatch event when auth is ready
      document.dispatchEvent(new CustomEvent('authReady', {
        detail: { timestamp: Date.now() }
      }));
      
    } catch (error) {
      console.error('❌ Error loading authentication scripts:', error);
      
      // Dispatch error event
      document.dispatchEvent(new CustomEvent('authError', {
        detail: { error: error.message }
      }));
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAuthScripts);
  } else {
    loadAuthScripts();
  }
  
  // Provide global access to auth functions
  window.authLoader = {
    isLoaded: () => loadedScripts === totalScripts,
    getLoadedCount: () => loadedScripts,
    getTotalCount: () => totalScripts
  };
  
})();