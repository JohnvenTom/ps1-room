// Assembles the final zero-network single-file index.html
const fs = require('fs');
const path = require('path');
const root = __dirname;

const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
const three = fs.readFileSync(path.join(root, 'vendor/three.min.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

for (const [name, src] of [['three.min.js', three], ['app.js', app]]) {
  if (src.includes('</script')) throw new Error(`${name} contains </script>, unsafe to inline`);
}

const out = tpl
  .replace('/*__THREE__*/', () => '\n' + three + '\n')
  .replace('/*__APP__*/', () => '\n' + app + '\n');

fs.writeFileSync(path.join(root, 'index.html'), out);
console.log('index.html written:', (fs.statSync(path.join(root, 'index.html')).size / 1024).toFixed(1) + ' KB');
