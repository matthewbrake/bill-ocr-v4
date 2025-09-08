require('dotenv').config();
const esbuild = require('esbuild');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

esbuild.build({
  entryPoints: ['index.tsx'],
  bundle: true,
  outfile: 'dist/index.js',
  sourcemap: !isProduction,
  minify: isProduction,
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env.FORMSPREE_FORM_ID': JSON.stringify(process.env.FORMSPREE_FORM_ID || ''),
  },
  loader: { '.ts': 'ts', '.tsx': 'tsx' },
  jsx: 'automatic',
}).catch(() => process.exit(1));

// Also copy index.html to dist
const fs = require('fs');
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}
fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(__dirname, 'dist', 'index.html'));

console.log('Build successful!');
