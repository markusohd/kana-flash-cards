// Playing sounds.
// First try the pre-generated audio file. If it is missing or fails, use the
// browser's built-in Japanese voice (Web Speech API) instead.

// Match the 0.85x speed of the generated files.
const SPEECH_RATE = 0.85;

let japaneseVoice = null;
let currentAudio = null;

// Female files use the paths in kana.json (audio/char/...); male files mirror
// them under audio/male/ (audio/male/char/...).
let voiceFolder = "audio/";

export function setVoice(voice) {
  voiceFolder = voice === "male" ? "audio/male/" : "audio/";
}

function voicePath(url) {
  return url.replace(/^audio\//, voiceFolder);
}

// Voices load asynchronously in some browsers, so look again when they change.
function findJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  japaneseVoice =
    voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith("ja")) ?? null;
}

if ("speechSynthesis" in window) {
  findJapaneseVoice();
  window.speechSynthesis.addEventListener?.("voiceschanged", findJapaneseVoice);
}

function stop() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// Speak Japanese text with the browser voice. Returns false if no Japanese voice exists.
function speak(text) {
  if (!japaneseVoice) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = japaneseVoice;
  utterance.lang = "ja-JP";
  utterance.rate = SPEECH_RATE;
  window.speechSynthesis.speak(utterance);
  return true;
}

// Play `url`; if that fails, speak `text`. Resolves to true if something played.
export async function play(url, text) {
  stop();
  try {
    currentAudio = new Audio(voicePath(url));
    await currentAudio.play();
    return true;
  } catch {
    currentAudio = null;
    return speak(text);
  }
}
