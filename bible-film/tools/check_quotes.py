"""Каждая цитата (v=q) обязана дословно совпадать с текстом стиха из файла."""
import json, re, sys
V = {f"{x['b']} {x['c']}:{x['v']}": x['t'] for x in json.load(open('data/verses.json'))}
norm = lambda s: re.sub(r'\s+', ' ', s.replace('—', '-').replace('ё', 'е').lower()).strip(' .,;:!')
bad = 0
for sc in json.load(open('data/script.json'))['scenes']:
    for l in sc['lines']:
        if l['v'] != 'q': continue
        verse = norm(V[l['ref']])
        for frag in l['t'].split('…'):
            if norm(frag) not in verse:
                bad += 1; print('MISMATCH', l['ref'], '|', frag, '|', V[l['ref']])
print('quotes ok' if not bad else f'{bad} mismatches'); sys.exit(1 if bad else 0)
