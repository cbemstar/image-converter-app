#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Class mapping from current to shadcn equivalents
const classMap = {
  // Button mappings
  'btn btn-outline': 'btn btn-outline',
  'btn btn-outline primary': 'btn',
  'btn btn-outline secondary': 'btn btn-secondary',
  'btn btn-outline ghost': 'btn btn-ghost',
  
  // Input mappings
  'input': 'input',
  
  // Label mappings
  'label': 'label',
  
  // Card mappings
  'card': 'card',
  
  // Color mappings (CSS custom properties to Tailwind classes)
  'bg-\\[var\\(--background\\)\\]': 'bg-background',
  'text-\\[var\\(--foreground\\)\\]': 'text-foreground',
  'border-\\[var\\(--foreground\\)\\]/30': 'border-border',
  'border-\\[var\\(--foreground\\)\\]/20': 'border-border/20',
  'text-\\[var\\(--primary\\)\\]': 'text-primary',
  'bg-\\[var\\(--primary\\)\\]': 'bg-primary',
  'bg-\\[var\\(--card\\)\\]': 'bg-card',
  'text-\\[var\\(--card-foreground\\)\\]': 'text-card-foreground',
  'bg-\\[var\\(--accent\\)\\]': 'bg-accent',
  'text-\\[var\\(--accent-foreground\\)\\]': 'text-accent-foreground',
  
  // Specific component classes
  'btn': 'btn',
  'input': 'input',
};

// Files to process
const filePatterns = [
  './index.html',
  './tools/**/*.html',
  './tools/**/*.js',
  './*.js'
];

function getAllFiles(patterns) {
  const files = [];
  patterns.forEach(pattern => {
    try {
      const result = execSync(`find . -path "./node_modules" -prune -o -path "./.git" -prune -o -name "${pattern.replace('./', '').replace('**/', '*')}" -type f -print`, { encoding: 'utf8' });
      files.push(...result.trim().split('\n').filter(f => f && !f.includes('node_modules') && !f.includes('.git')));
    } catch (error) {
      // Handle pattern not found
    }
  });
  
  // Also manually add known files
  const knownFiles = [
    './index.html',
    './home.js',
    './layout.js',
    './utils.js'
  ];
  
  knownFiles.forEach(file => {
    if (fs.existsSync(file) && !files.includes(file)) {
      files.push(file);
    }
  });
  
  return [...new Set(files)]; // Remove duplicates
}

function replaceInFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  Object.entries(classMap).forEach(([oldClass, newClass]) => {
    const regex = new RegExp(`\\b${oldClass}\\b`, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newClass);
      changed = true;
      console.log(`  ${oldClass} → ${newClass} (${matches.length} occurrences)`);
    }
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
  } else {
    console.log(`⏭️  No changes: ${filePath}`);
  }
}

function main() {
  console.log('🚀 Starting shadcn class migration...\n');
  
  const files = getAllFiles(filePatterns);
  console.log(`Found ${files.length} files to process:\n`);
  
  files.forEach(file => {
    console.log(`Processing: ${file}`);
    replaceInFile(file);
    console.log('');
  });
  
  console.log('✨ Migration complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Review the changes with git diff');
  console.log('2. Test the application locally');
  console.log('3. Fix any remaining styling issues');
}

if (require.main === module) {
  main();
}

module.exports = { classMap, replaceInFile };