FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu torch numpy matplotlib fastapi "uvicorn[standard]"

RUN useradd -m -u 10001 runner
WORKDIR /app
COPY app.py .
USER runner
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
