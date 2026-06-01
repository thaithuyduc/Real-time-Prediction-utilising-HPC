FROM python:3.12.2-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY config/ ./config/
COPY myapp/ ./myapp/
COPY manage.py .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]