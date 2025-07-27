const { PDFDocument, degrees } = require('pdf-lib');

/**
 * Parse a page range string like "1-3,5" into zero-based page indices.
 * Supports open-ended ranges ("-3", "4-").
 * @param {string} range
 * @param {number} pageCount
 * @returns {number[]}
 */
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

/**
 * Merge selected pages from multiple PDFs with optional page edits.
 * @param {{name:string,data:ArrayBuffer}[]} files PDF files to merge
 * @param {Object} specs Merge instructions
 * @param {string[]} specs.ranges Page ranges for each file (e.g. "1-3,5")
 * @param {number[][]=} specs.rotations Per-file list of page rotations in degrees
 * @param {number[][]=} specs.deletes Per-file list of page indices to drop
 * @param {number[][]=} specs.reorder Per-file list of new page orders
 * @returns {Promise<Uint8Array>} Bytes of the merged PDF
 */
async function mergeWithRangesAndEdit(files, specs) {
  const { ranges, rotations = [], deletes = [], reorder = [] } = specs;
  if (!Array.isArray(files) || !Array.isArray(ranges) || files.length !== ranges.length) {
    throw new Error('Files and ranges length mismatch');
  }
  const merged = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const doc = await PDFDocument.load(file.data);
    const pageIndices = parseRange(ranges[i], doc.getPageCount());
    let pages = await merged.copyPages(doc, pageIndices);

    if (Array.isArray(deletes[i])) {
      const delSet = new Set(deletes[i]);
      pages = pages.filter((_, idx) => !delSet.has(idx));
    }

    if (Array.isArray(reorder[i])) {
      pages = reorder[i].map((ri) => {
        if (ri < 0 || ri >= pages.length) throw new Error(`Invalid reorder index ${ri}`);
        return pages[ri];
      });
    }

    pages.forEach((p, j) => {
      const angle = rotations[i] && typeof rotations[i][j] === 'number' ? rotations[i][j] : 0;
      if (angle) p.setRotation(degrees(angle));
      merged.addPage(p);
    });
  }

  return merged.save();
}

module.exports = { mergeWithRangesAndEdit, parseRange };
