// 目標メモ：自分で掲げた目標・信念を書いておき、起動時に見る。他の機能とはつながらない独立した機能。
// 書き方は Notion からコピーした文と同じ（Markdown の一部）。画面や DB には依存しない純粋な関数。
//   # 見出し（## ### も可）
//   - [ ] ToDo　- [x] 済みの ToDo（- の代わりに * でも可）
//   - 箇条書き
//   ~~打ち消し~~　**太字**
//   それ以外の行は本文

/** 文字数の上限（バックアップや表示が重くならないように） */
export const NOTE_MAX = 5000;

const RE_HEADING = /^(#{1,3})\s+(.*)$/;
const RE_TODO = /^(\s*)[-*+]\s+\[( |x|X)\]\s?(.*)$/;
const RE_BULLET = /^(\s*)[-*+]\s+(.*)$/;

/**
 * @typedef {{type:'heading', level:number, text:string, line:number}
 *   | {type:'todo', checked:boolean, text:string, line:number}
 *   | {type:'bullet', text:string, line:number}
 *   | {type:'text', text:string, line:number}
 *   | {type:'blank', line:number}} NoteBlock
 */

/**
 * 文を行ごとのブロックにする（line は元の文の何行目か。ToDo のチェック切り替えに使う）
 * @returns {NoteBlock[]}
 */
export function parseNote(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((raw, line) => {
      if (!raw.trim()) return { type: 'blank', line };
      let m = raw.match(RE_HEADING);
      if (m) return { type: 'heading', level: m[1].length, text: m[2].trim(), line };
      m = raw.match(RE_TODO);
      if (m) return { type: 'todo', checked: m[2] !== ' ', text: m[3].trim(), line };
      m = raw.match(RE_BULLET);
      if (m) return { type: 'bullet', text: m[2].trim(), line };
      return { type: 'text', text: raw.trim(), line };
    });
}

/**
 * 行の中の飾り（~~打ち消し~~・**太字**）を分ける
 * @returns {Array<{text:string, strike:boolean, bold:boolean}>}
 */
export function parseInline(text) {
  const out = [];
  const re = /(~~(.+?)~~|\*\*(.+?)\*\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), strike: false, bold: false });
    if (m[2] !== undefined) {
      // 打ち消しの中の太字も見る
      for (const seg of parseInline(m[2])) out.push({ ...seg, strike: true });
    } else {
      for (const seg of parseInline(m[3])) out.push({ ...seg, bold: true });
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last), strike: false, bold: false });
  return out;
}

/** line 行目の ToDo のチェックを切り替えた文を返す（ToDo でなければそのまま） */
export function toggleTodo(text, line) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const m = lines[line]?.match(/^(\s*[-*+]\s+\[)( |x|X)(\].*)$/);
  if (!m) return text;
  lines[line] = m[1] + (m[2] === ' ' ? 'x' : ' ') + m[3];
  return lines.join('\n');
}

/**
 * 行の先頭の記号を付け外しする（編集画面の「見出し」「ToDo」ボタン用）
 * 付いていれば外し、なければ他の記号を外してから付ける
 * @param {string} line
 * @param {'heading'|'todo'} kind
 */
export function toggleLinePrefix(line, kind) {
  const body = (s) => s.replace(/^#{1,3}\s+/, '').replace(/^\s*[-*+]\s+(\[( |x|X)\]\s?)?/, '');
  if (kind === 'heading') return RE_HEADING.test(line) ? body(line) : `# ${body(line)}`;
  return RE_TODO.test(line) ? body(line) : `- [ ] ${body(line)}`;
}

/**
 * 打ち消し線の付け外し（編集画面の「打ち消し」ボタン用）
 * 選んだ文字があればそれを、なければカーソルのある行の中身（記号を除く）を ~~ ~~ で囲む／外す
 * @returns {{text:string, start:number, end:number}} 変更後の文と、選択しておく範囲
 */
export function toggleStrike(text, start, end) {
  if (start === end) {
    const ls = text.lastIndexOf('\n', start - 1) + 1;
    let le = text.indexOf('\n', start);
    if (le < 0) le = text.length;
    const line = text.slice(ls, le);
    const prefix = line.match(/^(#{1,3}\s+|\s*[-*+]\s+(\[( |x|X)\]\s?)?)?/)[0];
    if (line.length === prefix.length) return { text, start, end };
    start = ls + prefix.length;
    end = le;
  }
  const sel = text.slice(start, end);
  const m = sel.match(/^~~([\s\S]*)~~$/);
  // 選んだ範囲のすぐ外側に ~~ があれば外す
  if (!m && text.slice(start - 2, start) === '~~' && text.slice(end, end + 2) === '~~') {
    return { text: text.slice(0, start - 2) + sel + text.slice(end + 2), start: start - 2, end: end - 2 };
  }
  const next = m ? m[1] : `~~${sel}~~`;
  return { text: text.slice(0, start) + next + text.slice(end), start, end: start + next.length };
}
