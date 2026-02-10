# Security Audit: Credential & Secret Leak Check

**Date:** 2025-02-10  
**Scope:** Full codebase scan for credential leaks, hardcoded secrets, and sensitive data exposure.

---

## Critical – Fixed

### 1. Hardcoded password in documentation
- **File:** `docs/AWS_DEPLOYMENT_PLAN.md`
- **Issue:** A real-looking password (`@Harshdeep8432`) was hardcoded in the Docker and `psql` examples (Phase 4.1 and Connectivity Tests).
- **Fix:** Replaced with environment variable `POSTGRES_PASSWORD` / `$POSTGRES_PASSWORD` and added a note to set it via env (never commit real passwords).
- **Action for you:** If `@Harshdeep8432` was ever used in production or shared systems, rotate that password and any similar ones immediately.

---

## Low risk / Acceptable

### 2. Example placeholders in docs
- **Files:** `.env.example`, `HOW-TO-USE.md`, `docs/api.md`, `docs/security-hardening.md`
- **Details:** Placeholders like `your_secure_password`, `your-api-key-here`, `your_jwt_secret_key`, and anti-pattern examples (e.g. “DO NOT USE: export DB_PASSWORD=...”) are intentional and do not expose real credentials.
- **Fix applied:** In `HOW-TO-USE.md`, the OPC-UA example was updated to use `process.env.OPCUA_PASSWORD` instead of a literal `'password'` to reinforce not hardcoding credentials.

### 3. Test-only credentials
- **Files:** `tests/setup.ts`, `tests/setup.env.ts`, `tests/setup.integration.ts`, `docker-compose.test.yml`, `.github/workflows/ci.yml`, integration/e2e tests
- **Details:** Values like `test_password`, `testing`, `test`, and fixed test API keys (e.g. `scada-api-key-8d9f7e6c5b4a3d2e1f0g9h8i7j6k5l4`) are used only in test code and CI. AWS example key `AKIAIOSFODNN7EXAMPLE` is the standard AWS docs example, not a real key.
- **Recommendation:** Keep test secrets out of production code paths and ensure CI never logs them.

### 4. Default dev passwords in Docker Compose
- **Files:** `grafana/docker-compose.yml`, `PHASE-2-IMPLEMENTATION-GUIDE.md`
- **Details:** Defaults such as `scada_password`, `admin` for Grafana/Postgres are common for local dev. They are overridable via env (e.g. `DB_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`).
- **Recommendation:** Document that these must be overridden or disabled in any non-local environment.

---

## Good practices already in place

- **`.gitignore`** correctly excludes: `.env`, `.env.local`, `.env.production`, `certs/`, `*.pem`, `*.key`, `*.crt`, `.aws/`, `secrets/`, `*.secret`, and Terraform state/tfvars.
- **No `.env` or `.env.production`** are tracked by git (verified with `git ls-files`).
- **No private keys** (PEM/OPENSSH) were found in the repo.
- **No connection strings** with embedded credentials (e.g. `postgres://user:pass@host`) were found.
- **Application config** (`src/utils/config.ts`) reads credentials from environment variables, not hardcoded values.
- **Infrastructure:** Lambda IAM and EC2 roles reference Secrets Manager ARNs; RDS password comes from `random_password` in Terraform and is stored in Secrets Manager; user-data passes secrets via files/env derived from Secrets Manager, not inline in scripts.

---

## Recommendations

1. **Rotate** any password that may have been the one previously in `AWS_DEPLOYMENT_PLAN.md` if it was ever used.
2. **Pre-commit / CI:** Add a secret-scanning step (e.g. `gitleaks`, `trufflehog`, or GitHub secret scanning) to block new commits that contain likely secrets.
3. **Docs and scripts:** Prefer env vars or “set X before running” in all examples (as now in `AWS_DEPLOYMENT_PLAN.md`).
4. **Grafana/local:** In any deployment guide, state clearly that default passwords in `grafana/docker-compose.yml` are for local use only and must be changed for non-local environments.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical (real credential in repo) | 1 | Fixed |
| Low (example/placeholder)         | 2 | Addressed where needed |
| Test-only / acceptable           | 4 | Documented, no change required |

No other credential leaks were found in the scanned codebase.
