#!/usr/bin/env node

/**
 * Script to fix navigation links in tool pages
 * Run with: node fix-navigation-links.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all tool pages
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

function fixNavigationLinks(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${fullPath}`);
    return false;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // Fix auth.html links (from /auth.html to ../../auth.html)
    if (content.includes('href="/auth.html"')) {
      content = content.replace(/href="\/auth\.html"/g, 'href="../../auth.html"');
      changed = true;
    }

    // Fix dashboard.html links (from /dashboard.html to ../../dashboard.html)
    if (content.includes('href="/dashboard.html"')) {
      content = content.replace(/href="\/dashboard\.html"/g, 'href="../../dashboard.html"');
      changed = true;
    }

    // Fix profile.html links (from /profile.html to ../../profile.html)
    if (content.includes('href="/profile.html"')) {
      content = content.replace(/href="\/profile\.html"/g, 'href="../../profile.html"');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Fixed links in: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️  No link fixes needed: ${filePath}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

function ensureThemeToggleWorks(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // Check if theme.js is loaded as module (which can cause issues)
    if (content.includes('type="module" src="../../styles/theme.js"')) {
      content = content.replace(
        'type="module" src="../../styles/theme.js"',
        'src="../../styles/theme.js"'
      );
      changed = true;
    }

    // Ensure theme.js is loaded before other scripts
    if (!content.includes('<script src="../../styles/theme.js"></script>')) {
      // Add theme.js script if missing
      const scriptInsertPoint = content.indexOf('</head>');
      if (scriptInsertPoint !== -1) {
        const themeScript = '  <script src="../../styles/theme.js"></script>\n';
        content = content.slice(0, scriptInsertPoint) + themeScript + content.slice(scriptInsertPoint);
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Fixed theme toggle in: ${filePath}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.log(`❌ Error fixing theme in ${filePath}: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔧 Fixing navigation links and theme toggle in tool pages...\n');
  
  const toolPages = getToolPages();
  
  if (toolPages.length === 0) {
    console.log('❌ No tool pages found');
    return;
  }

  let linksFixed = 0;
  let themesFixed = 0;
  
  for (const toolPage of toolPages) {
    console.log(`\n📄 Processing: ${toolPage}`);
    
    if (fixNavigationLinks(toolPage)) {
      linksFixed++;
    }
    
    if (ensureThemeToggleWorks(toolPage)) {
      themesFixed++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`🔗 Links fixed: ${linksFixed} pages`);
  console.log(`🎨 Theme toggle fixed: ${themesFixed} pages`);
  console.log(`📝 Total pages processed: ${toolPages.length}`);
  
  if (linksFixed > 0 || themesFixed > 0) {
    console.log('\n🎉 Navigation improvements applied!');
    console.log('📋 Next steps:');
    console.log('1. Test sign-in links on tool pages');
    console.log('2. Verify theme toggle functionality');
    console.log('3. Check dashboard/profile navigation');
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixNavigationLinks, ensureThemeToggleWorks };