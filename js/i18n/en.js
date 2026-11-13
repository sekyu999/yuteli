// 英語の対応表（日本語 → 英語）。画面ごとのファイルをまとめる
import common from './en/common.js';
import shopping from './en/shopping.js';
import settings from './en/settings.js';
import meals from './en/meals.js';
import budget from './en/budget.js';
import note from './en/note.js';

export const EN = { ...common, ...shopping, ...settings, ...meals, ...budget, ...note };
