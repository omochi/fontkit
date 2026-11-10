import assert from 'assert';
import { ShapingClusters, mergeGlyphClusters } from '../src/layout/GlyphCluster';

describe('glyph clusters', function() {
  function shape(text) {
    const glyphs = Array.from(text, (char, id) => ({ id, codePoints: [char.codePointAt(0)] }));
    const clusters = new ShapingClusters(text, glyphs);
    return { clusters, glyphs: clusters.glyphs() };
  }
  function finish(clusters, glyphs) {
    clusters.finish(glyphs, glyphs.map((_, xAdvance) => ({ xAdvance })));
    return clusters.clusters;
  }

  it('starts with grapheme clusters and keeps marks with their base', function() {
    const { clusters, glyphs } = shape('a\u0301b');
    assert.deepEqual(clusters.clusters.map(c => c.sourceText), ['a\u0301', 'b']);
    assert.deepEqual(finish(clusters, glyphs).map(c => c.glyphs.map(g => g.glyph.id)), [[0, 1], [2]]);
  });
  it('merges intervening source clusters for a non-adjacent ligature', function() {
    const { clusters, glyphs } = shape('abc');
    const cluster = mergeGlyphClusters([glyphs[0], glyphs[2]]);
    const ligature = { id: 10, cluster };
    const result = finish(clusters, [ligature, glyphs[1]]);
    assert.deepEqual(result.map(c => c.sourceText), ['abc']);
    assert.deepEqual(result[0].glyphs.map(g => g.glyph.id), [10, 1]);
  });
  it('merges visually interleaved clusters preserving glyph order', function() {
    const { clusters, glyphs } = shape('ab');
    const extra = { id: 2, cluster: glyphs[0].cluster };
    const result = finish(clusters, [glyphs[0], glyphs[1], extra]);
    assert.deepEqual(result.map(c => c.sourceText), ['ab']);
    assert.deepEqual(result[0].glyphs.map(g => g.glyph.id), [0, 1, 2]);
  });
  it('keeps source strings intact when clusters are reordered', function() {
    const { clusters, glyphs } = shape('abc');
    assert.deepEqual(finish(clusters, glyphs.reverse()).map(c => c.sourceText), ['c', 'b', 'a']);
  });
  it('keeps the run together if grapheme segmentation is unavailable', function() {
    const original = Intl.Segmenter;
    try {
      Intl.Segmenter = undefined;
      const { clusters, glyphs } = shape('abc');
      assert.deepEqual(finish(clusters, glyphs).map(c => c.sourceText), ['abc']);
    } finally { Intl.Segmenter = original; }
  });
  it('keeps omitted input and handles glyphs without source text', function() {
    const input = [{ id: 1, codePoints: [97] }];
    const clusters = new ShapingClusters('abc', input);
    assert.equal(finish(clusters, clusters.glyphs())[0].sourceText, 'abc');
    const noText = new ShapingClusters(input, input);
    assert.equal(finish(noText, noText.glyphs())[0].sourceText, '');
    const noGlyphs = new ShapingClusters('abc', []);
    assert.equal(finish(noGlyphs, [])[0].sourceText, 'abc');
  });
  it('preserves deleted and inserted glyph provenance', function() {
    const { clusters, glyphs } = shape('abc');
    const result = finish(clusters, [glyphs[0], { id: 4, cluster: glyphs[0].cluster }, glyphs[2]]);
    assert.deepEqual(result.map(c => c.sourceText), ['ab', 'c']);
    assert.deepEqual(result[0].glyphs.map(g => g.glyph.id), [0, 4]);
  });
  it('merges the run if an inserted glyph has no known cluster', function() {
    const { clusters, glyphs } = shape('abc');
    const result = finish(clusters, [glyphs[0], { id: 4 }, glyphs[1], glyphs[2]]);
    assert.deepEqual(result.map(c => c.sourceText), ['abc']);
    assert.deepEqual(result[0].glyphs.map(g => g.glyph.id), [0, 4, 1, 2]);
  });
  it('updates cluster glyphs after substitution', function() {
    const { clusters, glyphs } = shape('ab');
    const cluster = mergeGlyphClusters(glyphs);
    const replacement = { id: 10, cluster };
    clusters.updateGlyphs([replacement]);
    assert.equal(clusters.clusters[0].sourceText, 'ab');
    assert.strictEqual(clusters.clusters[0].glyphs[0].glyph, replacement);
  });
});
