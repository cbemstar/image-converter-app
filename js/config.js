/**
 * Application Configuration
 * Contains plan limits, API endpoints, and other configuration values
 */

window.APP_CONFIG = {
  // Plan limits (these should match your environment variables)
  PLAN_LIMITS: {
    free: {
      storage: 52428800, // 50MB in bytes
      conversions: 500,
      apiCalls: 5000,
      maxFileSize: 26214400 // 25MB in bytes
    },
    pro: {
      storage: 2147483648, // 2GB in bytes
      conversions: 5000,
      apiCalls: 50000,
      maxFileSize: 104857600 // 100MB in bytes
    },
    agency: {
      storage: 21474836480, // 20GB in bytes
      conversions: 50000,
      apiCalls: 500000,
      maxFileSize: 262144000 // 250MB in bytes
    }
  },

  // Plan pricing (for display purposes)
  PLAN_PRICING: {
    pro: {
      price: 9,
      currency: 'USD',
      interval: 'month',
      stripePriceId: 'price_pro_monthly' // Replace with actual Stripe price ID
    },
    agency: {
      price: 49,
      currency: 'USD',
      interval: 'month',
      stripePriceId: 'price_agency_monthly' // Replace with actual Stripe price ID
    }
  },

  // Supported file types by tool
  SUPPORTED_FILE_TYPES: {
    'image-converter': [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/avif',
      'image/heic',
      'image/heif',
      'image/x-icon'
    ],
    'pdf-merger': ['application/pdf'],
    'pdf-ocr': ['application/pdf'],
    'background-remover': [
      'image/jpeg',
      'image/png',
      'image/webp'
    ],
    'json-formatter': ['application/json', 'text/plain'],
    'default': ['*/*'] // For tools that accept any file type
  },

  // Tool categories for organization
  TOOL_CATEGORIES: {
    'Image Tools': [
      'image-converter',
      'background-remover',
      'color-palette'
    ],
    'PDF Tools': [
      'pdf-merger',
      'pdf-ocr'
    ],
    'Text Tools': [
      'json-formatter',
      'text-case-converter'
    ],
    'Utility Tools': [
      'qr-generator',
      'timestamp-converter',
      'uuid-generator'
    ],
    'Web Tools': [
      'meta-tag-generator',
      'robots-txt',
      'utm-builder'
    ],
    'Marketing Tools': [
      'bulk-match-editor',
      'campaign-structure',
      'google-ads-rsa-preview'
    ],
    'Developer Tools': [
      'request-tool'
    ]
  },

  // Usage warning thresholds
  USAGE_THRESHOLDS: {
    warning: 0.7, // 70%
    critical: 0.85, // 85%
    exceeded: 0.95 // 95%
  },

  // API endpoints
  API_ENDPOINTS: {
    quotaCheck: '/api/quota-check',
    stripeWebhook: '/api/stripe/webhook',
    cleanup: '/api/cron/cleanup'
  },

  // Storage bucket name
  STORAGE_BUCKET: 'user-files',

  // File upload settings
  UPLOAD_SETTINGS: {
    chunkSize: 1024 * 1024, // 1MB chunks
    maxConcurrentUploads: 3,
    retryAttempts: 3
  },

  // UI settings
  UI_SETTINGS: {
    toastDuration: 5000, // 5 seconds
    loadingTimeout: 30000, // 30 seconds
    debounceDelay: 300 // 300ms
  },

  // Development settings
  DEV_SETTINGS: {
    enableDebugLogs: true,
    mockPayments: false, // Set to true for testing without real Stripe
    bypassQuotas: false // Set to true to bypass quota checks in development
  }
};

// Utility functions for configuration
window.APP_CONFIG.getPlanLimit = function(plan, limitType) {
  return this.PLAN_LIMITS[plan]?.[limitType] || 0;
};

window.APP_CONFIG.getSupportedFileTypes = function(toolType) {
  return this.SUPPORTED_FILE_TYPES[toolType] || this.SUPPORTED_FILE_TYPES.default;
};

window.APP_CONFIG.getToolCategory = function(toolType) {
  for (const [category, tools] of Object.entries(this.TOOL_CATEGORIES)) {
    if (tools.includes(toolType)) {
      return category;
    }
  }
  return 'Other';
};

window.APP_CONFIG.formatFileSize = function(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

window.APP_CONFIG.formatNumber = function(num) {
  return new Intl.NumberFormat().format(num);
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.APP_CONFIG;
}