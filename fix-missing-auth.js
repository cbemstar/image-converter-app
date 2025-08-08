#!/usr/bin/env node

/**
 * Script to add missing authentication elements to tool pages
 */

const fs = require('fs');
const path = require('path');

// Pages that need authentication elements added
const PAGES_TO_FIX = [
  'tools/pdf-ocr/index.html',
  'tools/timestamp-converter/index.html', 
  'tools/request-tool/index.html',
  'tools/campaign-structure/index.html',
  'tools/meta-tag-generator/index.html',
  'tools/bulk-match-editor/index.html',
  'tools/google-ads-rsa-preview/index.html'
];

const AUTH_ELEMENTS = `          <!-- Guest User -->
          <div data-guest-only class="flex items-center gap-2">
            <a href="../../auth.html" class="btn btn-outline btn-sm">
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
                <li><a href="../../dashboard.html" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-tachometer-alt"></i>Dashboard</a></li>
                <li><a href="../../profile.html" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-user"></i>Profile</a></li>
                <li><a href="#" data-action="signout" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-sign-out-alt"></i>Sign Out</a></li>
              </ul>
            </div>
          </div>
          
`;

function addAuthElements(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${fullPath}`);
    return false;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Pattern to match the theme toggle section
    const themeTogglePattern = /(\s+)<div class="flex items-center gap-2">\s*<button id="theme-toggle" class="btn btn-outline btn-sm" aria-label="Toggle theme">\s*<span id="theme-toggle-icon">🌙<\/span>\s*<\/button>\s*<\/div>/;
    
    if (themeTogglePattern.test(content)) {
      // Replace with auth elements + theme toggle
      content = content.replace(themeTogglePattern, `$1<div class="flex items-center gap-2">
${AUTH_ELEMENTS}          <button id="theme-toggle" class="btn btn-outline btn-sm" aria-label="Toggle theme">
            <span id="theme-toggle-icon">🌙</span>
          </button>
        </div>`);
      
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Added auth elements to: ${filePath}`);
      return true;
    } else {
      console.log(`❌ Could not find theme toggle pattern in: ${filePath}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔧 Adding missing authentication elements to tool pages...\n');
  
  let fixed = 0;
  let failed = 0;
  
  for (const page of PAGES_TO_FIX) {
    if (addAuthElements(page)) {
      fixed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Fixed: ${fixed} pages`);
  console.log(`❌ Failed: ${failed} pages`);
  console.log(`📝 Total processed: ${PAGES_TO_FIX.length} pages`);
  
  if (fixed > 0) {
    console.log('\n🎉 Authentication elements added successfully!');
    console.log('📋 Next steps:');
    console.log('1. Test sign-in links on updated pages');
    console.log('2. Verify dropdown functionality');
    console.log('3. Check theme toggle still works');
  }
}

if (require.main === module) {
  main();
}

module.exports = { addAuthElements };