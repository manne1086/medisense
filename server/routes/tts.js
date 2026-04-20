const express = require('express');
const router = express.Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Cache for available voices
let voicesCache = null;
let voicesCacheTime = 0;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Normalize language code to standard format (language-region)
 * Supports both short codes (hi, te, ta) and full codes (hi-IN, te-IN)
 */
const normalizeSpeechLanguageCode = (language) => {
  if (typeof language !== 'string') return 'en-IN';

  const normalized = language.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return 'en-IN';
  
  // If already in format like "hi-IN", return as-is
  if (normalized.includes('-')) {
    return normalized;
  }

  // Map short codes to full language codes
  const languageMap = {
    'en': 'en-IN',
    'hi': 'hi-IN',  // Hindi explicitly mapped
    'te': 'te-IN',  // Telugu
    'ta': 'ta-IN',  // Tamil
    'kn': 'kn-IN',  // Kannada
    'bn': 'bn-IN',  // Bengali
    'be': 'bn-IN',  // Bengali (alternate)
    'ml': 'ml-IN',  // Malayalam
    'gu': 'gu-IN',  // Gujarati
    'or': 'or-IN',  // Odia
  };

  // Check if it's a known language code
  if (languageMap[normalized]) {
    return languageMap[normalized];
  }

  // Check if it starts with a known language
  for (const [key, value] of Object.entries(languageMap)) {
    if (normalized.startsWith(key)) {
      return value;
    }
  }

  return 'en-IN';  // Default to English-India
};

/**
 * Extract language code for ElevenLabs API (just the language part like 'hi', 'en', 'te')
 */
const toElevenLabsLanguage = (languageCode) => {
  const normalized = normalizeSpeechLanguageCode(languageCode);
  return normalized.split('-')[0].toLowerCase();
};

/**
 * Fetch available voices from ElevenLabs API
 */
const getAvailableVoices = async () => {
  const now = Date.now();
  
  // Return cached voices if still valid
  if (voicesCache && (now - voicesCacheTime) < CACHE_DURATION) {
    return voicesCache;
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!res.ok) {
      console.error('Failed to fetch voices:', res.status);
      return null;
    }

    const data = await res.json();
    voicesCache = data.voices || [];
    voicesCacheTime = now;
    console.log(`Cached ${voicesCache.length} available voices from ElevenLabs`);
    return voicesCache;
  } catch (err) {
    console.error('Error fetching voices:', err?.message || err);
    return null;
  }
};

/**
 * Select the best female voice for a given language
 * Prioritizes voices matching the requested language
 * Avoids mixing English accents with non-English languages
 */
const selectVoiceForLanguage = (voices, language) => {
  if (!voices || voices.length === 0) {
    return null;
  }

  const targetLang = toElevenLabsLanguage(language);
  const fullLangCode = normalizeSpeechLanguageCode(language);
  
  console.log(`[TTS] Selecting voice for language: ${language} -> ${targetLang} (${fullLangCode})`);
  console.log(`[TTS] Available voices (${voices.length}): ${voices.map(v => `${v.name}(${v.labels?.language})`).join(', ')}`);

  // Step 1: Filter for female voices preferentially
  const femaleVoices = voices.filter(v => {
    const isFemale = v.labels && (
      v.labels.gender === 'female' ||
      (v.name && /female|woman|girl|lady/i.test(v.name))
    );
    return isFemale;
  });

  console.log(`[TTS] Female voices available: ${femaleVoices.length}`);

  const availableVoices = femaleVoices.length > 0 ? femaleVoices : voices;
  
  // Step 2: STRICT language matching - prefer exact language match ONLY
  // Don't match anything unless language explicitly matches
  const langMatchVoices = availableVoices.filter(v => {
    if (!v.labels || !v.labels.language) return false;
    const voiceLang = v.labels.language.toLowerCase();
    
    // Map language label to language codes
    const langMap = {
      'hindi': 'hi',
      'telugu': 'te',
      'tamil': 'ta',
      'kannada': 'kn',
      'bengali': 'bn',
      'malayalam': 'ml',
      'gujarati': 'gu',
      'odia': 'or',
      'english': 'en',
      'mandarin': 'zh',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'italian': 'it',
      'portuguese': 'pt',
      'russian': 'ru',
      'japanese': 'ja',
      'korean': 'ko',
      'arabic': 'ar',
      'thai': 'th',
      'vietnamese': 'vi',
    };
    
    // Check if language label matches target language
    const matchedLang = langMap[voiceLang];
    if (matchedLang === targetLang) {
      console.log(`[TTS] Language match found: ${voiceLang} -> ${targetLang}`);
      return true;
    }
    
    // Also check if voice language code starts with target language
    if (voiceLang === targetLang || voiceLang.startsWith(targetLang + '-')) {
      return true;
    }
    
    return false;
  });

  if (langMatchVoices.length > 0) {
    const selected = langMatchVoices[0];
    console.log(`[TTS] ✅ Selected language-matched voice: ${selected.name} (Language: ${selected.labels.language})`);
    return selected;
  }

  // Step 3: For non-English requests, DO NOT fallback to English voices
  if (targetLang !== 'en') {
    console.warn(`[TTS] ⚠️  WARNING: No native voice found for language '${targetLang}'.`);
    console.warn(`[TTS] Available languages: ${[...new Set(voices.map(v => v.labels?.language).filter(Boolean))].join(', ')}`);
    console.warn(`[TTS] Will attempt API-level language code to avoid English accent`);
    
    // Return first non-English voice if available
    const nonEnglishVoices = availableVoices.filter(v => {
      const voiceLang = v.labels?.language?.toLowerCase();
      return voiceLang && voiceLang !== 'english' && !voiceLang.includes('en');
    });
    
    if (nonEnglishVoices.length > 0) {
      console.log(`[TTS] Using non-English voice: ${nonEnglishVoices[0].name}`);
      return nonEnglishVoices[0];
    }
  }

  // Step 4: Last resort fallback (accept any voice, but log warning)
  if (availableVoices.length > 0) {
    const fallback = availableVoices[0];
    console.warn(`[TTS] ❌ FALLBACK: Using voice ${fallback.name} (${fallback.labels?.language}). May have accent mismatch.`);
    return fallback;
  }

  return voices[0] || null;
};

