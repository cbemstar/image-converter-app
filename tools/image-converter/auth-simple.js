/**
 * Simple Authentication System for Image Converter
 * Tracks usage and enforces limits
 */

class ImageConverterAuth {
  constructor() {
    this.isInitialized = false;
    this.user = null;
    this.usageCount = 0;
    this.freeLimit = 10; // Free users can convert 10 images
    this.init();
  }

  async init() {
    try {
      // Load usage from localStorage for anonymous users
      this.loadLocalUsage();
      this.isInitialized = true;
      console.log('✅ Image Converter Auth initialized');
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
    }
  }

  loadLocalUsage() {
    const stored = localStorage.getItem('imageConverter_usage');
    if (stored) {
      const data = JSON.parse(stored);
      this.usageCount = data.count || 0;
    }
  }

  saveLocalUsage() {
    localStorage.setItem('imageConverter_usage', JSON.stringify({
      count: this.usageCount,
      lastUsed: new Date().toISOString()
    }));
  }

  canConvert() {
    return this.usageCount < this.freeLimit;
  }

  getRemainingConversions() {
    return Math.max(0, this.freeLimit - this.usageCount);
  }

  recordConversion() {
    this.usageCount++;
    this.saveLocalUsage();
    this.updateUI();
  }

  updateUI() {
    const remaining = this.getRemainingConversions();
    const usageElement = document.getElementById('usage-counter');
    
    if (usageElement) {
      if (remaining > 0) {
        usageElement.innerHTML = `
          <div class="text-sm text-muted-foreground">
            <i class="fas fa-image mr-1"></i>
            ${remaining} free conversions remaining
          </div>
        `;
      } else {
        usageElement.innerHTML = `
          <div class="text-sm text-destructive">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            Free limit reached. <a href="#upgrade" class="text-primary underline">Upgrade for unlimited conversions</a>
          </div>
        `;
      }
    }
  }

  showUpgradeModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-background border border-border rounded-lg p-6 max-w-md mx-4">
        <h3 class="text-lg font-semibold mb-4">Upgrade Required</h3>
        <p class="text-muted-foreground mb-4">
          You've reached your free limit of ${this.freeLimit} image conversions. 
          Upgrade to continue with unlimited conversions.
        </p>
        <div class="flex gap-2">
          <button onclick="this.closest('.fixed').remove()" class="btn btn-outline flex-1">
            Maybe Later
          </button>
          <button onclick="window.open('../../pricing.html', '_blank')" class="btn btn-primary flex-1">
            <i class="fas fa-crown mr-1"></i>
            Upgrade Now
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // Reset usage (for testing or admin purposes)
  resetUsage() {
    this.usageCount = 0;
    this.saveLocalUsage();
    this.updateUI();
    console.log('Usage reset');
  }
}

// Initialize auth system
window.imageAuth = new ImageConverterAuth();

// Global functions for easy access
window.canConvert = () => window.imageAuth.canConvert();
window.recordConversion = () => window.imageAuth.recordConversion();
window.showUpgradeModal = () => window.imageAuth.showUpgradeModal();
window.resetUsage = () => window.imageAuth.resetUsage(); // For testing