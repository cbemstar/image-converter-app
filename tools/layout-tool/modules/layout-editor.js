/**
 * Layout Editor Module – provides full‑screen editing for individual layouts
 * Cropping functionality removed - clean version with enhanced text features only
 */

/* eslint-disable */
// @ts-nocheck – this module relies on dynamic DOM look‑ups + runtime types

import { showNotification } from "../../../utils.js";
import { createThumbnail } from "./canvas-engine.js";
import { exportSingle } from "./export-raster.js";

// ────────────────────────────────
// GLOBAL STATE
// ────────────────────────────────

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
  heroImage: null,
  onSave: null,
};

// ────────────────────────────────
// ENTRY
// ────────────────────────────────

/**
 * Open the full‑screen editor overlay.
 */
export function openLayoutEditor(artboardCanvas, preset, master, onSave) {
  /* Build overlay */
  const overlay = document.createElement("div");
  overlay.id = "layout-editor-overlay";
  overlay.className = "fixed inset-0 bg-[var(--background)] z-50 flex flex-col";

  overlay.appendChild(makeHeader(preset));
  overlay.appendChild(makeContent());
  document.body.appendChild(overlay);

  /* Init + bind */
  initializeEditor(artboardCanvas, preset, master, onSave);
  bindEditorEvents();
  currentEditor = overlay;
}

// ────────────────────────────────
// LAYOUT HELPERS (DOM)
// ────────────────────────────────

function makeHeader(preset) {
  const h = document.createElement("div");
  h.className = "bg-[var(--card)] border-b border-[var(--border)] p-4 flex items-center justify-between";
  h.innerHTML = `
    <div class="flex items-center gap-4">
      <h2 class="text-xl font-bold text-[var(--foreground)]">Edit Layout: ${preset.name}</h2>
      <div class="text-sm text-[var(--muted-foreground)]">${preset.width || Math.round(preset.width_mm * 11.811)
    } × ${preset.height || Math.round(preset.height_mm * 11.811)}px</div>
    </div>
    <div class="flex items-center gap-2">
      <button id="editor-reset" class="layout-btn"><i class="fas fa-undo mr-2"></i>Reset</button>
      <button id="editor-save" class="layout-btn primary"><i class="fas fa-save mr-2"></i>Save</button>
      <button id="editor-close" class="layout-btn"><i class="fas fa-times mr-2"></i>Close</button>
    </div>`;
  return h;
}

function makeContent() {
  const wrap = document.createElement("div");
  wrap.className = "flex-1 flex";
  wrap.appendChild(makeSidebar());
  wrap.appendChild(makeCanvasArea());
  return wrap;
}

