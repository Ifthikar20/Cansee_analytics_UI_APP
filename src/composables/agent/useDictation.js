import { onScopeDispose, ref, toValue } from 'vue'

// Dictation through the Web Speech API. `supported` is false where the API is
// missing (Firefox, most embedded browsers) and the mic button stays hidden.
// Final transcripts go to onText; interim text is exposed for display only.

const ERRORS = {
  'not-allowed': 'Microphone access is blocked for this site.',
  'service-not-allowed': 'Dictation is not available in this browser.',
  'audio-capture': 'No microphone was found.',
  'no-speech': 'No speech was detected.',
  network: 'Dictation needs a network connection.',
  'language-not-supported': 'Dictation does not support this language.',
}

function recognitionClass() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

/**
 * @param options { onText(text), lang?: ref|getter|string }
 */
export function useDictation({ onText, lang } = {}) {
  const Recognition = recognitionClass()
  const supported = Boolean(Recognition)
  const listening = ref(false)
  const interim = ref('')
  const error = ref('')
  let recognition = null

  function start() {
    if (!supported || recognition) return
    error.value = ''
    interim.value = ''
    const rec = new Recognition()
    rec.lang = toValue(lang) || (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (event) => {
      let finalText = ''
      let pending = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0]?.transcript || ''
        if (result.isFinal) finalText += transcript
        else pending += transcript
      }
      interim.value = pending
      if (finalText.trim()) onText?.(finalText.trim())
    }
    rec.onerror = (event) => {
      if (event.error === 'aborted') return
      error.value = ERRORS[event.error] || 'Dictation stopped unexpectedly.'
    }
    rec.onend = () => {
      listening.value = false
      interim.value = ''
      recognition = null
    }
    recognition = rec
    try {
      rec.start()
      listening.value = true
    } catch {
      recognition = null
      listening.value = false
      error.value = 'Dictation could not start.'
    }
  }

  function stop() {
    try {
      recognition?.stop()
    } catch {}
  }

  function toggle() {
    if (listening.value) stop()
    else start()
  }

  onScopeDispose(() => {
    try {
      recognition?.abort()
    } catch {}
    recognition = null
  })

  return { supported, listening, interim, error, start, stop, toggle }
}
