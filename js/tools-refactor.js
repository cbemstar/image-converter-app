// Tools Section Refactor with shadcn/ui Components
// This file refactors the tools section to use shadcn/ui components for better consistency and maintainability

document.addEventListener('DOMContentLoaded', () => {
  console.log('Tools refactor loading...');
  
  // Wait for shadcn components to be available
  const waitForShadcn = setInterval(() => {
    if (window.shadcn) {
      clearInterval(waitForShadcn);
      refactorToolsSection();
    }
  }, 100);
  
  function refactorToolsSection() {
    console.log('Refactoring tools section with shadcn/ui components...');
    
    // Define tools data structure
    const toolsData = [
      {
        name: "Image Converter",
        category: "Images",
        description: "Convert images between formats with high quality and privacy. Support for JPEG, PNG, WebP, and more.",
        icon: "image",
        iconColor: "blue",
        feature: "Instant",
        featureIcon: "zap",
        href: "tools/image-converter/index.html"
      },
      {
        name: "Background Remover",
        category: "Images",
        description: "Remove backgrounds from images using AI-powered technology. Perfect for product photos and portraits.",
        icon: "scissors",
        iconColor: "purple",
        feature: "AI-Powered",
        featureIcon: "zap",
        href: "tools/background-remover/index.html"
      },
      {
        name: "Colour Palette Extractor",
        category: "Images",
        description: "Extract dominant colors from images for design inspiration. Generate beautiful color schemes instantly.",
        icon: "palette",
        iconColor: "pink",
        feature: "Color Analysis",
        featureIcon: "palette",
        href: "tools/color-palette/index.html"
      },
      {
        name: "Google Ads RSA Preview",
        category: "Marketing",
        description: "Visualize responsive search ads before publishing. Preview how your ads will look across different devices.",
        icon: "bar-chart-3",
        iconColor: "green",
        feature: "Preview",
        featureIcon: "eye",
        href: "tools/google-ads-rsa-preview/index.html"
      },
      {
        name: "Campaign Structure",
        category: "Marketing",
        description: "Create and export campaign hierarchy diagrams. Visualize your marketing strategy and campaign organization.",
        icon: "layers",
        iconColor: "emerald",
        feature: "Structure",
        featureIcon: "layers",
        href: "tools/campaign-structure/index.html"
      },
      {
        name: "UTM Builder",
        category: "Marketing",
        description: "Build and manage UTM parameters for campaign tracking. Generate tracking URLs for better analytics.",
        icon: "link",
        iconColor: "teal",
        feature: "Tracking",
        featureIcon: "link",
        href: "tools/utm-builder/index.html"
      },
      {
        name: "JSON Formatter",
        category: "Developer",
        description: "Format and validate JSON data with syntax highlighting. Beautify and minify JSON for better readability.",
        icon: "braces",
        iconColor: "violet",
        feature: "Format",
        featureIcon: "code",
        href: "tools/json-formatter/index.html"
      },
      {
        name: "UUID Generator",
        category: "Developer",
        description: "Generate unique identifiers for development projects. Create UUIDs in various formats instantly.",
        icon: "hash",
        iconColor: "indigo",
        feature: "Generate",
        featureIcon: "hash",
        href: "tools/uuid-generator/index.html"
      },
      {
        name: "Timestamp Converter",
        category: "Developer",
        description: "Convert between different timestamp formats. Human-readable dates and Unix timestamps.",
        icon: "clock",
        iconColor: "orange",
        feature: "Convert",
        featureIcon: "clock",
        href: "tools/timestamp-converter/index.html"
      },
      {
        name: "Meta Tag Generator",
        category: "Developer",
        description: "Generate meta tags for SEO optimization. Create comprehensive meta tags for better search visibility.",
        icon: "tag",
        iconColor: "amber",
        feature: "SEO",
        featureIcon: "tag",
        href: "tools/meta-tag-generator/index.html"
      },
      {
        name: "QR Code Generator",
        category: "Utilities",
        description: "Create QR codes for URLs, text, and contact information. Customize colors and download in multiple formats.",
        icon: "qr-code",
        iconColor: "cyan",
        feature: "Generate",
        featureIcon: "qr-code",
        href: "tools/qr-generator/index.html"
      },
      {
        name: "PDF Merger",
        category: "Utilities",
        description: "Merge multiple PDF files into one document. Combine PDFs with drag and drop simplicity.",
        icon: "file-text",
        iconColor: "rose",
        feature: "Merge",
        featureIcon: "file-text",
        href: "tools/pdf-merger/index.html"
      }
    ];
    
    // Generate tools using shadcn/ui components
    generateToolsGrid(toolsData);
    
    // Update the home.js functionality to work with new structure
    updateHomeJS();
  }
  
  function generateToolsGrid(toolsData) {
    const toolsContainer = document.getElementById('home-tools');
    if (!toolsContainer) {
      console.error('Tools container not found');
      return;
    }
    
    // Clear existing content
    toolsContainer.innerHTML = '';
    
    // Generate each tool card
    toolsData.forEach(tool => {
      const toolCard = createToolCard(tool);
      toolsContainer.appendChild(toolCard);
    });
    
    console.log(`Generated ${toolsData.length} tool cards`);
  }
  
  function createToolCard(tool) {
    // Create the main card container
    const card = document.createElement('a');
    card.href = tool.href;
    card.className = 'group relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-lg transition-all duration-200 hover:border-primary/50 hover:bg-card/50';
    card.setAttribute('data-name', tool.name);
    card.setAttribute('data-category', tool.category);
    
    // Card content
    const cardContent = document.createElement('div');
    cardContent.className = 'p-8';
    
    // Card header with icon and badge
    const cardHeader = document.createElement('div');
    cardHeader.className = 'flex items-start justify-between mb-6';
    
    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = `w-14 h-14 rounded-lg bg-${tool.iconColor}-500/10 flex items-center justify-center group-hover:bg-${tool.iconColor}-500/20 transition-colors`;
    
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', tool.icon);
    icon.className = `w-7 h-7 text-${tool.iconColor}-600`;
    
    iconContainer.appendChild(icon);
    
    // Category badge
    const badge = document.createElement('span');
    badge.className = `inline-flex items-center rounded-lg bg-${tool.iconColor}-50 px-3 py-1 text-xs font-semibold text-${tool.iconColor}-700 ring-1 ring-inset ring-${tool.iconColor}-700/10 dark:bg-${tool.iconColor}-400/10 dark:text-${tool.iconColor}-400 dark:ring-${tool.iconColor}-400/30`;
    badge.textContent = tool.category;
    
    cardHeader.appendChild(iconContainer);
    cardHeader.appendChild(badge);
    
    // Card title
    const title = document.createElement('h3');
    title.className = 'font-semibold text-xl mb-3 group-hover:text-primary transition-colors';
    title.textContent = tool.name;
    
    // Card description
    const description = document.createElement('p');
    description.className = 'text-base text-muted-foreground leading-relaxed mb-6';
    description.textContent = tool.description;
    
    // Card footer
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-between';
    
    // Feature indicator
    const feature = document.createElement('div');
    feature.className = 'flex items-center text-sm text-muted-foreground';
    
    const featureIcon = document.createElement('i');
    featureIcon.setAttribute('data-lucide', tool.featureIcon);
    featureIcon.className = 'w-4 h-4 mr-2';
    
    const featureText = document.createElement('span');
    featureText.textContent = tool.feature;
    
    feature.appendChild(featureIcon);
    feature.appendChild(featureText);
    
    // Action indicator
    const action = document.createElement('div');
    action.className = 'flex items-center text-primary font-medium text-sm group-hover:translate-x-1 transition-transform';
    
    const actionText = document.createElement('span');
    actionText.textContent = 'Try Tool';
    
    const actionIcon = document.createElement('i');
    actionIcon.setAttribute('data-lucide', 'arrow-right');
    actionIcon.className = 'w-4 h-4 ml-2';
    
    action.appendChild(actionText);
    action.appendChild(actionIcon);
    
    footer.appendChild(feature);
    footer.appendChild(action);
    
    // Assemble the card
    cardContent.appendChild(cardHeader);
    cardContent.appendChild(title);
    cardContent.appendChild(description);
    cardContent.appendChild(footer);
    
    card.appendChild(cardContent);
    
    return card;
  }
  
  function updateHomeJS() {
    // Update the home.js functionality to work with the new structure
    const search = document.getElementById('home-search');
    const category = document.getElementById('category-filter');
    const sort = document.getElementById('sort-select');
    const container = document.getElementById('home-tools');
    const clearFiltersBtn = document.getElementById('clear-filters');
    
    if (!search || !container) {
      console.error('Required elements not found for home.js functionality');
      return;
    }
    
    // Get all tool cards
    const cards = Array.from(container.querySelectorAll('a[data-name]'));
    
    function getVisits(slug) {
      return parseInt(localStorage.getItem(`visits_${slug}`) || '0', 10);
    }
    
    function clearFilters() {
      if (search) search.value = '';
      if (category) category.value = 'All';
      if (sort) sort.value = 'az';
      render();
    }
    
    function render() {
      const term = search.value.toLowerCase();
      const cat = category.value;
      let sorted = [...cards];
      
      // Sort the cards
      if (sort.value === 'az') {
        sorted.sort((a, b) => {
          const nameA = a.getAttribute('data-name') || '';
          const nameB = b.getAttribute('data-name') || '';
          return nameA.localeCompare(nameB);
        });
      } else {
        sorted.sort((a, b) => {
          const hrefA = a.getAttribute('href') || '';
          const hrefB = b.getAttribute('href') || '';
          const visitsA = getVisits(hrefA);
          const visitsB = getVisits(hrefB);
          return visitsB - visitsA;
        });
      }
      
      // Clear the container and re-append sorted cards
      container.innerHTML = '';
      
      // Filter and show cards
      let visibleCount = 0;
      sorted.forEach(card => {
        const name = card.getAttribute('data-name') || '';
        const categoryText = card.getAttribute('data-category') || '';
        const description = card.querySelector('p')?.textContent || '';
        
        const text = (name + ' ' + categoryText + ' ' + description).toLowerCase();
        const show = text.includes(term) && (cat === 'All' || categoryText === cat);
        
        if (show) {
          container.appendChild(card);
          visibleCount++;
        }
      });
      
      // Show message if no results
      if (visibleCount === 0) {
        container.innerHTML = '<div class="text-center py-8 text-muted-foreground col-span-3">No tools match your search criteria.</div>';
      }
    }
    
    // Add event listeners
    search.addEventListener('input', render);
    if (category) category.addEventListener('change', render);
    if (sort) sort.addEventListener('change', render);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    
    // Initial render
    render();
    
    console.log('Home.js functionality updated for new tools structure');
  }
  
  // Initialize Lucide icons after generating cards
  function initializeIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
  
  // Initialize icons after a short delay to ensure DOM is ready
  setTimeout(initializeIcons, 100);
});

console.log('Tools refactor script loaded');
