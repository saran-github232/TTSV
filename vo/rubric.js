globalThis.VORubric = Object.freeze({
  labels: ['Bad', 'Bad-Poor', 'Poor', 'Poor-Fair', 'Fair', 'Fair-Good', 'Good', 'Good-Excellent', 'Excellent'],
  anchors: [
    { score: 1, file: 'bad.mp3', reason: 'Hard to understand; severe artificiality, distortion, unpredictable pauses, incorrect pronunciation or words cut short.' },
    { score: 2, file: 'poor.mp3', reason: 'Unnatural speech with significant artificiality that makes understanding difficult. Listen for unclear words and artifacts.' },
    { score: 3, file: 'fair.mp3', reason: 'Understandable but clearly artificial; flat delivery or awkward pitch and timing may be distracting.' },
    { score: 4, file: 'good.mp3', reason: 'Mostly natural with slight artificiality, without significantly affecting understanding. May be somewhat flat.' },
    { score: 5, file: 'excellent.wav', reason: 'Human-like pronunciation, intonation and pacing, with appropriate dynamics and no audible artificiality.' }
  ],
  label(score) { return this.labels[(score - 1) * 2]; },
  validate(value) {
    if (!value || typeof value.score !== 'number' || !this.label(value.score) ||
        !['low', 'medium', 'high'].includes(value.confidence) ||
        typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 2000) {
      throw new Error('The provider returned an invalid rating. Retry and review the clip yourself.');
    }
    return { score: value.score, label: this.label(value.score), confidence: value.confidence, reason: value.reason };
  }
});
