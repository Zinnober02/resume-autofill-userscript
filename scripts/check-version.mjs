// 打 tag 发版前先确认 tag 与 package.json 里的版本一致
import { readFile } from 'node:fs/promises';

const tag = process.argv[2] || '';
const version = tag.replace(/^v/, '');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (!version) {
  console.error('用法：node scripts/check-version.mjs v1.2.3');
  process.exit(1);
}
if (version !== pkg.version) {
  console.error('tag ' + tag + ' 与 package.json 里的版本 ' + pkg.version + ' 不一致');
  process.exit(1);
}
console.log('版本一致：' + pkg.version);