function makeSidebar() {
  const sb = document.createElement("div");
  sb.className = "w-80 bg-[var(--card)] border-r border-[var(--border)] p-4 overflow-y-auto";
  sb.innerHTML = /*html*/ `
    <div class="space-y-6">
      <div><h3 class="layout-label mb-3">Elements</h3><div id="element-list" class="space-y-2"></div></div>

      <div id="element-properties" class="hidden">${propertiesPanel()}</div>

      <div id="hero-image-controls" class="space-y-4">
        <div>
          <h3 class="layout-label mb-3">Hero Image Ratio</h3>
          <div class="grid grid-cols-2 gap-2">
            <button id="ratio-1-1" class="layout-btn text-xs" data-ratio="1:1">1:1<br><span class="text-xs opacity-75">Square</span></button>
            <button id="ratio-3-2" class="layout-btn text-xs" data-ratio="3:2">3:2<br><span class="text-xs opacity-75">Photo</span></button>
            <button id="ratio-4-3" class="layout-btn text-xs" data-ratio="4:3">4:3<br><span class="text-xs opacity-75">Classic</span></button>
            <button id="ratio-16-9" class="layout-btn text-xs" data-ratio="16:9">16:9<br><span class="text-xs opacity-75">Widescreen</span></button>
            <button id="ratio-5-4" class="layout-btn text-xs" data-ratio="5:4">5:4<br><span class="text-xs opacity-75">Print</span></button>
            <button id="ratio-7-5" class="layout-btn text-xs" data-ratio="7:5">7:5<br><span class="text-xs opacity-75">Portrait</span></button>
            <button id="ratio-16-10" class="layout-btn text-xs" data-ratio="16:10">16:10<br><span class="text-xs opacity-75">Monitor</span></button>
            <button id="ratio-original" class="layout-btn text-xs" data-ratio="original">Original<br><span class="text-xs opacity-75">No crop</span></button>
          </div>
          <div class="text-xs text-[var(--muted-foreground)] mt-2">
            <p><strong>Current:</strong> <span id="current-ratio">Original</span></p>
          </div>
        </div>

        <div>
          <h3 class="layout-label mb-3">Image Fit Mode</h3>
          <div class="grid grid-cols-2 gap-2">
            <button id="fit-cover" class="layout-btn text-xs primary" data-fit="cover">Cover<br><span class="text-xs opacity-75">Fill & crop</span></button>
            <button id="fit-contain" class="layout-btn text-xs" data-fit="contain">Contain<br><span class="text-xs opacity-75">Fit all</span></button>
            <button id="fit-fill" class="layout-btn text-xs" data-fit="fill">Fill<br><span class="text-xs opacity-75">Stretch</span></button>
            <button id="fit-scale-down" class="layout-btn text-xs" data-fit="scale-down">Scale Down<br><span class="text-xs opacity-75">Shrink only</span></button>
            <button id="fit-none" class="layout-btn text-xs" data-fit="none">None<br><span class="text-xs opacity-75">Original size</span></button>
            <button id="fit-crop" class="layout-btn text-xs" data-fit="crop">Crop<br><span class="text-xs opacity-75">Center crop</span></button>
          </div>
          <div class="text-xs text-[var(--muted-foreground)] mt-2">
            <p><strong>Current:</strong> <span id="current-fit">Cover</span></p>
            <p class="mt-1 text-xs">
              <strong>Cover:</strong> Fills canvas, may crop<br>
              <strong>Contain:</strong> Shows full image, may have gaps<br>
              <strong>Fill:</strong> Stretches to fill exactly<br>
              <strong>Scale Down:</strong> Like contain but won't upscale<br>
              <strong>None:</strong> Original size, centered<br>
              <strong>Crop:</strong> Crops to canvas size from center
            </p>
          </div>
        </div>
      </div>

      <div><h3 class="layout-label mb-3">Add Elements</h3><div class="space-y-2"><button id="add-text-editor" class="layout-btn w-full"><i class="fas fa-font mr-2"></i>Add Text</button><button id="add-logo-editor" class="layout-btn w-full"><i class="fas fa-image mr-2"></i>Add Logo</button></div></div>
    </div>`;
  return sb;
}

