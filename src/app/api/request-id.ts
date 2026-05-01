export function getRequestId(headers: Headers): string {
  return headers.get('x-request-id') || crypto.randomUUID();
}
