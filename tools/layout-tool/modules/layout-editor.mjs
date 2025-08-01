/**
 * Layout Editor Module - Provides full-screen editing for individual layouts
 */

/* eslint-disable */
// @ts-nocheck
// IDE AUTOFIX DISABLED - This file has complex function dependencies
import { showNotification } from '../../../utils.js';
import { createThumbnail } from './canvas-engine.js';
import { exportSingle } from './export-raster.js';

let currentEditor = null;
let editorState = {
  canvas: null,
  ctx: null,
  preset: null,
  master: null,
  objects: [],
  selectedElement: null,
  isDragging: false,
  scale: 1,
  panX: 0,
  panY: 0,
  // Hero image cropping and positioning
  heroImage: null,
  heroCrop: {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    scale: 1
  },
  cropMode: false,
  cropHandles: [],
  dragHandle: null
};

/**
 * Open the full-screen layout editor
 * @param {HTMLCanvasElement} artboardCanvas - The artboard to edit
 * @param {object} preset - The preset configuration
 * @param {object} master - The master document state
 * @param {function} onSave - Callback when changes are saved
 */
export function openLayoutEditor(artboardCanvas, preset, master, onSave) {
  // Create editor overlay
  const editorOverlay = document.createElement('div');
  editorOverlay.id = 'layout-editor-overlay';
  editorOverlay.className = 'fixed inset-0 bg-[var(--background)] z-50 flex flex-col';

  // Create editor header
  const header = document.createElement('div');
  header.className = 'bg-[var(--card)] border-b border-[var(--border)] p-4 flex items-center justify-between';
  header.innerHTML = `
    <div class="flex items-center gap-4">
      <h2 class="text-xl font-bold text-[var(--foreground)]">Edit Layout: ${preset.name}</h2>
      <div class="text-sm text-[var(--muted-foreground)]">
        ${preset.width || Math.round(preset.width_mm * 11.811)} × ${preset.height || Math.round(preset.height_mm * 11.811)}px
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button id="editor-reset" class="layout-btn">
        <i class="fas fa-undo mr-2"></i>Reset
      </button>
      <button id="editor-save" class="layout-btn primary">
        <i class="fas fa-save mr-2"></i>Save Changes
      </button>
      <button id="editor-close" class="layout-btn">
        <i class="fas fa-times mr-2"></i>Close
      </button>
    </div>
  `;

  // Create editor content area
  const content = document.createElement('div');
  content.className = 'flex-1 flex';

  // Create sidebar for tools
  const sidebar = document.createElement('div');
  sidebar.className = 'w-80 bg-[var(--card)] border-r border-[var(--border)] p-4 overflow-y-auto';
  sidebar.innerHTML = `
    <div class="space-y-6">
      <!-- Hero Image Controls -->
      <div id="hero-controls">
        <h3 class="layout-label mb-3">Hero Image</h3>
        <div class="space-y-3">
          <button id="crop-mode-btn" class="layout-btn w-full">
            <i class="fas fa-crop mr-2"></i>Crop & Position
          </button>
          <div id="hero-properties" class="hidden space-y-3">
            <div>
              <label class="layout-label text-sm">Position X</label>
              <input type="range" id="hero-x" class="layout-input" min="-100" max="100" value="0">
              <span id="hero-x-value" class="text-xs text-[var(--muted-foreground)]">0%</span>
            </div>
            <div>
              <label class="layout-label text-sm">Position Y</label>
              <input type="range" id="hero-y" class="layout-input" min="-100" max="100" value="0">
              <span id="hero-y-value" class="text-xs text-[var(--muted-foreground)]">0%</span>
            </div>
            <div>
              <label class="layout-label text-sm">Scale</label>
              <input type="range" id="hero-scale" class="layout-input" min="50" max="200" value="100">
              <span id="hero-scale-value" class="text-xs text-[var(--muted-foreground)]">100%</span>
            </div>
            <div class="flex gap-2">
              <button id="hero-fit" class="layout-btn flex-1 text-xs">Fit</button>
              <button id="hero-fill" class="layout-btn flex-1 text-xs">Fill</button>
              <button id="hero-reset" class="layout-btn flex-1 text-xs">Reset</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Element List -->
      <div>
        <h3 class="layout-label mb-3">Elements</h3>
        <div id="element-list" class="space-y-2"></div>
      </div>
      
      <!-- Element Properties -->
      <div id="element-properties" class="hidden">
        <h3 class="layout-label mb-3">Properties</h3>
        <div class="space-y-3">
          <div>
            <label class="layout-label text-sm">Position X</label>
            <input type="number" id="prop-x" class="layout-input">
          </div>
          <div>
            <label class="layout-label text-sm">Position Y</label>
            <input type="number" id="prop-y" class="layout-input">
          </div>
          <div id="text-properties" class="hidden space-y-3">
            <div>
              <label class="layout-label text-sm">Text</label>
              <textarea id="prop-text" class="layout-input" rows="2" placeholder="Enter your text here..."></textarea>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="layout-label text-sm">Font Size</label>
                <input type="number" id="prop-size" class="layout-input" min="8" max="200" value="24">
              </div>
              <div>
                <label class="layout-label text-sm">Line Height</label>
                <input type="number" id="prop-line-height" class="layout-input" min="0.8" max="3" step="0.1" value="1.2">
              </div>
            </div>
            <div>
              <label class="layout-label text-sm">Font Family</label>
              <select id="prop-font-family" class="layout-input">
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
                <option value="Impact">Impact</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Courier New">Courier New</option>
                <option value="Lucida Console">Lucida Console</option>
              </select>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="layout-label text-sm">Weight</label>
                <select id="prop-font-weight" class="layout-input">
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="lighter">Light</option>
                  <option value="bolder">Extra Bold</option>
                </select>
              </div>
              <div>
                <label class="layout-label text-sm">Style</label>
                <select id="prop-font-style" class="layout-input">
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                  <option value="oblique">Oblique</option>
                </select>
              </div>
              <div>
                <label class="layout-label text-sm">Align</label>
                <select id="prop-text-align" class="layout-input">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="layout-label text-sm">Text Color</label>
                <input type="color" id="prop-color" class="layout-input" value="#000000">
              </div>
              <div>
                <label class="layout-label text-sm">Background</label>
                <input type="color" id="prop-bg-color" class="layout-input" value="#ffffff">
              </div>
            </div>
            <div>
              <label class="layout-label text-sm">Text Effects</label>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex items-center gap-2">
                  <input type="checkbox" id="prop-text-shadow" class="w-4 h-4">
                  <span class="text-sm">Text Shadow</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" id="prop-text-outline" class="w-4 h-4">
                  <span class="text-sm">Text Outline</span>
                </label>
              </div>
            </div>
          </div>
          <div id="logo-properties" class="hidden space-y-3">
            <div>
              <label class="layout-label text-sm">Width</label>
              <input type="number" id="prop-width" class="layout-input" min="10">
            </div>
            <div>
              <label class="layout-label text-sm">Height</label>
              <input type="number" id="prop-height" class="layout-input" min="10">
            </div>
          </div>
        </div>
      </div>
      
      <!-- Add Elements -->
      <div>
        <h3 class="layout-label mb-3">Add Elements</h3>
        <div class="space-y-2">
          <button id="add-text-editor" class="layout-btn w-full">
            <i class="fas fa-font mr-2"></i>Add Text
          </button>
          <button id="add-logo-editor" class="layout-btn w-full">
            <i class="fas fa-image mr-2"></i>Add Logo
          </button>
        </div>
      </div>
    </div>
  `;

  // Create canvas area
  const canvasArea = document.createElement('div');
  canvasArea.className = 'flex-1 bg-[var(--muted)] p-8 overflow-auto flex items-center justify-center';
  canvasArea.innerHTML = `
    <div class="bg-white rounded-lg shadow-lg p-4">
      <canvas id="editor-canvas" class="border border-gray-300 rounded"></canvas>
    </div>
  `;

  content.appendChild(sidebar);
  content.appendChild(canvasArea);

  editorOverlay.appendChild(header);
  editorOverlay.appendChild(content);
  document.body.appendChild(editorOverlay);

  // Initialize editor
  initializeEditor(artboardCanvas, preset, master, onSave);

  // Bind events
  bindEditorEvents();

  currentEditor = editorOverlay;
}

