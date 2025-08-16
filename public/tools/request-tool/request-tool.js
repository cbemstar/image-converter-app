import { showNotification } from '../../utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('tool-request-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('tool-name').value.trim();
    const problem = document.getElementById('tool-problem').value.trim();
    const requesterName = document.getElementById('requester-name').value.trim();
    const email = document.getElementById('requester-email').value.trim();

    if (!name || !problem) {
      showNotification('Please fill in the required fields.', 'error');
      return;
    }

    const requests = JSON.parse(localStorage.getItem('toolRequests') || '[]');
    requests.push({ name, problem, requesterName, email, date: Date.now() });
    localStorage.setItem('toolRequests', JSON.stringify(requests));

    form.reset();
    showNotification('Thanks for your suggestion!', 'success');

    // Visible confirmation
    let confirm = document.getElementById('tool-request-confirmation');
    if (!confirm) {
      confirm = document.createElement('div');
      confirm.id = 'tool-request-confirmation';
      confirm.className = 'mt-3 p-3 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]';
      confirm.setAttribute('role', 'status');
      confirm.setAttribute('aria-live', 'polite');
      form.parentNode.insertBefore(confirm, form.nextSibling);
    }
    confirm.textContent = email ? 'We received your request. We\'ll email you if we build it.' : 'We received your request. Check back on the homepage for updates.';
  });
});
