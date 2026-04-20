const express = require('express');
const Groq = require('groq-sdk');
const multer = require('multer');
const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const normalizeTranscriptionLanguage = (language) => {
  if (typeof language !== 'string') return undefined;

  const normalized = language.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return undefined;
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('hi')) return 'hi';
  if (normalized.startsWith('te')) return 'te';
  if (normalized.startsWith('ta')) return 'ta';

  return normalized;
};

const normalizeDetectedLanguageCode = (language) => {
  if (typeof language !== 'string') return undefined;

  const normalized = language.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return undefined;
  if (normalized.startsWith('en') || normalized === 'english') return 'en-IN';
  if (normalized.startsWith('hi') || normalized === 'hindi') return 'hi-IN';
  if (normalized.startsWith('te') || normalized === 'telugu') return 'te-IN';
  if (normalized.startsWith('ta') || normalized === 'tamil') return 'ta-IN';
  if (normalized.startsWith('kn') || normalized === 'kannada') return 'kn-IN';
  if (normalized.startsWith('bn') || normalized.startsWith('be') || normalized === 'bengali') return 'bn-IN';
  if (normalized.startsWith('ml') || normalized === 'malayalam') return 'ml-IN';
  if (normalized.startsWith('gu') || normalized === 'gujarati') return 'gu-IN';
  if (normalized.startsWith('or') || normalized === 'odia' || normalized === 'oriya') return 'or-IN';

  return undefined;
};

// Generic proxy for Groq chat completions
router.post('/chat', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, response_format } = req.body;

    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'model and messages[] are required' });
    }

    const params = {
      model,
      messages,
      temperature: temperature ?? 0.1,
    };
    if (max_tokens) params.max_tokens = max_tokens;
    if (response_format) params.response_format = response_format;

    const completion = await groq.chat.completions.create(params);
    res.json(completion);
  } catch (err) {
    console.error('Groq proxy error:', err?.message || err);
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'Groq API request failed' });
  }
});

// Speech-to-text via Groq Whisper
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file is required' });
    }

    // Groq's audio API expects a File-like object
    const file = req.file;
    const lang = normalizeTranscriptionLanguage(req.body.language);

    // Language-specific prompt hints improve Whisper accuracy for non-English
    const langPrompts = {
      hi: 'हिंदी में बोलिए।',
      te: 'తెలుగులో మాట్లాడండి.',
      ta: 'தமிழில் பேசுங்கள்.',
    };

    const params = {
      file: new File([file.buffer], file.originalname || 'audio.webm', { type: file.mimetype }),
      model: 'whisper-large-v3',
    };
    if (lang) params.language = lang;
    if (lang && langPrompts[lang]) params.prompt = langPrompts[lang];

    let transcription;
    try {
      transcription = await groq.audio.transcriptions.create({
        ...params,
        response_format: 'verbose_json',
      });
    } catch (verboseErr) {
      console.warn('Verbose transcription unavailable, retrying standard transcription:', verboseErr?.message || verboseErr);
      transcription = await groq.audio.transcriptions.create(params);
    }

    const languageCode = normalizeDetectedLanguageCode(transcription.language)
      || normalizeDetectedLanguageCode(lang)
      || undefined;

    res.json({
      text: transcription.text || '',
      language: transcription.language || lang || undefined,
      language_code: languageCode,
    });
  } catch (err) {
    console.error('Transcription proxy error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Transcription failed' });
  }
});

module.exports = router;
