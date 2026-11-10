import './addTestHelpersToFontkit';
import fontkit from '../src';
import assert from 'assert';
import concat from 'concat-stream';
import CFFFont from '../src/cff/CFFFont';
import r from 'restructure';
import CFFGlyph from '../src/glyph/CFFGlyph';
import fs from 'fs';

describe('font subsetting', function() {
  describe('truetype subsetting', function() {
    let font = fontkit.openSync(__dirname + '/data/OpenSans/OpenSans-Regular.ttf');

    it('should create a TTFSubset instance', function() {
      let subset = font.createSubset();
      assert.equal(subset.constructor.name, 'TTFSubset');
    });

    it('should produce a subset', function(done) {
      let subset = font.createSubset();
      for (let glyph of font.glyphsForString('hello')) {
        subset.includeGlyph(glyph);
      }

      subset.encodeStream().pipe(concat(function(buf) {
        let f = fontkit.create(buf);
        assert.equal(f.numGlyphs, 5);
        assert.equal(f.getGlyph(1).path.toSVG(), font.glyphsForString('h')[0].path.toSVG());
        done();
      }));
    });

    it('should re-encode variation glyphs', function(done) {
      if (!fs.existsSync('/Library/Fonts/Skia.ttf')) return done();

      let font = fontkit.openSync('/Library/Fonts/Skia.ttf', 'Bold');
      let subset = font.createSubset();
      for (let glyph of font.glyphsForString('e')) {
        subset.includeGlyph(glyph);
      }

      subset.encodeStream().pipe(concat(function(buf) {
        let f = fontkit.create(buf);
        assert.equal(f.getGlyph(1).path.toSVG(), font.glyphsForString('e')[0].path.toSVG());
        done();
      }));
    });

    it('should handle composite glyphs', function(done) {
      let subset = font.createSubset();
      subset.includeGlyph(font.glyphsForString('é')[0]);

      subset.encodeStream().pipe(concat(function(buf) {
        let f = fontkit.create(buf);
        assert.equal(f.numGlyphs, 4);
        assert.equal(f.getGlyph(1).path.toSVG(), font.glyphsForString('é')[0].path.toSVG());
        done();
      }));
    });
  });

  describe('CFF subsetting', function() {
    let font = fontkit.openSync(__dirname + '/data/SourceSansPro/SourceSansPro-Regular.otf');

    it('should create a CFFSubset instance', function() {
      let subset = font.createSubset();
      return assert.equal(subset.constructor.name, 'CFFSubset');
    });

    it('should produce a subset', function(done) {
      let subset = font.createSubset();
      let iterable = font.glyphsForString('hello');
      for (let i = 0; i < iterable.length; i++) {
        let glyph = iterable[i];
        subset.includeGlyph(glyph);
      }

      return subset.encodeStream().pipe(concat(function(buf) {
        let stream = new r.DecodeStream(buf);
        let cff = new CFFFont(stream);
        let glyph = new CFFGlyph(1, [], { stream, 'CFF ': cff });
        assert.equal(glyph.path.toSVG(), font.glyphsForString('h')[0].path.toSVG());
        return done();
      }));
    });

    it('should handle CID fonts', function(done) {
      let f = fontkit.openSync(__dirname + '/data/NotoSansCJK/NotoSansCJKkr-Regular.otf');
      let subset = f.createSubset();
      let iterable = f.glyphsForString('갈휸');
      for (let i = 0; i < iterable.length; i++) {
        let glyph = iterable[i];
        subset.includeGlyph(glyph);
      }

      return subset.encodeStream().pipe(concat(function(buf) {
        let stream = new r.DecodeStream(buf);
        let cff = new CFFFont(stream);
        let glyph = new CFFGlyph(1, [], { stream, 'CFF ': cff });
        assert.equal(glyph.path.toSVG(), f.glyphsForString('갈')[0].path.toSVG());
        assert.equal(cff.topDict.FDArray.length, 2);
        assert.deepEqual(cff.topDict.FDSelect.fds, [0, 1, 1]);
        return done();
      }));
    });

    it('preserves CID font dictionaries and outlines when a dictionary is reused', function(done) {
      const font = fontkit.openSync(__dirname + '/data/NotoSansCJK/NotoSansCJKkr-Regular.otf');
      const glyphs = font.layout('（あ）', [], null, null, 'ttb').clusters
        .flatMap(cluster => cluster.glyphs.map(item => item.glyph));
      const originalFDs = glyphs.map(glyph => font['CFF '].fdForGlyph(glyph.id));
      assert.equal(originalFDs[0], originalFDs[2]);
      assert.notEqual(originalFDs[0], originalFDs[1]);
      const subset = font.createSubset();
      glyphs.forEach(glyph => subset.includeGlyph(glyph));

      subset.encodeStream().pipe(concat(function(buf) {
        const stream = new r.DecodeStream(buf);
        const cff = new CFFFont(stream);
        const subsetFDs = glyphs.map((_, index) => cff.fdForGlyph(index + 1));
        assert.equal(subsetFDs[0], subsetFDs[2]);
        assert.notEqual(subsetFDs[0], subsetFDs[1]);
        glyphs.forEach((glyph, index) => {
          const subsetGlyph = new CFFGlyph(index + 1, [], { stream, 'CFF ': cff });
          assert.equal(subsetGlyph.path.toSVG(), glyph.path.toSVG());
        });
        done();
      }));
    });
  });
});
