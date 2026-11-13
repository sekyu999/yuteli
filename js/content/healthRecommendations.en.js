// 健康・食材提案の固定データ（英語版）。js/content/healthRecommendations.js と同じ並び・id・食品番号にすること
// General nutrition tips for everyday eating. Not for diagnosing, treating or preventing any illness.
// When editing, do not write definite health claims ("cures", "prevents", "works for" …).
//
// cost: 'low' = relatively cheap / 'mid' = average (typical supermarket price range)
// category: the store section used when adding to the list / stock. Kept as the JAPANESE category key,
//   because it is matched against the user's category names (the default names are Japanese).
// code: food number in the Standard Tables of Food Composition in Japan (8th ed.). Its nutrition data is
//   added when the food is added to stock.

/** @typedef {import('./healthRecommendations.js').HealthRecommendation} HealthRecommendation */

// Common foods (so each one is written only once)
const F = {
  egg: { name: 'Eggs', unit: 'pack', category: '卵', cost: 'low', code: '12004' },
  natto: { name: 'Natto', unit: 'pack', category: '豆類', cost: 'low', code: '04046' },
  tofu: { name: 'Tofu', unit: 'block', category: '豆類', cost: 'low', code: '04032' },
  milk: { name: 'Milk', unit: 'carton', category: '乳製品', cost: 'low', code: '13003' },
  yogurt: { name: 'Yogurt', unit: 'tub', category: '乳製品', cost: 'low', code: '13025' },
  banana: { name: 'Bananas', unit: 'bunch', category: '果物', cost: 'low', code: '07107' },
  kiwi: { name: 'Kiwi', unit: 'piece', category: '果物', cost: 'low', code: '07054' },
  broccoli: { name: 'Broccoli', unit: 'head', category: '野菜', cost: 'low', code: '06263' },
  komatsuna: { name: 'Komatsuna (Japanese mustard spinach)', unit: 'bag', category: '野菜', cost: 'low', code: '06086' },
  spinach: { name: 'Spinach', unit: 'bag', category: '野菜', cost: 'low', code: '06267' },
  carrot: { name: 'Carrots', unit: 'piece', category: '野菜', cost: 'low', code: '06212' },
  onion: { name: 'Onions', unit: 'piece', category: '野菜', cost: 'low', code: '06153' },
  chicken: { name: 'Chicken breast', unit: 'pack', category: '肉', cost: 'low', code: '11220' },
  pork: { name: 'Pork leg', unit: 'pack', category: '肉', cost: 'mid', code: '11131' },
  beef: { name: 'Lean beef (round)', unit: 'pack', category: '肉', cost: 'mid', code: '11076' },
  salmon: { name: 'Salmon', unit: 'fillet', category: '魚', cost: 'mid', code: '10134' },
  saba: { name: 'Canned mackerel', unit: 'can', category: '缶詰', cost: 'low', code: '10164' },
  tuna: { name: 'Canned tuna', unit: 'can', category: '缶詰', cost: 'low', code: '10263' },
  asari: { name: 'Canned clams', unit: 'can', category: '缶詰', cost: 'mid', code: '10283' },
  oatmeal: { name: 'Oatmeal', unit: 'bag', category: '米', cost: 'low', code: '01004' },
  brownRice: { name: 'Brown rice', unit: 'bag', category: '米', cost: 'mid', code: '01085' },
  almond: { name: 'Almonds', unit: 'bag', category: 'その他', cost: 'mid', code: '05001' },
  wakame: { name: 'Dried wakame seaweed', unit: 'bag', category: 'その他', cost: 'low', code: '09044' },
};
/** Add advice for this concern to a common food */
const food = (base, point, howTo) => ({ ...base, point, howTo });

