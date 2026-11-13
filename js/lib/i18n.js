// 表示言語（日本語・英語）
//
// 使い方：画面の文字は日本語のまま t() で囲む。英語の時は js/i18n/en/*.js の対応表から英訳を返す。
//   t('保存しました')                       → 英語なら 'Saved'
//   t('「{name}」を登録しました', { name })  → 英語なら 'Added "{name}"'（{…} に値が入る）
// 対応表にない文字は日本語のまま表示される（英訳漏れは tests/i18n.test.js で検出）
//
// 言語の設定は端末ごとの好みなので localStorage に保存する（初期値は日本語。'auto' は端末の言語に合わせる）
import { EN } from '../i18n/en.js';

const KEY = 'yuteli.lang';

export const LANG_OPTIONS = [
  { key: 'auto', label: '自動', title: '自動（端末の言語）' }, // ボタン内で折り返さないよう短く。説明は title・読み上げ用
  { key: 'ja', label: '日本語' }, // i18n-ignore
  { key: 'en', label: 'English' },
];

function storage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 設定値（auto / ja / en）。未設定は日本語（端末が英語でも、選ぶまでは日本語で表示） */
export function getLangPref() {
  const v = storage()?.getItem(KEY);
  return v === 'auto' || v === 'en' ? v : 'ja';
}

function detect() {
  const pref = getLangPref();
  if (pref !== 'auto') return pref;
  const nav = typeof navigator === 'undefined' ? 'ja' : navigator.language || 'ja';
  return nav.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

/** いま表示している言語（'ja' | 'en'） */
export const lang = detect();

/** 言語を変える（画面を読み込み直して反映） */
export function setLangPref(key) {
  storage()?.setItem(KEY, key);
  location.reload();
}

/** 文字を今の言語にする。{name} のような部分に params の値を入れる */
export function t(ja, params) {
  const text = lang === 'en' && EN[ja] !== undefined ? EN[ja] : ja;
  return params ? fill(text, params) : text;
}

export function fill(text, params) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** 金額：日本語「1,280円」、英語「¥1,280」（小数は1桁まで） */
export function money(n) {
  const v = Math.round(n * 10) / 10;
  if (lang === 'en') return `¥${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  return `${v.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}円`; // i18n-ignore
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * 年月（YYYY-MM）の表示。base と同じ年なら年を省く
 * 日本語「11月」「2027年1月」、英語「Nov」「Jan 2027」。null は「未定」
 */
export function monthText(ym, base) {
  if (!ym) return t('未定');
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  const sameYear = base && Number(base.slice(0, 4)) === y;
  if (lang === 'en') return sameYear ? EN_MONTHS[m - 1] : `${EN_MONTHS[m - 1]} ${y}`;
  return sameYear ? `${m}月` : `${y}年${m}月`; // i18n-ignore
}

/** 年だけ・月だけの表示（プルダウン用） */
export function yearText(y) {
  return lang === 'en' ? String(y) : `${y}年`; // i18n-ignore
}
export function monthOnlyText(m) {
  return lang === 'en' ? EN_MONTHS[m - 1] : `${m}月`; // i18n-ignore
}

/** 日付（YYYY-MM-DD）を短く：日本語「11/6」、英語「Nov 6」 */
export function dateShort(ymd) {
  const m = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  return lang === 'en' ? `${EN_MONTHS[m - 1]} ${d}` : `${m}/${d}`;
}

/** 日付（YYYY-MM-DD）を年つきで：日本語「2026/11/06」、英語「Nov 6, 2026」 */
export function dateLong(ymd) {
  if (lang === 'en') return `${dateShort(ymd)}, ${ymd.slice(0, 4)}`;
  return ymd.replaceAll('-', '/');
}

/**
 * 画面の HTML に書いた文字を訳す（index.html の下のタブなど）
 * data-i18n 属性のある要素の文字を t() で置き換える
 */
export function translateStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.textContent.trim())));
}
