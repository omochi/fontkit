/**
 * Build self-contained clusters in glyph drawing order. Source intervals and
 * glyph intervals are coalesced until neither overlaps another cluster.
 * Missing provenance is handled conservatively by keeping the run together.
 */
export function buildGlyphClusters(text, glyphs, positions, ranges) {
  const positioned = indices => indices.map(i => ({ glyph: glyphs[i], position: positions[i] }));
  const wholeRun = () => [{ sourceText: typeof text === 'string' ? text : '', glyphs: positioned(glyphs.map((_, i) => i)) }];
  if (typeof text !== 'string') return wholeRun();
  if (text.length === 0 && glyphs.length === 0) return [];
  if (!glyphs.length || (typeof Intl === 'undefined' || !Intl.Segmenter) || ranges.some(range => !range || range.start < 0 || range.end > text.length || range.start >= range.end)) return wholeRun();

  let groups = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), part => ({
    start: part.index, end: part.index + part.segment.length
  }));
  if (!groups.length) return wholeRun();

  // Merge source segments touched by a glyph, including marks skipped by a ligature.
  for (const range of ranges) {
    const first = groups.findIndex(group => group.end > range.start);
    const last = groups.findIndex(group => group.end >= range.end);
    if (first < 0 || last < first || range.start < groups[first].start) return wholeRun();
    if (last > first) groups.splice(first, last - first + 1, { start: groups[first].start, end: groups[last].end });
  }

  while (true) {
    const members = groups.map(group => []);
    for (let i = 0; i < ranges.length; i++) {
      const index = groups.findIndex(group => group.start <= ranges[i].start && ranges[i].end <= group.end);
      if (index < 0) return wholeRun();
      members[index].push(i);
    }
    // Include source text with no output glyph in an adjacent cluster.
    const empty = members.findIndex(indices => !indices.length);
    if (empty >= 0 && groups.length > 1) {
      const left = empty ? empty - 1 : empty;
      groups.splice(left, 2, { start: groups[left].start, end: groups[left + 1].end });
      continue;
    }
    // Interleaving in drawing order means there is no safe boundary between
    // those clusters. Merge their complete source interval and try again.
    let merged = false;
    for (let g = 0; g < groups.length && !merged; g++) {
      const indices = members[g];
      if (!indices.length) continue;
      const firstGlyph = indices[0], lastGlyph = indices[indices.length - 1];
      if (lastGlyph - firstGlyph + 1 === indices.length) continue;
      let lo = g, hi = g;
      for (let other = 0; other < groups.length; other++) {
        if (members[other].some(i => firstGlyph < i && i < lastGlyph)) {
          lo = Math.min(lo, other); hi = Math.max(hi, other);
        }
      }
      groups.splice(lo, hi - lo + 1, { start: groups[lo].start, end: groups[hi].end });
      merged = true;
    }
    if (merged) continue;
    return groups.map((group, i) => ({
      sourceText: text.slice(group.start, group.end), glyphs: positioned(members[i]), firstGlyph: members[i][0]
    })).sort((a, b) => a.firstGlyph - b.firstGlyph).map(({ sourceText, glyphs: items }) => ({ sourceText, glyphs: items }));
  }
}
