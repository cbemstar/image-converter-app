#!/usr/bin/env node

/**
 * Script to add path-resolver.js to all tool pages that have auth-manager.js
 * This ensures proper path resolution for navigation links
 */

const fs = require('fs');
const path = require('path');

// List of tool directories that need the path resolver script
const toolDirectories = [
  'tools/background-remover',
  'tools/bulk-match-editor',
  'tools/campaign-structure',
  'tools/color-palette',
  'tools/google-ads-rsa-preview',
  'tools/image-converter',
  'tools/json-formatter',
  'tools/layout-tool',
  'tools/meta-tag-generator',
  'tools/pdf-merger',
  'tools/pdf-ocr',
  'tools/qr-generator',
  'tools/request-tool',
  'tools/robots-txt',
  'tools/text-case-converter',
  'tools/timestamp-converter',
  'tools/utm-builder',
  'tools/uuid-generator'
];

function addPathResolverToTool(toolDir) {
  const indexPath = path.join(toolDir, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.log(`Skipping ${toolDir} - index.html not found`);
    return;
  }

  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Check if auth-manager.js is present
  if (!content.includes('auth-manager.js')) {
    console.log(`Skipping ${toolDir} - no auth-manager.js found`);
    return;
  }

  // Check if path-resolver.js is already present
  if (content.includes('path-resolver.js')) {
    console.log(`Skipping ${toolDir} - path-resolver.js already present`);
    return;
  }

  // Find the line with auth-manager.js and add path-resolver.js before it
  const authManagerLine = content.match(/.*auth-manager\.js.*\n/);
  if (authManagerLine) {
    const pathResolverScript = '  <script src="../../js/path-resolver.js"></script>\n';
    content = content.replace(authManagerLine[0], pathResolverScript + authManagerLine[0]);
    
    fs.writeFileSync(indexPath, content);
    console.log(`✓ Added path-resolver.js to ${toolDir}`);
  } else {
    console.log(`⚠ Could not find auth-manager.js line in ${toolDir}`);
  }
}

function main() {
  console.log('Adding path-resolver.js to tool pages...\n');
  
  toolDirectories.forEach(toolDir => {
    try {
      addPathResolverToTool(toolDir);
    } catch (error) {
      console.error(`Error processing ${toolDir}:`, error.message);
    }
  });
  
  console.log('\nPath resolver script addition complete!');
}

if (require.main === module) {
  main();
}

module.exports = { addPathResolverToTool };