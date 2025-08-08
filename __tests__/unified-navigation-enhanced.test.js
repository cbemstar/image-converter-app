/**
 * Tests for Enhanced UnifiedNavigation with PathResolver integration
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');

// Set up DOM
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <nav class="bg-background shadow-md border-b border-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center gap-4">
          <button id="sidebar-toggle" class="btn btn-sm">
            <i class="fas fa-bars"></i>
          </button>
          <a href="./index.html" class="flex items-center gap-2">
            <span class="text-foreground text-xl font-bold">reformately</span>
          </a>
        </div>
        <div class="flex items-center gap-2">
          <button id="theme-toggle" class="btn btn-outline btn-sm">
            <span id="theme-toggle-icon">🌙</span>
          </button>
        </div>
      </div>
    </div>
  </nav>
</body>
</html>
`, { url: 'http://localhost/tools/image-converter/index.html' });

global.window = dom.window;
global.document = dom.window.document;
global.location = dom.window.location;

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  group: jest.fn(),
  groupEnd: jest.fn()
};

// Load PathResolver
const PathResolver = require('../js/path-resolver.js');
global.PathResolver = PathResolver;

// Load UnifiedNavigation
const UnifiedNavigation = require('../js/unified-navigation.js');

// Mock AuthManager
global.authManager = {
  isAuthenticated: () => false,
  getCurrentUser: () => null,
  addAuthStateListener: jest.fn()
};

describe('Enhanced UnifiedNavigation with PathResolver', () => {
  let unifiedNav;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <nav class="bg-background shadow-md border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center gap-4">
              <button id="sidebar-toggle" class="btn btn-sm">
                <i class="fas fa-bars"></i>
              </button>
              <a href="./index.html" class="flex items-center gap-2">
                <span class="text-foreground text-xl font-bold">reformately</span>
              </a>
            </div>
            <div class="flex items-center gap-2">
              <button id="theme-toggle" class="btn btn-outline btn-sm">
                <span id="theme-toggle-icon">🌙</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    `;

    // Set location for tool page
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/tools/image-converter/index.html',
        hostname: 'localhost'
      },
      writable: true
    });

    unifiedNav = new UnifiedNavigation();
  });

  describe('getResolvedPathsWithValidation', () => {
    test('should return validated paths using PathResolver', () => {
      const paths = unifiedNav.getResolvedPathsWithValidation();
      
      expect(paths).toHaveProperty('auth');
      expect(paths).toHaveProperty('dashboard');
      expect(paths).toHaveProperty('profile');
      expect(paths).toHaveProperty('home');
      
      // Verify paths are correct for tool page depth
      expect(paths.auth).toBe('../../auth.html');
      expect(paths.dashboard).toBe('../../dashboard.html');
      expect(paths.profile).toBe('../../profile.html');
      expect(paths.home).toBe('../../index.html');
    });

    test('should handle PathResolver unavailable gracefully', () => {
      // Temporarily remove PathResolver
      const originalPathResolver = global.PathResolver;
      delete global.PathResolver;

      const paths = unifiedNav.getResolvedPathsWithValidation();
      
      expect(paths).toHaveProperty('auth');
      expect(paths).toHaveProperty('dashboard');
      expect(paths).toHaveProperty('profile');
      
      // Restore PathResolver
      global.PathResolver = originalPathResolver;
    });
  });

  describe('validateAndCorrectPaths', () => {
    test('should validate correct paths', () => {
      const validPaths = {
        auth: '../../auth.html',
        dashboard: '../../dashboard.html',
        profile: '../../profile.html'
      };

      const result = unifiedNav.validateAndCorrectPaths(validPaths);
      
      expect(result.auth).toBe('../../auth.html');
      expect(result.dashboard).toBe('../../dashboard.html');
      expect(result.profile).toBe('../../profile.html');
    });

    test('should correct invalid paths', () => {
      const invalidPaths = {
        auth: '/auth.html', // Absolute path - invalid
        dashboard: 'dashboard.html', // Missing relative prefix
        profile: '../../profile.html' // This one is correct
      };

      const result = unifiedNav.validateAndCorrectPaths(invalidPaths);
      
      // Should correct the invalid paths
      expect(result.auth).toBe('../../auth.html');
      expect(result.dashboard).toBe('../../dashboard.html');
      expect(result.profile).toBe('../../profile.html');
    });
  });

  describe('isValidNavigationPath', () => {
    test('should validate correct relative paths', () => {
      const currentPath = '/tools/image-converter/index.html';
      
      expect(unifiedNav.isValidNavigationPath('../../auth.html', currentPath)).toBe(true);
      expect(unifiedNav.isValidNavigationPath('../../dashboard.html', currentPath)).toBe(true);
      expect(unifiedNav.isValidNavigationPath('./index.html', currentPath)).toBe(true);
    });

    test('should reject invalid paths', () => {
      const currentPath = '/tools/image-converter/index.html';
      
      expect(unifiedNav.isValidNavigationPath('/auth.html', currentPath)).toBe(false); // Absolute
      expect(unifiedNav.isValidNavigationPath('auth', currentPath)).toBe(false); // No extension
      expect(unifiedNav.isValidNavigationPath('', currentPath)).toBe(false); // Empty
      expect(unifiedNav.isValidNavigationPath(null, currentPath)).toBe(false); // Null
    });
  });

  describe('correctNavigationPath', () => {
    test('should correct auth path', () => {
      const currentPath = '/tools/image-converter/index.html';
      const corrected = unifiedNav.correctNavigationPath('auth', currentPath);
      
      expect(corrected).toBe('../../auth.html');
    });

    test('should correct dashboard path', () => {
      const currentPath = '/tools/image-converter/index.html';
      const corrected = unifiedNav.correctNavigationPath('dashboard', currentPath);
      
      expect(corrected).toBe('../../dashboard.html');
    });

    test('should correct profile path', () => {
      const currentPath = '/tools/image-converter/index.html';
      const corrected = unifiedNav.correctNavigationPath('profile', currentPath);
      
      expect(corrected).toBe('../../profile.html');
    });

    test('should return null for unknown path types', () => {
      const currentPath = '/tools/image-converter/index.html';
      const corrected = unifiedNav.correctNavigationPath('unknown', currentPath);
      
      expect(corrected).toBe(null);
    });
  });

  describe('generateAuthElementsHTML', () => {
    test('should generate HTML with correct paths', () => {
      const resolvedPaths = {
        auth: '../../auth.html',
        dashboard: '../../dashboard.html',
        profile: '../../profile.html'
      };

      const html = unifiedNav.generateAuthElementsHTML(resolvedPaths);
      
      expect(html).toContain('href="../../auth.html"');
      expect(html).toContain('href="../../dashboard.html"');
      expect(html).toContain('href="../../profile.html"');
      expect(html).toContain('data-nav-link="auth"');
      expect(html).toContain('data-nav-link="dashboard"');
      expect(html).toContain('data-nav-link="profile"');
    });

    test('should handle missing paths with fallbacks', () => {
      const incompletePaths = {
        auth: '../../auth.html'
        // Missing dashboard and profile
      };

      const html = unifiedNav.generateAuthElementsHTML(incompletePaths);
      
      // Should still generate HTML with fallback paths
      expect(html).toContain('href="../../auth.html"');
      expect(html).toContain('data-nav-link="dashboard"');
      expect(html).toContain('data-nav-link="profile"');
    });
  });

  describe('addAuthElementsToExistingNav', () => {
    test('should add auth elements to navigation', () => {
      unifiedNav.addAuthElementsToExistingNav();
      
      // Check that auth elements were added
      const guestElements = document.querySelectorAll('[data-guest-only]');
      const authElements = document.querySelectorAll('[data-auth-required]');
      
      expect(guestElements.length).toBeGreaterThan(0);
      expect(authElements.length).toBeGreaterThan(0);
      
      // Check that paths are correct
      const authLink = document.querySelector('a[data-nav-link="auth"]');
      const dashboardLink = document.querySelector('a[data-nav-link="dashboard"]');
      const profileLink = document.querySelector('a[data-nav-link="profile"]');
      
      expect(authLink?.getAttribute('href')).toBe('../../auth.html');
      expect(dashboardLink?.getAttribute('href')).toBe('../../dashboard.html');
      expect(profileLink?.getAttribute('href')).toBe('../../profile.html');
    });

    test('should handle missing navigation gracefully', () => {
      // Remove navigation element
      document.body.innerHTML = '<div>No nav here</div>';
      
      // Should not throw error
      expect(() => {
        unifiedNav.addAuthElementsToExistingNav();
      }).not.toThrow();
    });
  });

  describe('updateExistingNavigationPaths', () => {
    test('should update existing navigation links', () => {
      // Add some existing links with incorrect paths
      document.body.innerHTML += `
        <a href="/auth.html" data-nav-link="auth">Sign In</a>
        <a href="dashboard.html" data-nav-link="dashboard">Dashboard</a>
        <a href="../profile.html" data-nav-link="profile">Profile</a>
      `;

      unifiedNav.updateExistingNavigationPaths();

      const authLink = document.querySelector('a[data-nav-link="auth"]');
      const dashboardLink = document.querySelector('a[data-nav-link="dashboard"]');
      const profileLink = document.querySelector('a[data-nav-link="profile"]');

      expect(authLink?.getAttribute('href')).toBe('../../auth.html');
      expect(dashboardLink?.getAttribute('href')).toBe('../../dashboard.html');
      expect(profileLink?.getAttribute('href')).toBe('../../profile.html');
    });
  });
});