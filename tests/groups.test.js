import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineConsumption, groupOnly, validateGroupInput } from '../js/domain/groups.js';
import { splitCategories, mergeCategories } from '../js/domain/categories.js';
import { sumNutrients } from '../js/domain/nutrition.js';
import { dailyStockUse } from '../js/domain/consumption.js';

const Z = { breakfast: 0, lunch: 0, dinner: 0 };
const saba = { id: 'saba', name: 'サバ缶', inventoryUnit: '缶', packageContent: null, packageContentUnit: null, gramsPerUnit: 190, consumption: Z, nutrition: { per100g: { energy: 174 } } };
const mune = { id: 'mune', name: '鶏むね', inventoryUnit: 'パック', packageContent: 600, packageContentUnit: 'g', consumption: Z, nutrition: { per100g: { energy: 105 } } };
const broc = { id: 'broc', name: 'ブロッコリー', inventoryUnit: '株', packageContent: 250, packageContentUnit: 'g', consumption: { breakfast: 0, lunch: 0, dinner: 30 }, nutrition: { per100g: { energy: 37 } } };
const tama = { id: 'tama', name: '玉ねぎ', inventoryUnit: '個', packageContent: null, packageContentUnit: null, gramsPerUnit: 200, consumption: Z };
const nasu = { id: 'nasu', name: 'なす', inventoryUnit: '本', packageContent: null, packageContentUnit: null, gramsPerUnit: null, consumption: Z };

const protein = { id: 'g1', name: '主菜', unit: 'serving', consumption: { breakfast: 0, lunch: 0, dinner: 1 },
  members: [{ productId: 'saba', servingAmount: 1 }, { productId: 'mune', servingAmount: 150 }] };
const veg = { id: 'g2', name: '野菜', unit: 'g', consumption: { breakfast: 0, lunch: 100, dinner: 100 },
  members: [{ productId: 'broc' }, { productId: 'tama' }, { productId: 'nasu' }, { productId: 'gone' }] };

test('交互（回）：1日1回を2品で分ける → サバ缶0.5缶・鶏むね75g', () => {
  const { products } = combineConsumption([saba, mune], [protein]);
  assert.equal(products[0].consumption.dinner, 0.5);
  assert.equal(products[1].consumption.dinner, 75);
  // 鶏むね 600g パック → 1日 75g ＝ 0.125 パック
  assert.equal(dailyStockUse(products[1]), 0.125);
});

test('重さ（g）：200g を均等に、個の商品は1個の重さで換算、重さがなければ問題として返す', () => {
  const v = { ...veg, members: veg.members.slice(0, 3) };
  const { products, issues } = combineConsumption([broc, tama, nasu], [v]);
  const b = products.find((p) => p.id === 'broc');
  assert.equal(Math.round(b.consumption.lunch * 100) / 100, 33.33);
  assert.equal(Math.round(b.consumption.dinner * 100) / 100, 63.33); // 自分の30g + 33.33g
  assert.deepEqual(b.ownConsumption, broc.consumption);
  const t = products.find((p) => p.id === 'tama');
  assert.equal(Math.round(t.consumption.lunch * 1000) / 1000, 0.167); // 33.3g ÷ 200g
  assert.deepEqual(issues.map((i) => [i.product.id, i.reason]), [['nasu', 'no-weight']]);
});

test('グループだけの栄養（平均）', () => {
  const only = groupOnly(protein, [saba, mune, broc]);
  assert.equal(only.length, 2);
  const s = sumNutrients(only, 'dinner');
  // サバ缶 0.5缶×190g=95g → 165.3kcal、鶏むね 75g → 78.75kcal
  assert.equal(Math.round(s.totals.energy * 10) / 10, 244.1);
});