/**
 * Initialize the editor with the artboard data
 */
function initializeEditor(artboardCanvas, preset, master, onSave) {
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');

  // Set canvas size
  canvas.width = artboardCanvas.width;
  canvas.height = artboardCanvas.height;

  // Calculate scale to fit in viewport
  const maxWidth = window.innerWidth - 400; // Account for sidebar
  const maxHeight = window.innerHeight - 200; // Account for header/padding
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height, 1);

  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;

  // Store editor state
  editorState = {
    canvas,
    ctx,
    preset,
    master,
    objects: cloneObjects(master.objects),
    selectedElement: null,
    isDragging: false,
    scale,
    panX: 0,
    panY: 0,
    onSave,
    // Hero image cropping and positioning
    heroImage: master.hero,
    heroCrop: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      scale: 1
    },
    cropMode: false,
    cropHandles: [],
    dragHandle: null
  };

  // Initial render
  renderEditor();
  updateElementList();
}

/**
 * Clone objects for independent editing
 */
function cloneObjects(objects) {
  return objects.map(obj => ({
    ...obj,
    // Create independent copy for this layout
    id: Math.random().toString(36).substr(2, 9)
  }));
}

/**
 * Draw hero image with cropping and positioning
 */
function drawHeroImage(ctx, canvasWidth, canvasHeight) {
  const { heroImage, heroCrop } = editorState;
  if (!heroImage) return;

  // Calculate source dimensions based on crop settings
  const sourceX = heroCrop.x * heroImage.width;
  const sourceY = heroCrop.y * heroImage.height;
  const sourceWidth = heroCrop.width * heroImage.width;
  const sourceHeight = heroCrop.height * heroImage.height;

  // Calculate destination dimensions based on scale
  const destWidth = canvasWidth * heroCrop.scale;
  const destHeight = canvasHeight * heroCrop.scale;

  // Center the scaled image and apply position offset
  const destX = (canvasWidth - destWidth) / 2 + (heroCrop.x * canvasWidth * 0.5);
  const destY = (canvasHeight - destHeight) / 2 + (heroCrop.y * canvasHeight * 0.5);

  ctx.save();

  // Clip to canvas bounds
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.clip();

  // Draw the hero image
  ctx.drawImage(
    heroImage,
    0, 0, heroImage.width, heroImage.height,
    destX, destY, destWidth, destHeight
  );

  ctx.restore();

  // Draw crop overlay if in crop mode
  if (editorState.cropMode) {
    drawCropOverlay(ctx, canvasWidth, canvasHeight);
  }
}

/**
 * Draw crop overlay with interactive handles
 */
function drawCropOverlay(ctx, canvasWidth, canvasHeight) {
  ctx.save();

  // Calculate crop area based on heroCrop settings
  const { heroCrop } = editorState;
  const cropX = canvasWidth * 0.1 + (heroCrop.x * canvasWidth * 0.1);
  const cropY = canvasHeight * 0.1 + (heroCrop.y * canvasHeight * 0.1);
  const cropWidth = canvasWidth * 0.8 * heroCrop.width;
  const cropHeight = canvasHeight * 0.8 * heroCrop.height;

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Clear the crop area to show the image
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(cropX, cropY, cropWidth, cropHeight);
  ctx.globalCompositeOperation = 'source-over';

  // Draw crop border
  ctx.strokeStyle = '#007bff';
  ctx.lineWidth = 2;
  ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);

  // Draw corner handles
  const handleSize = 12;
  ctx.fillStyle = '#007bff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  // Store handle positions for interaction
  editorState.cropHandles = [
    { x: cropX, y: cropY, type: 'nw' }, // Northwest
    { x: cropX + cropWidth, y: cropY, type: 'ne' }, // Northeast
    { x: cropX, y: cropY + cropHeight, type: 'sw' }, // Southwest
    { x: cropX + cropWidth, y: cropY + cropHeight, type: 'se' }, // Southeast
    { x: cropX + cropWidth / 2, y: cropY, type: 'n' }, // North
    { x: cropX + cropWidth / 2, y: cropY + cropHeight, type: 's' }, // South
    { x: cropX, y: cropY + cropHeight / 2, type: 'w' }, // West
    { x: cropX + cropWidth, y: cropY + cropHeight / 2, type: 'e' } // East
  ];

  // Draw handles
  editorState.cropHandles.forEach(handle => {
    ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
  });

  // Draw center drag area
  ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
  ctx.fillRect(cropX, cropY, cropWidth, cropHeight);

  ctx.restore();
}

