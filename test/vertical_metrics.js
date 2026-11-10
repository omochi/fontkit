import './addTestHelpersToFontkit';
import fontkit from '../src';
import assert from 'assert';

describe('vertical metrics', function() {
  it('reads the vhea header and vertical advance from a CJK font', function() {
    const font = fontkit.openSync(__dirname + '/data/NotoSansCJK/NotoSansCJKkr-Regular.otf');
    assert.equal(font.vhea.version, 0x00011000);
    assert.equal(font.vhea.numberOfMetrics, 65167);
    assert.equal(font.glyphForCodePoint(0x3042).advanceHeight, 1000);
  });

  it('keeps input characters per glyph use when glyph IDs coincide', function() {
    const font = fontkit.openSync(__dirname + '/data/NotoSansCJK/NotoSansCJKkr-Regular.otf');
    const first = font.glyphForCodePoint(0x10ffff);
    const second = font.glyphForCodePoint(0x10fffe);
    assert.equal(first.id, second.id);
    assert.deepEqual(first.codePoints, [0x10ffff]);
    assert.deepEqual(second.codePoints, [0x10fffe]);
  });

  it('tracks UTF-16 ranges through OpenType ligatures and variation selectors', function() {
    const font = fontkit.openSync(__dirname + '/data/SourceSansPro/SourceSansPro-Regular.otf');
    const ligature = font.layout('ffi', ['dlig']);
    assert.deepEqual(ligature.sourceRanges, [{ start: 0, end: 2 }, { start: 2, end: 3 }]);
    const variantFont = fontkit.openSync(__dirname + '/data/fonttest/TestCMAP14.otf');
    const variant = variantFont.layout('芦芦\u{E0100}芦\u{E0101}');
    assert.deepEqual(variant.sourceRanges, [{ start: 0, end: 1 }, { start: 1, end: 4 }, { start: 4, end: 7 }]);
    assert.deepEqual(font.layout('').sourceRanges, []);
  });

  it('tracks source ranges through AAT ligatures and right-to-left runs', function() {
    const font = fontkit.openSync(__dirname + '/data/Play/Play-Regular.ttf');
    assert.deepEqual(font.layout('ffi 1⁄2', ['numr']).sourceRanges, [
      { start: 0, end: 3 }, { start: 3, end: 4 }, { start: 4, end: 7 }
    ]);
    assert.deepEqual(font.layout('ffi', [], null, null, 'rtl').sourceRanges, [
      { start: 2, end: 3 }, { start: 1, end: 2 }, { start: 0, end: 1 }
    ]);
  });

  it('retains the original range when Hangul jamo are composed', function() {
    const font = fontkit.openSync(__dirname + '/data/NotoSansCJK/NotoSansCJKkr-Regular.otf');
    const run = font.layout('가');
    assert.equal(run.glyphs.length, 1);
    assert.deepEqual(run.sourceRanges, [{ start: 0, end: 2 }]);
  });

  it('falls back to horizontal font-wide metrics when vmtx is absent', function() {
    const font = fontkit.openSync(__dirname + '/data/OpenSans/OpenSans-Regular.ttf');
    assert.equal(font.vmtx, null);
    const run = font.layout('A', [], null, null, 'ttb');
    assert.ok(run.glyphs[0].advanceHeight > 0);
    assert.equal(run.positions[0].yAdvance, -run.glyphs[0].advanceHeight);
    assert.notEqual(run.positions[0].yOffset, 0);
  });

  it('substitutes vertical glyphs and advances down in top-to-bottom layout', function() {
    const font = fontkit.openSync(__dirname + '/data/NotoSansCJK/NotoSansCJKkr-Regular.otf');
    const horizontal = font.layout('（');
    const vertical = font.layout('（', [], null, null, 'ttb');
    assert.notEqual(vertical.glyphs[0].id, horizontal.glyphs[0].id);
    assert.equal(vertical.positions[0].xAdvance, 0);
    assert.equal(vertical.positions[0].yAdvance, -1000);
    assert.notEqual(vertical.positions[0].yOffset, 0);
  });
});
