/**
 * Plan Comparison and Upgrade UI Component
 * 
 * Displays plan comparison table and upgrade prompts
 * Requirements: 5.1, 5.5, 5.6
 */

export class PlanComparisonUI {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      showCurrentPlan: true,
      highlightRecommended: true,
      showFeatureComparison: true,
      showPricing: true,
      compactMode: false,
      currentPlan: null,
      ...options
    };
    
    if (!this.container) {
      console.error(`PlanComparisonUI: Container with id "${containerId}" not found`);
      return;
    }
    
    this.plans = this.getDefaultPlans();
    this.currentUsage = null;
    
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.render();
    this.attachEventListeners();
  }

  /**
   * Get default plan configurations
   * @returns {Array} Array of plan objects
   */
  getDefaultPlans() {
    return [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        priceDisplay: 'Free',
        monthlyConversions: 10,
        features: [
          'Basic image conversion',
          'Common formats (JPEG, PNG, WebP)',
          'Up to 5MB file size',
          'Standard processing speed'
        ],
        limitations: [
          'Limited to 10 conversions per month',
          'No priority support',
          'Basic formats only'
        ],
        recommended: false,
        popular: false,
        stripePriceId: null
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 9.99,
        priceDisplay: '$9.99',
        monthlyConversions: 500,
        features: [
          'All image conversion features',
          'All formats including AVIF, HEIC, RAW',
          'Up to 50MB file size',
          'Priority processing',
          'Batch conversion',
          'Email support',
          'Usage analytics'
        ],
        limitations: [],
        recommended: true,
        popular: true,
        stripePriceId: 'price_pro_monthly'
      },
      {
        id: 'unlimited',
        name: 'Unlimited',
        price: 19.99,
        priceDisplay: '$19.99',
        monthlyConversions: -1, // -1 indicates unlimited
        features: [
          'Everything in Pro',
          'Unlimited conversions',
          'Up to 100MB file size',
          'Fastest processing',
          'Priority support',
          'Advanced analytics',
          'API access',
          'Custom integrations'
        ],
        limitations: [],
        recommended: false,
        popular: false,
        stripePriceId: 'price_unlimited_monthly'
      }
    ];
  }

  /**
   * Update current usage data
   * @param {Object} usage - Current usage data
   */
  updateUsage(usage) {
    this.currentUsage = usage;
    this.options.currentPlan = usage?.planName?.toLowerCase() || 'free';
    this.render();
  }

  /**
   * Render the plan comparison UI
   */
  render() {
    if (this.options.compactMode) {
      this.renderCompact();
    } else {
      this.renderFull();
    }
  }

  /**
   * Render compact plan comparison
   */
  renderCompact() {
    const currentPlan = this.options.currentPlan || 'free';
    const recommendedPlan = this.plans.find(p => p.recommended) || this.plans[1];
    
    this.container.innerHTML = `
      <div class="plan-comparison-compact">
        <div class="current-plan-summary">
          <h4>Current Plan: ${this.getCurrentPlanName()}</h4>
          ${this.currentUsage ? this.renderUsageSummary() : ''}
        </div>
        
        ${currentPlan !== recommendedPlan.id ? `
          <div class="upgrade-recommendation">
            <div class="upgrade-card">
              <div class="upgrade-header">
                <h5>Recommended Upgrade</h5>
                ${recommendedPlan.popular ? '<span class="popular-badge">Most Popular</span>' : ''}
              </div>
              
              <div class="upgrade-content">
                <div class="plan-name-price">
                  <span class="plan-name">${recommendedPlan.name}</span>
                  <span class="plan-price">${recommendedPlan.priceDisplay}/month</span>
                </div>
                
                <div class="plan-highlight">
                  <strong>${this.formatConversions(recommendedPlan.monthlyConversions)}</strong> conversions/month
                </div>
                
                <div class="key-features">
                  ${recommendedPlan.features.slice(0, 3).map(feature => `
                    <div class="feature-item">
                      <i class="fas fa-check"></i>
                      <span>${feature}</span>
                    </div>
                  `).join('')}
                  ${recommendedPlan.features.length > 3 ? `
                    <div class="feature-more">
                      +${recommendedPlan.features.length - 3} more features
                    </div>
                  ` : ''}
                </div>
                
                <button class="btn btn-primary upgrade-btn" data-plan="${recommendedPlan.id}">
                  Upgrade to ${recommendedPlan.name}
                </button>
              </div>
            </div>
          </div>
        ` : ''}
        
        <div class="plan-actions">
          <button class="btn btn-secondary view-all-plans-btn">
            View All Plans
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render full plan comparison
   */
  renderFull() {
    const currentPlan = this.options.currentPlan || 'free';
    
    this.container.innerHTML = `
      <div class="plan-comparison-full">
        <div class="plan-comparison-header">
          <h3>Choose Your Plan</h3>
          <p>Select the plan that best fits your image conversion needs</p>
        </div>
        
        <div class="plan-comparison-grid">
          ${this.plans.map(plan => this.renderPlanCard(plan, currentPlan)).join('')}
        </div>
        
        ${this.options.showFeatureComparison ? this.renderFeatureComparison() : ''}
      </div>
    `;
  }

  /**
   * Render individual plan card
   * @param {Object} plan - Plan object
   * @param {string} currentPlan - Current plan ID
   * @returns {string} HTML for plan card
   */
  renderPlanCard(plan, currentPlan) {
    const isCurrent = plan.id === currentPlan;
    const isUpgrade = this.isUpgrade(plan.id, currentPlan);
    
    return `
      <div class="plan-card ${isCurrent ? 'current' : ''} ${plan.recommended ? 'recommended' : ''}">
        ${plan.popular ? '<div class="popular-badge">Most Popular</div>' : ''}
        ${plan.recommended ? '<div class="recommended-badge">Recommended</div>' : ''}
        
        <div class="plan-header">
          <h4 class="plan-name">${plan.name}</h4>
          <div class="plan-price">
            <span class="price-amount">${plan.priceDisplay}</span>
            ${plan.price > 0 ? '<span class="price-period">/month</span>' : ''}
          </div>
          <div class="plan-conversions">
            ${this.formatConversions(plan.monthlyConversions)} conversions/month
          </div>
        </div>
        
        <div class="plan-features">
          <ul>
            ${plan.features.map(feature => `
              <li class="feature-included">
                <i class="fas fa-check"></i>
                <span>${feature}</span>
              </li>
            `).join('')}
            ${plan.limitations.map(limitation => `
              <li class="feature-limitation">
                <i class="fas fa-times"></i>
                <span>${limitation}</span>
              </li>
            `).join('')}
          </ul>
        </div>
        
        <div class="plan-action">
          ${isCurrent ? `
            <button class="btn btn-secondary current-plan-btn" disabled>
              Current Plan
            </button>
          ` : `
            <button class="btn ${plan.recommended ? 'btn-primary' : 'btn-secondary'} upgrade-btn" 
                    data-plan="${plan.id}">
              ${isUpgrade ? 'Upgrade' : 'Select'} ${plan.name}
            </button>
          `}
        </div>
        
        ${isCurrent && this.currentUsage ? this.renderCurrentPlanUsage() : ''}
      </div>
    `;
  }

  /**
   * Render feature comparison table
   * @returns {string} HTML for feature comparison
   */
  renderFeatureComparison() {
    const allFeatures = this.getAllUniqueFeatures();
    
    return `
      <div class="feature-comparison">
        <h4>Feature Comparison</h4>
        <div class="comparison-table-container">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Features</th>
                ${this.plans.map(plan => `
                  <th class="plan-column ${plan.recommended ? 'recommended' : ''}">
                    ${plan.name}
                    ${plan.popular ? '<br><small class="popular-text">Most Popular</small>' : ''}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${allFeatures.map(feature => `
                <tr>
                  <td class="feature-name">${feature}</td>
                  ${this.plans.map(plan => `
                    <td class="feature-cell">
                      ${this.hasFeature(plan, feature) ? 
                        '<i class="fas fa-check text-success"></i>' : 
                        '<i class="fas fa-times text-muted"></i>'
                      }
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Render usage summary for current plan
   * @returns {string} HTML for usage summary
   */
  renderUsageSummary() {
    const { conversionsUsed, conversionsLimit, remainingConversions } = this.currentUsage;
    const percentage = (conversionsUsed / conversionsLimit) * 100;
    
    return `
      <div class="usage-summary">
        <div class="usage-stats">
          <span class="usage-text">
            ${conversionsUsed} of ${conversionsLimit} conversions used
          </span>
          <span class="usage-percentage ${percentage >= 90 ? 'warning' : ''}">
            ${Math.round(percentage)}%
          </span>
        </div>
        <div class="usage-bar">
          <div class="usage-fill" style="width: ${percentage}%"></div>
        </div>
        ${remainingConversions === 0 ? `
          <div class="usage-warning">
            <i class="fas fa-exclamation-triangle"></i>
            You've reached your monthly limit
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render current plan usage in plan card
   * @returns {string} HTML for current plan usage
   */
  renderCurrentPlanUsage() {
    const { conversionsUsed, conversionsLimit } = this.currentUsage;
    const percentage = (conversionsUsed / conversionsLimit) * 100;
    
    return `
      <div class="current-plan-usage">
        <div class="usage-header">
          <span>This Month</span>
          <span>${conversionsUsed}/${conversionsLimit}</span>
        </div>
        <div class="usage-progress">
          <div class="usage-progress-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }

  /**
   * Get current plan display name
   * @returns {string} Current plan name
   */
  getCurrentPlanName() {
    const currentPlan = this.plans.find(p => p.id === this.options.currentPlan);
    return currentPlan ? currentPlan.name : 'Free';
  }

  /**
   * Format conversions count for display
   * @param {number} count - Conversions count (-1 for unlimited)
   * @returns {string} Formatted conversions text
   */
  formatConversions(count) {
    if (count === -1) return 'Unlimited';
    if (count >= 1000) return `${(count / 1000).toFixed(0)}k`;
    return count.toString();
  }

  /**
   * Check if plan selection is an upgrade
   * @param {string} planId - Plan ID to check
   * @param {string} currentPlan - Current plan ID
   * @returns {boolean} True if it's an upgrade
   */
  isUpgrade(planId, currentPlan) {
    const planOrder = ['free', 'pro', 'unlimited'];
    const currentIndex = planOrder.indexOf(currentPlan);
    const targetIndex = planOrder.indexOf(planId);
    return targetIndex > currentIndex;
  }

  /**
   * Get all unique features across all plans
   * @returns {Array} Array of unique features
   */
  getAllUniqueFeatures() {
    const allFeatures = new Set();
    
    this.plans.forEach(plan => {
      plan.features.forEach(feature => allFeatures.add(feature));
    });
    
    return Array.from(allFeatures);
  }

  /**
   * Check if plan has specific feature
   * @param {Object} plan - Plan object
   * @param {string} feature - Feature to check
   * @returns {boolean} True if plan has feature
   */
  hasFeature(plan, feature) {
    return plan.features.includes(feature);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.container.addEventListener('click', (e) => {
      if (e.target.matches('.upgrade-btn')) {
        const planId = e.target.dataset.plan;
        this.handleUpgrade(planId);
      } else if (e.target.matches('.view-all-plans-btn')) {
        this.showAllPlans();
      }
    });
  }

  /**
   * Handle upgrade button click
   * @param {string} planId - Plan ID to upgrade to
   */
  handleUpgrade(planId) {
    const plan = this.plans.find(p => p.id === planId);
    if (!plan) return;
    
    // Dispatch custom event
    this.container.dispatchEvent(new CustomEvent('planUpgrade', {
      detail: { plan, planId },
      bubbles: true
    }));
    
    // Use existing upgrade flow if available
    if (window.showUpgradeModal) {
      window.showUpgradeModal(planId);
    } else if (window.toggleStripeAccordion) {
      window.toggleStripeAccordion(true);
    } else {
      // Fallback: redirect to pricing page
      window.location.href = `/pricing.html?plan=${planId}`;
    }
  }

  /**
   * Show all plans (switch to full view)
   */
  showAllPlans() {
    this.options.compactMode = false;
    this.render();
  }

  /**
   * Update plan data
   * @param {Array} plans - New plans array
   */
  updatePlans(plans) {
    this.plans = plans;
    this.render();
  }

  /**
   * Update options and re-render
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.render();
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Add CSS styles for plan comparison UI
const planComparisonStyles = `
  /* Plan Comparison Base Styles */
  .plan-comparison-compact,
  .plan-comparison-full {
    font-family: inherit;
    color: var(--foreground);
  }
  
  /* Compact Mode */
  .plan-comparison-compact {
    max-width: 600px;
  }
  
  .current-plan-summary {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--muted);
    border-radius: 8px;
  }
  
  .current-plan-summary h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .usage-summary {
    margin-top: 0.75rem;
  }
  
  .usage-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .usage-percentage.warning {
    color: var(--warning);
    font-weight: 600;
  }
  
  .usage-bar {
    width: 100%;
    height: 4px;
    background: var(--muted);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .usage-fill {
    height: 100%;
    background: var(--primary);
    transition: width 0.3s ease;
  }
  
  .usage-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    color: var(--warning);
    font-size: 0.875rem;
  }
  
  .upgrade-recommendation {
    margin-bottom: 1.5rem;
  }
  
  .upgrade-card {
    background: var(--background);
    border: 2px solid var(--primary);
    border-radius: 12px;
    padding: 1.5rem;
    position: relative;
  }
  
  .upgrade-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .upgrade-header h5 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--primary);
  }
  
  .popular-badge {
    background: var(--primary);
    color: var(--primary-foreground);
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  
  .plan-name-price {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .plan-name {
    font-size: 1.25rem;
    font-weight: 700;
  }
  
  .plan-price {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary);
  }
  
  .plan-highlight {
    text-align: center;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: var(--primary-background, var(--muted));
    border-radius: 6px;
    color: var(--primary);
  }
  
  .key-features {
    margin-bottom: 1.5rem;
  }
  
  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .feature-item i {
    color: var(--success);
    width: 16px;
  }
  
  .feature-more {
    font-size: 0.875rem;
    color: var(--muted-foreground);
    margin-top: 0.5rem;
    font-style: italic;
  }
  
  .plan-actions {
    text-align: center;
  }
  
  /* Full Mode */
  .plan-comparison-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .plan-comparison-header h3 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
  }
  
  .plan-comparison-header p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 1.125rem;
  }
  
  .plan-comparison-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
  }
  
  .plan-card {
    background: var(--background);
    border: 2px solid var(--border);
    border-radius: 12px;
    padding: 2rem;
    position: relative;
    transition: all 0.3s ease;
  }
  
  .plan-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }
  
  .plan-card.current {
    border-color: var(--success);
    background: var(--success-background, var(--background));
  }
  
  .plan-card.recommended {
    border-color: var(--primary);
    transform: scale(1.05);
  }
  
  .plan-card.recommended:hover {
    transform: scale(1.05) translateY(-4px);
  }
  
  .recommended-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary);
    color: var(--primary-foreground);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  
  .plan-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .plan-header .plan-name {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  
  .plan-price {
    margin-bottom: 0.5rem;
  }
  
  .price-amount {
    font-size: 3rem;
    font-weight: 700;
    color: var(--primary);
  }
  
  .price-period {
    font-size: 1rem;
    color: var(--muted-foreground);
  }
  
  .plan-conversions {
    font-size: 1.125rem;
    color: var(--muted-foreground);
  }
  
  .plan-features {
    margin-bottom: 2rem;
  }
  
  .plan-features ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .plan-features li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
  }
  
  .feature-included i {
    color: var(--success);
  }
  
  .feature-limitation i {
    color: var(--muted-foreground);
  }
  
  .plan-action {
    text-align: center;
  }
  
  .current-plan-usage {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
  }
  
  .usage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .usage-progress {
    width: 100%;
    height: 6px;
    background: var(--muted);
    border-radius: 3px;
    overflow: hidden;
  }
  
  .usage-progress-fill {
    height: 100%;
    background: var(--success);
    transition: width 0.3s ease;
  }
  
  /* Feature Comparison Table */
  .feature-comparison {
    margin-top: 3rem;
  }
  
  .feature-comparison h4 {
    text-align: center;
    margin-bottom: 2rem;
    font-size: 1.5rem;
    font-weight: 700;
  }
  
  .comparison-table-container {
    overflow-x: auto;
  }
  
  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .comparison-table th,
  .comparison-table td {
    padding: 1rem;
    text-align: center;
    border-bottom: 1px solid var(--border);
  }
  
  .comparison-table th {
    background: var(--muted);
    font-weight: 600;
    color: var(--foreground);
  }
  
  .plan-column.recommended {
    background: var(--primary-background, var(--muted));
    color: var(--primary);
  }
  
  .feature-name {
    text-align: left;
    font-weight: 500;
  }
  
  .feature-cell {
    font-size: 1.125rem;
  }
  
  .popular-text {
    color: var(--primary);
    font-weight: 500;
  }
  
  /* Button Styles */
  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    display: inline-block;
    text-align: center;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s ease;
    font-size: 0.875rem;
    min-width: 120px;
  }
  
  .btn-primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border-color: var(--primary);
  }
  
  .btn-primary:hover {
    background: var(--primary-hover, var(--primary));
    transform: translateY(-1px);
  }
  
  .btn-secondary {
    background: var(--secondary);
    color: var(--secondary-foreground);
    border-color: var(--border);
  }
  
  .btn-secondary:hover {
    background: var(--secondary-hover, var(--secondary));
    border-color: var(--primary);
  }
  
  .btn:disabled {
    background: var(--muted);
    color: var(--muted-foreground);
    cursor: not-allowed;
    transform: none;
  }
  
  .upgrade-btn {
    width: 100%;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .plan-comparison-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    
    .plan-card.recommended {
      transform: none;
    }
    
    .plan-card.recommended:hover {
      transform: translateY(-4px);
    }
    
    .plan-name-price {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .comparison-table {
      font-size: 0.8125rem;
    }
    
    .comparison-table th,
    .comparison-table td {
      padding: 0.75rem 0.5rem;
    }
  }
  
  /* Dark Mode Adjustments */
  @media (prefers-color-scheme: dark) {
    .plan-card:hover {
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }
    
    .upgrade-card {
      background: var(--card-background, var(--background));
    }
  }
`;

// Inject styles if not already present
if (!document.getElementById('plan-comparison-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'plan-comparison-styles';
  styleSheet.textContent = planComparisonStyles;
  document.head.appendChild(styleSheet);
}

// Make available globally
window.PlanComparisonUI = PlanComparisonUI;