function propertiesPanel() {
  return /*html*/ `
    <h3 class="layout-label mb-3">Properties</h3>
    <div class="space-y-3">
      <div><label class="layout-label text-sm">Position X</label><input id="prop-x" type="number" class="layout-input"></div>
      <div><label class="layout-label text-sm">Position Y</label><input id="prop-y" type="number" class="layout-input"></div>
      <div id="text-properties" class="hidden space-y-3">
        <div><label class="layout-label text-sm">Text</label><textarea id="prop-text" rows="2" class="layout-input"></textarea></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="layout-label text-sm">Font Size</label><input id="prop-size" type="number" class="layout-input" value="24"></div><div><label class="layout-label text-sm">Line Height</label><input id="prop-line-height" type="number" step="0.1" class="layout-input" value="1.2"></div></div>
        <div><label class="layout-label text-sm">Font Family</label><select id="prop-font-family" class="layout-input">${["Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana", "Trebuchet MS", "Impact", "Comic Sans MS", "Courier New", "Lucida Console"].map(f => `<option>${f}</option>`).join("")}</select></div>
        <div class="grid grid-cols-3 gap-2"><div>${select("weight", ["normal", "bold", "lighter", "bolder"])}</div><div>${select("style", ["normal", "italic", "oblique"], "font-")}</div><div>${select("text-align", ["left", "center", "right"], "text-")}</div></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="layout-label text-sm">Text Color</label><input id="prop-color" type="color" class="layout-input" value="#000000"></div><div><label class="layout-label text-sm">Background</label><input id="prop-bg-color" type="color" class="layout-input" value="#ffffff"></div></div>
        <div><label class="layout-label text-sm">Text Effects</label><div class="grid grid-cols-2 gap-2"><label class="flex items-center gap-2"><input id="prop-text-shadow" type="checkbox" class="w-4 h-4"><span class="text-sm">Text Shadow</span></label><label class="flex items-center gap-2"><input id="prop-text-outline" type="checkbox" class="w-4 h-4"><span class="text-sm">Outline</span></label></div></div>
      </div>
      <div id="logo-properties" class="hidden space-y-3"><div><label class="layout-label text-sm">Width</label><input id="prop-width" type="number" class="layout-input" min="10"></div><div><label class="layout-label text-sm">Height</label><input id="prop-height" type="number" class="layout-input" min="10"></div></div>
    </div>`;
}

function select(id, opts, prefix = "") {
  return `<label class=\"layout-label text-sm\">${prefix.replace(/(^.|-)/g, m => m.toUpperCase().replace("-", ""))}</label><select id="prop-${prefix}${id}" class="layout-input">${opts.map(o => `<option value="${o}">${o}</option>`).join("")}</select>`;
}

function makeCanvasArea() {
  const c = document.createElement("div");
  c.className = "flex-1 bg-[var(--muted)] p-8 overflow-auto flex items-center justify-center";
  c.innerHTML = '<div class="bg-white rounded-lg shadow-lg p-4"><canvas id="editor-canvas" class="border border-gray-300 rounded"></canvas></div>';
  return c;
}

// ────────────────────────────────
// INITIALISATION
// ────────────────────────────────

