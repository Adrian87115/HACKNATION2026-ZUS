import logging
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from python.schemas import ChatResponse, MessageRequest
from python.session_manager import KeyNotFoundError

logger  =  logging.getLogger(__name__)
router  =  APIRouter(prefix  =  '/chats', tags  =  ['chats'])
MAX_IMAGE_BYTES  =  10 * 1024 * 1024
MAX_PDF_BYTES  =  10 * 1024 * 1024

def _session(request: Request, session_id: str) -> dict:
    try:
        return request.app.state.sessions.get(session_id)
    except KeyNotFoundError as exc:
        raise HTTPException(status_code = 404, detail = 'Chat session not found') from exc

async def _reply(callable_, *args, **kwargs) -> str:
    try:
        reply = await run_in_threadpool(callable_, *args, **kwargs)

        if not reply:
            raise RuntimeError('The model returned an empty response')
        
        return reply
    except Exception as exc:
        logger.exception('ZUSia model request failed')
        raise HTTPException(status_code = 502, detail = 'ZUSia could not generate a response. Please try again.') from exc

async def _bot(request: Request):
    try:
        return await run_in_threadpool(request.app.state.sessions.get_bot)
    except Exception as exc:
        logger.exception('ZUSia is not configured or unavailable')
        raise HTTPException(status_code = 503, detail = 'ZUSia is not configured or is temporarily unavailable') from exc

async def _record_turn(request: Request, session_id: str, user_content: str, assistant_content: str,
                       attachment_mime: str | None = None, attachment: bytes | None = None) -> None:
    try:
        await run_in_threadpool(request.app.state.sessions.append_turn, session_id, user_content,
                                assistant_content, attachment_mime, attachment)
    except Exception as exc:
        logger.exception('Could not save chat turn')
        raise HTTPException(status_code = 503, detail = 'Could not save this message. Please try again.') from exc

@router.post('', response_model = dict, status_code = 201, summary = 'Start a chat')
async def create_chat(request: Request) -> dict[str, str]:
    try:
        session_id  =  await run_in_threadpool(request.app.state.sessions.create)
        return {'session_id': session_id}
    except Exception as exc:
        logger.exception('Could not create chat session')
        raise HTTPException(status_code = 503, detail = 'Chat service is unavailable') from exc


@router.post('/{session_id}/messages', response_model = ChatResponse, summary = 'Send a message')
async def send_message(session_id: str, payload: MessageRequest, request: Request) -> ChatResponse:
    session  =  _session(request, session_id)
    async with _async_lock(session['turn_lock']):
        bot  =  await _bot(request)
        reply  =  await _reply(bot.text, session['chat'], payload.message)
        await _record_turn(request, session_id, payload.message, reply)
    return ChatResponse(session_id = session_id, reply = reply)


@router.post('/{session_id}/images', response_model = ChatResponse, summary = 'Send an image')
async def send_image(session_id: str, request: Request, message: str  =  '', file: UploadFile  =  File(...)) -> ChatResponse:
    session  =  _session(request, session_id)

    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code = 415, detail = 'Only image uploads are supported')
    
    if len(message) > 20_000:
        raise HTTPException(status_code = 422, detail = 'Message must be at most 20,000 characters')

    image_bytes  =  await file.read(MAX_IMAGE_BYTES + 1)
    
    await file.close()
    
    if not image_bytes:
        raise HTTPException(status_code = 400, detail = 'Uploaded image is empty')
    
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code = 413, detail = 'Image must be 10 MB or smaller')

    async with _async_lock(session['turn_lock']):
        bot  =  await _bot(request)
        reply  =  await _reply(bot.img, session['chat'], message = message, image_bytes = image_bytes,
                               mime_type = file.content_type)
        await _record_turn(request, session_id, message or f"[image: {file.filename or 'upload'}]", reply,
                           file.content_type, image_bytes)
        
    return ChatResponse(session_id = session_id, reply = reply)

@router.post('/{session_id}/pdfs', response_model = ChatResponse, summary = 'Send a PDF document')
async def send_pdf(session_id: str, request: Request, message: str  =  '', file: UploadFile  =  File(...)) -> ChatResponse:
    session  =  _session(request, session_id)

    if file.content_type !=  'application/pdf':
        raise HTTPException(status_code = 415, detail = 'Only PDF uploads are supported')
    
    if len(message) > 20_000:
        raise HTTPException(status_code = 422, detail = 'Message must be at most 20,000 characters')

    pdf_bytes  =  await file.read(MAX_PDF_BYTES + 1)
    await file.close()
    
    if not pdf_bytes:
        raise HTTPException(status_code = 400, detail = 'Uploaded PDF is empty')
    
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code = 413, detail = 'PDF must be 10 MB or smaller')
    
    if not pdf_bytes.startswith(b'%PDF-'):
        raise HTTPException(status_code = 400, detail = 'Uploaded file is not a valid PDF')

    async with _async_lock(session['turn_lock']):
        bot  =  await _bot(request)
        prompt  =  message or 'Please explain the contents of this PDF in clear, accessible language.'
        reply  =  await _reply(bot.pdf, session['chat'], message = prompt, pdf_bytes = pdf_bytes)
        await _record_turn(request, session_id, f"{prompt} [PDF: {file.filename or 'upload'}]", reply,
                           'application/pdf', pdf_bytes)
    return ChatResponse(session_id = session_id, reply = reply)

@router.get('/{session_id}/history', summary = 'Get chat history')
async def get_history(session_id: str, request: Request) -> dict:
    session  =  _session(request, session_id)
    return {'session_id': session_id,
            'messages': session['history']}

@router.delete('/{session_id}', status_code = 204, summary = 'Delete a chat')
async def delete_chat(session_id: str, request: Request) -> None:
    try:
        request.app.state.sessions.delete(session_id)
    except KeyNotFoundError as exc:
        raise HTTPException(status_code = 404, detail = 'Chat session not found') from exc


class _async_lock:
    '''Run a synchronous per-session lock without blocking FastAPI's event loop.'''

    def __init__(self, lock):
        self.lock  =  lock

    async def __aenter__(self):
        await run_in_threadpool(self.lock.acquire)
        return self

    async def __aexit__(self, *_):
        self.lock.release()
