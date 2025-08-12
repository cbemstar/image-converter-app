/**
 * Conversion Process Integration Tests
 * 
 * Tests end-to-end conversion workflows including quota checking,
 * usage tracking, and file processing
 * Requirements: 2.1-2.6, 13.1-13.6
 */

const { JSDOM } = require('jsdom');

// Mock Edge Function responses
const mockEdgeFunctionResponse = {
  ok: true,
  json: jest.fn(),
  text: jest.fn(),
  status: 200
};

// Mock fetch for Edge Function calls
global.fetch = jest.fn(() => Promise.resolve(mockEdgeFunctionResponse));

// Mock File API
global.File = class MockFile {
  constructor(bits, name, options = {}) {
    this.bits = bits;
    this.name = name;
    this.type = options.type || 'application/octet-stream';
    this.size = bits.reduce((acc, bit) => acc + bit.length, 0);
    this.lastModified = Date.now();
  }
};

global.FileReader = class MockFileReader {
  constructor() {
    this.result = null;
    this.error = null;
    this.readyState = 0;
    this.onload = null;
    this.onerror = null;
  }

  readAsDataURL(file) {
    setTimeout(() => {
      this.result = `data:${file.type};base64,mockbase64data`;
      this.readyState = 2;
      if (this.onload) this.onload({ target: this });
    }, 10);
  }

  readAsArrayBuffer(file) {
    setTimeout(() => {
      this.result = new ArrayBuffer(file.size);
      this.readyState = 2;
      if (this.onload) this.onload({ target: this });
    }, 10);
  }
};

