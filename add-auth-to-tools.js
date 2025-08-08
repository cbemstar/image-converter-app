/**
 * Script to add authentication to all tool pages
 * Run this with Node.js to automatically update all tool HTML files
 */

const fs = require('fs');
const path = require('path');

const toolsDir = './tools';
const authScript = '  <!-- Authentication System -->\n  <script src="../../js/auth-init.js"></script>';

function addAuthToTool(toolPath) {
  const indexPath = path.join(toolPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.log(`Skipping ${toolPath} - no index.html found`);
    return;
  }

  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Check if auth is already added
  if (content.includes('auth-init.js')) {
    console.log(`Skipping ${toolPath} - auth already added`);
    return;
  }

  // Find the best place to insert the auth script
  // Look for Font Awesome link or other script tags
  const insertPatterns = [
    /(\s*<!-- Font Awesome for icons -->\s*\n\s*<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome[^>]*>)/,
    /(\s*<script type="module" src="[^"]*theme\.js"><\/script>)/,
    /(\s*<script type="module" src="[^"]*layout\.js"><\/script>)/,
    /(\s*<\/head>)/
  ];

  let inserted = false;
  for (const pattern of insertPatterns) {
    if (pattern.test(content)) {
      if (pattern.source.includes('</head>')) {
        // Insert before closing head tag
        content = content.replace(pattern, `${authScript}\n$1`);
      } else {
        // Insert after the matched element
        content = content.replace(pattern, `$1\n${authScript}`);
      }
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    console.log(`Warning: Could not find insertion point for ${toolPath}`);
    return;
  }

  // Write the updated content
  fs.writeFileSync(indexPath, content);
  console.log(`✅ Added auth to ${toolPath}`);
}

function main() {
  if (!fs.existsSync(toolsDir)) {
    console.error('Tools directory not found');
    return;
  }

  const tools = fs.readdirSync(toolsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`Found ${tools.length} tools to update:`);
  console.log(tools.join(', '));
  console.log('');

  tools.forEach(tool => {
    const toolPath = path.join(toolsDir, tool);
    addAuthToTool(toolPath);
  });

  console.log('\n✅ Authentication setup complete!');
  console.log('\nNext steps:');
  console.log('1. Test the authentication on a few tools');
  console.log('2. Run your Supabase setup (setup-database.sql and setup-storage.sql)');
  console.log('3. Users will now see sign in/out options on all tool pages');
}

if (require.main === module) {
  main();
}

module.exports = { addAuthToTool };