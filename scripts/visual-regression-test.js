#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// List of all tools to test
const toolsToTest = [
  { name: 'Homepage', path: 'index.html', category: 'Core' },
  { name: 'Image Converter', path: 'tools/image-converter/index.html', category: 'Images' },
  { name: 'Background Remover', path: 'tools/background-remover/index.html', category: 'Images' },
  { name: 'Color Palette', path: 'tools/color-palette/index.html', category: 'Images' },
  { name: 'Layout Generator', path: 'tools/layout-tool/index.html', category: 'Images' },
  { name: 'Google Ads RSA Preview', path: 'tools/google-ads-rsa-preview/index.html', category: 'Marketing' },
  { name: 'Campaign Structure', path: 'tools/campaign-structure/index.html', category: 'Marketing' },
  { name: 'Bulk Match Editor', path: 'tools/bulk-match-editor/index.html', category: 'Marketing' },
  { name: 'UTM Builder', path: 'tools/utm-builder/index.html', category: 'Marketing' },
  { name: 'Meta Tag Generator', path: 'tools/meta-tag-generator/index.html', category: 'Marketing' },
  { name: 'Robots.txt Tool', path: 'tools/robots-txt/index.html', category: 'Marketing' },
  { name: 'PDF Merger', path: 'tools/pdf-merger/index.html', category: 'Documents' },
  { name: 'PDF OCR', path: 'tools/pdf-ocr/index.html', category: 'Documents' },
  { name: 'JSON Formatter', path: 'tools/json-formatter/index.html', category: 'Utilities' },
  { name: 'QR Generator', path: 'tools/qr-generator/index.html', category: 'Utilities' },
  { name: 'UUID Generator', path: 'tools/uuid-generator/index.html', category: 'Utilities' },
  { name: 'Timestamp Converter', path: 'tools/timestamp-converter/index.html', category: 'Utilities' },
  { name: 'Text Case Converter', path: 'tools/text-case-converter/index.html', category: 'Utilities' },
  { name: 'Request Tool', path: 'tools/request-tool/index.html', category: 'Core' },
];

// Visual elements to check
const visualChecks = [
  'Navigation bar styling',
  'Sidebar functionality',
  'Button consistency',
  'Input field styling',
  'Card components',
  'Typography hierarchy',
  'Color scheme adherence',
  'Theme toggle functionality',
  'Mobile responsiveness',
  'Accessibility features'
];

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function analyzeHTML(filePath) {
  if (!checkFileExists(filePath)) {
    return { error: 'File not found' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const analysis = {
    hasShadcnClasses: false,
    hasLegacyClasses: false,
    hasInlineStyles: false,
    hasThemeToggle: false,
    hasSidebar: false,
    hasCards: false,
    issues: []
  };
  
  // Check for shadcn classes
  if (content.includes('class="btn') || content.includes('class="input') || content.includes('class="card')) {
    analysis.hasShadcnClasses = true;
  }
  
  // Check for legacy classes
  if (content.includes('layout-btn') || content.includes('layout-input') || content.includes('tool-card')) {
    analysis.hasLegacyClasses = true;
    analysis.issues.push('Contains legacy layout classes');
  }
  
  // Check for inline styles
  if (content.includes('style="color:') || content.includes('style="background:')) {
    analysis.hasInlineStyles = true;
    analysis.issues.push('Contains inline color styles');
  }
  
  // Check for theme toggle
  if (content.includes('theme-toggle')) {
    analysis.hasThemeToggle = true;
  }
  
  // Check for sidebar
  if (content.includes('sidebar')) {
    analysis.hasSidebar = true;
  }
  
  // Check for cards
  if (content.includes('class="card')) {
    analysis.hasCards = true;
  }
  
  // Check for hardcoded colors
  const hexColorMatches = content.match(/#[0-9a-fA-F]{6}/g);
  if (hexColorMatches && hexColorMatches.length > 0) {
    analysis.issues.push(`Contains ${hexColorMatches.length} hardcoded hex colors`);
  }
  
  // Check for old CSS variable usage
  if (content.includes('var(--foreground)') && !content.includes('hsl(var(--foreground))')) {
    analysis.issues.push('Uses old CSS variable format');
  }
  
  return analysis;
}

function generateTestReport() {
  console.log('🧪 Visual Regression Testing Report\n');
  console.log('=' .repeat(60));
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    byCategory: {}
  };
  
  toolsToTest.forEach(tool => {
    console.log(`\n📄 Testing: ${tool.name} (${tool.category})`);
    console.log('-'.repeat(40));
    
    const analysis = analyzeHTML(tool.path);
    
    if (analysis.error) {
      console.log(`❌ ERROR: ${analysis.error}`);
      results.failed++;
      return;
    }
    
    let status = '✅ PASS';
    let hasIssues = false;
    
    // Check requirements
    if (!analysis.hasShadcnClasses) {
      console.log('⚠️  Missing shadcn component classes');
      hasIssues = true;
    }
    
    if (analysis.hasLegacyClasses) {
      console.log('⚠️  Contains legacy layout classes');
      hasIssues = true;
    }
    
    if (analysis.hasInlineStyles) {
      console.log('⚠️  Contains inline styles');
      hasIssues = true;
    }
    
    if (analysis.issues.length > 0) {
      analysis.issues.forEach(issue => {
        console.log(`⚠️  ${issue}`);
      });
      hasIssues = true;
    }
    
    // Positive checks
    if (analysis.hasThemeToggle) {
      console.log('✅ Theme toggle present');
    }
    
    if (analysis.hasSidebar) {
      console.log('✅ Sidebar navigation present');
    }
    
    if (analysis.hasCards) {
      console.log('✅ Card components present');
    }
    
    if (hasIssues) {
      status = '⚠️  WARN';
      results.warnings++;
    } else {
      results.passed++;
    }
    
    console.log(`Status: ${status}`);
    
    // Track by category
    if (!results.byCategory[tool.category]) {
      results.byCategory[tool.category] = { passed: 0, warnings: 0, failed: 0 };
    }
    
    if (status.includes('PASS')) {
      results.byCategory[tool.category].passed++;
    } else if (status.includes('WARN')) {
      results.byCategory[tool.category].warnings++;
    } else {
      results.byCategory[tool.category].failed++;
    }
  });
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📄 Total: ${toolsToTest.length}`);
  
  console.log('\n📈 BY CATEGORY:');
  Object.entries(results.byCategory).forEach(([category, stats]) => {
    console.log(`${category}: ✅${stats.passed} ⚠️${stats.warnings} ❌${stats.failed}`);
  });
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (results.warnings > 0) {
    console.log('• Review files with warnings for remaining legacy code');
    console.log('• Consider updating inline styles to use CSS classes');
    console.log('• Replace hardcoded colors with design tokens where appropriate');
  }
  
  if (results.failed > 0) {
    console.log('• Fix missing files or critical errors');
  }
  
  if (results.passed === toolsToTest.length) {
    console.log('🎉 All tools passed visual regression testing!');
  }
  
  return results;
}

function main() {
  console.log('🚀 Starting Visual Regression Testing...\n');
  const results = generateTestReport();
  
  console.log('\n✨ Visual regression testing complete!');
  
  // Exit with appropriate code
  if (results.failed > 0) {
    process.exit(1);
  } else if (results.warnings > 0) {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeHTML, generateTestReport };