/**
 * Render the editor canvas
 */
function renderEditor() {
  const { canvas, ctx, preset, master, objects } = editorState;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fill background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw hero image if present with cropping and positioning
  if (editorState.heroImage) {
    drawHeroImage(ctx, canvas.width, canvas.height);
  }

  // Calculate scale factors
  const scaleX = canvas.width / master.width;
  const scaleY = canvas.height / master.height;

  // Draw all objects
  for (const obj of objects) {
    ctx.save();

    const scaledX = obj.x * scaleX;
    const scaledY = obj.y * scaleY;

    if (obj.type === 'text') {
      // Enhanced text rendering with new properties
      const scaledSize = (obj.size || 24) * Math.min(scaleX, scaleY);
      const fontFamily = obj.fontFamily || 'Arial';
      const fontWeight = obj.fontWeight || 'normal';
      const fontStyle = obj.fontStyle || 'normal';
      const textAlign = obj.textAlign || 'left';
      const lineHeight = obj.lineHeight || 1.2;

      // Set font with enhanced properties
      ctx.font = `${fontStyle} ${fontWeight} ${scaledSize}px ${fontFamily}`;
      ctx.textAlign = textAlign;
      ctx.textBaseline = 'top';

      // Draw background if specified
      if (obj.bgColor && obj.bgColor !== '#ffffff') {
        const textMetrics = ctx.measureText(obj.text);
        const textWidth = textMetrics.width;
        const textHeight = scaledSize * lineHeight;

        ctx.fillStyle = obj.bgColor;
        ctx.fillRect(scaledX - 4, scaledY - 2, textWidth + 8, textHeight + 4);
      }

      // Apply text outline if enabled
      if (obj.textOutline) {
        ctx.strokeStyle = obj.color === '#ffffff' ? '#000000' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeText(obj.text, scaledX, scaledY);
      }

      // Apply text shadow if enabled or if on image
      if (obj.textShadow || editorState.heroImage) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = obj.textShadow ? 4 : 2;
        ctx.shadowOffsetX = obj.textShadow ? 2 : 1;
        ctx.shadowOffsetY = obj.textShadow ? 2 : 1;
      }

      // Draw the text
      ctx.fillStyle = obj.color || '#000000';

      // Handle multi-line text
      const lines = obj.text.split('\n');
      lines.forEach((line, index) => {
        const lineY = scaledY + (index * scaledSize * lineHeight);
        ctx.fillText(line, scaledX, lineY);
      });

      // Reset shadow and stroke
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    if (obj.type === 'logo' && obj.image) {
      const scaledW = obj.w * scaleX;
      const scaledH = obj.h * scaleY;
      ctx.drawImage(obj.image, scaledX, scaledY, scaledW, scaledH);
    }

    // Draw selection outline
    if (obj === editorState.selectedElement) {
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (obj.type === 'text') {
        const metrics = ctx.measureText(obj.text);
        const scaledSize = (obj.size || 24) * Math.min(scaleX, scaleY);
        ctx.strokeRect(scaledX - 2, scaledY - 2, metrics.width + 4, scaledSize + 4);
      } else if (obj.type === 'logo') {
        const scaledW = obj.w * scaleX;
        const scaledH = obj.h * scaleY;
        ctx.strokeRect(scaledX - 2, scaledY - 2, scaledW + 4, scaledH + 4);
      }

      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}

/**
 * Update the element list in the sidebar
 */
function updateElementList() {
  const elementList = document.getElementById('element-list');
  elementList.innerHTML = '';

  editorState.objects.forEach((obj, index) => {
    const item = document.createElement('div');
    item.className = `p-2 border border-[var(--border)] rounded cursor-pointer transition-colors ${obj === editorState.selectedElement ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'bg-[var(--background)] hover:bg-[var(--accent)]'
      }`;

    const icon = obj.type === 'text' ? 'fas fa-font' : 'fas fa-image';
    const name = obj.type === 'text' ? obj.text.substring(0, 20) : 'Logo';

    item.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="${icon}"></i>
          <span class="text-sm">${name}</span>
        </div>
        <button class="delete-element text-red-500 hover:text-red-700" data-index="${index}">
          <i class="fas fa-trash text-xs"></i>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (!e.target.closest('.delete-element')) {
        selectElement(obj);
      }
    });

    const deleteBtn = item.querySelector('.delete-element');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteElement(index);
    });

    elementList.appendChild(item);
  });
}

/**
 * Select an element for editing
 */
function selectElement(element) {
  editorState.selectedElement = element;
  renderEditor();
  updateElementList();
  showElementProperties(element);
}

/**
 * Show element properties in the sidebar
 */
function showElementProperties(element) {
  const propertiesPanel = document.getElementById('element-properties');
  const textProps = document.getElementById('text-properties');
  const logoProps = document.getElementById('logo-properties');

  propertiesPanel.classList.remove('hidden');

  // Update position inputs
  document.getElementById('prop-x').value = Math.round(element.x);
  document.getElementById('prop-y').value = Math.round(element.y);

  if (element.type === 'text') {
    textProps.classList.remove('hidden');
    logoProps.classList.add('hidden');

    document.getElementById('prop-text').value = element.text;
    document.getElementById('prop-size').value = element.size || 24;
    document.getElementById('prop-color').value = element.color || '#000000';
  } else if (element.type === 'logo') {
    textProps.classList.add('hidden');
    logoProps.classList.remove('hidden');

    document.getElementById('prop-width').value = Math.round(element.w);
    document.getElementById('prop-height').value = Math.round(element.h);
  }
}

