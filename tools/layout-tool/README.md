# Layout Tool

This experimental editor lets you design simple layouts directly in the browser. It was created for the Reformately demo site and uses the same fonts and colour palette.

## About

The tool demonstrates basic document presets and a small SVG based canvas engine. Images can be imported via drag and drop and text can be edited inline. Bleed, trim and safe overlays help when preparing artwork for print.

Exports are available as PNG/JPG, PDF, raw SVG or a ZIP package containing the project files.

## FAQs

### Why build another layout tool?
The goal is to showcase how modern browser APIs can handle basic design tasks without any server side component.

### Do exports happen locally?
Yes. All rendering and file generation use client‑side JavaScript so your artwork never leaves the browser.

### Can I use my own fonts?
For simplicity only system fonts are supported. PDF export embeds a basic font and SVG export keeps the text editable.

### Is this production ready?
No. It is a proof of concept intended for experimentation.
