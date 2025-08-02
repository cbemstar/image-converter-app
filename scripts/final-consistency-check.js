#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Final consistency checks and fixes
const finalMappings = {
  // Fix any remaining double HSL wrapping
  'hsl\\(hsl\\(var\\(--([^)]+)\\)\\)': 'hsl(var(--$1))',
  'hsl\\(hsl\\(var\\(--([^)]+)\\) / ([0-9.]+)\\)': 'hsl(var(--$1) / $2)',
  
  // Remove redundant important declarations where not needed
  'hsl\\(var\\(--background\\)\\)\\s*!important': 'hsl(var(--background))',
  'hsl\\(var\\(--foreground\\)\\)\\s*!important': 'hsl(var(--foreground))',
  'hsl\\(var\\(--card\\)\\)\\s*!important': 'hsl(var(--card))',
  
  // Standardize spacing values
  'gap:\\s*8px': 'gap: var(--spacing-2)',
  'margin:\\s*0\\.5rem': 'margin: var(--spacing-2)',
  'padding:\\s*0\\.75rem\\s+1\\.5rem': 'padding: var(--spacing-3) var(--spacing-6)',
  'padding:\\s*1rem\\s+1\\.5rem': 'padding: var(--spacing-4) var(--spacing-6)',
  
  // Fix transition inconsistencies
  'transition:\\s*all\\s+0\\.3s\\s+ease': 'transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  'transition:\\s*transform\\s+0\\.18s,\\s*box-shadow\\s+0\\.18s,\\s*border\\s+0\\.18s': 'transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Remove hardcoded colors
  '#cde5da': 'hsl(var(--primary))',
  '#172f37': 'hsl(var(--primary-foreground))',
  '#ffb347': 'hsl(39 100% 64%)', // warning color
  '#ff6b6b': 'hsl(var(--destructive))',
  '#22c55e': 'hsl(142 76% 36%)', // success color
  '#f59e0b': 'hsl(45 93% 47%)', // warning color
  
  // Standardize font weights
  'font-weight:\\s*500': 'font-weight: 500',
  'font-weight:\\s*600': 'font-weight: 600',
  'font-weight:\\s*700': 'font-weight: 700',
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

function finalCheck(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  Object.entries(finalMappings).forEach(([pattern, replacement]) => {
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
    console.log(`✅ Final check: ${filePath}`);
  } else {
    console.log(`✅ Already consistent: ${filePath}`);
  }
}

function generateReport() {
  console.log('\n📊 Final Consistency Report:\n');
  
  const allFiles = getAllFiles(['html', 'css', 'js']);
  let totalIssues = 0;
  
  // Check for common issues
  const issuePatterns = [
    { pattern: 'hsl\\(hsl\\(', description: 'Double HSL wrapping' },
    { pattern: 'var\\(--[^)]+\\)\\s*!important', description: 'Unnecessary !important with CSS variables' },
    { pattern: '#[0-9a-fA-F]{6}', description: 'Hardcoded hex colors' },
    { pattern: 'style="[^"]*color:', description: 'Inline color styles' },
    { pattern: 'transition:\\s*all\\s+[0-9.]+s', description: 'Non-standard transitions' },
  ];
  
  allFiles.forEach(file => {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');
    
    issuePatterns.forEach(({ pattern, description }) => {
      const matches = content.match(new RegExp(pattern, 'g'));
      if (matches) {
        console.log(`⚠️  ${file}: ${matches.length} instances of ${description}`);
        totalIssues += matches.length;
      }
    });
  });
  
  if (totalIssues === 0) {
    console.log('🎉 All files are consistent with shadcn design system!');
  } else {
    console.log(`\n📋 Total issues found: ${totalIssues}`);
    console.log('Run the script again to fix remaining issues.');
  }
}

function main() {
  console.log('🔍 Phase 3: Final consistency check and cleanup...\n');
  
  const allFiles = getAllFiles(['html', 'css']);
  console.log(`Processing ${allFiles.length} files:\n`);
  
  allFiles.forEach(file => {
    console.log(`Final check: ${file}`);
    finalCheck(file);
    console.log('');
  });
  
  generateReport();
  console.log('\n✨ Final consistency check complete!');
}

if (require.main === module) {
  main();
}

module.exports = { finalCheck, finalMappings };