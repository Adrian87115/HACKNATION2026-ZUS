# ZUSia service (FastAPI): chat with OpenAI, MCP server with the user's data, case import, knowledge base.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY python ./python
COPY ["Materiały dodatkowe", "./Materiały dodatkowe"]
# chat history the user agreed to keep (SQLite); attachments go to MinIO
ENV ZUSIA_DB_PATH=/data/zusia.sqlite3
VOLUME /data
EXPOSE 8001
# one worker: chat sessions and screen snapshots live in this process's memory
CMD ["uvicorn", "python.main:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "*"]
