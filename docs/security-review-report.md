# BOMTool Security Review Report

**Review date:** 2026-08-16  
**Repository:** `D:\bom_tool\BOMTool`  
**Reviewed application:** Next.js frontend, FastAPI backend, PostgreSQL, Nginx gateway, Docker Compose deployment

## Scope and Method

This review covered application source, dependency manifests, Dockerfiles, Docker Compose configuration, and the deployed architecture. It used static source review, targeted pattern searches, dependency auditing, and read-only inspection of the deployed containers.

The separately tracked frontend framework version remediation is intentionally excluded from this report.

This was not a full penetration test or exhaustive business-logic assessment. Findings describe vulnerabilities confirmed in the reviewed code or security weaknesses with a clear exploitation path.

## Executive Summary

The most important application risk is the absence of real authentication and authorization. The backend accepts a user ID supplied by the browser and exposes sensitive read and write operations without verifying the caller. If the application is reachable from the Internet, an unauthenticated caller can interact directly with the API without using the frontend.

Other high-priority issues include path traversal in uploaded-file handling, unbounded file uploads, known vulnerable Python dependencies, and a backend container that runs as root. Spreadsheet exports can also interpret attacker-controlled values as formulas.

Until authentication and authorization are implemented, public access should be restricted to trusted source IP addresses or a private access layer such as a VPN or identity-aware proxy.

## Findings

### SR-01: Missing Authentication and Authorization

**Severity:** Critical  
**Affected files:**

- `backend/app/deps.py:8`
- `backend/app/main.py:47`
- `backend/app/routers/users.py:12`
- Most files under `backend/app/routers/`

`get_current_user_id` accepts the optional `X-User-Id` request header and returns it without authentication. The header is selected by the frontend and can be supplied or changed by any HTTP client. Many endpoints do not require even this mock dependency.

The users router permits unauthenticated listing, creation, modification, and deletion of users. Project, BOM, quote, pricing, export, and activity endpoints also lack verified object-level access control.

**Impact:**

- User impersonation
- Unauthorized disclosure of BOM, customer, project, pricing, and procurement information
- Unauthorized data modification or deletion
- Unauthorized export generation
- Forged activity records
- Unauthorized use of supplier API operations

**Recommendations:**

1. Replace `X-User-Id` with verified authentication, preferably the intended Google Workspace OIDC integration.
2. Validate issuer, audience, signature, expiration, and hosted-domain or organization membership on the backend.
3. Make authenticated identity mandatory for every non-health endpoint.
4. Implement role and object-level authorization for every project, customer, BOM, quote, export, and administrative operation.
5. Do not rely on frontend routing, hidden buttons, CORS, or unguessable numeric IDs for access control.
6. Until this is implemented, restrict Lightsail HTTP access to trusted source IP ranges or place the application behind a private identity-aware access layer.

### SR-02: File Path Traversal

**Severity:** High  
**Affected files:**

- `backend/app/services/file_storage.py:47`
- `backend/app/routers/bom_import.py:90`
- `backend/app/routers/bom_import.py:211`
- `backend/app/routers/china_quote.py:70`
- `backend/app/routers/china_quote.py:138`
- `backend/app/routers/official_pricing.py:590`

`LocalFileStorage._full_path` joins the configured upload directory with a caller-controlled path but does not normalize the result or verify that it remains inside the upload directory. Values such as `../../...` can escape the intended storage root.

**Impact:**

This creates an arbitrary local-file access primitive within the backend container. Direct disclosure depends on whether the targeted file can be processed by the selected parser, but the containment boundary is absent.

**Recommendations:**

1. Resolve the storage root and requested path with `pathlib.Path.resolve()`.
2. Reject absolute paths and any resolved path that is not below the storage root.
3. Prefer opaque server-generated file IDs rather than accepting storage paths from clients.
4. Store file ownership metadata and verify that the authenticated user may access the referenced file.
5. Add tests for `../`, absolute paths, mixed separators, symlinks, and encoded traversal attempts.

### SR-03: Unbounded File Uploads and Spreadsheet Processing

**Severity:** High  
**Affected files:**

- `backend/app/routers/bom_import.py:83`
- `backend/app/routers/china_quote.py:63`
- `backend/app/routers/official_pricing.py:583`
- `backend/app/routers/official_pricing.py:663`
- `backend/app/routers/official_pricing.py:686`
- `docker-compose.yml` Nginx configuration