router.post('/speak', async (req, res) => {
  try {
    const { text, language, language_code } = req.body;
    
    // Use language_code if provided (usually in format like "hi-IN"), fallback to language
    const inputLanguage = language_code || language;
    const normalizedLanguageCode = normalizeSpeechLanguageCode(inputLanguage);
    const elevenLabsLanguage = toElevenLabsLanguage(normalizedLanguageCode);

    console.log(`[TTS] Request: input="${inputLanguage}", normalized="${normalizedLanguageCode}", elevenLabs="${elevenLabsLanguage}"`);

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    if (!ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: 'ElevenLabs not configured - falling back to browser TTS', fallback: true });
    }

    // Get available voices
    const voices = await getAvailableVoices();
    const selectedVoice = selectVoiceForLanguage(voices, normalizedLanguageCode);

    if (!selectedVoice) {
      console.warn('[TTS] No suitable voice found');
      return res.status(503).json({ error: 'No voice available - using browser TTS', fallback: true });
    }

    console.log(`[TTS] Using voice: ${selectedVoice.name} (ID: ${selectedVoice.voice_id}) for ${normalizedLanguageCode}`);

    // Build speech payload with proper language code
    // IMPORTANT: Always include language_code to ensure proper pronunciation
    const buildSpeechPayload = (includeLanguageCode = true) => {
      const payload = {
        text: text.substring(0, 5000), // ElevenLabs limit safety
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.4,
        },
      };
      
      // Always include language code for multilingual model to avoid English accent
      // This tells ElevenLabs to pronounce the text in the specified language
      payload.language_code = elevenLabsLanguage;
      
      console.log(`[TTS] Payload language_code set to: "${elevenLabsLanguage}"`);
      console.log(`[TTS] Voice settings:`, JSON.stringify(payload.voice_settings));
      
      return payload;
    };

    const makeSpeechRequest = async (includeLanguageCode = true) => {
      const payload = buildSpeechPayload(includeLanguageCode);
      console.log(`[TTS] Sending request to ElevenLabs for voice ${selectedVoice.voice_id}`);
      console.log(`[TTS] Full payload:`, JSON.stringify(payload, null, 2));
      
      return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice.voice_id}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify(payload),
      });
    };

    let response = await makeSpeechRequest(true);
    let errorText = '';

    if (!response.ok && response.status === 400) {
      errorText = await response.text().catch(() => '');
      console.error(`[TTS] Got 400 error. Details: ${errorText}`);
      
      if (errorText.includes('unsupported_language') || errorText.includes('language_code')) {
        console.warn(`[TTS] ⚠️  ElevenLabs rejected language_code "${elevenLabsLanguage}". Attempting without language code...`);
        
        // Try without language code
        const fallbackPayload = buildSpeechPayload(false);
        delete fallbackPayload.language_code;
        
        response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice.voice_id}`, {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify(fallbackPayload),
        });
        errorText = '';
      }
    }

    // Handle payment required or other API errors - fallback to browser TTS
    if (response.status === 402 || response.status === 403 || response.status === 429) {
      console.warn(`[TTS] ElevenLabs API returned ${response.status} - falling back to browser TTS`);
      return res.status(503).json({ error: `ElevenLabs unavailable (${response.status}) - using browser TTS`, fallback: true });
    }

    if (!response.ok) {
      const err = errorText || await response.text().catch(() => 'Unknown error');
      console.error('[TTS] ElevenLabs error:', response.status, err);
      return res.status(response.status).json({ error: `ElevenLabs API error: ${response.status}`, fallback: true });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the audio response
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[TTS] Error:', err?.message || err);
    // Return fallback signal so frontend uses browser TTS
    res.status(503).json({ error: err?.message || 'Text-to-speech failed', fallback: true });
  }
});

module.exports = router;
