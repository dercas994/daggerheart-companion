"""Costruisce src/data/adversaries.json: numeri dall'SRD, nomi ufficiali italiani,
testi tradotti (tools/adversaries/it/*.json, scritti da noi) con ripiego sull'inglese."""
import glob, json, os, re
HERE = os.path.dirname(__file__)
en = json.load(open(os.path.join(HERE, 'adv_en.json')))
names = json.load(open(os.path.join(HERE, 'adv_names.json')))
tr = {}
for f in sorted(glob.glob(os.path.join(HERE, 'it', '*.json'))):
    tr.update(json.load(open(f)))

SMALL = {'di', 'del', 'della', 'delle', 'dello', 'dei', 'degli', 'da', 'dal', 'dalla', 'dalle', 'dai', 'e', 'a', 'in', 'al', 'alla'}
def title(s):
    out = []
    for i, w in enumerate(s.lower().split(' ')):
        m = re.match(r"^(dell|dall|d|l|all|nell|sull)’(.+)$", w)
        if m:
            out.append(m.group(1) + '’' + m.group(2)[:1].upper() + m.group(2)[1:]); continue
        if i > 0 and w in SMALL: out.append(w); continue
        out.append('-'.join(p[:1].upper() + p[1:] for p in w.split('-')))
    return ' '.join(out).replace(': ', ': ')

TYPE = {'Solo': 'Solitario', 'Standard': 'Avversario Base', 'Skulk': 'Sicario', 'Bruiser': 'Bruto', 'Leader': 'Condottiero',
        'Minion': 'Seguace', 'Horde': 'Orda', 'Social': 'Controparte', 'Support': 'Supporto', 'Ranged': 'Tiratore'}
KIND = {'passive': 'Passiva', 'action': 'Azione', 'reaction': 'Reazione'}

out = []
for a in en:
    n = names.get(a['id'], {})
    t = tr.get(a['id'], {})
    fit = n.get('features') or []
    feats = []
    for i, f in enumerate(a['features']):
        name_it = fit[i] if len(fit) == len(a['features']) else (t.get('fn') or [None] * 99)[i]
        texts = t.get('f') or []
        feats.append({k: v for k, v in {
            'name': name_it or f['name'], 'name_en': f['name'], 'kind': f['kind'],
            'text': texts[i] if i < len(texts) else f['text'], 'fear': f.get('fear'), 'stress': f.get('stress'),
            'it': i < len(texts),
        }.items() if v is not None})
    out.append({k: v for k, v in {
        'id': a['id'], 'tier': a['tier'], 'type': a['type'], 'type_it': TYPE.get(a['type'], a['type']), 'horde': a.get('horde'),
        'name': title(n['name']) if n.get('name') else a['name'], 'name_en': a['name'],
        'desc': t.get('desc', a['desc']), 'motives': t.get('motives', a['motives']),
        'difficulty': a['difficulty'], 'thresholds': a['thresholds'], 'hp': a['hp'], 'stress': a['stress'],
        'atk': a.get('atk'), 'weapon': n.get('weapon') or a.get('weapon'), 'range': a.get('range'),
        'damage': a.get('damage'), 'damage_type': a.get('damage_type'),
        'experience': n.get('experience') or t.get('experience') or a.get('experience', ''),
        'features': feats,
    }.items() if v is not None})
dst = os.path.join(HERE, '..', '..', 'src', 'data', 'adversaries.json')
json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
done = sum(1 for a in out if a['id'] in tr)
print(f'{len(out)} avversari, {done} con testi tradotti, {os.path.getsize(dst) // 1024} KB')
