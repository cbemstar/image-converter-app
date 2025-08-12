#!/usr/bin/env node

/**
 * Authentication Flow Test Runner
 * Task 13.5: Test and validate authentication flow
 * 
 * This script runs all authentication-related tests to validate:
 * - Sign-in redirect functionality
 * - Auth state persistence across page reloads
 * - User dropdown menu functionality
 * - Quota display for authenticated users
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔐 Running Authentication Flow Validation Tests...\n');

const testFiles = [
  '__tests__/auth-flow-validation.test.js',
  '__tests__/auth-flow-e2e.test.js',
  '__tests__/auth-redirect.test.js',
  '__tests__/integration-auth-flow.test.js'
];

const runTest = (testFile) => {
  console.log(`\n📋 Running: ${testFile}`);
  console.log('=' .repeat(60));
  
  try {
    const result = execSync(`npx jest ${testFile} --verbose --no-cache`, {
      cwd: __dirname,
      stdio: 'inherit',
      encoding: 'utf8'
    });
    
    console.log(`✅ ${testFile} - PASSED`);
    return true;
  } catch (error) {
    console.error(`❌ ${testFile} - FAILED`);
    console.error(error.message);
    return false;
  }
};

const runAllTests = () => {
  let passedTests = 0;
  let totalTests = testFiles.length;
  
  console.log(`Running ${totalTests} authentication test suites...\n`);
  
  for (const testFile of testFiles) {
    if (runTest(testFile)) {
      passedTests++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Test Suites: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All authentication tests PASSED!');
    console.log('\n✅ Task 13.5 Validation Complete:');
    console.log('   ✓ Sign-in redirect functionality tested');
    console.log('   ✓ Auth state persistence verified');
    console.log('   ✓ User dropdown menu functionality validated');
    console.log('   ✓ Quota display for authenticated users confirmed');
    process.exit(0);
  } else {
    console.log('\n❌ Some authentication tests FAILED!');
    console.log('Please review the test output above and fix any issues.');
    process.exit(1);
  }
};

// Check if Jest is available
try {
  execSync('npx jest --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Jest is not available. Please install it first:');
  console.error('npm install --save-dev jest @types/jest');
  process.exit(1);
}

// Run all tests
runAllTests();