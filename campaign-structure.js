document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('structure-form');
  const output = document.getElementById('structure-output');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('campaign-type').value.trim();
    const campaign = document.getElementById('campaign-name').value.trim();
    const adGroup = document.getElementById('ad-group-name').value.trim();
    const ad = document.getElementById('ad-name').value.trim();
    const keywords = document.getElementById('keywords').value.trim();
    if (!campaign || !adGroup || !ad) {
      output.textContent = 'Please fill in all fields.';
      return;
    }
    output.innerHTML = `
      <pre class="bg-[var(--background)] border rounded p-4 font-mono overflow-x-auto">
<span class="text-blue-400 font-semibold">${campaign}</span>/ <span class="text-sm">(${type})</span>
├── <span class="text-green-400 font-semibold">${adGroup}</span>/
│   ├── <span class="text-yellow-300 font-semibold">${ad}</span>
│   └── keywords: ${keywords || '(none)'}
</pre>`;
  });
});
