// 健康・食材提案の固定データ（指示書 4-5）
// 一般的な栄養情報にもとづく「食生活のヒント」であり、病気の診断・治療・予防を目的としたものではない。
// 内容を見直す時は、断定的な効能（「治る」「防ぐ」「〜に効く」など）を書かないこと。
//
// cost: 'low' = 比較的安い／'mid' = ふつう（スーパーでの一般的な価格帯の目安）
// category: 買い物リスト・在庫に追加する時の売り場（在庫のカテゴリ名と一致すれば使われる）
// code: 日本食品標準成分表（八訂）の食品番号。在庫に追加する時、この栄養データを入れる

/**
 * @typedef {Object} Food
 * @property {string} name
 * @property {string} unit       リスト・在庫に追加する時の単位
 * @property {string} category
 * @property {'low'|'mid'} cost
 * @property {string} code       成分表の食品番号
 * @property {string} point      なぜおすすめか
 * @property {string} howTo      手軽な食べ方
 */

/**
 * @typedef {Object} HealthRecommendation
 * @property {string} id
 * @property {string} concern        悩み
 * @property {string[]} nutrients    関連する栄養素
 * @property {string} explanation    取り入れ方の考え方
 * @property {Food[]} foods          おすすめ食材
 * @property {string[]} suggestions  手軽な取り入れ方
 */

// よく使う食材（同じものを何度も書かないように）
const F = {
  egg: { name: '卵', unit: 'パック', category: '卵', cost: 'low', code: '12004' },
  natto: { name: '納豆', unit: 'パック', category: '豆類', cost: 'low', code: '04046' },
  tofu: { name: '豆腐', unit: '丁', category: '豆類', cost: 'low', code: '04032' },
  milk: { name: '牛乳', unit: '本', category: '乳製品', cost: 'low', code: '13003' },
  yogurt: { name: 'ヨーグルト', unit: '個', category: '乳製品', cost: 'low', code: '13025' },
  banana: { name: 'バナナ', unit: '房', category: '果物', cost: 'low', code: '07107' },
  kiwi: { name: 'キウイ', unit: '個', category: '果物', cost: 'low', code: '07054' },
  broccoli: { name: 'ブロッコリー', unit: '株', category: '野菜', cost: 'low', code: '06263' },
  komatsuna: { name: '小松菜', unit: '袋', category: '野菜', cost: 'low', code: '06086' },
  spinach: { name: 'ほうれん草', unit: '袋', category: '野菜', cost: 'low', code: '06267' },
  carrot: { name: 'にんじん', unit: '本', category: '野菜', cost: 'low', code: '06212' },
  onion: { name: '玉ねぎ', unit: '個', category: '野菜', cost: 'low', code: '06153' },
  chicken: { name: '鶏むね肉', unit: 'パック', category: '肉', cost: 'low', code: '11220' },
  pork: { name: '豚もも肉', unit: 'パック', category: '肉', cost: 'mid', code: '11131' },
  beef: { name: '牛もも肉（赤身）', unit: 'パック', category: '肉', cost: 'mid', code: '11076' },
  salmon: { name: '鮭', unit: '切れ', category: '魚', cost: 'mid', code: '10134' },
  saba: { name: 'サバ缶', unit: '缶', category: '缶詰', cost: 'low', code: '10164' },
  tuna: { name: 'ツナ缶', unit: '缶', category: '缶詰', cost: 'low', code: '10263' },
  asari: { name: 'あさり缶', unit: '缶', category: '缶詰', cost: 'mid', code: '10283' },
  oatmeal: { name: 'オートミール', unit: '袋', category: '米', cost: 'low', code: '01004' },
  brownRice: { name: '玄米', unit: '袋', category: '米', cost: 'mid', code: '01085' },
  almond: { name: 'アーモンド', unit: '袋', category: 'その他', cost: 'mid', code: '05001' },
  wakame: { name: 'わかめ（乾燥）', unit: '袋', category: 'その他', cost: 'low', code: '09044' },
};
/** 共通の食材に、この悩み向けの説明を付ける */
const food = (base, point, howTo) => ({ ...base, point, howTo });