function initializeEditor(artboard, preset, master, onSave) {
  const canvas = document.getElementById("editor-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = artboard.width;
  canvas.height = artboard.height;

  const maxW = window.innerWidth - 400;
  const maxH = window.innerHeight - 200;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;

  Object.assign(editorState, {
    canvas,
    ctx,
    preset,
    master,
    objects: cloneObjects(master.objects),
    heroImage: master.hero,
    onSave,
    scale,
  });

  renderEditor();
  updateElementList();
}

function cloneObjects(objs) {
  return objs.map(o => ({ ...o, id: Math.random().toString(36).slice(2, 11) }));
}

// ────────────────────────────────
// RENDERING
// ────────────────────────────────

function renderEditor() {
  const { canvas, ctx, master, objects } = editorState;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (editorState.heroImage) drawHeroImage(ctx, canvas.width, canvas.height);

  const sx = canvas.width / master.width;
  const sy = canvas.height / master.height;

  for (const obj of objects) {
    ctx.save();
    const x = obj.x * sx,
      y = obj.y * sy;

    if (obj.type === "text") drawText(ctx, obj, x, y, sx, sy);
    if (obj.type === "logo" && obj.image) ctx.drawImage(obj.image, x, y, obj.w * sx, obj.h * sy);

    if (obj === editorState.selectedElement) drawSelection(ctx, obj, x, y, sx, sy);
    ctx.restore();
  }
}

function drawText(ctx, obj, x, y, sx, sy) {
  const size = (obj.size || 24) * Math.min(sx, sy);
  const font = `${obj.fontStyle || "normal"} ${obj.fontWeight || "normal"} ${size}px ${obj.fontFamily || "Arial"}`;
  ctx.font = font;
  ctx.textAlign = obj.textAlign || "left";
  ctx.textBaseline = "top";

  if (obj.bgColor && obj.bgColor !== "#ffffff") {
    const m = ctx.measureText(obj.text);
    ctx.fillStyle = obj.bgColor;
    ctx.fillRect(x - 4, y - 2, m.width + 8, size * (obj.lineHeight || 1.2) + 4);
  }

  if (obj.textOutline) {
    ctx.strokeStyle = obj.color === "#ffffff" ? "#000" : "#fff";
    ctx.lineWidth = 2;
    ctx.strokeText(obj.text, x, y);
  }

  if (obj.textShadow) {
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }

  ctx.fillStyle = obj.color || "#000";
  obj.text.split("\n").forEach((line, i) => ctx.fillText(line, x, y + i * size * (obj.lineHeight || 1.2)));
}

function drawSelection(ctx, obj, x, y, sx, sy) {
  ctx.strokeStyle = "#007bff";
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 2;
  if (obj.type === "text") {
    const m = ctx.measureText(obj.text);
    const h = (obj.size || 24) * Math.min(sx, sy);
    ctx.strokeRect(x - 2, y - 2, m.width + 4, h + 4);
  } else {
    ctx.strokeRect(x - 2, y - 2, obj.w * sx + 4, obj.h * sy + 4);
  }
  ctx.setLineDash([]);
}

function drawHeroImage(ctx, cw, ch) {
  const { heroImage: img, heroImageRatio, heroImageFit } = editorState;
  if (!img) return;

  ctx.save();

  // Get fit mode (default to 'cover' if not set)
  const fitMode = heroImageFit || 'cover';

  // Handle different fit modes
  switch (fitMode) {
    case 'cover':
      drawImageCover(ctx, img, cw, ch, heroImageRatio);
      break;
    case 'contain':
      drawImageContain(ctx, img, cw, ch, heroImageRatio);
      break;
    case 'fill':
      drawImageFill(ctx, img, cw, ch, heroImageRatio);
      break;
    case 'scale-down':
      drawImageScaleDown(ctx, img, cw, ch, heroImageRatio);
      break;
    case 'none':
      drawImageNone(ctx, img, cw, ch);
      break;
    case 'crop':
      drawImageCrop(ctx, img, cw, ch);
      break;
    default:
      drawImageCover(ctx, img, cw, ch, heroImageRatio);
  }

  ctx.restore();
}

function drawImageCover(ctx, img, cw, ch, ratio) {
  // Cover: Scale image to fill canvas, may crop parts
  if (ratio && ratio !== 'original') {
    // Apply specific aspect ratio with cover behavior
    const targetRatio = getRatioValue(ratio);
    const imgRatio = img.width / img.height;

    let srcX = 0, srcY = 0, srcWidth = img.width, srcHeight = img.height;

    if (imgRatio > targetRatio) {
      // Image wider than target - crop sides
      srcWidth = img.height * targetRatio;
      srcX = (img.width - srcWidth) / 2;
    } else if (imgRatio < targetRatio) {
      // Image taller than target - crop top/bottom
      srcHeight = img.width / targetRatio;
      srcY = (img.height - srcHeight) / 2;
    }

    ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, cw, ch);
  } else {
    // Standard cover behavior
    const scale = Math.max(cw / img.width, ch / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (cw - scaledWidth) / 2;
    const y = (ch - scaledHeight) / 2;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
  }
}

function drawImageContain(ctx, img, cw, ch, ratio) {
  // Contain: Scale image to fit entirely within canvas, may have gaps
  if (ratio && ratio !== 'original') {
    const targetRatio = getRatioValue(ratio);
    const canvasRatio = cw / ch;

    let drawWidth, drawHeight, drawX, drawY;

    if (targetRatio > canvasRatio) {
      // Target is wider than canvas - fit to width
      drawWidth = cw;
      drawHeight = cw / targetRatio;
      drawX = 0;
      drawY = (ch - drawHeight) / 2;
    } else {
      // Target is taller than canvas - fit to height
      drawHeight = ch;
      drawWidth = ch * targetRatio;
      drawX = (cw - drawWidth) / 2;
      drawY = 0;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  } else {
    // Standard contain behavior
    const scale = Math.min(cw / img.width, ch / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (cw - scaledWidth) / 2;
    const y = (ch - scaledHeight) / 2;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
  }
}

function drawImageFill(ctx, img, cw, ch, ratio) {
  // Fill: Stretch image to fill canvas exactly (may distort)
  if (ratio && ratio !== 'original') {
    const targetRatio = getRatioValue(ratio);
    const canvasRatio = cw / ch;

    let drawWidth, drawHeight, drawX, drawY;

    if (targetRatio > canvasRatio) {
      drawWidth = cw;
      drawHeight = cw / targetRatio;
      drawX = 0;
      drawY = (ch - drawHeight) / 2;
    } else {
      drawHeight = ch;
      drawWidth = ch * targetRatio;
      drawX = (cw - drawWidth) / 2;
      drawY = 0;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  } else {
    // Stretch to fill entire canvas
    ctx.drawImage(img, 0, 0, cw, ch);
  }
}

function drawImageScaleDown(ctx, img, cw, ch, ratio) {
  // Scale-down: Like contain, but never scale up
  if (ratio && ratio !== 'original') {
    const targetRatio = getRatioValue(ratio);
    const canvasRatio = cw / ch;

    let drawWidth, drawHeight;

    if (targetRatio > canvasRatio) {
      drawWidth = Math.min(cw, img.width);
      drawHeight = drawWidth / targetRatio;
    } else {
      drawHeight = Math.min(ch, img.height);
      drawWidth = drawHeight * targetRatio;
    }

    const drawX = (cw - drawWidth) / 2;
    const drawY = (ch - drawHeight) / 2;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  } else {
    const scale = Math.min(cw / img.width, ch / img.height, 1); // Never scale up
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (cw - scaledWidth) / 2;
    const y = (ch - scaledHeight) / 2;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
  }
}

function drawImageNone(ctx, img, cw, ch) {
  // None: Original size, centered
  const x = (cw - img.width) / 2;
  const y = (ch - img.height) / 2;

  ctx.drawImage(img, x, y);
}

function drawImageCrop(ctx, img, cw, ch) {
  // Crop: Crop image from center to fit canvas exactly
  const imgRatio = img.width / img.height;
  const canvasRatio = cw / ch;

  let srcX = 0, srcY = 0, srcWidth = img.width, srcHeight = img.height;

  if (imgRatio > canvasRatio) {
    // Image is wider - crop sides
    srcWidth = img.height * canvasRatio;
    srcX = (img.width - srcWidth) / 2;
  } else {
    // Image is taller - crop top/bottom
    srcHeight = img.width / canvasRatio;
    srcY = (img.height - srcHeight) / 2;
  }

  ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, cw, ch);
}

function getRatioValue(ratioString) {
  const ratios = {
    '1:1': 1,
    '3:2': 3 / 2,
    '4:3': 4 / 3,
    '16:9': 16 / 9,
    '5:4': 5 / 4,
    '7:5': 7 / 5,
    '16:10': 16 / 10
  };
  return ratios[ratioString] || 1;
}

// ────────────────────────────────
// SIDEBAR ELEMENT LIST
// ────────────────────────────────

function updateElementList() {
  const list = document.getElementById("element-list");
  list.innerHTML = "";
  editorState.objects.forEach((o, i) => {
    const item = document.createElement("div");
    item.className = `p-2 border rounded cursor-pointer transition-colors ${o === editorState.selectedElement ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--background)] hover:bg-[var(--accent)]"
      }`;
    item.innerHTML = `<div class="flex items-center justify-between"><div class="flex items-center gap-2"><i class="${o.type === "text" ? "fas fa-font" : "fas fa-image"
      }"></i><span class="text-sm">${o.type === "text" ? o.text.slice(0, 20) : "Logo"}</span></div><button class="delete-element text-red-500 hover:text-red-700" data-i="${i}"><i class="fas fa-trash text-xs"></i></button></div>`;
    item.addEventListener("click", e => {
      if (!e.target.closest(".delete-element")) selectElement(o);
    });
    item.querySelector(".delete-element").addEventListener("click", e => {
      e.stopPropagation();
      deleteElement(i);
    });
    list.appendChild(item);
  });
}

function selectElement(el) {
  editorState.selectedElement = el;
  renderEditor();
  updateElementList();
  showElementProperties(el);
}

function deleteElement(i) {
  editorState.objects.splice(i, 1);
  editorState.selectedElement = null;
  document.getElementById("element-properties").classList.add("hidden");
  renderEditor();
  updateElementList();
}

function showElementProperties(el) {
  const panel = document.getElementById("element-properties");
  const txt = document.getElementById("text-properties");
  const logo = document.getElementById("logo-properties");

  panel.classList.remove("hidden");
  document.getElementById("prop-x").value = Math.round(el.x);
  document.getElementById("prop-y").value = Math.round(el.y);

  if (el.type === "text") {
    txt.classList.remove("hidden");
    logo.classList.add("hidden");
    document.getElementById("prop-text").value = el.text;
    document.getElementById("prop-size").value = el.size || 24;
    document.getElementById("prop-color").value = el.color || "#000000";
    document.getElementById("prop-line-height").value = el.lineHeight || 1.2;
    document.getElementById("prop-font-family").value = el.fontFamily || "Arial";
    document.getElementById("prop-font-weight").value = el.fontWeight || "normal";
    document.getElementById("prop-font-style").value = el.fontStyle || "normal";
    document.getElementById("prop-text-align").value = el.textAlign || "left";
    document.getElementById("prop-bg-color").value = el.bgColor || "#ffffff";
    document.getElementById("prop-text-shadow").checked = el.textShadow || false;
    document.getElementById("prop-text-outline").checked = el.textOutline || false;
  } else {
    txt.classList.add("hidden");
    logo.classList.remove("hidden");
    document.getElementById("prop-width").value = Math.round(el.w);
    document.getElementById("prop-height").value = Math.round(el.h);
  }
}

// ────────────────────────────────
// INPUT BINDINGS & UPDATES
// ────────────────────────────────

function bindEditorEvents() {
  setupCanvasInteraction();
  bindPropertyInputs();
  bindEnhancedTextProperties();
  bindRatioControls();

  document.getElementById("editor-close").addEventListener("click", closeEditor);
  document.getElementById("editor-save").addEventListener("click", saveChanges);
  document.getElementById("editor-reset").addEventListener("click", resetChanges);
  document.getElementById("add-text-editor").addEventListener("click", addTextElement);
  document.getElementById("add-logo-editor").addEventListener("click", addLogoElement);
}

function bindPropertyInputs() {
  ["prop-x", "prop-y", "prop-text", "prop-size", "prop-color", "prop-width", "prop-height"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateElementFromProperties);
  });
}

function updateElementFromProperties() {
  const el = editorState.selectedElement;
  if (!el) return;
  el.x = parseFloat(document.getElementById("prop-x").value) || 0;
  el.y = parseFloat(document.getElementById("prop-y").value) || 0;
  if (el.type === "text") {
    el.text = document.getElementById("prop-text").value || "Text";
    el.size = parseFloat(document.getElementById("prop-size").value) || 24;
    el.color = document.getElementById("prop-color").value || "#000000";
  } else {
    el.w = parseFloat(document.getElementById("prop-width").value) || 100;
    el.h = parseFloat(document.getElementById("prop-height").value) || 100;
  }
  renderEditor();
}

function updateElementProperties() {
  const el = editorState.selectedElement;
  if (!el) return;

  document.getElementById("prop-x").value = Math.round(el.x);
  document.getElementById("prop-y").value = Math.round(el.y);
}

function bindEnhancedTextProperties() {
  ["prop-line-height", "prop-font-family", "prop-font-weight", "prop-font-style", "prop-text-align", "prop-bg-color", "prop-text-shadow", "prop-text-outline"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener("input", updateEnhancedTextProperties); el.addEventListener("change", updateEnhancedTextProperties); }
  });
}

