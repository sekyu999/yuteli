import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNote, parseInline, toggleTodo, toggleLinePrefix, toggleStrike, setTodoMonth } from '../js/domain/note.js';

test('目標メモ：Notion から貼り付けた文をブロックに分ける', () => {
  const b = parseNote('# Goal\n\n* [ ] ~~韓国旅行~~\n- [x] 睡眠トラッキング\n美\n- 箇条書き');
  assert.deepEqual(
    b.map((x) => x.type),
    ['heading', 'blank', 'todo', 'todo', 'text', 'bullet']
  );
  assert.equal(b[0].level, 1);
  assert.deepEqual(b[2], { type: 'todo', checked: false, text: '~~韓国旅行~~', month: null, line: 2 });
  assert.equal(b[3].checked, true);
});

test('目標メモ：打ち消し・太字', () => {
  assert.deepEqual(parseInline('a~~b~~c'), [
    { text: 'a', strike: false, bold: false },
    { text: 'b', strike: true, bold: false },
    { text: 'c', strike: false, bold: false },
  ]);
  assert.deepEqual(parseInline('**x**'), [{ text: 'x', strike: false, bold: true }]);
  assert.deepEqual(parseInline('~~ab'), [{ text: '~~ab', strike: false, bold: false }]);
});

test('目標メモ：ToDo のチェックを切り替える', () => {
  const s = '# G\n* [ ] 旅行\n- [x] 料理';
  assert.equal(toggleTodo(s, 1), '# G\n* [x] 旅行\n- [x] 料理');
  assert.equal(toggleTodo(s, 2), '# G\n* [ ] 旅行\n- [ ] 料理');
  assert.equal(toggleTodo(s, 0), s);
});

test('目標メモ：見出し・ToDo の付け外し', () => {
  assert.equal(toggleLinePrefix('美', 'heading'), '# 美');
  assert.equal(toggleLinePrefix('# 美', 'heading'), '美');
  assert.equal(toggleLinePrefix('- [ ] 旅行', 'heading'), '# 旅行');
  assert.equal(toggleLinePrefix('旅行', 'todo'), '- [ ] 旅行');
  assert.equal(toggleLinePrefix('- [x] 旅行', 'todo'), '旅行');
});

test('目標メモ：打ち消しの付け外し', () => {
  // 選択なし → カーソルの行（記号を除く）
  assert.equal(toggleStrike('a\n- [ ] 旅行\nb', 5, 5).text, 'a\n- [ ] ~~旅行~~\nb');
  assert.equal(toggleStrike('- [ ] ~~旅行~~', 3, 3).text, '- [ ] 旅行');
  // 選択あり
  const r = toggleStrike('abcd', 1, 3);
  assert.deepEqual(r, { text: 'a~~bc~~d', start: 1, end: 7 });
  assert.equal(toggleStrike('a~~bc~~d', 3, 5).text, 'abcd');
  // 空行は何もしない
  assert.equal(toggleStrike('a\n\nb', 2, 2).text, 'a\n\nb');
});

test('目標メモ：ToDo のやる月', () => {
  const b = parseNote('- [ ] 韓国旅行 @2027-03\n- [ ] 焼肉 @2027-13');
  assert.equal(b[0].month, '2027-03');
  assert.equal(b[0].text, '韓国旅行');
  assert.equal(b[1].month, null);
  assert.equal(setTodoMonth('- [ ] 旅行', 0, '2026-12'), '- [ ] 旅行 @2026-12');
  assert.equal(setTodoMonth('- [ ] 旅行 @2026-12', 0, '2027-01'), '- [ ] 旅行 @2027-01');
  assert.equal(setTodoMonth('- [ ] 旅行 @2026-12', 0, null), '- [ ] 旅行');
  assert.equal(setTodoMonth('本文', 0, '2026-12'), '本文');
  // 打ち消しは月の手前まで
  assert.equal(toggleStrike('- [ ] 旅行 @2026-12', 7, 7).text, '- [ ] ~~旅行~~ @2026-12');
});