Upload handlers call `await file.read()` without a size limit, loading the complete request into memory. Spreadsheet parsing may then allocate substantially more memory than the uploaded file size. Nginx does not define `client_max_body_size`, request-rate limits, or concurrency controls for expensive endpoints.

**Impact:**

- Backend memory exhaustion
- CPU exhaustion during spreadsheet parsing
- Disk exhaustion in the uploads volume
- Supplier API quota consumption through automated requests

**Recommendations:**

1. Define a documented maximum upload size appropriate for BOM files, for example 25 MiB.
2. Enforce the limit at Nginx and again in application code.
3. Stream uploads in bounded chunks rather than using an unrestricted `file.read()`.
4. Allowlist supported extensions and validate the actual file structure.
5. Reject excessive worksheet, row, column, and decompressed archive sizes.
6. Apply rate limits to upload, parsing, export, and supplier-fetch endpoints.
7. Run expensive parsing in a separately limited worker if file sizes increase.

### SR-04: Known Vulnerabilities in Backend Dependencies

**Severity:** High  
**Affected file:** `backend/requirements.txt`

`pip-audit` reported known vulnerabilities in the pinned dependency set, including:

- `python-multipart==0.0.20`
- `python-dotenv==1.0.1`
- `starlette==0.41.3`, installed through FastAPI

**Recommendations:**

1. Upgrade `python-multipart` to at least `0.0.31`.
2. Upgrade `python-dotenv` to at least `1.2.2`.
3. Upgrade FastAPI and Starlette together to mutually compatible maintained versions.
4. Run backend tests and an API smoke test after the upgrade.
5. Add `pip-audit` to CI and fail builds on applicable high or critical vulnerabilities.
6. Adopt a scheduled dependency-update process rather than updating only after incidents.

### SR-05: Backend Container Runs as Root

**Severity:** High  
**Affected files:**

- `backend/Dockerfile`
- `docker-compose.yml`

The backend image does not define a non-root user. The additional read-only filesystem, capability removal, privilege restriction, and resource limits applied to the frontend are not applied to the backend.

**Impact:**

A successful backend exploit executes as root inside the container and has write access to the uploads volume. Container isolation still applies, but the impact within the container and mounted data is unnecessarily high.

**Recommendations:**

1. Create a dedicated backend user and select it with `USER` in the backend Dockerfile.
2. Ensure the uploads volume is writable by that user and no other application paths require writes.
3. Add `read_only: true`, a bounded `/tmp` tmpfs, `cap_drop: [ALL]`, and `no-new-privileges:true`.
4. Add memory and CPU limits based on observed normal usage.
5. Rebuild and test migrations, seed behavior, file uploads, and exports under the non-root user.

### SR-06: Spreadsheet Formula Injection

**Severity:** Medium  
**Affected file:** `backend/app/services/export_excel.py:430`

Uploaded or user-controlled values such as MPN, manufacturer, description, notes, project names, and supplier fields are written directly into XLSX cells. Spreadsheet applications may interpret formula-leading strings as formulas when a user opens an exported file.

**Impact:**

A malicious value stored in the application could cause an exported workbook to perform external requests, disclose spreadsheet data, or present malicious links, depending on spreadsheet software and user security settings.

**Recommendations:**

1. Centralize all untrusted spreadsheet cell writes through a sanitization function.
2. Force strings beginning with formula-control characters to be stored as text.
3. Cover `=`, `+`, `-`, `@`, tab, carriage return, line feed, and applicable full-width variants.
4. Preserve only application-generated formulas in explicitly designated formula columns.
5. Add tests using malicious MPN, description, notes, project, and supplier values.

### SR-07: Unauthenticated Supplier API Operations

**Severity:** Medium  
**Affected file:** `backend/app/routers/official_pricing.py:103`

`/api/official-pricing/test-supplier` and other supplier-backed flows can be invoked without verified authentication. Calls are made using server-side DigiKey, Mouser, and TI credentials.

**Impact:**

- Supplier API quota exhaustion
- Increased third-party costs or throttling
- Operational disruption of legitimate pricing operations

**Recommendations:**

1. Require authentication and an appropriate role for all supplier-backed operations.
2. Rate-limit supplier calls per user, project, and source IP.
3. Add server-side caching and request deduplication where appropriate.
4. Log the verified user, project, supplier, and request outcome without logging tokens.

### SR-08: Activity Log Can Be Forged

**Severity:** Medium  
**Affected file:** `backend/app/routers/activity_log.py:24`

The API permits clients to create arbitrary activity records without authentication. Consequently, the activity log cannot be treated as a trustworthy audit trail.

