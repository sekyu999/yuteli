// 目標メモのシート（ヘッダーの旗ボタン・起動時に開く）
// 見る画面：ToDo はその場でチェックできる。編集画面：テキストで書く（Notion からの貼り付けも可）
import { openSheet } from '../ui/sheet.js';
import { getNoteText, saveNoteText } from '../data/noteRepo.js';
import { parseNote, parseInline, toggleTodo, toggleLinePrefix, toggleStrike, NOTE_MAX } from '../domain/note.js';
import { esc, todayLocal } from '../lib/util.js';
import { t } from '../lib/i18n.js';

// 起動時に表示するか（端末ごとの好み。初期値はオン）
const LAUNCH_KEY = 'yuteli.noteOnLaunch';
let shownOn = null; // 起動時表示をした日（同じ日に何度も出さない）

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

/**
 * 起動時・日付が変わってアプリに戻った時に表示する（オフ・未記入・ほかのシート表示中は出さない）
 */
export async function showNoteOnLaunch() {
  const today = todayLocal();
  if (!noteOnLaunch() || shownOn === today || document.querySelector('dialog.sheet[open]')) return;
  const text = await getNoteText();
  if (!text.trim()) return;
  shownOn = today;
  openNoteSheet();
}

export async function openNoteSheet() {
  let text = await getNoteText();
  let editing = !text.trim();
  let saved = text;

  const sheet = openSheet({
    title: t('目標'),
    body: '<div class="note-sheet"></div>',
    // 編集中に閉じた時も書いた内容は保存する
    onClose: () => {
      if (editing) commit();
    },
  });
  const root = sheet.el.querySelector('.note-sheet');

  async function commit() {
    if (text === saved) return;
    saved = text;
    await saveNoteText(text);
  }

  function renderView() {
    root.innerHTML = `
      <div class="note-view">${blocksHtml(text)}</div>
      <div class="form-actions"><button type="button" class="btn btn-block" data-note-edit>${t('編集')}</button></div>`;
  }

  function renderEdit() {
    root.innerHTML = `
      <div class="note-tools" role="toolbar" aria-label="${t('書式')}">
        <button type="button" class="chip-btn" data-fmt="heading">${t('見出し')}</button>
        <button type="button" class="chip-btn" data-fmt="todo">${t('ToDo')}</button>
        <button type="button" class="chip-btn" data-fmt="strike"><s>${t('打ち消し')}</s></button>
      </div>
      <textarea class="input note-textarea" rows="14" maxlength="${NOTE_MAX}" aria-label="${t('目標')}"
        placeholder="${esc(t('例：# 今年の目標'))}"></textarea>
      <p class="note">${esc(t('# 見出し　- [ ] ToDo　~~打ち消し~~　Notion からコピーして貼り付けもできます'))}</p>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-block" data-note-done>${t('完了')}</button></div>`;
    const ta = root.querySelector('textarea');
    ta.value = text;
    ta.addEventListener('input', () => (text = ta.value));
  }

  function render() {
    if (editing) renderEdit();
    else renderView();
  }

  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-note-edit]')) {
      editing = true;
      render();
      root.querySelector('textarea').focus();
      return;
    }
    if (e.target.closest('[data-note-done]')) {
      await commit();
      editing = false;
      render();
      return;
    }
    const fmt = e.target.closest('[data-fmt]');
    if (fmt) applyFormat(root.querySelector('textarea'), fmt.dataset.fmt);
  });

  // 見る画面で ToDo をチェック → すぐ保存
  root.addEventListener('change', async (e) => {
    const cb = e.target.closest('input[data-line]');
    if (!cb) return;
    text = toggleTodo(text, Number(cb.dataset.line));
    saved = text;
    await saveNoteText(text);
    cb.closest('.nb-todo')?.classList.toggle('is-checked', cb.checked);
  });

  /** 書式ボタン：選んでいる行（またはカーソルの行）に記号を付け外しする */
  function applyFormat(ta, kind) {
    const v = ta.value;
    let { selectionStart: s, selectionEnd: en } = ta;
    let next;
    if (kind === 'strike') {
      next = toggleStrike(v, s, en);
    } else {
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      let le = v.indexOf('\n', Math.max(en - (en > s && v[en - 1] === '\n' ? 1 : 0), s));
      if (le < 0) le = v.length;
      const lines = v.slice(ls, le).split('\n').map((l) => toggleLinePrefix(l, kind)).join('\n');
      next = { text: v.slice(0, ls) + lines + v.slice(le), start: ls + lines.length, end: ls + lines.length };
    }
    ta.value = next.text.slice(0, NOTE_MAX);
    text = ta.value;
    ta.focus();
    ta.setSelectionRange(next.start, next.end);
  }

  render();
  if (editing) root.querySelector('textarea').focus();
}

/** 見る画面の HTML */
function blocksHtml(text) {
  const inline = (s) =>
    parseInline(s)
      .map((seg) => {
        let h = esc(seg.text);
        if (seg.bold) h = `<strong>${h}</strong>`;
        if (seg.strike) h = `<s>${h}</s>`;
        return h;
      })
      .join('');
  let prevBlank = true;
  return parseNote(text)
    .map((b) => {
      const wasBlank = prevBlank;
      prevBlank = b.type === 'blank';
      switch (b.type) {
        case 'blank':
          return wasBlank ? '' : '<div class="nb-gap"></div>';
        case 'heading':
          return `<h3 class="nb-h nb-h${b.level}">${inline(b.text)}</h3>`;
        case 'todo':
          return `<label class="nb-todo ${b.checked ? 'is-checked' : ''}">
            <input type="checkbox" data-line="${b.line}" ${b.checked ? 'checked' : ''}><span>${inline(b.text)}</span></label>`;
        case 'bullet':
          return `<p class="nb-bullet">${inline(b.text)}</p>`;
        default:
          return `<p class="nb-text">${inline(b.text)}</p>`;
      }
    })
    .join('');
}
