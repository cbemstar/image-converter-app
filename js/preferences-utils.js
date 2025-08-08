/**
 * PreferencesUtils - Utility functions for managing user preferences across tools
 * Provides easy-to-use functions for saving and loading tool-specific preferences
 */

class PreferencesUtils {
  constructor(profileManager) {
    this.profileManager = profileManager || window.profileManager;
    this.cache = new Map();
    this.debounceTimers = new Map();
  }

  /**
   * Load preferences for a specific tool
   */
  async loadPreferences(toolType, defaults = {}) {
    try {
      if (!this.profileManager) {
        console.warn('ProfileManager not available, using localStorage fallback');
        return this.loadFromLocalStorage(toolType, defaults);
      }

      // Check cache first
      const cacheKey = `${toolType}_prefs`;
      if (this.cache.has(cacheKey)) {
        return { ...defaults, ...this.cache.get(cacheKey) };
      }

      const preferences = await this.profileManager.getUserPreferences(toolType);
      const mergedPrefs = { ...defaults, ...preferences };
      
      // Cache the result
      this.cache.set(cacheKey, preferences);
      
      return mergedPrefs;

    } catch (error) {
      console.error('Error loading preferences:', error);
      return this.loadFromLocalStorage(toolType, defaults);
    }
  }

  /**
   * Save preferences for a specific tool
   */
  async savePreferences(toolType, preferences, options = {}) {
    try {
      const { debounce = 1000, merge = true } = options;

      if (!this.profileManager) {
        console.warn('ProfileManager not available, using localStorage fallback');
        return this.saveToLocalStorage(toolType, preferences, merge);
      }

      // Debounce saves to avoid too many API calls
      if (debounce > 0) {
        return this.debouncedSave(toolType, preferences, merge, debounce);
      }

      let finalPreferences = preferences;
      
      if (merge) {
        const existing = await this.profileManager.getUserPreferences(toolType);
        finalPreferences = { ...existing, ...preferences };
      }

      await this.profileManager.saveUserPreferences(toolType, finalPreferences);
      
      // Update cache
      const cacheKey = `${toolType}_prefs`;
      this.cache.set(cacheKey, finalPreferences);
      
      return finalPreferences;

    } catch (error) {
      console.error('Error saving preferences:', error);
      return this.saveToLocalStorage(toolType, preferences, merge);
    }
  }

  /**
   * Debounced save to prevent too many API calls
   */
  debouncedSave(toolType, preferences, merge, delay) {
    return new Promise((resolve, reject) => {
      // Clear existing timer
      const timerId = this.debounceTimers.get(toolType);
      if (timerId) {
        clearTimeout(timerId);
      }

      // Set new timer
      const newTimerId = setTimeout(async () => {
        try {
          const result = await this.savePreferences(toolType, preferences, { 
            debounce: 0, 
            merge 
          });
          this.debounceTimers.delete(toolType);
          resolve(result);
        } catch (error) {
          this.debounceTimers.delete(toolType);
          reject(error);
        }
      }, delay);

      this.debounceTimers.set(toolType, newTimerId);
    });
  }

  /**
   * Update a single preference value
   */
  async updatePreference(toolType, key, value, options = {}) {
    try {
      const preferences = { [key]: value };
      return await this.savePreferences(toolType, preferences, { 
        merge: true, 
        ...options 
      });
    } catch (error) {
      console.error('Error updating preference:', error);
      throw error;
    }
  }

  /**
   * Get a single preference value
   */
  async getPreference(toolType, key, defaultValue = null) {
    try {
      const preferences = await this.loadPreferences(toolType);
      return preferences[key] !== undefined ? preferences[key] : defaultValue;
    } catch (error) {
      console.error('Error getting preference:', error);
      return defaultValue;
    }
  }

  /**
   * Remove a specific preference
   */
  async removePreference(toolType, key) {
    try {
      if (!this.profileManager) {
        return this.removeFromLocalStorage(toolType, key);
      }

      const existing = await this.profileManager.getUserPreferences(toolType);
      delete existing[key];
      
      await this.profileManager.saveUserPreferences(toolType, existing);
      
      // Update cache
      const cacheKey = `${toolType}_prefs`;
      this.cache.set(cacheKey, existing);
      
      return existing;

    } catch (error) {
      console.error('Error removing preference:', error);
      throw error;
    }
  }

  /**
   * Reset all preferences for a tool
   */
  async resetPreferences(toolType) {
    try {
      if (!this.profileManager) {
        return this.clearLocalStorage(toolType);
      }

      await this.profileManager.deleteUserPreferences(toolType);
      
      // Clear cache
      const cacheKey = `${toolType}_prefs`;
      this.cache.delete(cacheKey);
      
      return {};

    } catch (error) {
      console.error('Error resetting preferences:', error);
      throw error;
    }
  }

  /**
   * Create a preference binding for form elements
   */
  bindToElement(toolType, key, element, options = {}) {
    const { 
      event = 'change', 
      transform = null, 
      defaultValue = null,
      debounce = 1000 
    } = options;

    // Load initial value
    this.getPreference(toolType, key, defaultValue).then(value => {
      if (value !== null) {
        this.setElementValue(element, value, transform);
      }
    });

    // Save on change
    element.addEventListener(event, () => {
      const value = this.getElementValue(element, transform);
      this.updatePreference(toolType, key, value, { debounce });
    });
  }