/**
 * Delete an element
 */
function deleteElement(index) {
  editorState.objects.splice(index, 1);
  if (editorState.selectedElement === editorState.objects[index]) {
    editorState.selectedElement = null;
    document.getElementById('element-properties').classList.add('hidden');
  }
  renderEditor();
  updateElementList();
}

/**
 * Bind all editor events
 */
function bindEditorEvents() {
  // Canvas interaction
  setupCanvasInteraction();

  // Property inputs
  bindPropertyInputs();

  // Header buttons
  document.getElementById('editor-close').addEventListener('click', closeEditor);
  document.getElementById('editor-save').addEventListener('click', saveChanges);
  document.getElementById('editor-reset').addEventListener('click', resetChanges);

  // Add element buttons
  document.getElementById('add-text-editor').addEventListener('click', addTextElement);
  document.getElementById('add-logo-editor').addEventListener('click', addLogoElement);

  // Hero image controls
  bindHeroImageControls();

  // Enhanced text property inputs
  bindEnhancedTextProperties();
}

/**
 * Setup canvas interaction for the editor
 */
function setupCanvasInteraction() {
  const canvas = editorState.canvas;
  let startX, startY;
  let isDraggingHero = false;
  let heroStartX, heroStartY;

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / editorState.scale;
    const y = (e.clientY - rect.top) / editorState.scale;

    // Handle crop handle interaction in crop mode
    if (editorState.cropMode && editorState.cropHandles.length > 0) {
      const handle = getCropHandleAtPosition(x, y);
      if (handle) {
        editorState.dragHandle = handle;
        canvas.style.cursor = getCursorForHandle(handle.type);
        e.preventDefault();
        return;
      }
    }

    // Handle hero image interaction in crop mode
    if (editorState.cropMode && editorState.heroImage && isPointInHeroImage(x, y)) {
      isDraggingHero = true;
      heroStartX = x;
      heroStartY = y;
      canvas.style.cursor = 'move';
      e.preventDefault();
      return;
    }

    // Handle element interaction
    const element = getElementAtPosition(x, y);

    if (element) {
      selectElement(element);
      editorState.isDragging = true;
      startX = x - element.x * (canvas.width / editorState.master.width);
      startY = y - element.y * (canvas.height / editorState.master.height);
      canvas.style.cursor = 'grabbing';
    } else {
      editorState.selectedElement = null;
      document.getElementById('element-properties').classList.add('hidden');
      renderEditor();
      updateElementList();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / editorState.scale;
    const y = (e.clientY - rect.top) / editorState.scale;

    // Handle hero image dragging
    if (isDraggingHero && editorState.cropMode) {
      const deltaX = (x - heroStartX) / canvas.width;
      const deltaY = (y - heroStartY) / canvas.height;

      editorState.heroCrop.x += deltaX;
      editorState.heroCrop.y += deltaY;

      // Clamp values
      editorState.heroCrop.x = Math.max(-1, Math.min(1, editorState.heroCrop.x));
      editorState.heroCrop.y = Math.max(-1, Math.min(1, editorState.heroCrop.y));

      heroStartX = x;
      heroStartY = y;

      updateHeroSliders();
      renderEditor();
      return;
    }

    // Handle element dragging
    if (editorState.isDragging && editorState.selectedElement) {
      const scaleX = editorState.master.width / canvas.width;
      const scaleY = editorState.master.height / canvas.height;

      editorState.selectedElement.x = (x - startX) * scaleX;
      editorState.selectedElement.y = (y - startY) * scaleY;

      renderEditor();
      updateElementProperties();
    } else {
      // Update cursor based on what's under the mouse
      if (editorState.cropMode && editorState.heroImage && isPointInHeroImage(x, y)) {
        canvas.style.cursor = 'move';
      } else {
        const element = getElementAtPosition(x, y);
        canvas.style.cursor = element ? 'grab' : (editorState.cropMode ? 'crosshair' : 'default');
      }
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDraggingHero = false;
    editorState.isDragging = false;

    if (editorState.cropMode) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = editorState.selectedElement ? 'grab' : 'default';
    }
  });

  // Add mouse wheel for scaling in crop mode
  canvas.addEventListener('wheel', (e) => {
    if (!editorState.cropMode || !editorState.heroImage) return;

    e.preventDefault();

    const scaleDelta = e.deltaY > 0 ? -0.1 : 0.1;
    editorState.heroCrop.scale = Math.max(0.1, Math.min(3, editorState.heroCrop.scale + scaleDelta));

    updateHeroSliders();
    renderEditor();
  });
}

/**
 * Get element at mouse position in editor
 */
function getElementAtPosition(x, y) {
  const { canvas, master, objects } = editorState;
  const scaleX = canvas.width / master.width;
  const scaleY = canvas.height / master.height;

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const scaledX = obj.x * scaleX;
    const scaledY = obj.y * scaleY;

    if (obj.type === 'text') {
      const ctx = canvas.getContext('2d');
      const scaledSize = (obj.size || 24) * Math.min(scaleX, scaleY);
      ctx.font = `${scaledSize}px Arial, sans-serif`;
      const metrics = ctx.measureText(obj.text);

      if (x >= scaledX && x <= scaledX + metrics.width &&
        y >= scaledY && y <= scaledY + scaledSize) {
        return obj;
      }
    }

    if (obj.type === 'logo') {
      const scaledW = obj.w * scaleX;
      const scaledH = obj.h * scaleY;

      if (x >= scaledX && x <= scaledX + scaledW &&
        y >= scaledY && y <= scaledY + scaledH) {
        return obj;
      }
    }
  }

  return null;
}

