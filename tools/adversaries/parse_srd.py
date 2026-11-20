"""Estrae gli avversari dall'SRD 2.0 (pagine 97-158) in JSON (inglese)."""
import json, re, sys
import pdfplumber

SRD = sys.argv[1]
OUT = sys.argv[2]
TIERS = [(97, 113, 1), (114, 130, 2), (131, 144, 3), (145, 158, 4)]

GLYPH = {chr(0xe53f): '0', chr(0xe540): '0', **{chr(0xe540 + k): str(k) for k in range(1, 10)}}

def fix(s):
    s = ''.join(GLYPH.get(ch, ch) for ch in s)
    s = s.replace('­', '')
    s = re.sub(r'(?<=[A-Za-z])(ffi|ffl|fi|fl|ff) (?=[a-z])', r'\1', s)
    s = re.sub(r'\b(ffi|ffl|fi|fl|ff) (?=[a-z])', r'\1', s)
    return s

lines = []
pdf = pdfplumber.open(SRD)
for a, b, tier in TIERS:
    for n in range(a, b + 1):
        p = pdf.pages[n - 1]
        w = p.width
        for box in ((0, 0, w / 2, p.height), (w / 2, 0, w, p.height)):
            t = p.crop(box).extract_text() or ''
            for ln in t.split('\n'):
                ln = fix(ln.strip())
                if not ln or re.match(r'^(TIER \d ADVERSARIES|Daggerheart SRD|\d+$|\d+ +Daggerheart SRD)', ln) or re.match(r'^Daggerheart SRD +\d+$', ln):
                    continue
                lines.append((tier, ln))

advs = []
i = 0
while i < len(lines):
    tier, ln = lines[i]
    nxt = lines[i + 1][1] if i + 1 < len(lines) else ''
    if re.match(r"^[A-Z0-9’'\-,() ]{3,}$", ln) and nxt.startswith('Tier'):
        advs.append({'tier': tier, 'name': ln.title(), 'raw': []})
        i += 1
        continue
    if advs:
        advs[-1]['raw'].append(ln)
    i += 1

def parse(a):
    raw = a.pop('raw')
    typ = raw[0][4:].strip()
    tm = re.match(r'^(\d)\s+(.*)$', typ)
    if tm: a['tier'] = int(tm.group(1)); typ = tm.group(2)
    a['type'] = typ
    m = re.match(r'(Horde) \((\d+)/HP\)', typ)
    if m: a['type'] = 'Horde'; a['horde'] = int(m.group(2))
    j = 1
    desc = []
    while j < len(raw) and not raw[j].startswith('Motives'):
        desc.append(raw[j]); j += 1
    a['desc'] = ' '.join(desc)
    mot = []
    while j < len(raw) and not raw[j].startswith('Difficulty'):
        mot.append(raw[j]); j += 1
    a['motives'] = ' '.join(mot).replace('Motives & Tactics:', '').strip()
    st = raw[j] if j < len(raw) else ''
    m = re.search(r'Difficulty: (\d+) \| Thresholds: ([^|]+)\| HP: (\d+) \| Stress: (\d+|None)', st)
    if not m:
        a['error'] = 'stats: ' + st
        return a
    a['difficulty'] = int(m.group(1))
    th = m.group(2).strip()
    a['thresholds'] = [int(x) for x in th.split('/')] if re.match(r'^\d+/\d+$', th) else None
    a['hp'] = int(m.group(3)); a['stress'] = int(m.group(4)) if m.group(4).isdigit() else 0
    j += 1
    atk = raw[j] if j < len(raw) else ''
    m = re.match(r'ATK: ([+−–-]\S+) \| (.+?): (Melee|Very Close|Close|Far|Very Far) \| (.+)$', atk)
    if m:
        av = m.group(1).replace('−', '-').replace('–', '-')
        a['atk'] = int(av) if re.match(r'^[+-]?\d+$', av) else av
        a['weapon'] = m.group(2); a['range'] = m.group(3)
        dm = m.group(4).strip()
        mm = re.match(r'(.+?) (phy|mag|phy/mag)$', dm)
        a['damage'] = mm.group(1) if mm else dm
        a['damage_type'] = mm.group(2) if mm else 'phy'
        j += 1
    else:
        a['error'] = 'atk: ' + atk
    exp = []
    while j < len(raw) and raw[j] != 'FEATURES':
        exp.append(raw[j]); j += 1
    a['experience'] = ' '.join(exp).replace('Experience:', '').strip()
    feats = []
    for ln in raw[j + 1:]:
        m = re.match(r'^(.{2,60}?) - (Passive|Action|Reaction):\s*(.*)$', ln)
        if m:
            feats.append({'name': m.group(1), 'kind': m.group(2).lower(), 'text': m.group(3)})
        elif feats:
            feats[-1]['text'] += ' ' + ln
    for f in feats:
        f['text'] = f['text'].strip()
        t = f['text']
        fm = re.search(r'[Ss]pend (a|two|three|\d) Fear', t)
        if fm: f['fear'] = {'a': 1, 'two': 2, 'three': 3}.get(fm.group(1), int(fm.group(1)) if fm.group(1).isdigit() else 1)
        sm = re.search(r'Mark (a|two|\d) Stress', t)
        if sm: f['stress'] = {'a': 1, 'two': 2}.get(sm.group(1), int(sm.group(1)) if sm.group(1).isdigit() else 1)
    a['features'] = feats
    return a

out = [parse(a) for a in advs]
for a in out:
    a['id'] = re.sub(r'[^a-z0-9]+', '-', a['name'].lower().replace('’', '')).strip('-')
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
errs = [a for a in out if 'error' in a]
print(len(out), 'avversari,', len(errs), 'con errori')
for e in errs[:20]: print(' ', e['name'], '|', e['error'][:90])
from collections import Counter
print(Counter(a['type'] for a in out)); print(Counter(a['tier'] for a in out))
