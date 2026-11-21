"""Find the articles of law that match a question (BM25 over article-sized fragments, no external services).

Polish is heavily inflected, so words are compared by a short prefix without diacritics:
„zasiłku macierzyńskiego” and „zasilek macierzynski” end up as the same terms.
"""
import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path

PREFIX = 6
K1, B = 1.4, 0.75
STOPWORDS = {
    'a', 'aby', 'albo', 'ale', 'ani', 'bo', 'by', 'czy', 'dla', 'do', 'gdy', 'i', 'ich', 'ile', 'jak', 'jaki', 'jest', 'jestem',
    'jesli', 'jezeli', 'juz', 'ktory', 'ktora', 'ktore', 'lub', 'mam', 'mi', 'mnie', 'moge', 'na', 'nie', 'o', 'od', 'oraz', 'po',
    'przez', 'przy', 'sie', 'sa', 'ta', 'tak', 'te', 'to', 'tym', 'w', 'we', 'z', 'za', 'ze', 'zeby', 'co', 'mozna', 'moja', 'moj',
}
# The benefits act and the Labour Code answer most parents' questions; the general social insurance act is
# long and mentions „zasiłek”/„składka” everywhere, so it is slightly down-weighted.
ACT_WEIGHT = {'ustawa zasiłkowa': 1.25, 'Kodeks pracy': 1.25, 'ustawa o systemie ubezpieczeń społecznych': 0.75}
ARTICLE_REF = re.compile(r'art(?:ykul\w*)?\.?\s*(\d+[a-z]?)(?:\s*\^?\s*(\d+[a-z]?))?', re.IGNORECASE)


def fold(text: str) -> str:
    text = unicodedata.normalize('NFKD', text.lower().replace('ł', 'l'))
    return ''.join(c for c in text if not unicodedata.combining(c))


def terms(text: str) -> list[str]:
    return [w[:PREFIX] for w in re.findall(r'[a-z0-9]+', fold(text)) if w not in STOPWORDS and (len(w) > 2 or w.isdigit())]


class LegalIndex:
    def __init__(self, path: Path):
        self.chunks: list[dict] = json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
        self.docs = [Counter(terms(f"{c['act']} {c['text']}")) for c in self.chunks]
        self.lengths = [sum(d.values()) for d in self.docs]
        self.avg = (sum(self.lengths) / len(self.lengths)) if self.lengths else 1
        df = Counter(t for d in self.docs for t in d)
        n = len(self.docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def __len__(self) -> int:
        return len(self.chunks)

    def search(self, question: str, limit: int = 6, max_chars: int = 16_000) -> list[dict]:
        if not self.chunks or not question.strip():
            return []
        query = Counter(terms(question))
        scores = []
        for i, doc in enumerate(self.docs):
            norm = K1 * (1 - B + B * self.lengths[i] / self.avg)
            score = ACT_WEIGHT.get(self.chunks[i]['act'], 1.0) * sum(self.idf.get(t, 0) * doc[t] * (K1 + 1) / (doc[t] + norm) for t in query if t in doc)
            if score > 0:
                scores.append((score, i))

        # „art. 29” / „art. 182^1a” named in the question always comes first.
        wanted = {(m.group(1) + (f'^{m.group(2)}' if m.group(2) else '')).lower() for m in ARTICLE_REF.finditer(question)}
        pinned = [i for i, c in enumerate(self.chunks) if c['article'].split(' ')[0].lower() in wanted]

        order = pinned + [i for _, i in sorted(scores, reverse=True) if i not in pinned]
        hits, used = [], 0
        for i in order:
            chunk = self.chunks[i]
            if used + len(chunk['text']) > max_chars:
                continue
            hits.append(chunk)
            used += len(chunk['text'])
            if len(hits) >= limit:
                break
        return hits
