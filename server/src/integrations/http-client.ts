export type FetchImplementation = typeof fetch

export class IntegrationHttpError extends Error {
  constructor(
    public readonly integration: string,
    public readonly status: number,
    message: string,
  ) {
    super(`${integration} request failed (${status}): ${message}`)
    this.name = 'IntegrationHttpError'
  }
}

export async function readJson<T>(
  integration: string,
  response: Response,
): Promise<T> {
  const text = await response.text()
  let body: unknown

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String(body.message)
      : response.statusText || 'Unknown error'
    throw new IntegrationHttpError(integration, response.status, message)
  }

  return body as T
}
