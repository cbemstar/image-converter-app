document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('structure-form');
  const output = document.getElementById('structure-output');
  const downloadBtns = document.getElementById('download-buttons');
  const pngBtn = document.getElementById('download-png');
  const pdfBtn = document.getElementById('download-pdf');

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
      <pre id="tree" class="bg-[var(--background)] border rounded p-4 font-mono overflow-x-auto">
<span class="text-blue-400 font-semibold">${campaign}</span>/ <span class="text-sm">(${type})</span>
├── <span class="text-green-400 font-semibold">${adGroup}</span>/
│   ├── <span class="text-yellow-300 font-semibold">${ad}</span>
│   └── keywords: ${keywords || '(none)'}
</pre>`;
    downloadBtns.style.display = 'flex';
  });

  if (pngBtn) {
    pngBtn.addEventListener('click', () => {
      const tree = document.getElementById('tree');
      if (!tree) return;
      html2canvas(tree).then(canvas => {
        const link = document.createElement('a');
        link.download = 'campaign-structure.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      const tree = document.getElementById('tree');
      if (!tree) return;
      html2canvas(tree).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        doc.save('campaign-structure.pdf');
      });
    });
  }
});
