// 食事グループ：毎日ではないが「この中のどれかを食べる」物をまとめて扱う。
// 例）主菜：サバ缶と鶏むねを交互に 1日1回 → それぞれ 0.5回分ずつ食べたことにする
//     野菜：ブロッコリー・ほうれん草・玉ねぎ・なす から 1日200g → それぞれ 50g ずつ
// グループの量はメンバーに均等に分けて、各商品の「毎日の量」に足す（＝平均）。
// 画面や DB には依存しない純粋な関数。
import { MEALS, intakeUnit } from './consumption.js';

/** グループの量の単位 */
export const GROUP_UNITS = [
  { key: 'g', label: 'g（重さで）', short: 'g' },
  { key: 'serving', label: '回（どれか1つを）', short: '回' },
];

/**
 * @typedef {Object} FoodGroup
 * @property {string} id
 * @property {string} name
 * @property {'g'|'serving'} unit
 * @property {{breakfast:number, lunch:number, dinner:number}} consumption グループ全体の量
 * @property {Array<{productId:string, servingAmount:number|null}>} members
 *   servingAmount: unit='serving' の時、その商品の「1回の量」（商品の入力単位）
 */

/**
 * メンバー1人分の、ある食事の量（商品の入力単位）。換算できなければ null
 */
export function memberShare(group, member, product, mealKey) {
  const n = group.members.length;
  if (!n) return 0;
  const amount = (Number(group.consumption?.[mealKey]) || 0) / n;
  if (!amount) return 0;
  if (group.unit === 'serving') {
    return member.servingAmount > 0 ? amount * member.servingAmount : null;
  }
  // g：商品の入力単位に直す
  const u = intakeUnit(product);
  if (u === 'g' || u === 'ml') return amount;
  return product.gramsPerUnit > 0 ? amount / product.gramsPerUnit : null;
}

/**
 * 商品の毎日の量に、所属グループの分を足したものを返す
 * @param {Array} products
 * @param {FoodGroup[]} groups
 * @returns {{ products: Array, issues: Array<{group:FoodGroup, product:object, reason:'no-weight'|'no-serving'}> }}
 *   products: consumption を「自分の分＋グループの分」にしたコピー（元の値は ownConsumption）
 */
export function combineConsumption(products, groups = []) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const extra = new Map(); // productId → {breakfast,…}
  const groupIdsOf = new Map();
  const issues = [];

  for (const g of groups) {
    for (const m of g.members) {
      const p = byId.get(m.productId);
      if (!p) continue;
      if (!groupIdsOf.has(p.id)) groupIdsOf.set(p.id, []);
      groupIdsOf.get(p.id).push(g.id);
      let bad = false;
      const add = extra.get(p.id) ?? { breakfast: 0, lunch: 0, dinner: 0 };
      for (const meal of MEALS) {
        const v = memberShare(g, m, p, meal.key);
        if (v === null) bad = true;
        else add[meal.key] += v;
      }
      extra.set(p.id, add);
      if (bad) issues.push({ group: g, product: p, reason: g.unit === 'serving' ? 'no-serving' : 'no-weight' });
    }
  }

  return {
    products: products.map((p) => {
      const own = p.consumption ?? { breakfast: 0, lunch: 0, dinner: 0 };
      const add = extra.get(p.id);
      if (!add) return { ...p, ownConsumption: own, groupIds: [] };
      const sum = Object.fromEntries(MEALS.map((m) => [m.key, (Number(own[m.key]) || 0) + add[m.key]]));
      return { ...p, consumption: sum, ownConsumption: own, groupIds: groupIdsOf.get(p.id) ?? [] };
    }),
    issues,
  };
}

/**
 * そのグループの分だけの量を持つ商品のコピー（グループ単位で栄養・食費を出す時に使う）
 */
export function groupOnly(group, products) {
  const ids = new Set(group.members.map((m) => m.productId));
  const members = products.filter((p) => ids.has(p.id)).map((p) => ({ ...p, consumption: { breakfast: 0, lunch: 0, dinner: 0 } }));
  return combineConsumption(members, [group]).products;
}

/** グループの1日の合計量 */
export function groupDaily(group) {
  return MEALS.reduce((s, m) => s + (Number(group.consumption?.[m.key]) || 0), 0);
}

/**
 * グループ入力の検証
 * @returns {{ok:true, value:object} | {ok:false, errors:Record<string,string>}}
 */
export function validateGroupInput(raw) {
  const errors = {};
  const name = String(raw.name ?? '').trim();
  if (!name) errors.name = 'グループ名を入力してください';
  else if (name.length > 20) errors.name = '20文字以内にしてください';
  const unit = raw.unit === 'serving' ? 'serving' : 'g';
  const consumption = {};
  for (const m of MEALS) {
    const t = String(raw[`c_${m.key}`] ?? '').trim();
    const n = t === '' ? 0 : Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 100000) errors[`c_${m.key}`] = '0以上の数で';
    consumption[m.key] = Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
  }
  const members = (raw.members ?? []).map((m) => ({
    productId: m.productId,
    servingAmount: unit === 'serving' && Number(m.servingAmount) > 0 ? Math.round(Number(m.servingAmount) * 100) / 100 : null,
  }));
  if (!members.length) errors.members = '1つ以上選んでください';
  if (unit === 'serving' && members.some((m) => !m.servingAmount)) errors.members = '選んだ物の「1回の量」を入れてください';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, unit, consumption, members } };
}
