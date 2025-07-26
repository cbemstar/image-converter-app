document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('structure-form');
  const tree = document.getElementById('tree');
  const downloadBtns = document.getElementById('download-buttons');
  const pngBtn = document.getElementById('download-png');
  const pdfBtn = document.getElementById('download-pdf');
  const csvBtn = document.getElementById('download-csv');
  if (!form || !tree) return;

  const campaigns = [];
  let id = 0;
  const nextId = () => 'id' + (++id);

  function addEntry(type, campName, groupName, adName, keywords) {
    let camp = campaigns.find(c => c.name === campName && c.type === type);
    if (!camp) {
      camp = { id: nextId(), type, name: campName, adGroups: [] };
      campaigns.push(camp);
    }
    let group = camp.adGroups.find(g => g.name === groupName);
    if (!group) {
      group = { id: nextId(), name: groupName, ads: [] };
      camp.adGroups.push(group);
    }
    group.ads.push({ id: nextId(), name: adName, keywords });
  }

  function makeEditable(el, onSave) {
    el.addEventListener('dblclick', () => {
      el.setAttribute('contenteditable', 'true');
      el.focus();
    });
    el.addEventListener('blur', () => {
      el.removeAttribute('contenteditable');
      onSave(el.textContent.trim());
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
    });
  }

  function render() {
    tree.innerHTML = '';
    const list = document.createElement('ul');
    list.id = 'campaign-list';
    list.className = 'space-y-2';
    campaigns.forEach(c => {
      const li = document.createElement('li');
      li.dataset.id = c.id;
      li.className = 'border rounded p-2';

      const header = document.createElement('div');
      header.className = 'flex items-center gap-2';
      header.innerHTML = `<span class="drag-handle cursor-move">&#x2630;</span>
        <span class="campaign-name cursor-pointer">${c.name}</span>
        <span class="text-sm opacity-70">(${c.type})</span>`;
      li.appendChild(header);
      makeEditable(header.querySelector('.campaign-name'), val => { c.name = val; });

      const agList = document.createElement('ul');
      agList.className = 'ml-4 mt-2 space-y-2';
      c.adGroups.forEach(g => {
        const agLi = document.createElement('li');
        agLi.dataset.id = g.id;
        agLi.className = 'border rounded p-2';

        const agHeader = document.createElement('div');
        agHeader.className = 'flex items-center gap-2';
        agHeader.innerHTML = `<span class="drag-handle cursor-move">&#x2630;</span>
          <span class="adgroup-name cursor-pointer">${g.name}</span>`;
        agLi.appendChild(agHeader);
        makeEditable(agHeader.querySelector('.adgroup-name'), val => { g.name = val; });

        const adList = document.createElement('ul');
        adList.className = 'ml-4 mt-1 space-y-1';
        g.ads.forEach(a => {
          const adLi = document.createElement('li');
          adLi.dataset.id = a.id;
          adLi.className = 'border rounded p-2';
          adLi.innerHTML = `<div class="flex items-center gap-2">
              <span class="drag-handle cursor-move">&#x2630;</span>
              <span class="ad-name cursor-pointer">${a.name}</span>
            </div>
            <div class="ml-6 text-sm opacity-70">Keywords: <span class="keywords">${a.keywords || '(none)'}</span></div>`;
          makeEditable(adLi.querySelector('.ad-name'), val => { a.name = val; });
          adList.appendChild(adLi);
        });
        agLi.appendChild(adList);
        agList.appendChild(agLi);
      });
      li.appendChild(agList);
      list.appendChild(li);
    });
    tree.appendChild(list);
    setupSortables();
    downloadBtns.classList.toggle('hidden', campaigns.length === 0);
  }

  function setupSortables() {
    if (!window.Sortable) return;
    const campList = document.getElementById('campaign-list');
    if (!campList) return;
    new Sortable(campList, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: e => {
        const item = campaigns.splice(e.oldIndex, 1)[0];
        campaigns.splice(e.newIndex, 0, item);
      }
    });
    campaigns.forEach(c => {
      const agList = document.querySelector(`li[data-id="${c.id}"] > ul`);
      if (agList) {
        new Sortable(agList, {
          handle: '.drag-handle',
          animation: 150,
          onEnd: e => {
            const arr = c.adGroups;
            const item = arr.splice(e.oldIndex, 1)[0];
            arr.splice(e.newIndex, 0, item);
          }
        });
      }
      c.adGroups.forEach(g => {
        const adList = document.querySelector(`li[data-id="${g.id}"] > ul`);
        if (adList) {
          new Sortable(adList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: e => {
              const arr = g.ads;
              const item = arr.splice(e.oldIndex, 1)[0];
              arr.splice(e.newIndex, 0, item);
            }
          });
        }
      });
    });
  }

  function exportCsv() {
    const rows = [['Campaign','Ad Group','Ad Name','Keywords']];
    campaigns.forEach(c => {
      c.adGroups.forEach(g => {
        g.ads.forEach(a => {
          rows.push([c.name, g.name, a.name, a.keywords]);
        });
      });
    });
    if (rows.length <= 1) return;
    const csv = rows.map(r => r.map(v => `"${(v || '').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaign-structure.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const type = document.getElementById('campaign-type').value.trim();
    const campaign = document.getElementById('campaign-name').value.trim();
    const adGroup = document.getElementById('ad-group-name').value.trim();
    const ad = document.getElementById('ad-name').value.trim();
    const keywords = document.getElementById('keywords').value.trim();
    if (!campaign || !adGroup || !ad) {
      tree.textContent = 'Please fill in all fields.';
      return;
    }
    addEntry(type, campaign, adGroup, ad, keywords);
    render();
  });

  if (pngBtn) {
    pngBtn.addEventListener('click', () => {
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

  if (csvBtn) csvBtn.addEventListener('click', exportCsv);
});
