"""Find the articles of law that match a question (BM25 over article-sized fragments, no external services).

Polish is heavily inflected, so words are compared by a short prefix without diacritics:
„zasiłku macierzyńskiego” and „zasilek macierzynski” end up as the same terms.

When a semantic ranking is passed in (OpenAI embeddings, see vectors.py), it is merged with the BM25 ranking by
Reciprocal Rank Fusion – fragments ranked high by either method come first.
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
# Reciprocal Rank Fusion: each ranking adds weight / (RRF_K + position); only the top FUSION_DEPTH of BM25 take part.
# Tuned on 60 labelled parents' questions: embeddings x3 and K=10 put the right article in the top 6 for 57/60
# (equal weights, K=60: 51/60; BM25 alone: 41/60). K 5–10 with weight 2.5–4 all score the same.
RRF_K = 10
FUSION_DEPTH = 20
SEMANTIC_WEIGHT = 3.0


def fuse(*rankings: list[int], weights: tuple[float, ...] | None = None) -> list[int]:
    scores: dict[int, float] = {}
    for ranking, weight in zip(rankings, weights or (1.0,) * len(rankings)):
        for position, i in enumerate(ranking, start = 1):
            scores[i] = scores.get(i, 0.0) + weight / (RRF_K + position)
    return sorted(scores, key = lambda i: -scores[i])


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

    def search(self, question: str, limit: int = 6, max_chars: int = 16_000,
               semantic: list[int] | None = None) -> list[dict]:
        """`semantic` – fragment indices ranked by embeddings (best first); merged with BM25 when given."""
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

        ranked = [i for _, i in sorted(scores, reverse=True)]
        if semantic:
            fused = fuse(ranked[:FUSION_DEPTH], semantic, weights = (1.0, SEMANTIC_WEIGHT))
            in_fused = set(fused)
            ranked = fused + [i for i in ranked if i not in in_fused]

        order = pinned + [i for i in ranked if i not in pinned]
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