  /**
   * Bind multiple preferences to form elements
   */
  bindToForm(toolType, bindings, options = {}) {
    const { debounce = 1000 } = options;

    // Load all preferences
    this.loadPreferences(toolType).then(preferences => {
      Object.entries(bindings).forEach(([key, config]) => {
        const element = typeof config === 'string' ? 
          document.querySelector(config) : config.element;
        
        if (!element) {
          console.warn(`Element not found for preference: ${key}`);
          return;
        }

        const value = preferences[key] !== undefined ? 
          preferences[key] : config.defaultValue;
        
        if (value !== undefined) {
          this.setElementValue(element, value, config.transform);
        }

        // Bind change event
        element.addEventListener(config.event || 'change', () => {
          const newValue = this.getElementValue(element, config.transform);
          this.updatePreference(toolType, key, newValue, { debounce });
        });
      });
    });
  }

  /**
   * Get value from form element
   */
  getElementValue(element, transform = null) {
    let value;
    
    switch (element.type) {
      case 'checkbox':
        value = element.checked;
        break;
      case 'radio':
        value = element.checked ? element.value : null;
        break;
      case 'number':
      case 'range':
        value = parseFloat(element.value);
        break;
      case 'select-multiple':
        value = Array.from(element.selectedOptions).map(opt => opt.value);
        break;
      default:
        value = element.value;
    }

    return transform ? transform(value) : value;
  }

  /**
   * Set value to form element
   */
  setElementValue(element, value, transform = null) {
    const finalValue = transform ? transform(value) : value;
    
    switch (element.type) {
      case 'checkbox':
        element.checked = Boolean(finalValue);
        break;
      case 'radio':
        element.checked = element.value === finalValue;
        break;
      case 'select-multiple':
        if (Array.isArray(finalValue)) {
          Array.from(element.options).forEach(opt => {
            opt.selected = finalValue.includes(opt.value);
          });
        }
        break;
      default:
        element.value = finalValue;
    }

    // Trigger change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Create a preferences object for easy tool integration
   */
  createToolPreferences(toolType, schema = {}) {
    return {
      load: (defaults = {}) => this.loadPreferences(toolType, { ...schema, ...defaults }),
      save: (prefs, options = {}) => this.savePreferences(toolType, prefs, options),
      get: (key, defaultValue = null) => this.getPreference(toolType, key, defaultValue),
      set: (key, value, options = {}) => this.updatePreference(toolType, key, value, options),
      remove: (key) => this.removePreference(toolType, key),
      reset: () => this.resetPreferences(toolType),
      bind: (key, element, options = {}) => this.bindToElement(toolType, key, element, options),
      bindForm: (bindings, options = {}) => this.bindToForm(toolType, bindings, options)
    };
  }

  /**
   * LocalStorage fallback methods
   */
  loadFromLocalStorage(toolType, defaults = {}) {
    try {
      const key = `preferences_${toolType}`;
      const stored = localStorage.getItem(key);
      const preferences = stored ? JSON.parse(stored) : {};
      return { ...defaults, ...preferences };
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return defaults;
    }
  }

  saveToLocalStorage(toolType, preferences, merge = true) {
    try {
      const key = `preferences_${toolType}`;
      let finalPreferences = preferences;
      
      if (merge) {
        const existing = this.loadFromLocalStorage(toolType);
        finalPreferences = { ...existing, ...preferences };
      }
      
      localStorage.setItem(key, JSON.stringify(finalPreferences));
      return finalPreferences;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      throw error;
    }
  }

  removeFromLocalStorage(toolType, key) {
    try {
      const existing = this.loadFromLocalStorage(toolType);
      delete existing[key];
      return this.saveToLocalStorage(toolType, existing, false);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      throw error;
    }
  }

  clearLocalStorage(toolType) {
    try {
      const key = `preferences_${toolType}`;
      localStorage.removeItem(key);
      return {};
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      throw error;
    }
  }

  /**
   * Clear all cached preferences
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global utility functions
window.createToolPreferences = function(toolType, schema = {}) {
  if (!window.preferencesUtils) {
    window.preferencesUtils = new PreferencesUtils();
  }
  return window.preferencesUtils.createToolPreferences(toolType, schema);
};

window.loadToolPreferences = async function(toolType, defaults = {}) {
  if (!window.preferencesUtils) {
    window.preferencesUtils = new PreferencesUtils();
  }
  return await window.preferencesUtils.loadPreferences(toolType, defaults);
};

window.saveToolPreferences = async function(toolType, preferences, options = {}) {
  if (!window.preferencesUtils) {
    window.preferencesUtils = new PreferencesUtils();
  }
  return await window.preferencesUtils.savePreferences(toolType, preferences, options);
};

// Create global instance when profile manager is available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.profileManager && !window.preferencesUtils) {
      window.preferencesUtils = new PreferencesUtils(window.profileManager);
    }
  });

  // Initialize immediately if profile manager is already available
  if (window.profileManager) {
    window.preferencesUtils = new PreferencesUtils(window.profileManager);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PreferencesUtils;
}