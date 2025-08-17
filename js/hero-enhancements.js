// Hero Section Enhancements with shadcn/ui Components
// This file enhances the hero section with interactive elements and shadcn/ui styling

document.addEventListener('DOMContentLoaded', () => {
  console.log('Hero enhancements loading...');
  
  // Wait for shadcn components to be available
  const waitForShadcn = setInterval(() => {
    if (window.shadcn) {
      clearInterval(waitForShadcn);
      enhanceHeroSection();
    }
  }, 100);
  
  function enhanceHeroSection() {
    console.log('Enhancing hero section with shadcn/ui components...');
    
    // Enhance CTA buttons with shadcn/ui styling
    enhanceCTAButtons();
    
    // Enhance quick access cards with shadcn/ui components
    enhanceQuickAccessCards();
    
    // Add smooth scrolling to tools section
    addSmoothScrolling();
    
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
  
  function enhanceCTAButtons() {
    const exploreBtn = document.getElementById('explore-tools-btn');
    const requestBtn = document.getElementById('request-tool-btn');
    
    if (exploreBtn) {
      exploreBtn.addEventListener('click', () => {
        // Smooth scroll to tools section
        const toolsSection = document.querySelector('#home-tools');
        if (toolsSection) {
          toolsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
    
    if (requestBtn) {
      requestBtn.addEventListener('click', () => {
        // Navigate to request tool page
        window.location.href = 'tools/request-tool/index.html';
      });
    }
  }
  
  function enhanceQuickAccessCards() {
    const imageCard = document.getElementById('image-tools-card');
    const marketingCard = document.getElementById('marketing-tools-card');
    const developerCard = document.getElementById('developer-tools-card');
    const utilitiesCard = document.getElementById('utilities-tools-card');
    
    // Add click handlers for quick access cards
    if (imageCard) {
      imageCard.addEventListener('click', () => {
        // Filter to show only image tools
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
          categoryFilter.value = 'Images';
          // Trigger filter change event
          const event = new Event('change');
          categoryFilter.dispatchEvent(event);
        }
        // Scroll to tools section
        const toolsSection = document.querySelector('#home-tools');
        if (toolsSection) {
          toolsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
    
    if (marketingCard) {
      marketingCard.addEventListener('click', () => {
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
          categoryFilter.value = 'Marketing';
          const event = new Event('change');
          categoryFilter.dispatchEvent(event);
        }
        const toolsSection = document.querySelector('#home-tools');
        if (toolsSection) {
          toolsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
    
    if (developerCard) {
      developerCard.addEventListener('click', () => {
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
          categoryFilter.value = 'Developer';
          const event = new Event('change');
          categoryFilter.dispatchEvent(event);
        }
        const toolsSection = document.querySelector('#home-tools');
        if (toolsSection) {
          toolsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
    
    if (utilitiesCard) {
      utilitiesCard.addEventListener('click', () => {
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
          categoryFilter.value = 'Utilities';
          const event = new Event('change');
          categoryFilter.dispatchEvent(event);
        }
        const toolsSection = document.querySelector('#home-tools');
        if (toolsSection) {
          toolsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }
  
  function addSmoothScrolling() {
    // Add smooth scrolling behavior to all internal links
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }
  
  // Add hover effects and animations
  function addHoverEffects() {
    const quickAccessCards = document.querySelectorAll('.quick-access-card');
    
    quickAccessCards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '';
      });
    });
  }
  
  // Initialize hover effects after a short delay
  setTimeout(addHoverEffects, 500);
});

console.log('Hero enhancements script loaded');
