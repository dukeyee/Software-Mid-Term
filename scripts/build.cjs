const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const name of ['index.html', 'styles.css', 'core.js', 'app.js']) {
  fs.copyFileSync(path.join(root, 'web', name), path.join(root, 'dist', name));
}
console.log('Static site built in dist/');
