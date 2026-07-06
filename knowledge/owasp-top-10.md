# OWASP Top 10 (2021) — Code Review Cues

What each category looks like in a TypeScript/Node diff. Categories map to https://owasp.org/Top10/.

## A01 Broken Access Control

New route handlers or API endpoints without an authentication/authorization check; object IDs taken from the request and used directly (IDOR); authorization decisions made client-side only. Review cue: every new endpoint must show where access is enforced.

## A02 Cryptographic Failures

Hardcoded secrets, keys, or passwords in source; use of weak hashes (MD5, SHA1) for passwords; tokens or PII logged or stored in plaintext; `http://` URLs for sensitive traffic. Review cue: secrets belong in environment variables, passwords in bcrypt/argon2.

## A03 Injection

SQL built by string concatenation or template literals with user input; `eval`, `new Function`, or `child_process.exec` with interpolated input; NoSQL queries fed raw request objects; HTML built by concatenation (XSS), including React's `dangerouslySetInnerHTML`. Review cue: user input must reach interpreters only via parameterized APIs.

## A04 Insecure Design

Missing rate limits on expensive or authentication endpoints; trust decisions based on client-supplied fields (price, role, isAdmin); security controls that exist only in the UI layer.

## A05 Security Misconfiguration

Debug flags or verbose error output enabled in production paths; permissive CORS (`*` with credentials); disabled security middleware; default credentials in config files.

## A06 Vulnerable and Outdated Components

Newly added dependencies with known CVEs or unpinned versions; vendored copies of libraries that will never be patched. Review cue: question every new dependency — is it maintained, is it pinned?

## A07 Identification and Authentication Failures

Session tokens in URLs or localStorage; missing `httpOnly`/`secure` cookie flags; JWTs accepted with `alg: none` or without expiry verification; password comparison with `===` instead of a constant-time check.

## A08 Software and Data Integrity Failures

Deserializing untrusted input (`JSON.parse` into trusted structures without validation is the mild form; `eval`-based deserialization the severe one); CI/CD scripts pulling unpinned remote code; missing integrity checks on uploaded content.

## A09 Security Logging and Monitoring Failures

Authentication failures, access-control denials, or payment mutations with no audit log; secrets or PII written into logs; catch blocks that swallow security-relevant errors silently.

## A10 Server-Side Request Forgery

Server-side fetches to URLs assembled from user input without an allowlist; image/webhook "preview" endpoints that will happily fetch `http://169.254.169.254/`.
