// 食品成分表データ（data/foods.json）の読み込みと検索
// 出典：日本食品標準成分表（八訂）増補2023年（文部科学省）
// 約2,500食品・300KB あるため、必要になった時に1回だけ読み込む。

import { t } from '../lib/i18n.js';

let cache = null;

/** @returns {Promise<{meta:object, foods:Array<{code:string,name:string,group:number,per100g:object}>}>} */
export async function loadFoods() {
  if (!cache) {
    cache = fetch(new URL('../../data/foods.json', import.meta.url))
      .then((r) => {
        if (!r.ok) throw new Error(t('成分表を読み込めませんでした（{status}）', { status: r.status }));
        return r.json();
      })
      .then(({ meta, foods }) => {
        const keys = meta.fields.slice(3);
        return {
          meta,
          foods: foods.map((row) => ({
            code: row[0],
            name: row[1],
            group: row[2],
            per100g: Object.fromEntries(keys.map((k, i) => [k, row[3 + i]])),
            key: normalize(row[1]),
          })),
        };
      })
      .catch((e) => {
        cache = null; // 次回また試す
        throw e;
      });
  }
  return cache;
}

/** 検索用に文字をそろえる：全角半角・カタカナ→ひらがな・記号や空白を除く */
export function normalize(s) {
  return String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)) // i18n-ignore
    .replace(/[\s<>＜＞\[\]［］()（）「」・、,]/g, ''); // i18n-ignore
}

/** 普段の言い方 → 成分表での言い方 */
const ALIASES = {
  ごはん: ['めし'], // i18n-ignore
  ご飯: ['めし'], // i18n-ignore
  白米: ['めし', '精白米'], // i18n-ignore
  玄米: ['玄米'], // i18n-ignore
  卵: ['鶏卵', '卵'], // i18n-ignore
  たまご: ['鶏卵'], // i18n-ignore
  玉子: ['鶏卵'], // i18n-ignore
  豚: ['ぶた'], // i18n-ignore
  豚肉: ['ぶた'], // i18n-ignore
  鶏: ['にわとり'], // i18n-ignore
  鶏肉: ['にわとり'], // i18n-ignore
  とり: ['にわとり'], // i18n-ignore
  ささみ: ['ささみ'], // i18n-ignore
  牛肉: ['うし'], // i18n-ignore
  ひき肉: ['ひき肉'], // i18n-ignore
  鮭: ['さけ'], // i18n-ignore
  サーモン: ['さけ', 'サーモン'], // i18n-ignore
  豆腐: ['とうふ', '豆腐'], // i18n-ignore
  ツナ: ['まぐろ類缶詰', 'かつお類缶詰'], // i18n-ignore
  玉ねぎ: ['たまねぎ'], // i18n-ignore
  人参: ['にんじん'], // i18n-ignore
  じゃがいも: ['じゃがいも'], // i18n-ignore
  きのこ: ['しめじ', 'えのき', 'しいたけ', 'まいたけ'], // i18n-ignore
  パン: ['パン'], // i18n-ignore
  食パン: ['食パン'], // i18n-ignore
  うどん: ['うどん'], // i18n-ignore
  そば: ['そば'], // i18n-ignore
  パスタ: ['スパゲッティ', 'マカロニ'], // i18n-ignore
  スパゲティ: ['スパゲッティ'], // i18n-ignore
  チーズ: ['チーズ'], // i18n-ignore
  味噌: ['米みそ', '麦みそ', '豆みそ', '調合みそ'], // i18n-ignore
  みそ: ['米みそ', '麦みそ', '豆みそ', '調合みそ'], // i18n-ignore
  みそ汁: ['みそ汁'], // i18n-ignore
  醤油: ['しょうゆ'], // i18n-ignore
  砂糖: ['砂糖'], // i18n-ignore
  ヨーグルト: ['ヨーグルト'], // i18n-ignore
  コーヒー: ['コーヒー'], // i18n-ignore
  お茶: ['茶'], // i18n-ignore
  緑茶: ['せん茶'], // i18n-ignore
};

/**
 * 食品を探す。スペース区切りの言葉をすべて含むものを、名前の短い順に返す
 * @returns {Promise<Array>}
 */
export async function searchFoods(query, limit = 60) {
  const { foods } = await loadFoods();
  const words = String(query).trim().split(/[\s　]+/).filter(Boolean);
  if (!words.length) return [];
  // 別名がある言葉は別名で探す（「ツナ」で「こまつな」が出ないように）
  const alts = words.map((w) => (ALIASES[w] ?? [w]).map(normalize));
  const hits = foods.filter((f) => alts.every((a) => a.some((x) => f.key.includes(x))));
  // 「生」のもの・名前の短いものを先に
  hits.sort((a, b) => score(a) - score(b));
  return hits.slice(0, limit);
}

/** よく食べる物（検索結果の先頭に出す） */
const EVERYDAY = new Set([
  '04046', '01088', '01083', '13003', '04032', '04033', '04035', '01026', '01034', '12004', '11220', '11221', '11227',
  '11123', '11129', '11130', '11163', '11089', '10134', '10263', '10260', '10154', '17045', '13025', '13040', '07107',
  '06061', '06153', '06212', '06263', '06267', '06182', '06183', '01004', '02017', '01039', '01064', '01128', '07148',
  '07027', '07006', '17007', '09040', '14001', '14006', '14017', '06065', '06086', '06191', '02045', '04052', '05001',
  '07054', '16037', '16045', '06289', '08016', '10092', '01080', '01085',
]);

function score(f) {
  return f.name.length + (EVERYDAY.has(f.code) ? -40 : 0) + (/(^| )生( |$)/.test(f.name) ? -6 : 0) + (f.group === 18 ? 10 : 0); // i18n-ignore
}
