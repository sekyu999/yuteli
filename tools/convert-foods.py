# 日本食品標準成分表（八訂）増補2023年（令和8年3月27日版Excel）→ アプリ用 JSON
# 使い方: python3 tools/convert-foods.py <ダウンロードしたExcel> data/foods.json
# 必要: pip install openpyxl
import sys, json, re, openpyxl
src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
ws = wb['表全体']
ids = list(ws.iter_rows(min_row=12, max_row=12, values_only=True))[0]
col = {v.strip(): i for i, v in enumerate(ids) if isinstance(v, str)}
KEYS = [('energy','ENERC_KCAL'),('protein','PROT-'),('fat','FAT-'),('carb','CHOCDF-'),('fiber','FIB-'),
        ('salt','NACL_EQ'),('calcium','CA'),('iron','FE'),('vitA','VITA_RAE'),('vitD','VITD'),
        ('vitB1','THIA'),('vitB2','RIBF'),('vitC','VITC')]
def num(v):
    if v is None: return None
    if isinstance(v,(int,float)): return float(v)
    s = str(v).strip()
    if s in ('', '-', '*'): return None
    s = s.strip('()')
    if s in ('Tr', '0'): return 0.0
    try: return float(s)
    except ValueError: return None
foods = []
for r in ws.iter_rows(min_row=13, values_only=True):
    code = r[1]
    if not code: continue
    name = re.sub(r'[　 ]+', ' ', str(r[3])).strip()
    vals = [num(r[col[k]]) for _, k in KEYS]
    foods.append([str(code), name, int(r[0])] + [None if v is None else round(v, 3) for v in vals])
meta = {'source': '日本食品標準成分表（八訂）増補2023年（文部科学省、令和8年3月27日正誤反映版）',
        'per': '可食部100gあたり', 'fields': ['code','name','group'] + [k for k,_ in KEYS]}
json.dump({'meta': meta, 'foods': foods}, open(out,'w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
print(len(foods), 'foods')
