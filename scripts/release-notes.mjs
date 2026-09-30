// 从 CHANGELOG.md 里取出某个版本的段落，作为 Release 的说明
import { readFile } from 'node:fs/promises';

const tag = process.argv[2] || '';
const version = tag.replace(/^v/, '');
const lines = (await readFile('CHANGELOG.md', 'utf8')).split('\n');
const start = lines.findIndex((line) => line.trim() === '## ' + version);
if (start < 0) {
  console.log('CHANGELOG.md 里没有 ' + version + ' 的记录。');
  process.exit(0);
}
let end = lines.length;
for (let i = start + 1; i < lines.length; i += 1) {
  if (lines[i].startsWith('## ')) { end = i; break; }
}
console.log(lines.slice(start + 1, end).join('\n').trim());
