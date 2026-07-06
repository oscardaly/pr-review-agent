export type SemgrepRule = {
  ruleId: string;
  owaspCategory: string;
  severity: "warning" | "error";
  message: string;
  pattern: RegExp;
};

/**
 * Built-in fallback rules used when the semgrep binary is not installed.
 * Rule IDs mirror semgrep registry naming so findings read the same either way.
 */
export const BUILTIN_SEMGREP_RULES: SemgrepRule[] = [
  {
    ruleId: "javascript.lang.security.audit.eval-detected",
    owaspCategory: "A03 Injection",
    severity: "error",
    message:
      "eval() executes arbitrary strings as code; any user-influenced input becomes remote code execution.",
    pattern: /\beval\s*\(|new Function\s*\(/,
  },
  {
    ruleId: "javascript.lang.security.audit.child-process-injection",
    owaspCategory: "A03 Injection",
    severity: "error",
    message:
      "Shell command built from interpolated input — use execFile/spawn with an argument array instead.",
    pattern: /\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|["'][^"']*["']\s*\+)/,
  },
  {
    ruleId: "javascript.sql.security.sql-string-concat",
    owaspCategory: "A03 Injection",
    severity: "error",
    message:
      "SQL assembled with string interpolation/concatenation — use parameterized queries.",
    pattern:
      /\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b.*(?:\$\{|["'`]\s*\+)/i,
  },
  {
    ruleId: "typescript.react.security.dangerouslysetinnerhtml",
    owaspCategory: "A03 Injection",
    severity: "warning",
    message:
      "dangerouslySetInnerHTML renders raw HTML; unsanitized input here is stored XSS.",
    pattern: /dangerouslySetInnerHTML/,
  },
  {
    ruleId: "generic.secrets.hardcoded-credential",
    owaspCategory: "A02 Cryptographic Failures",
    severity: "error",
    message:
      "Hardcoded credential committed to source (value redacted at ingestion) — move it to environment configuration and rotate it.",
    pattern: /\[REDACTED:(?:api-key|password)\]/,
  },
  {
    ruleId: "generic.secrets.insecure-transport",
    owaspCategory: "A02 Cryptographic Failures",
    severity: "warning",
    message:
      "Plain-HTTP URL in code that may carry sensitive traffic — use HTTPS.",
    pattern: /["'`]http:\/\/(?!localhost|127\.0\.0\.1|169\.254)/,
  },
  {
    ruleId: "javascript.jwt.security.jwt-none-alg",
    owaspCategory: "A07 Identification and Authentication Failures",
    severity: "error",
    message:
      'JWT configured with alg "none" disables signature verification entirely.',
    pattern: /alg(?:orithm)?s?\s*[:=]\s*\[?\s*["']none["']/i,
  },
  {
    ruleId: "javascript.crypto.security.insecure-hash",
    owaspCategory: "A02 Cryptographic Failures",
    severity: "warning",
    message:
      "MD5/SHA1 are broken for password hashing or integrity of untrusted data — use bcrypt/argon2 or SHA-256+.",
    pattern: /createHash\s*\(\s*["'](?:md5|sha1)["']\s*\)/i,
  },
];