/** @type {HealthRecommendation[]} */
export const HEALTH_RECOMMENDATIONS = [
  {
    id: 'fatigue',
    concern: '体の疲れ',
    nutrients: ['ビタミンB1', 'たんぱく質', '鉄', '炭水化物（主食）'],
    explanation:
      'ビタミンB1は糖質をエネルギーに変えるのに使われます。食事を抜いたり主食を極端に減らしたりせず、たんぱく質や鉄も含めてバランスよくとりましょう。',
    foods: [
      food(F.pork, 'ビタミンB1が特に多い', '玉ねぎと炒める、豚汁にする'),
      food(F.natto, 'ビタミンB群とたんぱく質', 'ご飯にのせる'),
      food(F.egg, '良質なたんぱく質', '目玉焼き・ゆで卵'),
      food(F.komatsuna, '鉄やカルシウムを含み、アク抜き不要', '炒め物や味噌汁に'),
      food(F.onion, '豚肉と合わせて使いやすい', '豚肉と炒める、スープに'),
      food(F.tuna, '常温保存できるたんぱく質源', 'サラダやおにぎりの具に'),
    ],
    suggestions: ['朝食を抜かず、主食＋たんぱく質をとる', '豚肉の料理を週に数回', '青菜を味噌汁や炒め物に足す'],
  },
  {
    id: 'mental',
    concern: '心の疲れ・ストレス',
    nutrients: ['たんぱく質（トリプトファン）', 'ビタミンB群', 'マグネシウム', 'ビタミンC'],
    explanation:
      '気持ちに関わる物質は、たんぱく質に含まれるアミノ酸とビタミンB群から体の中で作られます。忙しい時ほど食事を抜かず、規則正しく食べることが土台になります。つらい気持ちが続く時は、ひとりで抱えず医療機関や相談窓口を頼ってください。',
    foods: [
      food(F.banana, 'トリプトファン・ビタミンB6を含む', '朝食やおやつに'),
      food(F.natto, 'トリプトファンとマグネシウム', 'ご飯にのせる'),
      food(F.salmon, 'たんぱく質とビタミンB群・D', '焼くだけ、鮭フレークも便利'),
      food(F.milk, 'トリプトファンとカルシウム', '温めて飲む'),
      food(F.almond, 'マグネシウムを含む', '素焼きをひとつかみ'),
      food(F.kiwi, 'ビタミンCが多い', '半分に切ってスプーンで'),
    ],
    suggestions: ['1日3食を同じくらいの時間に', '朝にたんぱく質と日光を', '甘い物やカフェインに頼りすぎない'],
  },
  {
    id: 'eyes',
    concern: '目の疲れ',
    nutrients: ['ビタミンA', 'ルテイン（緑黄色野菜）', 'DHA・EPA（青魚）', 'ビタミンB群'],
    explanation:
      'ビタミンAは目の働きに関わる栄養素です。色の濃い野菜や青魚を日々の食事に取り入れましょう。食事だけでなく、画面から定期的に目を離して休めることが大切です。',
    foods: [
      food(F.spinach, 'ルテイン・βカロテンを含む', 'おひたし、冷凍品も便利'),
      food(F.carrot, 'βカロテンが多い（油と一緒に）', '細切りを炒める'),
      food(F.saba, 'DHA・EPAを手軽にとれる', 'そのまま、味噌汁やパスタに'),
      food(F.egg, 'ルテイン・ビタミンAを含む', 'ゆで卵の作り置き'),
      food(F.broccoli, 'ルテイン・ビタミンCを含む', 'レンジ蒸し'),
      { name: 'ブルーベリー（冷凍）', unit: '袋', category: '果物', cost: 'mid', code: '07124', point: 'アントシアニンを含む', howTo: 'ヨーグルトにのせる' },
    ],
    suggestions: ['画面を見る時は1時間に1回は遠くを見る', '緑黄色野菜を毎日1品', '青魚を週2回（缶詰でも）'],
  },
  {
    id: 'sluggish',
    concern: 'だるさ',
    nutrients: ['鉄', 'ビタミンB1', 'たんぱく質', '水分'],
    explanation:
      '鉄やビタミンB1が足りない、水分が少ない、食事が偏っている、などがだるさにつながることがあります。だるさが長く続く、急に強くなった時は医療機関に相談してください。',
    foods: [
      food(F.pork, 'ビタミンB1が多い', '生姜焼き・豚汁に'),
      food(F.asari, '鉄を手軽にとれる', '味噌汁・パスタ・炊き込みご飯に'),
      food(F.komatsuna, '鉄を含む青菜', '炒め物・味噌汁に'),
      food(F.natto, '鉄・ビタミンB群・たんぱく質', 'ご飯にのせる'),
      food(F.egg, 'たんぱく質と鉄', '毎日1〜2個'),
      food(F.brownRice, 'ビタミンB1が白米より多い', '白米に混ぜて炊く'),
    ],
    suggestions: ['水やお茶をこまめに飲む', '主食を抜かない', '肉・魚・卵・大豆製品を毎食どれか'],
  },
  {
    id: 'motivation',
    concern: 'やる気が出ない',
    nutrients: ['たんぱく質', '鉄', 'ビタミンB群', '朝食のエネルギー'],
    explanation:
      'やる気に関わる物質も、たんぱく質と鉄・ビタミンB群から作られます。まずは朝食をとってエネルギーを入れることから。気分の落ち込みや意欲の低下が2週間以上続く時は、医療機関や相談窓口に相談してください。',
    foods: [
      food(F.egg, 'たんぱく質を手軽に', '朝食に1つ足す'),
      food(F.chicken, '安くて高たんぱく', 'レンジ蒸しで作り置き'),
      food(F.beef, '鉄とたんぱく質', '焼くだけ・炒め物に'),
      food(F.natto, 'たんぱく質・鉄・ビタミンB群', 'ご飯にのせる'),
      food(F.banana, 'すぐエネルギーになる', '朝の1本'),
      food(F.oatmeal, '朝の主食に手軽', '牛乳でレンジ加熱'),
    ],
    suggestions: ['朝食を少しでも食べる', '毎食たんぱく質を入れる', '甘い物だけで済ませない'],
  },
  {
    id: 'focus',
    concern: '集中力',
    nutrients: ['炭水化物（ゆっくり吸収されるもの）', 'たんぱく質', 'DHA・EPA', '鉄', '水分'],
    explanation:
      '脳のエネルギー源はブドウ糖です。食物繊維の多い主食を適量とると、血糖値の上がり下がりがゆるやかになります。食べすぎると眠くなるので、量は腹八分目に。水分不足にも気をつけましょう。',
    foods: [
      food(F.oatmeal, '食物繊維が多い主食', '朝食や間食に'),
      food(F.brownRice, '食物繊維とビタミンB1', '白米に混ぜて炊く'),
      food(F.saba, 'DHA・EPA', 'そのまま、ご飯のおかずに'),
      food(F.egg, 'たんぱく質とコリンを含む', 'ゆで卵を間食に'),
      food(F.almond, '間食向き', '甘いお菓子の代わりにひとつかみ'),
      food(F.banana, '手軽なエネルギー源', '作業前に半分'),
    ],
    suggestions: ['昼食は腹八分目に', '間食はナッツ・果物・ヨーグルトに', 'デスクに水を置く'],
  },
  {
    id: 'sleep',
    concern: '睡眠の質',
    nutrients: ['トリプトファン（たんぱく質に含まれる）', 'ビタミンB6', 'マグネシウム'],
    explanation:
      'トリプトファンは体内で睡眠に関わる物質の材料になります。食品よりも、夕食を寝る2〜3時間前までに済ませる、夕方以降のカフェインやお酒を控えるといった習慣の影響が大きいとされています。',
    foods: [
      food(F.milk, 'トリプトファンを含む', '温めて飲む'),
      food(F.banana, 'ビタミンB6やマグネシウムを含む', 'ヨーグルトと一緒に'),
      food(F.tofu, 'たんぱく質とマグネシウム。夕食でも胃にやさしい', '湯豆腐・冷奴・味噌汁に'),
      food(F.natto, 'トリプトファンとマグネシウム', 'ご飯にのせる'),
      food(F.egg, 'トリプトファンを含む', '朝食で。朝にたんぱく質をとるのもリズム作りに'),
    ],
    suggestions: ['夕食は寝る2〜3時間前までに', '夕方以降はカフェインを控える', '朝食で日光を浴びながらたんぱく質を'],
  },
  {
    id: 'constipation',
    concern: '便秘',
    nutrients: ['食物繊維（水溶性・不溶性）', '水分', '発酵食品の菌', 'オリゴ糖'],
    explanation:
      '食物繊維には、水に溶ける「水溶性」と溶けない「不溶性」があり、両方をとるのが基本です。食物繊維を増やす時は水分も一緒にとりましょう。',
    foods: [
      food(F.oatmeal, '水溶性の食物繊維を手軽にとれる', '牛乳やお湯で1〜2分レンジ加熱'),
      { name: 'ごぼう', unit: '本', category: '野菜', cost: 'low', code: '06084', point: '不溶性の食物繊維が多い', howTo: '味噌汁やきんぴらに。水煮も便利' },
      food(F.kiwi, '食物繊維とビタミンC', '半分に切ってスプーンで'),
      food(F.natto, '発酵食品で食物繊維も含む', 'オクラやめかぶと混ぜる'),
      food(F.wakame, '水溶性の食物繊維。日持ちする', '味噌汁やスープにひとつまみ'),
      { name: 'さつまいも', unit: '本', category: '野菜', cost: 'low', code: '02045', point: '食物繊維が多く続けやすい', howTo: 'レンジ加熱、皮ごと食べる' },
    ],
    suggestions: ['朝食にオートミールやバナナを足す', '味噌汁に海藻やきのこを入れる', '食事のたびにコップ1杯の水'],
  },
  {
    id: 'gut',
    concern: '腸内環境',
    nutrients: ['発酵食品の菌（乳酸菌・納豆菌など）', '食物繊維', 'オリゴ糖'],
    explanation:
      '菌を含む発酵食品と、腸内の菌のエサになる食物繊維・オリゴ糖を組み合わせてとるのが基本です。いろいろな種類を毎日少しずつ続けましょう。',
    foods: [
      food(F.yogurt, '乳酸菌などを含む', 'バナナやオートミールをのせる'),
      food(F.natto, '納豆菌と食物繊維', 'キムチと混ぜる'),
      { name: 'キムチ', unit: 'パック', category: 'その他', cost: 'mid', code: '06236', point: '乳酸菌を含む発酵食品', howTo: '納豆や豆腐にのせる（塩分に注意）' },
      { name: '味噌', unit: 'パック', category: '調味料', cost: 'low', code: '17045', point: '発酵食品で毎日使いやすい', howTo: '具だくさんの味噌汁に' },
      food(F.onion, 'オリゴ糖を含む', 'スープ・炒め物に'),
      food(F.banana, 'オリゴ糖と食物繊維', 'ヨーグルトと一緒に'),
    ],
    suggestions: ['「ヨーグルト＋バナナ」「納豆＋キムチ」の組み合わせ', '具だくさんの味噌汁を1日1杯', 'いろいろな発酵食品を回す'],
  },
  {
    id: 'skin',
    concern: '肌の調子',
    nutrients: ['たんぱく質', 'ビタミンC', 'ビタミンA（βカロテン）', 'ビタミンB2・B6'],
    explanation:
      '肌はたんぱく質から作られ、ビタミン類がその働きを支えます。たんぱく質と色の濃い野菜・果物を毎日少しずつとるのが近道です。',
    foods: [
      food(F.egg, 'たんぱく質とビタミンB2', 'ゆで卵を作り置き'),
      food(F.broccoli, 'ビタミンCが多い', 'レンジ蒸し、冷凍品も'),
      food(F.carrot, 'βカロテンが多い（油と一緒に）', '細切りを炒める、ツナと和える'),
      food(F.salmon, 'たんぱく質とビタミンB群', 'フライパンで焼くだけ'),
      food(F.natto, 'たんぱく質とビタミンB2', 'ご飯にのせる'),
      food(F.kiwi, 'ビタミンCが多い', '朝食やデザートに'),
    ],
    suggestions: ['毎食、手のひら1枚分のたんぱく質', '色の濃い野菜を1日1回', '果物を間食に'],
  },
  {
    id: 'immunity',
    concern: '免疫・風邪予防',
    nutrients: ['たんぱく質', 'ビタミンC', 'ビタミンD', '亜鉛', 'ビタミンA'],
    explanation:
      '体の守りの働きには、たんぱく質と各種ビタミン・ミネラルが関わります。特定の食品で風邪を防げるわけではないので、睡眠・手洗いとあわせて偏りのない食事を。',
    foods: [
      food(F.broccoli, 'ビタミンCが多い', 'レンジ蒸しで副菜に'),
      food(F.salmon, 'ビタミンDとたんぱく質', '焼き鮭、鮭フレーク'),
      { name: 'しいたけ', unit: 'パック', category: '野菜', cost: 'low', code: '08039', point: 'ビタミンDを含む', howTo: '味噌汁・炒め物に' },
      food(F.egg, 'たんぱく質・ビタミンA・D', '毎日1〜2個'),
      food(F.pork, '亜鉛とたんぱく質', '野菜と一緒に炒める'),
      { name: 'みかん', unit: '袋', category: '果物', cost: 'low', code: '07027', point: 'ビタミンCを手軽に', howTo: '間食に' },
    ],
    suggestions: ['野菜か果物を毎食どこかに', '魚を週2回以上', 'たんぱく質を毎食'],
  },
  {
    id: 'muscle',
    concern: '筋肉・体づくり',
    nutrients: ['たんぱく質', '炭水化物（エネルギー）', 'ビタミンD', 'カルシウム'],
    explanation:
      '筋肉の材料はたんぱく質で、毎食に分けてとるのがよいとされています。エネルギーが足りないとたんぱく質がエネルギーに使われるため、主食も抜かないように。',
    foods: [
      food(F.chicken, '安くて高たんぱく・低脂質', 'レンジ蒸し、サラダチキンに'),
      food(F.egg, '良質なたんぱく質で調理が簡単', 'ゆで卵の作り置き'),
      food(F.saba, 'たんぱく質とビタミンD', 'そのまま、味噌汁やパスタに'),
      food(F.natto, '植物性たんぱく質', 'ご飯にのせる'),
      food(F.yogurt, 'たんぱく質とカルシウム', '運動後や朝食に'),
      food(F.tofu, '安価なたんぱく質', '冷奴・味噌汁・炒め物に'),
    ],
    suggestions: ['朝・昼・夕それぞれにたんぱく質', '運動した日は主食も適量', 'サバ缶・ツナ缶を常備'],
  },
  {
    id: 'stamina',
    concern: '精力・スタミナ',
    nutrients: ['亜鉛', 'たんぱく質', 'ビタミンB1', 'ビタミンB2'],
    explanation:
      '亜鉛は男性ホルモンや生殖に関わるミネラルで、不足しがちな栄養素のひとつです。たんぱく質と、糖質をエネルギーに変えるビタミンB群もあわせてとりましょう。睡眠・運動・お酒を控えめにすることも大切です。気になる状態が続く時は医療機関（泌尿器科など）に相談を。',
    foods: [
      { name: '牡蠣', unit: 'パック', category: '魚', cost: 'mid', code: '10292', point: '亜鉛が特に多い', howTo: '鍋・ソテー・牡蠣フライに（加熱用は中まで火を通す）' },
      { name: '豚ヒレ肉', unit: 'パック', category: '肉', cost: 'mid', code: '11140', point: 'ビタミンB1が多く脂質が少ない', howTo: 'ソテー・ヒレカツに' },
      food(F.beef, '亜鉛とたんぱく質', '焼くだけ・炒め物に'),
      { name: 'うなぎ（かば焼き）', unit: '尾', category: '魚', cost: 'mid', code: '10070', point: 'ビタミンA・B1・B2・亜鉛', howTo: 'うな丼・ひつまぶしに（ときどきのごちそうに）' },
      { name: 'にんにく', unit: '個', category: '野菜', cost: 'low', code: '06223', point: '豚肉のビタミンB1と合わせると吸収されやすい', howTo: '豚肉の炒め物に少し' },
      food(F.egg, 'たんぱく質と亜鉛', '毎日1〜2個'),
    ],
    suggestions: ['牡蠣や赤身肉を週に何回か', '豚肉にはにんにく・玉ねぎを合わせる', '寝る時間を確保し、お酒は控えめに'],
  },
  {
    id: 'weight',
    concern: '体重管理',
    nutrients: ['たんぱく質', '食物繊維', '水分の多い食品'],
    explanation:
      'たんぱく質と食物繊維は満足感を得やすく、野菜やきのこはカロリーを抑えながら量を食べられます。極端な制限は続かず体調を崩すもとなので、少しずつの調整を。',
    foods: [
      food(F.chicken, '高たんぱく・低脂質', 'レンジ蒸しやそぎ切りで炒める'),
      food(F.tofu, '低カロリーでたんぱく質', 'ご飯の一部を豆腐に'),
      { name: 'しめじ', unit: 'パック', category: '野菜', cost: 'low', code: '08016', point: '低カロリーで食物繊維が多い', howTo: '炒め物・スープでかさ増し' },
      { name: 'キャベツ', unit: '玉', category: '野菜', cost: 'low', code: '06061', point: 'かさがあり、よく噛む', howTo: '食事の最初にせん切り' },
      { name: 'もやし', unit: '袋', category: '野菜', cost: 'low', code: '06291', point: 'とても安く、かさ増しに', howTo: 'レンジでナムル' },
      food(F.wakame, 'ほぼカロリーなしで食物繊維', 'スープ・酢の物に'),
    ],
    suggestions: ['野菜・たんぱく質から先に食べる', 'ご飯を少し減らし、きのこや野菜でかさ増し', '甘い飲み物を水やお茶に'],
  },
  {
    id: 'cold',
    concern: '冷え',
    nutrients: ['たんぱく質', '鉄', 'ビタミンE', 'ビタミンB群', '温かい料理'],
    explanation:
      '体の熱は食べた物から作られます。食事量が少なすぎない、たんぱく質をとる、温かい料理を選ぶ、が基本です。',
    foods: [
      { name: 'しょうが', unit: '個', category: '野菜', cost: 'low', code: '06103', point: '料理を温かく食べる工夫に', howTo: 'すりおろしてスープ・炒め物に' },
      { name: 'かぼちゃ', unit: '個', category: '野菜', cost: 'low', code: '06048', point: 'ビタミンE・βカロテン', howTo: 'レンジ蒸し、スープに' },
      { name: '鶏もも肉', unit: 'パック', category: '肉', cost: 'low', code: '11221', point: 'たんぱく質。鍋や煮込みに', howTo: '鍋・スープに' },
      food(F.egg, 'たんぱく質', 'スープに落とす'),
      food(F.almond, 'ビタミンEが多い', 'ひとつかみ'),
      food(F.natto, '鉄とたんぱく質', '温かい味噌汁に入れても'),
    ],
    suggestions: ['冷たい飲み物を温かいものに', '具だくさんのスープ・鍋を', '朝食を抜かない'],
  },
  {
    id: 'swelling',
    concern: 'むくみ',
    nutrients: ['カリウム', '塩分を控える', 'たんぱく質'],
    explanation:
      'カリウムは余分な塩分を体の外に出すのを助けます。あわせて塩分を控えめに。腎臓の病気などでカリウムを制限されている方は、医師の指示にしたがってください。',
    foods: [
      food(F.banana, 'カリウムが多い', 'そのまま'),
      { name: 'アボカド', unit: '個', category: '果物', cost: 'mid', code: '07006', point: 'カリウムが多い', howTo: 'わさび醤油・サラダに' },
      { name: 'きゅうり', unit: '本', category: '野菜', cost: 'low', code: '06065', point: '水分とカリウム', howTo: '浅漬け（塩少なめ）・サラダ' },
      food(F.spinach, 'カリウムが多い', 'おひたし'),
      food(F.natto, 'カリウムとたんぱく質', 'ご飯にのせる'),
      { name: 'じゃがいも', unit: '個', category: '野菜', cost: 'low', code: '02017', point: 'カリウムを含む', howTo: 'レンジ蒸し、味噌汁に' },
    ],
    suggestions: ['汁物は具だくさんにして汁を少なめに', '加工食品・外食の塩分に注意', '野菜・果物を毎食'],
  },
  {
    id: 'iron',
    concern: '貧血ぎみ（鉄不足）',
    nutrients: ['鉄', 'ビタミンC（鉄の吸収を助ける）', 'たんぱく質', '葉酸・ビタミンB12'],
    explanation:
      '肉や魚の鉄は吸収されやすく、野菜や大豆の鉄はビタミンCと一緒にとると吸収されやすくなります。サプリメントを自己判断で多くとるのは避け、症状がある時は医療機関で検査を。',
    foods: [
      food(F.beef, '吸収されやすい鉄', '焼くだけ・炒め物に'),
      food(F.asari, '鉄とビタミンB12', '味噌汁・パスタに'),
      { name: '鶏レバー', unit: 'パック', category: '肉', cost: 'low', code: '11232', point: '鉄が特に多い（ビタミンAも多いので食べすぎに注意）', howTo: '甘辛煮を少量ずつ' },
      food(F.komatsuna, '鉄とカルシウム', 'ビタミンCの多い食材と一緒に'),
      food(F.natto, '鉄と葉酸', 'ご飯にのせる'),
      food(F.kiwi, 'ビタミンCで鉄の吸収を助ける', '食後のデザートに'),
    ],
    suggestions: ['肉・魚を毎日どこかで', '青菜には果物や野菜のビタミンCを合わせる', '食事中の濃いお茶・コーヒーは控えめに'],
  },
  {
    id: 'bone',
    concern: '骨・歯',
    nutrients: ['カルシウム', 'ビタミンD', 'ビタミンK', 'たんぱく質'],
    explanation:
      'カルシウムに加えて、吸収を助けるビタミンD、骨づくりに関わるビタミンKとたんぱく質を一緒にとりましょう。日光にあたることや、体を動かすことも大切です。',
    foods: [
      food(F.milk, 'カルシウムを手軽にとれる', '1日コップ1杯'),
      food(F.yogurt, 'カルシウムとたんぱく質', '朝食や間食に'),
      food(F.komatsuna, 'カルシウムとビタミンK', '炒め物・味噌汁に'),
      food(F.salmon, 'ビタミンDが多い', '焼き鮭'),
      { name: 'しらす', unit: 'パック', category: '魚', cost: 'mid', code: '10055', point: 'カルシウムとビタミンD', howTo: 'ご飯・卵焼きに' },
      food(F.natto, 'ビタミンKが多い', 'ご飯にのせる'),
    ],
    suggestions: ['乳製品を1日1〜2回', '魚を週2回以上', '日中に外を歩く'],
  },
];

