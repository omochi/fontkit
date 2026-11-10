import KernProcessor from './KernProcessor';
import UnicodeLayoutEngine from './UnicodeLayoutEngine';
import GlyphRun from './GlyphRun';
import GlyphPosition from './GlyphPosition';
import { ShapingClusters } from './GlyphCluster';
import * as Script from './Script';
import unicode from 'unicode-properties';
import AATLayoutEngine from '../aat/AATLayoutEngine';
import OTLayoutEngine from '../opentype/OTLayoutEngine';

export default class LayoutEngine {
  constructor(font) {
    this.font = font;
    this.unicodeLayoutEngine = null;
    this.kernProcessor = null;

    // Choose an advanced layout engine. We try the AAT morx table first since more
    // scripts are currently supported because the shaping logic is built into the font.
    if (this.font.morx) {
      this.engine = new AATLayoutEngine(this.font);

    } else if (this.font.GSUB || this.font.GPOS) {
      this.engine = new OTLayoutEngine(this.font);
    }
  }

  layout(string, features, script, language, direction) {
    // Make the features parameter optional
    if (typeof features === 'string') {
      direction = language;
      language = script;
      script = features;
      features = [];
    }

    // Map string to glyphs if needed
    if (typeof string === 'string') {
      // Attempt to detect the script from the string if not provided.
      if (script == null) {
        script = Script.forString(string);
      }

      var glyphs = this.font.glyphsForString(string);
    } else {
      // Attempt to detect the script from the glyph code points if not provided.
      if (script == null) {
        let codePoints = [];
        for (let glyph of string) {
          codePoints.push(...glyph.codePoints);
        }

        script = Script.forCodePoints(codePoints);
      }

      var glyphs = string;
    }

    // Clusters own the source text from the beginning. Glyph wrappers are local
    // to this shaping operation; font glyphs themselves are shared and cached.
    const clusters = new ShapingClusters(string, glyphs);
    glyphs = clusters.glyphs();
    let glyphRun = new GlyphRun(clusters.clusters, features, script, language, direction);

    if (glyphs.length === 0) {
      clusters.finish([], []);
      return glyphRun;
    }

    // Setup the advanced layout engine
    if (this.engine && this.engine.setup) {
      this.engine.setup(glyphRun, glyphs);
    }

    // Substitute and position the glyphs
    glyphs = this.substitute(glyphRun, glyphs);
    clusters.updateGlyphs(glyphs);
    const positions = this.position(glyphRun, glyphs);
    clusters.finish(glyphs, positions);
    this.hideDefaultIgnorables(glyphRun.clusters);

    // Let the layout engine clean up any state it might have
    if (this.engine && this.engine.cleanup) {
      this.engine.cleanup();
    }

    return glyphRun;
  }

  substitute(glyphRun, glyphs) {
    if (this.engine && this.engine.substitute) {
      return this.engine.substitute(glyphRun, glyphs);
    }
    return glyphs;
  }

  position(glyphRun, glyphs) {
    // The processors use temporary flat arrays because lookups cross clusters.
    let positions = glyphs.map(glyph => {
      if (glyphRun.direction !== 'ttb') return new GlyphPosition(glyph.advanceWidth);
      const verticalOriginY = this.verticalOriginY(glyph);
      return new GlyphPosition(0, -glyph.advanceHeight, -glyph.advanceWidth / 2, -verticalOriginY);
    });
    let positioned = null;

    // Call the advanced layout engine. Returns the features applied.
    if (this.engine && this.engine.position) {
      positioned = this.engine.position(glyphRun, glyphs, positions);
    }

    // if there is no GPOS table, use unicode properties to position marks.
    if (!positioned && (!this.engine || this.engine.fallbackPosition)) {
      if (!this.unicodeLayoutEngine) {
        this.unicodeLayoutEngine = new UnicodeLayoutEngine(this.font);
      }

      this.unicodeLayoutEngine.positionGlyphs(glyphs, positions);
    }

    // if kerning is not supported by GPOS, do kerning with the TrueType/AAT kern table
    if (glyphRun.direction !== 'ttb' && (!positioned || !positioned.kern) && glyphRun.features.kern !== false && this.font.kern) {
      if (!this.kernProcessor) {
        this.kernProcessor = new KernProcessor(this.font);
      }

      this.kernProcessor.process(glyphs, positions);
      glyphRun.features.kern = true;
    }
    return positions;
  }

  verticalOriginY(glyph) {
    const vorg = this.font.VORG;
    if (vorg && (this.font.directory.tables['CFF '] || this.font.directory.tables.CFF2)) {
      const metric = vorg.metrics.find(entry => entry.glyphIndex === glyph.id);
      return metric ? metric.vertOriginY : vorg.defaultVertOriginY;
    }
    return glyph.cbox.maxY + glyph._getMetrics().topBearing;
  }

  hideDefaultIgnorables(clusters) {
    let space = this.font.glyphForCodePoint(0x20);
    for (const cluster of clusters) for (const item of cluster.glyphs) {
      if (this.isDefaultIgnorable(item.glyph.codePoints[0])) {
        item.glyph = space;
        item.position.xAdvance = 0;
        item.position.yAdvance = 0;
      }
    }
  }

  isDefaultIgnorable(ch) {
    // From DerivedCoreProperties.txt in the Unicode database,
    // minus U+115F, U+1160, U+3164 and U+FFA0, which is what
    // Harfbuzz and Uniscribe do.
    let plane = ch >> 16;
    if (plane === 0) {
      // BMP
      switch (ch >> 8) {
      	case 0x00: return ch === 0x00AD;
      	case 0x03: return ch === 0x034F;
      	case 0x06: return ch === 0x061C;
      	case 0x17: return 0x17B4 <= ch && ch <= 0x17B5;
      	case 0x18: return 0x180B <= ch && ch <= 0x180E;
      	case 0x20: return (0x200B <= ch && ch <= 0x200F) || (0x202A <= ch && ch <= 0x202E) || (0x2060 <= ch && ch <= 0x206F);
      	case 0xFE: return (0xFE00 <= ch && ch <= 0xFE0F) || ch === 0xFEFF;
      	case 0xFF: return 0xFFF0 <= ch && ch <= 0xFFF8;
      	default:   return false;
      }
    } else {
      // Other planes
      switch (plane) {
      	case 0x01: return (0x1BCA0 <= ch && ch <= 0x1BCA3) || (0x1D173 <= ch && ch <= 0x1D17A);
      	case 0x0E: return 0xE0000 <= ch && ch <= 0xE0FFF;
      	default:   return false;
      }
    }
  }

  getAvailableFeatures(script, language) {
    let features = [];

    if (this.engine) {
      features.push(...this.engine.getAvailableFeatures(script, language));
    }

    if (this.font.kern && features.indexOf('kern') === -1) {
      features.push('kern');
    }

    return features;
  }

  stringsForGlyph(gid) {
    let result = new Set;

    let codePoints = this.font._cmapProcessor.codePointsForGlyph(gid);
    for (let codePoint of codePoints) {
      result.add(String.fromCodePoint(codePoint));
    }

    if (this.engine && this.engine.stringsForGlyph) {
      for (let string of this.engine.stringsForGlyph(gid)) {
        result.add(string);
      }
    }

    return Array.from(result);
  }
}
