#!/usr/bin/env node

/**
 * Script to update tool pages with consistent navigation
 * Run with: node update-tool-navigation.js
 */

const fs = require('fs');
const path = require('path');

// Standard authentication navigation HTML
const AUTH_NAVIGATION = `          <!-- Guest User -->
          <div data-guest-only class="flex items-center gap-2">
            <a href="/auth.html" class="btn btn-outline btn-sm">
              <i class="fas fa-sign-in-alt mr-1"></i>
              Sign In
            </a>
          </div>
          
          <!-- Authenticated User -->
          <div data-auth-required class="flex items-center gap-2" style="display: none;">
            <div class="dropdown dropdown-end relative">
              <button class="btn btn-outline btn-sm dropdown-toggle" aria-label="User menu" aria-expanded="false">
                <img data-user-info="avatar" class="w-6 h-6 rounded-full mr-2" alt="User avatar" style="display: none;">
                <span data-user-info="name" class="hidden sm:inline">User</span>
                <i class="fas fa-chevron-down ml-1"></i>
              </button>
              <ul class="dropdown-content menu p-2 shadow bg-background border border-border rounded-lg w-52 absolute right-0 top-full mt-1 z-50" style="display: none;">
                <li><a href="/dashboard.html" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-tachometer-alt"></i>Dashboard</a></li>
                <li><a href="/profile.html" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-user"></i>Profile</a></li>
                <li><a href="#" data-action="signout" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-sign-out-alt"></i>Sign Out</a></li>
              </ul>
            </div>
          </div>
          
`;

// Tool pages that need updating
const TOOL_PAGES = [
  'bulk-match-editor',
  'campaign-structure', 
  'color-palette',
  'google-ads-rsa-preview',
  'layout-tool',
  'meta-tag-generator',
  'pdf-ocr',
  'robots-txt',
  'text-case-converter',
  'timestamp-converter',
  'uuid-generator',
  'request-tool'
];

function updateToolPage(toolName) {
  const filePath = path.join(__dirname, 'tools', toolName, 'index.html');
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern 1: Replace simple theme toggle without auth elements
    const pattern1 = /(\s+)<div class="flex items-center gap-2">\s*<button id="theme-toggle" class="btn btn-(?:outline )?btn-sm" aria-label="Toggle theme">\s*<span id="theme-toggle-icon">🌙<\/span>\s*<\/button>\s*<\/div>/g;
    
    if (pattern1.test(content)) {
      content = content.replace(pattern1, `$1<div class="flex items-center gap-2">
${AUTH_NAVIGATION}          <button id="theme-toggle" class="btn btn-outline btn-sm" aria-label="Toggle theme">
            <span id="theme-toggle-icon">🌙</span>
          </button>
        </div>`);
    }
    
    // Fix button classes - ensure all buttons have btn-outline
    content = content.replace(/class="btn btn-sm"/g, 'class="btn btn-outline btn-sm"');
    
    // Write the updated content back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${toolName}`);
    return true;
    
  } catch (error) {
    console.log(`❌ Error updating ${toolName}: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔧 Updating tool pages with consistent navigation...\n');
  
  let updated = 0;
  let failed = 0;
  
  for (const toolName of TOOL_PAGES) {
    if (updateToolPage(toolName)) {
      updated++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Updated: ${updated} pages`);
  console.log(`❌ Failed: ${failed} pages`);
  console.log(`📝 Total: ${TOOL_PAGES.length} pages processed`);
  
  if (updated > 0) {
    console.log('\n🎉 Navigation consistency improvements applied!');
    console.log('📋 Next steps:');
    console.log('1. Test authentication flow on updated pages');
    console.log('2. Verify theme toggle functionality');
    console.log('3. Check mobile responsiveness');
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateToolPage, TOOL_PAGES };