#!/usr/bin/env node

/**
 * Script to verify all tool page links are correct
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getToolPages() {
  try {
    const result = execSync('find tools -name "index.html"', { 
      cwd: __dirname,
      encoding: 'utf8' 
    });
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error finding tool pages:', error.message);
    return [];
  }
}

function verifyLinks(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${fullPath}`);
    return { hasAuth: false, hasCorrectLinks: false };
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for authentication elements
    const hasAuthElements = content.includes('data-guest-only') && content.includes('data-auth-required');
    
    // Check for correct relative paths
    const hasCorrectAuthLink = content.includes('href="../../auth.html"');
    const hasCorrectDashboardLink = content.includes('href="../../dashboard.html"');
    const hasCorrectProfileLink = content.includes('href="../../profile.html"');
    
    // Check for incorrect absolute paths (these would be broken)
    const hasBrokenAuthLink = content.includes('href="/auth.html"');
    const hasBrokenDashboardLink = content.includes('href="/dashboard.html"');
    const hasBrokenProfileLink = content.includes('href="/profile.html"');
    
    const status = {
      hasAuth: hasAuthElements,
      hasCorrectLinks: hasCorrectAuthLink && hasCorrectDashboardLink && hasCorrectProfileLink,
      hasBrokenLinks: hasBrokenAuthLink || hasBrokenDashboardLink || hasBrokenProfileLink,
      details: {
        authLink: hasCorrectAuthLink ? '✅ ../../auth.html' : (hasBrokenAuthLink ? '❌ /auth.html' : '❓ Missing'),
        dashboardLink: hasCorrectDashboardLink ? '✅ ../../dashboard.html' : (hasBrokenDashboardLink ? '❌ /dashboard.html' : '❓ Missing'),
        profileLink: hasCorrectProfileLink ? '✅ ../../profile.html' : (hasBrokenProfileLink ? '❌ /profile.html' : '❓ Missing')
      }
    };
    
    return status;
    
  } catch (error) {
    console.log(`❌ Error reading ${filePath}: ${error.message}`);
    return { hasAuth: false, hasCorrectLinks: false, error: error.message };
  }
}

function main() {
  console.log('🔍 Verifying tool page links...\n');
  
  const toolPages = getToolPages();
  
  if (toolPages.length === 0) {
    console.log('❌ No tool pages found');
    return;
  }

  let correctPages = 0;
  let pagesWithAuth = 0;
  let brokenPages = 0;
  
  console.log('📄 Tool Page Link Verification:\n');
  
  for (const toolPage of toolPages) {
    const status = verifyLinks(toolPage);
    const toolName = toolPage.replace('tools/', '').replace('/index.html', '');
    
    console.log(`🔧 ${toolName}:`);
    
    if (status.error) {
      console.log(`   ❌ Error: ${status.error}`);
      brokenPages++;
    } else {
      if (status.hasAuth) {
        console.log(`   ✅ Has authentication elements`);
        pagesWithAuth++;
        
        if (status.hasCorrectLinks) {
          console.log(`   ✅ All links correct`);
          correctPages++;
        } else {
          console.log(`   ❌ Link issues found:`);
          console.log(`      Auth: ${status.details.authLink}`);
          console.log(`      Dashboard: ${status.details.dashboardLink}`);
          console.log(`      Profile: ${status.details.profileLink}`);
        }
        
        if (status.hasBrokenLinks) {
          console.log(`   🚨 BROKEN ABSOLUTE PATHS FOUND!`);
          brokenPages++;
        }
      } else {
        console.log(`   ❌ Missing authentication elements`);
      }
    }
    console.log('');
  }
  
  console.log(`📊 Summary:`);
  console.log(`📝 Total pages: ${toolPages.length}`);
  console.log(`✅ Pages with auth: ${pagesWithAuth}`);
  console.log(`✅ Pages with correct links: ${correctPages}`);
  console.log(`❌ Pages with issues: ${toolPages.length - correctPages}`);
  console.log(`🚨 Pages with broken links: ${brokenPages}`);
  
  if (brokenPages > 0) {
    console.log('\n🚨 URGENT: Some pages have broken absolute paths that will cause 404 errors!');
  }
}

if (require.main === module) {
  main();
}

module.exports = { verifyLinks };