/**
 * Mutable clusters for a single shaping operation. Their source strings remain
 * in logical order even when the glyphs are reordered into visual order.
 */
export class ShapingClusters {
  constructor(text, glyphs) {
    const hasText = typeof text === 'string';
    const segments = hasText && text && typeof Intl !== 'undefined' && Intl.Segmenter
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), part => part.segment)
      : [hasText ? text : ''];
    this.clusters = text === '' && !glyphs.length ? [] : segments.map(sourceText => ({ sourceText, glyphs: [], owner: this }));

    // Match only the original cmap output, before shaping can change codePoints.
    // If a cmap omits input, keep the entire run together conservatively.
    let offset = 0, segmentIndex = 0, segmentEnd = segments[0] ? segments[0].length : 0;
    let assignments = [];
    for (const glyph of glyphs) {
      const part = String.fromCodePoint(...glyph.codePoints);
      if (!hasText || !part || text.slice(offset, offset + part.length) !== part) {
        assignments = null;
        break;
      }
      while (offset >= segmentEnd && segmentIndex + 1 < segments.length) segmentEnd += segments[++segmentIndex].length;
      const first = segmentIndex;
      offset += part.length;
      while (offset > segmentEnd && segmentIndex + 1 < segments.length) segmentEnd += segments[++segmentIndex].length;
      assignments.push([first, segmentIndex]);
    }
    if (!hasText || assignments === null || offset !== text.length) {
      this.clusters = [{ sourceText: hasText ? text : '', glyphs: [], owner: this }];
      assignments = glyphs.map(() => [0, 0]);
    }
    const initial = this.clusters.slice();
    glyphs.forEach((glyph, i) => {
      const [first, last] = assignments[i];
      const cluster = first === last ? this.root(initial[first]) : this.merge(initial.slice(first, last + 1));
      const localGlyph = Object.create(glyph);
      localGlyph.cluster = cluster;
      cluster.glyphs.push({ glyph: localGlyph, position: null });
    });
  }

  root(cluster) {
    while (cluster && cluster.parent) cluster = cluster.parent;
    return cluster;
  }

  merge(clusters) {
    if (!clusters.length || clusters.some(cluster => !cluster)) return null;
    const indices = clusters.map(cluster => this.clusters.indexOf(this.root(cluster)));
    if (indices.some(index => index < 0)) return null;
    const first = Math.min(...indices), last = Math.max(...indices);
    const merged = this.clusters[first];
    for (const cluster of this.clusters.slice(first + 1, last + 1)) {
      merged.sourceText += cluster.sourceText;
      merged.glyphs.push(...cluster.glyphs);
      cluster.parent = merged;
    }
    this.clusters.splice(first + 1, last - first);
    return merged;
  }

  glyphs() {
    const glyphs = [];
    for (const cluster of this.clusters) for (const item of cluster.glyphs) glyphs.push(item.glyph);
    return glyphs;
  }

  updateGlyphs(glyphs) {
    if (glyphs.some(glyph => !glyph.cluster)) this.merge(this.clusters.slice());
    for (const cluster of this.clusters) cluster.glyphs = [];
    for (const glyph of glyphs) {
      const cluster = this.root(glyph.cluster) || this.clusters[0];
      cluster.glyphs.push({ glyph, position: null });
    }
  }

  finish(glyphs, positions) {
    // Unknown provenance and omitted clusters cannot safely be separated.
    if (glyphs.some(glyph => !glyph.cluster)) this.merge(this.clusters.slice());
    const occupied = new Set(glyphs.map(glyph => this.root(glyph.cluster) || this.clusters[0]));
    for (let i = 0; i < this.clusters.length && this.clusters.length > 1;) {
      const cluster = this.clusters[i];
      if (!occupied.has(cluster)) {
        const adjacent = this.clusters.slice(i ? i - 1 : i, i ? i + 1 : i + 2);
        const hasGlyphs = adjacent.some(item => occupied.has(item));
        const merged = this.merge(adjacent);
        if (hasGlyphs) occupied.add(merged);
        if (i) i--;
      } else i++;
    }

    // If visual order interleaves clusters, merge the entire logical interval.
    let changed = true;
    while (changed) {
      changed = false;
      const roots = glyphs.map(glyph => this.root(glyph.cluster) || this.clusters[0]);
      const bounds = new Map();
      roots.forEach((root, index) => {
        const item = bounds.get(root);
        if (item) { item.last = index; item.count++; }
        else bounds.set(root, { first: index, last: index, count: 1 });
      });
      for (const { first, last, count } of bounds.values()) {
        if (last - first + 1 !== count) {
          this.merge(roots.slice(first, last + 1));
          changed = true;
          break;
        }
      }
    }
    const output = [];
    glyphs.forEach((glyph, i) => {
      const cluster = this.root(glyph.cluster) || this.clusters[0];
      let result = output[output.length - 1];
      if (!result || result.cluster !== cluster) output.push(result = { cluster, sourceText: cluster.sourceText, glyphs: [] });
      delete glyph.cluster;
      result.glyphs.push({ glyph, position: positions[i] });
    });
    if (!glyphs.length && this.clusters.length) output.push({ sourceText: this.clusters[0].sourceText, glyphs: [] });
    this.clusters.splice(0, this.clusters.length, ...output.map(({ sourceText, glyphs: items }) => ({ sourceText, glyphs: items })));
  }
}

export function mergeGlyphClusters(glyphs) {
  const clusters = glyphs.map(glyph => glyph.cluster);
  if (!clusters.length || clusters.some(cluster => !cluster)) return null;
  return clusters[0].owner.merge(clusters);
}
