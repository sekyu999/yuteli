// 英訳漏れの一覧を出す：node tools/i18n-check.mjs [ファイル…]（引数なしなら全ファイル）
// ルール
// ・JS の文字列 '…' "…" に日本語があれば、英語の対応表（js/i18n/en/*.js）にあること（NO-EN）
// ・テンプレート文字列 `…` の地の文や、コードに日本語を直接書かない（RAW）。'…' にして t() に渡す
// ・例外にしたい行には // i18n-ignore と書く（正規表現の中の「円」など）
import fs from 'node:fs';
import path from 'node:path';
import { EN } from '../js/i18n/en.js';

const ROOT = new URL('..', import.meta.url).pathname;
const JP = /[぀-ヿ㐀-鿿！-｠]/;
const DIRS = ['js/screens', 'js/ui', 'js/data', 'js/domain', 'js/lib'];
export const FILES = ['js/app.js', ...DIRS.flatMap((d) => fs.readdirSync(path.join(ROOT, d)).map((f) => `${d}/${f}`))].filter(
  (f) => f.endsWith('.js')
);

/** JS を字句に分けて、文字列（STR）と、テンプレートの地の文・コード（RAW）の日本語を拾う */
function scan(src) {
  const found = []; // { kind:'STR'|'RAW', text, line }
  const stack = ['code'];
  let i = 0;
  let line = 1;
  let rawBuf = '';
  let rawLine = 1;
  const flushRaw = () => {
    if (JP.test(rawBuf)) found.push({ kind: 'RAW', text: rawBuf.trim().slice(0, 80), line: rawLine });
    rawBuf = '';
  };
  const addRaw = (c) => {
    if (!rawBuf) rawLine = line;
    rawBuf += c;
  };
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    const top = stack[stack.length - 1];
    if (c === '\n') {
      line++;
      flushRaw();
      i++;
      continue;
    }
    if (top === 'tpl') {
      if (c === '\\') {
        addRaw(c + (n ?? ''));
        i += 2;
        continue;
      }
      if (c === '`') {
        flushRaw();
        stack.pop();
        i++;
        continue;
      }
      if (c === '$' && n === '{') {
        flushRaw();
        stack.push('expr');
        i += 2;
        continue;
      }
      addRaw(c);
      i++;
      continue;
    }
    // コード（code / expr / brace）
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const body = src.slice(i, end === -1 ? src.length : end + 2);
      line += (body.match(/\n/g) ?? []).length;
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          s += src[j + 1];
          j += 2;
          continue;
        }
        s += src[j];
        j++;
      }
      if (JP.test(s)) found.push({ kind: 'STR', text: s, line });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      flushRaw();
      stack.push('tpl');
      i++;
      continue;
    }
    if (c === '{') {
      stack.push('brace');
      i++;
      continue;
    }
    if (c === '}') {
      if (top === 'expr' || top === 'brace') stack.pop();
      i++;
      continue;
    }
    if (JP.test(c)) addRaw(c);
    else flushRaw();
    i++;
  }
  flushRaw();
  return found;
}

export function check(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const lines = src.split('\n');
  const missing = [];
  const raw = [];
  for (const f of scan(src)) {
    if ((lines[f.line - 1] ?? '').includes('i18n-ignore')) continue;
    if (f.kind === 'STR' && !(f.text in EN)) missing.push(`${file}:${f.line}  ${f.text}`);
    if (f.kind === 'RAW') raw.push(`${file}:${f.line}  ${f.text}`);
  }
  return { missing, raw };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : FILES;
  let n = 0;
  for (const f of files) {
    const r = check(f);
    for (const x of r.raw) console.log('RAW     ', x);
    for (const x of r.missing) console.log('NO-EN   ', x);
    n += r.raw.length + r.missing.length;
  }
  console.log(n ? `${n} 件` : 'OK');
}
