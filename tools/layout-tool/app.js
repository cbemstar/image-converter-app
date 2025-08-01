import { showNotification } from '../../utils.js';
import { getPresets } from './modules/preset-manager.js';
import { initSidebar } from './modules/ui-sidebar.js';
import { initTopbar } from './modules/ui-topbar.js';
import { commandStack } from './modules/command-stack.js';
import { setMode } from './modules/colour-manager.js';
import { createArtboard, createThumbnail } from './modules/canvas-engine.js';
import { exportZip } from './modules/export-raster.js';
import { showDialog } from './modules/ui-dialog.js';
import { openLayoutEditor } from './modules/layout-editor.js';

// Global state
let presets = [];
let dpi = 72;
let currentArtboards = [];
let currentChannel = 'all';
let selectedElement = null;
let isDragging = false;

// DOM elements - will be initialized in init()
let masterCanvas, masterCtx, artboardContainer;

// Master document state - will be initialized in init()
let master;

/**
 * Render the master canvas with all elements
 */
function renderMaster() {
  masterCtx.clearRect(0, 0, masterCanvas.width, masterCanvas.height);
  
  // Draw background
  masterCtx.fillStyle = '#ffffff';
  masterCtx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);
  
  // Draw hero imagea
  if (master.hero) {
    masterCtx.drawImage(master.hero, 0, 0, masterCanvas.width, masterCanvas.height);
  }
  
  // Draw all objects
  for (const obj of master.objects) {
    masterCtx.save();
    
    if (obj.type === 'text') {
      masterCtx.fillStyle = obj.color || '#000000';
      masterCtx.font = `${obj.size || 24}px Arial, sans-serif`;
      masterCtx.textBaseline = 'top';
      masterCtx.fillText(obj.text, obj.x, obj.y);
    }
    
    if (obj.type === 'logo' && obj.image) {
      masterCtx.drawImage(obj.image, obj.x, obj.y, obj.w, obj.h);
    }
    
    // Draw selection outline if selected
    if (obj === selectedElement) {
      masterCtx.strokeStyle = '#007bff';
      masterCtx.lineWidth = 2;
      masterCtx.setLineDash([5, 5]);
      
      if (obj.type === 'text') {
        const metrics = masterCtx.measureText(obj.text);
        masterCtx.strokeRect(obj.x - 2, obj.y - 2, metrics.width + 4, (obj.size || 24) + 4);
      } else if (obj.type === 'logo') {
        masterCtx.strokeRect(obj.x - 2, obj.y - 2, obj.w + 4, obj.h + 4);
      }
      
      masterCtx.setLineDash([]);
    }
    
    masterCtx.restore();
  }
}

/**
 * Create and display artboards for selected presets
 */
