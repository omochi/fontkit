import ShapingPlan from './ShapingPlan';
import * as Shapers from './shapers';
import GlyphInfo from './GlyphInfo';
import GSUBProcessor from './GSUBProcessor';
import GPOSProcessor from './GPOSProcessor';

export default class OTLayoutEngine {
  constructor(font) {
    this.font = font;
    this.glyphInfos = null;
    this.plan = null;
    this.GSUBProcessor = null;
    this.GPOSProcessor = null;
    this.fallbackPosition = true;

    if (font.GSUB) {
      this.GSUBProcessor = new GSUBProcessor(font, font.GSUB);
    }

    if (font.GPOS) {
      this.GPOSProcessor = new GPOSProcessor(font, font.GPOS);
    }
  }

  setup(glyphRun, glyphs) {
    // Map glyphs to GlyphInfo objects so data can be passed between
    // GSUB and GPOS without mutating the real (shared) Glyph objects.
    this.glyphInfos = glyphs.map(glyph =>
      new GlyphInfo(this.font, glyph.id, [...glyph.codePoints], undefined, glyph.cluster)
    );

    // Select a script based on what is available in GSUB/GPOS.
    let script = null;
    if (this.GPOSProcessor) {
      script = this.GPOSProcessor.selectScript(glyphRun.script, glyphRun.language, glyphRun.direction);
    }

    if (this.GSUBProcessor) {
      script = this.GSUBProcessor.selectScript(glyphRun.script, glyphRun.language, glyphRun.direction);
    }

    // Choose a shaper based on the script, and setup a shaping plan.
    // This determines which features to apply to which glyphs.
    this.shaper = Shapers.choose(script);
    this.plan = new ShapingPlan(this.font, script, glyphRun.direction);
    this.shaper.plan(this.plan, this.glyphInfos, glyphRun.features);

    // Assign chosen features to output glyph run
    for (let key in this.plan.allFeatures) {
      glyphRun.features[key] = true;
    }
  }

  substitute(glyphRun, glyphs) {
    if (this.GSUBProcessor) {
      this.plan.process(this.GSUBProcessor, this.glyphInfos);

      // Map glyph infos back to normal Glyph objects
      glyphs = this.glyphInfos.map(glyphInfo => {
        const glyph = Object.create(this.font.getGlyph(glyphInfo.id, glyphInfo.codePoints));
        glyph.cluster = glyphInfo.cluster;
        return glyph;
      });
    }
    return glyphs;
  }

  position(glyphRun, glyphs, positions) {
    if (this.shaper.zeroMarkWidths === 'BEFORE_GPOS') {
      this.zeroMarkAdvances(positions);
    }

    if (this.GPOSProcessor) {
      this.plan.process(this.GPOSProcessor, this.glyphInfos, positions);
    }

    if (this.shaper.zeroMarkWidths === 'AFTER_GPOS') {
      this.zeroMarkAdvances(positions);
    }

    // Reverse the glyphs and positions if the script is right-to-left
    if (glyphRun.direction === 'rtl') {
      glyphs.reverse();
      positions.reverse();
    }

    return this.GPOSProcessor && this.GPOSProcessor.features;
  }

  zeroMarkAdvances(positions) {
    for (let i = 0; i < this.glyphInfos.length; i++) {
      if (this.glyphInfos[i].isMark) {
        positions[i].xAdvance = 0;
        positions[i].yAdvance = 0;
      }
    }
  }

  cleanup() {
    this.glyphInfos = null;
    this.plan = null;
    this.shaper = null;
  }

  getAvailableFeatures(script, language) {
    let features = [];

    if (this.GSUBProcessor) {
      this.GSUBProcessor.selectScript(script, language);
      features.push(...Object.keys(this.GSUBProcessor.features));
    }

    if (this.GPOSProcessor) {
      this.GPOSProcessor.selectScript(script, language);
      features.push(...Object.keys(this.GPOSProcessor.features));
    }

    return features;
  }
}
