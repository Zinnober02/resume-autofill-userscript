// 把 src/ 下的模块打包成 dist/ 里的单文件油猴脚本
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const repositoryUrl = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
const rawUrl = repositoryUrl.replace('https://github.com/', 'https://raw.githubusercontent.com/')
  + '/main/dist/resume-autofill.user.js';

const meta = (await readFile(path.join(root, 'src/userscript.meta.txt'), 'utf8'))
  .replaceAll('{{VERSION}}', pkg.version)
  .replaceAll('{{REPOSITORY_URL}}', repositoryUrl)
  .replaceAll('{{RAW_URL}}', rawUrl)
  .trimEnd();

const outfile = path.join(root, 'dist/resume-autofill.user.js');
await mkdir(path.dirname(outfile), { recursive: true });
await build({
  entryPoints: [path.join(root, 'src/main.js')],
  outfile,
  bundle: true,
  format: 'iife',
  target: ['chrome100', 'firefox102', 'safari15'],
  charset: 'utf8',
  legalComments: 'none',
  banner: { js: meta + '\n\n' + '"use strict";' },
});
await writeFile(outfile, (await readFile(outfile, 'utf8')).trimEnd() + '\n');
console.log('已生成 dist/resume-autofill.user.js');
