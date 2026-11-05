// 栄養データを選ぶシート
// ・成分表から探す（文部科学省 日本食品標準成分表）
// ・パッケージの栄養成分表示を入力する
import { openSheet } from '../ui/sheet.js';
import { showErrors, bindErrorClear, formValues } from '../ui/form.js';
import { searchFoods, loadFoods } from '../data/foodDb.js';
import { NUTRIENTS, LABEL_NUTRIENTS, labelToPer100g, formatValue } from '../domain/nutrition.js';
import { esc } from '../lib/util.js';

/**
 * @param {{ current: object|null, initialQuery?: string, onSelect: (nutrition: object|null) => void }} opts
 */
export function openNutritionSheet({ current, initialQuery = '', onSelect }) {
  let mode = current?.source === 'label' ? 'label' : 'mext';
  const sheet = openSheet({
    title: '栄養データ',
    body: `
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-mode="mext">成分表から探す</button>
        <button type="button" role="tab" data-mode="label">パッケージ表示</button>
      </div>
      <div id="nut-body" style="margin-top:16px"></div>
      ${current ? '<div class="form-actions"><button type="button" class="btn-danger-text" data-clear>栄養データを外す</button></div>' : ''}
    `,
  });
  const body = sheet.el.querySelector('#nut-body');

  sheet.el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) {
      mode = m.dataset.mode;
      render();
    }
    if (e.target.closest('[data-clear]')) {
      onSelect(null);
      sheet.close();
    }
  });

  function render() {
    sheet.el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    if (mode === 'mext') renderSearch();
    else renderLabel();
  }

  // ---------- 成分表から探す ----------
  function renderSearch() {
    body.innerHTML = `
      <div class="field">
        <label for="f-q">食品名</label>
        <input id="f-q" class="input" type="search" value="${esc(initialQuery)}" placeholder="例：卵、納豆、鶏 むね" autocomplete="off" enterkeyhint="search">
      </div>
      <ul class="list food-results" id="food-results" style="margin-top:12px"></ul>
      <p class="note" style="margin-top:8px">出典：日本食品標準成分表（八訂）増補2023年</p>
    `;
    const q = body.querySelector('#f-q');
    const results = body.querySelector('#food-results');
    let timer = null;
    let foods = [];

    const run = async () => {
      if (!q.value.trim()) {
        results.innerHTML = '<li class="note">食品名を入力してください</li>';
        return;
      }
      try {
        foods = await searchFoods(q.value);
      } catch (e) {
        results.innerHTML = `<li class="note">${esc(e.message)}</li>`;
        return;
      }
      results.innerHTML = foods.length
        ? foods
            .map(
              (f, i) => `<li><button type="button" class="row-button" data-pick="${i}">
                <span class="grow"><span>${esc(f.name)}</span>
                <span class="note">${formatValue(f.per100g.energy, NUTRIENTS[0])}kcal・たんぱく質${formatValue(f.per100g.protein, NUTRIENTS[1])}g</span></span>
                <span class="note">選ぶ</span></button></li>`
            )
            .join('')
        : '<li class="note">見つかりませんでした。言い方を変えてみてください（例：ご飯→めし）</li>';
    };
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(run, 200);
    });
    results.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const f = foods[Number(b.dataset.pick)];
      onSelect({ source: 'mext', code: f.code, name: f.name, per100g: f.per100g });
      sheet.close();
    });
    loadFoods().catch(() => {}); // 先に読み込みを始めておく
    run();
    if (!initialQuery) q.focus();
  }

  // ---------- パッケージ表示を入力 ----------
  function renderLabel() {
    const prev = current?.source === 'label' ? current : null;
    const basis = prev?.basisGrams ?? 100;
    const prevVal = (key) => {
      const v = prev?.per100g?.[key];
      return v === null || v === undefined || !prev ? '' : Math.round(((v * prev.basisGrams) / 100) * 100) / 100;
    };
    const field = (n) => `
      <div class="field nut-field">
        <label for="f-${n.key}">${esc(n.label)}</label>
        <div class="row" style="align-items:center">
          <input id="f-${n.key}" name="${n.key}" class="input grow" inputmode="decimal" value="${prevVal(n.key)}" autocomplete="off">
          <span class="unit-suffix">${esc(n.unit)}</span>
        </div>
        <p class="field-error" data-error-for="${n.key}"></p>
      </div>`;
    body.innerHTML = `
      <form novalidate>
        <div class="field">
          <label for="f-basis">表示の基準量</label>
          <div class="row" style="align-items:center">
            <input id="f-basis" name="basis" class="input grow" inputmode="decimal" value="${basis}" placeholder="例：45" autocomplete="off">
            <span class="unit-suffix">g あたり</span>
          </div>
          <p class="note" style="margin-top:4px">「1パック（45g）あたり」なら 45</p>
          <p class="field-error" data-error-for="basis"></p>
        </div>
        ${NUTRIENTS.filter((n) => LABEL_NUTRIENTS.includes(n.key)).map(field).join('')}
        <details class="more-nutrients">
          <summary>その他の栄養素（表示があれば）</summary>
          ${NUTRIENTS.filter((n) => !LABEL_NUTRIENTS.includes(n.key)).map(field).join('')}
        </details>
        <div class="form-actions"><button type="submit" class="btn btn-primary btn-block">この内容で使う</button></div>
      </form>`;
    const form = body.querySelector('form');
    bindErrorClear(form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = formValues(form);
      const errors = {};
      const basisN = Number(v.basis);
      if (!(basisN > 0)) errors.basis = '基準量を入力してください';
      if (String(v.energy ?? '').trim() === '') errors.energy = 'エネルギーを入力してください';
      for (const n of NUTRIENTS) {
        const t = String(v[n.key] ?? '').trim();
        if (t !== '' && !(Number(t) >= 0)) errors[n.key] = '0以上の数で入力してください';
      }
      if (Object.keys(errors).length) {
        showErrors(form, errors);
        return;
      }
      onSelect({ source: 'label', name: 'パッケージ表示', basisGrams: basisN, per100g: labelToPer100g(v, basisN) });
      sheet.close();
    });
  }

  render();
}

/** 選択中の栄養データの説明（フォームに表示） */
export function describeNutrition(n) {
  if (!n) return '未設定';
  const kcal = n.per100g?.energy;
  const kcalText = kcal === null || kcal === undefined ? '' : `・100gあたり${Math.round(kcal)}kcal`;
  return n.source === 'mext' ? `成分表：${n.name}${kcalText}` : `パッケージ表示（${n.basisGrams}gあたり）${kcalText}`;
}
