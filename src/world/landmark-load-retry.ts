function transientRequestFailure(error: unknown): boolean {
  // Three FileLoader's private HttpError exposes the actual fetch Response.
  // Do not classify arbitrary parser errors using message text or status alone.
  if (
    error instanceof Error &&
    "response" in error &&
    error.response instanceof Response
  ) {
    const status = error.response.status;
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
  }
  // Fetch rejects with TypeError for a network failure, but GLTF parsing can
  // also throw TypeError. Restrict this branch to known browser/fetch messages.
  if (error instanceof TypeError)
    return /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|fetch failed)$/i.test(
      error.message,
    );
  return (
    typeof ProgressEvent !== "undefined" &&
    error instanceof ProgressEvent &&
    error.type === "error"
  );
}

/** At most three attempts for transient asset requests. Parse/asset errors fail
 * immediately. Preserve the first request error on exhaustion for diagnostics. */
export async function loadLandmarkWithRetry<T>(
  load: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<T> {
  let firstFailure: unknown;
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (error) {
      if (!transientRequestFailure(error)) throw error;
      if (attempt === 0) firstFailure = error;
      if (attempt === 2) throw firstFailure;
      await wait(attempt === 0 ? 500 : 1500);
    }
  }
}
