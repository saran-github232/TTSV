// Ground-truth data extracted from the official Training Guide (reference/pdff.pdf)
// and Taxonomy sheet (reference/pdf.pdf). Consumed by the dashboard app and engine.

export const EMOTIONS = [
  "anger", "annoyed", "awe", "curious", "excited",
  "fearful", "flirty", "joyful", "loud", "menacing",
  "mischievous", "nervous", "sad", "sarcastic", "smug",
  "surprised", "tender", "thoughtful", "whisper"
];

export const EMOTION_ALIASES = {
  angry: "anger", anger: "anger",
  mischievously: "mischievous", mischievous: "mischievous",
  whispers: "whisper", whisper: "whisper"
};

export function normalizeEmotion(label) {
  const l = (label || "").toLowerCase().trim();
  return EMOTION_ALIASES[l] || (EMOTIONS.includes(l) ? l : "");
}

export const TAXONOMY = [
  { label: "anger", name: "Anger", def: "Very mad or upset; strong, sharp, tense voice.", listenFor: "Forceful or tense voice; sharp stress; clipped phrasing; raised intensity.", notConfuse: "Annoyed (milder) · Loud (only volume) · Menacing (involves a threat)" },
  { label: "annoyed", name: "Annoyed", def: "Irritated or tired of something, but not strongly angry.", listenFor: "Exasperated or flat tone; drawn-out words; sighing quality; restrained sharpness.", notConfuse: "Anger (much stronger) · Sarcastic (means the opposite) · Sad (unhappy, not irritated)" },
  { label: "awe", name: "Awe", def: "Amazed by something beautiful, impressive, or wonderful.", listenFor: "Breathy or open tone; slower pace; widened pitch range; reverent emphasis.", notConfuse: "Surprised (unexpected, may not admire) · Joyful (happy, not amazed) · Excited (more energy)" },
  { label: "curious", name: "Curious", def: "Wants to know, learn, or understand something.", listenFor: "Questioning intonation; attentive energy; upward inflection; inviting pace.", notConfuse: "Thoughtful (thinking, not asking) · Surprised (reaction) · Nervous (worried, not interested)" },
  { label: "excited", name: "Excited", def: "Very eager, happy, and full of energy.", listenFor: "Faster pace; higher pitch; lively rhythm; strong positive emphasis.", notConfuse: "Joyful (calmer) · Surprised (sudden reaction) · Loud (only volume)" },
  { label: "fearful", name: "Fearful", def: "Afraid because something dangerous or bad may happen.", listenFor: "Shaky or breathy voice; urgency; higher pitch; pauses, gasps, strained delivery.", notConfuse: "Nervous (no clear danger) · Surprised (not afraid) · Whisper (only quiet)" },
  { label: "flirty", name: "Flirty", def: "Playful and shows romantic interest in someone.", listenFor: "Teasing warmth; suggestive stress; playful rhythm; soft or inviting delivery.", notConfuse: "Tender (caring, not romantic) · Mischievous (trouble, not romance) · Joyful (not romantic)" },
  { label: "joyful", name: "Joyful", def: "Clearly happy, pleased, or delighted.", listenFor: "Smiling voice; bright resonance; buoyant rhythm; warm positive energy.", notConfuse: "Excited (more energy) · Smug (superior) · Tender (soft and caring)" },
  { label: "loud", name: "Loud", def: "High volume or shouting; the emotion may differ.", listenFor: "Strong amplitude and projection; voice carries forcefully; may sound shouted.", notConfuse: "Anger (mad) · Excited (positive energy) · Menacing (threatening)" },
  { label: "menacing", name: "Menacing", def: "Threatening or dangerous, as if they may harm or scare someone.", listenFor: "Controlled low tone; deliberate pacing; ominous stress; cold intensity.", notConfuse: "Anger (not threatening) · Loud (only volume) · Smug (superior, not threatening)" },
  { label: "mischievous", name: "Mischievous", def: "Playful or cheeky and may be planning harmless trouble.", listenFor: "Conspiratorial or cheeky tone; playful stress; restrained amusement; knowing rhythm.", notConfuse: "Menacing (may cause harm) · Flirty (romantic) · Sarcastic (mocking)" },
  { label: "nervous", name: "Nervous", def: "Worried, unsure, or uncomfortable; voice may shake or hesitate.", listenFor: "Hesitations; uneven rhythm; tight or shaky pitch; rushed words or fillers.", notConfuse: "Fearful (clear danger) · Whisper (only quiet voice)" },
  { label: "sad", name: "Sad", def: "Unhappy, hurt, disappointed, or low in energy.", listenFor: "Lower energy; slower pace; softer volume; falling pitch; heavy or tearful quality.", notConfuse: "Tender (gentle/caring) · Nervous (worried) · Whisper (only quiet)" },
  { label: "sarcastic", name: "Sarcastic", def: "Mocking or means the opposite of the words they say.", listenFor: "Exaggerated stress; dry or flat tone; stretched words; mismatch with wording.", notConfuse: "Annoyed (direct irritation) · Smug (superior) · Mischievous (playful, not mocking)" },
  { label: "smug", name: "Smug", def: "Very pleased with themselves and may feel better than others.", listenFor: "Knowing tone; relaxed certainty; slight drawl; condescending emphasis.", notConfuse: "Joyful (no superiority) · Sarcastic (mocking) · Menacing (threatening)" },
  { label: "surprised", name: "Surprised", def: "Reacts to something they did not expect.", listenFor: "Sudden pitch jump; sharp onset; widened intensity; brief gasp or pause.", notConfuse: "Awe (adds wonder) · Excited (lasts longer) · Fearful (afraid of danger)" },
  { label: "tender", name: "Tender", def: "Soft, gentle, caring, or loving.", listenFor: "Soft warm tone; smooth pace; delicate emphasis; calm, intimate delivery.", notConfuse: "Flirty (romantic) · Sad (sorrow) · Whisper (only quiet)" },
  { label: "thoughtful", name: "Thoughtful", def: "Calm and carefully thinking about something.", listenFor: "Measured pace; intentional pauses; calm control; emphasis on key ideas.", notConfuse: "Curious (wants an answer) · Nervous (worried) · Sad (unhappy/low)" },
  { label: "whisper", name: "Whisper", def: "Very quiet, soft, and breathy voice.", listenFor: "Breathy phonation; minimal projection; close, soft delivery; reduced voicing.", notConfuse: "Tender (gentle emotion) · Fearful (afraid) · Nervous (worried)" }
];

