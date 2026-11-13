// 年・月のプルダウンの選択肢（家計・目標で使う）
// iPhone の <input type="month"> は言語によって横に広がるため、年と月の2つのプルダウンにしている
import { thisMonth } from '../domain/plans.js';
import { yearText, monthOnlyText } from '../lib/i18n.js';

/** 年の選択肢（去年〜5年後。選んでいる年が範囲外なら広げる） */
export function yearOptions(month) {
  const now = new Date().getFullYear();
  const sel = Number((month ?? thisMonth()).slice(0, 4));
  const years = [];
  for (let y = Math.min(now - 1, sel); y <= Math.max(now + 5, sel); y++) years.push(y);
  return years.map((y) => `<option value="${y}" ${y === sel ? 'selected' : ''}>${yearText(y)}</option>`).join('');
}

/** 月の選択肢（01〜12） */
export function monthOptions(month) {
  const sel = (month ?? thisMonth()).slice(5, 7);
  return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
    .map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${monthOnlyText(Number(m))}</option>`)
    .join('');
}
