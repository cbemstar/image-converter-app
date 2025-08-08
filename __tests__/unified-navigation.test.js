/**
 * Tests for UnifiedNavigation path resolution enhancements
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

// Mock console methods to avoid noise in tests
global.console = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  group: jest.fn(),
  groupEnd: jest.fn()
};

// Import the classes
const PathResolver = require('../js/path-resolver.js');
const UnifiedNavigation = require('../js/unified-navigation.js');

describe('UnifiedNavigation Path Resolution', () => {
  let unifiedNav;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Make PathResolver available globally
    global.PathResolver = PathResolver;
    global.window.PathResolver = PathResolver;
    
    // Mock window.location
    delete window.location;
    window.location = {
      pathname: '/tools/image-converter/index.html',
      hostname: 'localhost'
    };

    // Mock authManager
    global.window.authManager = {
      isAuthenticated: () => false,
      getCurrentUser: () => null,
      addAuthStateListener: jest.fn()
    };

    unifiedNav = new UnifiedNavigation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getResolvedPaths', () => {
    test('should use PathResolver when available', () => {
      const paths = unifiedNav.getResolvedPaths();
      
      expect(paths).toHaveProperty('auth');
      expect(paths).toHaveProperty('dashboard');
      expect(paths).toHaveProperty('profile');
      expect(paths).toHaveProperty('home');
      
      // For a tool at depth 2, paths should have ../../
      expect(paths.auth).toBe('../../auth.html');
      expect(paths.dashboard).toBe('../../dashboard.html');
      expect(paths.profile).toBe('../../profile.html');
    });

    test('should use fallback when PathResolver not available', () => {
      // Remove PathResolver
      delete global.PathResolver;
      delete global.window.PathResolver;
      
      const paths = unifiedNav.getResolvedPaths();
      
      expect(paths).toHaveProperty('auth');
      expect(paths).toHaveProperty('dashboard');
      expect(paths).toHaveProperty('profile');
      expect(paths).toHaveProperty('home');
      
      // Fallback should also calculate correct paths
      expect(paths.auth).toBe('../../auth.html');
      expect(paths.dashboard).toBe('../../dashboard.html');
    });
  });

  describe('validateNavigationPaths', () => {
    test('should validate correct paths', () => {
      const validPaths = {
        auth: '../../auth.html',
        dashboard: '../../dashboard.html',
        profile: '../../profile.html'
      };
      
      const isValid = unifiedNav.validateNavigationPaths(validPaths);
      expect(isValid).toBe(true);
    });

    test('should reject invalid paths', () => {
      const invalidPaths = {
        auth: '/auth.html', // absolute path
        dashboard: '../../dashboard.html',
        profile: '../../profile.html'
      };
      
      const isValid = unifiedNav.validateNavigationPaths(invalidPaths);
      expect(isValid).toBe(false);
    });

    test('should reject paths without .html extension', () => {
      const invalidPaths = {
        auth: '../../auth',
        dashboard: '../../dashboard.html',
        profile: '../../profile.html'
      };
      
      const isValid = unifiedNav.validateNavigationPaths(invalidPaths);
      expect(isValid).toBe(false);
    });

    test('should reject missing paths', () => {
      const incompletePaths = {
        auth: '../../auth.html',
        dashboard: '../../dashboard.html'
        // missing profile
      };
      
      const isValid = unifiedNav.validateNavigationPaths(incompletePaths);
      expect(isValid).toBe(false);
    });
  });

  describe('addAuthElementsToExistingNav', () => {
    beforeEach(() => {
      // Create a basic navigation structure
      document.body.innerHTML = `
        <nav>
          <div class="flex justify-between">
            <div>Logo</div>
            <div class="flex items-center gap-2">
              <button id="theme-toggle">Theme</button>
            </div>
          </div>
        </nav>
      `;
    });

    test('should add auth elements with correct paths', () => {
      unifiedNav.addAuthElementsToExistingNav();
      
      // Check that sign-in link uses correct path
      const signInLink = document.querySelector('[data-guest-only] a');
      expect(signInLink).toBeTruthy();
      expect(signInLink.href).toBe('../../auth.html');
      
      // Check that dashboard link uses correct path
      const dashboardLink = document.querySelector('[data-auth-required] a[href*="dashboard"]');
      expect(dashboardLink).toBeTruthy();
      expect(dashboardLink.href).toBe('../../dashboard.html');
      
      // Check that profile link uses correct path
      const profileLink = document.querySelector('[data-auth-required] a[href*="profile"]');
      expect(profileLink).toBeTruthy();
      expect(profileLink.href).toBe('../../profile.html');
    });

    test('should use fallback paths when validation fails', () => {
      // Mock validation to fail
      jest.spyOn(unifiedNav, 'validateNavigationPaths').mockReturnValue(false);
      
      unifiedNav.addAuthElementsToExistingNav();
      
      // Should still add elements with fallback paths
      const signInLink = document.querySelector('[data-guest-only] a');
      expect(signInLink).toBeTruthy();
      expect(signInLink.href).toBe('./auth.html');
    });
  });

  describe('updateExistingNavigationPaths', () => {
    beforeEach(() => {
      // Create navigation with hardcoded paths
      document.body.innerHTML = `
        <nav>
          <a href="/auth.html">Sign In</a>
          <a href="/dashboard.html">Dashboard</a>
          <a href="/profile.html">Profile</a>
          <a href="/">Home</a>
        </nav>
      `;
    });

    test('should update existing navigation links with correct relative paths', () => {
      unifiedNav.updateExistingNavigationPaths();
      
      const authLink = document.querySelector('a[href*="auth"]');
      const dashboardLink = document.querySelector('a[href*="dashboard"]');
      const profileLink = document.querySelector('a[href*="profile"]');
      const homeLink = document.querySelector('a[href*="index"]');
      
      expect(authLink.href).toBe('../../auth.html');
      expect(dashboardLink.href).toBe('../../dashboard.html');
      expect(profileLink.href).toBe('../../profile.html');
      expect(homeLink.href).toBe('../../index.html');
    });
  });

  describe('calculateFallbackPaths', () => {
    test('should calculate correct fallback paths for different depths', () => {
      // Test root level
      window.location.pathname = '/index.html';
      let paths = unifiedNav.calculateFallbackPaths();
      expect(paths.auth).toBe('./auth.html');
      
      // Test one level deep
      window.location.pathname = '/tools/index.html';
      paths = unifiedNav.calculateFallbackPaths();
      expect(paths.auth).toBe('../auth.html');
      
      // Test two levels deep
      window.location.pathname = '/tools/image-converter/index.html';
      paths = unifiedNav.calculateFallbackPaths();
      expect(paths.auth).toBe('../../auth.html');
    });
  });
});