function generateArtboards(selectedNames) {
  artboardContainer.innerHTML = '';
  currentArtboards = [];
  
  if (selectedNames.length === 0) {
    showDialog('Please select at least one preset');
    return;
  }
  
  selectedNames.forEach(name => {
    const preset = presets.find(p => p.name === name);
    if (!preset) return;

    // Filter by channel if not 'all'
    if (currentChannel !== 'all' && preset.channel !== currentChannel) {
      return;
    }

    // Check for existing custom state for this artboard
    let customObjects = null;
    let heroSettings = null;
    let customHero = null;
    let customArtboard = currentArtboards.find(ab => ab.preset.name === name);
    if (customArtboard) {
      if (customArtboard.customObjects) customObjects = customArtboard.customObjects;
      if (customArtboard.heroSettings) heroSettings = customArtboard.heroSettings;
      if (customArtboard.customHero) customHero = customArtboard.customHero;
    }

    // Create artboard canvas using custom objects, heroSettings, and customHero if present
    const artboardMaster = { ...master };
    if (customObjects) artboardMaster.objects = customObjects;
    if (heroSettings) artboardMaster.heroSettings = heroSettings;
    if (customHero) artboardMaster.hero = customHero;
    const artboardCanvas = createArtboard(preset, artboardMaster, dpi / 72);
    currentArtboards.push({ canvas: artboardCanvas, preset, customObjects, heroSettings, customHero });

    // Create thumbnail for display
    const thumbnailCanvas = createThumbnail(artboardCanvas, 300);

    // Create artboard container
    const artboardItem = document.createElement('div');
    artboardItem.className = 'artboard-item';

    // Get actual dimensions
    const actualWidth = preset.width || Math.round(preset.width_mm * 11.811);
    const actualHeight = preset.height || Math.round(preset.height_mm * 11.811);

    artboardItem.innerHTML = `
      <div class="artboard-title">${preset.name}</div>
      <div class="artboard-dimensions">${actualWidth} × ${actualHeight}px</div>
      <div class="artboard-info">
        <span class="text-xs text-[var(--muted-foreground)]">${preset.channel} • ${preset.category}</span>
      </div>
    `;

    // Add thumbnail canvas
    thumbnailCanvas.className = 'artboard-canvas';
    artboardItem.insertBefore(thumbnailCanvas, artboardItem.firstChild);

    // Add action buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'flex gap-2 mt-2';

    // Add edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'layout-btn text-xs flex-1';
    editBtn.innerHTML = '<i class="fas fa-edit mr-1"></i>Edit';
    editBtn.addEventListener('click', () => {
      // Find the current artboard data
      const artboardData = currentArtboards.find(ab => ab.preset.name === preset.name);
      if (artboardData) {
        openLayoutEditor(
          artboardData.canvas,
          preset,
          {
            ...master,
            objects: artboardData.customObjects || master.objects,
            heroSettings: artboardData.heroSettings,
            hero: artboardData.customHero || master.hero
          },
          (updatedObjects, updatedHeroSettings, updatedHero) => {
            // Create a custom master state for this artboard with updated objects, heroSettings, and hero
            const customMaster = {
              ...master,
              objects: updatedObjects,
              heroSettings: updatedHeroSettings,
              hero: updatedHero || master.hero
            };

            // Regenerate this specific artboard with custom objects, heroSettings, and hero
            const newArtboardCanvas = createArtboard(preset, customMaster, dpi / 72);
            artboardData.canvas = newArtboardCanvas;

            // Store the custom objects, heroSettings, and hero for this artboard
            artboardData.customObjects = updatedObjects;
            artboardData.heroSettings = updatedHeroSettings;
            artboardData.customHero = updatedHero || master.hero;

            // Update the thumbnail display
            const newThumbnail = createThumbnail(newArtboardCanvas, 300);
            newThumbnail.className = 'artboard-canvas';

            // Replace the old thumbnail
            const oldThumbnail = artboardItem.querySelector('.artboard-canvas');
            artboardItem.replaceChild(newThumbnail, oldThumbnail);

            showNotification(`Layout "${preset.name}" updated successfully`, 'success');
          }
        );
      }
    });

    // Add download button for individual artboard
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'layout-btn text-xs flex-1';
    downloadBtn.innerHTML = '<i class="fas fa-download mr-1"></i>Download';
    downloadBtn.addEventListener('click', async () => {
      try {
        const { exportSingle } = await import('./modules/export-raster.js');
        const artboardData = currentArtboards.find(ab => ab.preset.name === preset.name);
        const blob = await exportSingle(artboardData.canvas, preset, dpi);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${preset.name.replace(/[^a-zA-Z0-9]/g, '_')}_${actualWidth}x${actualHeight}_${dpi}dpi.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        showDialog('Download failed: ' + error.message, 'error');
      }
    });

    buttonsContainer.appendChild(editBtn);
    buttonsContainer.appendChild(downloadBtn);
    artboardItem.appendChild(buttonsContainer);
    artboardContainer.appendChild(artboardItem);
  });
  
  if (currentArtboards.length === 0) {
    artboardContainer.innerHTML = '<div class="text-center text-[var(--muted-foreground)] py-8">No artboards match the current channel filter</div>';
  } else {
    showNotification(`Generated ${currentArtboards.length} layout${currentArtboards.length !== 1 ? 's' : ''} successfully`, 'success');
  }
}

/**
 * Get element at mouse position
 */
