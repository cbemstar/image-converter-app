#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Accessibility checks to perform
const accessibilityChecks = [
  {
    name: 'Skip Links',
    check: (content) => content.includes('Skip to main content'),
    description: 'Page should have skip navigation links'
  },
  {
    name: 'ARIA Labels',
    check: (content) => content.includes('aria-label='),
    description: 'Interactive elements should have ARIA labels'
  },
  {
    name: 'Form Labels',
    check: (content) => {
      const inputs = (content.match(/<input[^>]*>/g) || []).length;
      const labels = (content.match(/<label[^>]*>/g) || []).length;
      const ariaLabels = (content.match(/aria-label=/g) || []).length;
      return inputs === 0 || labels > 0 || ariaLabels > 0;
    },
    description: 'Form inputs should have associated labels'
  },
  {
    name: 'Button Text',
    check: (content) => {
      const buttons = content.match(/<button[^>]*>([^<]*)</g) || [];
      return buttons.every(btn => {
        const text = btn.replace(/<button[^>]*>/, '').trim();
        return text.length > 0 || btn.includes('aria-label=');
      });
    },
    description: 'Buttons should have descriptive text or ARIA labels'
  },
  {
    name: 'Image Alt Text',
    check: (content) => {
      const images = content.match(/<img[^>]*>/g) || [];
      return images.every(img => img.includes('alt='));
    },
    description: 'Images should have alt text'
  },
  {
    name: 'Heading Hierarchy',
    check: (content) => {
      const headings = content.match(/<h[1-6][^>]*>/g) || [];
      return headings.length > 0;
    },
    description: 'Page should have proper heading structure'
  },
  {
    name: 'Focus Management',
    check: (content) => content.includes('focus-visible') || content.includes(':focus'),
    description: 'Interactive elements should have focus indicators'
  },
  {
    name: 'Color Contrast',
    check: (content) => {
      // Check if using shadcn design tokens (which have good contrast)
      return content.includes('text-foreground') && content.includes('bg-background');
    },
    description: 'Should use design tokens with proper contrast ratios'
  },
  {
    name: 'Semantic HTML',
    check: (content) => {
      return content.includes('<main') && content.includes('<nav') && 
             (content.includes('<section') || content.includes('<article'));
    },
    description: 'Should use semantic HTML elements'
  },
  {
    name: 'Keyboard Navigation',
    check: (content) => content.includes('tabindex') || content.includes('role='),
    description: 'Should support keyboard navigation'
  }
];

function auditFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { error: 'File not found' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const results = {
    passed: 0,
    failed: 0,
    total: accessibilityChecks.length,
    checks: []
  };
  
  accessibilityChecks.forEach(check => {
    const passed = check.check(content);
    results.checks.push({
      name: check.name,
      passed,
      description: check.description
    });
    
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  });
  
  return results;
}

function generateAccessibilityReport() {
  console.log('♿ Accessibility Audit Report\n');
  console.log('=' .repeat(60));
  
  const toolsToAudit = [
    { name: 'Homepage', path: 'index.html' },
    { name: 'Image Converter', path: 'tools/image-converter/index.html' },
    { name: 'JSON Formatter', path: 'tools/json-formatter/index.html' },
    { name: 'Layout Generator', path: 'tools/layout-tool/index.html' },
    { name: 'QR Generator', path: 'tools/qr-generator/index.html' },
    { name: 'Test Page', path: 'test-shadcn-styling.html' }
  ];
  
  const overallResults = {
    totalPassed: 0,
    totalFailed: 0,
    totalChecks: 0,
    fileResults: []
  };
  
  toolsToAudit.forEach(tool => {
    console.log(`\n♿ Auditing: ${tool.name}`);
    console.log('-'.repeat(40));
    
    const results = auditFile(tool.path);
    
    if (results.error) {
      console.log(`❌ ERROR: ${results.error}`);
      return;
    }
    
    overallResults.totalPassed += results.passed;
    overallResults.totalFailed += results.failed;
    overallResults.totalChecks += results.total;
    overallResults.fileResults.push({ tool: tool.name, results });
    
    results.checks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.description}`);
    });
    
    const score = Math.round((results.passed / results.total) * 100);
    console.log(`\nScore: ${results.passed}/${results.total} (${score}%)`);
  });
  
  // Overall summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 OVERALL ACCESSIBILITY SUMMARY');
  console.log('='.repeat(60));
  
  const overallScore = Math.round((overallResults.totalPassed / overallResults.totalChecks) * 100);
  console.log(`✅ Total Passed: ${overallResults.totalPassed}`);
  console.log(`❌ Total Failed: ${overallResults.totalFailed}`);
  console.log(`📊 Overall Score: ${overallScore}%`);
  
  // Recommendations
  console.log('\n💡 ACCESSIBILITY RECOMMENDATIONS:');
  
  if (overallScore >= 90) {
    console.log('🎉 Excellent accessibility compliance!');
  } else if (overallScore >= 75) {
    console.log('✅ Good accessibility, minor improvements needed');
  } else if (overallScore >= 60) {
    console.log('⚠️  Moderate accessibility, several improvements needed');
  } else {
    console.log('❌ Poor accessibility, significant improvements required');
  }
  
  // Common issues
  const commonIssues = {};
  overallResults.fileResults.forEach(({ results }) => {
    results.checks.forEach(check => {
      if (!check.passed) {
        commonIssues[check.name] = (commonIssues[check.name] || 0) + 1;
      }
    });
  });
  
  if (Object.keys(commonIssues).length > 0) {
    console.log('\n🔧 MOST COMMON ISSUES:');
    Object.entries(commonIssues)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([issue, count]) => {
        console.log(`• ${issue}: ${count} files affected`);
      });
  }
  
  return overallResults;
}

function main() {
  console.log('🚀 Starting Accessibility Audit...\n');
  const results = generateAccessibilityReport();
  
  console.log('\n✨ Accessibility audit complete!');
  
  // Exit with appropriate code based on score
  const overallScore = Math.round((results.totalPassed / results.totalChecks) * 100);
  if (overallScore >= 90) {
    process.exit(0);
  } else if (overallScore >= 75) {
    process.exit(1);
  } else {
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = { auditFile, generateAccessibilityReport };