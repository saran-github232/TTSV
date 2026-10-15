globalThis.VOHttp = {
  async request(url, options, provider, { retries = 2 } = {}) {
    let failures = 0, polls = 0;
    for (;;) {
      let response;
      try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(90000) }); }
      catch (error) {
        throw new Error(`${provider}: ${error.name === 'TimeoutError' || error.name === 'AbortError' ? 'request timed out' : 'network request failed'}. Check your connection and retry.`);
      }
      if ([500, 502, 503, 504].includes(response.status) && failures < retries) {
        const hint = Number(response.headers?.get('retry-after'));
        const delay = hint > 0 ? Math.min(hint * 1000, 10000) : 1500 * 2 ** failures;
        failures++;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (response.status === 202) {
        if (provider !== 'NVIDIA' || ++polls > 45) throw new Error(`${provider}: processing is still pending (202). Wait briefly, then retry this clip.`);
        if (options.method !== 'GET') {
          let id = response.headers?.get('nvcf-reqid');
          if (!id) { const body = await response.json().catch(() => ({})); id = body.requestId; }
          if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('NVIDIA: pending response has no valid request ID. Retry the clip.');
          url = `https://integrate.api.nvidia.com/v1/status/${id}`;
          options = { method: 'GET', headers: options.headers };
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      if (response.ok) return response;
      const reasons = {
        400: 'The provider rejected the audio request. Check the selected model and audio format.',
        401: 'API key is invalid or expired. Save a new key for this provider in the extension popup.',
        403: 'Access denied. Check API key permissions and model access in your provider account.',
        404: 'Model or endpoint is unavailable. Check model availability in your provider account.',
        413: 'Audio exceeds the provider request limit. This provider cannot accept this clip in one request.',
        422: 'The model rejected the audio format or request schema.',
        429: 'Rate or quota limit reached. Wait before retrying, or check your account quota.',
        500: 'The provider had an internal error after retries. Try again later.',
        502: 'The provider gateway failed after retries. Try again later.',
        503: 'The service is temporarily overloaded after retries. Try again later; this does not by itself mean your key is wrong.',
        504: 'The provider timed out after retries. Try again later.'
      };
      throw new Error(`${provider} (${response.status}): ${reasons[response.status] || 'Request failed. Retry or check provider status.'}`);
    }
  }
};
