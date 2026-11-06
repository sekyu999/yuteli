// 文字の大きさ（5段階）とテーマ。この端末だけの見た目の好みなので、ブラウザの localStorage に保存する
// index.html の先頭で読み込んで、表示の前に反映している。
// 保存キーは旧名（yuteli）のまま（変えると設定が消えるため）
const KEY = 'yuteli.fontScale';

export const FONT_LEVELS = [
  { label: 'とても小さい', scale: 0.82 },
  { label: '小さい', scale: 0.88 },
  { label: 'やや小さい', scale: 0.94 },
  { label: '標準', scale: 1 },
  { label: '大きい', scale: 1.1 },
];
const MAX = FONT_LEVELS[FONT_LEVELS.length - 1].scale;

export function getFontScale() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v > 0 ? Math.min(v, MAX) : 1; // 以前の「大（1.22）」は今の最大にする
  } catch {
    return 1;
  }
}

export function setFontScale(scale) {
  document.documentElement.style.setProperty('--fs', String(scale));
  try {
    localStorage.setItem(KEY, String(scale));
  } catch {
    /* 保存できなくても今回の表示には反映される */
  }
}

// ---- テーマ ----
const THEME_KEY = 'yuteli.theme';

/** 今のテーマ（'' は端末の明暗に合わせる） */
export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setTheme(key) {
  if (key) document.documentElement.setAttribute('data-theme', key);
  else document.documentElement.removeAttribute('data-theme');
  // iPhone の上部バーの色も合わせる
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => (m.content = bg));
  try {
    if (key) localStorage.setItem(THEME_KEY, key);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    /* 保存できなくても今回の表示には反映される */
  }
}
