 FROM python:3.11-slim
 
 ENV PYTHONDONTWRITEBYTECODE=1 \
     PYTHONUNBUFFERED=1 \
     POETRY_VERSION=1.8.3
 
 WORKDIR /app
 
 RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}"
 
 COPY pyproject.toml /app/pyproject.toml
 COPY README.md /app/README.md
 
 RUN poetry config virtualenvs.create false \
  && poetry install --only main --no-interaction --no-ansi
 
 COPY app /app/app
 
 EXPOSE 8000
 
 CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