**Recommendations:**

1. Remove the public activity-log creation endpoint.
2. Generate audit records only within authenticated backend operations.
3. Derive actor identity and timestamps on the server.
4. Restrict activity-log reads according to project access and administrative role.

### SR-09: Verbose Errors and Public API Discovery

**Severity:** Medium  
**Affected files:**

- Multiple files under `backend/app/routers/`
- `docker-compose.yml` Nginx configuration

Multiple endpoints return `str(exc)` or formatted exception text to clients. Nginx publicly exposes `/docs` and `/openapi.json`. These behaviors reveal internal implementation details and make endpoint discovery easier.

**Recommendations:**

1. Return stable, non-sensitive client errors and log detailed exceptions only on the server.
2. Disable or restrict `/docs` and `/openapi.json` in production.
3. Add a request correlation ID so client errors can be matched to server logs.
4. Avoid logging query strings or authorization material.

### SR-10: Gateway and Transport Hardening Gaps

**Severity:** Medium  
**Affected files:**

- `backend/app/main.py:26`
- `docker-compose.yml`

The deployment serves HTTP without TLS, has no gateway authentication, and has no rate limits. CORS allows credentials, all methods, and all headers for configured origins. CORS does not prevent direct API calls and must not be used as authentication.

**Recommendations:**

1. Terminate TLS and redirect HTTP to HTTPS.
2. Restrict CORS to the exact production origin, required methods, and required headers.
3. Add security headers appropriate for the application.
4. Add Nginx request-body, rate, connection, and timeout limits.
5. Restrict health and documentation endpoints as appropriate.

### SR-11: Credential Hygiene and Rotation

**Severity:** High  
**Affected files and host state:**

- `.env`
- `.env.example`
- `docker-compose.yml`
- `/home/ubuntu/bom-tool/.env`

The deployment has experienced remote code execution in a public-facing container. There is no direct evidence that backend supplier credentials were read, because they were not mounted or injected into the affected frontend container. Nevertheless, non-exposure cannot be proven, and the PostgreSQL credentials use publicly documented defaults.

**Recommendations:**

1. Rotate the PostgreSQL application password.
2. Revoke and regenerate the DigiKey client ID and secret as supported by the provider.
3. Revoke and regenerate the Mouser API key.
4. Revoke and regenerate the TI client ID and secret.
5. Update `/home/ubuntu/bom-tool/.env` with the new values and set mode `600`.
6. Update the actual PostgreSQL role password; changing only `.env` does not change an already initialized database role.
7. Recreate the backend container after updating `.env`.
8. Review provider audit and usage logs for unexpected activity beginning before the first observed incident.
9. Remove default database passwords from `.env.example` and Compose fallbacks. Fail startup when required production secrets are absent.

## Positive Observations

- The root `.env` is ignored by Git and was not found in repository history.
- Supplier credential values were not found in tracked source files.
- The frontend container does not receive backend or supplier credentials.
- PostgreSQL is no longer published on a host port in the updated Compose configuration.
- Frontend containers now run as a non-root user with a read-only root filesystem, dropped capabilities, resource limits, and log rotation.
- No obvious command injection, unsafe `eval` or `exec`, pickle deserialization, directly interpolated SQL, or React `dangerouslySetInnerHTML` was found during the static review.

## Recommended Remediation Order

1. Restrict public access to trusted users or networks.
2. Implement verified authentication and object-level authorization.
3. Fix file path containment and upload resource limits.
4. Upgrade vulnerable backend dependencies.
5. Rotate PostgreSQL and supplier credentials on the host and in provider portals.
6. Run the backend as a restricted non-root container.
7. Sanitize spreadsheet exports.
8. Protect supplier operations and make audit logging server-controlled.
9. Add TLS, gateway limits, restricted API documentation, and safe error handling.
10. Add automated security checks and regression tests to CI.

## Verification Criteria

Remediation should not be considered complete until the following are verified:

- Requests without valid authentication receive `401`.
- Authenticated users cannot access objects outside their authorization scope.
- Traversal payloads cannot access paths outside the upload root.
- Oversized and malformed uploads are rejected before full buffering or parsing.
- Backend dependency audits have no applicable high or critical findings.
- Backend and frontend containers run as non-root with bounded resources.
- Formula-leading user input is exported as text.
- Supplier operations require authorization and are rate-limited.
- PostgreSQL and supplier credentials have been rotated and old credentials revoked.
- Production traffic uses HTTPS and sensitive operational endpoints are restricted.
