/**
 * Universal Tool Integration Template
 * Copy this code to any tool's main JavaScript file to integrate with the CMS system
 */

// Add this to the end of your tool's main JavaScript file or in a DOMContentLoaded event

document.addEventListener('DOMContentLoaded', function() {
  // Initialize tool integration
  if (window.initializeToolIntegration) {
    window.initializeToolIntegration({
      name: 'TOOL_NAME_HERE', // Replace with actual tool name (e.g., 'pdf-merger', 'qr-generator')
      type: 'utility', // Options: 'conversion', 'generator', 'utility', 'editor'
      requiresAuth: false, // Set to true if tool requires authentication
      quotaType: 'conversions', // Options: 'conversions', 'storage', 'api_calls'
      trackUsage: true // Set to false to disable usage tracking
    });
  }
});

// Example: How to add quota checking before operations
async function performToolOperation() {
  // Check quota before proceeding
  if (window.toolIntegration) {
    const canProceed = await window.toolIntegration.checkQuota();
    if (!canProceed) {
      return; // Quota exceeded, error already shown to user
    }
  }
  
  try {
    // Your tool's main operation here
    console.log('Performing tool operation...');
    
    // Track successful operation
    if (window.toolIntegration) {
      window.toolIntegration.trackToolUsage('operation_completed', {
        // Add any relevant metadata
        operation_type: 'example'
      });
    }
    
  } catch (error) {
    // Handle and track errors
    if (window.handleError) {
      window.handleError(error, {
        tool: 'TOOL_NAME_HERE',
        operation: 'main_operation'
      });
    }
    
    if (window.toolIntegration) {
      window.toolIntegration.trackToolUsage('operation_failed', {
        error: error.message
      });
    }
  }
}

// Example: How to track file uploads
function handleFileUpload(files) {
  if (window.toolIntegration) {
    window.toolIntegration.trackToolUsage('file_upload', {
      file_count: files.length,
      file_types: Array.from(files).map(f => f.type).join(','),
      total_size: Array.from(files).reduce((sum, f) => sum + f.size, 0)
    });
  }
}

// Example: How to track button clicks
function setupButtonTracking() {
  document.addEventListener('click', function(e) {
    if (e.target.matches('.track-click')) {
      if (window.toolIntegration) {
        window.toolIntegration.trackToolUsage('button_click', {
          button_id: e.target.id,
          button_text: e.target.textContent.trim()
        });
      }
    }
  });
}

// Example: How to show success/error messages
function showToolMessage(message, type = 'info') {
  if (window.showToast) {
    window.showToast('Tool Message', message, type);
  } else {
    // Fallback
    alert(message);
  }
}

/*
INTEGRATION CHECKLIST:

1. Add the core dependencies to your HTML head:
   ```html
   <!-- Core Dependencies -->
   <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
   <script src="../../js/config.js"></script>
   <script src="../../js/supabase-config.js"></script>
   <script src="../../js/supabase-client.js"></script>
   <script src="../../js/auth-manager.js"></script>
   <script src="../../js/quota-manager.js"></script>
   <script src="../../js/analytics-manager.js"></script>
   <script src="../../js/error-handler.js"></script>
   <script src="../../js/tool-integration.js"></script>
   <script src="../../js/unified-navigation.js"></script>
   <script src="../../js/auto-navigation.js"></script>
   ```

2. Initialize tool integration in your main JavaScript file:
   - Copy the DOMContentLoaded event listener above
   - Replace 'TOOL_NAME_HERE' with your tool's name
   - Set appropriate configuration options

3. Add quota checking before main operations:
   - Use the performToolOperation() example above
   - Add await window.toolIntegration.checkQuota() before operations

4. Track important events:
   - File uploads: Use handleFileUpload() example
   - Button clicks: Use setupButtonTracking() example
   - Operations: Use trackToolUsage() calls

5. Handle errors properly:
   - Wrap operations in try-catch blocks
   - Use window.handleError() for consistent error handling
   - Track failed operations for analytics

6. Test the integration:
   - Verify authentication prompts work
   - Check quota warnings appear
   - Confirm usage tracking works
   - Test error handling

TOOL TYPES:
- 'conversion': Tools that convert files (image-converter, pdf-merger)
- 'generator': Tools that generate content (qr-generator, uuid-generator)
- 'utility': General utility tools (text-case-converter, timestamp-converter)
- 'editor': Tools that edit content (bulk-match-editor, json-formatter)

QUOTA TYPES:
- 'conversions': For file conversion operations
- 'storage': For file storage operations
- 'api_calls': For external API calls
*/