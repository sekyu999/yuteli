// ⑦ 目標：自分で掲げた目標・信念を書いておき、起動時に見る。他の機能とはつながらない独立した画面。
// 表示したまま直接書き換えられる（Notion のように1行ずつのブロック）。
//   Enter で次の行、行頭で ← 削除キー（Backspace）で前の行とつなぐ
//   行頭に「# 」→ 見出し、「[] 」→ ToDo、「- 」→ 箇条書き（Notion と同じ）。上のボタンでも切り替え
//   複数行の貼り付け（Notion からのコピーなど）は行ごとに分けて取り込む
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { getNoteText, saveNoteText } from '../data/noteRepo.js';
import { toEditBlocks, fromEditBlocks, lineToBlock, shortcutFor, NOTE_MAX } from '../domain/note.js';
import { thisMonth } from '../domain/plans.js';
import { yearOptions, monthOptions } from '../ui/monthPick.js';
import { esc } from '../lib/util.js';
import { t, monthText } from '../lib/i18n.js';

export const title = '目標';

// 起動時に表示するか（端末ごとの好み。初期値はオン）
const LAUNCH_KEY = 'yuteli.noteOnLaunch';
/** 書いてから保存するまでの待ち時間 */
const SAVE_DELAY = 600;

export function noteOnLaunch() {
  try {
    return localStorage.getItem(LAUNCH_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setNoteOnLaunch(on) {
  try {
    localStorage.setItem(LAUNCH_KEY, on ? '1' : '0');
  } catch {
    /* 保存できなくても動作には影響しない */
  }
}

/** 起動時に目標の画面を出すか（オンで、何か書いてある時） */
export async function shouldShowGoals() {
  return noteOnLaunch() && !!(await getNoteText()).trim();
}

const CAL_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';

export function mount(el) {
  /** @type {import('../domain/note.js').EditBlock[]} */
  let blocks = [];
  let saved = null; // 最後に保存した（読み込んだ）文
  let timer = null;

  el.innerHTML = `
    <div class="goal-tools" role="toolbar" aria-label="${t('書式')}" hidden>
      <button type="button" class="chip-btn" data-fmt="heading">${t('見出し')}</button>
      <button type="button" class="chip-btn" data-fmt="todo">${t('ToDo')}</button>
      <button type="button" class="chip-btn" data-fmt="strike"><s>${t('打ち消し')}</s></button>
    </div>
    <div class="goal-editor"></div>
    <div class="goal-tail" data-tail aria-hidden="true"></div>`;
  const tools = el.querySelector('.goal-tools');
  const editor = el.querySelector('.goal-editor');

  // ---- 保存 ----
  function save() {
    clearTimeout(timer);
    timer = null;
    const text = fromEditBlocks(blocks).slice(0, NOTE_MAX);
    if (text === saved) return;
    saved = text;
    saveNoteText(text);
  }
  const saveLater = () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY);
  };

  // ---- 描画 ----
  function blockHtml(b, i) {
    const cls = ['gb', `gb-${b.type}`, b.type === 'heading' ? `gb-h${b.level || 2}` : '', b.strike ? 'is-strike' : '', b.checked ? 'is-checked' : '', !b.text ? 'is-blank' : '']
      .filter(Boolean)
      .join(' ');
    const label = t({ heading: '見出し', todo: 'ToDo', bullet: '箇条書き', text: '本文' }[b.type]);
    const input = `<textarea class="gb-input" rows="1" data-i="${i}" aria-label="${esc(label)}" enterkeyhint="enter"${
      blocks.length === 1 && !b.text ? ` placeholder="${esc(t('目標を書く（# で見出し、[] で ToDo）'))}"` : ''
    }>${esc(b.text)}</textarea>`;
    if (b.type === 'todo') {
      const now = thisMonth();
      const past = b.month && b.month < now && !b.checked;
      const name = b.text || t('ToDo');
      return `<div class="${cls}">
        <input type="checkbox" class="gb-check" data-check="${i}" ${b.checked ? 'checked' : ''} aria-label="${esc(t('{name}を済みにする', { name }))}">
        ${input}
        <button type="button" class="nb-month ${b.month ? 'is-set' : ''} ${past ? 'is-past' : ''}" data-month="${i}"
          aria-label="${esc(b.month ? t('{name}のやる月：{month}', { name, month: monthText(b.month, now) }) : t('{name}のやる月', { name }))}">${
            b.month ? esc(monthText(b.month, now)) : CAL_ICON
          }</button>
      </div>`;
    }
    return `<div class="${cls}">${b.type === 'bullet' ? '<span class="gb-dot" aria-hidden="true"></span>' : ''}${input}</div>`;
  }

  /** 全体を描き直す。focus に [行, カーソル位置] を渡すとそこにカーソルを置く */
  function render(focus) {
    editor.innerHTML = blocks.map(blockHtml).join('');
    editor.querySelectorAll('.gb-input').forEach(autosize);
    if (focus) focusAt(...focus);
  }

  function focusAt(i, pos) {
    const ta = editor.querySelector(`.gb-input[data-i="${i}"]`);
    if (!ta) return;
    ta.focus();
    const p = Math.min(pos ?? ta.value.length, ta.value.length);
    ta.setSelectionRange(p, p);
  }

  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }

  // ---- 入力 ----
  editor.addEventListener('input', (e) => {
    const ta = e.target.closest('.gb-input');
    if (!ta) return;
    const i = Number(ta.dataset.i);
    const b = blocks[i];
    // 改行が入った（貼り付け・予測変換など）→ 行ごとに分ける
    if (ta.value.includes('\n')) {
      const pos = ta.selectionStart;
      const lines = ta.value.replace(/\r\n?/g, '\n').split('\n');
      const caretLine = ta.value.slice(0, pos).split('\n').length - 1;
      const first = b.type === 'text' && !b.text ? lineToBlock(lines[0]) : { ...b, text: lines[0] };
      // 末尾に改行が1つ付いただけ（Enter と同じ）なら、ToDo・箇条書きは同じ種類の行を足す
      const enterOnly = lines.length === 2 && !lines[1];
      const rest = enterOnly ? [newSibling(b, '')] : lines.slice(1).map(lineToBlock);
      blocks.splice(i, 1, first, ...rest);
      // 続く空行は1つに
      blocks = blocks.filter((x, k) => !(x.type === 'text' && !x.text && blocks[k - 1]?.type === 'text' && !blocks[k - 1]?.text));
      render([Math.min(i + caretLine, blocks.length - 1)]);
      saveLater();
      return;
    }
    b.text = ta.value;
    const sc = shortcutFor(b);
    if (sc) {
      Object.assign(b, sc);
      render([i, 0]);
    } else {
      autosize(ta);
      ta.closest('.gb').classList.toggle('is-blank', !b.text);
    }
    saveLater();
  });

  /** Enter で作る次の行（ToDo・箇条書きは同じ種類） */
  function newSibling(b, text) {
    if (b.type === 'todo') return { type: 'todo', checked: false, month: null, strike: false, text };
    if (b.type === 'bullet') return { type: 'bullet', strike: false, text };
    return { type: 'text', strike: false, text };
  }

  editor.addEventListener('keydown', (e) => {
    const ta = e.target.closest('.gb-input');
    if (!ta || e.isComposing || e.keyCode === 229) return; // 日本語の変換中は何もしない
    const i = Number(ta.dataset.i);
    const b = blocks[i];
    const { selectionStart: s, selectionEnd: en } = ta;
    if (e.key === 'Enter') {
      e.preventDefault();
      // 空の ToDo・箇条書きで Enter → 本文に戻す（Notion と同じ）
      if (!ta.value && (b.type === 'todo' || b.type === 'bullet')) {
        blocks[i] = { type: 'text', strike: false, text: '' };
        render([i, 0]);
      } else {
        b.text = ta.value.slice(0, s);
        blocks.splice(i + 1, 0, newSibling(b, ta.value.slice(en)));
        render([i + 1, 0]);
      }
      saveLater();
      return;
    }
    if (e.key === 'Backspace' && s === 0 && en === 0) {
      if (b.type !== 'text') {
        // 行頭で削除 → まず記号を外して本文に
        e.preventDefault();
        blocks[i] = { type: 'text', strike: b.strike, text: b.text };
        render([i, 0]);
        saveLater();
      } else if (i > 0) {
        // 前の行とつなぐ
        e.preventDefault();
        const prev = blocks[i - 1];
        const pos = prev.text.length;
        prev.text += b.text;
        blocks.splice(i, 1);
        render([i - 1, pos]);
        saveLater();
      }
    }
  });

  // ---- チェック・やる月・書式 ----
  editor.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-check]');
    if (!cb) return;
    const b = blocks[Number(cb.dataset.check)];
    b.checked = cb.checked;
    cb.closest('.gb').classList.toggle('is-checked', cb.checked);
    save();
  });

  editor.addEventListener('click', (e) => {
    const mb = e.target.closest('[data-month]');
    if (mb) openMonthSheet(Number(mb.dataset.month));
  });

  // 書式ボタンを押しても入力欄のフォーカス（キーボード）が外れないようにする
  let lastFocus = null;
  tools.addEventListener('pointerdown', (e) => e.preventDefault());
  tools.addEventListener('mousedown', (e) => e.preventDefault());
  tools.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fmt]');
    const ta = document.activeElement?.closest?.('.gb-input') ?? lastFocus;
    if (!btn || !ta) return;
    const i = Number(ta.dataset.i);
    const b = blocks[i];
    const pos = ta.selectionStart;
    switch (btn.dataset.fmt) {
      case 'heading':
        blocks[i] = b.type === 'heading' ? { type: 'text', strike: b.strike, text: b.text } : { type: 'heading', level: 2, strike: b.strike, text: b.text };
        break;
      case 'todo':
        blocks[i] =
          b.type === 'todo'
            ? { type: 'text', strike: b.strike, text: b.text }
            : { type: 'todo', checked: false, month: null, strike: b.strike, text: b.text };
        break;
      case 'strike':
        b.strike = !b.strike;
        break;
    }
    render([i, pos]);
    save();
  });

  // 書いている間だけ書式ボタンを出す
  el.addEventListener('focusin', (e) => {
    if (!e.target.closest('.gb-input')) return;
    lastFocus = e.target;
    tools.hidden = false;
  });
  el.addEventListener('focusout', () => {
    setTimeout(() => {
      if (el.contains(document.activeElement) && document.activeElement.closest('.gb-input')) return;
      tools.hidden = true;
      save();
    }, 0);
  });

  // 下の余白をタップ → 最後の行の続きを書く（最後が空の本文でなければ1行足す）
  el.querySelector('[data-tail]').addEventListener('click', () => {
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'text' && !last.text) {
      focusAt(blocks.length - 1, 0);
    } else {
      blocks.push({ type: 'text', strike: false, text: '' });
      render([blocks.length - 1, 0]);
    }
  });

  /** ToDo の「やる月」を選ぶシート */
  function openMonthSheet(i) {
    const b = blocks[i];
    if (!b || b.type !== 'todo') return;
    const cur = b.month ?? thisMonth();
    const sheet = openSheet({
      title: t('やる月'),
      body: `
        <p class="sheet-lead">${esc(b.text)}</p>
        <div class="row month-pick">
          <select class="select" name="year" aria-label="${t('年')}">${yearOptions(cur)}</select>
          <select class="select" name="mon" aria-label="${t('月')}">${monthOptions(cur)}</select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary btn-block" data-set>${t('保存')}</button>
          ${b.month ? `<button type="button" class="btn btn-block" data-clear>${t('月を外す')}</button>` : ''}
        </div>`,
    });
    const set = (month) => {
      b.month = month;
      save();
      sheet.close();
      render();
    };
    sheet.el.querySelector('[data-set]').addEventListener('click', () => {
      set(`${sheet.el.querySelector('[name="year"]').value}-${sheet.el.querySelector('[name="mon"]').value}`);
    });
    sheet.el.querySelector('[data-clear]')?.addEventListener('click', () => set(null));
  }

  // 画面の幅が変わったら高さを合わせ直す
  const onResize = () => editor.querySelectorAll('.gb-input').forEach(autosize);
  window.addEventListener('resize', onResize);
  // アプリを離れる時は保存
  const onHide = () => document.visibilityState === 'hidden' && save();
  document.addEventListener('visibilitychange', onHide);

  // 読み込み。復元などでほかから変わった時も描き直す（書いている最中は書いている内容を優先）
  const stop = watch(getNoteText, (text) => {
    if (text === saved) return;
    if (saved !== null && el.contains(document.activeElement)) return;
    saved = text;
    blocks = toEditBlocks(text);
    render();
  });

  return () => {
    stop();
    save();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onHide);
  };
}