test('グループ入力の検証', () => {
  assert.equal(validateGroupInput({ name: '', members: [] }).ok, false);
  const r = validateGroupInput({ name: '主菜', unit: 'serving', c_dinner: '1', members: [{ productId: 'a', servingAmount: '' }] });
  assert.equal(r.ok, false);
  const ok = validateGroupInput({ name: '野菜', unit: 'g', c_lunch: '100', members: [{ productId: 'a' }] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value.consumption, { breakfast: 0, lunch: 100, dinner: 0 });
});

test('カテゴリの分割：商品は先頭の名前に残り、売り場順は元の直後に入る', () => {
  let n = 0;
  const id = () => `new${++n}`;
  const r = splitCategories(
    {
      categories: [
        { id: 'a', name: '野菜・果物', defaultOrder: 1 },
        { id: 'b', name: '卵', defaultOrder: 2 },
        { id: 'c', name: '調味料', defaultOrder: 3 },
        { id: 'd', name: '自分で作った', defaultOrder: 4 },
      ],
      storeShelfOrders: [
        { id: 's1', storeId: 'S', categoryId: 'b', sortOrder: 1 },
        { id: 's2', storeId: 'S', categoryId: 'a', sortOrder: 2 },
      ],
    },
    id
  );
  assert.deepEqual(r.categories.map((c) => c.name), ['野菜', '果物', '卵', '缶詰', '調味料', '自分で作った']);
  assert.equal(r.categories[0].id, 'a');
  assert.deepEqual(r.storeShelfOrders.map((s) => [s.categoryId, s.sortOrder]), [['b', 1], ['a', 2], ['new1', 3]]);
  // 2回目は何も変わらない
  assert.equal(splitCategories(r, id).changed, false);
});

test('分けたカテゴリを「・」でまとめ直す（商品・リスト・売り場順も）', () => {
  const r = mergeCategories({
    categories: [
      { id: 'v', name: '野菜', defaultOrder: 1 },
      { id: 'f', name: '果物', defaultOrder: 2 },
      { id: 'e', name: '卵', defaultOrder: 3 },
      { id: 'k', name: '缶詰', defaultOrder: 4 },
      { id: 'm', name: '自分の', defaultOrder: 5 },
    ],
    storeShelfOrders: [
      { id: 's1', storeId: 'S', categoryId: 'e', sortOrder: 1 },
      { id: 's2', storeId: 'S', categoryId: 'v', sortOrder: 2 },
      { id: 's3', storeId: 'S', categoryId: 'f', sortOrder: 3 },
    ],
    products: [{ id: 'banana', categoryId: 'f' }, { id: 'broc', categoryId: 'v' }],
    shoppingListItems: [{ id: 'i1', categoryId: 'f' }],
  });
  assert.deepEqual(r.categories.map((c) => `${c.name}:${c.defaultOrder}`), ['野菜・果物:1', '卵:2', '缶詰:3', '自分の:4']);
  assert.deepEqual(r.products.map((p) => p.categoryId), ['v', 'v']);
  assert.equal(r.shoppingListItems[0].categoryId, 'v');
  assert.deepEqual(r.storeShelfOrders.map((s) => [s.categoryId, s.sortOrder]), [['e', 1], ['v', 2]]);
  assert.equal(mergeCategories({ ...r, storeShelfOrders: r.storeShelfOrders }).changed, false);
});

test('v1.12 のカテゴリに組み直す（分ける・名前を変える・足す・並べる）', async () => {
  const { reorganizeCategories, DEFAULT_CATEGORIES } = await import('../js/domain/categories.js');
  let n = 0;
  const r = reorganizeCategories(
    {
      categories: [
        { id: 'v', name: '野菜・果物', defaultOrder: 1 },
        { id: 'm', name: '肉・魚', defaultOrder: 2 },
        { id: 'n', name: '納豆・豆腐', defaultOrder: 3 },
        { id: 'b', name: 'パン・米・麺', defaultOrder: 4 },
        { id: 'o', name: 'その他', defaultOrder: 5 },
        { id: 'x', name: '自分の', defaultOrder: 6 },
      ],
      storeShelfOrders: [
        { id: 's1', storeId: 'S', categoryId: 'm', sortOrder: 1 },
        { id: 's2', storeId: 'S', categoryId: 'v', sortOrder: 2 },
      ],
      products: [{ id: 'p', categoryId: 'n' }],
      shoppingListItems: [{ id: 'i', categoryId: 'b' }],
    },
    () => `new${++n}`
  );
  const names = r.categories.map((c) => c.name);
  assert.deepEqual(names, [...DEFAULT_CATEGORIES.slice(0, -1), '自分の', 'その他']);
  assert.deepEqual(r.categories.map((c) => c.defaultOrder), names.map((_, i) => i + 1));
  assert.equal(r.categories.find((c) => c.id === 'n').name, '豆類');
  assert.equal(r.products[0].categoryId, 'n');
  assert.equal(r.categories.find((c) => c.id === 'b').name, 'パン');
  // 売り場順：肉 → 魚（分けた）→ 野菜 → 果物 → 残りは最後
  const byId = new Map(r.categories.map((c) => [c.id, c.name]));
  const seq = r.storeShelfOrders.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => byId.get(s.categoryId));
  assert.deepEqual(seq.slice(0, 4), ['肉', '魚', '野菜', '果物']);
  assert.equal(seq.length, r.categories.length);
});

test('組み直し：同じ名前のカテゴリがすでにあれば、そちらへまとめる', async () => {
  const { reorganizeCategories } = await import('../js/domain/categories.js');
  let n = 0;
  const r = reorganizeCategories(
    {
      categories: [
        { id: 'v', name: '野菜・果物', defaultOrder: 1 },
        { id: 'v2', name: '野菜', defaultOrder: 2 },
      ],
      storeShelfOrders: [],
      products: [{ id: 'p', categoryId: 'v' }],
      shoppingListItems: [],
    },
    () => `new${++n}`
  );
  assert.ok(!r.categories.some((c) => c.id === 'v'));
  assert.equal(r.products[0].categoryId, 'v2');
  assert.equal(r.categories.filter((c) => c.name === '野菜').length, 1);
});

test('組み直し：分けたカテゴリの商品は番号・名前から振り分ける', async () => {
  const { guessPart } = await import('../js/domain/categories.js');
  assert.equal(guessPart({ name: 'バナナ' }, ['野菜', '果物']), '果物');
  assert.equal(guessPart({ name: 'にんじん' }, ['野菜', '果物']), null);
  assert.equal(guessPart({ name: 'うどん' }, ['パン', '米', '麺']), '麺');
  assert.equal(guessPart({ name: '無洗米' }, ['パン', '米', '麺']), '米');
  assert.equal(guessPart({ name: '食パン' }, ['パン', '米', '麺']), 'パン');
  assert.equal(guessPart({ name: '切り身', nutrition: { source: 'mext', code: '10134', name: 'さけ' } }, ['肉', '魚']), '魚');
  assert.equal(guessPart({ name: '鶏むね肉', nutrition: { source: 'mext', code: '11220' } }, ['肉', '魚']), '肉');
});