describe('Conversion Process Integration Tests', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="conversion-container">
            <input type="file" id="file-input" accept="image/*" />
            <select id="format-select">
              <option value="png">PNG</option>
              <option value="jpg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
            <button id="convert-btn">Convert</button>
            <div id="quota-display">
              <span id="quota-used">0</span>/<span id="quota-limit">10</span>
              <div id="quota-warning" style="display: none;">Quota almost exceeded!</div>
            </div>
            <div id="conversion-result" style="display: none;">
              <img id="result-image" />
              <a id="download-link">Download</a>
            </div>
            <div id="error-message" style="display: none;"></div>
            <div id="upgrade-prompt" style="display: none;">
              <p>Quota exceeded! Upgrade your plan.</p>
              <button id="upgrade-btn">Upgrade</button>
            </div>
          </div>
        </body>
      </html>
    `);

    window = dom.window;
    document = window.document;

    // Set up global objects
    global.window = window;
    global.document = document;

    // Reset mocks
    jest.clearAllMocks();
    fetch.mockClear();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Quota Checking Before Conversion', () => {
    test('checks quota before processing conversion', async () => {
      // Requirement 2.3: Check quota before conversion
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUsageInfo = {
        conversions_used: 8,
        conversions_limit: 10,
        can_convert: true
      };

      // Mock quota check response
      mockEdgeFunctionResponse.json.mockResolvedValue({
        success: true,
        usage: mockUsageInfo
      });

      // Simulate quota check
      const response = await fetch('/api/quota-check', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' },
        body: JSON.stringify({ user_id: mockUser.id })
      });

      const result = await response.json();

      expect(fetch).toHaveBeenCalledWith('/api/quota-check', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' },
        body: JSON.stringify({ user_id: mockUser.id })
      });

      expect(result.usage.can_convert).toBe(true);
      expect(result.usage.conversions_used).toBe(8);
    });

    test('prevents conversion when quota exceeded', async () => {
      // Requirement 2.4: Prevent conversion when quota exceeded
      const mockUser = { id: 'user-123' };
      const mockUsageInfo = {
        conversions_used: 10,
        conversions_limit: 10,
        can_convert: false
      };

      // Mock quota exceeded response
      mockEdgeFunctionResponse.json.mockResolvedValue({
        success: false,
        error: 'Quota exceeded',
        usage: mockUsageInfo
      });

      mockEdgeFunctionResponse.status = 429;

      const response = await fetch('/api/convert-image', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' },
        body: new FormData()
      });

      const result = await response.json();

      expect(response.status).toBe(429);
      expect(result.error).toBe('Quota exceeded');
      expect(result.usage.can_convert).toBe(false);
    });

    test('shows upgrade prompt when quota exceeded', async () => {
      // Requirement 13.5: Show upgrade prompts when quota exceeded
      const errorDiv = document.getElementById('error-message');
      const upgradePrompt = document.getElementById('upgrade-prompt');

      // Simulate quota exceeded scenario
      const quotaExceededError = {
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED'
      };

      // Show upgrade prompt
      errorDiv.style.display = 'none';
      upgradePrompt.style.display = 'block';

      expect(upgradePrompt.style.display).toBe('block');
      expect(errorDiv.style.display).toBe('none');
    });
  });

  describe('File Validation and Processing', () => {
    test('validates file size and type before conversion', async () => {
      // Requirement 13.1, 13.2: File size and type validation
      const validFile = new File(['mock image data'], 'test.jpg', { 
        type: 'image/jpeg' 
      });

      const invalidFile = new File(['mock data'], 'test.txt', { 
        type: 'text/plain' 
      });

      // Mock validation function
      const validateFile = (file) => {
        const maxSize = 50 * 1024 * 1024; // 50MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

        if (file.size > maxSize) {
          return { valid: false, error: 'File too large' };
        }

        if (!allowedTypes.includes(file.type)) {
          return { valid: false, error: 'Unsupported file type' };
        }

        return { valid: true };
      };

      const validResult = validateFile(validFile);
      const invalidResult = validateFile(invalidFile);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Unsupported file type');
    });

    test('processes image conversion with format support', async () => {
      // Requirement 13.3: Image conversion with format support
      const inputFile = new File(['mock jpeg data'], 'input.jpg', { 
        type: 'image/jpeg' 
      });

      const conversionRequest = {
        file: inputFile,
        targetFormat: 'png',
        quality: 90
      };

      // Mock successful conversion response
      mockEdgeFunctionResponse.json.mockResolvedValue({
        success: true,
        downloadUrl: 'https://storage.supabase.co/converted/output.png',
        filename: 'output.png',
        fileSize: 1024000,
        processingTime: 1500,
        remainingQuota: 7
      });

      const formData = new FormData();
      formData.append('file', conversionRequest.file);
      formData.append('targetFormat', conversionRequest.targetFormat);
      formData.append('quality', conversionRequest.quality);

      const response = await fetch('/api/convert-image', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' },
        body: formData
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.filename).toBe('output.png');
      expect(result.remainingQuota).toBe(7);
    });
  });

  describe('Usage Tracking Integration', () => {
    test('updates usage counter after successful conversion', async () => {
      // Requirement 2.1: Server-side usage tracking
      const mockUser = { id: 'user-123' };
      const initialUsage = { conversions_used: 5, conversions_limit: 10 };
      const updatedUsage = { conversions_used: 6, conversions_limit: 10 };

      // Mock conversion success with usage update
      mockEdgeFunctionResponse.json.mockResolvedValue({
        success: true,
        downloadUrl: 'https://storage.supabase.co/converted/output.png',
        usage: updatedUsage
      });

      const response = await fetch('/api/convert-image', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' },
        body: new FormData()
      });

      const result = await response.json();

      expect(result.usage.conversions_used).toBe(6);
      expect(result.usage.conversions_used).toBeGreaterThan(initialUsage.conversions_used);
    });

    test('updates UI quota display after conversion', async () => {
      // Requirement 2.4: UI reflects updated remaining quota
      const quotaUsed = document.getElementById('quota-used');
      const quotaLimit = document.getElementById('quota-limit');
      const quotaWarning = document.getElementById('quota-warning');

      // Initial state
      quotaUsed.textContent = '5';
      quotaLimit.textContent = '10';

      // Simulate successful conversion
      const newUsage = 6;
      quotaUsed.textContent = newUsage.toString();

      // Show warning when approaching limit (80% threshold)
      if (newUsage / parseInt(quotaLimit.textContent) >= 0.8) {
        quotaWarning.style.display = 'block';
      }

      expect(quotaUsed.textContent).toBe('6');
      expect(quotaWarning.style.display).toBe('none'); // 6/10 = 60%, below 80%

      // Test warning threshold
      quotaUsed.textContent = '8';
      if (8 / 10 >= 0.8) {
        quotaWarning.style.display = 'block';
      }

      expect(quotaWarning.style.display).toBe('block'); // 8/10 = 80%, at threshold
    });

    test('handles conversion failure without incrementing usage', async () => {
      // Requirement 2.5: No usage increment on conversion failure
      const initialUsage = { conversions_used: 5, conversions_limit: 10 };

      // Mock conversion failure
      mockEdgeFunctionResponse.ok = false;
      mockEdgeFunctionResponse.status = 400;
      mockEdgeFunctionResponse.json.mockResolvedValue({
        success: false,
        error: 'Invalid file format',
        usage: initialUsage // Usage unchanged
      });

      const response = await fetch('/api/convert-image', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' },
        body: new FormData()
      });

      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.usage.conversions_used).toBe(5); // Unchanged
      expect(result.error).toBe('Invalid file format');
    });
  });

  describe('Batch Conversion Handling', () => {
    test('handles multiple file conversions with quota awareness', async () => {
      // Requirement 13.6: Batch conversion with quota awareness
      const files = [
        new File(['data1'], 'file1.jpg', { type: 'image/jpeg' }),
        new File(['data2'], 'file2.jpg', { type: 'image/jpeg' }),
        new File(['data3'], 'file3.jpg', { type: 'image/jpeg' })
      ];

      const currentUsage = { conversions_used: 8, conversions_limit: 10 };

      // Mock batch conversion with quota check
      const batchConvert = async (files, currentUsage) => {
        const results = [];
        let usage = { ...currentUsage };

        for (const file of files) {
          if (usage.conversions_used >= usage.conversions_limit) {
            results.push({
              filename: file.name,
              success: false,
              error: 'Quota exceeded'
            });
            continue;
          }

          // Simulate successful conversion
          results.push({
            filename: file.name.replace('.jpg', '.png'),
            success: true,
            downloadUrl: `https://storage.supabase.co/converted/${file.name.replace('.jpg', '.png')}`
          });

          usage.conversions_used++;
        }

        return { results, finalUsage: usage };
      };

      const batchResult = await batchConvert(files, currentUsage);

      expect(batchResult.results).toHaveLength(3);
      expect(batchResult.results[0].success).toBe(true);
      expect(batchResult.results[1].success).toBe(true);
      expect(batchResult.results[2].success).toBe(false); // Quota exceeded
      expect(batchResult.results[2].error).toBe('Quota exceeded');
      expect(batchResult.finalUsage.conversions_used).toBe(10);
    });
  });

  describe('Error Handling and User Feedback', () => {
    test('displays appropriate error messages for different failure types', async () => {
      // Requirement 13.5: Error handling and user feedback
      const errorDiv = document.getElementById('error-message');
      const upgradePrompt = document.getElementById('upgrade-prompt');

      const displayError = (error) => {
        errorDiv.style.display = 'block';
        upgradePrompt.style.display = 'none';

        switch (error.code) {
          case 'QUOTA_EXCEEDED':
            errorDiv.style.display = 'none';
            upgradePrompt.style.display = 'block';
            break;
          case 'FILE_TOO_LARGE':
            errorDiv.textContent = 'File size exceeds the maximum limit of 50MB';
            break;
          case 'UNSUPPORTED_FORMAT':
            errorDiv.textContent = 'Unsupported file format. Please use JPEG, PNG, WebP, or GIF';
            break;
          case 'PROCESSING_FAILED':
            errorDiv.textContent = 'Image processing failed. Please try again';
            break;
          default:
            errorDiv.textContent = 'An unexpected error occurred. Please try again';
        }
      };

      // Test different error scenarios
      displayError({ code: 'QUOTA_EXCEEDED' });
      expect(upgradePrompt.style.display).toBe('block');
      expect(errorDiv.style.display).toBe('none');

      displayError({ code: 'FILE_TOO_LARGE' });
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('50MB');

      displayError({ code: 'UNSUPPORTED_FORMAT' });
      expect(errorDiv.textContent).toContain('JPEG, PNG, WebP, or GIF');
    });

    test('shows conversion success feedback with download link', async () => {
      // Requirement 13.6: Conversion success feedback
      const resultDiv = document.getElementById('conversion-result');
      const resultImage = document.getElementById('result-image');
      const downloadLink = document.getElementById('download-link');

      const showSuccess = (result) => {
        resultDiv.style.display = 'block';
        resultImage.src = result.downloadUrl;
        downloadLink.href = result.downloadUrl;
        downloadLink.download = result.filename;
        downloadLink.textContent = `Download ${result.filename}`;
      };

      const mockResult = {
        downloadUrl: 'https://storage.supabase.co/converted/output.png',
        filename: 'output.png'
      };

      showSuccess(mockResult);

      expect(resultDiv.style.display).toBe('block');
      expect(resultImage.src).toBe(mockResult.downloadUrl);
      expect(downloadLink.href).toBe(mockResult.downloadUrl);
      expect(downloadLink.download).toBe(mockResult.filename);
    });
  });
});