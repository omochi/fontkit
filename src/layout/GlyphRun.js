import BBox from '../glyph/BBox';

/** The public result of shaping: clusters in glyph drawing order. */
export default class GlyphRun {
  constructor(clusters, state) {
    this.clusters = clusters;
    this.script = state.script;
    this.language = state.language;
    this.direction = state.direction;
    this.features = state.features;
  }

  get advanceWidth() {
    let result = 0;
    for (const cluster of this.clusters) for (const item of cluster.glyphs) result += item.position.xAdvance;
    return result;
  }

  get advanceHeight() {
    let result = 0;
    for (const cluster of this.clusters) for (const item of cluster.glyphs) result += item.position.yAdvance;
    return result;
  }

  get bbox() {
    const bbox = new BBox;
    let x = 0, y = 0;
    for (const cluster of this.clusters) for (const { glyph, position } of cluster.glyphs) {
      const b = glyph.bbox;
      bbox.addPoint(b.minX + x + position.xOffset, b.minY + y + position.yOffset);
      bbox.addPoint(b.maxX + x + position.xOffset, b.maxY + y + position.yOffset);
      x += position.xAdvance;
      y += position.yAdvance;
    }
    return bbox;
  }
}
