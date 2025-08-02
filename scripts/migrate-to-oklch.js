#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// OKLCH color migration mappings
const oklchMappings = {
  // Fix HSL to OKLCH variable references
  'hsl\\(var\\(--([^)]+)\\)\\)': 'var(--$1)', // Fix double closing parentheses
  'hsl\\(var\\(--([^)]+)\\)': 'var(--$1)', // Convert HSL wrapper to direct variable
  
  // Update color references to use OKLCH variables directly
  'background-color:\\s*hsl\\(var\\(--background\\)\\)': 'background-color: var(--background)',
  'color:\\s*hsl\\(var\\(--foreground\\)\\)': 'color: var(--foreground)',
  'border-color:\\s*hsl\\(var\\(--border\\)\\)': 'border-color: var(--border)',
  'border:\\s*1px\\s+solid\\s+hsl\\(var\\(--([^)]+)\\)\\)': 'border: 1px solid var(--$1)',
  
  // Fix common syntax errors
  '\\)\\)': ')', // Remove double closing parentheses
  'var\\(--([^)]+)\\)\\)': 'var(--$1)', // Fix variable syntax
  
  // Update shadow references
  'box-shadow:\\s*0\\s+1px\\s+3px\\s+0\\s+rgb\\(0\\s+0%\\s+0%\\s+/\\s+0\\.1\\)': 'box-shadow: var(--shadow-sm)',
  'box-shadow:\\s*0\\s+4px\\s+12px\\s+0\\s+rgb\\(0\\s+0%\\s+0%\\s+/\\s+0\\.15\\)': 'box-shadow: var(--shadow-lg)',
  
  // Update font references
  'font-family:\\s*[\'"]Inter[\'"],\\s*[\'"]Segoe\\s+UI[\'"],\\s*Arial,\\s*sans-serif': 'font-family: var(--font-sans)',
  
  // Update spacing references
  'padding:\\s*1\\.5rem': 'padding: var(--spacing-6)',
  'margin-bottom:\\s*0\\.5rem': 'margin-bottom: var(--spacing-2)',
  'margin-bottom:\\s*0\\.375rem': 'margin-bottom: var(--spacing-3)',
  'gap:\\s*0\\.375rem': 'gap: var(--spacing-3)',
  
  // Update border radius
  'border-radius:\\s*0\\.5rem': 'border-radius: calc(var(--radius) - 2px)',
  
  // Update letter spacing
  'letter-spacing:\\s*-0\\.025em': 'letter-spacing: var(--tracking-tight)',
};

function getAllFiles(extensions) {
  const files = [];
  extensions.forEach(ext => {
    try {
      const result = execSync(`find . -name "*.${ext}" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./scripts/*"`, { encoding: 'utf8' });
      files.push(...result.trim().split('\n').filter(f => f));
    } catch (error) {
      // Handle pattern not found
    }
  });
  return [...new Set(files)];
}

function migrateToOklch(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  Object.entries(oklchMappings).forEach(([pattern, replacement]) => {
    const regex = new RegExp(pattern, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, replacement);
      changed = true;
      console.log(`  ${pattern} → ${replacement} (${matches.length} occurrences)`);
    }
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Migrated to OKLCH: ${filePath}`);
  } else {
    console.log(`⏭️  Already OKLCH compliant: ${filePath}`);
  }
}

function generateOklchReport() {
  console.log('🎨 OKLCH Color Migration Report\n');
  console.log('=' .repeat(60));
  
  const allFiles = getAllFiles(['css', 'html']);
  console.log(`Processing ${allFiles.length} files:\n`);
  
  let totalChanges = 0;
  
  allFiles.forEach(file => {
    console.log(`Migrating: ${file}`);
    const beforeContent = fs.readFileSync(file, 'utf8');
    migrateToOklch(file);
    const afterContent = fs.readFileSync(file, 'utf8');
    
    if (beforeContent !== afterContent) {
      totalChanges++;
    }
    console.log('');
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 OKLCH MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Files processed: ${allFiles.length}`);
  console.log(`🔄 Files changed: ${totalChanges}`);
  console.log(`⏭️  Files unchanged: ${allFiles.length - totalChanges}`);
  
  console.log('\n💡 NEXT STEPS:');
  console.log('• Test the application with new OKLCH colors');
  console.log('• Verify theme switching works correctly');
  console.log('• Check color consistency across all tools');
  console.log('• Update any remaining hardcoded colors');
  
  return { processed: allFiles.length, changed: totalChanges };
}

function main() {
  console.log('🚀 Starting OKLCH Color Migration...\n');
  const results = generateOklchReport();
  
  console.log('\n✨ OKLCH migration complete!');
  
  if (results.changed > 0) {
    console.log(`\n🎉 Successfully migrated ${results.changed} files to use OKLCH colors!`);
  } else {
    console.log('\n✅ All files are already OKLCH compliant!');
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateToOklch, oklchMappings };