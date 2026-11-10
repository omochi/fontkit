import BBox from '../glyph/BBox';
import * as Script from './Script';

/** The public result of shaping: clusters in glyph drawing order. */
export default class GlyphRun {
  constructor(clusters, features, script, language, direction) {
    this.clusters = clusters;
    this.script = script;
    this.language = language || null;
    this.direction = direction || Script.direction(script);
    this.features = {};
    if (Array.isArray(features)) {
      for (const tag of features) this.features[tag] = true;
    } else if (features && typeof features === 'object') {
      this.features = features;
    }
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
