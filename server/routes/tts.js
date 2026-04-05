const express = require('express');
const router = express.Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Cache for available voices
let voicesCache = null;
let voicesCacheTime = 0;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

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
 */
const selectVoiceForLanguage = (voices, language) => {
  if (!voices || voices.length === 0) {
    return null;
  }

  const lang = (language || 'en').substring(0, 2).toLowerCase();

  // Filter for female voices
  const femaleVoices = voices.filter(v => {
    const isFemale = v.labels && (
      v.labels.gender === 'female' ||
      (v.name && /female|woman|girl|lady/i.test(v.name))
    );
    return isFemale;
  });

  if (femaleVoices.length === 0) {
    // Fallback to any available voice
    return voices[0] || null;
  }

  // Prefer voices that match language
  const langMatch = femaleVoices.find(v => 
    v.labels && v.labels.language && v.labels.language.startsWith(lang)
  );
  if (langMatch) return langMatch;

  // Prefer English as fallback
  const enMatch = femaleVoices.find(v => 
    v.labels && v.labels.language && v.labels.language.startsWith('en')
  );
  if (enMatch) return enMatch;

  // Return first female voice
  return femaleVoices[0];
};

router.post('/speak', async (req, res) => {
  try {
    const { text, language } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    if (!ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: 'ElevenLabs not configured - falling back to browser TTS', fallback: true });
    }

    // Get available voices
    const voices = await getAvailableVoices();
    const selectedVoice = selectVoiceForLanguage(voices, language);

    if (!selectedVoice) {
      console.warn('No suitable voice found for language:', language);
      return res.status(503).json({ error: 'No voice available - using browser TTS', fallback: true });
    }

    console.log(`Using voice: ${selectedVoice.name} (ID: ${selectedVoice.voice_id})`);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice.voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.substring(0, 5000), // ElevenLabs limit safety
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.4,
        },
      }),
    });

    // Handle payment required or other API errors - fallback to browser TTS
    if (response.status === 402 || response.status === 403 || response.status === 429) {
      console.warn(`ElevenLabs API returned ${response.status} - falling back to browser TTS`);
      return res.status(503).json({ error: `ElevenLabs unavailable (${response.status}) - using browser TTS`, fallback: true });
    }

    if (!response.ok) {
      const err = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs error:', response.status, err);
      return res.status(response.status).json({ error: `ElevenLabs API error: ${response.status}`, fallback: true });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the audio response
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('TTS error:', err?.message || err);
    // Return fallback signal so frontend uses browser TTS
    res.status(503).json({ error: err?.message || 'Text-to-speech failed', fallback: true });
  }
});

module.exports = router;
