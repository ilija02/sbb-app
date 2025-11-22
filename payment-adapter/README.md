# Payment Adapter (Developer A)

Stub service for payment verification in the POC.

## Purpose

This service simulates a payment gateway adapter. In production, it would integrate with real payment providers (Stripe, Square, etc.) and verify receipts.

For the POC, it provides a simple test endpoint that always returns "verified" status.

## Developer A Task

Create a minimal FastAPI service with:

- `POST /test/verify` — accepts `payment_provider` and `provider_receipt_id`, returns `verified` status
- `GET /health` — health check

## Quick Start

```powershell
cd payment-adapter
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

## Expected Structure

```
/payment-adapter
  /app
    main.py
  Dockerfile
  requirements.txt
  .env.example
```

## Sample Code

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Payment Adapter (POC)")

class VerifyRequest(BaseModel):
    payment_provider: str
    provider_receipt_id: str

@app.post("/test/verify")
def verify(req: VerifyRequest):
    # POC stub: always return verified
    return {"receipt_id": req.provider_receipt_id, "status": "verified"}

@app.get("/health")
def health():
    return {"status": "ok"}
```

## Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY ./app /app/app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
```
