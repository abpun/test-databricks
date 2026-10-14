# Databricks Volume File Upload — Technical Report

Connection method, authentication flow, and upload mechanism.

---

## Architecture Overview

```
Browser              Express + Multer         OAuth Token           Databricks Files API
multipart/form-data  POST /api/upload         client_credentials    PUT /api/2.0/fs/files
       →                    →                       →                       →
```

The app uses a **two-hop architecture**: the browser sends the file to the Express backend via multipart form, and the backend forwards the raw bytes to Databricks using the REST Files API. The backend handles authentication — no Databricks credentials are exposed to the client.

---

## Connection Method

### Authentication: OAuth M2M (Client Credentials)

The app authenticates to Databricks using **OAuth 2.0 Machine-to-Machine** (client credentials grant) via a Service Principal. This is Databricks' recommended approach for non-interactive server applications.

**Token request:**

```
POST https://{DATABRICKS_HOST}/oidc/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={SA_CLIENT_ID}
&client_secret={SA_CLIENT_SECRET}
&scope=all-apis
```

Returns a short-lived `access_token` (Bearer) used for the upload request. A new token is fetched per upload — no caching or refresh logic needed at this scale.

### Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABRICKS_HOST` | app.yaml / .env | Workspace hostname (e.g. `dbc-xxxxx.cloud.databricks.com`) |
| `SA_CLIENT_ID` | Databricks Secret (scope: `bsar-test`) | Service Principal OAuth client ID |
| `SA_CLIENT_SECRET` | Databricks Secret (scope: `bsar-test`) | Service Principal OAuth client secret |

On Databricks Apps, `SA_CLIENT_ID` and `SA_CLIENT_SECRET` are injected from the secret scope via `app.yaml` resource bindings (`valueFrom: sa-client` / `valueFrom: sa-secret`). Locally, they come from a `.env` file.

---

## Upload Mechanism

### Step 1 — Client sends multipart form

The React frontend sends a `POST` request with `FormData` containing:

- `file` — the .xlsx binary (max 25 MB)
- `bsarId` — BSAR identifier
- `gjahr` — fiscal year
- `poper` — posting period

```
POST /api/upload
Content-Type: multipart/form-data

------boundary
Content-Disposition: form-data; name="file"; filename="report.xlsx"
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
{binary}
------boundary
Content-Disposition: form-data; name="bsarId"
1001
...
```

### Step 2 — Express validates with Multer

**Multer** (memory storage) parses the multipart request and enforces:

- File type: `.xlsx` only (checked by MIME type and extension)
- File size: max 25 MB (`413` if exceeded)
- Required fields: `bsarId`, `gjahr`, `poper` must all be present

The file is held in memory as a `Buffer` — it is never written to disk.

### Step 3 — Upload to Databricks Volumes

The backend sends the raw file bytes to the **Databricks Files API**:

```
PUT https://{host}/api/2.0/fs/files/Volumes/tsed_corporate_dev/finance_gold/vol_01_presentation/bsar/{bsarId}/{gjahr}/{poper}/{filename}

Authorization: Bearer {access_token}
Content-Type: application/octet-stream

{raw file bytes}
```

The API creates intermediate directories automatically. No pre-creation of the folder structure is needed.

### Volume Path Structure

```
/Volumes/tsed_corporate_dev/finance_gold/vol_01_presentation/bsar/{bsarId}/{gjahr}/{poper}/{filename}
```

**Example:** uploading `gl_extract.xlsx` with bsarId=`1001`, gjahr=`2024`, poper=`06` lands at:

```
/Volumes/tsed_corporate_dev/finance_gold/vol_01_presentation/bsar/1001/2024/06/gl_extract.xlsx
```

---

## Permissions Required

The Service Principal needs **WRITE VOLUME** (or `ALL PRIVILEGES`) on the target Unity Catalog volume:

```sql
GRANT WRITE VOLUME ON VOLUME tsed_corporate_dev.finance_gold.vol_01_presentation TO `service-principal-name`;
```

Currently granted: `new-test` service principal has `ALL PRIVILEGES` on `vol_01_presentation`.

---

## API Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/oidc/v1/token` | POST | Client ID + Secret | Get OAuth access token |
| `/api/2.0/fs/files/{path}` | PUT | Bearer token | Upload file to Unity Catalog Volume |

---

## Key Files

| File | Role |
|------|------|
| `backend/services/uploadService.js` | OAuth token fetch + Databricks Files API upload |
| `backend/routes/uploadRoutes.js` | Multer config, validation, POST /api/upload handler |
| `backend/config/databricks.js` | Reads DATABRICKS_HOST, SA_CLIENT_ID, SA_CLIENT_SECRET from env |
| `frontend/src/FileUpload.tsx` | Upload form UI with client-side validation |
| `app.yaml` | Databricks Apps config — command + secret bindings |

---

**App URL:** https://test-7474646011701421.aws.databricksapps.com
**Volume:** `tsed_corporate_dev.finance_gold.vol_01_presentation`
**Generated:** 2026-10-09