function updateEnhancedTextProperties() {
  const el = editorState.selectedElement;
  if (!el || el.type !== "text") return;
  el.lineHeight = parseFloat(document.getElementById("prop-line-height").value) || 1.2;
  el.fontFamily = document.getElementById("prop-font-family").value || "Arial";
  el.fontWeight = document.getElementById("prop-font-weight").value || "normal";
  el.fontStyle = document.getElementById("prop-font-style").value || "normal";
  el.textAlign = document.getElementById("prop-text-align").value || "left";
  el.bgColor = document.getElementById("prop-bg-color").value || "#ffffff";
  el.textShadow = document.getElementById("prop-text-shadow").checked;
  el.textOutline = document.getElementById("prop-text-outline").checked;
  renderEditor();
}

// ────────────────────────────────
// HERO IMAGE RATIO CONTROLS
// ────────────────────────────────

function bindRatioControls() {
  // Bind ratio buttons
  const ratioButtons = document.querySelectorAll('[data-ratio]');
  ratioButtons.forEach(button => {
    button.addEventListener('click', () => {
      const ratio = button.getAttribute('data-ratio');
      applyImageRatio(ratio);
      updateCurrentRatioDisplay(ratio);

      // Update button states
      ratioButtons.forEach(btn => btn.classList.remove('primary'));
      button.classList.add('primary');
    });
  });

  // Bind fit buttons
  const fitButtons = document.querySelectorAll('[data-fit]');
  fitButtons.forEach(button => {
    button.addEventListener('click', () => {
      const fit = button.getAttribute('data-fit');
      applyImageFit(fit);
      updateCurrentFitDisplay(fit);

      // Update button states
      fitButtons.forEach(btn => btn.classList.remove('primary'));
      button.classList.add('primary');
    });
  });

  // Set initial states
  updateCurrentRatioDisplay('original');
  updateCurrentFitDisplay('cover');
  document.getElementById('ratio-original').classList.add('primary');
  document.getElementById('fit-cover').classList.add('primary');
}

