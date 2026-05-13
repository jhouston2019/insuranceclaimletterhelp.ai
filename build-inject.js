const fs = require('fs');
const path = require('path');

if (!fs.existsSync('dist')) fs.mkdirSync('dist');

// Copy everything except claim-defense.html, dist, node_modules, .git
const skip = new Set(['dist', 'node_modules', '.git', 'build-inject.js']);
for (const item of fs.readdirSync('.')) {
  if (skip.has(item) || item === 'claim-defense.html') continue;
  fs.cpSync(item, path.join('dist', item), { recursive: true });
}

// Process and write claim-defense.html with env var substitution
let html = fs.readFileSync('claim-defense.html', 'utf8');
html = html.replace('SUPABASE_URL_PLACEHOLDER', process.env.SUPABASE_URL || '');
html = html.replace('SUPABASE_ANON_KEY_PLACEHOLDER', process.env.SUPABASE_ANON_KEY || '');
fs.writeFileSync('dist/claim-defense.html', html);
