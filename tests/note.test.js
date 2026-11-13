import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNote, toEditBlocks, fromEditBlocks, lineToBlock, shortcutFor } from '../js/domain/note.js';

test('目標：Notion から貼り付けた文をブロックに分ける', () => {
  const b = parseNote('# Goal\n\n* [ ] ~~韓国旅行~~\n- [x] 睡眠トラッキング\n美\n- 箇条書き');
  assert.deepEqual(
    b.map((x) => x.type),
    ['heading', 'blank', 'todo', 'todo', 'text', 'bullet']
  );
  assert.equal(b[0].level, 1);
  assert.deepEqual(b[2], { type: 'todo', checked: false, text: '~~韓国旅行~~', month: null, line: 2 });
  assert.equal(b[3].checked, true);
});

test('目標：やる月', () => {
  const b = parseNote('- [ ] 韓国旅行 @2027-03\n- [ ] 焼肉 @2027-13');
  assert.equal(b[0].month, '2027-03');
  assert.equal(b[0].text, '韓国旅行');
  assert.equal(b[1].month, null);
});

test('目標：編集ブロックとの変換（行全体の打ち消し・空行・やる月）', () => {
  const blocks = toEditBlocks('\n# Goal\n\n\n* [ ] ~~韓国旅行~~ @2027-03\n- [x] 睡眠\n~~尊敬~~\n一部~~だけ~~\n\n');
  assert.deepEqual(blocks, [
    { type: 'heading', level: 1, strike: false, text: 'Goal' },
    { type: 'text', strike: false, text: '' },
    { type: 'todo', checked: false, month: '2027-03', strike: true, text: '韓国旅行' },
    { type: 'todo', checked: true, month: null, strike: false, text: '睡眠' },
    { type: 'text', strike: true, text: '尊敬' },
    { type: 'text', strike: false, text: '一部~~だけ~~' },
  ]);
  assert.equal(fromEditBlocks(blocks), '# Goal\n\n- [ ] ~~韓国旅行~~ @2027-03\n- [x] 睡眠\n~~尊敬~~\n一部~~だけ~~');
  assert.deepEqual(toEditBlocks(''), [{ type: 'text', strike: false, text: '' }]);
  assert.equal(lineToBlock('- 箇条').type, 'bullet');
  assert.equal(fromEditBlocks([{ type: 'heading', level: 2, strike: false, text: '美' }]), '## 美');
});

test('目標：書きながらの記号の変換', () => {
  assert.deepEqual(shortcutFor({ type: 'text', text: '## 美' }), { type: 'heading', level: 2, text: '美' });
  assert.deepEqual(shortcutFor({ type: 'text', text: '[] 旅行' }), { type: 'todo', checked: false, month: null, text: '旅行' });
  assert.deepEqual(shortcutFor({ type: 'text', text: '- [ ] ' }), { type: 'todo', checked: false, month: null, text: '' });
  assert.deepEqual(shortcutFor({ type: 'text', text: '- ' }), { type: 'bullet', text: '' });
  assert.deepEqual(shortcutFor({ type: 'bullet', text: '[ ] a' }), { type: 'todo', checked: false, month: null, text: 'a' });
  assert.equal(shortcutFor({ type: 'text', text: '#見出しではない' }), null);
  assert.equal(shortcutFor({ type: 'heading', text: '# a' }), null);
});
