import assert from 'assert';
import { buildGlyphClusters } from '../src/layout/GlyphCluster';

describe('glyph clusters', function() {
  const glyphs = [0, 1, 2].map(id => ({ id }));
  const positions = [0, 1, 2].map(xAdvance => ({ xAdvance }));
  const span = (start, end) => ({ start, end });
  it('keeps combining marks and the base in one cluster', function() {
    const clusters = buildGlyphClusters('a\u0301b', glyphs, positions, [span(0, 1), span(1, 2), span(2, 3)]);
    assert.deepEqual(clusters.map(c => c.sourceText), ['a\u0301', 'b']);
    assert.deepEqual(clusters.map(c => c.glyphs.map(g => g.glyph.id)), [[0, 1], [2]]);
    assert.strictEqual(clusters[0].glyphs[1].position, positions[1]);
  });
  it('merges the intervening mark into a non-adjacent ligature cluster', function() {
    const clusters = buildGlyphClusters('a\u0301b', glyphs.slice(0, 2), positions, [span(0, 3), span(1, 2)]);
    assert.deepEqual(clusters.map(c => c.sourceText), ['a\u0301b']);
    assert.deepEqual(clusters[0].glyphs.map(g => g.glyph.id), [0, 1]);
  });
  it('merges visually interleaved clusters and preserves drawing order', function() {
    const clusters = buildGlyphClusters('ab', glyphs, positions, [span(0, 1), span(1, 2), span(0, 1)]);
    assert.deepEqual(clusters.map(c => c.sourceText), ['ab']);
    assert.deepEqual(clusters[0].glyphs.map(g => g.glyph.id), [0, 1, 2]);
  });
  it('orders separate clusters in visual order without reversing their source text', function() {
    const clusters = buildGlyphClusters('abc', glyphs, positions, [span(2, 3), span(1, 2), span(0, 1)]);
    assert.deepEqual(clusters.map(c => c.sourceText), ['c', 'b', 'a']);
    assert.deepEqual(clusters.flatMap(c => c.glyphs.map(g => g.glyph.id)), [0, 1, 2]);
  });
  it('keeps the whole run if grapheme segmentation is unavailable', function() {
    const original = Intl.Segmenter;
    try {
      Intl.Segmenter = undefined;
      assert.deepEqual(buildGlyphClusters('abc', glyphs, positions, [span(0, 1), span(1, 2), span(2, 3)]).map(c => c.sourceText), ['abc']);
    } finally { Intl.Segmenter = original; }
  });
  it('uses an empty source string when given glyphs without source text', function() {
    const clusters = buildGlyphClusters(glyphs, glyphs, positions, []);
    assert.equal(clusters[0].sourceText, '');
    assert.equal(clusters[0].glyphs.length, 3);
  });
  it('preserves omitted text and groups the run when provenance is unknown', function() {
    assert.equal(buildGlyphClusters('abc', glyphs.slice(0, 1), positions, [span(0, 1)])[0].sourceText, 'abc');
    assert.deepEqual(buildGlyphClusters('abc', glyphs, positions, [span(0, 1), null, span(2, 3)]).map(c => c.sourceText), ['abc']);
    assert.equal(buildGlyphClusters('abc', [], [], [])[0].sourceText, 'abc');
  });
});
