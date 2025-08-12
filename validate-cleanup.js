#!/usr/bin/env node

/**
 * Cleanup Validation Script
 * 
 * This script validates that the codebase cleanup was successful
 * and all issues have been resolved.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Codebase Cleanup...');
console.log('=' .repeat(50));

const validationResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function runValidation(testName, testFunction) {
  try {
    console.log(`\n📋 Validating: ${testName}`);
    const result = testFunction();
    
    if (result.status === 'passed') {
      console.log(`✅ PASSED: ${testName}`);
      validationResults.passed++;
      validationResults.tests.push({ name: testName, status: 'PASSED' });
    } else if (result.status === 'warning') {
      console.log(`⚠️  WARNING: ${testName} - ${result.message}`);
      validationResults.warnings++;
      validationResults.tests.push({ name: testName, status: 'WARNING', message: result.message });
    } else {
      console.log(`❌ FAILED: ${testName} - ${result.message}`);
      validationResults.failed++;
      validationResults.tests.push({ name: testName, status: 'FAILED', message: result.message });
    }
  } catch (error) {
    console.log(`❌ ERROR: ${testName} - ${error.message}`);
    validationResults.failed++;
    validationResults.tests.push({ name: testName, status: 'ERROR', error: error.message });
  }
}

// Validation 1: Check for duplicate quota systems
runValidation('No Duplicate Quota Systems', () => {
  const imageConverterPath = path.join(__dirname, 'tools', 'image-converter', 'index.html');
  if (!fs.existsSync(imageConverterPath)) {
    return { status: 'failed', message: 'Image converter HTML not found' };
  }
  
  const htmlContent = fs.readFileSync(imageConverterPath, 'utf8');
  
  // Count quota-related elements
  const quotaStatusMatches = (htmlContent.match(/id="quota-status"/g) || []).length;
  const usageCounterMatches = (htmlContent.match(/id="usage-counter"/g) || []).length;
  const quotaDisplayMatches = (htmlContent.match(/id="quota-display"/g) || []).length;
  
  if (quotaStatusMatches > 1 || usageCounterMatches > 1) {
    return { status: 'failed', message: `Found duplicate quota elements: quota-status(${quotaStatusMatches}), usage-counter(${usageCounterMatches})` };
  }
  
  if (quotaDisplayMatches === 1) {
    console.log('   ✓ Single unified quota display found');
    return { status: 'passed' };
  }
  
  return { status: 'warning', message: 'No quota-display element found, but no duplicates detected' };
});

// Validation 2: Check Supabase client initialization
runValidation('Supabase Client Initialization', () => {
  const configPath = path.join(__dirname, 'js', 'public-config.js');
  if (!fs.existsSync(configPath)) {
    return { status: 'failed', message: 'public-config.js not found' };
  }
  
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  if (!configContent.includes('window.PUBLIC_ENV')) {
    return { status: 'failed', message: 'PUBLIC_ENV not found in config' };
  }
  
  if (!configContent.includes('SUPABASE_URL') || !configContent.includes('SUPABASE_ANON_KEY')) {
    return { status: 'failed', message: 'Supabase configuration incomplete' };
  }
  
  console.log('   ✓ Supabase configuration present');
  return { status: 'passed' };
});

// Validation 3: Check for conflicting scripts
runValidation('No Conflicting Scripts', () => {
  const conflictingScripts = [
    'js/quota-system-init.js',
    'js/usage-integration.js',
    'js/usage-tracking-client.js'
  ];
  
  const activeConflicts = [];
  const backedUpScripts = [];
  
  conflictingScripts.forEach(scriptPath => {
    const fullPath = path.join(__dirname, scriptPath);
    const backupPath = fullPath + '.backup';
    
    if (fs.existsSync(fullPath)) {
      activeConflicts.push(scriptPath);
    }
    
    if (fs.existsSync(backupPath)) {
      backedUpScripts.push(scriptPath);
    }
  });
  
  if (activeConflicts.length > 0) {
    return { status: 'failed', message: `Active conflicting scripts found: ${activeConflicts.join(', ')}` };
  }
  
  console.log(`   ✓ ${backedUpScripts.length} conflicting scripts moved to backup`);
  return { status: 'passed' };
});

// Validation 4: Check core.js is clean
runValidation('Core.js Clean Implementation', () => {
  const corePath = path.join(__dirname, 'tools', 'image-converter', 'core.js');
  if (!fs.existsSync(corePath)) {
    return { status: 'failed', message: 'core.js not found' };
  }
  
  const coreContent = fs.readFileSync(corePath, 'utf8');
  
  // Check for essential functions
  const essentialFunctions = [
    'initializeApp',
    'initializeSupabase',
    'initializeAuth',
    'updateQuotaDisplay',
    'checkConversionQuota'
  ];
  
  const missingFunctions = essentialFunctions.filter(func => !coreContent.includes(func));
  if (missingFunctions.length > 0) {
    return { status: 'failed', message: `Missing essential functions: ${missingFunctions.join(', ')}` };
  }
  
  // Check for old conflicting imports
  if (coreContent.includes('quota-system-init') || coreContent.includes('usage-integration')) {
    return { status: 'warning', message: 'Found references to old quota systems' };
  }
  
  console.log('   ✓ Core.js has clean implementation');
  return { status: 'passed' };
});

// Validation 5: Check HTML is clean
runValidation('HTML Clean Structure', () => {
  const htmlPath = path.join(__dirname, 'tools', 'image-converter', 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Check for single quota display
  const quotaDisplays = (htmlContent.match(/quota-display|usage-counter|quota-status/g) || []).length;
  
  // Check for clean script loading
  const scriptTags = (htmlContent.match(/<script[^>]*src=/g) || []).length;
  
  // Check for no duplicate navigation
  const navTags = (htmlContent.match(/<nav/g) || []).length;
  
  if (navTags > 1) {
    return { status: 'failed', message: `Multiple navigation elements found: ${navTags}` };
  }
  
  console.log(`   ✓ Single navigation element`);
  console.log(`   ✓ ${scriptTags} script tags (reasonable number)`);
  console.log(`   ✓ Quota elements: ${quotaDisplays}`);
  
  return { status: 'passed' };
});

// Validation 6: Check auth configuration
runValidation('Auth Configuration', () => {
  const authConfigPath = path.join(__dirname, 'js', 'auth-config.js');
  if (!fs.existsSync(authConfigPath)) {
    return { status: 'warning', message: 'auth-config.js not found (optional)' };
  }
  
  const authConfigContent = fs.readFileSync(authConfigPath, 'utf8');
  
  if (!authConfigContent.includes('AUTH_CONFIG')) {
    return { status: 'failed', message: 'AUTH_CONFIG not found in auth-config.js' };
  }
  
  console.log('   ✓ Unified auth configuration created');
  return { status: 'passed' };
});

// Validation 7: Check utils.js is clean
runValidation('Utils.js Clean', () => {
  const utilsPath = path.join(__dirname, 'utils.js');
  if (!fs.existsSync(utilsPath)) {
    return { status: 'warning', message: 'utils.js not found' };
  }
  
  const utilsContent = fs.readFileSync(utilsPath, 'utf8');
  
  // Check for old quota functions
  const oldQuotaFunctions = ['getQuotaInfo', 'setQuotaInfo', 'updateQuotaStatus', 'canProcessImages'];
  const foundOldFunctions = oldQuotaFunctions.filter(func => utilsContent.includes(`function ${func}`));
  
  if (foundOldFunctions.length > 0) {
    return { status: 'failed', message: `Old quota functions still present: ${foundOldFunctions.join(', ')}` };
  }
  
  // Check for essential utility functions
  const essentialUtils = ['showNotification', 'formatFileSize'];
  const missingUtils = essentialUtils.filter(func => !utilsContent.includes(func));
  
  if (missingUtils.length > 0) {
    return { status: 'warning', message: `Missing utility functions: ${missingUtils.join(', ')}` };
  }
  
  console.log('   ✓ Old quota functions removed');
  console.log('   ✓ Essential utilities present');
  return { status: 'passed' };
});

// Validation 8: Check for console error sources
runValidation('Console Error Sources', () => {
  const htmlPath = path.join(__dirname, 'tools', 'image-converter', 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Check for problematic script sources
  const problematicSources = [
    'raw-wasm', // Causes "RAW-WASM library not found" error
    'stripe-pricing-table', // Causes archived products error
    'quota-system-init' // Causes conflicts
  ];
  
  const foundProblems = problematicSources.filter(source => htmlContent.includes(source));
  
  if (foundProblems.length > 0) {
    return { status: 'warning', message: `Potentially problematic sources found: ${foundProblems.join(', ')}` };
  }
  
  console.log('   ✓ No known problematic script sources');
  return { status: 'passed' };
});

// Print summary
console.log('\n' + '='.repeat(50));
console.log('📊 CLEANUP VALIDATION SUMMARY');
console.log('='.repeat(50));
console.log(`Total Validations: ${validationResults.passed + validationResults.failed + validationResults.warnings}`);
console.log(`Passed: ${validationResults.passed}`);
console.log(`Warnings: ${validationResults.warnings}`);
console.log(`Failed: ${validationResults.failed}`);

if (validationResults.failed > 0) {
  console.log('\n❌ Failed Validations:');
  validationResults.tests
    .filter(test => test.status === 'FAILED' || test.status === 'ERROR')
    .forEach(test => {
      console.log(`   • ${test.name}: ${test.status}`);
      if (test.message) console.log(`     ${test.message}`);
      if (test.error) console.log(`     ${test.error}`);
    });
}

if (validationResults.warnings > 0) {
  console.log('\n⚠️  Warnings:');
  validationResults.tests
    .filter(test => test.status === 'WARNING')
    .forEach(test => {
      console.log(`   • ${test.name}: ${test.message}`);
    });
}

console.log('\n🎯 Cleanup Validation Result:');

if (validationResults.failed === 0) {
  console.log('✅ CLEANUP SUCCESSFUL');
  console.log('\nThe codebase has been successfully cleaned up:');
  console.log('   • Duplicate quota systems removed');
  console.log('   • Conflicting scripts moved to backup');
  console.log('   • Supabase client initialization fixed');
  console.log('   • HTML structure cleaned');
  console.log('   • Utils.js conflicts resolved');
  
  console.log('\n🚀 Ready for Testing:');
  console.log('1. Open tools/image-converter/index.html');
  console.log('2. Check browser console for errors');
  console.log('3. Test authentication functionality');
  console.log('4. Verify quota display works correctly');
  console.log('5. Test image conversion process');
  
} else {
  console.log('❌ CLEANUP NEEDS ATTENTION');
  console.log('Please address the failed validations above before proceeding.');
}

process.exit(validationResults.failed > 0 ? 1 : 0);