function applyImageRatio(ratio) {
  if (!editorState.heroImage) {
    showNotification('Please upload a hero image first', 'warning');
    return;
  }

  // Store the ratio in editor state
  editorState.heroImageRatio = ratio;

  // Re-render with new ratio
  renderEditor();
  showNotification(`Applied ${ratio} ratio to hero image`, 'success');
}

function updateCurrentRatioDisplay(ratio) {
  const currentRatioSpan = document.getElementById('current-ratio');
  if (currentRatioSpan) {
    const ratioNames = {
      '1:1': '1:1 (Square)',
      '3:2': '3:2 (Photo)',
      '4:3': '4:3 (Classic)',
      '16:9': '16:9 (Widescreen)',
      '5:4': '5:4 (Print)',
      '7:5': '7:5 (Portrait)',
      '16:10': '16:10 (Monitor)',
      'original': 'Original (No crop)'
    };
    currentRatioSpan.textContent = ratioNames[ratio] || ratio;
  }
}

function applyImageFit(fit) {
  if (!editorState.heroImage) {
    showNotification('Please upload a hero image first', 'warning');
    return;
  }

  // Store the fit mode in editor state
  editorState.heroImageFit = fit;

  // Re-render with new fit mode
  renderEditor();
  showNotification(`Applied ${fit} fit mode to hero image`, 'success');
}

