/**
 * F1 login failures can echo submitted credentials back inside error messages
 * or response bodies. This repo's Actions logs are PUBLIC (public repo), so
 * every error that might reach console.error/process.exit must be scrubbed
 * of any known secret values first.
 */
export function redactError(err: unknown, secrets: readonly string[]): Error {
  const original = err instanceof Error ? (err.stack ?? err.message) : String(err);
  const redacted = secrets
    .filter((s) => s.length > 0)
    .reduce((text, secret) => text.split(secret).join('***REDACTED***'), original);
  return new Error(redacted);
}
