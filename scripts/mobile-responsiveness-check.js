#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Mobile responsiveness checks
const responsiveChecks = [
  {
    name: 'Viewport Meta Tag',
    check: (content) => content.includes('name="viewport"'),
    description: 'Page should have proper viewport meta tag'
  },
  {
    name: 'Responsive Grid',
    check: (content) => content.includes('grid') && (content.includes('md:') || content.includes('lg:')),
    description: 'Should use responsive grid classes'
  },
  {
    name: 'Mobile Navigation',
    check: (content) => content.includes('sidebar') && content.includes('hidden'),
    description: 'Should have collapsible mobile navigation'
  },
  {
    name: 'Responsive Text',
    check: (content) => content.includes('text-') && (content.includes('sm:') || content.includes('md:')),
    description: 'Should use responsive text sizing'
  },
  {
    name: 'Touch Targets',
    check: (content) => {
      // Check for adequate button padding
      return content.includes('p-2') || content.includes('p-3') || content.includes('p-4');
    },
    description: 'Interactive elements should have adequate touch targets'
  },
  {
    name: 'Responsive Spacing',
    check: (content) => content.includes('px-4') && content.includes('sm:px-6'),
    description: 'Should use responsive spacing'
  },
  {
    name: 'Mobile-First CSS',
    check: (content) => {
      // Check if mobile styles are defined first
      const mobileClasses = (content.match(/class="[^"]*\b(p-|m-|text-|w-|h-)/g) || []).length;
      const desktopClasses = (content.match(/class="[^"]*\b(md:|lg:|xl:)/g) || []).length;
      return mobileClasses > 0;
    },
    description: 'Should follow mobile-first approach'
  },
  {
    name: 'Flexible Images',
    check: (content) => {
      const images = content.match(/<img[^>]*>/g) || [];
      return images.every(img => 
        img.includes('max-w-') || img.includes('w-full') || img.includes('responsive')
      );
    },
    description: 'Images should be responsive'
  },
  {
    name: 'Overflow Handling',
    check: (content) => content.includes('overflow-') || content.includes('break-'),
    description: 'Should handle content overflow properly'
  },
  {
    name: 'Mobile Forms',
    check: (content) => {
      const forms = content.includes('<form') || content.includes('<input');
      if (!forms) return true; // No forms to check
      return content.includes('w-full') && content.includes('mb-');
    },
    description: 'Forms should be mobile-friendly'
  }
];

function checkMobileResponsiveness(filePath) {
  if (!fs.existsSync(filePath)) {
    return { error: 'File not found' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const results = {
    passed: 0,
    failed: 0,
    total: responsiveChecks.length,
    checks: []
  };
  
  responsiveChecks.forEach(check => {
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

function generateMobileReport() {
  console.log('📱 Mobile Responsiveness Report\n');
  console.log('=' .repeat(60));
  
  const toolsToCheck = [
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
  
  toolsToCheck.forEach(tool => {
    console.log(`\n📱 Checking: ${tool.name}`);
    console.log('-'.repeat(40));
    
    const results = checkMobileResponsiveness(tool.path);
    
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
    console.log(`\nMobile Score: ${results.passed}/${results.total} (${score}%)`);
  });
  
  // Overall summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 OVERALL MOBILE RESPONSIVENESS SUMMARY');
  console.log('='.repeat(60));
  
  const overallScore = Math.round((overallResults.totalPassed / overallResults.totalChecks) * 100);
  console.log(`✅ Total Passed: ${overallResults.totalPassed}`);
  console.log(`❌ Total Failed: ${overallResults.totalFailed}`);
  console.log(`📊 Overall Score: ${overallScore}%`);
  
  // Recommendations
  console.log('\n💡 MOBILE RESPONSIVENESS RECOMMENDATIONS:');
  
  if (overallScore >= 90) {
    console.log('🎉 Excellent mobile responsiveness!');
  } else if (overallScore >= 75) {
    console.log('✅ Good mobile responsiveness, minor improvements needed');
  } else if (overallScore >= 60) {
    console.log('⚠️  Moderate mobile responsiveness, several improvements needed');
  } else {
    console.log('❌ Poor mobile responsiveness, significant improvements required');
  }
  
  // Specific recommendations
  console.log('\n🔧 SPECIFIC RECOMMENDATIONS:');
  console.log('• Ensure all interactive elements have min-height of 44px');
  console.log('• Use responsive breakpoints (sm:, md:, lg:) for layout changes');
  console.log('• Test on actual mobile devices or browser dev tools');
  console.log('• Consider touch gestures and mobile-specific interactions');
  console.log('• Optimize images for different screen densities');
  
  return overallResults;
}

function main() {
  console.log('🚀 Starting Mobile Responsiveness Check...\n');
  const results = generateMobileReport();
  
  console.log('\n✨ Mobile responsiveness check complete!');
  
  // Exit with appropriate code based on score
  const overallScore = Math.round((results.totalPassed / results.totalChecks) * 100);
  if (overallScore >= 85) {
    process.exit(0);
  } else if (overallScore >= 70) {
    process.exit(1);
  } else {
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkMobileResponsiveness, generateMobileReport };