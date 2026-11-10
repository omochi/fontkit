// Helpers for checking existing glyph/position expectations against clusters.
export default function flattenRun(run) {
  const items = run.clusters.reduce((result, cluster) => result.concat(cluster.glyphs), []);
  return { glyphs: items.map(item => item.glyph), positions: items.map(item => item.position) };
}
