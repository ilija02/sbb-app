# Backend - Token Issuer API (Developer A)

This directory contains the FastAPI backend service that acts as the Token Issuer.

## Developer A Responsibilities

See [ARCHITECTURE.md](../ARCHITECTURE.md) for full specification.

### Your Tasks

1. **Project skeleton and Dockerfile for backend**
2. **Postgres models & migrations** (Alembic)
3. **Implement `sign_blinded` endpoint** (cryptography + safe checks)
4. **Implement `redeem` endpoint** with atomic spent insertion
5. **Implement `bloom` generator job & endpoint**
6. **Implement `sync_offline` reconciliation logic**
7. **Add logging & audit events**
8. **Add unit tests for crypto flows and DB operations**
9. **Document API and create curl examples**

## Quick Start

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python gen_keys.py
uvicorn app.main:app --reload
```

## Expected Directory Structure

```
/backend
  /app
    main.py              # FastAPI app entry point
    /routes
      tokens.py          # Token issuance/redemption routes
      admin.py           # Admin/bloom routes
    /services
      crypto.py          # Blind signature logic
      bloom.py           # Bloom filter generation
    /db
      database.py        # DB connection
      models.py          # SQLAlchemy models
    /crypto
  Dockerfile
  requirements.txt
  gen_keys.py           # RSA key generator
  .env.example
```

## API Endpoints to Implement

- `GET /health`
- `GET /keys/public`
- `POST /v1/verify_receipt`
- `POST /v1/sign_blinded`
- `POST /v1/redeem`
- `GET /v1/bloom`
- `POST /v1/sync_offline`
- `POST /v1/create_voucher` (admin)
- `POST /v1/redeem_voucher`

## Dependencies

```
fastapi==0.100.0
uvicorn[standard]==0.23.1
cryptography==41.0.3
sqlalchemy==2.0.19
psycopg2-binary==2.9.7
alembic==1.11.1
redis==4.6.0
python-dotenv==1.0.0
```

## Database Schema

See [ARCHITECTURE.md](../ARCHITECTURE.md#data-model-db-tables) for full schema.

Tables:
- `users` (admin only)
- `receipts`
- `issued_tokens`
- `spent_tokens`
- `revoked_tokens`
- `audit_logs`

## Notes

- Store only `H(T)` (SHA-256 hash) in database, never raw token `T`
- Use `INSERT ... ON CONFLICT` for atomic spent token marking
- Implement Redis lock for distributed spent token checking
- Generate Bloom filter periodically (cron job or background task)
