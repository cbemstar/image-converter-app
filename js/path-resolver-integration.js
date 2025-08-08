/**
 * Integration example showing how to use PathResolver with the existing navigation system
 * This demonstrates how the PathResolver can be integrated into unified-navigation.js
 */

// Example of how to integrate PathResolver into the existing navigation system
class NavigationPathHelper {
  /**
   * Update navigation links using PathResolver
   * This method can be called from unified-navigation.js to ensure correct paths
   */
  static updateNavigationPaths() {
    if (!window.PathResolver) {
      console.warn('PathResolver not available');
      return;
    }

    const currentPath = window.location.pathname;
    const paths = window.PathResolver.getAllPaths(currentPath);

    if (!paths.isValid) {
      console.warn('Invalid paths detected:', paths.validation);
      return;
    }

    // Update auth links
    const authLinks = document.querySelectorAll('a[href*="auth.html"]');
    authLinks.forEach(link => {
      link.href = paths.paths.auth;
    });

    // Update dashboard links
    const dashboardLinks = document.querySelectorAll('a[href*="dashboard.html"]');
    dashboardLinks.forEach(link => {
      link.href = paths.paths.dashboard;
    });

    // Update profile links
    const profileLinks = document.querySelectorAll('a[href*="profile.html"]');
    profileLinks.forEach(link => {
      link.href = paths.paths.profile;
    });

    // Update home/logo links
    const homeLinks = document.querySelectorAll('a[href*="index.html"], a[href="/"], a[href="./"]');
    homeLinks.forEach(link => {
      link.href = paths.paths.home;
    });

    console.log('Navigation paths updated using PathResolver:', paths.paths);
  }

  /**
   * Validate current navigation links
   * Useful for debugging navigation issues
   */
  static validateCurrentNavigation() {
    if (!window.PathResolver) {
      console.warn('PathResolver not available');
      return false;
    }

    const currentPath = window.location.pathname;
    const issues = [];

    // Check auth links
    const authLinks = document.querySelectorAll('a[href*="auth.html"]');
    const expectedAuthPath = window.PathResolver.resolveAuthPath(currentPath);
    authLinks.forEach((link, index) => {
      if (link.href !== expectedAuthPath && !link.href.endsWith(expectedAuthPath)) {
        issues.push(`Auth link ${index}: expected ${expectedAuthPath}, got ${link.href}`);
      }
    });

    // Check dashboard links
    const dashboardLinks = document.querySelectorAll('a[href*="dashboard.html"]');
    const expectedDashboardPath = window.PathResolver.resolveDashboardPath(currentPath);
    dashboardLinks.forEach((link, index) => {
      if (link.href !== expectedDashboardPath && !link.href.endsWith(expectedDashboardPath)) {
        issues.push(`Dashboard link ${index}: expected ${expectedDashboardPath}, got ${link.href}`);
      }
    });

    // Check profile links
    const profileLinks = document.querySelectorAll('a[href*="profile.html"]');
    const expectedProfilePath = window.PathResolver.resolveProfilePath(currentPath);
    profileLinks.forEach((link, index) => {
      if (link.href !== expectedProfilePath && !link.href.endsWith(expectedProfilePath)) {
        issues.push(`Profile link ${index}: expected ${expectedProfilePath}, got ${link.href}`);
      }
    });

    if (issues.length > 0) {
      console.warn('Navigation validation issues found:', issues);
      return false;
    }

    console.log('All navigation links are correctly resolved');
    return true;
  }

  /**
   * Get debug information about current navigation state
   */
  static getNavigationDebugInfo() {
    if (!window.PathResolver) {
      return { error: 'PathResolver not available' };
    }

    const currentPath = window.location.pathname;
    const pathInfo = window.PathResolver.getAllPaths(currentPath);
    
    return {
      currentPath,
      depth: window.PathResolver.getCurrentDepth(currentPath),
      isToolPage: window.PathResolver.isToolPage(currentPath),
      toolName: window.PathResolver.getToolName(currentPath),
      resolvedPaths: pathInfo.paths,
      pathValidation: pathInfo.validation,
      allPathsValid: pathInfo.isValid,
      navigationLinks: {
        auth: Array.from(document.querySelectorAll('a[href*="auth.html"]')).map(l => l.href),
        dashboard: Array.from(document.querySelectorAll('a[href*="dashboard.html"]')).map(l => l.href),
        profile: Array.from(document.querySelectorAll('a[href*="profile.html"]')).map(l => l.href),
        home: Array.from(document.querySelectorAll('a[href*="index.html"], a[href="/"]')).map(l => l.href)
      }
    };
  }
}

// Make available globally for debugging and integration
if (typeof window !== 'undefined') {
  window.NavigationPathHelper = NavigationPathHelper;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NavigationPathHelper;
}