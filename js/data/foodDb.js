// 食品成分表データ（data/foods.json）の読み込みと検索
// 出典：日本食品標準成分表（八訂）増補2023年（文部科学省）
// 約2,500食品・300KB あるため、必要になった時に1回だけ読み込む。

let cache = null;

/** @returns {Promise<{meta:object, foods:Array<{code:string,name:string,group:number,per100g:object}>}>} */
export async function loadFoods() {
  if (!cache) {
    cache = fetch(new URL('../../data/foods.json', import.meta.url))
      .then((r) => {
        if (!r.ok) throw new Error(`成分表を読み込めませんでした（${r.status}）`);
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
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s<>＜＞\[\]［］()（）「」・、,]/g, '');
}

/** 普段の言い方 → 成分表での言い方 */
const ALIASES = {
  ごはん: ['めし'],
  ご飯: ['めし'],
  白米: ['めし', '精白米'],
  玄米: ['玄米'],
  卵: ['鶏卵', '卵'],
  たまご: ['鶏卵'],
  玉子: ['鶏卵'],
  豚: ['ぶた'],
  豚肉: ['ぶた'],
  鶏: ['にわとり'],
  鶏肉: ['にわとり'],
  とり: ['にわとり'],
  ささみ: ['ささみ'],
  牛肉: ['うし'],
  ひき肉: ['ひき肉'],
  鮭: ['さけ'],
  サーモン: ['さけ', 'サーモン'],
  豆腐: ['とうふ', '豆腐'],
  ツナ: ['まぐろ類缶詰', 'かつお類缶詰'],
  玉ねぎ: ['たまねぎ'],
  人参: ['にんじん'],
  じゃがいも: ['じゃがいも'],
  きのこ: ['しめじ', 'えのき', 'しいたけ', 'まいたけ'],
  パン: ['パン'],
  食パン: ['食パン'],
  うどん: ['うどん'],
  そば: ['そば'],
  パスタ: ['スパゲッティ', 'マカロニ'],
  スパゲティ: ['スパゲッティ'],
  チーズ: ['チーズ'],
  味噌: ['米みそ', '麦みそ', '豆みそ', '調合みそ'],
  みそ: ['米みそ', '麦みそ', '豆みそ', '調合みそ'],
  みそ汁: ['みそ汁'],
  醤油: ['しょうゆ'],
  砂糖: ['砂糖'],
  ヨーグルト: ['ヨーグルト'],
  コーヒー: ['コーヒー'],
  お茶: ['茶'],
  緑茶: ['せん茶'],
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
  return f.name.length + (EVERYDAY.has(f.code) ? -40 : 0) + (/(^| )生( |$)/.test(f.name) ? -6 : 0) + (f.group === 18 ? 10 : 0);
}
