// ホーム画面のアイコンに、買い物リストの件数を数字で出す（iPhone は iOS 16.4 以降・ホーム画面から起動した時）
// iPhone では通知の許可が必要。この設定は端末ごとの好みなので localStorage に保存する
const KEY = 'yuteli.badge';

export function badgeSupported() {
  return 'setAppBadge' in navigator;
}

export function badgeEnabled() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** オン・オフ。オンにする時は通知の許可を求める */
export async function setBadgeEnabled(on) {
  if (on && 'Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      /* 許可を求められない環境 */
    }
  }
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* 保存できなくても今回は反映 */
  }
  if (!on) await navigator.clearAppBadge?.().catch(() => {});
  return on && (!('Notification' in window) || Notification.permission !== 'denied');
}

/** 件数を反映（オフなら何もしない） */
export function updateBadge(count) {
  if (!badgeSupported() || !badgeEnabled()) return;
  const p = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
  p?.catch?.(() => {});
}
