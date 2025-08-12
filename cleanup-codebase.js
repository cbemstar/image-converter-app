#!/usr/bin/env node

/**
 * Codebase Cleanup Script
 * 
 * This script performs a comprehensive cleanup of the image converter codebase
 * to resolve conflicts and duplicate systems.
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Starting Codebase Cleanup...');
console.log('=' .repeat(50));

const cleanupResults = {
  filesProcessed: 0,
  issuesFixed: 0,
  errors: 0
};

// Issues to fix
const cleanupTasks = [
  {
    name: 'Remove duplicate quota systems',
    action: removeOldQuotaSystem
  },
  {
    name: 'Fix Supabase client initialization',
    action: fixSupabaseInit
  },
  {
    name: 'Remove conflicting scripts',
    action: removeConflictingScripts
  },
  {
    name: 'Update utils.js to remove conflicts',
    action: updateUtilsFile
  },
  {
    name: 'Create unified auth configuration',
    action: createUnifiedAuthConfig
  }
];

async function runCleanup() {
  for (const task of cleanupTasks) {
    try {
      console.log(`\n📋 ${task.name}...`);
      await task.action();
      console.log(`✅ ${task.name} - COMPLETED`);
      cleanupResults.issuesFixed++;
    } catch (error) {
      console.error(`❌ ${task.name} - FAILED:`, error.message);
      cleanupResults.errors++;
    }
  }
  
  printSummary();
}

// Remove old quota system from utils.js
function removeOldQuotaSystem() {
  const utilsPath = path.join(__dirname, 'utils.js');
  
  if (!fs.existsSync(utilsPath)) {
    console.log('   ⚠️  utils.js not found, skipping...');
    return;
  }
  
  let content = fs.readFileSync(utilsPath, 'utf8');
  
  // Remove old quota functions
  const functionsToRemove = [
    'getQuotaInfo',
    'setQuotaInfo', 
    'updateQuotaStatus',
    'canProcessImages'
  ];
  
  functionsToRemove.forEach(funcName => {
    // Remove export function
    const exportRegex = new RegExp(`export\\s+function\\s+${funcName}\\s*\\([^}]*\\}`, 'gs');
    content = content.replace(exportRegex, '');
    
    // Remove any remaining references
    const refRegex = new RegExp(`\\b${funcName}\\b`, 'g');
    const matches = content.match(refRegex);
    if (matches) {
      console.log(`   ⚠️  Found ${matches.length} references to ${funcName} that may need manual cleanup`);
    }
  });
  
  // Remove old quota-related code
  content = content.replace(/\/\/ Quota management[\s\S]*?(?=\/\/|export|$)/g, '');
  
  fs.writeFileSync(utilsPath, content);
  console.log('   ✓ Removed old quota system from utils.js');
  cleanupResults.filesProcessed++;
}

// Fix Supabase client initialization
function fixSupabaseInit() {
  const configPath = path.join(__dirname, 'js', 'public-config.js');
  
  if (!fs.existsSync(configPath)) {
    console.log('   ⚠️  public-config.js not found, skipping...');
    return;
  }
  
  let content = fs.readFileSync(configPath, 'utf8');
  
  // Ensure proper configuration format
  if (!content.includes('window.PUBLIC_ENV')) {
    console.log('   ⚠️  PUBLIC_ENV not found in config');
    return;
  }
  
  // Add initialization flag
  if (!content.includes('window.CONFIG_LOADED')) {
    content += '\n\n// Configuration loaded flag\nwindow.CONFIG_LOADED = true;\n';
    fs.writeFileSync(configPath, content);
    console.log('   ✓ Added configuration loaded flag');
  }
  
  cleanupResults.filesProcessed++;
}

// Remove conflicting scripts
function removeConflictingScripts() {
  const scriptsToCheck = [
    'js/quota-system-init.js',
    'js/usage-integration.js',
    'js/usage-tracking-client.js'
  ];
  
  scriptsToCheck.forEach(scriptPath => {
    const fullPath = path.join(__dirname, scriptPath);
    if (fs.existsSync(fullPath)) {
      // Instead of deleting, rename to .backup
      const backupPath = fullPath + '.backup';
      fs.renameSync(fullPath, backupPath);
      console.log(`   ✓ Moved ${scriptPath} to backup`);
      cleanupResults.filesProcessed++;
    }
  });
}

// Update utils.js to remove conflicts
function updateUtilsFile() {
  const utilsPath = path.join(__dirname, 'utils.js');
  
  if (!fs.existsSync(utilsPath)) {
    console.log('   ⚠️  utils.js not found, creating minimal version...');
    createMinimalUtils();
    return;
  }
  
  let content = fs.readFileSync(utilsPath, 'utf8');
  
  // Remove Stripe-related functions
  content = content.replace(/export function toggleStripeAccordion[\s\S]*?\n}/g, '');
  
  // Clean up any remaining quota references
  content = content.replace(/quota\./g, '// quota.');
  content = content.replace(/imgQuota/g, '// imgQuota');
  
  // Add comment about deprecated functions
  content = `// utils.js - Cleaned up utility functions
// Note: Quota management has been moved to core.js

${content}`;
  
  fs.writeFileSync(utilsPath, content);
  console.log('   ✓ Cleaned up utils.js');
  cleanupResults.filesProcessed++;
}

// Create minimal utils.js if it doesn't exist
function createMinimalUtils() {
  const utilsPath = path.join(__dirname, 'utils.js');
  
  const minimalUtils = `// utils.js - Essential utility functions only

// Notification system
export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = \`notification notification-\${type}\`;
  notification.textContent = message;
  notification.style.cssText = \`
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    background-color: \${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
  \`;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Format file size
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format detectors
export function isAvif(file) {
  return file.type === 'image/avif' || file.name.toLowerCase().endsWith('.avif');
}

export function isHeic(file) {
  return file.type === 'image/heic' || file.type === 'image/heif' || /\\.(heic|heif)$/i.test(file.name);
}

export function isRaw(file) {
  return /\\.(cr2|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$/i.test(file.name);
}

// Browser checks
export function checkHeicSupport() {
  const isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
  const isEdge = navigator.userAgent.indexOf("Edg") !== -1;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  if (isSafari) {
    const match = navigator.userAgent.match(/Version\\/(\\d+)/);
    const version = match ? parseInt(match[1], 10) : 0;
    return version >= 17 ? 'native' : 'limited';
  } else if (isChrome || isEdge) {
    return 'supported';
  } else {
    return 'limited';
  }
}

export function checkWasmSupport() {
  return typeof WebAssembly === 'object';
}
`;
  
  fs.writeFileSync(utilsPath, minimalUtils);
  console.log('   ✓ Created minimal utils.js');
  cleanupResults.filesProcessed++;
}

// Create unified auth configuration
function createUnifiedAuthConfig() {
  const authConfigPath = path.join(__dirname, 'js', 'auth-config.js');
  
  const authConfig = `// auth-config.js - Unified authentication configuration

// Authentication configuration
export const AUTH_CONFIG = {
  // Supabase configuration (loaded from PUBLIC_ENV)
  getSupabaseConfig() {
    if (!window.PUBLIC_ENV) {
      throw new Error('PUBLIC_ENV not loaded');
    }
    
    return {
      url: window.PUBLIC_ENV.SUPABASE_URL,
      anonKey: window.PUBLIC_ENV.SUPABASE_ANON_KEY
    };
  },
  
  // OAuth configuration
  getOAuthConfig() {
    return window.OAUTH_CONFIG || {};
  },
  
  // Auth settings
  settings: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  
  // Quota settings
  quota: {
    guest: {
      limit: 3,
      resetHours: 24
    },
    free: {
      limit: 10,
      resetMonthly: true
    },
    pro: {
      limit: 1000,
      resetMonthly: true
    },
    unlimited: {
      limit: -1
    }
  }
};

// Initialize authentication system
export async function initializeAuth() {
  // Wait for configuration to load
  while (!window.PUBLIC_ENV) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const config = AUTH_CONFIG.getSupabaseConfig();
  
  // Import Supabase client
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  
  // Create client
  const supabaseClient = createClient(config.url, config.anonKey, {
    auth: AUTH_CONFIG.settings
  });
  
  // Make available globally
  window.supabaseClient = { getClient: () => supabaseClient };
  
  return supabaseClient;
}
`;
  
  fs.writeFileSync(authConfigPath, authConfig);
  console.log('   ✓ Created unified auth configuration');
  cleanupResults.filesProcessed++;
}

// Print cleanup summary
function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 CLEANUP SUMMARY');
  console.log('='.repeat(50));
  console.log(`Files Processed: ${cleanupResults.filesProcessed}`);
  console.log(`Issues Fixed: ${cleanupResults.issuesFixed}`);
  console.log(`Errors: ${cleanupResults.errors}`);
  
  if (cleanupResults.errors === 0) {
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('\n✅ Next Steps:');
    console.log('1. Test the image converter page');
    console.log('2. Verify authentication works');
    console.log('3. Check quota display is unified');
    console.log('4. Test sign-in functionality');
  } else {
    console.log('\n⚠️  Cleanup completed with some errors.');
    console.log('Please review the errors above and fix manually if needed.');
  }
}

// Run cleanup
runCleanup().catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});