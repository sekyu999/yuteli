// 英訳漏れの検出
// ・画面の文字は '…' か "…" の文字列にして t() に渡す（テンプレート文字列 `…` に日本語を直接書かない）
// ・日本語を含む文字列は、すべて英語の対応表（js/i18n/en/*.js）にあること
// 例外にしたい行には // i18n-ignore と書く（開発者向けのログなど）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN } from '../js/i18n/en.js';

import { FILES, check } from '../tools/i18n-check.mjs';
const JP = /[\u3040-\u30ff\u3400-\u9fff\uff01-\uff60]/;

test('画面の日本語はすべて英訳がある・テンプレートに日本語を直接書いていない', () => {
  const missing = [];
  const raw = [];
  for (const f of FILES) {
    const r = check(f);
    missing.push(...r.missing);
    raw.push(...r.raw);
  }
  assert.deepEqual(raw, [], `テンプレート文字列などに日本語が直接書かれている：\n${raw.join('\n')}`);
  assert.deepEqual(missing, [], `英訳がない：\n${missing.join('\n')}`);
});

test('英訳に {name} などの差し込みが日本語と同じだけある', () => {
  const bad = [];
  for (const [ja, en] of Object.entries(EN)) {
    const a = [...ja.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const b = [...String(en).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    if (a !== b) bad.push(`${ja} → ${en}`);
  }
  assert.deepEqual(bad, []);
});

test('食材提案の英語版は日本語版と同じ項目・食材番号', async () => {
  const ja = (await import('../js/content/healthRecommendations.js')).HEALTH_RECOMMENDATIONS;
  const en = (await import('../js/content/healthRecommendations.en.js')).HEALTH_RECOMMENDATIONS;
  assert.deepEqual(
    en.map((r) => [r.id, r.foods.map((f) => f.code)]),
    ja.map((r) => [r.id, r.foods.map((f) => f.code)])
  );
  for (const r of en) for (const f of r.foods) assert.ok(!JP.test(f.name + f.point + f.howTo), `${r.id} ${f.name}`);
});
