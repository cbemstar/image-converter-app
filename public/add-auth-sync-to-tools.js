#!/usr/bin/env node

/**
 * Script to add auth-state-sync.js to all tool pages that have auth-manager.js
 * This ensures consistent authentication state synchronization across all tools
 */

const fs = require('fs');
const path = require('path');

// List of tool directories that need the auth sync script
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

function addAuthSyncToTool(toolDir) {
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

  // Check if auth-state-sync.js is already present
  if (content.includes('auth-state-sync.js')) {
    console.log(`Skipping ${toolDir} - auth-state-sync.js already present`);
    return;
  }

  // Find the line with auth-manager.js and add auth-state-sync.js after it
  const authManagerLine = content.match(/.*auth-manager\.js.*\n/);
  if (authManagerLine) {
    const authSyncScript = '  <script src="../../js/auth-state-sync.js"></script>\n';
    content = content.replace(authManagerLine[0], authManagerLine[0] + authSyncScript);
    
    fs.writeFileSync(indexPath, content);
    console.log(`✓ Added auth-state-sync.js to ${toolDir}`);
  } else {
    console.log(`⚠ Could not find auth-manager.js line in ${toolDir}`);
  }
}

function main() {
  console.log('Adding auth-state-sync.js to tool pages...\n');
  
  toolDirectories.forEach(toolDir => {
    try {
      addAuthSyncToTool(toolDir);
    } catch (error) {
      console.error(`Error processing ${toolDir}:`, error.message);
    }
  });
  
  console.log('\nAuth sync script addition complete!');
}

if (require.main === module) {
  main();
}

module.exports = { addAuthSyncToTool };