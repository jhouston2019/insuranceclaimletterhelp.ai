import fs from 'fs';
import path from 'path';

if (!fs.existsSync('dist')) fs.mkdirSync('dist');

const skip = new Set([
  'dist',
  'node_modules',
  '.git',
  'build-inject.js',
  'claim-defense.html',
  'signup.html',
  'login.html',
]);
for (const item of fs.readdirSync('.')) {
  if (skip.has(item)) continue;
  fs.cpSync(item, path.join('dist', item), { recursive: true });
}

let html = fs.readFileSync('claim-defense.html', 'utf8');
html = html.replace('SUPABASE_URL_PLACEHOLDER', process.env.VITE_SUPABASE_URL || '');
html = html.replace('SUPABASE_ANON_KEY_PLACEHOLDER', process.env.VITE_SUPABASE_ANON_KEY || '');
fs.writeFileSync('dist/claim-defense.html', html);

let signupHtml = fs.readFileSync('signup.html', 'utf8');
signupHtml = signupHtml.replace('SUPABASE_URL_PLACEHOLDER', process.env.VITE_SUPABASE_URL || '');
signupHtml = signupHtml.replace('SUPABASE_ANON_KEY_PLACEHOLDER', process.env.VITE_SUPABASE_ANON_KEY || '');
fs.writeFileSync('dist/signup.html', signupHtml);

let loginHtml = fs.readFileSync('login.html', 'utf8');
loginHtml = loginHtml.replace('SUPABASE_URL_PLACEHOLDER', process.env.VITE_SUPABASE_URL || '');
loginHtml = loginHtml.replace('SUPABASE_ANON_KEY_PLACEHOLDER', process.env.VITE_SUPABASE_ANON_KEY || '');
fs.writeFileSync('dist/login.html', loginHtml);