/**
 * 栄養からのおすすめ（v1.11）。食事タブの「1日」の栄養が目標から外れている時に、食材の提案の上に出す。
 * id は「栄養素-low / -high」。表示は気になることと同じ形（nutrients・explanation・foods・suggestions）
 * @type {Record<string, Omit<HealthRecommendation, 'id'>>}
 */
const RICE = { name: 'ご飯（精白米）', unit: '袋', category: '米', cost: 'low', code: '01088' };
const BREAD = { name: '食パン', unit: '袋', category: 'パン', cost: 'low', code: '01026' };
const SWEET_POTATO = { name: 'さつまいも', unit: '本', category: '野菜', cost: 'low', code: '02006' };
const SHIMEJI = { name: 'しめじ', unit: 'パック', category: '野菜', cost: 'low', code: '08016' };
const ENOKI = { name: 'えのき', unit: '袋', category: '野菜', cost: 'low', code: '08001' };
const AVOCADO = { name: 'アボカド', unit: '個', category: '果物', cost: 'mid', code: '07006' };
const KONNYAKU = { name: 'こんにゃく', unit: '枚', category: 'その他', cost: 'low', code: '02003' };

export const NUTRIENT_ADVICE = {
  'energy-low': {
    concern: 'エネルギーが足りない',
    nutrients: ['エネルギー', '炭水化物', 'たんぱく質'],
    explanation: '必要な量より少ない状態が続くと、疲れやすさや筋肉が減る原因になります。主食を抜かず、間食で足すのも手です。',
    foods: [
      food(RICE, '手軽にエネルギーをとれる', '毎食お茶わん1杯'),
      food(F.banana, '間食で手軽に', '朝食や小腹がすいた時に'),
      food(F.oatmeal, 'エネルギーと食物繊維', '牛乳をかけてレンジで'),
      food(F.almond, '少量でエネルギーが多い', '間食にひとつかみ'),
      food(F.egg, 'たんぱく質も一緒に', '1品足す'),
      food(SWEET_POTATO, '腹持ちのよい炭水化物', 'ふかし芋・焼き芋に'),
    ],
    suggestions: ['主食を毎食とる', '間食にバナナやナッツ', 'おかずを1品足す'],
  },
  'energy-high': {
    concern: 'エネルギーが多い',
    nutrients: ['エネルギー', '脂質', '食物繊維'],
    explanation: '必要な量より多い状態が続くと体重が増えやすくなります。量を減らすより、低エネルギーでかさのある食材に置き換えるのが続けやすい方法です。',
    foods: [
      food(F.broccoli, '低エネルギーでかさがある', '主食の前に食べる'),
      food(SHIMEJI, 'ほぼエネルギーがなく食物繊維が多い', '炒め物・汁物のかさ増しに'),
      food(ENOKI, 'かさ増しに使いやすい', 'スープ・鍋・ハンバーグに混ぜる'),
      food(KONNYAKU, 'とてもエネルギーが少ない', '煮物・炒め物に'),
      food(F.tofu, '肉の一部を置き換え', '豆腐ハンバーグ・麻婆豆腐に'),
      food(F.chicken, '脂質の少ない肉に置き換え', '皮を除いて調理'),
    ],
    suggestions: ['野菜・きのこから先に食べる', '揚げ物を焼く・蒸すに', '飲み物の糖分に気をつける'],
  },
  'protein-low': {
    concern: 'たんぱく質が足りない',
    nutrients: ['たんぱく質'],
    explanation: '筋肉・肌・髪などの材料になります。1日に分けて毎食とるのがよいとされています。',
    foods: [
      food(F.chicken, '安くて高たんぱく・低脂質', 'レンジ蒸し・サラダチキンに'),
      food(F.egg, '調理が簡単', 'ゆで卵の作り置き'),
      food(F.natto, '植物性たんぱく質', 'ご飯にのせる'),
      food(F.saba, 'たんぱく質と良質な脂', 'そのまま・味噌汁に'),
      food(F.tuna, '手軽に足せる', 'サラダ・おにぎりに'),
      food(F.yogurt, '朝食や間食で足せる', '朝食に1個'),
    ],
    suggestions: ['朝・昼・夕それぞれにたんぱく質', '缶詰・卵・納豆を常備', '間食をヨーグルトに'],
  },
  'protein-high': {
    concern: 'たんぱく質が多い',
    nutrients: ['たんぱく質', '炭水化物'],
    explanation: 'エネルギーのうちたんぱく質の割合が高すぎる状態です。主食や野菜とのバランスを見直しましょう。腎臓の病気がある方は医師に相談を。',
    foods: [
      food(RICE, '主食で炭水化物を足す', '毎食お茶わん1杯'),
      food(F.broccoli, '野菜でバランスをとる', '付け合わせに'),
      food(F.carrot, '野菜でバランスをとる', '炒め物・スープに'),
      food(F.banana, '果物で炭水化物を足す', '朝食に'),
    ],
    suggestions: ['主食を抜かない', 'プロテイン飲料は量を見直す', '野菜のおかずを1品'],
  },
  'fat-low': {
    concern: '脂質が足りない',
    nutrients: ['脂質（エネルギー比20%以上）'],
    explanation: '脂質はエネルギー源で、脂溶性ビタミンの吸収にも必要です。魚やナッツなど質のよい脂から足しましょう。',
    foods: [
      food(F.saba, '青魚の脂（DHA・EPA）', 'そのまま・パスタに'),
      food(F.salmon, '魚の脂', '焼き鮭'),
      food(F.almond, '植物性の脂', '間食にひとつかみ'),
      food(AVOCADO, '植物性の脂', 'サラダ・トーストに'),
      food(F.egg, '手軽に足せる', '1日1〜2個'),
    ],
    suggestions: ['魚を週2回以上', '間食をナッツに', 'サラダにオイルを少し'],
  },
  'fat-high': {
    concern: '脂質が多い',
    nutrients: ['脂質（エネルギー比30%まで）'],
    explanation: '脂質はエネルギーが高いため、多いとエネルギーのとりすぎにつながります。脂の少ない食材や調理法に置き換えましょう。',
    foods: [
      food(F.chicken, '脂質の少ない肉', '皮を除いて'),
      food(F.tofu, '肉の一部を置き換え', '豆腐ハンバーグに'),
      food(F.broccoli, '低脂質でかさがある', '蒸す・ゆでる'),
      food(SHIMEJI, '油を使わずかさ増し', '汁物・ホイル焼きに'),
      food(F.yogurt, '間食の置き換えに', 'お菓子の代わりに'),
    ],
    suggestions: ['揚げ物を焼く・蒸す・ゆでるに', '肉は脂の少ない部位に', 'ドレッシング・マヨネーズは量を控えめに'],
  },
  'carb-low': {
    concern: '炭水化物が足りない',
    nutrients: ['炭水化物（エネルギー比50%以上）'],
    explanation: '炭水化物は体や脳の主なエネルギー源です。足りないと疲れやすく、たんぱく質がエネルギーに使われてしまいます。',
    foods: [
      food(RICE, '主なエネルギー源', '毎食お茶わん1杯'),
      food(BREAD, '朝食に手軽', 'トーストに'),
      food(F.oatmeal, '食物繊維も多い', '牛乳をかけてレンジで'),
      food(F.banana, '間食で足せる', '朝食や運動前に'),
      food(SWEET_POTATO, '腹持ちがよい', 'ふかし芋に'),
    ],
    suggestions: ['主食を毎食とる', '間食に果物', '玄米・オートミールも取り入れる'],
  },
  'carb-high': {
    concern: '炭水化物が多い',
    nutrients: ['炭水化物（エネルギー比65%まで）', 'たんぱく質'],
    explanation: '主食やお菓子・甘い飲み物にかたよっている状態です。主食の量はそのままに、たんぱく質や野菜のおかずを足してバランスをとりましょう。',
    foods: [
      food(F.chicken, 'たんぱく質のおかずを足す', 'レンジ蒸しに'),
      food(F.egg, 'たんぱく質を手軽に', '1品足す'),
      food(F.tofu, 'たんぱく質を手軽に', '冷奴・味噌汁に'),
      food(F.broccoli, '野菜のおかずを足す', '付け合わせに'),
      food(SHIMEJI, 'かさ増しに', '汁物・炒め物に'),
    ],
    suggestions: ['甘い飲み物をお茶・水に', '主食は適量、おかずを増やす', 'お菓子を果物・ヨーグルトに'],
  },
};

export const HEALTH_DISCLAIMER =
  '一般的な栄養情報で、診断や治療の代わりにはなりません。持病・服薬中（例：ワルファリンと納豆）・妊娠中・アレルギーのある方は医師や管理栄養士に相談を。';