/** @type {HealthRecommendation[]} */
export const HEALTH_RECOMMENDATIONS = [
  {
    id: 'fatigue',
    concern: 'Physical tiredness',
    nutrients: ['Vitamin B1', 'Protein', 'Iron', 'Carbs (staple foods)'],
    explanation:
      'Vitamin B1 is used to turn carbohydrates into energy. Try not to skip meals or cut staple foods drastically, and eat a balanced diet that also includes protein and iron.',
    foods: [
      food(F.pork, 'Especially rich in vitamin B1', 'Stir-fry with onions, or make pork miso soup'),
      food(F.natto, 'B vitamins and protein', 'Serve over rice'),
      food(F.egg, 'High-quality protein', 'Fried or boiled'),
      food(F.komatsuna, 'Has iron and calcium; no need to blanch first', 'In stir-fries or miso soup'),
      food(F.onion, 'Easy to pair with pork', 'Stir-fry with pork, or add to soup'),
      food(F.tuna, 'Protein that keeps at room temperature', 'In salads or rice balls'),
    ],
    suggestions: [
      'Don’t skip breakfast; have a staple food plus protein',
      'Have a pork dish a few times a week',
      'Add leafy greens to miso soup or stir-fries',
    ],
  },
  {
    id: 'mental',
    concern: 'Mental tiredness & stress',
    nutrients: ['Protein (tryptophan)', 'B vitamins', 'Magnesium', 'Vitamin C'],
    explanation:
      'The body makes mood-related substances from amino acids in protein, with the help of B vitamins. Eating regular meals, and not skipping them when you are busy, is the foundation. If you keep feeling low, don’t carry it alone: reach out to a doctor or a support service.',
    foods: [
      food(F.banana, 'Contains tryptophan and vitamin B6', 'At breakfast or as a snack'),
      food(F.natto, 'Tryptophan and magnesium', 'Serve over rice'),
      food(F.salmon, 'Protein, B vitamins and vitamin D', 'Just grill it; salmon flakes are handy too'),
      food(F.milk, 'Tryptophan and calcium', 'Drink it warm'),
      food(F.almond, 'Contains magnesium', 'A handful of unsalted, dry-roasted ones'),
      food(F.kiwi, 'Rich in vitamin C', 'Cut in half and scoop with a spoon'),
    ],
    suggestions: [
      'Eat 3 meals at about the same times each day',
      'Get protein and sunlight in the morning',
      'Don’t rely too much on sweets or caffeine',
    ],
  },
  {
    id: 'eyes',
    concern: 'Tired eyes',
    nutrients: ['Vitamin A', 'Lutein (green & yellow vegetables)', 'DHA & EPA (oily fish)', 'B vitamins'],
    explanation:
      'Vitamin A is a nutrient involved in how the eyes work. Include deeply colored vegetables and oily fish in your daily meals. Besides food, regularly looking away from screens to rest your eyes is important.',
    foods: [
      food(F.spinach, 'Contains lutein and beta-carotene', 'Blanched as a side; frozen is handy too'),
      food(F.carrot, 'Rich in beta-carotene (eat with some oil)', 'Stir-fry thin strips'),
      food(F.saba, 'An easy source of DHA and EPA', 'As is, or in miso soup or pasta'),
      food(F.egg, 'Contains lutein and vitamin A', 'Keep boiled eggs ready'),
      food(F.broccoli, 'Contains lutein and vitamin C', 'Steam in the microwave'),
      { name: 'Frozen blueberries', unit: 'bag', category: '果物', cost: 'mid', code: '07124', point: 'Contain anthocyanins', howTo: 'On top of yogurt' },
    ],
    suggestions: [
      'When using screens, look into the distance at least once an hour',
      'One green or yellow vegetable dish every day',
      'Oily fish twice a week (canned is fine)',
    ],
  },
  {
    id: 'sluggish',
    concern: 'Feeling sluggish',
    nutrients: ['Iron', 'Vitamin B1', 'Protein', 'Fluids'],
    explanation:
      'Too little iron or vitamin B1, not drinking enough, or an unbalanced diet can contribute to feeling sluggish. If it lasts a long time or suddenly gets worse, talk to a doctor.',
    foods: [
      food(F.pork, 'Rich in vitamin B1', 'Ginger pork or pork miso soup'),
      food(F.asari, 'An easy source of iron', 'In miso soup, pasta or mixed rice'),
      food(F.komatsuna, 'A leafy green with iron', 'In stir-fries or miso soup'),
      food(F.natto, 'Iron, B vitamins and protein', 'Serve over rice'),
      food(F.egg, 'Protein and iron', '1–2 a day'),
      food(F.brownRice, 'More vitamin B1 than white rice', 'Cook mixed with white rice'),
    ],
    suggestions: [
      'Drink water or tea often',
      'Don’t skip staple foods',
      'Have meat, fish, eggs or soy foods at every meal',
    ],
  },
  {
    id: 'motivation',
    concern: 'Low motivation',
    nutrients: ['Protein', 'Iron', 'B vitamins', 'Energy at breakfast'],
    explanation:
      'Substances linked to motivation are also made from protein, iron and B vitamins. Start by eating breakfast to get some energy in. If low mood or a lack of motivation lasts more than two weeks, talk to a doctor or a support service.',
    foods: [
      food(F.egg, 'An easy way to add protein', 'Add one to breakfast'),
      food(F.chicken, 'Cheap and high in protein', 'Steam in the microwave and keep ready'),
      food(F.beef, 'Iron and protein', 'Just grill it, or stir-fry'),
      food(F.natto, 'Protein, iron and B vitamins', 'Serve over rice'),
      food(F.banana, 'Quick energy', 'One in the morning'),
      food(F.oatmeal, 'An easy breakfast staple', 'Microwave with milk'),
    ],
    suggestions: ['Eat at least a little breakfast', 'Include protein at every meal', 'Don’t make a meal of sweets alone'],
  },
  {
    id: 'focus',
    concern: 'Focus',
    nutrients: ['Carbs (slowly absorbed)', 'Protein', 'DHA & EPA', 'Iron', 'Fluids'],
    explanation:
      'The brain runs on glucose. A moderate amount of high-fiber staple food makes blood sugar rise and fall more gently. Eating too much can make you sleepy, so stop when about 80% full. Also watch out for not drinking enough.',
    foods: [
      food(F.oatmeal, 'A staple high in fiber', 'For breakfast or a snack'),
      food(F.brownRice, 'Fiber and vitamin B1', 'Cook mixed with white rice'),
      food(F.saba, 'DHA and EPA', 'As is, or as a side with rice'),
      food(F.egg, 'Protein and choline', 'A boiled egg as a snack'),
      food(F.almond, 'Good for snacking', 'A handful instead of sweets'),
      food(F.banana, 'An easy energy source', 'Half of one before work'),
    ],
    suggestions: [
      'Eat lunch until about 80% full',
      'Snack on nuts, fruit or yogurt',
      'Keep water on your desk',
    ],
  },
  {
    id: 'sleep',
    concern: 'Sleep quality',
    nutrients: ['Tryptophan (found in protein)', 'Vitamin B6', 'Magnesium'],
    explanation:
      'The body uses tryptophan to make substances involved in sleep. Habits are thought to matter more than any particular food: finish dinner 2–3 hours before bed, and cut back on caffeine and alcohol from the evening on.',
    foods: [
      food(F.milk, 'Contains tryptophan', 'Drink it warm'),
      food(F.banana, 'Contains vitamin B6 and magnesium', 'With yogurt'),
      food(F.tofu, 'Protein and magnesium; gentle on the stomach at dinner', 'Simmered, chilled, or in miso soup'),
      food(F.natto, 'Tryptophan and magnesium', 'Serve over rice'),
      food(F.egg, 'Contains tryptophan', 'At breakfast; protein in the morning can help set a daily rhythm'),
    ],
    suggestions: [
      'Finish dinner 2–3 hours before bed',
      'Cut back on caffeine from late afternoon',
      'Have protein at breakfast, in daylight if you can',
    ],
  },
  {
    id: 'constipation',
    concern: 'Constipation',
    nutrients: ['Fiber (soluble & insoluble)', 'Fluids', 'Bacteria in fermented foods', 'Oligosaccharides'],
    explanation:
      'Fiber comes in two types: soluble (dissolves in water) and insoluble (doesn’t). The basic idea is to get both. When you eat more fiber, drink more fluids too.',
    foods: [
      food(F.oatmeal, 'An easy source of soluble fiber', 'Microwave with milk or hot water for 1–2 min'),
      { name: 'Burdock root', unit: 'piece', category: '野菜', cost: 'low', code: '06084', point: 'Rich in insoluble fiber', howTo: 'In miso soup or a stir-fry; pre-boiled packs are handy' },
      food(F.kiwi, 'Fiber and vitamin C', 'Cut in half and scoop with a spoon'),
      food(F.natto, 'A fermented food that also has fiber', 'Mix with okra or seaweed'),
      food(F.wakame, 'Soluble fiber; keeps a long time', 'A pinch in miso soup or other soups'),
      { name: 'Sweet potatoes', unit: 'piece', category: '野菜', cost: 'low', code: '02045', point: 'High in fiber and easy to keep eating', howTo: 'Microwave and eat with the skin on' },
    ],
    suggestions: [
      'Add oatmeal or a banana to breakfast',
      'Put seaweed or mushrooms in miso soup',
      'A glass of water with every meal',
    ],
  },
  {
    id: 'gut',
    concern: 'Gut health',
    nutrients: ['Bacteria in fermented foods (lactic acid bacteria, natto bacteria …)', 'Fiber', 'Oligosaccharides'],
    explanation:
      'The basic idea is to combine fermented foods that contain bacteria with fiber and oligosaccharides, which feed the bacteria in your gut. Keep it up with a little of several kinds each day.',
    foods: [
      food(F.yogurt, 'Contains lactic acid bacteria and more', 'Top with banana or oatmeal'),
      food(F.natto, 'Natto bacteria and fiber', 'Mix with kimchi'),
      { name: 'Kimchi', unit: 'pack', category: 'その他', cost: 'mid', code: '06236', point: 'A fermented food with lactic acid bacteria', howTo: 'On natto or tofu (watch the salt)' },
      { name: 'Miso', unit: 'pack', category: '調味料', cost: 'low', code: '17045', point: 'A fermented food that’s easy to use daily', howTo: 'In miso soup with lots of ingredients' },
      food(F.onion, 'Contains oligosaccharides', 'In soups or stir-fries'),
      food(F.banana, 'Oligosaccharides and fiber', 'With yogurt'),
    ],
    suggestions: [
      'Pair “yogurt + banana” or “natto + kimchi”',
      'One bowl of hearty miso soup a day',
      'Rotate different fermented foods',
    ],
  },
  {
    id: 'skin',
    concern: 'Skin condition',
    nutrients: ['Protein', 'Vitamin C', 'Vitamin A (beta-carotene)', 'Vitamins B2 & B6'],
    explanation:
      'Skin is built from protein, and vitamins support how it works. Having a little protein and some deeply colored vegetables and fruit every day is the simplest approach.',
    foods: [
      food(F.egg, 'Protein and vitamin B2', 'Keep boiled eggs ready'),
      food(F.broccoli, 'Rich in vitamin C', 'Steam in the microwave; frozen works too'),
      food(F.carrot, 'Rich in beta-carotene (eat with some oil)', 'Stir-fry thin strips, or mix with tuna'),
      food(F.salmon, 'Protein and B vitamins', 'Just pan-fry it'),
      food(F.natto, 'Protein and vitamin B2', 'Serve over rice'),
      food(F.kiwi, 'Rich in vitamin C', 'At breakfast or as dessert'),
    ],
    suggestions: [
      'A palm-sized portion of protein at every meal',
      'Deeply colored vegetables once a day',
      'Fruit as a snack',
    ],
  },
  {
    id: 'immunity',
    concern: 'Immunity & colds',
    nutrients: ['Protein', 'Vitamin C', 'Vitamin D', 'Zinc', 'Vitamin A'],
    explanation:
      'Protein and a range of vitamins and minerals are involved in the body’s defenses. No single food can stop you catching a cold, so aim for a balanced diet along with good sleep and hand washing.',
    foods: [
      food(F.broccoli, 'Rich in vitamin C', 'Microwave-steamed as a side dish'),
      food(F.salmon, 'Vitamin D and protein', 'Grilled salmon or salmon flakes'),
      { name: 'Shiitake mushrooms', unit: 'pack', category: '野菜', cost: 'low', code: '08039', point: 'Contain vitamin D', howTo: 'In miso soup or stir-fries' },
      food(F.egg, 'Protein, vitamins A and D', '1–2 a day'),
      food(F.pork, 'Zinc and protein', 'Stir-fry with vegetables'),
      { name: 'Mandarin oranges', unit: 'bag', category: '果物', cost: 'low', code: '07027', point: 'An easy source of vitamin C', howTo: 'As a snack' },
    ],
    suggestions: [
      'Vegetables or fruit somewhere in every meal',
      'Fish at least twice a week',
      'Protein at every meal',
    ],
  },
  {
    id: 'muscle',
    concern: 'Muscle & fitness',
    nutrients: ['Protein', 'Carbs (energy)', 'Vitamin D', 'Calcium'],
    explanation:
      'Muscle is built from protein, and spreading it across your meals is considered a good approach. If you don’t get enough energy, protein gets used for energy instead, so don’t skip staple foods either.',
    foods: [
      food(F.chicken, 'Cheap, high in protein, low in fat', 'Microwave-steamed or as salad chicken'),
      food(F.egg, 'High-quality protein, easy to cook', 'Keep boiled eggs ready'),
      food(F.saba, 'Protein and vitamin D', 'As is, or in miso soup or pasta'),
      food(F.natto, 'Plant protein', 'Serve over rice'),
      food(F.yogurt, 'Protein and calcium', 'After exercise or at breakfast'),
      food(F.tofu, 'Low-cost protein', 'Chilled, in miso soup, or stir-fried'),
    ],
    suggestions: [
      'Protein at breakfast, lunch and dinner',
      'On days you exercise, eat enough staple food too',
      'Keep canned mackerel and tuna on hand',
    ],
  },
  {
    id: 'stamina',
    concern: 'Vitality & stamina',
    nutrients: ['Zinc', 'Protein', 'Vitamin B1', 'Vitamin B2'],
    explanation:
      'Zinc is a mineral involved in male hormones and reproduction, and it’s one of the nutrients people tend to lack. Get protein and B vitamins (which help turn carbs into energy) too. Sleep, exercise and going easy on alcohol also matter. If something keeps bothering you, talk to a doctor (such as a urologist).',
    foods: [
      { name: 'Oysters', unit: 'pack', category: '魚', cost: 'mid', code: '10292', point: 'Especially high in zinc', howTo: 'In hot pot, sautéed or fried (cook oysters for cooking all the way through)' },
      { name: 'Pork tenderloin', unit: 'pack', category: '肉', cost: 'mid', code: '11140', point: 'Rich in vitamin B1 and low in fat', howTo: 'Sautéed or as a cutlet' },
      food(F.beef, 'Zinc and protein', 'Simply grilled or stir-fried'),
      { name: 'Eel (kabayaki)', unit: 'piece', category: '魚', cost: 'mid', code: '10070', point: 'Vitamins A, B1, B2 and zinc', howTo: 'Over rice, as an occasional treat' },
      { name: 'Garlic', unit: 'bulb', category: '野菜', cost: 'low', code: '06223', point: 'Helps your body absorb the vitamin B1 in pork', howTo: 'A little in pork stir-fries' },
      food(F.egg, 'Protein and zinc', '1–2 a day'),
    ],
    suggestions: ['Oysters or lean red meat a few times a week', 'Pair pork with garlic or onion', 'Get enough sleep and go easy on alcohol'],
  },
  {
    id: 'weight',
    concern: 'Weight management',
    nutrients: ['Protein', 'Fiber', 'Foods high in water'],
    explanation:
      'Protein and fiber tend to be filling, and vegetables and mushrooms let you eat a good amount for fewer calories. Extreme restriction is hard to keep up and can make you unwell, so adjust little by little.',
    foods: [
      food(F.chicken, 'High in protein, low in fat', 'Microwave-steam, or slice thin and stir-fry'),
      food(F.tofu, 'Low in calories, with protein', 'Swap some of your rice for tofu'),
      { name: 'Shimeji mushrooms', unit: 'pack', category: '野菜', cost: 'low', code: '08016', point: 'Low in calories and high in fiber', howTo: 'Bulk up stir-fries and soups' },
      { name: 'Cabbage', unit: 'head', category: '野菜', cost: 'low', code: '06061', point: 'Bulky and takes chewing', howTo: 'Shredded, at the start of a meal' },
      { name: 'Bean sprouts', unit: 'bag', category: '野菜', cost: 'low', code: '06291', point: 'Very cheap and adds bulk', howTo: 'Microwave and season as namul' },
      food(F.wakame, 'Fiber with almost no calories', 'In soups or vinegared salads'),
    ],
    suggestions: [
      'Eat vegetables and protein first',
      'Eat a bit less rice; bulk up with mushrooms and vegetables',
      'Swap sweet drinks for water or tea',
    ],
  },
  {
    id: 'cold',
    concern: 'Feeling cold',
    nutrients: ['Protein', 'Iron', 'Vitamin E', 'B vitamins', 'Warm dishes'],
    explanation:
      'Body heat is made from the food you eat. The basics: don’t eat too little, get enough protein, and choose warm dishes.',
    foods: [
      { name: 'Ginger', unit: 'piece', category: '野菜', cost: 'low', code: '06103', point: 'A way to make dishes warming', howTo: 'Grate into soups or stir-fries' },
      { name: 'Kabocha squash', unit: 'piece', category: '野菜', cost: 'low', code: '06048', point: 'Vitamin E and beta-carotene', howTo: 'Microwave-steamed or in soup' },
      { name: 'Chicken thigh', unit: 'pack', category: '肉', cost: 'low', code: '11221', point: 'Protein; good in hot pots and stews', howTo: 'In hot pots or soups' },
      food(F.egg, 'Protein', 'Crack into soup'),
      food(F.almond, 'Rich in vitamin E', 'A handful'),
      food(F.natto, 'Iron and protein', 'Can also go in warm miso soup'),
    ],
    suggestions: [
      'Swap cold drinks for warm ones',
      'Have hearty soups or hot pots',
      'Don’t skip breakfast',
    ],
  },
  {
    id: 'swelling',
    concern: 'Swelling',
    nutrients: ['Potassium', 'Less salt', 'Protein'],
    explanation:
      'Potassium helps the body get rid of excess salt. Also keep salt on the low side. If you have been told to limit potassium (for example, because of kidney disease), follow your doctor’s advice.',
    foods: [
      food(F.banana, 'Rich in potassium', 'As is'),
      { name: 'Avocados', unit: 'piece', category: '果物', cost: 'mid', code: '07006', point: 'Rich in potassium', howTo: 'With wasabi soy sauce, or in salads' },
      { name: 'Cucumbers', unit: 'piece', category: '野菜', cost: 'low', code: '06065', point: 'Water and potassium', howTo: 'Lightly pickled (go easy on salt) or in salads' },
      food(F.spinach, 'Rich in potassium', 'Blanched as a side'),
      food(F.natto, 'Potassium and protein', 'Serve over rice'),
      { name: 'Potatoes', unit: 'piece', category: '野菜', cost: 'low', code: '02017', point: 'Contain potassium', howTo: 'Microwave-steamed or in miso soup' },
    ],
    suggestions: [
      'Load soups with ingredients and keep the broth small',
      'Watch the salt in processed foods and eating out',
      'Vegetables or fruit at every meal',
    ],
  },
  {
    id: 'iron',
    concern: 'Low iron (anemia-prone)',
    nutrients: ['Iron', 'Vitamin C (helps iron absorption)', 'Protein', 'Folate & vitamin B12'],
    explanation:
      'Iron from meat and fish is absorbed easily; iron from vegetables and soy is absorbed better when eaten with vitamin C. Avoid taking lots of supplements on your own judgment, and if you have symptoms, get tested by a doctor.',
    foods: [
      food(F.beef, 'Easily absorbed iron', 'Just grill it, or stir-fry'),
      food(F.asari, 'Iron and vitamin B12', 'In miso soup or pasta'),
      { name: 'Chicken liver', unit: 'pack', category: '肉', cost: 'low', code: '11232', point: 'Very rich in iron (also high in vitamin A, so don’t overdo it)', howTo: 'Simmer in sweet soy sauce; eat a little at a time' },
      food(F.komatsuna, 'Iron and calcium', 'With foods rich in vitamin C'),
      food(F.natto, 'Iron and folate', 'Serve over rice'),
      food(F.kiwi, 'Vitamin C helps iron absorption', 'As dessert after a meal'),
    ],
    suggestions: [
      'Some meat or fish every day',
      'Pair leafy greens with vitamin C from fruit or vegetables',
      'Go easy on strong tea or coffee with meals',
    ],
  },
  {
    id: 'bone',
    concern: 'Bones & teeth',
    nutrients: ['Calcium', 'Vitamin D', 'Vitamin K', 'Protein'],
    explanation:
      'Along with calcium, get vitamin D (which helps absorb it), and vitamin K and protein (which are involved in building bone). Getting some sunlight and moving your body matter too.',
    foods: [
      food(F.milk, 'An easy source of calcium', 'A glass a day'),
      food(F.yogurt, 'Calcium and protein', 'At breakfast or as a snack'),
      food(F.komatsuna, 'Calcium and vitamin K', 'In stir-fries or miso soup'),
      food(F.salmon, 'Rich in vitamin D', 'Grilled'),
      { name: 'Shirasu (whitebait)', unit: 'pack', category: '魚', cost: 'mid', code: '10055', point: 'Calcium and vitamin D', howTo: 'On rice or in rolled omelets' },
      food(F.natto, 'Rich in vitamin K', 'Serve over rice'),
    ],
    suggestions: ['Dairy 1–2 times a day', 'Fish at least twice a week', 'Walk outside during the day'],
  },
];