/**
 * Bind property input events
 */
function bindPropertyInputs() {
  const inputs = ['prop-x', 'prop-y', 'prop-text', 'prop-size', 'prop-color', 'prop-width', 'prop-height'];

  inputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateElementFromProperties);
    }
  });
}

/**
 * Update element properties from input values
 */
function updateElementFromProperties() {
  const element = editorState.selectedElement;
  if (!element) return;

  element.x = parseFloat(document.getElementById('prop-x').value) || 0;
  element.y = parseFloat(document.getElementById('prop-y').value) || 0;

  if (element.type === 'text') {
    element.text = document.getElementById('prop-text').value || 'Text';
    element.size = parseFloat(document.getElementById('prop-size').value) || 24;
    element.color = document.getElementById('prop-color').value || '#000000';
  } else if (element.type === 'logo') {
    element.w = parseFloat(document.getElementById('prop-width').value) || 100;
    element.h = parseFloat(document.getElementById('prop-height').value) || 100;
  }

  renderEditor();
}

/**
 * Update property inputs from selected element
 */
function updateElementProperties() {
  const element = editorState.selectedElement;
  if (!element) return;

  document.getElementById('prop-x').value = Math.round(element.x);
  document.getElementById('prop-y').value = Math.round(element.y);
}

/**
 * Add a new text element
 */
function addTextElement() {
  const text = prompt('Enter text:');
  if (!text) return;

  const obj = {
    type: 'text',
    text,
    x: 50,
    y: 50,
    size: 24,
    color: '#000000',
    id: Math.random().toString(36).substr(2, 9)
  };

  editorState.objects.push(obj);
  selectElement(obj);
  renderEditor();
  updateElementList();
}

/**
 * Add a new logo element
 */
function addLogoElement() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      const obj = {
        type: 'logo',
        image: img,
        x: 50,
        y: 50,
        w: Math.min(img.width, 200),
        h: Math.min(img.height, 200),
        id: Math.random().toString(36).substr(2, 9)
      };

      editorState.objects.push(obj);
      selectElement(obj);
      renderEditor();
      updateElementList();
    } catch (error) {
      showNotification('Error loading image: ' + error.message, 'error');
    }
  };
  input.click();
}

/**
 * Save changes and close editor
 */
function saveChanges() {
  if (editorState.onSave) {
    // Create updated master state with custom objects and hero settings
    const updatedMaster = {
      ...editorState.master,
      objects: editorState.objects,
      hero: editorState.heroImage,
      heroSettings: {
        crop: { ...editorState.heroCrop },
        mode: editorState.heroCrop.mode || 'cover'
      }
    };
    
    editorState.onSave(editorState.objects, updatedMaster);
  }
  closeEditor();
}

/**
 * Reset changes to original state
 */
function resetChanges() {
  if (confirm('Are you sure you want to reset all changes?')) {
    editorState.objects = cloneObjects(editorState.master.objects);
    editorState.heroCrop = {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      scale: 1
    };
    editorState.selectedElement = null;
    document.getElementById('element-properties').classList.add('hidden');
    
    updateHeroSliders();
    renderEditor();
    updateElementList();
    showNotification('Changes reset successfully', 'success');
  }
}

/**
 * Bind hero image control events
 */
function bindHeroImageControls() {
  const cropModeBtn = document.getElementById('crop-mode-btn');
  const heroProperties = document.getElementById('hero-properties');
  const heroXSlider = document.getElementById('hero-x');
  const heroYSlider = document.getElementById('hero-y');
  const heroScaleSlider = document.getElementById('hero-scale');
  const heroXValue = document.getElementById('hero-x-value');
  const heroYValue = document.getElementById('hero-y-value');
  const heroScaleValue = document.getElementById('hero-scale-value');
  const heroFitBtn = document.getElementById('hero-fit');
  const heroFillBtn = document.getElementById('hero-fill');
  const heroResetBtn = document.getElementById('hero-reset');

  // Toggle crop mode
  if (cropModeBtn) {
    cropModeBtn.addEventListener('click', () => {
      editorState.cropMode = !editorState.cropMode;
      heroProperties.classList.toggle('hidden', !editorState.cropMode);

      if (editorState.cropMode) {
        cropModeBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Exit Crop Mode';
        cropModeBtn.classList.add('primary');
      } else {
        cropModeBtn.innerHTML = '<i class="fas fa-crop mr-2"></i>Crop & Position';
        cropModeBtn.classList.remove('primary');
      }

      renderEditor();
    });
  }

  // Position X slider
  if (heroXSlider) {
    heroXSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      editorState.heroCrop.x = value / 100;
      if (heroXValue) heroXValue.textContent = `${value}%`;
      renderEditor();
    });
  }

  // Position Y slider
  if (heroYSlider) {
    heroYSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      editorState.heroCrop.y = value / 100;
      if (heroYValue) heroYValue.textContent = `${value}%`;
      renderEditor();
    });
  }

  // Scale slider
  if (heroScaleSlider) {
    heroScaleSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      editorState.heroCrop.scale = value / 100;
      if (heroScaleValue) heroScaleValue.textContent = `${value}%`;
      renderEditor();
    });
  }

  // Fit, Fill, Reset buttons
  if (heroFitBtn) {
    heroFitBtn.addEventListener('click', () => {
      if (!editorState.heroImage) return;
      editorState.heroCrop = { x: 0, y: 0, width: 1, height: 1, scale: 1, mode: 'fit' };
      updateHeroSliders();
      renderEditor();
      showNotification('Hero image fitted to canvas', 'success');
    });
  }

  if (heroFillBtn) {
    heroFillBtn.addEventListener('click', () => {
      if (!editorState.heroImage) return;
      editorState.heroCrop = { x: 0, y: 0, width: 1, height: 1, scale: 1.5, mode: 'fill' };
      updateHeroSliders();
      renderEditor();
      showNotification('Hero image scaled to fill canvas', 'success');
    });
  }

  if (heroResetBtn) {
    heroResetBtn.addEventListener('click', () => {
      editorState.heroCrop = { x: 0, y: 0, width: 1, height: 1, scale: 1, mode: 'cover' };
      updateHeroSliders();
      renderEditor();
      showNotification('Hero image reset to original state', 'success');
    });
  }
}

