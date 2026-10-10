FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY agent.py .
# Fetch the Silero VAD at build time so a boot never waits on the network.
RUN python agent.py download-files
CMD ["python", "agent.py", "start"]
