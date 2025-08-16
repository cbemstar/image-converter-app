// home.js - logic for the home page

document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('home-search');
  const category = document.getElementById('category-filter');
  const sort = document.getElementById('sort-select');
  const container = document.getElementById('home-tools');
  if (!search || !container) return;
  const cards = Array.from(container.querySelectorAll('.card'));
  const noResults = document.getElementById('no-results');
  function getVisits(slug) {
    return parseInt(localStorage.getItem(`visits_${slug}`) || '0', 10);
  }
  function render() {
    const term = search.value.toLowerCase();
    const cat = category.value;
    let sorted = [...cards];
    if (sort.value === 'az') {
      sorted.sort((a, b) => a.dataset.name.localeCompare(b.dataset.name));
    } else {
      sorted.sort((a, b) => getVisits(b.dataset.slug) - getVisits(a.dataset.slug));
    }
    container.innerHTML = '';
    let visibleCount = 0;
    sorted.forEach(card => {
      const text = card.dataset.name.toLowerCase() + ' ' + card.dataset.category.toLowerCase();
      const show = text.includes(term) && (cat === 'All' || card.dataset.category === cat);
      card.style.display = show ? '' : 'none';
      if (show) {
        visibleCount++;
        container.appendChild(card);
      }
    });
    if (noResults) noResults.classList.toggle('hidden', visibleCount !== 0);
  }
  search.addEventListener('input', render);
  if (category) category.addEventListener('change', render);
  if (sort) sort.addEventListener('change', render);
  render();
});
