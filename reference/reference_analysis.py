"""Independent reference implementation (Python, lxml + zoneinfo). The JavaScript engine must reproduce its output.
Written separately from the JS code on purpose: two implementations checking each other.
Usage: python3 reference/reference_analysis.py <export.xml> <out.json>"""
import sys, json, collections, datetime as dt
from zoneinfo import ZoneInfo
from lxml import etree
TZ = ZoneInfo('America/Toronto'); U = dt.timezone.utc
A = '{http://www.w3.org/2005/Atom}'; E = '{http://naesb.org/espi}'

def holidays(y):
    import calendar
    def nth(m, n):  # nth Monday
        d = [x for x in range(1, 32) if x <= calendar.monthrange(y, m)[1] and dt.date(y, m, x).weekday() == 0]
        return dt.date(y, m, d[n - 1])
    a = y % 19; b, c = divmod(y, 100); d, e = divmod(b, 4); f = (b + 8) // 25; g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30; i, k = divmod(c, 4); l = (32 + 2 * e + 2 * i - h - k) % 7; m = (a + 11 * h + 22 * l) // 451
    easter = dt.date(y, (h + l - 7 * m + 114) // 31, (h + l - 7 * m + 114) % 31 + 1)
    vic = dt.date(y, 5, 24)
    while vic.weekday() != 0: vic -= dt.timedelta(1)
    nominal = [dt.date(y, 1, 1), nth(2, 3), easter - dt.timedelta(2), vic, dt.date(y, 7, 1), nth(8, 1), nth(9, 1), nth(10, 2), dt.date(y, 12, 25), dt.date(y, 12, 26)]
    out = []
    for x in nominal:
        while x.weekday() >= 5 or x in out: x += dt.timedelta(1)
        out.append(x)
    return set(out)
HOL = {}
def is_hol(d):
    for y in (d.year, d.year - 1):
        if y not in HOL: HOL[y] = holidays(y)
        if d in HOL[y]: return True
    return False
def tou(t):
    if t.weekday() >= 5 or is_hol(t.date()) or t.hour < 7 or t.hour >= 19: return 'off'
    md = 11 <= t.hour < 17
    return ('on' if md else 'mid') if 5 <= t.month <= 10 else ('mid' if md else 'on')
def ulo(t):
    if t.hour >= 23 or t.hour < 7: return 'overnight'
    if t.weekday() >= 5 or is_hol(t.date()): return 'off'
    return 'on' if 16 <= t.hour < 21 else 'mid'

src, out = sys.argv[1:3]
rts = {}; mr_rt = {}; blocks = collections.defaultdict(list)
for _, el in etree.iterparse(src, tag=A + 'entry'):
    c = el.find(A + 'content'); res = c[0]; kind = etree.QName(res).localname
    links = {}
    for l in el.findall(A + 'link'): links.setdefault(l.get('rel'), []).append(l.get('href').rstrip('/'))
    selfh = links['self'][0]
    if kind == 'ReadingType': rts[selfh] = {x.tag.replace(E, ''): x.text for x in res}
    elif kind == 'MeterReading': mr_rt[selfh] = next(h for h in links.get('related', []) if '/ReadingType/' in h)
    elif kind == 'IntervalBlock':
        mr = links['up'][0].rsplit('/IntervalBlock', 1)[0]
        for ir in res.findall(E + 'IntervalReading'):
            blocks[mr].append((int(ir.findtext(E + 'timePeriod/' + E + 'start')), int(ir.findtext(E + 'timePeriod/' + E + 'duration')), int(ir.findtext(E + 'value'))))
    el.clear()
cons = next(mr for mr, rt in mr_rt.items() if rts[rt]['uom'] == '72' and rts[rt]['accumulationBehaviour'] == '4' and rts[rt]['flowDirection'] == '1')
rt = rts[mr_rt[cons]]; scale = 10 ** int(rt['powerOfTenMultiplier']) / 1000
iv = sorted(blocks[cons])
months = collections.OrderedDict(); perday = collections.Counter()
for s, d, v in iv:
    t = dt.datetime.fromtimestamp(s, U).astimezone(TZ); k = v * scale; key = t.strftime('%Y-%m')
    m = months.setdefault(key, {'kwh': 0, 'tou': collections.Counter(), 'ulo': collections.Counter()})
    m['kwh'] += k; m['tou'][tou(t)] += k; m['ulo'][ulo(t)] += k; perday[t.date().isoformat()] += 1
res = {'intervals': len(iv), 'totalKwh': round(sum(v for *_, v in iv) * scale, 6), 'intervalSeconds': iv[0][1],
       'nonStandardDays': {d: n for d, n in perday.items() if n != 86400 // iv[0][1]},
       'months': {k: {'kwh': round(m['kwh'], 6), 'tou': {p: round(x, 6) for p, x in m['tou'].items()}, 'ulo': {p: round(x, 6) for p, x in m['ulo'].items()}} for k, m in months.items()}}
json.dump(res, open(out, 'w'), indent=1); print('wrote', out, res['intervals'], 'intervals', res['totalKwh'], 'kWh')
