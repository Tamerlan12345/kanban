# 1. Use an official Python runtime as a parent image
FROM python:3.11-slim

# 2. Set the working directory in the container
WORKDIR /code

# 3. Copy the requirements file into the container at /code
COPY ./requirements.txt /code/requirements.txt

# 4. Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 5. Copy the rest of the application's code into the container at /code
COPY ./app /code/app

# 6. Expose the port the app runs on
EXPOSE 8000

# 7. Define the command to run the app
#    Uvicorn will run on 0.0.0.0 to be accessible from outside the container.
#    --reload will restart the server on code changes (useful for development).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]