function updateCurrentFitDisplay(fit) {
  const currentFitSpan = document.getElementById('current-fit');
  if (currentFitSpan) {
    const fitNames = {
      'cover': 'Cover (Fill & crop)',
      'contain': 'Contain (Fit all)',
      'fill': 'Fill (Stretch)',
      'scale-down': 'Scale Down (Shrink only)',
      'none': 'None (Original size)',
      'crop': 'Crop (Center crop)'
    };
    currentFitSpan.textContent = fitNames[fit] || fit;
  }
}

// ────────────────────────────────
// CANVAS INTERACTION
// ────────────────────────────────

function setupCanvasInteraction() {
  const canvas = editorState.canvas;
  let dragStartX, dragStartY;

  canvas.addEventListener("mousedown", e => {
    const { x, y } = canvasCoords(e);
    const el = getElementAtPosition(x, y);
    if (el) {
      selectElement(el);
      editorState.isDragging = true;
      dragStartX = x - el.x * (canvas.width / editorState.master.width);
      dragStartY = y - el.y * (canvas.height / editorState.master.height);
      canvas.style.cursor = "grabbing";
    } else {
      editorState.selectedElement = null;
      document.getElementById("element-properties").classList.add("hidden");
      renderEditor();
      updateElementList();
    }
  });

  canvas.addEventListener("mousemove", e => {
    const { x, y } = canvasCoords(e);
    if (editorState.isDragging && editorState.selectedElement) {
      const sx = editorState.master.width / canvas.width, sy = editorState.master.height / canvas.height;
      editorState.selectedElement.x = (x - dragStartX) * sx;
      editorState.selectedElement.y = (y - dragStartY) * sy;
      renderEditor();
      updateElementProperties();
      return;
    }
    canvas.style.cursor = getElementAtPosition(x, y) ? "grab" : "default";
  });

  canvas.addEventListener("mouseup", () => {
    editorState.isDragging = false;
    canvas.style.cursor = "default";
  });

  function canvasCoords(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / editorState.scale, y: (ev.clientY - r.top) / editorState.scale };
  }
}

