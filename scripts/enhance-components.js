#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Enhanced component mappings for Phase 2
const enhancedMappings = {
  // Color class mappings
  'text-\\[var\\(--foreground\\)\\]': 'text-foreground',
  'text-\\[var\\(--primary\\)\\]': 'text-primary',
  'text-\\[var\\(--muted-foreground\\)\\]': 'text-muted-foreground',
  'bg-\\[var\\(--background\\)\\]': 'bg-background',
  'bg-\\[var\\(--card\\)\\]': 'bg-card',
  'bg-\\[var\\(--primary\\)\\]': 'bg-primary',
  'border-\\[var\\(--border\\)\\]': 'border-border',
  'border-\\[var\\(--foreground\\)\\]': 'border-foreground',
  
  // Hover states
  'hover:text-\\[var\\(--primary\\)\\]': 'hover:text-primary',
  'hover:bg-\\[var\\(--accent\\)\\]': 'hover:bg-accent',
  'hover:text-\\[var\\(--accent-foreground\\)\\]': 'hover:text-accent-foreground',
  
  // Focus states
  'focus:ring-\\[var\\(--ring\\)\\]': 'focus:ring-ring',
  'focus:border-\\[var\\(--ring\\)\\]': 'focus:border-ring',
  
  // Specific component improvements
  'p-2': 'p-2',
  'px-4 py-2': 'px-4 py-2',
  'rounded-md': 'rounded-md',
  'rounded-lg': 'rounded-lg',
  
  // Button size variants
  'btn btn-outline p-2': 'btn btn-outline btn-sm',
  'btn p-2': 'btn btn-sm',
};

// CSS-specific mappings
const cssMappings = {
  'var\\(--foreground\\)': 'hsl(var(--foreground))',
  'var\\(--background\\)': 'hsl(var(--background))',
  'var\\(--primary\\)': 'hsl(var(--primary))',
  'var\\(--border\\)': 'hsl(var(--border))',
  'var\\(--card\\)': 'hsl(var(--card))',
  'var\\(--muted-foreground\\)': 'hsl(var(--muted-foreground))',
  'var\\(--ring\\)': 'hsl(var(--ring))',
  'var\\(--accent\\)': 'hsl(var(--accent))',
  'var\\(--destructive\\)': 'hsl(var(--destructive))',
};

function getAllFiles(extensions) {
  const files = [];
  extensions.forEach(ext => {
    try {
      const result = execSync(`find . -name "*.${ext}" -not -path "./node_modules/*" -not -path "./.git/*"`, { encoding: 'utf8' });
      files.push(...result.trim().split('\n').filter(f => f));
    } catch (error) {
      // Handle pattern not found
    }
  });
  return [...new Set(files)];
}

function enhanceHtmlFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  Object.entries(enhancedMappings).forEach(([oldPattern, newPattern]) => {
    const regex = new RegExp(oldPattern, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newPattern);
      changed = true;
      console.log(`  ${oldPattern} → ${newPattern} (${matches.length} occurrences)`);
    }
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Enhanced: ${filePath}`);
  } else {
    console.log(`⏭️  No enhancements: ${filePath}`);
  }
}

function enhanceCssFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  Object.entries(cssMappings).forEach(([oldPattern, newPattern]) => {
    const regex = new RegExp(oldPattern, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newPattern);
      changed = true;
      console.log(`  ${oldPattern} → ${newPattern} (${matches.length} occurrences)`);
    }
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Enhanced CSS: ${filePath}`);
  } else {
    console.log(`⏭️  No CSS enhancements: ${filePath}`);
  }
}

function main() {
  console.log('🔧 Phase 2: Enhancing component consistency...\n');
  
  // Process HTML files
  const htmlFiles = getAllFiles(['html']);
  console.log(`Processing ${htmlFiles.length} HTML files:\n`);
  
  htmlFiles.forEach(file => {
    console.log(`Processing HTML: ${file}`);
    enhanceHtmlFile(file);
    console.log('');
  });
  
  // Process CSS files
  const cssFiles = getAllFiles(['css']).filter(f => !f.includes('shadcn-'));
  console.log(`Processing ${cssFiles.length} CSS files:\n`);
  
  cssFiles.forEach(file => {
    console.log(`Processing CSS: ${file}`);
    enhanceCssFile(file);
    console.log('');
  });
  
  console.log('✨ Component enhancement complete!');
}

if (require.main === module) {
  main();
}

module.exports = { enhanceHtmlFile, enhanceCssFile };