// Reference sample clips (Google Drive file ids) — three per emotion, from the Taxonomy sheet.
export const SAMPLES = {
  anger: ["1sNvEhdtZ5gqxrARpj1m-ZpK_OszsjCuE", "1PlfjECwcOBTIO71V52Ui58DMflvXWU-k", "1sPJzajHQE7ZAm-BYPrX8b-bUhqGJQ7Yh"],
  annoyed: ["1sYUZoooNei9H9dKHQtsC8lWX_rYnPOYU", "1i0D_OEErnP-6OQWQoa0XB33GP5oUTrGW", "11-pyaD05MG7cVKijwzPiDpReXigO5jhq"],
  awe: ["1Xt5wD07oPPs5i2ioW67FFCS9t-0ftUvB", "1C6sNneKZJunqyWl6c5W60Rp3H7Cm-xao", "1EmDrj3CXpUVD41_bZeeh4QPDRQkrZyOv"],
  curious: ["1eJ-DmIzJb8AN5B3YRXfnfI5nGWdV69tj", "178LAUisk6iKbUr4oSnQumdxGJpAOZZJ2", "1MztgVQleyx8E0Fox0x_cQtb4rv3ypzRD"],
  excited: ["10ymKSkD1tkAgJzDZZliVJc-bFb2GAXOK", "1mZuTL_56TR6cqjQhvz1d1TQZnxdFJAmF", "1Jpgu91TQsHLHgph0AB66mgERBfJBOO7d"],
  fearful: ["1-21X_la2wvjTuYGklmiapfPTfs79IZmO", "1etpZgM9ADaWKjvvNHfOmVPZWHrGSRVzb", "11-Jowpp2ZVMimQDctxulR3_eXHcp3H4o"],
  flirty: ["1nGGozA7VUBacgRuxe_hNglpec_Ddjp6l", "1oZGn4B9d4lhuvPPOnImFnNWGWJ1ys46r", "1HBJPH4z58RsKN1fg3SWNU9WEjBuz8jgb"],
  joyful: ["1R5jaoFmp95yUB8cl0dZseziXLfXzLX-A", "1YEaoDiAY_TkWfTc1oSGpxiln0BDHRP2L", "1_FCMpfk90iXT4pHs3bzAb_V53BwmrIqV"],
  loud: ["1E3NCyxLUK7PlFPdXqF0hS3x5T4kMHyOP", "1Md5GFQbGvvlbEsNdf-Iy0dmbJjSTfr7n", "1qgDM6cyH8V6Wjrvx9bOUqQElEk52fBwi"],
  menacing: ["1PSQlztcf6Lnzs3g2IhefnfmEzIp0U1rW", "1f9xeDaRk_aVRYP-7oirHzfh6hDn07TXq", "1IYBvj7PW2J5aSD2YsiGW4WnEez-NKcXH"],
  mischievous: ["14MH9BRtq0pRD5hXEtR7wv_bNLFy4UNai", "1tC5UlRs1NyFSzAWCPgcFIyThvDDzEq3y", "1u4aGskPzBi4Od4ywv96j25oupWHuSrc-"],
  nervous: ["1jAhjRVBFCuO_aemNuNBq87d4vo3_xKYE", "11_9UtTws5Z4N_YI_leqZOTGDtWI44x8X", "1TovoJU7mg9mM0cl9S_UcVy1OqCStaNFb"],
  sad: ["1Rb9qKTP8pPOc9RwPOrRxPDaY6goVdhOe", "19xYgeol9LYWJXHpreaYI3Q8xfwoMiCFt", "14SmhlmxgF2LFayRF243WZrcBdTRWROG8"],
  sarcastic: ["1ew4gGYOgQlsQTgCLpxa9uk5XKgDVLQui", "1IRXLouh9RE7bpJX31SWgqyZmcP9r_L3B", "1q6hDwouBlcmpIsOvUuu_EmM4_Eoc-WLu"],
  smug: ["1IFwR7sJ-pN6Q30y7jLiMRknhecHwwRMR", "1h51SKBa0VTNtpU6mI6nNP2dbkm8snEmf", "1dRqiGsfiisTw1b_8GitD2OwEk0UvxO0l"],
  surprised: ["1EAD-ai91NLejNbtX-QHoGz_LEYD5V_vy", "1jMVi613VRPvXYUuFEsQPhEJp3d5ozMWx", "1faD7vETERlAkUCTllWX6AJTOv49CFp5G"],
  tender: ["1ctW_EppmD0HaSbJ16DkmYuHmE0zuh8em", "1_N26T9UtwcyeTe114mcGAD_p5cldzko9", "1nYl9vfF97eMUOchwOPWcG6AFC3LCK3vc"],
  thoughtful: ["1TeyMeHJp2pwJsNYV9hp3gxV_BZp0KJne", "1b9xd9k9nkNVpbhYT8YSc7Zxl0pN1Jg6u", "1Ox97FHdBuBx49DulKpnn1EZjSzfkcC5y"],
  whisper: ["1zjNtOA0IZcY8sD3ul0i8fU50J-Ukuytk", "1WY7IIrtwF66I9w4LfggRSwlWSY26aqF2", "1dQKFID1HpxHcQKk1qOvy59EgFbFfwWZ4"]
};

export const SAMPLE_URL = (id) => `https://drive.google.com/file/d/${id}/view`;

export const EVENT_TAGS = [
  "<|laugh|>", "<|chuckle|>", "<|giggle|>", "<|sigh|>", "<|sniff|>",
  "<|cough|>", "<|throat_clear|>", "<|lip_smack|>", "<|gulp|>", "<|gasp|>",
  "<|yawn|>", "<|snort|>", "<|cry|>", "<|woo|>", "<|hum_tune|>",
  "<|tsk|>", "<|um|>", "<|uh|>", "<|inhale|>", "<|exhale|>"
];

// Portal review statuses (drive the dashboard KPIs) — exact Training Guide definitions.
export const STATUSES = {
  accepted: "Accepted — the clip was accepted without any changes to the transcription or tags.",
  fixed: "Fixed — you corrected the transcription, event tags, or emotion tags, then approved.",
  rejected: "Rejected — the clip was rejected outright due to a major violation."
};
