FROM python:3.12.2-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY router.py .

COPY standardise_transformer-1.joblib .
COPY FPT_1m_15_180526220526.csv .

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]