function getElementAtPosition(x, y) {
  // Check in reverse order (top to bottom)
  for (let i = master.objects.length - 1; i >= 0; i--) {
    const obj = master.objects[i];
    
    if (obj.type === 'text') {
      masterCtx.font = `${obj.size || 24}px Arial, sans-serif`;
      const metrics = masterCtx.measureText(obj.text);
      if (x >= obj.x && x <= obj.x + metrics.width && 
          y >= obj.y && y <= obj.y + (obj.size || 24)) {
        return obj;
      }
    }
    
    if (obj.type === 'logo') {
      if (x >= obj.x && x <= obj.x + obj.w && 
          y >= obj.y && y <= obj.y + obj.h) {
        return obj;
      }
    }
  }
  
  return null;
}

/**
 * Setup canvas interaction
 */
function setupCanvasInteraction() {
  let startX, startY;
  
  masterCanvas.addEventListener('mousedown', (e) => {
    const rect = masterCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    selectedElement = getElementAtPosition(x, y);
    
    if (selectedElement) {
      isDragging = true;
      startX = x - selectedElement.x;
      startY = y - selectedElement.y;
      masterCanvas.style.cursor = 'grabbing';
    } else {
      selectedElement = null;
    }
    
    renderMaster();
  });
  
  // Debounced and rAF-optimized rendering for performance
  let renderPending = false;
  let lastPresets = null;
  function scheduleRender(presetsToRender) {
    if (!renderPending) {
      renderPending = true;
      requestAnimationFrame(() => {
        renderMaster();
        if (presetsToRender && currentArtboards.length > 0) {
          generateArtboards(presetsToRender);
        }
        renderPending = false;
      });
    }
    lastPresets = presetsToRender;
  }

  masterCanvas.addEventListener('mousemove', (e) => {
    const rect = masterCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && selectedElement) {
      selectedElement.x = x - startX;
      selectedElement.y = y - startY;
      // Debounced render
      const selectedPresets = currentArtboards.map(ab => ab.preset.name);
      scheduleRender(selectedPresets);
    } else {
      // Update cursor based on hover
      const element = getElementAtPosition(x, y);
      masterCanvas.style.cursor = element ? 'grab' : 'default';
    }
  });
  
  masterCanvas.addEventListener('mouseup', () => {
    if (isDragging && selectedElement) {
      // Add to command stack for undo/redo
      const element = selectedElement;
      const oldX = element.x;
      const oldY = element.y;
      
      commandStack.push({
        undo: () => {
          element.x = oldX;
          element.y = oldY;
          renderMaster();
        },
        redo: () => {
          element.x = element.x;
          element.y = element.y;
          renderMaster();
        }
      });
    }
    
    isDragging = false;
    masterCanvas.style.cursor = selectedElement ? 'grab' : 'default';
  });
}

/**
 * Update loading progress
 */
function updateLoadingProgress(percentage, status, detail) {
  const progressBar = document.getElementById('loading-progress');
  const statusText = document.getElementById('loading-status');
  const detailText = document.getElementById('loading-detail');
  
  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (statusText) statusText.textContent = status;
  if (detailText) detailText.textContent = detail;
}

/**
 * Hide loading overlay and show tool interface
 */
function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById('loading-overlay');
  const toolInterface = document.getElementById('tool-interface');
  
  if (loadingOverlay && toolInterface) {
    // Fade out loading overlay
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.transition = 'opacity 0.5s ease-out';
    
    // Fade in tool interface
    toolInterface.style.opacity = '1';
    
    // Remove loading overlay after animation
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
    }, 500);
  }
}

/**
 * Initialize the application with loading progress
 */