/**
 * Update hero image slider values
 */
function updateHeroSliders() {
  const heroXSlider = document.getElementById('hero-x');
  const heroYSlider = document.getElementById('hero-y');
  const heroScaleSlider = document.getElementById('hero-scale');
  const heroXValue = document.getElementById('hero-x-value');
  const heroYValue = document.getElementById('hero-y-value');
  const heroScaleValue = document.getElementById('hero-scale-value');

  if (heroXSlider) {
    const xValue = Math.round(editorState.heroCrop.x * 100);
    heroXSlider.value = xValue;
    if (heroXValue) heroXValue.textContent = `${xValue}%`;
  }

  if (heroYSlider) {
    const yValue = Math.round(editorState.heroCrop.y * 100);
    heroYSlider.value = yValue;
    if (heroYValue) heroYValue.textContent = `${yValue}%`;
  }

  if (heroScaleSlider) {
    const scaleValue = Math.round(editorState.heroCrop.scale * 100);
    heroScaleSlider.value = scaleValue;
    if (heroScaleValue) heroScaleValue.textContent = `${scaleValue}%`;
  }
}

/**
 * Enhanced canvas interaction for hero image manipulation
 */
function setupHeroImageInteraction() {
  const canvas = editorState.canvas;
  let isDraggingHero = false;
  let heroStartX, heroStartY;

  canvas.addEventListener('mousedown', (e) => {
    if (!editorState.cropMode) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / editorState.scale;
    const y = (e.clientY - rect.top) / editorState.scale;

    // Check if clicking on hero image area
    if (editorState.heroImage && isPointInHeroImage(x, y)) {
      isDraggingHero = true;
      heroStartX = x;
      heroStartY = y;
      canvas.style.cursor = 'move';
      e.preventDefault();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!editorState.cropMode || !isDraggingHero) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / editorState.scale;
    const y = (e.clientY - rect.top) / editorState.scale;

    const deltaX = (x - heroStartX) / canvas.width;
    const deltaY = (y - heroStartY) / canvas.height;

    editorState.heroCrop.x += deltaX;
    editorState.heroCrop.y += deltaY;

    // Clamp values
    editorState.heroCrop.x = Math.max(-1, Math.min(1, editorState.heroCrop.x));
    editorState.heroCrop.y = Math.max(-1, Math.min(1, editorState.heroCrop.y));

    heroStartX = x;
    heroStartY = y;

    updateHeroSliders();
    renderEditor();
  });

  canvas.addEventListener('mouseup', () => {
    isDraggingHero = false;
    canvas.style.cursor = editorState.cropMode ? 'crosshair' : 'default';
  });
}

/**
 * Check if a point is within the hero image bounds
 */
function isPointInHeroImage(x, y) {
  if (!editorState.heroImage) return false;

  const canvas = editorState.canvas;
  const { heroCrop } = editorState;

  const destWidth = canvas.width * heroCrop.scale;
  const destHeight = canvas.height * heroCrop.scale;
  const destX = (canvas.width - destWidth) / 2 + (heroCrop.x * canvas.width * 0.5);
  const destY = (canvas.height - destHeight) / 2 + (heroCrop.y * canvas.height * 0.5);

  return x >= destX && x <= destX + destWidth && y >= destY && y <= destY + destHeight;
}

/**
 * Get crop handle at mouse position
 */
function getCropHandleAtPosition(x, y) {
  const handleSize = 12;
  for (const handle of editorState.cropHandles) {
    if (x >= handle.x - handleSize / 2 && x <= handle.x + handleSize / 2 &&
      y >= handle.y - handleSize / 2 && y <= handle.y + handleSize / 2) {
      return handle;
    }
  }
  return null;
}

/**
 * Get cursor style for crop handle type
 */
function getCursorForHandle(type) {
  const cursors = {
    'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize',
    'n': 'n-resize', 's': 's-resize', 'w': 'w-resize', 'e': 'e-resize'
  };
  return cursors[type] || 'default';
}

/**
 * Bind enhanced text property inputs
 */
function bindEnhancedTextProperties() {
  const enhancedInputs = [
    'prop-line-height', 'prop-font-family', 'prop-font-weight',
    'prop-font-style', 'prop-text-align', 'prop-bg-color',
    'prop-text-shadow', 'prop-text-outline'
  ];

  enhancedInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateEnhancedTextProperties);
      input.addEventListener('change', updateEnhancedTextProperties);
    }
  });
}

/**
 * Update enhanced text properties
 */
function updateEnhancedTextProperties() {
  const element = editorState.selectedElement;
  if (!element || element.type !== 'text') return;

  // Get enhanced text properties
  const lineHeight = parseFloat(document.getElementById('prop-line-height').value) || 1.2;
  const fontFamily = document.getElementById('prop-font-family').value || 'Arial';
  const fontWeight = document.getElementById('prop-font-weight').value || 'normal';
  const fontStyle = document.getElementById('prop-font-style').value || 'normal';
  const textAlign = document.getElementById('prop-text-align').value || 'left';
  const bgColor = document.getElementById('prop-bg-color').value || '#ffffff';
  const textShadow = document.getElementById('prop-text-shadow').checked;
  const textOutline = document.getElementById('prop-text-outline').checked;

  // Update element properties
  element.lineHeight = lineHeight;
  element.fontFamily = fontFamily;
  element.fontWeight = fontWeight;
  element.fontStyle = fontStyle;
  element.textAlign = textAlign;
  element.bgColor = bgColor;
  element.textShadow = textShadow;
  element.textOutline = textOutline;

  renderEditor();
}

/**
 * Close the editor
 */
