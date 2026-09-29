// Assembles the final zero-network single-file index.html
const fs = require('fs');
const path = require('path');
const root = __dirname;

const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
const three = fs.readFileSync(path.join(root, 'vendor/three.min.js'), 'utf8');

// app core first (defines window.PS1), then scene modules (register builders),
// then main.js which boots once everything is registered.
const appParts = [
  path.join(root, 'src/app.js'),
  path.join(root, 'src/scenes/room.js'),
  path.join(root, 'src/scenes/shrine.js'),
  path.join(root, 'src/scenes/town.js'),
  path.join(root, 'src/scenes/market.js'),
  path.join(root, 'src/scenes/cyber.js'),
  path.join(root, 'src/scenes/snow.js'),
  path.join(root, 'src/scenes/desert.js'),
  path.join(root, 'src/scenes/watertown.js'),
  path.join(root, 'src/scenes/space.js'),
  path.join(root, 'src/main.js')
];
const app = appParts
  .map((p) => fs.readFileSync(p, 'utf8'))
  .join('\n;\n');

for (const [name, src] of [['three.min.js', three], ['app bundle', app]]) {
  if (src.includes('</script')) throw new Error(`${name} contains </script>, unsafe to inline`);
}

const out = tpl
  .replace('/*__THREE__*/', () => '\n' + three + '\n')
  .replace('/*__APP__*/', () => '\n' + app + '\n');

fs.writeFileSync(path.join(root, 'index.html'), out);
console.log('index.html written:', (fs.statSync(path.join(root, 'index.html')).size / 1024).toFixed(1) + ' KB');
