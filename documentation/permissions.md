# Permissions And Trust Boundaries

## Cloud quantum

Cloud quantum requests require a valid ChemVault session and an allowed result from `GET /api/access/check?service=chemvault_molecule`. Anonymous requests, disabled users, denied service access, disallowed origins, unsupported methods, oversized structures, and exhausted quotas are rejected before backend invocation.

The Cloudflare backend token authorizes only the gateway-to-engine request. It is never sent to browsers or native clients. Missing authorization or rate-limiter configuration fails closed.

## Desktop engines

The user explicitly selects or installs an engine. ChemVault stores executable paths locally and invokes only the selected executable. Gaussian and ORCA require the user's own valid license. Engine processes receive bounded input, timeout, memory, processor, scratch, and file-size settings.

## Diagnostics

Diagnostics are disabled by default. Enabling them permits only event name, source, engine category, task category, status, duration bucket, atom-count band, export format, cache flag, application version, and platform. Client IP is used only as a rate-limit key and is not written to Analytics Engine.
