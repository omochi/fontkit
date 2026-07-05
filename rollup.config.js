import babel from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
// import { plugin as analyze } from 'rollup-plugin-analyzer';
// import visualizer from 'rollup-plugin-visualizer';

const { UGLIFY, MODULE_TYPE } = process.env;
const nodeBuiltins = ['buffer', 'stream', 'string_decoder', 'util'];

export default {
  input: 'src/index.js',
  output: {
    name: 'fontkit',
    format: MODULE_TYPE,
    strict: false,
    globals: {
      buffer: 'buffer',
      stream: 'stream',
      string_decoder: 'string_decoder',
      util: 'util',
    },
  },
  external:
    MODULE_TYPE === 'esm'
      ? ['pako', ...nodeBuiltins] // pdf-lib will provide pako for us
      : nodeBuiltins,
  plugins: [
    // analyze(),
    // visualizer({
    //   // sourcemap: true,
    //   open: true,
    // }),
    nodeResolve({
      jsnext: true,
      preferBuiltins: true,
    }),
    commonjs({
      exclude: 'src/**',
      ignore: ['iconv-lite'],
      namedExports: {
        'node_modules/unicode-trie/index.js': ['default'],
      },
    }),
    json(),
    babel({
      babelrc: false,
      presets: [['@babel/preset-env', { modules: false, loose: true }]],
      plugins: [
        ['@babel/plugin-proposal-decorators', { legacy: true }],
        ['@babel/plugin-proposal-class-properties'],
      ],
      babelHelpers: 'inline',
    }),
    UGLIFY === 'true' && terser(),
  ],
};
