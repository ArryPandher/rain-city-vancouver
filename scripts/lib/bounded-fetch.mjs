/** Read a small approved resource into memory; caller writes only after validation.
 * Failed partial transfers count against the shared session budget too. */
export async function boundedFetch(
  url,
  { maxBytes, budget, allowedTypes, fetchImpl = fetch },
) {
  const response = await fetchImpl(url);
  const reject = async (message) => {
    await response.body?.cancel();
    throw new Error(message);
  };
  if (!response.ok) return reject(`HTTP ${response.status}`);
  const type = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!allowedTypes.includes(type))
    return reject(`Unexpected content type: ${type}`);
  const rawLength = response.headers.get("content-length");
  const length = rawLength === null ? null : Number(rawLength);
  const remaining = Math.min(maxBytes, budget.limit - budget.used);
  if (
    remaining <= 0 ||
    (length !== null &&
      (!Number.isSafeInteger(length) || length < 0 || length > remaining))
  )
    return reject("Response exceeds byte budget");
  if (!response.body) throw new Error("Missing response body");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    budget.used += chunk.length;
    size += chunk.length;
    if (size > maxBytes || budget.used > budget.limit)
      throw new Error("Stream exceeds byte budget");
    chunks.push(chunk);
  }
  if (length !== null && size !== length)
    throw new Error("Response length mismatch");
  return Buffer.concat(chunks);
}
