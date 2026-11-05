// 日本人の食事摂取基準（2025年版）成人の値
// 出典：厚生労働省告示第199号（令和6年11月22日 告示第339号で全部改正、令和7年4月1日適用）
//   https://www.mhlw.go.jp/web/t_doc?dataId=78ab4652
//   策定検討会報告書・正誤表（令和7年3月25日）：https://www.mhlw.go.jp/stf/newpage_44138.html
// 妊娠中・授乳中の付加量は含まない。18歳未満は対象外。
//
// energy: 推定エネルギー必要量 kcal（身体活動レベル I=低い / II=ふつう / III=高い。75歳以上は III なし）
// protein: たんぱく質 推奨量 g    proteinPct / fatPct / carbPct: 目標量（エネルギー比 %）
// fiber: 食物繊維 目標量 g 以上   salt: 食塩相当量 目標量 g 未満
// calcium mg, iron mg（ironMenstruation=月経ありの場合）, vitA µgRAE, vitB1 mg, vitB2 mg, vitC mg: 推奨量
// vitD µg: 目安量

export const DRI_SOURCE = '日本人の食事摂取基準（2025年版）厚生労働省';

export const AGE_BANDS = [
  { key: '18-29', min: 18, max: 29 },
  { key: '30-49', min: 30, max: 49 },
  { key: '50-64', min: 50, max: 64 },
  { key: '65-74', min: 65, max: 74 },
  { key: '75+', min: 75, max: 200 },
];

export const DRI = {
  male: {
    '18-29': { energy: { I: 2250, II: 2600, III: 3000 }, protein: 65, proteinPct: [13, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 20, salt: 7.5, calcium: 800, iron: 7.0, vitA: 850, vitD: 9.0, vitB1: 1.1, vitB2: 1.6, vitC: 100 },
    '30-49': { energy: { I: 2350, II: 2750, III: 3150 }, protein: 65, proteinPct: [13, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 22, salt: 7.5, calcium: 750, iron: 7.5, vitA: 900, vitD: 9.0, vitB1: 1.2, vitB2: 1.7, vitC: 100 },
    '50-64': { energy: { I: 2250, II: 2650, III: 3000 }, protein: 65, proteinPct: [14, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 22, salt: 7.5, calcium: 750, iron: 7.0, vitA: 900, vitD: 9.0, vitB1: 1.1, vitB2: 1.6, vitC: 100 },
    '65-74': { energy: { I: 2100, II: 2350, III: 2650 }, protein: 60, proteinPct: [15, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 21, salt: 7.5, calcium: 750, iron: 7.0, vitA: 850, vitD: 9.0, vitB1: 1.0, vitB2: 1.4, vitC: 100 },
    '75+': { energy: { I: 1850, II: 2250, III: null }, protein: 60, proteinPct: [15, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 20, salt: 7.5, calcium: 750, iron: 6.5, vitA: 800, vitD: 9.0, vitB1: 1.0, vitB2: 1.4, vitC: 100 },
  },
  female: {
    '18-29': { energy: { I: 1700, II: 1950, III: 2250 }, protein: 50, proteinPct: [13, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 18, salt: 6.5, calcium: 650, iron: 6.0, ironMenstruation: 10.0, vitA: 650, vitD: 9.0, vitB1: 0.8, vitB2: 1.2, vitC: 100 },
    '30-49': { energy: { I: 1750, II: 2050, III: 2350 }, protein: 50, proteinPct: [13, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 18, salt: 6.5, calcium: 650, iron: 6.0, ironMenstruation: 10.5, vitA: 700, vitD: 9.0, vitB1: 0.9, vitB2: 1.2, vitC: 100 },
    '50-64': { energy: { I: 1700, II: 1950, III: 2250 }, protein: 50, proteinPct: [14, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 18, salt: 6.5, calcium: 650, iron: 6.0, ironMenstruation: 10.5, vitA: 700, vitD: 9.0, vitB1: 0.8, vitB2: 1.2, vitC: 100 },
    '65-74': { energy: { I: 1650, II: 1850, III: 2050 }, protein: 50, proteinPct: [15, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 18, salt: 6.5, calcium: 650, iron: 6.0, ironMenstruation: null, vitA: 700, vitD: 9.0, vitB1: 0.8, vitB2: 1.1, vitC: 100 },
    '75+': { energy: { I: 1450, II: 1750, III: null }, protein: 50, proteinPct: [15, 20], fatPct: [20, 30], carbPct: [50, 65], fiber: 17, salt: 6.5, calcium: 600, iron: 5.5, ironMenstruation: null, vitA: 650, vitD: 9.0, vitB1: 0.7, vitB2: 1.1, vitC: 100 },
  },
};

/** 耐容上限量（成人共通）。これを超えると「多すぎ」と表示する */
export const UPPER_LIMITS = { calcium: 2500, vitA: 2700, vitD: 100 };

// ---- 体重から自分のエネルギー必要量を計算するための値（2025年版）----
// 推定エネルギー必要量 = 基礎代謝基準値 × 体重 × 身体活動レベル
// 出典：同報告書（エネルギー）。千葉県・岡山県・吹田市の2025年版資料、厚生労働省「策定のポイント」で照合

/** 基礎代謝基準値（kcal/kg体重/日） */
export const BMR_STANDARD = {
  male: { '18-29': 23.7, '30-49': 22.5, '50-64': 21.8, '65-74': 21.6, '75+': 21.5 },
  female: { '18-29': 22.1, '30-49': 21.9, '50-64': 20.7, '65-74': 20.7, '75+': 20.7 },
};

/** 身体活動レベル（低い I・ふつう II・高い III）。75歳以上は「高い」なし */
export const PAL = {
  '18-29': { I: 1.5, II: 1.75, III: 2.0 },
  '30-49': { I: 1.5, II: 1.75, III: 2.0 },
  '50-64': { I: 1.5, II: 1.75, III: 2.0 },
  '65-74': { I: 1.5, II: 1.7, III: 1.9 },
  '75+': { I: 1.4, II: 1.7, III: null },
};

/** 目標とする BMI の範囲（kg/m²） */
export const BMI_TARGET = {
  '18-29': [18.5, 24.9],
  '30-49': [18.5, 24.9],
  '50-64': [20.0, 24.9],
  '65-74': [21.5, 24.9],
  '75+': [21.5, 24.9],
};
