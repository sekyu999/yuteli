// ⑦ 目標：自分で掲げた目標・信念を書いておき、起動時に見る。他の機能とはつながらない独立した画面。
// 見る画面：ToDo はその場でチェック、「やる月」も設定できる。編集画面：テキストで書く（Notion からの貼り付けも可）
import { watch } from '../ui/live.js';
import { openSheet } from '../ui/sheet.js';
import { getNoteText, saveNoteText } from '../data/noteRepo.js';
import {
  parseNote,
  parseInline,
  toggleTodo,
  setTodoMonth,
  toggleLinePrefix,
  toggleStrike,
  NOTE_MAX,
} from '../domain/note.js';
import { thisMonth } from '../domain/plans.js';
import { yearOptions, monthOptions } from '../ui/monthPick.js';
import { esc } from '../lib/util.js';
import { t, monthText } from '../lib/i18n.js';

export const title = '目標';

// 起動時に表示するか（端末ごとの好み。初期値はオン）
const LAUNCH_KEY = 'yuteli.noteOnLaunch';

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

export function mount(el) {
  let text = '';
  let saved = '';
  let editing = false;
  let loaded = false;

  async function commit() {
    if (text === saved) return;
    saved = text;
    await saveNoteText(text);
  }

  function renderView() {
    if (!text.trim()) {
      el.innerHTML = `<div class="placeholder">${t('目標や大事にしたいことを書いておくと、起動した時に表示されます。')}</div>
        <div class="form-actions"><button type="button" class="btn btn-primary btn-block" data-note-edit>${t('書く')}</button></div>`;
      return;
    }
    el.innerHTML = `
      <div class="goals">
        <button type="button" class="chip-btn goals-edit" data-note-edit>${t('編集')}</button>
        <div class="note-view">${blocksHtml(text)}</div>
      </div>`;
  }

  function renderEdit() {
    el.innerHTML = `
      <div class="note-tools" role="toolbar" aria-label="${t('書式')}">
        <button type="button" class="chip-btn" data-fmt="heading">${t('見出し')}</button>
        <button type="button" class="chip-btn" data-fmt="todo">${t('ToDo')}</button>
        <button type="button" class="chip-btn" data-fmt="strike"><s>${t('打ち消し')}</s></button>
        <button type="button" class="btn btn-primary note-done" data-note-done>${t('完了')}</button>
      </div>
      <textarea class="input note-textarea" maxlength="${NOTE_MAX}" aria-label="${t('目標')}"
        placeholder="${esc(t('例：# 今年の目標'))}"></textarea>
      <p class="note">${esc(t('# 見出し　- [ ] ToDo　~~打ち消し~~　Notion からコピーして貼り付けもできます'))}</p>`;
    const ta = el.querySelector('textarea');
    ta.value = text;
    ta.addEventListener('input', () => (text = ta.value));
  }

  const render = () => (editing ? renderEdit() : renderView());

  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-note-edit]')) {
      editing = true;
      render();
      el.querySelector('textarea').focus();
      return;
    }
    if (e.target.closest('[data-note-done]')) {
      await commit();
      editing = false;
      render();
      window.scrollTo(0, 0);
      return;
    }
    const fmt = e.target.closest('[data-fmt]');
    if (fmt) {
      applyFormat(el.querySelector('textarea'), fmt.dataset.fmt);
      return;
    }
    const mb = e.target.closest('[data-month-line]');
    if (mb) openMonthSheet(Number(mb.dataset.monthLine));
  });

  // ToDo をチェック → すぐ保存
  el.addEventListener('change', async (e) => {
    const cb = e.target.closest('input[data-line]');
    if (!cb) return;
    text = toggleTodo(text, Number(cb.dataset.line));
    cb.closest('.nb-todo-row')?.classList.toggle('is-checked', cb.checked);
    await commit();
  });

  /** ToDo の「やる月」を選ぶシート */
  function openMonthSheet(line) {
    const block = parseNote(text).find((b) => b.line === line);
    if (!block || block.type !== 'todo') return;
    const cur = block.month ?? thisMonth();
    const sheet = openSheet({
      title: t('やる月'),
      body: `
        <p class="sheet-lead">${esc(plainText(block.text))}</p>
        <div class="row month-pick">
          <select class="select" name="year" aria-label="${t('年')}">${yearOptions(cur)}</select>
          <select class="select" name="mon" aria-label="${t('月')}">${monthOptions(cur)}</select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary btn-block" data-set>${t('保存')}</button>
          ${block.month ? `<button type="button" class="btn btn-block" data-clear>${t('月を外す')}</button>` : ''}
        </div>`,
    });
    const set = async (month) => {
      text = setTodoMonth(text, line, month);
      await commit();
      sheet.close();
      render();
    };
    sheet.el.querySelector('[data-set]').addEventListener('click', () => {
      const y = sheet.el.querySelector('[name="year"]').value;
      const m = sheet.el.querySelector('[name="mon"]').value;
      set(`${y}-${m}`);
    });
    sheet.el.querySelector('[data-clear]')?.addEventListener('click', () => set(null));
  }

  /** 書式ボタン：選んでいる行（またはカーソルの行）に記号を付け外しする */
  function applyFormat(ta, kind) {
    const v = ta.value;
    const { selectionStart: s, selectionEnd: en } = ta;
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

  // 復元などで変わった時も描き直す（編集中は書いている内容を優先）
  const stop = watch(getNoteText, (v) => {
    if (editing) return;
    if (loaded && v === saved) return;
    loaded = true;
    text = saved = v;
    render();
  });

  // 画面を離れる時：編集中なら保存
  return () => {
    stop();
    if (editing) commit();
  };
}

/** 飾りの記号を除いた文（シートの見出し用） */
function plainText(s) {
  return parseInline(s)
    .map((x) => x.text)
    .join('');
}

/** 見る画面の HTML */
function blocksHtml(text) {
  const now = thisMonth();
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
          return `<h2 class="nb-h nb-h${b.level}">${inline(b.text)}</h2>`;
        case 'todo': {
          const past = b.month && b.month < now && !b.checked;
          const name = plainText(b.text);
          return `<div class="nb-todo-row ${b.checked ? 'is-checked' : ''}">
            <label class="nb-todo"><input type="checkbox" data-line="${b.line}" ${b.checked ? 'checked' : ''}><span>${inline(b.text)}</span></label>
            <button type="button" class="nb-month ${b.month ? 'is-set' : ''} ${past ? 'is-past' : ''}" data-month-line="${b.line}"
              aria-label="${esc(b.month ? t('{name}のやる月：{month}', { name, month: monthText(b.month, now) }) : t('{name}のやる月', { name }))}">${
                b.month
                  ? esc(monthText(b.month, now))
                  : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>'
              }</button>
          </div>`;
        }
        case 'bullet':
          return `<p class="nb-bullet">${inline(b.text)}</p>`;
        default:
          return `<p class="nb-text">${inline(b.text)}</p>`;
      }
    })
    .join('');
}
