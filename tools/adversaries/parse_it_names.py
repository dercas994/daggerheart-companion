"""Dai manuali italiani prende SOLO i nomi ufficiali (avversario e caratteristiche) da abbinare all'SRD."""
import json, re, sys
import pdfplumber

GLYPH = {chr(0xe53f): '0', chr(0xe540): '0', **{chr(0xe540 + k): str(k) for k in range(1, 10)}}
def fix(s):
    s = ''.join(GLYPH.get(ch, ch) for ch in s).replace('­', '')
    s = re.sub(r'(?<=[A-Za-zàèéìòù])(ffi|ffl|fi|fl|ff) (?=[a-zàèéìòù])', r'\1', s)
    return s

blocks = []
for path in sys.argv[1:-1]:
    pdf = pdfplumber.open(path)
    for p in pdf.pages:
        full = p.extract_text() or ''
        if '| PF:' not in full: continue
        w = p.width
        for box in ((0, 0, w / 2, p.height), (w / 2, 0, w, p.height)):
            lines = [fix(l.strip()) for l in (p.crop(box).extract_text() or '').split('\n') if l.strip()]
            for i, ln in enumerate(lines):
                m = re.search(r'Difficoltà: (\d+) \| Soglie: ([^|]+)\| PF: (\d+) \| Stress: (\d+|Nessuno|-|—)', ln)
                if not m: continue
                # risali al nome: riga tutta maiuscola prima della riga del tipo
                name = None
                caps = lambda t: re.match(r"^[A-ZÀÈÉÌÒÙ0-9’'\-,() ]{2,}$", t) and not t.startswith('ATT') and not re.match(r'^[\d ()/]+$', t)
                for k in range(i - 1, max(-1, i - 9), -1):
                    if caps(lines[k]):
                        name = lines[k]
                        CONN = r'^(DI|DEL|DELLA|DELLE|DELL’|DEGLI|DEI|DAI|DALLE|DALLA|E|A|IN|DA)\b'
                        while k - 1 >= 0 and caps(lines[k - 1]) and (re.match(CONN, name) or re.search(r'\b(DI|DEI|DEL|DELLA|DELLE|DEGLI|E|DAL|DALLA|DALLE)$', lines[k - 1])) and not lines[k - 1].startswith('AVVERSARI'):
                            k -= 1; name = lines[k] + ' ' + name
                        break
                atk = lines[i + 1] if i + 1 < len(lines) else ''
                am = re.match(r'ATT: ([+−–-]?\S+) \| (.+?): (.+?) \| (.+)$', atk)
                feats = []
                exp = next((l for l in lines[i + 2:i + 5] if l.startswith('Esperienz')), '')
                for ln2 in lines[i + 2:]:
                    if re.search(r'Difficoltà: \d+ \|', ln2): break
                    fm = re.match(r'^(.{2,70}?) - (Passiva|Azione|Reazione):', ln2)
                    if fm: feats.append(fm.group(1))
                    if re.match(r"^[A-ZÀÈÉÌÒÙ’'\-, ]{4,}$", ln2) and feats: break
                th = m.group(2).strip()
                blocks.append({'name': name, 'difficulty': int(m.group(1)), 'thresholds': th, 'hp': int(m.group(3)),
                               'stress': m.group(4), 'atk': am.group(1).replace('−', '-').replace('–', '-') if am else None,
                               'weapon': am.group(2) if am else None, 'damage': am.group(4) if am else None, 'features': feats, 'experience': re.sub(r'^Esperienz[ae]:\s*', '', exp)})
json.dump(blocks, open(sys.argv[-1], 'w'), ensure_ascii=False, indent=1)
print(len(blocks), 'blocchi italiani;', sum(1 for b in blocks if not b['name']), 'senza nome')