function getElementAtPosition(x, y) {
  const { canvas, master, objects } = editorState;
  const sx = canvas.width / master.width, sy = canvas.height / master.height;
  const ctx = canvas.getContext("2d");
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i], ox = o.x * sx, oy = o.y * sy;
    if (o.type === "text") {
      ctx.font = `${(o.size || 24) * Math.min(sx, sy)}px Arial`;
      const w = ctx.measureText(o.text).width, h = (o.size || 24) * Math.min(sx, sy);
      if (x >= ox && x <= ox + w && y >= oy && y <= oy + h) return o;
    }
    if (o.type === "logo") {
      const w = o.w * sx, h = o.h * sy;
      if (x >= ox && x <= ox + w && y >= oy && y <= oy + h) return o;
    }
  }
  return null;
}

// ────────────────────────────────
// ADD ELEMENTS
// ────────────────────────────────

function addTextElement() {
  const txt = prompt("Enter text:"); if (!txt) return;
  const obj = { type: "text", text: txt, x: 50, y: 50, size: 24, color: "#000", fontFamily: "Arial", fontWeight: "normal", fontStyle: "normal", textAlign: "left", lineHeight: 1.2, bgColor: "#ffffff", textShadow: false, textOutline: false, id: randId() };
  editorState.objects.push(obj); selectElement(obj); renderEditor(); updateElementList();
}

function addLogoElement() {
  const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    try { const img = new Image(); img.src = URL.createObjectURL(f); await img.decode(); const obj = { type: "logo", image: img, x: 50, y: 50, w: Math.min(img.width, 200), h: Math.min(img.height, 200), id: randId() }; editorState.objects.push(obj); selectElement(obj); renderEditor(); updateElementList(); }
    catch (err) { showNotification("Error loading image: " + err.message, "error"); }
  };
  input.click();
}

// ────────────────────────────────
// SAVE / RESET / CLOSE
// ────────────────────────────────

function saveChanges() {
  if (editorState.onSave) {
    editorState.onSave(editorState.objects);
  }
  showNotification('Layout changes saved successfully', 'success');
  closeEditor();
}

function resetChanges() {
  if (confirm("Reset all changes?")) {
    editorState.objects = cloneObjects(editorState.master.objects);
    renderEditor();
    updateElementList();
    editorState.selectedElement = null;
    document.getElementById("element-properties").classList.add("hidden");
  }
}

function closeEditor() {
  if (currentEditor) { currentEditor.remove(); currentEditor = null; }
}

// ────────────────────────────────
// UTILITIES
// ────────────────────────────────

function randId() { return Math.random().toString(36).slice(2, 11); }