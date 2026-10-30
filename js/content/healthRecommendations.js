// 健康・食材提案の固定データ（指示書 4-5）
// 一般的な栄養情報にもとづく「食生活のヒント」であり、病気の診断・治療・予防を目的としたものではない。
// 内容を見直す時は、断定的な効能（「治る」「防ぐ」など）を書かないこと。
//
// cost: 'low' = 比較的安い／'mid' = ふつう   （スーパーでの一般的な価格帯の目安）
// category: 買い物リストに追加する時の売り場（在庫画面のカテゴリ名と一致すれば使われる）

/**
 * @typedef {Object} Food
 * @property {string} name
 * @property {string} unit       リストに追加する時の単位
 * @property {string} category
 * @property {'low'|'mid'} cost
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

/** @type {HealthRecommendation[]} */
export const HEALTH_RECOMMENDATIONS = [
  {
    id: 'constipation',
    concern: '便秘',
    nutrients: ['食物繊維（水溶性・不溶性）', '水分', '発酵食品の菌', 'オリゴ糖'],
    explanation:
      '食物繊維には、水に溶ける「水溶性」と溶けない「不溶性」があり、両方をとるのが基本です。食物繊維を増やす時は水分も一緒にとりましょう。',
    foods: [
      { name: 'オートミール', unit: '袋', category: 'パン・米・麺', cost: 'low', point: '水溶性の食物繊維を手軽にとれる', howTo: '牛乳やお湯で1〜2分レンジ加熱。ご飯の代わりにも' },
      { name: 'ごぼう', unit: '本', category: '野菜・果物', cost: 'low', point: '不溶性の食物繊維が多い', howTo: 'ささがきを味噌汁やきんぴらに。カット済みの水煮も便利' },
      { name: 'キウイ', unit: '個', category: '野菜・果物', cost: 'low', point: '食物繊維とビタミンCを一度にとれる', howTo: '半分に切ってスプーンで食べる' },
      { name: '納豆', unit: 'パック', category: '納豆・豆腐', cost: 'low', point: '発酵食品で食物繊維も含む', howTo: 'ご飯にのせる、オクラやめかぶと混ぜる' },
      { name: 'わかめ（乾燥）', unit: '袋', category: 'その他', cost: 'low', point: '水溶性の食物繊維。日持ちする', howTo: '味噌汁やスープにひとつまみ' },
      { name: 'さつまいも', unit: '本', category: '野菜・果物', cost: 'low', point: '食物繊維が多く、甘くて続けやすい', howTo: '洗ってラップでレンジ加熱。皮ごと食べる' },
    ],
    suggestions: [
      '朝食にオートミールやバナナを足す',
      '味噌汁に海藻やきのこを入れる習慣をつける',
      'コップ1杯の水を食事のたびに飲む',
    ],
  },
  {
    id: 'skin',
    concern: '肌の調子',
    nutrients: ['たんぱく質', 'ビタミンC', 'ビタミンA（βカロテン）', 'ビタミンB2・B6'],
    explanation:
      '肌はたんぱく質から作られ、ビタミン類がその働きを支えます。特定の食品に頼るより、たんぱく質と色の濃い野菜・果物を毎日少しずつとるのが近道です。',
    foods: [
      { name: '卵', unit: 'パック', category: '卵', cost: 'low', point: 'たんぱく質とビタミンB2を手軽にとれる', howTo: 'ゆで卵を作り置き、朝食や間食に' },
      { name: 'ブロッコリー', unit: '株', category: '野菜・果物', cost: 'low', point: 'ビタミンCが多い', howTo: '小房に分けてレンジ蒸し。冷凍品も便利' },
      { name: 'にんじん', unit: '本', category: '野菜・果物', cost: 'low', point: 'βカロテンが多い（油と一緒だと吸収されやすい）', howTo: '細切りを油で炒める、ツナと和える' },
      { name: '鮭', unit: '切れ', category: '肉・魚', cost: 'mid', point: 'たんぱく質とビタミンB群', howTo: 'フライパンやトースターで焼くだけ' },
      { name: '納豆', unit: 'パック', category: '納豆・豆腐', cost: 'low', point: 'たんぱく質とビタミンB2', howTo: 'ご飯にのせる、卵と混ぜる' },
      { name: 'キウイ', unit: '個', category: '野菜・果物', cost: 'low', point: 'ビタミンCが多い', howTo: '朝食やデザートに' },
    ],
    suggestions: [
      '毎食、手のひら1枚分のたんぱく質（卵・魚・肉・大豆製品）を入れる',
      '色の濃い野菜を1日1回は食べる',
      '果物は間食に置き換える',
    ],
  },
  {
    id: 'fatigue',
    concern: '疲れやすさ',
    nutrients: ['ビタミンB1', 'たんぱく質', '鉄', '炭水化物（主食）'],
    explanation:
      'ビタミンB1は糖質をエネルギーに変えるのに使われます。食事を抜いたり主食を極端に減らしたりせず、たんぱく質や鉄も含めてバランスよくとることが大切です。疲れが長く続く場合は医療機関に相談してください。',
    foods: [
      { name: '豚肉（もも・こま切れ）', unit: 'パック', category: '肉・魚', cost: 'mid', point: 'ビタミンB1が特に多い', howTo: '玉ねぎと炒める、豚汁にする' },
      { name: '納豆', unit: 'パック', category: '納豆・豆腐', cost: 'low', point: 'ビタミンB群とたんぱく質', howTo: 'ご飯にのせる' },
      { name: '卵', unit: 'パック', category: '卵', cost: 'low', point: '良質なたんぱく質', howTo: '目玉焼き・ゆで卵' },
      { name: '小松菜', unit: '袋', category: '野菜・果物', cost: 'low', point: '鉄やカルシウムを含み、アク抜き不要', howTo: 'ざく切りで炒め物や味噌汁に' },
      { name: '玉ねぎ', unit: '個', category: '野菜・果物', cost: 'low', point: '豚肉と合わせて使いやすい', howTo: '豚肉と炒める、スープに' },
      { name: 'ツナ缶', unit: '缶', category: 'その他', cost: 'low', point: '常温保存できるたんぱく質源', howTo: 'サラダやおにぎりの具に' },
    ],
    suggestions: [
      '朝食を抜かず、主食＋たんぱく質をとる',
      '豚肉の料理を週に数回入れる',
      '青菜を味噌汁や炒め物に足す',
    ],
  },
  {
    id: 'sleep',
    concern: '睡眠',
    nutrients: ['トリプトファン（たんぱく質に含まれる）', 'ビタミンB6', 'マグネシウム'],
    explanation:
      'トリプトファンは体内で睡眠に関わる物質の材料になります。食品よりも、夕食を寝る2〜3時間前までに済ませる、夕方以降のカフェインやお酒を控えるといった習慣の影響が大きいとされています。',
    foods: [
      { name: '牛乳', unit: '本', category: '乳製品', cost: 'low', point: 'トリプトファンを含む', howTo: '温めて飲む' },
      { name: 'バナナ', unit: '房', category: '野菜・果物', cost: 'low', point: 'ビタミンB6やマグネシウムを含む', howTo: 'そのまま、ヨーグルトと一緒に' },
      { name: '豆腐', unit: '丁', category: '納豆・豆腐', cost: 'low', point: 'たんぱく質とマグネシウム。夕食でも胃にやさしい', howTo: '湯豆腐・冷奴・味噌汁に' },
      { name: '納豆', unit: 'パック', category: '納豆・豆腐', cost: 'low', point: 'トリプトファンとマグネシウム', howTo: 'ご飯にのせる' },
      { name: '卵', unit: 'パック', category: '卵', cost: 'low', point: 'トリプトファンを含むたんぱく質', howTo: '朝食で。朝にたんぱく質をとるのもリズム作りに役立ちます' },
    ],
    suggestions: [
      '夕食は寝る2〜3時間前までに',
      '夕方以降はコーヒー・緑茶・エナジードリンクを控える',
      '朝食で日光を浴びながらたんぱく質をとる',
    ],
  },
  {
    id: 'gut',
    concern: '腸内環境',
    nutrients: ['発酵食品の菌（乳酸菌・納豆菌など）', '食物繊維', 'オリゴ糖'],
    explanation:
      '菌を含む発酵食品と、腸内の菌のエサになる食物繊維・オリゴ糖を組み合わせてとるのが基本です。1つの食品を大量にとるより、いろいろな種類を毎日少しずつ続けましょう。',
    foods: [
      { name: 'ヨーグルト', unit: '個', category: '乳製品', cost: 'low', point: '乳酸菌などを含む', howTo: 'バナナやオートミールをのせる' },
      { name: '納豆', unit: 'パック', category: '納豆・豆腐', cost: 'low', point: '納豆菌と食物繊維を一度にとれる', howTo: 'キムチと混ぜる' },
      { name: 'キムチ', unit: 'パック', category: 'その他', cost: 'mid', point: '乳酸菌を含む発酵食品', howTo: '納豆や豆腐にのせる（塩分に注意）' },
      { name: '味噌', unit: 'パック', category: '調味料', cost: 'low', point: '発酵食品で毎日使いやすい', howTo: '具だくさんの味噌汁に' },
      { name: '玉ねぎ', unit: '個', category: '野菜・果物', cost: 'low', point: 'オリゴ糖を含む', howTo: 'スープ・炒め物・味噌汁に' },
      { name: 'バナナ', unit: '房', category: '野菜・果物', cost: 'low', point: 'オリゴ糖と食物繊維', howTo: 'ヨーグルトと一緒に' },
    ],
    suggestions: [
      '「ヨーグルト＋バナナ」「納豆＋キムチ」のように発酵食品と食物繊維を組み合わせる',
      '具だくさんの味噌汁を1日1杯',
      '同じ物ばかりでなく、いろいろな発酵食品を回す',
    ],
  },
  {
    id: 'immunity',
    concern: '免疫・風邪予防',
    nutrients: ['たんぱく質', 'ビタミンC', 'ビタミンD', '亜鉛', 'ビタミンA'],
    explanation:
      '体の守りの働きには、たんぱく質と各種ビタミン・ミネラルが関わります。特定の食品で風邪を防げるわけではないので、睡眠・手洗いとあわせて、偏りのない食事を心がけましょう。',
    foods: [
      { name: 'ブロッコリー', unit: '株', category: '野菜・果物', cost: 'low', point: 'ビタミンCが多い', howTo: 'レンジ蒸しで副菜に' },
      { name: '鮭', unit: '切れ', category: '肉・魚', cost: 'mid', point: 'ビタミンDとたんぱく質', howTo: '焼き鮭、鮭フレークをおにぎりに' },
      { name: 'しいたけ', unit: 'パック', category: '野菜・果物', cost: 'low', point: 'ビタミンDを含む（干すと増える）', howTo: '味噌汁・炒め物に。干ししいたけも便利' },
      { name: '卵', unit: 'パック', category: '卵', cost: 'low', point: 'たんぱく質・ビタミンA・D', howTo: '毎日1〜2個を目安に' },
      { name: '豚肉（もも・こま切れ）', unit: 'パック', category: '肉・魚', cost: 'mid', point: '亜鉛とたんぱく質', howTo: '野菜と一緒に炒める' },
      { name: 'みかん', unit: '袋', category: '野菜・果物', cost: 'low', point: 'ビタミンCを手軽にとれる', howTo: '間食に' },
    ],
    suggestions: [
      '野菜か果物を毎食どこかに入れる',
      '魚を週に2回以上',
      'たんぱく質を毎食とる',
    ],
  },
  {
    id: 'muscle',
    concern: '筋肉・体づくり',
    nutrients: ['たんぱく質', '炭水化物（エネルギー）', 'ビタミンD', 'カルシウム'],
    explanation:
      '筋肉の材料はたんぱく質で、1日にまとめてとるより毎食に分けてとるのがよいとされています。エネルギーが足りないとたんぱく質がエネルギーに使われてしまうため、主食も抜かないようにしましょう。',
    foods: [
      { name: '鶏むね肉', unit: 'パック', category: '肉・魚', cost: 'low', point: '安くて高たんぱく・低脂質', howTo: '塩をふってレンジ蒸し、サラダチキンに' },
      { name: '卵', unit: 'パック', category: '卵', cost: 'low', point: '良質なたんぱく質で調理が簡単', howTo: 'ゆで卵の作り置き' },
      { name: 'サバ缶', unit: '缶', category: 'その他', cost: 'low', point: 'たんぱく質とビタミンD。常温保存できる', howTo: 'そのまま、味噌汁やパスタに' },
      { name: '納豆', unit: 'パック', category: '納豆・豆腐', cost: 'low', point: '植物性たんぱく質', howTo: 'ご飯にのせる' },
      { name: 'ヨーグルト', unit: '個', category: '乳製品', cost: 'low', point: 'たんぱく質とカルシウム', howTo: '運動後や朝食に' },
      { name: '豆腐', unit: '丁', category: '納豆・豆腐', cost: 'low', point: '安価なたんぱく質', howTo: '冷奴・味噌汁・炒め物に' },
    ],
    suggestions: [
      '朝・昼・夕それぞれにたんぱく質を入れる',
      '運動した日は主食も適量とる',
      '常温保存できるサバ缶・ツナ缶を常備する',
    ],
  },
  {
    id: 'weight',
    concern: '体重管理',
    nutrients: ['たんぱく質', '食物繊維', '水分の多い食品'],
    explanation:
      'たんぱく質と食物繊維は満足感を得やすく、かさのある野菜やきのこはカロリーを抑えながら量を食べられます。極端な食事制限は続かず体調を崩すもとになるため、主食を少し減らして野菜とたんぱく質を増やすくらいの調整がおすすめです。',
    foods: [
      { name: '鶏むね肉', unit: 'パック', category: '肉・魚', cost: 'low', point: '高たんぱく・低脂質', howTo: 'レンジ蒸しやそぎ切りで炒める' },
      { name: '豆腐', unit: '丁', category: '納豆・豆腐', cost: 'low', point: '低カロリーでたんぱく質がとれる', howTo: 'ご飯の一部を豆腐に置き換える' },
      { name: 'きのこ（しめじ等）', unit: 'パック', category: '野菜・果物', cost: 'low', point: '低カロリーで食物繊維が多い', howTo: '炒め物・スープでかさ増し' },
      { name: 'キャベツ', unit: '玉', category: '野菜・果物', cost: 'low', point: 'かさがあり、よく噛む', howTo: '食事の最初にせん切りを食べる' },
      { name: 'もやし', unit: '袋', category: '野菜・果物', cost: 'low', point: 'とても安く、かさ増しに便利', howTo: 'レンジでナムル、炒め物に' },
      { name: 'わかめ（乾燥）', unit: '袋', category: 'その他', cost: 'low', point: 'ほぼカロリーなしで食物繊維', howTo: 'スープ・酢の物に' },
    ],
    suggestions: [
      '食事は野菜・たんぱく質から先に食べる',
      'ご飯を少し減らし、きのこや野菜でかさを増す',
      '甘い飲み物を水やお茶に置き換える',
    ],
  },
];

export const HEALTH_DISCLAIMER =
  'ここに表示する内容は一般的な栄養情報にもとづく食生活のヒントで、病気の診断や治療の代わりにはなりません。持病がある方、薬を飲んでいる方（例：ワルファリンを服用中の方の納豆など、食品との飲み合わせに注意が必要な場合があります）、妊娠中の方、食物アレルギーがある方は、医師や管理栄養士に相談してください。体調不良が続く場合は医療機関を受診してください。';
