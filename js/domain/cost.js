// 毎日の食事にかかるお金。画面や DB には依存しない純粋な関数。
import { MEALS, dailyIntake, intakeUnit } from './consumption.js';
import { compareStores } from './pricing.js';

/** 1か月を何日として計算するか */
export const DAYS_PER_MONTH = 30;

/**
 * 入力単位（g・個・パック…）1つあたりの値段を、記録された価格から求める。
 * 各店舗の最新価格のうち最安のものを使う（最安店で買った場合の目安）。
 * @param {object} p 商品
 * @param {Array} records その商品の価格記録
 * @returns {{ price:number, storeId:string, purchasedAt:string } | null}
 */
export function pricePerIntakeUnit(p, records) {
  if (!records?.length) return null;
  const unit = intakeUnit(p);
  const candidates = compareStores(records)
    .rows.map((r) => {
      // 内容量の単位で食べる量を入れている場合：その記録の内容量で割る（店舗ごとの容量の違いも反映）
      if (p.packageContentUnit && unit === p.packageContentUnit) {
        const content = r.record.packageContentUnit === p.packageContentUnit ? r.record.packageContent : p.packageContent;
        if (!content) return null;
        return { price: r.perItem / content, storeId: r.storeId, purchasedAt: r.record.purchasedAt };
      }
      // 管理単位（パックなど）で入れている場合：1パックあたりの値段そのまま
      return { price: r.perItem, storeId: r.storeId, purchasedAt: r.record.purchasedAt };
    })
    .filter(Boolean);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b.price < a.price ? b : a));
}

/**
 * 毎日食べる物の食費
 * @param {Array} products 商品（consumption を持つもの）
 * @param {Map<string, Array>} recordsByProduct 商品ID → 価格記録
 * @returns {{ items: Array<{product, perDay:number|null, perMeal:Record<string,number>|null, unitPrice:object|null}>,
 *             perDay:number, perMonth:number, perMeal:Record<string,number>, noPrice:Array }}
 */
export function dailyCost(products, recordsByProduct) {
  const perMeal = Object.fromEntries(MEALS.map((m) => [m.key, 0]));
  const items = [];
  const noPrice = [];
  let perDay = 0;
  for (const p of products) {
    if (!dailyIntake(p)) continue;
    const unitPrice = pricePerIntakeUnit(p, recordsByProduct.get(p.id) ?? []);
    if (!unitPrice) {
      noPrice.push(p);
      items.push({ product: p, perDay: null, perMeal: null, unitPrice: null });
      continue;
    }
    const meals = Object.fromEntries(
      MEALS.map((m) => [m.key, (Number(p.consumption[m.key]) || 0) * unitPrice.price])
    );
    const day = MEALS.reduce((s, m) => s + meals[m.key], 0);
    MEALS.forEach((m) => (perMeal[m.key] += meals[m.key]));
    perDay += day;
    items.push({ product: p, perDay: day, perMeal: meals, unitPrice });
  }
  return { items, perDay, perMonth: perDay * DAYS_PER_MONTH, perMeal, noPrice };
}
