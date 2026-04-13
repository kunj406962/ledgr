# Use the official Python 3.12 slim image as our base.
# "slim" removes a lot of unnecessary system packages, keeping the image small.
FROM python:3.12-slim

# Set the working directory inside the container.
# All subsequent commands run from here, and our app code lives here.
WORKDIR /app

# Install system-level dependencies before Python packages.
# libpq-dev: required to compile psycopg2 (the PostgreSQL driver)
# gcc: C compiler needed by some Python packages during pip install
# We clean up apt cache immediately after to keep the image layer small.
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt first — before copying the rest of the code.
# Docker caches each layer. If requirements.txt hasn't changed, Docker
# skips re-running pip install entirely on subsequent builds. This makes
# rebuilds dramatically faster during development.
COPY backend/requirements.txt .

# Install all Python dependencies.
# --no-cache-dir: don't store the pip download cache inside the image (saves space)
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the rest of the backend source code into the container.
# This happens after pip install so code changes don't bust the pip cache layer.
COPY backend/ .

# Tell Docker that the container listens on port 8000.
# This is documentation — it doesn't actually publish the port (docker-compose does that).
EXPOSE ${PORT:-8000}

# The command that runs when the container starts.
# uvicorn: the ASGI server that runs FastAPI
# main:app — looks for the `app` object in main.py
# --host 0.0.0.0: listens on all network interfaces (required inside a container)
# --port 8000: the port to listen on
# Note: no --reload here. --reload is for development only (added in docker-compose).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]