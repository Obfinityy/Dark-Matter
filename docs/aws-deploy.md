# Dark Matter — AWS Deployment Guide

Internal Obfinity deployment runbook. Dark Matter is deployed and operated by Obfinity; this document is for the Obfinity operations team. The backend and hunt engine run on AWS EC2; storage is file-based only (no database).

## Architecture

```
                    ┌─────────────────────────────┐
                    │  Frontend (Cloudflare Pages)│
                    │  hack.thebhavesh.online     │
                    │  (auto-deploys on push)     │
                    └─────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  EC2 (t3.medium+) — Ubuntu 22.04                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Backend   │  │  PentAGI     │  │  Tools   │  │
│  │  :4000     │  │  engine :8080│  │  nuclei… │  │
│  └────────────┘  └──────────────┘  └──────────┘  │
│  Nginx reverse proxy :80/443 → :4000            │
└──────────────────────────────────────────────────┘
```

## Prerequisites

- Obfinity AWS account with billing enabled
- An Obfinity-managed domain
- `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT` (generate via `node scripts/make-admin-hash.js`)
- `JWT_SECRET` (32+ chars, random)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (for Bedrock — same account or separate IAM user)

## Step 1 — Backend + Engine on EC2

1. Launch EC2: Ubuntu 22.04, **t3.medium** minimum (t3.large recommended), 30GB gp3.
2. Security group: allow 22 (your IP), 80, 443 (everyone). Do NOT expose 4000/8080 publicly.
3. Paste `docker/aws-ec2-userdata.sh` as user-data.
4. SSH in:
   ```bash
   cd /opt/Dark-Matter
   # .env — copy from .env.example and fill in secrets
   sudo nano backend/.env
   cd docker && ./setup-linux.sh
   ```
5. Install nginx + certbot for HTTPS:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   # /etc/nginx/sites-available/darkmatter — proxy_pass http://127.0.0.1:4000
   sudo certbot --nginx -d api.yourdomain.com
   ```

## Step 2 — Frontend

The frontend deploys automatically on push to `main` via Cloudflare Pages. No manual step is required; verify the deployment at https://hack.thebhavesh.online.

## Step 3 — Environment variables (backend/.env)

```bash
PORT=4000
JWT_SECRET=<random 32+ chars>
ADMIN_USERNAME=bhavesh189
ADMIN_PASSWORD_HASH=<from make-admin-hash.js>
ADMIN_PASSWORD_SALT=<from make-admin-hash.js>
AWS_ACCESS_KEY_ID=<your key>
AWS_SECRET_ACCESS_KEY=<your secret>
AWS_REGION=us-east-1
BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
ENGINE_URL=http://127.0.0.1:8080
CORS_ORIGINS=https://darkmatter.yourdomain.com
```

## Cost estimate (24/7)

| Component | Monthly max |
|---|---|
| EC2 t3.medium | ~$30 |
| EBS 30GB | ~$3 |
| S3 + CloudFront | ~$2 |
| Bedrock (heavy) | ~$50–80 |
| **Total** | **~$85–115** |

Stop the EC2 instance when not hunting to reduce compute cost to $0.
