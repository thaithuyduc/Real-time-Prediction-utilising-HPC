FROM python:3.12.2-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY router.py .
COPY models.py .

COPY best_lstm_model-1.pth .
COPY standardise_transformer-1.joblib .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--reload", "--port", "8001"]