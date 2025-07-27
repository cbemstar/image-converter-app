import { showNotification, formatFileSize } from './utils.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js';

function byId(id) {
  return document.getElementById(id);
}

let editorBytes;
let editorDoc;
let drawings = {};
let texts = [];

function renderPage(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  const renderTask = page.render({ canvasContext: ctx, viewport });
  return renderTask.promise.then(() => canvas);
}

async function loadEditor(file) {
  editorBytes = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: editorBytes });
  const pdf = await loadingTask.promise;
  const container = byId('pdf-preview');
  container.innerHTML = '';
  drawings = {};
  texts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const canvas = await renderPage(page, 1.2);
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);
  }
  showNotification(`Loaded ${pdf.numPages} pages`, 'success');
}

function addText() {
  const text = prompt('Enter text');
  if (!text) return;
  const wrapper = byId('pdf-preview').querySelector('div');
  if (!wrapper) return;
  const div = document.createElement('div');
  div.textContent = text;
  div.style.position = 'absolute';
  div.style.top = '20px';
  div.style.left = '20px';
  div.style.color = 'red';
  div.contentEditable = true;
  wrapper.appendChild(div);
  texts.push({ page: 0, x: 20, y: wrapper.firstChild.height - 20, text });
}

function enableDrawing() {
  const canvas = byId('pdf-preview').querySelector('canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let path = [];
  canvas.addEventListener('mousedown', e => {
    drawing = true;
    path = [{ x: e.offsetX, y: e.offsetY }];
  });
  canvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'blue';
    ctx.lineCap = 'round';
    ctx.beginPath();
    const last = path[path.length - 1];
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    path.push({ x: e.offsetX, y: e.offsetY });
  });
  window.addEventListener('mouseup', () => {
    if (drawing) {
      drawings[0] = drawings[0] || [];
      drawings[0].push(path);
    }
    drawing = false;
  }, { once: true });
}

async function savePdf() {
  if (!editorBytes) return;
  const pdfDoc = await PDFLib.PDFDocument.load(editorBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  const helvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  texts.forEach(t => {
    const page = pages[t.page];
    if (!page) return;
    page.drawText(t.text, {
      x: t.x,
      y: t.y,
      font: helvetica,
      size: 12,
      color: PDFLib.rgb(1, 0, 0),
    });
  });
  if (drawings[0]) {
    const page = pages[0];
    drawings[0].forEach(path => {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        page.drawLine({ start: { x: a.x, y: height - a.y }, end: { x: b.x, y: height - b.y }, thickness: 2, color: PDFLib.rgb(0, 0, 1) });
      }
    });
  }
  const bytes = await pdfDoc.save({ useObjectStreams: false });
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'edited.pdf';
  link.click();
}

async function mergePdfs(files) {
  const merged = await PDFLib.PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  const bytes = await merged.save({ useObjectStreams: false });
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'merged.pdf';
  link.click();
}

function parseRanges(str, total) {
  const parts = str.split(/[, ]+/).filter(Boolean);
  const pages = new Set();
  for (const part of parts) {
    if (part.includes('-')) {
      const [s, e] = part.split('-').map(n => parseInt(n, 10));
      for (let i = s; i <= e; i++) pages.add(i);
    } else {
      pages.add(parseInt(part, 10));
    }
  }
  return Array.from(pages).filter(n => n >= 1 && n <= total).sort((a,b)=>a-b);
}

async function splitPdf(file, ranges) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(bytes);
  const zip = new JSZip();
  const indices = doc.getPageIndices();
  ranges.forEach(async (num, idx) => {
    const newDoc = await PDFLib.PDFDocument.create();
    const [page] = await newDoc.copyPages(doc, [num - 1]);
    newDoc.addPage(page);
    const out = await newDoc.save({ useObjectStreams: false });
    zip.file(`page-${num}.pdf`, out);
  });
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = 'split-pages.zip';
  link.click();
}

async function compressPdf(file, level) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(bytes);
  const out = await doc.save({ useObjectStreams: level !== 'high', compress: true });
  const blob = new Blob([out], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'compressed.pdf';
  link.click();
}

async function convertFiles(files, type) {
  const results = byId('convert-results');
  results.innerHTML = '';
  if (type === 'images-to-pdf') {
    const doc = await PDFLib.PDFDocument.create();
    for (const file of files) {
      const imgBytes = await file.arrayBuffer();
      let img;
      if (file.type.includes('png')) {
        img = await doc.embedPng(imgBytes);
      } else {
        img = await doc.embedJpg(imgBytes);
      }
      const page = doc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    const out = await doc.save({ useObjectStreams: false });
    const blob = new Blob([out], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'converted.pdf';
    link.click();
  } else {
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const canvas = await renderPage(page, 2);
        const mime = type === 'pdf-to-jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise(r => canvas.toBlob(r, mime));
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${file.name.replace(/\.pdf$/i,'')}-page${i}.${mime === 'image/jpeg' ? 'jpg' : 'png'}`;
        link.textContent = link.download + ` (${formatFileSize(blob.size)})`;
        link.className = 'block text-[var(--foreground)]';
        results.appendChild(link);
      }
    }
  }
}

async function securePdf(file, pwd, remove) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(bytes);
  if (!remove && pwd) {
    doc.encrypt({ ownerPassword: pwd, userPassword: pwd, permissions: { printing: 'highResolution', modifying: false, copying: false } });
  }
  const out = await doc.save({ useObjectStreams: false });
  const blob = new Blob([out], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'secured.pdf';
  link.click();
}

// Event bindings

document.addEventListener('DOMContentLoaded', () => {
  byId('editor-upload')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadEditor(file);
  });
  byId('add-text')?.addEventListener('click', addText);
  byId('draw-tool')?.addEventListener('click', enableDrawing);
  byId('save-pdf')?.addEventListener('click', savePdf);

  byId('merge-btn')?.addEventListener('click', () => {
    const files = byId('merge-upload').files;
    if (files && files.length) mergePdfs(Array.from(files));
  });

  byId('split-btn')?.addEventListener('click', () => {
    const file = byId('split-upload').files[0];
    if (!file) return;
    const ranges = parseRanges(byId('split-ranges').value, 1000);
    splitPdf(file, ranges);
  });

  byId('compress-btn')?.addEventListener('click', () => {
    const file = byId('compress-upload').files[0];
    const level = byId('compression-level').value;
    if (file) compressPdf(file, level);
  });

  byId('convert-btn')?.addEventListener('click', () => {
    const files = Array.from(byId('convert-upload').files);
    const type = byId('convert-type').value;
    if (files.length) convertFiles(files, type);
  });

  byId('security-btn')?.addEventListener('click', () => {
    const file = byId('security-upload').files[0];
    if (!file) return;
    const pwd = byId('security-password').value;
    const remove = byId('remove-password').checked;
    securePdf(file, pwd, remove);
  });

  // Setup FAQs toggle
  if (typeof setupFaqs === 'function') {
    setupFaqs();
  }
});
