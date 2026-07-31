/** Fetch with retries while backend is still starting (ECONNREFUSED on dev boot). */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { retries?: number; delayMs?: number },
): Promise<Response> {
  const retries = options?.retries ?? 20
  const delayMs = options?.delayMs ?? 400
  let lastErr: unknown

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetch(input, init)
    } catch (err) {
      lastErr = err
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastErr
}
