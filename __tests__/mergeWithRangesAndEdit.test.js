const { PDFDocument } = require('pdf-lib');
const { mergeWithRangesAndEdit } = require('../pdf-utils');

describe('mergeWithRangesAndEdit', () => {
  test('merges selected pages and applies rotations', async () => {
    const createPdf = async (pageCount) => {
      const doc = await PDFDocument.create();
      for (let i = 0; i < pageCount; i++) {
        doc.addPage();
      }
      return doc.save();
    };

    const file1 = { name: 'a.pdf', data: await createPdf(3) };
    const file2 = { name: 'b.pdf', data: await createPdf(2) };

    const resultBytes = await mergeWithRangesAndEdit(
      [file1, file2],
      {
        ranges: ['1-2', '2'],
        rotations: [[90, 0], [180]]
      }
    );

    const merged = await PDFDocument.load(resultBytes);
    expect(merged.getPageCount()).toBe(3);
    expect(merged.getPage(0).getRotation().angle).toBe(90);
    expect(merged.getPage(2).getRotation().angle).toBe(180);
  });
});
