# Real, standard FastAPI container image — not exercised in this session
# (no Docker in this sandbox), but a genuine deployment artifact. See
# docs/architecture/dgx-deployment.md.
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
