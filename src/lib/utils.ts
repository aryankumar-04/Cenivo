const cacheMap = new Map<string, any>();

export function formatRuntime(minutes: any): string {
  if (!minutes) return "N/A";
  const m = Number(minutes);
  if (isNaN(m) || m <= 0) return "N/A";

  const hours = Math.floor(m / 60);
  const mins = m % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export async function robustFetch(input: RequestInfo | URL, init?: RequestInit, maxRetries = 3, delay = 1000): Promise<Response> {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
  const method = init?.method?.toUpperCase() || 'GET';

  // Return a cloned cached Response if available
  if (method === 'GET') {
    const cachedResponse = cacheMap.get(url);
    if (cachedResponse) {
      return cachedResponse.clone();
    }
  }

  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(input, init);
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`Server returned temporary error status ${response.status}`);
      }
      
      // Save GET responses to memory cache
      if (method === 'GET' && response.ok) {
        cacheMap.set(url, response.clone());
      }
      
      return response;
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      console.warn(`Fetch to ${input} failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

