/**
 * Test suite for authentication redirect functionality
 * Tests the enhanced redirect handling for tool pages
 */

// Mock sessionStorage
const mockSessionStorage = {
  data: {},
  setItem: function(key, value) {
    this.data[key] = value;
  },
  getItem: function(key) {
    return this.data[key] || null;
  },
  removeItem: function(key) {
    delete this.data[key];
  },
  clear: function() {
    this.data = {};
  }
};

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3000/tools/image-converter/index.html',
  pathname: '/tools/image-converter/index.html'
};

// Mock window object
const mockWindow = {
  location: mockLocation,
  addEventListener: jest.fn(),
  supabaseClient: null,
  authManager: null
};

// Mock PathResolver
const mockPathResolver = {
  resolveAuthPath: (currentPath) => {
    // For /tools/image-converter/index.html, we need to go up 2 levels
    let normalizedPath = currentPath.replace(/^\/+/, '');
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      normalizedPath = normalizedPath.substring(0, lastSlashIndex);
    } else {
      normalizedPath = '';
    }
    
    if (!normalizedPath || normalizedPath === '') {
      return './auth.html';
    }
    
    const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
    const depth = pathParts.length;
    const basePath = depth > 0 ? '../'.repeat(depth) : './';
    return `${basePath}auth.html`;
  },
  resolveDashboardPath: (currentPath) => {
    let normalizedPath = currentPath.replace(/^\/+/, '');
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      normalizedPath = normalizedPath.substring(0, lastSlashIndex);
    } else {
      normalizedPath = '';
    }
    
    if (!normalizedPath || normalizedPath === '') {
      return './dashboard.html';
    }
    
    const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
    const depth = pathParts.length;
    const basePath = depth > 0 ? '../'.repeat(depth) : './';
    return `${basePath}dashboard.html`;
  }
};

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    onAuthStateChange: jest.fn(),
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn()
  }
};

// Mock DOM elements
const mockDocument = {
  getElementById: jest.fn(),
  querySelectorAll: jest.fn().mockReturnValue([])
};

describe('AuthManager Redirect Functionality', () => {
  let authManager;
  
  beforeEach(() => {
    // Reset mocks
    mockSessionStorage.clear();
    global.sessionStorage = mockSessionStorage;
    global.window = mockWindow;
    global.document = mockDocument;
    global.PathResolver = mockPathResolver;
    global.setTimeout = jest.fn((callback) => callback());
    
    // Import and create AuthManager instance
    const AuthManager = require('../js/auth-manager.js');
    authManager = new AuthManager({ getClient: () => mockSupabaseClient });
  });

  describe('storeToolPageForRedirect', () => {
    test('should store current tool page URL in sessionStorage', () => {
      const testUrl = 'http://localhost:3000/tools/image-converter/index.html';
      
      authManager.storeToolPageForRedirect(testUrl);
      
      expect(mockSessionStorage.getItem('auth_redirect')).toBe(testUrl);
    });

    test('should use current location if no URL provided', () => {
      authManager.storeToolPageForRedirect();
      
      expect(mockSessionStorage.getItem('auth_redirect')).toBe(mockLocation.href);
    });
  });

  describe('preserveToolPageState', () => {
    test('should preserve form input values', () => {
      const mockInput = {
        id: 'test-input',
        value: 'test-value',
        type: 'text'
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockInput]);
      
      authManager.preserveToolPageState();
      
      const storedState = JSON.parse(mockSessionStorage.getItem('tool_page_state'));
      expect(storedState['test-input']).toEqual({
        value: 'test-value',
        type: 'text'
      });
    });

    test('should handle file input metadata', () => {
      const mockFileInput = {
        id: 'file-input',
        type: 'file',
        files: [
          { name: 'test1.jpg' },
          { name: 'test2.png' }
        ]
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockFileInput]);
      
      authManager.preserveToolPageState();
      
      const storedState = JSON.parse(mockSessionStorage.getItem('tool_page_state'));
      expect(storedState['file-input_files']).toEqual({
        count: 2,
        names: ['test1.jpg', 'test2.png']
      });
    });
  });

  describe('restoreToolPageState', () => {
    test('should restore form input values', () => {
      const mockInput = {
        value: '',
        dispatchEvent: jest.fn()
      };
      
      mockDocument.getElementById.mockReturnValue(mockInput);
      
      const testState = {
        'test-input': {
          value: 'restored-value',
          type: 'text'
        }
      };
      
      mockSessionStorage.setItem('tool_page_state', JSON.stringify(testState));
      
      authManager.restoreToolPageState();
      
      expect(mockInput.value).toBe('restored-value');
      expect(mockInput.dispatchEvent).toHaveBeenCalled();
    });

    test('should clean up stored state after restoration', () => {
      const testState = { 'test-input': { value: 'test', type: 'text' } };
      mockSessionStorage.setItem('tool_page_state', JSON.stringify(testState));
      
      authManager.restoreToolPageState();
      
      expect(mockSessionStorage.getItem('tool_page_state')).toBeNull();
    });
  });

  describe('handleAuthRedirect', () => {
    test('should redirect to stored URL and clear it', (done) => {
      const testUrl = 'http://localhost:3000/tools/pdf-merger/index.html';
      mockSessionStorage.setItem('auth_redirect', testUrl);
      
      // Mock setTimeout to capture the redirect
      global.setTimeout = jest.fn((callback) => {
        callback();
        expect(mockLocation.href).toBe(testUrl);
        expect(mockSessionStorage.getItem('auth_redirect')).toBeNull();
        done();
      });
      
      authManager.handleAuthRedirect();
    });

    test('should redirect to dashboard if on auth page with no stored redirect', () => {
      mockLocation.pathname = '/auth.html';
      
      global.setTimeout = jest.fn();
      
      authManager.handleAuthRedirect();
      
      expect(mockLocation.href).toBe('./dashboard.html');
    });

    test('should restore tool state if already on correct page', () => {
      const restoreSpy = jest.spyOn(authManager, 'restoreToolPageState');
      
      // No redirect URL stored, and not on auth page
      mockWindow.location.pathname = '/tools/image-converter/index.html';
      
      authManager.handleAuthRedirect();
      
      expect(restoreSpy).toHaveBeenCalled();
    });
  });

  describe('requireAuth', () => {
    test('should store current page and redirect to auth when not authenticated', () => {
      // Reset location to tool page
      mockWindow.location.href = 'http://localhost:3000/tools/image-converter/index.html';
      mockWindow.location.pathname = '/tools/image-converter/index.html';
      
      authManager.currentUser = null;
      authManager.currentSession = null;
      
      const result = authManager.requireAuth();
      
      expect(result).toBe(false);
      expect(mockSessionStorage.getItem('auth_redirect')).toBe('http://localhost:3000/tools/image-converter/index.html');
      expect(mockWindow.location.href).toBe('../../auth.html');
    });

    test('should return true when user is authenticated', () => {
      authManager.currentUser = { id: 'test-user' };
      authManager.currentSession = { access_token: 'test-token' };
      
      const result = authManager.requireAuth();
      
      expect(result).toBe(true);
    });
  });
});