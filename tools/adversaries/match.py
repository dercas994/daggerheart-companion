"""Abbina gli avversari SRD (inglese) ai nomi ufficiali italiani tramite le statistiche."""
import json, re, sys
en = json.load(open(sys.argv[1])); it = json.load(open(sys.argv[2]))
def key(d, th, hp, st, atk):
    return (d, th, hp, st, str(atk))
idx = {}
for b in it:
    th = b['thresholds'].strip(); th = th if re.match(r'^\d+/\d+$', th) else 'None'
    st = b['stress'] if b['stress'].isdigit() else '0'
    atk = b['atk']
    try: atk = int(atk)
    except Exception: pass
    idx.setdefault(key(b['difficulty'], th, b['hp'], st, atk), []).append(b)
dice = lambda s: re.sub(r'\s+', '', (s or '').split(' ')[0]) if s else ''
OVERRIDE = {
  'sawtoothed-gillbeast': 'BRANCHIOBESTIA DAI DENTI A SEGA', 'battle-box': 'GUERRA IN SCATOLA', 'gobstalker': 'FAUCE PREDATRICE',
  'elite-soldier': 'SOLDATO SCELTO', 'guahalan-shifter': 'GUAHALA MUTAFORMA', 'fungispunj-sporophore': 'SPOROFORO DI FUNGISPUGNA',
  'guahalan-fang-lord': 'SIGNORE DELLA ZANNA DI GUAHALA', 'triceratops': 'TRICERATOPO', 'tyrannosaurus': 'TIRANNOSAURO',
  'demon-of-jealousy': 'DEMONE DELLA GELOSIA', 'dire-bat': 'PIPISTRELLO GIGANTE', 'viscera-sucker': 'SUGGIVISCERE',
  'ghastly-legion': 'LEGIONE FANTASMA', 'wyrmlings': 'NIDIATA DRACONICA', 'shapeshifting-fiend-revealed': 'DEMONE MUTAFORME SMASCHERATO',
  'realm-breaker': 'SIGNORE DELLA GUERRA DEI CADUTI: DISTRUTTORE DI REAMI', 'undefeated-champion': 'SIGNORE DELLA GUERRA DEI CADUTI: CAMPIONE IMBATTUTO',
  'gargantuan-sea-turtle': 'TESTUGGINE DI MARE GIGANTESCA', 'common-ruffian': 'FURFANTE COMUNE',
}
byname = {}
for b in it:
    if b['name']: byname.setdefault(b['name'], b)
res = {}; miss = []
for a in en:
    th = '/'.join(map(str, a['thresholds'])) if a['thresholds'] else 'None'
    c = idx.get(key(a['difficulty'], th, a['hp'], str(a['stress']), a.get('atk')), [])
    if len(c) > 1:
        c2 = [b for b in c if dice(b['damage']) == dice(a.get('damage', ''))]
        c = c2 or c
    if len(c) > 1:
        c2 = [b for b in c if len(b['features']) == len(a['features'])]
        c = c2 or c
    names = {b['name'] for b in c if b['name']}
    if a['id'] in OVERRIDE:
        nm = OVERRIDE[a['id']]
        b = next((b for b in c if b['name'] and nm.endswith(b['name'].split(' ')[-1])), None) or byname.get(nm) or (c[0] if len(c) == 1 else None)
        res[a['id']] = {'name': nm, 'weapon': b['weapon'] if b else None, 'features': b['features'] if b else [], 'experience': b.get('experience', '') if b else ''}
        continue
    if len(names) == 1:
        b = next(b for b in c if b['name'])
        res[a['id']] = {'name': b['name'], 'weapon': b['weapon'], 'features': b['features'], 'experience': b.get('experience', '')}
    else:
        miss.append((a['id'], sorted(names)))
json.dump(res, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
print('abbinati', len(res), 'su', len(en)); [print(' ', m) for m in miss]
