FROM python:3.12.2-slim

WORKDIR /app

# Cập nhật pip và install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy code và data
COPY 3.Preprocessing.py .
COPY standardise_transformer-1.joblib .
COPY FPT_1m_020124150526.csv ./Dataset/

CMD ["python", "3.Preprocessing.py"]