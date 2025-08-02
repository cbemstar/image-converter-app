#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Fix double HSL wrapping and other style issues
const styleCleanupMappings = {
  // Fix double HSL wrapping
  'hsl\\(hsl\\(var\\(--([^)]+)\\)\\)': 'hsl(var(--$1))',
  'hsl\\(hsl\\(var\\(--([^)]+)\\) / ([0-9.]+)\\)': 'hsl(var(--$1) / $2)',
  
  // Standardize color references
  'style="color:var\\(--foreground\\);"': 'class="text-foreground"',
  'style="color:var\\(--primary\\);"': 'class="text-primary"',
  'style="background-color:var\\(--background\\);"': 'class="bg-background"',
  
  // Update remaining inline styles to use classes
  'class="text-\\[var\\(--foreground\\)\\]"': 'class="text-foreground"',
  'class="bg-\\[var\\(--background\\)\\]"': 'class="bg-background"',
  'class="border-\\[var\\(--border\\)\\]"': 'class="border-border"',
  
  // Fix spacing inconsistencies
  'p-2 p-2': 'p-2',
  'btn btn-outline btn-outline': 'btn btn-outline',
  'btn btn-sm btn-sm': 'btn btn-sm',
  
  // Standardize button classes
  'class="btn btn-outline btn-sm p-2"': 'class="btn btn-outline btn-sm"',
  'class="btn btn-sm p-2"': 'class="btn btn-sm"',
};

// CSS-specific cleanup
const cssCleanupMappings = {
  // Remove redundant important declarations
  'hsl\\(var\\(--([^)]+)\\)\\s*!important': 'hsl(var(--$1))',
  
  // Standardize transitions
  'transition:\\s*all\\s+0\\.2s': 'transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  'transition:\\s*background\\s+0\\.2s,\\s*color\\s+0\\.2s,\\s*border-color\\s+0\\.2s': 'transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Fix border radius inconsistencies
  'border-radius:\\s*0\\.375rem': 'border-radius: calc(var(--radius) - 2px)',
  'border-radius:\\s*0\\.75rem': 'border-radius: var(--radius)',
  'border-radius:\\s*1\\.25rem': 'border-radius: calc(var(--radius) + 4px)',
  
  // Standardize font sizes
  'font-size:\\s*0\\.875rem': 'font-size: var(--text-sm)',
  'font-size:\\s*1rem': 'font-size: var(--text-base)',
  'font-size:\\s*1\\.125rem': 'font-size: var(--text-lg)',
  'font-size:\\s*1\\.25rem': 'font-size: var(--text-xl)',
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

function cleanupFile(filePath, mappings) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  Object.entries(mappings).forEach(([pattern, replacement]) => {
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
    console.log(`✅ Cleaned: ${filePath}`);
  } else {
    console.log(`⏭️  No cleanup needed: ${filePath}`);
  }
}

function main() {
  console.log('🧹 Phase 3: Bulk style cleanup and migration...\n');
  
  // Process HTML files
  const htmlFiles = getAllFiles(['html']);
  console.log(`Processing ${htmlFiles.length} HTML files:\n`);
  
  htmlFiles.forEach(file => {
    console.log(`Cleaning HTML: ${file}`);
    cleanupFile(file, styleCleanupMappings);
    console.log('');
  });
  
  // Process CSS files
  const cssFiles = getAllFiles(['css']).filter(f => !f.includes('shadcn-'));
  console.log(`Processing ${cssFiles.length} CSS files:\n`);
  
  cssFiles.forEach(file => {
    console.log(`Cleaning CSS: ${file}`);
    cleanupFile(file, cssCleanupMappings);
    console.log('');
  });
  
  console.log('✨ Style cleanup complete!');
}

if (require.main === module) {
  main();
}

module.exports = { cleanupFile, styleCleanupMappings, cssCleanupMappings };