// 目標メモの読み書き（meta テーブルに1件だけ持つ）
import { getMeta, setMeta, META } from './metaRepo.js';
import { NOTE_MAX } from '../domain/note.js';
import { nowIso } from '../lib/util.js';

/** メモの文（未保存なら空文字） */
export async function getNoteText() {
  return (await getMeta(META.note))?.text ?? '';
}

export async function saveNoteText(text) {
  await setMeta(META.note, { text: String(text ?? '').slice(0, NOTE_MAX), updatedAt: nowIso() });
}
