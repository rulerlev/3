import json, re, collections
verses = json.load(open('data/verses.json')); W = re.compile(r'[А-Яа-яЁё]+')
order = [b['code'] for b in json.load(open('data/bible.json'))['books']]
nt = set(order[39:])
def forms(fs, only=None):
    fs = set(fs); n = 0
    for x in verses:
        if only and x['b'] not in only: continue
        n += sum(1 for w in W.findall(x['t'].lower()) if w in fs)
    return n
def phrase(p):
    return sum(x['t'].lower().count(p) for x in verses)
out = dict(
 lord=forms(['господь','господа','господу','господом','господе','господи']),
 god=forms(['бог','бога','богу','богом','боге','боже']),
 jesus_nt=forms(['иисус','иисуса','иисусу','иисусом','иисусе'], nt),
 love=forms(['любовь','любви','любовью']),
 light=forms(['свет','света','свету','светом','свете']),
 fear_not=phrase('не бойся')+phrase('не бойтесь')+phrase('не бойтеся'),
 amen=forms(['аминь']),
 nt_shortest=sorted([x for x in verses if x['b'] in nt], key=lambda x: len(x['t']))[:3],
)
print(json.dumps(out, ensure_ascii=False, indent=1))
json.dump(out, open('data/exact.json','w'), ensure_ascii=False, indent=1)
