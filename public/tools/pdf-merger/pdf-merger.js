import { showNotification } from '../../utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  const list = document.getElementById('pdf-list');
  const mergeBtn = document.getElementById('merge-btn');
  const downloadLink = document.getElementById('download-link');
  const progressStatus = document.getElementById('progress-status');
  const progressContainer = document.getElementById('progress-bar-container');
  const progressBar = document.getElementById('progress-bar');
  const extractBtn = document.getElementById('extract-btn');
  const imageFormatSelect = document.getElementById('image-format');
  const downloadImagesLink = document.getElementById('download-images-link');
  const selectBtn = document.getElementById('select-btn');

  let files = [];
  let sortable = null;

  function parseRange(range, pageCount) {
    const indices = [];
    for (const part of range.split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      let start, end;
      let m;
      if (/^\d+$/.test(seg)) {
        start = end = parseInt(seg, 10);
      } else if ((m = seg.match(/^(\d+)-(\d+)$/))) {
        start = parseInt(m[1], 10);
        end = parseInt(m[2], 10);
      } else if ((m = seg.match(/^(\d+)-$/))) {
        start = parseInt(m[1], 10);
        end = pageCount;
      } else if ((m = seg.match(/^-(\d+)$/))) {
        start = 1;
        end = parseInt(m[1], 10);
      } else {
        throw new Error(`Invalid range segment: ${seg}`);
      }
      if (start < 1 || end > pageCount || start > end) {
        throw new Error(`Invalid page numbers in segment: ${seg}`);
      }
      for (let i = start - 1; i < end; i++) {
        if (!indices.includes(i)) indices.push(i);
      }
    }
    return indices;
  }

  function setupSortable() {
    if (window.Sortable && list && !sortable) {
      sortable = new Sortable(list, {
        animation: 150,
        onEnd: e => {
          const item = files.splice(e.oldIndex, 1)[0];
          files.splice(e.newIndex, 0, item);
        }
      });
    }
  }

  async function renderList() {
    list.innerHTML = '';
    for (const f of files) {
      const li = document.createElement('li');
      li.className = 'flex flex-col items-center gap-1 p-2 border rounded-lg bg-[var(--card)]';

      const img = document.createElement('img');
      img.src = f.thumb;
      img.className = 'preview';

      const span = document.createElement('span');
      span.className = 'text-xs break-all text-center';
      span.textContent = `${f.file.name} (${f.pageCount}p)`;

      const rangeInput = document.createElement('input');
      rangeInput.type = 'text';
      rangeInput.className = 'range-input input text-xs w-24 text-center mt-1';
      rangeInput.placeholder = `1-${f.pageCount}`;
      rangeInput.value = f.range;
      rangeInput.addEventListener('input', () => {
        f.range = rangeInput.value.trim();
      });

      li.appendChild(img);
      li.appendChild(span);
      li.appendChild(rangeInput);
      list.appendChild(li);
    }
    setupSortable();
  }

  async function generateThumb(file) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { thumb: canvas.toDataURL(), pageCount: pdf.numPages };
  }

  async function handleFiles(fileList) {
    for (const file of Array.from(fileList)) {
      if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
        showNotification(`${file.name} is not a PDF`, 'error');
        continue;
      }
      try {
        const meta = await generateThumb(file);
        files.push({ file, thumb: meta.thumb, pageCount: meta.pageCount, range: `1-${meta.pageCount}` });
      } catch (err) {
        console.error('Failed to read PDF', err);
        showNotification(`Could not load ${file.name}`, 'error');
      }
    }
    await renderList();
  }

  dropArea.addEventListener('dragover', e => {
    e.preventDefault();
    dropArea.classList.add('border-blue-300');
  });

  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('border-blue-300');
  });

  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('border-blue-300');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });

  if (selectBtn) selectBtn.addEventListener('click', () => fileInput.click());

  mergeBtn.addEventListener('click', async () => {
    if (files.length === 0) {
      showNotification('Please add some PDF files first', 'error');
      return;
    }
    mergeBtn.disabled = true;
    downloadLink.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressStatus) progressStatus.textContent = `Merging 0 of ${files.length}`;
    if (progressContainer) progressContainer.setAttribute('aria-valuenow', '0');

    const merged = await PDFLib.PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      if (progressStatus) progressStatus.textContent = `Merging ${i + 1} of ${files.length}`;
      try {
        const buf = await files[i].file.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(buf);
        const indices = parseRange(files[i].range || `1-${files[i].pageCount}`, doc.getPageCount());
        const pages = await merged.copyPages(doc, indices);
        pages.forEach(p => merged.addPage(p));
      } catch (err) {
        console.error(err);
        showNotification(`Error merging ${files[i].file.name}: ${err.message}`, 'error');
      }
      if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / files.length) * 100)}%`;
      if (progressContainer) progressContainer.setAttribute('aria-valuenow', String(Math.round(((i + 1) / files.length) * 100)));
    }

    const mergedBytes = await merged.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = 'merged.pdf';
    downloadLink.style.display = 'inline-block';
    if (progressStatus) progressStatus.textContent = 'Merge complete!';
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';
    if (progressContainer) progressContainer.setAttribute('aria-valuenow', '100');
    mergeBtn.disabled = false;
  });
  extractBtn.addEventListener('click', async () => {
    if (files.length === 0) {
      showNotification('Please add some PDF files first', 'error');
      return;
    }
    extractBtn.disabled = true;
    downloadImagesLink.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressStatus) progressStatus.textContent = `Extracting 0 pages`;
    if (progressContainer) progressContainer.setAttribute('aria-valuenow', '0');
    const format = imageFormatSelect ? imageFormatSelect.value : 'jpeg';
    const zip = new JSZip();
    let processed = 0;
    let total = 0;
    for (const f of files) {
      const buf = await f.file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const indices = parseRange(f.range || `1-${f.pageCount}`, pdf.numPages);
      total += indices.length;
      for (const idx of indices) {
        const page = await pdf.getPage(idx + 1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
        const blob = await new Promise(r => canvas.toBlob(r, mime, 0.92));
        const base = f.file.name.replace(/\.pdf$/i, '');
        const ext = format === 'jpeg' ? 'jpg' : format;
        zip.file(`${base}_p${idx + 1}.${ext}`, blob);
        processed++;
        if (progressStatus) progressStatus.textContent = `Extracting ${processed} of ${total}`;
        if (progressBar) progressBar.style.width = `${Math.round((processed / total) * 100)}%`;
        if (progressContainer) progressContainer.setAttribute('aria-valuenow', String(Math.round((processed / total) * 100)));
      }
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadImagesLink.href = URL.createObjectURL(zipBlob);
    downloadImagesLink.download = 'pdf_pages.zip';
    downloadImagesLink.style.display = 'inline-block';
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';
    if (progressStatus) progressStatus.textContent = 'Extraction complete!';
    if (progressContainer) progressContainer.setAttribute('aria-valuenow', '100');
    extractBtn.disabled = false;
  });
});

