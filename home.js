// home.js - logic for the home page

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing home page...');
  
  const search = document.getElementById('home-search');
  const category = document.getElementById('category-filter');
  const sort = document.getElementById('sort-select');
  const container = document.getElementById('home-tools');
  const clearFiltersBtn = document.getElementById('clear-filters');
  
  console.log('Elements found:', {
    search: !!search,
    category: !!category,
    sort: !!sort,
    container: !!container,
    clearFiltersBtn: !!clearFiltersBtn
  });
  
  if (!search || !container) {
    console.error('Required elements not found:', { search: !!search, container: !!container });
    return;
  }
  
  // Get all tool cards (they are <a> elements with the class 'group')
  const cards = Array.from(container.querySelectorAll('a[data-name]'));
  
  console.log('Found tool cards:', cards.length);
  console.log('Container children:', container.children);
  
  if (cards.length === 0) {
    console.warn('No tool cards found in home-tools container');
    // Show a message to the user
    container.innerHTML = '<div class="text-center py-8 text-muted-foreground col-span-3">No tools found. Please check the page structure.</div>';
    return;
  }
  
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
    console.log('Rendering tools...');
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
      // Sort by visits (most visited first)
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
    
    console.log(`Rendered ${visibleCount} visible tools out of ${cards.length} total`);
  }
  
  // Add event listeners
  search.addEventListener('input', render);
  if (category) category.addEventListener('change', render);
  if (sort) sort.addEventListener('change', render);
  if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
  
  // Initial render
  render();
  
  console.log(`Home page initialized with ${cards.length} tool cards`);
});
