// home.js - logic for the home page

document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('home-search');
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
