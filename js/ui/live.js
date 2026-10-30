// 画面の自動更新
// watch(読み出し関数, 描画関数) と書くと、関係するデータが変わるたびに描画関数が自動で呼ばれる。
// 戻り値の関数を呼ぶと監視をやめる（画面を離れるとき用）。
import { liveQuery } from '../../vendor/dexie.mjs';

export function watch(query, render) {
  const sub = liveQuery(query).subscribe({
    next: render,
    error: (e) => console.error('[watch]', e),
  });
  return () => sub.unsubscribe();
}