/** Nutrition-based suggestions (same ids, codes and order as the Japanese version) */
const RICE = { name: 'Rice (white)', unit: 'bag', category: '米', cost: 'low', code: '01088' };
const BREAD = { name: 'Sliced bread', unit: 'bag', category: 'パン', cost: 'low', code: '01026' };
const SWEET_POTATO = { name: 'Sweet potato', unit: 'pc', category: '野菜', cost: 'low', code: '02006' };
const SHIMEJI = { name: 'Shimeji mushrooms', unit: 'pack', category: '野菜', cost: 'low', code: '08016' };
const ENOKI = { name: 'Enoki mushrooms', unit: 'bag', category: '野菜', cost: 'low', code: '08001' };
const AVOCADO = { name: 'Avocado', unit: 'pc', category: '果物', cost: 'mid', code: '07006' };
const KONNYAKU = { name: 'Konnyaku', unit: 'block', category: 'その他', cost: 'low', code: '02003' };

export const NUTRIENT_ADVICE = {
  'energy-low': {
    concern: 'Not enough energy',
    nutrients: ['Energy', 'Carbs', 'Protein'],
    explanation: 'Eating less than you need for a long time can leave you tired and lose muscle. Don’t skip staple foods, and snacks can help.',
    foods: [
      food(RICE, 'An easy source of energy', 'A bowl at each meal'),
      food(F.banana, 'An easy snack', 'At breakfast or when peckish'),
      food(F.oatmeal, 'Energy and fiber', 'Microwave with milk'),
      food(F.almond, 'Lots of energy in a small amount', 'A handful as a snack'),
      food(F.egg, 'Adds protein too', 'Add one dish'),
      food(SWEET_POTATO, 'Filling carbs', 'Steamed or baked'),
    ],
    suggestions: ['Eat a staple at every meal', 'Snack on bananas or nuts', 'Add one more side dish'],
  },
  'energy-high': {
    concern: 'Too much energy',
    nutrients: ['Energy', 'Fat', 'Fiber'],
    explanation: 'Eating more than you need over time tends to add weight. Swapping in bulky, low-energy foods is easier to keep up than eating less.',
    foods: [
      food(F.broccoli, 'Low in energy, filling', 'Eat it before your staple'),
      food(SHIMEJI, 'Almost no energy, lots of fiber', 'Bulk up stir-fries and soups'),
      food(ENOKI, 'Easy to bulk up dishes', 'In soups, hot pot or patties'),
      food(KONNYAKU, 'Very low in energy', 'Simmered or stir-fried'),
      food(F.tofu, 'Replace some of the meat', 'Tofu patties or mapo tofu'),
      food(F.chicken, 'Switch to lower-fat meat', 'Remove the skin'),
    ],
    suggestions: ['Start with vegetables and mushrooms', 'Grill or steam instead of frying', 'Watch the sugar in drinks'],
  },
  'protein-low': {
    concern: 'Not enough protein',
    nutrients: ['Protein'],
    explanation: 'Protein builds muscle, skin and hair. Spreading it across every meal is considered a good approach.',
    foods: [
      food(F.chicken, 'Cheap, high in protein, low in fat', 'Microwave-steamed or as salad chicken'),
      food(F.egg, 'Easy to cook', 'Keep boiled eggs ready'),
      food(F.natto, 'Plant protein', 'Serve over rice'),
      food(F.saba, 'Protein and healthy fats', 'As is, or in miso soup'),
      food(F.tuna, 'Easy to add', 'In salads or rice balls'),
      food(F.yogurt, 'Add at breakfast or as a snack', 'One at breakfast'),
    ],
    suggestions: ['Protein at breakfast, lunch and dinner', 'Keep cans, eggs and natto on hand', 'Snack on yogurt'],
  },
  'protein-high': {
    concern: 'Too much protein',
    nutrients: ['Protein', 'Carbs'],
    explanation: 'Protein makes up too large a share of your energy. Rebalance with staples and vegetables. If you have kidney disease, ask your doctor.',
    foods: [
      food(RICE, 'Add carbs with a staple', 'A bowl at each meal'),
      food(F.broccoli, 'Balance with vegetables', 'As a side'),
      food(F.carrot, 'Balance with vegetables', 'Stir-fried or in soup'),
      food(F.banana, 'Add carbs with fruit', 'At breakfast'),
    ],
    suggestions: ['Don’t skip staples', 'Check how much protein shake you drink', 'Add a vegetable side dish'],
  },
  'fat-low': {
    concern: 'Not enough fat',
    nutrients: ['Fat (20%+ of energy)'],
    explanation: 'Fat is a source of energy and helps you absorb fat-soluble vitamins. Add it from good sources like fish and nuts.',
    foods: [
      food(F.saba, 'Oily fish (DHA, EPA)', 'As is, or in pasta'),
      food(F.salmon, 'Fish oil', 'Grilled'),
      food(F.almond, 'Plant fat', 'A handful as a snack'),
      food(AVOCADO, 'Plant fat', 'In salads or on toast'),
      food(F.egg, 'Easy to add', '1–2 a day'),
    ],
    suggestions: ['Fish at least twice a week', 'Snack on nuts', 'A little oil on salads'],
  },
  'fat-high': {
    concern: 'Too much fat',
    nutrients: ['Fat (up to 30% of energy)'],
    explanation: 'Fat is high in energy, so too much leads to excess energy. Switch to leaner foods and cooking methods.',
    foods: [
      food(F.chicken, 'Low-fat meat', 'Remove the skin'),
      food(F.tofu, 'Replace some of the meat', 'Tofu patties'),
      food(F.broccoli, 'Low in fat, filling', 'Steamed or boiled'),
      food(SHIMEJI, 'Bulk up without oil', 'In soups or foil-baked'),
      food(F.yogurt, 'Swap for snacks', 'Instead of sweets'),
    ],
    suggestions: ['Grill, steam or boil instead of frying', 'Choose leaner cuts', 'Go easy on dressing and mayo'],
  },
  'carb-low': {
    concern: 'Not enough carbs',
    nutrients: ['Carbs (50%+ of energy)'],
    explanation: 'Carbs are the main fuel for your body and brain. Without enough, you tire easily and protein gets used for energy.',
    foods: [
      food(RICE, 'Main source of energy', 'A bowl at each meal'),
      food(BREAD, 'Easy at breakfast', 'As toast'),
      food(F.oatmeal, 'High in fiber too', 'Microwave with milk'),
      food(F.banana, 'Easy as a snack', 'At breakfast or before exercise'),
      food(SWEET_POTATO, 'Filling', 'Steamed'),
    ],
    suggestions: ['Eat a staple at every meal', 'Fruit as a snack', 'Try brown rice or oatmeal'],
  },
  'carb-high': {
    concern: 'Too many carbs',
    nutrients: ['Carbs (up to 65% of energy)', 'Protein'],
    explanation: 'Your diet leans toward staples, sweets or sugary drinks. Keep the staple, and add protein and vegetable sides for balance.',
    foods: [
      food(F.chicken, 'Add a protein side', 'Microwave-steamed'),
      food(F.egg, 'Easy protein', 'Add one dish'),
      food(F.tofu, 'Easy protein', 'Chilled or in miso soup'),
      food(F.broccoli, 'Add a vegetable side', 'As a side'),
      food(SHIMEJI, 'Bulk up dishes', 'In soups or stir-fries'),
    ],
    suggestions: ['Swap sugary drinks for tea or water', 'Normal staple, more sides', 'Swap sweets for fruit or yogurt'],
  },
};

export const HEALTH_DISCLAIMER =
  'General nutrition information, not a substitute for diagnosis or treatment. If you have a medical condition, take medication (e.g. warfarin and natto), are pregnant, or have allergies, ask a doctor or registered dietitian.';
