// Universal Footer Component for reformately.com
// This script provides consistent footer across all pages

class UniversalFooter {
  constructor() {
    this.init();
  }

  init() {
    this.createFooter();
    this.bindEvents();
  }

  createFooter() {
    const footerHTML = `
      <footer class="footer">
        <div class="footer-content">
          <!-- Brand Section -->
          <div class="footer-brand">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <i data-lucide="zap" class="w-5 h-5 text-primary"></i>
              </div>
              <h3 class="text-xl font-bold">reformately</h3>
            </div>
            <p class="text-muted-foreground mb-6 leading-relaxed">
              Professional tools for digital professionals. Transform your workflow with our collection of browser-based utilities.
            </p>
            <div class="flex items-center gap-3">
              <a href="#" class="social-link" aria-label="Twitter">
                <i data-lucide="twitter" class="w-5 h-5"></i>
              </a>
              <a href="#" class="social-link" aria-label="GitHub">
                <i data-lucide="github" class="w-5 h-5"></i>
              </a>
              <a href="#" class="social-link" aria-label="LinkedIn">
                <i data-lucide="linkedin" class="w-5 h-5"></i>
              </a>
            </div>
          </div>
          
          <!-- Tools Section -->
          <div class="footer-section">
            <h4 class="footer-heading">Tools</h4>
            <ul class="footer-links">
              <li><a href="#tools-section" class="footer-link">Image Tools</a></li>
              <li><a href="#tools-section" class="footer-link">Marketing Tools</a></li>
              <li><a href="#tools-section" class="footer-link">Developer Tools</a></li>
              <li><a href="#tools-section" class="footer-link">Utilities</a></li>
            </ul>
          </div>
          
          <!-- Company Section -->
          <div class="footer-section">
            <h4 class="footer-heading">Company</h4>
            <ul class="footer-links">
              <li><a href="#" class="footer-link">About</a></li>
              <li><a href="#" class="footer-link">Contact</a></li>
              <li><a href="#" class="footer-link">Privacy Policy</a></li>
              <li><a href="#" class="footer-link">Terms of Service</a></li>
            </ul>
          </div>
          
          <!-- Support Section -->
          <div class="footer-section">
            <h4 class="footer-heading">Support</h4>
            <ul class="footer-links">
              <li><a href="#" class="footer-link">Help Center</a></li>
              <li><a href="/tools/request-tool/index.html" class="footer-link">Request a Tool</a></li>
              <li><a href="#" class="footer-link">Bug Report</a></li>
              <li><a href="#" class="footer-link">Feature Request</a></li>
            </ul>
          </div>
          
          <!-- Newsletter Section -->
          <div class="footer-section">
            <h4 class="footer-heading">Stay Updated</h4>
            <p class="text-muted-foreground mb-4 text-sm">
              Get notified about new tools and features.
            </p>
            <div class="newsletter-form">
              <input 
                type="email" 
                placeholder="Enter your email" 
                class="newsletter-input"
              />
              <button class="newsletter-button">
                <i data-lucide="send" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Footer Bottom -->
        <div class="footer-bottom">
          <div class="footer-bottom-content">
            <p class="text-muted-foreground text-sm">
              &copy; ${new Date().getFullYear()} reformately. All rights reserved.
            </p>
            <div class="footer-bottom-links">
              <a href="#" class="text-muted-foreground hover:text-primary text-sm transition-colors">Status</a>
              <span class="text-muted-foreground mx-2">•</span>
              <a href="#" class="text-muted-foreground hover:text-primary text-sm transition-colors">Security</a>
              <span class="text-muted-foreground mx-2">•</span>
              <a href="#" class="text-muted-foreground hover:text-primary text-sm transition-colors">Changelog</a>
            </div>
          </div>
        </div>
      </footer>
    `;

    // Insert footer at the end of the body
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  }

  bindEvents() {
    // Newsletter form submission
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
      const newsletterInput = newsletterForm.querySelector('.newsletter-input');
      const newsletterButton = newsletterForm.querySelector('.newsletter-button');

      if (newsletterButton && newsletterInput) {
        newsletterButton.addEventListener('click', (e) => {
          e.preventDefault();
          const email = newsletterInput.value.trim();
          
          if (email && this.isValidEmail(email)) {
            // Here you would typically send the email to your backend
            this.showNewsletterSuccess();
            newsletterInput.value = '';
          } else {
            this.showNewsletterError();
          }
        });

        // Allow Enter key submission
        newsletterInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            newsletterButton.click();
          }
        });
      }
    }

    // Smooth scroll for internal links
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href !== '#') {
          e.preventDefault();
          const targetElement = document.querySelector(href);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showNewsletterSuccess() {
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = 'Thank you for subscribing!';
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  showNewsletterError() {
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = 'Please enter a valid email address.';
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Initialize footer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new UniversalFooter();
});
