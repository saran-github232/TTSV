// Inspect actual bytes: task servers often use application/octet-stream and extensionless URLs.
globalThis.VOAudio = {
  async normalize(blob) {
    if (!blob.size) throw new Error('The player returned empty audio. Replay the clip.');
    const b = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
    const text = new TextDecoder().decode(b);
    let type = '';
    if (text.startsWith('RIFF') && text.slice(8, 12) === 'WAVE') type = 'audio/wav';
    else if (b[0] === 255 && (b[1] & 246) === 240) type = 'audio/aac';
    else if (text.startsWith('ID3') || (b[0] === 255 && (b[1] & 224) === 224)) type = 'audio/mpeg';
    else if (text.startsWith('OggS')) type = 'audio/ogg';
    else if (text.startsWith('fLaC')) type = 'audio/flac';
    else if (text.slice(4, 8) === 'ftyp') type = 'audio/mp4';
    else if (b[0] === 26 && b[1] === 69 && b[2] === 223 && b[3] === 163) type = 'audio/webm';
    if (['audio/wav', 'audio/mpeg'].includes(type)) return new Blob([blob], { type });
    // Decode browser-supported formats and preserve full duration as PCM WAV.
    const context = new AudioContext();
    try {
      const audio = await context.decodeAudioData(await blob.arrayBuffer());
      const channels = audio.numberOfChannels, frames = audio.length;
      const buffer = new ArrayBuffer(44 + frames * channels * 2), view = new DataView(buffer);
      const write = (at, text) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
      view.setUint32(24, audio.sampleRate, true); view.setUint32(28, audio.sampleRate * channels * 2, true);
      view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, buffer.byteLength - 44, true);
      const samples = Array.from({ length: channels }, (_, i) => audio.getChannelData(i));
      for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) {
        const s = Math.max(-1, Math.min(1, samples[c][i]));
        view.setInt16(44 + (i * channels + c) * 2, s < 0 ? s * 32768 : s * 32767, true);
      }
      return new Blob([buffer], { type: 'audio/wav' });
    } catch { throw new Error('The player did not return decodable audio. It may be an expired link or a blocked stream. Replay the clip and retry.'); }
    finally { await context.close(); }
  },
  async send(blob, status) {
    const id = crypto.randomUUID();
    const send = async payload => {
      const response = await chrome.runtime.sendMessage(payload);
      if (!response?.success) throw new Error(response?.error || 'Extension disconnected. Refresh the page.');
      return response;
    };
    try {
      await send({ action: 'VO_BEGIN', id, mimeType: blob.type });
      const size = 768 * 1024; // Small messages avoid Chrome's per-message size limit.
      for (let offset = 0; offset < blob.size; offset += size) {
        status(`Reading audio… ${Math.round(offset / blob.size * 100)}%`);
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject;
          reader.readAsDataURL(blob.slice(offset, offset + size));
        });
        await send({ action: 'VO_CHUNK', id, data });
      }
      status('AI is listening… Temporary server errors are retried automatically.');
      return await send({ action: 'VO_FINISH', id });
    } finally { await chrome.runtime.sendMessage({ action: 'VO_CANCEL', id }).catch(() => {}); }
  }
};
