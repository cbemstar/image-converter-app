/**
 * Path Resolution Utility for Navigation Links
 * Calculates correct relative paths based on current tool location
 * Handles different directory depths and validates path calculations
 */

class PathResolver {
  /**
   * Calculate the base path to root directory based on current location
   * @param {string} currentPath - Current page path (e.g., '/tools/image-converter/index.html')
   * @returns {string} - Relative path to root (e.g., '../../')
   */
  static getBasePath(currentPath = window.location.pathname) {
    // Normalize the path - remove leading slash and trailing filename
    let normalizedPath = currentPath.replace(/^\/+/, '');
    
    // Remove filename (everything after the last slash)
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      normalizedPath = normalizedPath.substring(0, lastSlashIndex);
    } else {
      // No slash found, this is a root-level file
      normalizedPath = '';
    }
    
    // If we're at root level, no base path needed
    if (!normalizedPath || normalizedPath === '') {
      return './';
    }
    
    // Count directory levels
    const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
    const depth = pathParts.length;
    
    // Generate relative path back to root
    return depth > 0 ? '../'.repeat(depth) : './';
  }

  /**
   * Resolve path to auth.html page
   * @param {string} currentPath - Current page path
   * @returns {string} - Relative path to auth.html
   */
  static resolveAuthPath(currentPath = window.location.pathname) {
    const basePath = this.getBasePath(currentPath);
    return `${basePath}auth.html`;
  }

  /**
   * Resolve path to dashboard.html page
   * @param {string} currentPath - Current page path
   * @returns {string} - Relative path to dashboard.html
   */
  static resolveDashboardPath(currentPath = window.location.pathname) {
    const basePath = this.getBasePath(currentPath);
    return `${basePath}dashboard.html`;
  }

  /**
   * Resolve path to profile.html page
   * @param {string} currentPath - Current page path
   * @returns {string} - Relative path to profile.html
   */
  static resolveProfilePath(currentPath = window.location.pathname) {
    const basePath = this.getBasePath(currentPath);
    return `${basePath}profile.html`;
  }

  /**
   * Resolve path to home/index page
   * @param {string} currentPath - Current page path
   * @returns {string} - Relative path to index.html
   */
  static resolveHomePath(currentPath = window.location.pathname) {
    const basePath = this.getBasePath(currentPath);
    return `${basePath}index.html`;
  }

  /**
   * Resolve path to any file at root level
   * @param {string} filename - Name of the file (e.g., 'pricing.html')
   * @param {string} currentPath - Current page path
   * @returns {string} - Relative path to the file
   */
  static resolveRootFile(filename, currentPath = window.location.pathname) {
    const basePath = this.getBasePath(currentPath);
    return `${basePath}${filename}`;
  }

  /**
   * Validate that a calculated path is correct
   * @param {string} calculatedPath - The path to validate
   * @param {string} currentPath - Current page path
   * @returns {boolean} - True if path appears valid
   */
  static validatePath(calculatedPath, currentPath = window.location.pathname) {
    try {
      // Basic validation checks
      if (!calculatedPath || typeof calculatedPath !== 'string') {
        return false;
      }

      // Check for proper relative path format
      if (calculatedPath.startsWith('/')) {
        // Absolute paths are not what we want for this use case
        return false;
      }

      // Check for proper file extension
      if (!calculatedPath.includes('.html')) {
        return false;
      }

      // Validate that the number of ../ matches expected depth
      const expectedDepth = this.getCurrentDepth(currentPath);
      const actualUpLevels = (calculatedPath.match(/\.\.\//g) || []).length;

      // For root files (files that should be at the root level), up levels should match depth
      if (calculatedPath.endsWith('.html')) {
        // Check if this is a root-level file by seeing if it's just ../+ followed by filename
        const rootFilePattern = /^(\.\.\/)*[^\/]+\.html$/;
        if (rootFilePattern.test(calculatedPath)) {
          return actualUpLevels === expectedDepth;
        }
      }

      return true;
    } catch (error) {
      console.warn('Path validation error:', error);
      return false;
    }
  }

  /**
   * Get all navigation paths for current location
   * @param {string} currentPath - Current page path
   * @returns {Object} - Object containing all resolved paths
   */
  static getAllPaths(currentPath = window.location.pathname) {
    const paths = {
      base: this.getBasePath(currentPath),
      auth: this.resolveAuthPath(currentPath),
      dashboard: this.resolveDashboardPath(currentPath),
      profile: this.resolveProfilePath(currentPath),
      home: this.resolveHomePath(currentPath)
    };

    // Validate all paths
    const validation = {
      auth: this.validatePath(paths.auth, currentPath),
      dashboard: this.validatePath(paths.dashboard, currentPath),
      profile: this.validatePath(paths.profile, currentPath),
      home: this.validatePath(paths.home, currentPath)
    };

    return {
      paths,
      validation,
      isValid: Object.values(validation).every(v => v)
    };
  }

  /**
   * Get current page depth (number of directory levels from root)
   * @param {string} currentPath - Current page path
   * @returns {number} - Directory depth
   */
  static getCurrentDepth(currentPath = window.location.pathname) {
    let normalizedPath = currentPath.replace(/^\/+/, '');
    
    // Remove filename (everything after the last slash)
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      normalizedPath = normalizedPath.substring(0, lastSlashIndex);
    } else {
      // No slash found, this is a root-level file
      normalizedPath = '';
    }
    
    if (!normalizedPath || normalizedPath === '') {
      return 0;
    }
    return normalizedPath.split('/').filter(part => part.length > 0).length;
  }

  /**
   * Check if current page is a tool page
   * @param {string} currentPath - Current page path
   * @returns {boolean} - True if this is a tool page
   */
  static isToolPage(currentPath = window.location.pathname) {
    return currentPath.includes('/tools/');
  }

  /**
   * Get tool name from path if this is a tool page
   * @param {string} currentPath - Current page path
   * @returns {string|null} - Tool name or null if not a tool page
   */
  static getToolName(currentPath = window.location.pathname) {
    const match = currentPath.match(/\/tools\/([^\/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Debug method to log path resolution information
   * @param {string} currentPath - Current page path
   */
  static debugPaths(currentPath = window.location.pathname) {
    const info = this.getAllPaths(currentPath);
    console.group('PathResolver Debug Info');
    console.log('Current Path:', currentPath);
    console.log('Depth:', this.getCurrentDepth(currentPath));
    console.log('Is Tool Page:', this.isToolPage(currentPath));
    console.log('Tool Name:', this.getToolName(currentPath));
    console.log('Base Path:', info.paths.base);
    console.log('Resolved Paths:', info.paths);
    console.log('Path Validation:', info.validation);
    console.log('All Paths Valid:', info.isValid);
    console.groupEnd();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PathResolver;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.PathResolver = PathResolver;
}