function closeEditor() {
  if (currentEditor) {
    currentEditor.remove();
    currentEditor = null;
  }
}mg.height, 200),
        id: Math.random().toString(36).substr(2, 9)
      };

      editorState.objects.push(obj);
      selectElement(obj);
      renderEditor();
      updateElementList();
    } catch (error) {
      showNotification('Error loading image: ' + error.message, 'error');
    }
  };
  input.click();
}

/**
 * Save changes and close editor
 */
function saveChanges() {
  if (editorState.onSave) {
    editorState.onSave(editorState.objects);
  }
  showNotification('Layout changes saved successfully', 'success');
  closeEditor();
}

/**
 * Reset changes to original state
 */
function resetChanges() {
  if (confirm('Are you sure you want to reset all changes?')) {
    editorState.objects = cloneObjects(editorState.master.objects);
    editorState.selectedElement = null;
    document.getElementById('element-properties').classList.add('hidden');
    renderEditor();
    updateElementList();
    showNotification('Layout reset to original state', 'info');
  }
}

/**
 * Bind hero image control events
 */
function bindHeroImageControls() {
  const cropModeBtn = document.getElementById('crop-mode-btn');
  const heroProperties = document.getElementById('hero-properties');
  const heroXSlider = document.getElementById('hero-x');
  const heroYSlider = document.getElementById('hero-y');
  const heroScaleSlider = document.getElementById('hero-scale');
  const heroXValue = document.getElementById('hero-x-value');
  const heroYValue = document.getElementById('hero-y-value');
  const heroScaleValue = document.getElementById('hero-scale-value');
  const heroFitBtn = document.getElementById('hero-fit');
  const heroFillBtn = document.getElementById('hero-fill');
  const heroResetBtn = document.getElementById('hero-reset');

  // Toggle crop mode
  if (cropModeBtn) {
    cropModeBtn.addEventListener('click', () => {
      editorState.cropMode = !editorState.cropMode;
      heroProperties.classList.toggle('hidden', !editorState.cropMode);

      if (editorState.cropMode) {
        cropModeBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Exit Crop Mode';
        cropModeBtn.classList.add('primary');
      } else {
        cropModeBtn.innerHTML = '<i class="fas fa-crop mr-2"></i>Crop & Position';
        cropModeBtn.classList.remove('primary');
      }

      renderEditor();
    });
  }

  // Position X slider
  if (heroXSlider) {
    heroXSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      editorState.heroCrop.x = value / 100;
      heroXValue.textContent = `${value}%`;
      renderEditor();
    });
  }

  // Position Y slider
  if (heroYSlider) {
    heroYSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      editorState.heroCrop.y = value / 100;
      heroYValue.textContent = `${value}%`;
      renderEditor();
    });
  }

  // Scale slider
  if (heroScaleSlider) {
    heroScaleSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      editorState.heroCrop.scale = value / 100;
      heroScaleValue.textContent = `${value}%`;
      renderEditor();
    });
  }

  // Fit button - scale image to fit within canvas
  if (heroFitBtn) {
    heroFitBtn.addEventListener('click', () => {
      if (!editorState.heroImage) return;

      const canvas = editorState.canvas;
      const img = editorState.heroImage;

      const canvasRatio = canvas.width / canvas.height;
      const imageRatio = img.width / img.height;

      if (imageRatio > canvasRatio) {
        // Image is wider - fit to width
        editorState.heroCrop.scale = 1;
      } else {
        // Image is taller - fit to height
        editorState.heroCrop.scale = 1;
      }

      editorState.heroCrop.x = 0;
      editorState.heroCrop.y = 0;

      updateHeroSliders();
      renderEditor();
      showNotification('Hero image fitted to canvas', 'success');
    });
  }

  // Fill button - scale image to fill entire canvas
  if (heroFillBtn) {
    heroFillBtn.addEventListener('click', () => {
      if (!editorState.heroImage) return;

      const canvas = editorState.canvas;
      const img = editorState.heroImage;

      const canvasRatio = canvas.width / canvas.height;
      const imageRatio = img.width / img.height;

      if (imageRatio > canvasRatio) {
        // Image is wider - scale to fill height
        editorState.heroCrop.scale = canvas.height / img.height;
      } else {
        // Image is taller - scale to fill width
        editorState.heroCrop.scale = canvas.width / img.width;
      }

      editorState.heroCrop.x = 0;
      editorState.heroCrop.y = 0;

      updateHeroSliders();
      renderEditor();
      showNotification('Hero image scaled to fill canvas', 'success');
    });
  }

  // Reset button - reset all hero image transformations
  if (heroResetBtn) {
    heroResetBtn.addEventListener('click', () => {
      editorState.heroCrop = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        scale: 1
      };

      updateHeroSliders();
      renderEditor();
      showNotification('Hero image reset to original state', 'success');
    });
  }
}

/**
 * Update hero image slider values
 */
function updateHeroSliders() {
  const heroXSlider = document.getElementById('hero-x');
  const heroYSlider = document.getElementById('hero-y');
  const heroScaleSlider = document.getElementById('hero-scale');
  const heroXValue = document.getElementById('hero-x-value');
  const heroYValue = document.getElementById('hero-y-value');
  const heroScaleValue = document.getElementById('hero-scale-value');

  if (heroXSlider) {
    const xValue = Math.round(editorState.heroCrop.x * 100);
    heroXSlider.value = xValue;
    heroXValue.textContent = `${xValue}%`;
  }

  if (heroYSlider) {
    const yValue = Math.round(editorState.heroCrop.y * 100);
    heroYSlider.value = yValue;
    heroYValue.textContent = `${yValue}%`;
  }

  if (heroScaleSlider) {
    const scaleValue = Math.round(editorState.heroCrop.scale * 100);
    heroScaleSlider.value = scaleValue;
    heroScaleValue.textContent = `${scaleValue}%`;
  }
}

/**
 * Enhanced canvas interaction for hero image manipulation
 */
