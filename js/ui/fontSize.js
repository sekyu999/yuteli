// 文字の大きさ（5段階）。この端末だけの見た目の好みなので、ブラウザの localStorage に保存する
// index.html の先頭で読み込んで、表示の前に反映している。
const KEY = 'yuteli.fontScale';

export const FONT_LEVELS = [
  { label: '小', scale: 0.88 },
  { label: 'やや小', scale: 0.94 },
  { label: '標準', scale: 1 },
  { label: 'やや大', scale: 1.1 },
  { label: '大', scale: 1.22 },
];

export function getFontScale() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v > 0 ? v : 1;
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
