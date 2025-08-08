/**
 * Tests for PathResolver utility
 * Verifies correct path calculation for different tool locations and directory depths
 */

// Import PathResolver (assuming Node.js environment for testing)
const PathResolver = require('../js/path-resolver.js');

describe('PathResolver', () => {
  describe('getBasePath', () => {
    test('should return ./ for root level pages', () => {
      expect(PathResolver.getBasePath('/index.html')).toBe('./');
      expect(PathResolver.getBasePath('/auth.html')).toBe('./');
      expect(PathResolver.getBasePath('/dashboard.html')).toBe('./');
      expect(PathResolver.getBasePath('/')).toBe('./');
    });

    test('should return ../ for one level deep', () => {
      expect(PathResolver.getBasePath('/tools/index.html')).toBe('../');
      expect(PathResolver.getBasePath('/admin/dashboard.html')).toBe('../');
    });

    test('should return ../../ for two levels deep (tool pages)', () => {
      expect(PathResolver.getBasePath('/tools/image-converter/index.html')).toBe('../../');
      expect(PathResolver.getBasePath('/tools/pdf-merger/index.html')).toBe('../../');
      expect(PathResolver.getBasePath('/tools/background-remover/index.html')).toBe('../../');
    });

    test('should return ../../../ for three levels deep', () => {
      expect(PathResolver.getBasePath('/tools/layout-tool/modules/test.html')).toBe('../../../');
    });

    test('should handle paths without leading slash', () => {
      expect(PathResolver.getBasePath('tools/image-converter/index.html')).toBe('../../');
      expect(PathResolver.getBasePath('index.html')).toBe('./');
    });
  });

  describe('resolveAuthPath', () => {
    test('should resolve auth path for root level pages', () => {
      expect(PathResolver.resolveAuthPath('/index.html')).toBe('./auth.html');
      expect(PathResolver.resolveAuthPath('/dashboard.html')).toBe('./auth.html');
    });

    test('should resolve auth path for tool pages', () => {
      expect(PathResolver.resolveAuthPath('/tools/image-converter/index.html')).toBe('../../auth.html');
      expect(PathResolver.resolveAuthPath('/tools/pdf-merger/index.html')).toBe('../../auth.html');
    });

    test('should resolve auth path for deeper nested pages', () => {
      expect(PathResolver.resolveAuthPath('/tools/layout-tool/modules/test.html')).toBe('../../../auth.html');
    });
  });

  describe('resolveDashboardPath', () => {
    test('should resolve dashboard path for root level pages', () => {
      expect(PathResolver.resolveDashboardPath('/index.html')).toBe('./dashboard.html');
      expect(PathResolver.resolveDashboardPath('/auth.html')).toBe('./dashboard.html');
    });

    test('should resolve dashboard path for tool pages', () => {
      expect(PathResolver.resolveDashboardPath('/tools/image-converter/index.html')).toBe('../../dashboard.html');
      expect(PathResolver.resolveDashboardPath('/tools/qr-generator/index.html')).toBe('../../dashboard.html');
    });
  });

  describe('resolveProfilePath', () => {
    test('should resolve profile path for root level pages', () => {
      expect(PathResolver.resolveProfilePath('/index.html')).toBe('./profile.html');
    });

    test('should resolve profile path for tool pages', () => {
      expect(PathResolver.resolveProfilePath('/tools/image-converter/index.html')).toBe('../../profile.html');
    });
  });

  describe('resolveHomePath', () => {
    test('should resolve home path for tool pages', () => {
      expect(PathResolver.resolveHomePath('/tools/image-converter/index.html')).toBe('../../index.html');
    });

    test('should resolve home path for root pages', () => {
      expect(PathResolver.resolveHomePath('/auth.html')).toBe('./index.html');
    });
  });

  describe('resolveRootFile', () => {
    test('should resolve any root file for tool pages', () => {
      expect(PathResolver.resolveRootFile('pricing.html', '/tools/image-converter/index.html')).toBe('../../pricing.html');
      expect(PathResolver.resolveRootFile('contact.html', '/tools/pdf-merger/index.html')).toBe('../../contact.html');
    });

    test('should resolve any root file for root pages', () => {
      expect(PathResolver.resolveRootFile('pricing.html', '/auth.html')).toBe('./pricing.html');
    });
  });

  describe('validatePath', () => {
    test('should validate correct paths', () => {
      expect(PathResolver.validatePath('../../auth.html', '/tools/image-converter/index.html')).toBe(true);
      expect(PathResolver.validatePath('./dashboard.html', '/index.html')).toBe(true);
      expect(PathResolver.validatePath('../../../profile.html', '/tools/layout-tool/modules/test.html')).toBe(true);
    });

    test('should reject invalid paths', () => {
      expect(PathResolver.validatePath('/auth.html', '/tools/image-converter/index.html')).toBe(false); // absolute path
      expect(PathResolver.validatePath('', '/tools/image-converter/index.html')).toBe(false); // empty path
      expect(PathResolver.validatePath(null, '/tools/image-converter/index.html')).toBe(false); // null path
      expect(PathResolver.validatePath('auth', '/tools/image-converter/index.html')).toBe(false); // no extension
    });

    test('should validate depth consistency', () => {
      // Tool pages should use ../../ for root files
      expect(PathResolver.validatePath('../../auth.html', '/tools/image-converter/index.html')).toBe(true);
      expect(PathResolver.validatePath('../auth.html', '/tools/image-converter/index.html')).toBe(false); // wrong depth
      expect(PathResolver.validatePath('../../../auth.html', '/tools/image-converter/index.html')).toBe(false); // wrong depth
    });
  });

  describe('getCurrentDepth', () => {
    test('should calculate correct depth', () => {
      expect(PathResolver.getCurrentDepth('/index.html')).toBe(0);
      expect(PathResolver.getCurrentDepth('/tools/index.html')).toBe(1);
      expect(PathResolver.getCurrentDepth('/tools/image-converter/index.html')).toBe(2);
      expect(PathResolver.getCurrentDepth('/tools/layout-tool/modules/test.html')).toBe(3);
    });
  });

  describe('isToolPage', () => {
    test('should identify tool pages correctly', () => {
      expect(PathResolver.isToolPage('/tools/image-converter/index.html')).toBe(true);
      expect(PathResolver.isToolPage('/tools/pdf-merger/index.html')).toBe(true);
      expect(PathResolver.isToolPage('/index.html')).toBe(false);
      expect(PathResolver.isToolPage('/auth.html')).toBe(false);
      expect(PathResolver.isToolPage('/dashboard.html')).toBe(false);
    });
  });

  describe('getToolName', () => {
    test('should extract tool name from path', () => {
      expect(PathResolver.getToolName('/tools/image-converter/index.html')).toBe('image-converter');
      expect(PathResolver.getToolName('/tools/pdf-merger/index.html')).toBe('pdf-merger');
      expect(PathResolver.getToolName('/tools/background-remover/index.html')).toBe('background-remover');
    });

    test('should return null for non-tool pages', () => {
      expect(PathResolver.getToolName('/index.html')).toBe(null);
      expect(PathResolver.getToolName('/auth.html')).toBe(null);
      expect(PathResolver.getToolName('/dashboard.html')).toBe(null);
    });
  });

  describe('getAllPaths', () => {
    test('should return all paths with validation for tool pages', () => {
      const result = PathResolver.getAllPaths('/tools/image-converter/index.html');
      
      expect(result.paths.base).toBe('../../');
      expect(result.paths.auth).toBe('../../auth.html');
      expect(result.paths.dashboard).toBe('../../dashboard.html');
      expect(result.paths.profile).toBe('../../profile.html');
      expect(result.paths.home).toBe('../../index.html');
      
      expect(result.validation.auth).toBe(true);
      expect(result.validation.dashboard).toBe(true);
      expect(result.validation.profile).toBe(true);
      expect(result.validation.home).toBe(true);
      expect(result.isValid).toBe(true);
    });

    test('should return all paths with validation for root pages', () => {
      const result = PathResolver.getAllPaths('/index.html');
      
      expect(result.paths.base).toBe('./');
      expect(result.paths.auth).toBe('./auth.html');
      expect(result.paths.dashboard).toBe('./dashboard.html');
      expect(result.paths.profile).toBe('./profile.html');
      expect(result.paths.home).toBe('./index.html');
      
      expect(result.isValid).toBe(true);
    });
  });
});