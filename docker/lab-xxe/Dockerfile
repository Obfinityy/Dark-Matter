# lab-xxe — deliberately vulnerable XXE lab service (lab-only, see README.md).
# Python stdlib HTTP server + lxml parser configured to resolve entities and
# fetch external entities — the exact behaviour the scanner's XXE / SAML-XXE
# OOB probes need. Built from source: no upstream image ships a suitable
# vulnerable XML endpoint.
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir lxml==5.2.1
COPY app.py .
USER nobody
EXPOSE 8000
CMD ["python", "app.py"]
