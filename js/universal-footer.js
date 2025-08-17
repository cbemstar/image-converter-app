// Universal footer script for all pages
(function() {
  'use strict';
  
  // Footer HTML template
  function getFooterHTML() {
    // Determine if we're on the homepage or a tool page
    const isHomepage = window.location.pathname === '/' || window.location.pathname === '/index.html';
    
    return `
      <footer class="bg-background border-t border-border mt-auto">
        <div class="container mx-auto px-4 py-12">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8 w-full">
            <!-- Company Info -->
            <div class="space-y-4 md:col-span-1">
              <div class="flex items-center gap-2">
                <span class="text-2xl font-bold text-foreground">reformately</span>
              </div>
              <p class="text-sm text-muted-foreground max-w-xs">
                A collection of powerful online tools designed to make your digital workflow more efficient and productive.
              </p>
              <div class="flex space-x-4">
                <a href="#" class="text-muted-foreground hover:text-foreground transition-colors">
                  <i data-lucide="twitter" class="w-5 h-5"></i>
                </a>
                <a href="#" class="text-muted-foreground hover:text-foreground transition-colors">
                  <i data-lucide="github" class="w-5 h-5"></i>
                </a>
                <a href="#" class="text-muted-foreground hover:text-foreground transition-colors">
                  <i data-lucide="linkedin" class="w-5 h-5"></i>
                </a>
              </div>
            </div>

            <!-- Tools -->
            <div class="space-y-4 md:col-span-1">
              <h3 class="text-lg font-semibold text-foreground">Tools</h3>
              <ul class="space-y-2 text-sm">
                <li><a href="${isHomepage ? 'tools/image-converter/index.html' : '../../tools/image-converter/index.html'}" class="text-muted-foreground hover:text-foreground transition-colors">Image Converter</a></li>
                <li><a href="${isHomepage ? 'tools/background-remover/index.html' : '../../tools/background-remover/index.html'}" class="text-muted-foreground hover:text-foreground transition-colors">Background Remover</a></li>
                <li><a href="${isHomepage ? 'tools/google-ads-rsa-preview/index.html' : '../../tools/google-ads-rsa-preview/index.html'}" class="text-muted-foreground hover:text-foreground transition-colors">Google Ads RSA</a></li>
                <li><a href="${isHomepage ? 'tools/campaign-structure/index.html' : '../../tools/campaign-structure/index.html'}" class="text-muted-foreground hover:text-foreground transition-colors">Campaign Structure</a></li>
              </ul>
            </div>

            <!-- Resources -->
            <div class="space-y-4 md:col-span-1">
              <h3 class="text-lg font-semibold text-foreground">Resources</h3>
              <ul class="space-y-2 text-sm">
                <li><a href="#" class="text-muted-foreground hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" class="text-muted-foreground hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="#" class="text-muted-foreground hover:text-foreground transition-colors">Tutorials</a></li>
                <li><a href="#" class="text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
              </ul>
            </div>

            <!-- Support -->
            <div class="space-y-4 md:col-span-1">
              <h3 class="text-lg font-semibold text-foreground">Support</h3>
              <ul class="space-y-2 text-sm">
                <li><a href="${isHomepage ? 'tools/request-tool/index.html' : '../../tools/request-tool/index.html'}" class="text-muted-foreground hover:text-foreground transition-colors">Request a Tool</a></li>
                <li><a href="#" class="text-muted-foreground hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" class="text-muted-foreground hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" class="text-muted-foreground hover:text-foreground transition-colors">Status</a></li>
              </ul>
            </div>
          </div>

          <!-- Bottom Section -->
          <div class="border-t border-border mt-8 pt-8">
            <div class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div class="flex items-center space-x-4 text-sm text-muted-foreground">
                <span>&copy; 2024 reformately. All rights reserved.</span>
                <div class="w-1 h-1 bg-muted-foreground rounded-full"></div>
                <a href="#" class="hover:text-foreground transition-colors">Privacy Policy</a>
                <div class="w-1 h-1 bg-muted-foreground rounded-full"></div>
                <a href="#" class="hover:text-foreground transition-colors">Terms of Service</a>
              </div>
              
              <div class="flex items-center space-x-2">
                <span class="text-sm text-muted-foreground">Made with</span>
                <i data-lucide="heart" class="w-4 h-4 text-red-500"></i>
                <span class="text-sm text-muted-foreground">for developers</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  // Function to inject footer
  function injectFooter() {
    // Check if footer already exists
    if (document.querySelector('footer')) {
      return;
    }
    
    // Create footer container
    const footerContainer = document.createElement('div');
    footerContainer.innerHTML = getFooterHTML();
    
    // Insert before closing body tag
    document.body.appendChild(footerContainer);
    
    // Initialize Lucide icons if available
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
    
    console.log('Footer injected successfully');
  }

  // Function to adjust footer paths based on current page depth
  function adjustFooterPaths() {
    const footer = document.querySelector('footer');
    if (!footer) return;
    
    // Determine current page depth
    const pathParts = window.location.pathname.split('/');
    const depth = pathParts.length - 2; // -2 because we want to go up from current page
    
    // Adjust tool links based on depth
    const toolLinks = footer.querySelectorAll('a[href*="tools/"]');
    toolLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href.startsWith('../../tools/')) {
        // Already correct for tool pages
        return;
      } else if (href.startsWith('tools/')) {
        // For root pages, keep as is
        return;
      }
    });
  }

  // Initialize footer when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      injectFooter();
      adjustFooterPaths();
    });
  } else {
    // DOM is already loaded
    injectFooter();
    adjustFooterPaths();
  }

  // Also try to inject on window load as fallback
  window.addEventListener('load', function() {
    if (!document.querySelector('footer')) {
      injectFooter();
      adjustFooterPaths();
    }
  });

  // Export functions for manual use
  window.injectFooter = injectFooter;
  window.adjustFooterPaths = adjustFooterPaths;
})();