async function init() {
  try {
    console.log('Starting layout tool initialization...');
    updateLoadingProgress(10, 'Initializing...', 'Setting up DOM elements');
    
    // Initialize DOM elements
    masterCanvas = document.getElementById('master-canvas');
    artboardContainer = document.getElementById('artboards');
    
    if (!masterCanvas) {
      throw new Error('Master canvas not found');
    }
    
    if (!artboardContainer) {
      throw new Error('Artboards container not found');
    }
    
    masterCtx = masterCanvas.getContext('2d');
    
    // Initialize master document state
    master = {
      hero: null,
      objects: [],
      width: masterCanvas.width,
      height: masterCanvas.height
    };
    
    console.log('DOM elements initialized successfully');
    updateLoadingProgress(25, 'Loading presets...', 'Fetching layout presets');
    
    // Add small delay to show progress
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('Loading presets...');
    presets = await getPresets();
    console.log(`Loaded ${presets.length} presets successfully`);
    
    updateLoadingProgress(50, 'Setting up interface...', 'Initializing sidebar');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Initializing sidebar...');
    initSidebar(document.getElementById('tool-sidebar'), {
      presets,
      onUpload: async (file) => {
        try {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          await img.decode();
          
          const oldHero = master.hero;
          master.hero = img;
          
          commandStack.push({
            undo: () => {
              master.hero = oldHero;
              renderMaster();
            },
            redo: () => {
              master.hero = img;
              renderMaster();
            }
          });
          
          renderMaster();
          showNotification('Hero image uploaded successfully', 'success');
        } catch (error) {
          showNotification('Error loading image: ' + error.message, 'error');
        }
      },
      onAddText: (text) => {
        const obj = { 
          type: 'text', 
          text, 
          x: 50, 
          y: 50, 
          size: 24, 
          color: '#000000' 
        };
        
        master.objects.push(obj);
        
        commandStack.push({
          undo: () => {
            const index = master.objects.indexOf(obj);
            if (index > -1) master.objects.splice(index, 1);
            renderMaster();
          },
          redo: () => {
            master.objects.push(obj);
            renderMaster();
          }
        });
        
        renderMaster();
        showNotification('Text element added successfully', 'success');
      },
      onAddLogo: async (file) => {
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
            h: Math.min(img.height, 200) 
          };
          
          master.objects.push(obj);
          
          commandStack.push({
            undo: () => {
              const index = master.objects.indexOf(obj);
              if (index > -1) master.objects.splice(index, 1);
              renderMaster();
            },
            redo: () => {
              master.objects.push(obj);
              renderMaster();
            }
          });
          
          renderMaster();
          showNotification('Logo added successfully', 'success');
        } catch (error) {
          showNotification('Error loading logo: ' + error.message, 'error');
        }
      },
      onGenerate: generateArtboards
    });

    updateLoadingProgress(75, 'Setting up controls...', 'Initializing topbar');
    await new Promise(resolve => setTimeout(resolve, 100));

    initTopbar(document.getElementById('topbar'), {
      onUndo: () => {
        commandStack.undo();
        renderMaster();
      },
      onRedo: () => {
        commandStack.redo();
        renderMaster();
      },
      onChannel: (channel) => {
        currentChannel = channel;
        // Regenerate artboards with new filter
        if (currentArtboards.length > 0) {
          const selectedPresets = currentArtboards.map(ab => ab.preset.name);
          generateArtboards(selectedPresets);
        }
      },
      onColour: (mode) => {
        setMode(mode);
        renderMaster();
      },
      onDpi: (newDpi) => {
        dpi = newDpi;
      },
      onExport: async () => {
        if (currentArtboards.length === 0) {
          showDialog('No artboards to export. Please generate layouts first.');
          return;
        }
        
        try {
          const zipBlob = await exportZip(currentArtboards, dpi, true);
          
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `layout-export-${Date.now()}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          showNotification(`Successfully exported ${currentArtboards.length} layout${currentArtboards.length !== 1 ? 's' : ''} as ZIP`, 'success');
        } catch (error) {
          showNotification('Export failed: ' + error.message, 'error');
        }
      }
    });
    
    updateLoadingProgress(90, 'Finalizing...', 'Setting up canvas interaction');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setupCanvasInteraction();
    renderMaster();
    
    updateLoadingProgress(100, 'Ready!', 'Layout tool loaded successfully');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Hide loading overlay and show the tool
    hideLoadingOverlay();
    
    console.log('Layout tool initialization completed successfully!');
    
  } catch (error) {
    console.error('Failed to initialize layout tool:', error);
    
    // Show error in loading overlay
    updateLoadingProgress(0, 'Error!', 'Failed to initialize - please refresh');
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div class="text-center">
          <div class="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 class="text-lg font-semibold text-[var(--foreground)] mb-2">Initialization Failed</h3>
          <p class="text-sm text-[var(--muted-foreground)] mb-4">The layout tool failed to load properly.</p>
          <button onclick="window.location.reload()" class="layout-btn primary">
            <i class="fas fa-refresh mr-2"></i>Refresh Page
          </button>
        </div>
      `;
    }
    
    showDialog('Failed to initialize the layout tool. Please refresh the page.');
  }
}

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', init);
