# ---- Stage 1: Build Frontend ----
FROM node:18 as builder

# Set the working directory for the frontend
WORKDIR /app/frontend

# Copy package.json and package-lock.json to leverage Docker cache
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the React application
# The output will be in /app/frontend/dist (or as configured in vite.config.js)
# Our vite.config.js is configured to output to ../backend/app/static
RUN npm run build


# ---- Stage 2: Build Backend ----
FROM python:3.11-slim

# Set the working directory for the backend
WORKDIR /code

# Copy requirements.txt and install Python dependencies
COPY backend/requirements.txt /code/
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy the backend application code
COPY backend/ /code/

# Copy the built frontend static files from the builder stage
COPY --from=builder /app/backend/app/static /code/app/static

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]