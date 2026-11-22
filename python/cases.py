"""Case import: read the documents of a benefit case with Gemini and return structured data for the calculators.

When object storage (MinIO / S3) is configured and the user agrees (`keep=true`), the uploaded documents are kept under `cases/<case_id>/`
in the cases bucket (private; expires after CASE_RETENTION_DAYS via the bucket lifecycle rule), so the user
can reopen the source documents and delete the case.
"""
import logging
import re
import uuid
from urllib.parse import quote

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from python.case_schemas import CaseExtraction
from python.storage import ObjectNotFound, ObjectStorage, StorageError

logger = logging.getLogger(__name__)
router = APIRouter(prefix = '/cases', tags = ['cases'])

MAX_FILES = 10
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TOTAL_BYTES = 40 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'}
CASE_ID = re.compile(r'^[0-9a-f]{32}$')
FILE_ID = re.compile(r'^[0-9]{2}$')


class StoredFile(BaseModel):
    id: str
    name: str
    size: int
    content_type: str


class CaseImportResult(CaseExtraction):
    case_id: str | None = None
    files: list[StoredFile] = []


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


def _storage(request: Request) -> ObjectStorage:
    storage = getattr(request.app.state, 'storage', None)
    if storage is None:
        raise HTTPException(status_code = 503, detail = 'Przechowywanie dokumentów jest wyłączone.')
    return storage


def _store_documents(storage: ObjectStorage, case_id: str, documents: list[tuple[bytes, str, str]]) -> list[StoredFile]:
    stored = []
    for index, (data, mime, name) in enumerate(documents, start = 1):
        file_id = f'{index:02d}'
        storage.put(storage.cases_bucket, f'cases/{case_id}/{file_id}', data, mime, filename = name)
        stored.append(StoredFile(id = file_id, name = name, size = len(data), content_type = mime))
    return stored


@router.post('/extract', response_model = CaseImportResult, summary = 'Read a benefit case from its documents')
async def extract_case(request: Request, files: list[UploadFile] = File(...), keep: bool = Form(False)) -> CaseImportResult:
    if not files:
        raise HTTPException(status_code = 400, detail = 'Dodaj co najmniej jeden dokument.')
    if len(files) > MAX_FILES:
        raise HTTPException(status_code = 413, detail = f'Możesz dodać maksymalnie {MAX_FILES} plików naraz.')

    documents: list[tuple[bytes, str, str]] = []
    total = 0
    for upload in files:
        data = await upload.read(MAX_FILE_BYTES + 1)
        await upload.close()
        name = upload.filename or 'dokument'
        documents.append((data, _validate(upload.content_type, data, name), name))
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise HTTPException(status_code = 413, detail = 'Dokumenty są łącznie zbyt duże (maks. 40 MB).')

    try:
        bot = await run_in_threadpool(request.app.state.sessions.get_bot)
    except Exception as exc:
        logger.exception('ZUSia is not configured or unavailable')
        raise HTTPException(status_code = 503, detail = 'Odczytywanie dokumentów jest chwilowo niedostępne.') from exc

    try:
        extraction = await run_in_threadpool(bot.extract_case, [(data, mime) for data, mime, _ in documents])
    except Exception as exc:
        logger.exception('Case extraction failed')
        raise HTTPException(status_code = 502, detail = 'Nie udało się odczytać dokumentów. Spróbuj ponownie.') from exc

    result = CaseImportResult(**extraction.model_dump())
    storage = getattr(request.app.state, 'storage', None)
    # without the user's consent the documents are only read and then discarded
    if storage is not None and keep:
        case_id = uuid.uuid4().hex
        try:
            result.files = await run_in_threadpool(_store_documents, storage, case_id, documents)
            result.case_id = case_id
        except StorageError:
            # The extraction is still useful – only the source documents are not kept.
            logger.exception('Could not store documents of case %s', case_id)
            await run_in_threadpool(_safe_delete, storage, case_id)
    return result


@router.get('/{case_id}/files/{file_id}', summary = 'Download a stored case document')
async def get_case_file(case_id: str, file_id: str, request: Request) -> Response:
    if not CASE_ID.match(case_id) or not FILE_ID.match(file_id):
        raise HTTPException(status_code = 404, detail = 'Nie znaleziono dokumentu.')
    storage = _storage(request)
    try:
        obj = await run_in_threadpool(storage.get, storage.cases_bucket, f'cases/{case_id}/{file_id}')
    except ObjectNotFound as exc:
        raise HTTPException(status_code = 404, detail = 'Nie znaleziono dokumentu – mógł zostać usunięty.') from exc
    except StorageError as exc:
        logger.exception('Could not read case document')
        raise HTTPException(status_code = 503, detail = 'Nie udało się pobrać dokumentu. Spróbuj ponownie.') from exc

    filename = obj.filename or f'dokument-{file_id}'
    return Response(content = obj.data,
                    media_type = obj.content_type,
                    headers = {'Content-Disposition': f"inline; filename*=UTF-8''{quote(filename)}",
                               'Cache-Control': 'private, no-store',
                               'X-Content-Type-Options': 'nosniff'})


@router.delete('/{case_id}', status_code = 204, summary = 'Delete a case and its stored documents')
async def delete_case(case_id: str, request: Request) -> Response:
    if not CASE_ID.match(case_id):
        raise HTTPException(status_code = 404, detail = 'Nie znaleziono sprawy.')
    storage = _storage(request)
    try:
        await run_in_threadpool(storage.delete_prefix, storage.cases_bucket, f'cases/{case_id}/')
    except StorageError as exc:
        logger.exception('Could not delete case %s', case_id)
        raise HTTPException(status_code = 503, detail = 'Nie udało się usunąć dokumentów. Spróbuj ponownie.') from exc
    return Response(status_code = 204)


def _safe_delete(storage: ObjectStorage, case_id: str) -> None:
    try:
        storage.delete_prefix(storage.cases_bucket, f'cases/{case_id}/')
    except StorageError:
        logger.exception('Could not clean up case %s', case_id)
