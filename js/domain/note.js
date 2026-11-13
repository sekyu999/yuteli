// 目標メモ：自分で掲げた目標・信念を書いておき、起動時に見る。他の機能とはつながらない独立した機能。
// 書き方は Notion からコピーした文と同じ（Markdown の一部）。画面や DB には依存しない純粋な関数。
//   # 見出し（## ### も可）
//   - [ ] ToDo　- [x] 済みの ToDo（- の代わりに * でも可）
//   - [ ] ToDo @2027-03 … 行の最後の @年-月 は「やる月」
//   - 箇条書き
//   ~~打ち消し~~（行全体）
//   それ以外の行は本文

/** 文字数の上限（バックアップや表示が重くならないように） */
export const NOTE_MAX = 5000;

const RE_HEADING = /^(#{1,3})\s+(.*)$/;
const RE_TODO = /^(\s*)[-*+]\s+\[( |x|X)\]\s?(.*)$/;
const RE_BULLET = /^(\s*)[-*+]\s+(.*)$/;
/** ToDo の行の最後の「@2027-03」（やる月） */
const RE_MONTH = /\s*@(\d{4}-(?:0[1-9]|1[0-2]))\s*$/;

/**
 * @typedef {{type:'heading', level:number, text:string, line:number}
 *   | {type:'todo', checked:boolean, text:string, month:string|null, line:number}
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
      if (m) {
        const mm = m[3].match(RE_MONTH);
        const body = mm ? m[3].slice(0, mm.index) : m[3];
        return { type: 'todo', checked: m[2] !== ' ', text: body.trim(), month: mm ? mm[1] : null, line };
      }
      m = raw.match(RE_BULLET);
      if (m) return { type: 'bullet', text: m[2].trim(), line };
      return { type: 'text', text: raw.trim(), line };
    });
}

/**
 * 画面で直接編集するためのブロック（1行 = 1ブロック）
 * @typedef {{type:'heading'|'todo'|'bullet'|'text', level?:number, checked?:boolean, month?:string|null, strike:boolean, text:string}} EditBlock
 * 行全体の ~~…~~ は strike にする（画面では線で表示し、記号は見せない）。行の一部の ~~ は文のまま残す。
 * 空行は空の本文ブロック（続く空行は1つにまとめる）
 */

/** 行全体が ~~…~~ か */
function splitStrike(text) {
  const m = text.match(/^~~(.+)~~$/);
  return m && !m[1].includes('~~') ? { strike: true, text: m[1] } : { strike: false, text };
}

/** 文 → 編集ブロック。何も書いていなければ空の本文ブロック1つ */
export function toEditBlocks(text) {
  const out = [];
  for (const b of parseNote(text)) {
    if (b.type === 'blank') {
      if (out.length && out[out.length - 1].type === 'text' && out[out.length - 1].text === '') continue;
      out.push({ type: 'text', strike: false, text: '' });
      continue;
    }
    const base = { type: b.type, ...splitStrike(b.text) };
    if (b.type === 'heading') base.level = b.level;
    if (b.type === 'todo') Object.assign(base, { checked: b.checked, month: b.month });
    out.push(base);
  }
  // 最初と最後の空行は除く
  while (out.length && out[0].type === 'text' && !out[0].text) out.shift();
  while (out.length > 1 && out[out.length - 1].type === 'text' && !out[out.length - 1].text) out.pop();
  return out.length ? out : [{ type: 'text', strike: false, text: '' }];
}

/** 1行の文 → 編集ブロック（貼り付け用） */
export function lineToBlock(line) {
  return toEditBlocks(line)[0];
}

/** 編集ブロック → 保存する文 */
export function fromEditBlocks(blocks) {
  return blocks
    .map((b) => {
      const body = b.strike && b.text ? `~~${b.text}~~` : b.text;
      switch (b.type) {
        case 'heading':
          return `${'#'.repeat(b.level || 2)} ${body}`;
        case 'todo':
          return `- [${b.checked ? 'x' : ' '}] ${body}${b.month ? ` @${b.month}` : ''}`;
        case 'bullet':
          return `- ${body}`;
        default:
          return body;
      }
    })
    .join('\n')
    .replace(/\n+$/, '');
}

/**
 * 書きながらの記号の変換（Notion と同じ）。行の先頭に
 *   「# 」「## 」「### 」→ 見出し、「[] 」「[ ] 」「- [ ] 」→ ToDo、「- 」「* 」→ 箇条書き
 * @param {EditBlock} block
 * @returns {Partial<EditBlock>|null} 変える内容（text は記号を除いた残り）。変えなければ null
 */
export function shortcutFor(block) {
  const v = block.text;
  if (block.type === 'text') {
    let m = v.match(/^(#{1,3}) (.*)$/s);
    if (m) return { type: 'heading', level: m[1].length, text: m[2] };
    m = v.match(/^(?:[-*] )?\[ ?\] (.*)$/s);
    if (m) return { type: 'todo', checked: false, month: null, text: m[1] };
    m = v.match(/^[-*] (.*)$/s);
    if (m) return { type: 'bullet', text: m[1] };
  }
  if (block.type === 'bullet') {
    const m = v.match(/^\[ ?\] (.*)$/s);
    if (m) return { type: 'todo', checked: false, month: null, text: m[1] };
  }
  return null;
}