function setupHeroImageInteraction() {
  const canvas = editorState.canvas;
  let isDraggingHero = false;
  let heroStartX, heroStartY;

  canvas.addEventListener('mousedown', (e) => {
    if (!editorState.cropMode) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / editorState.scale;
    const y = (e.clientY - rect.top) / editorState.scale;

    // Check if clicking on hero image area
    if (editorState.heroImage && isPointInHeroImage(x, y)) {
      isDraggingHero = true;
      heroStartX = x;
      heroStartY = y;
      canvas.style.cursor = 'move';
      e.preventDefault();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!editorState.cropMode || !isDraggingHero) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / editorState.scale;
    const y = (e.clientY - rect.top) / editorState.scale;

    const deltaX = (x - heroStartX) / canvas.width;
    const deltaY = (y - heroStartY) / canvas.height;

    editorState.heroCrop.x += deltaX;
    editorState.heroCrop.y += deltaY;

    // Clamp values
    editorState.heroCrop.x = Math.max(-1, Math.min(1, editorState.heroCrop.x));
    editorState.heroCrop.y = Math.max(-1, Math.min(1, editorState.heroCrop.y));

    heroStartX = x;
    heroStartY = y;

    updateHeroSliders();
    renderEditor();
  });

  canvas.addEventListener('mouseup', () => {
    isDraggingHero = false;
    canvas.style.cursor = editorState.cropMode ? 'crosshair' : 'default';
  });

  // Add mouse wheel for scaling in crop mode
  canvas.addEventListener('wheel', (e) => {
    if (!editorState.cropMode || !editorState.heroImage) return;

    e.preventDefault();

    const scaleDelta = e.deltaY > 0 ? -0.1 : 0.1;
    editorState.heroCrop.scale = Math.max(0.1, Math.min(3, editorState.heroCrop.scale + scaleDelta));

    updateHeroSliders();
    renderEditor();
  });
}

/**
 * Check if a point is within the hero image bounds
 */
function isPointInHeroImage(x, y) {
  if (!editorState.heroImage) return false;

  const canvas = editorState.canvas;
  const { heroCrop } = editorState;

  const destWidth = canvas.width * heroCrop.scale;
  const destHeight = canvas.height * heroCrop.scale;
  const destX = (canvas.width - destWidth) / 2 + (heroCrop.x * canvas.width * 0.5);
  const destY = (canvas.height - destHeight) / 2 + (heroCrop.y * canvas.height * 0.5);

  return x >= destX && x <= destX + destWidth && y >= destY && y <= destY + destHeight;
}

/**
 * Get crop handle at mouse position
 */
function getCropHandleAtPosition(x, y) {
  const handleSize = 12;
  for (const handle of editorState.cropHandles) {
    if (x >= handle.x - handleSize / 2 && x <= handle.x + handleSize / 2 &&
      y >= handle.y - handleSize / 2 && y <= handle.y + handleSize / 2) {
      return handle;
    }
  }
  return null;
}

/**
 * Get cursor style for crop handle type
 */
function getCursorForHandle(type) {
  const cursors = {
    'nw': 'nw-resize',
    'ne': 'ne-resize',
    'sw': 'sw-resize',
    'se': 'se-resize',
    'n': 'n-resize',
    's': 's-resize',
    'w': 'w-resize',
    'e': 'e-resize'
  };
  return cursors[type] || 'default';
}



/**
 * Bind enhanced text property inputs
 */
function bindEnhancedTextProperties() {
  const enhancedInputs = [
    'prop-line-height', 'prop-font-family', 'prop-font-weight',
    'prop-font-style', 'prop-text-align', 'prop-bg-color',
    'prop-text-shadow', 'prop-text-outline'
  ];

  enhancedInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateEnhancedTextProperties);
      input.addEventListener('change', updateEnhancedTextProperties);
    }
  });
}

/**
 * Update enhanced text properties
 */
function updateEnhancedTextProperties() {
  const element = editorState.selectedElement;
  if (!element || element.type !== 'text') return;

  // Get enhanced text properties
  const lineHeight = parseFloat(document.getElementById('prop-line-height').value) || 1.2;
  const fontFamily = document.getElementById('prop-font-family').value || 'Arial';
  const fontWeight = document.getElementById('prop-font-weight').value || 'normal';
  const fontStyle = document.getElementById('prop-font-style').value || 'normal';
  const textAlign = document.getElementById('prop-text-align').value || 'left';
  const bgColor = document.getElementById('prop-bg-color').value || '#ffffff';
  const textShadow = document.getElementById('prop-text-shadow').checked;
  const textOutline = document.getElementById('prop-text-outline').checked;

  // Update element properties
  element.lineHeight = lineHeight;
  element.fontFamily = fontFamily;
  element.fontWeight = fontWeight;
  element.fontStyle = fontStyle;
  element.textAlign = textAlign;
  element.bgColor = bgColor;
  element.textShadow = textShadow;
  element.textOutline = textOutline;

  renderEditor();
}

// Corrupted code sections removed to fix syntax errors

/**
 * Save changes and close editor
 */
function saveChanges() {
  if (editorState.onSave) {
    // Create updated master state with custom objects and hero settings
    const updatedMaster = {
      ...editorState.master,
      objects: editorState.objects,
      hero: editorState.heroImage,
      heroSettings: {
        crop: { ...editorState.heroCrop },
        mode: editorState.heroCrop.mode || 'cover'
      }
    };

    editorState.onSave(editorState.objects, updatedMaster);
  }
  closeEditor();
}

/**
 * Reset changes to original state
 */
function resetChanges() {
  if (confirm('Are you sure you want to reset all changes?')) {
    editorState.objects = cloneObjects(editorState.master.objects);
    editorState.heroCrop = {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      scale: 1
    };
    editorState.selectedElement = null;
    document.getElementById('element-properties').classList.add('hidden');

    updateHeroSliders();
    renderEditor();
    updateElementList();
    showNotification('Changes reset successfully', 'success');
  }
}

/**
 * Close the editor
 */
function closeEditor() {
  if (currentEditor) {
    currentEditor.remove();
    currentEditor = null;
  }
}