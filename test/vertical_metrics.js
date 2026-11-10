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

  it('groups OpenType ligatures and variation selectors with their original text', function() {
    const font = fontkit.openSync(__dirname + '/data/SourceSansPro/SourceSansPro-Regular.otf');
    const ligature = font.layout('ffi', ['dlig']);
    assert.deepEqual(ligature.clusters.map(cluster => cluster.sourceText), ['ff', 'i']);
    assert.ok(ligature.glyphs.every(glyph => !Object.prototype.hasOwnProperty.call(glyph, 'sourceRange')));
    assert.deepEqual(ligature.clusters.flatMap(cluster => cluster.glyphs.map(item => item.glyph.id)), ligature.glyphs.map(glyph => glyph.id));
    const variantFont = fontkit.openSync(__dirname + '/data/fonttest/TestCMAP14.otf');
    const variant = variantFont.layout('芦芦\u{E0100}芦\u{E0101}');
    assert.deepEqual(variant.clusters.map(cluster => cluster.sourceText), ['芦', '芦\u{E0100}', '芦\u{E0101}']);
    assert.deepEqual(font.layout('').clusters, []);
  });

  it('keeps combining marks with the base and reuses the positioned glyphs', function() {
    const font = fontkit.openSync(__dirname + '/data/SourceSansPro/SourceSansPro-Regular.otf');
    const run = font.layout('A\u0301B');
    assert.deepEqual(run.clusters.map(cluster => cluster.sourceText), ['A\u0301', 'B']);
    assert.deepEqual(run.clusters.flatMap(cluster => cluster.glyphs.map(item => item.glyph)), run.glyphs);
    assert.deepEqual(run.clusters.flatMap(cluster => cluster.glyphs.map(item => item.position)), run.positions);
  });

  it('groups AAT ligatures and orders clusters in drawing order', function() {
    const font = fontkit.openSync(__dirname + '/data/Play/Play-Regular.ttf');
    assert.deepEqual(font.layout('ffi 1⁄2', ['numr']).clusters.map(cluster => cluster.sourceText), ['ffi', ' ', '1⁄2']);
    assert.deepEqual(font.layout('ffi', [], null, null, 'rtl').clusters.map(cluster => cluster.sourceText), ['i', 'f', 'f']);
  });

  it('retains the original range when Hangul jamo are composed', function() {
    const font = fontkit.openSync(__dirname + '/data/NotoSansCJK/NotoSansCJKkr-Regular.otf');
    const run = font.layout('가');
    assert.equal(run.glyphs.length, 1);
    assert.deepEqual(run.clusters.map(cluster => cluster.sourceText), ['가']);
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
