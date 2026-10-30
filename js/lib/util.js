// 小さな共通関数

/**
 * 一意なIDを作る。
 * crypto.randomUUID は HTTPS か localhost でしか使えないため、
 * 開発中に iPhone から http でアクセスした場合に備えて代替を用意する。
 * @returns {string}
 */
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 現在日時（ISO 8601）。保存用 */
export function nowIso() {
  return new Date().toISOString();
}

/** 今日の日付（端末の時刻で YYYY-MM-DD）。購入日用 */
export function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * HTML に埋め込む文字列をエスケープする。
 * 画面を文字列テンプレートで組み立てるとき、ユーザー入力は必ずこれを通す。
 */
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
