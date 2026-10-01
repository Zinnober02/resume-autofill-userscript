// 有些下拉的选项内容本身就说明了字段类型：一对「男 / 女」就是性别，
// 「未婚 / 已婚 / 离异」就是婚姻状况。标签取不到时拿它兜底
import { norm } from './rules.js';

// 只收互斥性高的枚举：选项之间不会互相串门，猜错了代价也小
const ENUMS = [
  { key: 'gender', labels: ['男', '女'], min: 2 },
  { key: 'maritalStatus', labels: ['未婚', '已婚', '离异', '丧偶'], min: 2 },
  { key: 'politicalStatus', labels: ['中共党员', '共青团员', '民主党派', '群众', '预备党员'], min: 2 },
  { key: 'hukouType', labels: ['农业户口', '非农业户口', '居民户口', '城镇户口'], min: 2 },
];

export function optionsKeyOf(node) {
  if (!node || node.tagName !== 'SELECT' || !node.options) return '';
  const texts = [];
  for (let i = 0; i < node.options.length; i += 1) {
    const t = norm(node.options[i].textContent);
    if (t && t !== '请选择') texts.push(t);
  }
  if (texts.length < 2) return '';
  let best = '';
  let bestHits = 1;
  ENUMS.forEach((spec) => {
    let hits = 0;
    spec.labels.forEach((label) => {
      const l = norm(label);
      if (texts.some((t) => t === l || t.indexOf(l) >= 0)) hits += 1;
    });
    if (hits >= spec.min && hits > bestHits) {
      bestHits = hits;
      best = spec.key;
    }
  });
  return best;
}
