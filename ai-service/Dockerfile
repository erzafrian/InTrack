# Base image Python
FROM python:3.10

# Set working directory
WORKDIR /app

# Install dependensi sistem operasi untuk merender grafik (dibutuhkan secara tersembunyi oleh insightface)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Buat user baru sesuai dengan standar Hugging Face (User ID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Pindah ke directory user
WORKDIR $HOME/app

# Copy file requirements.txt terlebih dahulu
COPY --chown=user requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel Cython && \
    pip install --no-cache-dir -r requirements.txt

# Copy seluruh file project ai-service (termasuk main.py)
COPY --chown=user . .

# Expose port standar Hugging Face (7860)
EXPOSE 7860

# Jalankan server FastAPI menggunakan uvicorn di port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
