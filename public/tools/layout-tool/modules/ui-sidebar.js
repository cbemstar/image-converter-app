/**
 * Initialize sidebar UI with consistent styling
 * @param {HTMLElement} el
 * @param {object} props
 */
export function initSidebar(el, props) {
  el.innerHTML = '';
  
  // Hero Image Upload Section
  const heroSection = document.createElement('div');
  heroSection.className = 'control-group';
  heroSection.innerHTML = `
    <h3 class="label">Hero Image</h3>
    <div class="upload-area" id="hero-upload">
      <div class="upload-text">
        <i class="fas fa-cloud-upload-alt mb-2" style="font-size: 1.5rem; color: var(--muted-foreground);"></i>
        <div>Click to upload hero image</div>
      </div>
      <div class="upload-hint">PNG, JPG up to 10MB</div>
    </div>
  `;
  
  const heroUpload = heroSection.querySelector('#hero-upload');
  const heroInput = document.createElement('input');
  heroInput.type = 'file';
  heroInput.accept = 'image/*';
  heroInput.style.display = 'none';
  heroInput.addEventListener('change', () => {
    const file = heroInput.files[0];
    if (file) {
      props.onUpload(file);
      heroUpload.querySelector('.upload-text div').textContent = file.name;
    }
  });
  
  heroUpload.addEventListener('click', () => heroInput.click());
  heroUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    heroUpload.classList.add('dragover');
  });
  heroUpload.addEventListener('dragleave', () => {
    heroUpload.classList.remove('dragover');
  });
  heroUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    heroUpload.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      props.onUpload(file);
      heroUpload.querySelector('.upload-text div').textContent = file.name;
    }
  });
  
  heroSection.appendChild(heroInput);
  el.appendChild(heroSection);

  // Elements Section
  const elementsSection = document.createElement('div');
  elementsSection.className = 'control-group';
  elementsSection.innerHTML = `
    <h3 class="label">Add Elements</h3>
    <div class="space-y-2">
      <button id="add-text-btn" class="btn btn-outline w-full">
        <i class="fas fa-font mr-2"></i>
        Add Text
      </button>
      <button id="add-logo-btn" class="btn btn-outline w-full">
        <i class="fas fa-image mr-2"></i>
        Add Logo
      </button>
    </div>
  `;
  
  const addTextBtn = elementsSection.querySelector('#add-text-btn');
  addTextBtn.addEventListener('click', () => {
    const text = prompt('Enter text:');
    if (text) props.onAddText(text);
  });
  
  const addLogoBtn = elementsSection.querySelector('#add-logo-btn');
  addLogoBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (file) props.onAddLogo(file);
    };
    input.click();
  });
  
  el.appendChild(elementsSection);

  // Presets Section
  const presetsSection = document.createElement('div');
  presetsSection.className = 'control-group';
  presetsSection.innerHTML = `
    <h3 class="label">Layout Presets</h3>
    <div class="preset-grid" id="preset-list"></div>
  `;
  
  const presetList = presetsSection.querySelector('#preset-list');
  
  // Group presets by category and subcategory
  const categories = {};
  props.presets.forEach(preset => {
    const category = preset.category || 'Other';
    const subcategory = preset.subcategory || 'General';
    
    if (!categories[category]) {
      categories[category] = {};
    }
    if (!categories[category][subcategory]) {
      categories[category][subcategory] = [];
    }
    categories[category][subcategory].push(preset);
  });
  
  // Add search functionality
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search presets...';
  searchInput.className = 'input mb-3';
  presetList.appendChild(searchInput);
  
  // Add select all/none buttons
  const selectButtons = document.createElement('div');
  selectButtons.className = 'flex gap-2 mb-3';
  selectButtons.innerHTML = `
    <button class="btn btn-outline text-xs flex-1" id="select-all-presets">Select All</button>
    <button class="btn btn-outline text-xs flex-1" id="select-none-presets">Select None</button>
  `;
  presetList.appendChild(selectButtons);
  
  // Create preset items container
  const presetsContainer = document.createElement('div');
  presetsContainer.id = 'presets-container';
  presetList.appendChild(presetsContainer);
  
  // Render presets by category and subcategory
  Object.entries(categories).forEach(([category, subcategories]) => {
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'text-sm font-bold text-[var(--foreground)] mb-2 mt-4 first:mt-0 border-b border-[var(--border)] pb-1';
    categoryHeader.textContent = category;
    presetsContainer.appendChild(categoryHeader);
    
    Object.entries(subcategories).forEach(([subcategory, presets]) => {
      // Add subcategory header if there are multiple subcategories
      if (Object.keys(subcategories).length > 1) {
        const subcategoryHeader = document.createElement('div');
        subcategoryHeader.className = 'text-xs font-semibold text-[var(--muted-foreground)] mb-2 mt-3 ml-2';
        subcategoryHeader.textContent = subcategory;
        presetsContainer.appendChild(subcategoryHeader);
      }
      
      presets.forEach(preset => {
        const presetItem = document.createElement('div');
        presetItem.className = 'preset-item';
        presetItem.dataset.category = category.toLowerCase();
        presetItem.dataset.subcategory = subcategory.toLowerCase();
        presetItem.dataset.name = preset.name.toLowerCase();
        
        const dimensions = preset.width && preset.height 
          ? `${preset.width}×${preset.height}px`
          : preset.width_mm && preset.height_mm 
            ? `${preset.width_mm}×${preset.height_mm}mm`
            : 'Custom';
        
        presetItem.innerHTML = `
          <input type="checkbox" class="preset-checkbox" data-name="${preset.name}">
          <div class="flex-1">
            <div class="preset-name">${preset.name}</div>
            <div class="preset-dimensions">${dimensions}</div>
          </div>
        `;
        
        const checkbox = presetItem.querySelector('.preset-checkbox');
        presetItem.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
          }
          presetItem.classList.toggle('selected', checkbox.checked);
        });
        
        checkbox.addEventListener('change', () => {
          presetItem.classList.toggle('selected', checkbox.checked);
        });
        
        presetsContainer.appendChild(presetItem);
      });
    });
  });
  
  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const presetItems = presetsContainer.querySelectorAll('.preset-item');
    
    presetItems.forEach(item => {
      const name = item.dataset.name;
      const category = item.dataset.category;
      const subcategory = item.dataset.subcategory;
      
      const matches = name.includes(searchTerm) || 
                     category.includes(searchTerm) || 
                     subcategory.includes(searchTerm);
      
      item.style.display = matches ? 'flex' : 'none';
    });
    
    // Show/hide category headers based on visible items
    const categoryHeaders = presetsContainer.querySelectorAll('.text-sm.font-bold');
    categoryHeaders.forEach(header => {
      const nextElements = [];
      let nextElement = header.nextElementSibling;
      
      while (nextElement && !nextElement.classList.contains('text-sm', 'font-bold')) {
        nextElements.push(nextElement);
        nextElement = nextElement.nextElementSibling;
      }
      
      const hasVisibleItems = nextElements.some(el => 
        el.classList.contains('preset-item') && el.style.display !== 'none'
      );
      
      header.style.display = hasVisibleItems ? 'block' : 'none';
    });
  });
  
  // Select all/none functionality
  const selectAllBtn = selectButtons.querySelector('#select-all-presets');
  const selectNoneBtn = selectButtons.querySelector('#select-none-presets');
  
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const checkboxes = presetsContainer.querySelectorAll('.preset-checkbox');
      checkboxes.forEach(checkbox => {
        if (checkbox.closest('.preset-item').style.display !== 'none') {
          checkbox.checked = true;
          checkbox.closest('.preset-item').classList.add('selected');
        }
      });
    });
  }
  
  if (selectNoneBtn) {
    selectNoneBtn.addEventListener('click', () => {
      const checkboxes = presetsContainer.querySelectorAll('.preset-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.closest('.preset-item').classList.remove('selected');
      });
    });
  }
  
  el.appendChild(presetsSection);

  // Generate Section
  const generateSection = document.createElement('div');
  generateSection.className = 'control-group';
  generateSection.innerHTML = `
    <button id="generate-btn" class="btn btn-outline primary w-full">
      <i class="fas fa-magic mr-2"></i>
      Generate Layouts
    </button>
  `;
  
  const generateBtn = generateSection.querySelector('#generate-btn');
  generateBtn.addEventListener('click', () => {
    const selected = Array.from(presetList.querySelectorAll('input:checked')).map(cb => cb.dataset.name);
    if (selected.length === 0) {
      alert('Please select at least one preset');
      return;
    }
    props.onGenerate(selected);
  });
  
  el.appendChild(generateSection);
}
