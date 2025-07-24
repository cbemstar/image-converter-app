// home.js - logic for the home page

document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('home-search');
  const category = document.getElementById('category-filter');
  const sort = document.getElementById('sort-select');
  const container = document.getElementById('home-tools');
  if (!search || !container) return;
  const cards = Array.from(container.querySelectorAll('.tool-card'));
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
    sorted.forEach(card => {
      const text = card.dataset.name.toLowerCase() + ' ' + card.dataset.category.toLowerCase();
      const show = text.includes(term) && (cat === 'All' || card.dataset.category === cat);
      card.style.display = show ? '' : 'none';
      container.appendChild(card);
    });
  }
  search.addEventListener('input', render);
  if (category) category.addEventListener('change', render);
  if (sort) sort.addEventListener('change', render);
  render();
  if (!search) return;
  const cards = document.querySelectorAll('.tool-card');
  search.addEventListener('input', () => {
    const term = search.value.toLowerCase();
    cards.forEach(card => {
      const text = card.dataset.name.toLowerCase() + ' ' + card.dataset.category.toLowerCase();
      card.style.display = text.includes(term) ? '' : 'none';
    });
  });
});
