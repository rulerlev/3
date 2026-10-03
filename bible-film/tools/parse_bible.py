"""Читает весь файл Библии (66 книг) и строит data/bible.json + data/stats.json."""
import json, re, sys, collections
SRC = sys.argv[1]
verse_re = re.compile(r'^(.+?) (\d+):(\d+) \[([1-3A-Z]{3}) (\d+):(\d+)\] (.*)$')
toc_re = re.compile(r'^(\d\d)\. (.+?) \[([1-3A-Z]{3})\] — (\d+) глав')
books, order, verses = {}, [], []
for line in open(SRC, encoding='utf-8'):
    line = line.rstrip('\n')
    m = toc_re.match(line)
    if m and m.group(3) not in books:
        books[m.group(3)] = dict(n=int(m.group(1)), name=m.group(2), code=m.group(3), chapters=int(m.group(4)))
        order.append(m.group(3)); continue
    m = verse_re.match(line)
    if m:
        verses.append(dict(b=m.group(4), c=int(m.group(5)), v=int(m.group(6)), t=m.group(7)))
print('verses', len(verses), 'books', len(order))
# главы
chap = collections.OrderedDict()
for x in verses:
    chap.setdefault((x['b'], x['c']), []).append(x)
chapters = [dict(b=b, c=c, verses=len(vs), chars=sum(len(v['t']) for v in vs)) for (b, c), vs in chap.items()]
print('chapters', len(chapters))
words_re = re.compile(r'[А-Яа-яЁё]+')
total_words = 0
freq = collections.Counter()
for x in verses:
    ws = [w.lower() for w in words_re.findall(x['t'])]
    total_words += len(ws); freq.update(ws)
def count_stem(prefixes):
    return sum(c for w, c in freq.items() if any(w.startswith(p) for p in prefixes))
names = {
 'Господь': ['господ'], 'Бог': ['бог', 'бож'], 'Иисус': ['иисус'], 'Давид': ['давид'], 'Моисей': ['моисе'],
 'Авраам': ['авраам'], 'Израиль': ['израил'], 'Иерусалим': ['иерусалим'], 'Павел': ['павел', 'павл'],
 'Пётр': ['петр', 'пётр'], 'любовь': ['любов', 'любв', 'возлюб'], 'свет': ['свет'], 'вера': ['вер'],
 'жизнь': ['жизн'], 'мир': ['мир'], 'сердце': ['сердц', 'сердеч']}
name_counts = {k: count_stem(v) for k, v in names.items()}
# верные «точные» счётчики для имён (по началу слова)
shortest = sorted(verses, key=lambda x: len(x['t']))[:5]
longest = max(verses, key=lambda x: len(x['t']))
mid = verses[len(verses)//2]
bych = collections.Counter()
for ch in chapters: bych[ch['b']] += ch['verses']
stats = dict(
  books=len(order), chapters=len(chapters), verses=len(verses), words=total_words,
  chars=sum(len(x['t']) for x in verses),
  ot_chapters=sum(1 for ch in chapters if order.index(ch['b']) < 39),
  nt_chapters=sum(1 for ch in chapters if order.index(ch['b']) >= 39),
  name_counts=name_counts,
  shortest=[dict(ref=f"{books[x['b']]['name']} {x['c']}:{x['v']}", t=x['t']) for x in shortest],
  longest=dict(ref=f"{books[longest['b']]['name']} {longest['c']}:{longest['v']}", t=longest['t'], len=len(longest['t'])),
  middle=dict(ref=f"{books[mid['b']]['name']} {mid['c']}:{mid['v']}", t=mid['t']),
  biggest_chapter=max(chapters, key=lambda c: c['verses']),
  top_words=freq.most_common(60),
)
json.dump(dict(books=[books[c] | dict(verses=bych[c]) for c in order], chapters=chapters), open('data/bible.json', 'w'), ensure_ascii=False)
json.dump(stats, open('data/stats.json', 'w'), ensure_ascii=False, indent=1)
json.dump(verses, open('data/verses.json', 'w'), ensure_ascii=False)
print(json.dumps({k: v for k, v in stats.items() if k != 'top_words'}, ensure_ascii=False, indent=1))
print([w for w in stats['top_words'] if len(w[0]) > 3][:30])
