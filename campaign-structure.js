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
    if (!campaign || !adGroup || !ad) {
      output.textContent = 'Please fill in all fields.';
      return;
    }
    output.innerHTML = `
      <div class="border rounded p-4">
        <div class="font-semibold">${campaign} <span class="text-sm">(${type})</span></div>
        <ul class="ml-4 mt-2 list-disc">
          <li>
            <span class="font-medium">${adGroup}</span>
            <ul class="ml-4 mt-1 list-disc">
              <li>${ad}</li>
            </ul>
          </li>
        </ul>
      </div>`;
  });
});
