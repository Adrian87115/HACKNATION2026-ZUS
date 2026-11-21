"""Case import: read the documents of a benefit case with Gemini and return structured data for the calculators."""
import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from python.case_schemas import CaseExtraction

logger = logging.getLogger(__name__)
router = APIRouter(prefix = '/cases', tags = ['cases'])

MAX_FILES = 10
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TOTAL_BYTES = 40 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'}


def _validate(content_type: str | None, data: bytes, name: str) -> str:
    if not data:
        raise HTTPException(status_code = 400, detail = f'Plik „{name}” jest pusty.')
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code = 413, detail = f'Plik „{name}” jest większy niż 10 MB.')
    if content_type == 'application/pdf' or data.startswith(b'%PDF-'):
        if not data.startswith(b'%PDF-'):
            raise HTTPException(status_code = 400, detail = f'Plik „{name}” nie jest poprawnym plikiem PDF.')
        return 'application/pdf'
    if content_type in ALLOWED_IMAGE_TYPES:
        return content_type
    raise HTTPException(status_code = 415, detail = f'Plik „{name}” ma nieobsługiwany format. Dodaj PDF albo zdjęcie (JPG, PNG).')


@router.post('/extract', response_model = CaseExtraction, summary = 'Read a benefit case from its documents')
async def extract_case(request: Request, files: list[UploadFile] = File(...)) -> CaseExtraction:
    if not files:
        raise HTTPException(status_code = 400, detail = 'Dodaj co najmniej jeden dokument.')
    if len(files) > MAX_FILES:
        raise HTTPException(status_code = 413, detail = f'Możesz dodać maksymalnie {MAX_FILES} plików naraz.')

    documents: list[tuple[bytes, str]] = []
    total = 0
    for upload in files:
        data = await upload.read(MAX_FILE_BYTES + 1)
        await upload.close()
        name = upload.filename or 'dokument'
        documents.append((data, _validate(upload.content_type, data, name)))
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise HTTPException(status_code = 413, detail = 'Dokumenty są łącznie zbyt duże (maks. 40 MB).')

    try:
        bot = await run_in_threadpool(request.app.state.sessions.get_bot)
    except Exception as exc:
        logger.exception('ZUSia is not configured or unavailable')
        raise HTTPException(status_code = 503, detail = 'Odczytywanie dokumentów jest chwilowo niedostępne.') from exc

    try:
        return await run_in_threadpool(bot.extract_case, documents)
    except Exception as exc:
        logger.exception('Case extraction failed')
        raise HTTPException(status_code = 502, detail = 'Nie udało się odczytać dokumentów. Spróbuj ponownie.') from exc
