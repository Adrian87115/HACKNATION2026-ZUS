"""Semantic search over the legal fragments with OpenAI embeddings – complements the BM25 search in retriever.py.

BM25 finds exact words („art. 29”, „urlop ojcowski”); embeddings find fragments with the same meaning even when the
question uses everyday words („żona leży w szpitalu, czy mogę przejąć opiekę?”). The two rankings are merged in
LegalIndex.search().

The fragment vectors are built once – by `python -m python.knowledge.build`, or for an existing acts.json by
`python -m python.knowledge.vectors` – and stored next to acts.json. At chat time only the question is embedded
(one short OpenAI request per message). Without an OpenAI key, with missing/outdated vectors or when the API is down,
ranking() returns [] and ZUSia simply uses BM25 alone.
"""
import hashlib
import json
import logging
import sys
import threading
from collections import OrderedDict
from pathlib import Path

import numpy as np
from openai import OpenAI, OpenAIError

from python.config import setting

logger = logging.getLogger(__name__)

MODEL = 'text-embedding-3-large'
VECTORS_FILE = 'vectors.npy'
META_FILE = 'vectors.json'
BATCH = 100
CANDIDATES = 20
CACHE_SIZE = 256


def openai_key() -> str | None:
    # OPENAI_API_KEY is the usual name; OPEN_AI_KEY is what the repo .env uses.
    return setting('OPENAI_API_KEY') or setting('OPEN_AI_KEY')


def fragment_text(chunk: dict) -> str:
    """What gets embedded: the act and article number help the model place the fragment."""
    return f"{chunk['act']} – art. {chunk['article']}\n{chunk['text']}"


def fingerprint(chunks: list[dict]) -> str:
    """Identifies the exact acts.json the vectors were built from, so stale vectors are never used."""
    return hashlib.sha256('\x00'.join(fragment_text(c) for c in chunks).encode('utf-8')).hexdigest()


def build_vectors(chunks: list[dict], data_dir: Path) -> bool:
    """Embed every legal fragment and save vectors.npy + vectors.json. Returns False when no OpenAI key is set."""
    key = openai_key()
    if not key:
        print('Brak klucza OpenAI (OPENAI_API_KEY / OPEN_AI_KEY) – pomijam embeddingi, czat użyje samego BM25.',
              file = sys.stderr)
        return False

    client = OpenAI(api_key = key)
    vectors = []
    for start in range(0, len(chunks), BATCH):
        batch = [fragment_text(c) for c in chunks[start:start + BATCH]]
        response = client.embeddings.create(model = MODEL, input = batch)
        vectors.extend(item.embedding for item in response.data)
        print(f'  embeddingi: {min(start + BATCH, len(chunks))}/{len(chunks)}', file = sys.stderr)

    matrix = np.asarray(vectors, dtype = np.float32)
    matrix /= np.linalg.norm(matrix, axis = 1, keepdims = True)
    # float16 halves the file size; the ranking is unaffected.
    np.save(data_dir / VECTORS_FILE, matrix.astype(np.float16))
    (data_dir / META_FILE).write_text(json.dumps({'model': MODEL, 'count': len(chunks), 'fingerprint': fingerprint(chunks)},
                                                 indent = 2), encoding = 'utf-8')
    return True


class VectorIndex:
    def __init__(self, chunks: list[dict], data_dir: Path):
        self.vectors: np.ndarray | None = None
        self._client: OpenAI | None = None
        self._client_key: str | None = None
        self._cache: OrderedDict[str, np.ndarray] = OrderedDict()
        self._lock = threading.Lock()

        vectors_file, meta_file = data_dir / VECTORS_FILE, data_dir / META_FILE
        if not chunks or not vectors_file.exists() or not meta_file.exists():
            logger.info('No embeddings in %s – legal search uses BM25 only (build them: python -m python.knowledge.vectors)',
                        data_dir)
            return

        meta = json.loads(meta_file.read_text(encoding = 'utf-8'))
        if meta.get('model') != MODEL or meta.get('count') != len(chunks) or meta.get('fingerprint') != fingerprint(chunks):
            logger.warning('Embeddings in %s do not match acts.json – ignoring them (rebuild: python -m python.knowledge.vectors)',
                           data_dir)
            return

        self.vectors = np.load(vectors_file).astype(np.float32)

    def __bool__(self) -> bool:
        return self.vectors is not None

    def _openai(self) -> OpenAI | None:
        key = openai_key()  # re-read every time, so a key added to .env while running is picked up
        if not key:
            return None
        if self._client is None or key != self._client_key:
            self._client = OpenAI(api_key = key, timeout = 5, max_retries = 1)
            self._client_key = key
        return self._client

    def _embed(self, question: str) -> np.ndarray | None:
        with self._lock:
            if question in self._cache:
                self._cache.move_to_end(question)
                return self._cache[question]
            client = self._openai()
        if client is None:
            return None

        response = client.embeddings.create(model = MODEL, input = [question])
        vector = np.asarray(response.data[0].embedding, dtype = np.float32)
        vector /= np.linalg.norm(vector)
        with self._lock:
            self._cache[question] = vector
            if len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last = False)
        return vector

    def ranking(self, question: str, limit: int = CANDIDATES) -> list[int]:
        """Indices of the fragments closest in meaning to the question (best first); [] when unavailable."""
        if self.vectors is None or not question.strip():
            return []
        try:
            query = self._embed(question)
        except OpenAIError as exc:
            logger.warning('OpenAI embeddings unavailable (%s) – using BM25 only for this question', exc)
            return []
        if query is None:
            return []
        scores = self.vectors @ query
        return np.argsort(-scores)[:limit].tolist()


if __name__ == '__main__':
    # Embed an existing acts.json without downloading the acts again.
    from python.knowledge.sources import DATA_DIR

    acts = json.loads((DATA_DIR / 'acts.json').read_text(encoding = 'utf-8'))
    if build_vectors(acts, DATA_DIR):
        print(f'Zapisano embeddingi {len(acts)} fragmentów w {DATA_DIR / VECTORS_FILE}', file = sys.stderr)
