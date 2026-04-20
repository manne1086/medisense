import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  X,
  Loader2,
  AlertCircle,
  Image,
  Copy,
  Download,
  Volume2,
  VolumeX,
  AudioLines,
  BotMessageSquare,
  Sparkles,
  Stethoscope,
  UserRound
} from 'lucide-react';
import { chatWithAssistant, analyzeSymptoms, detectLanguageFromText, normalizeLanguageCode } from '../services/grokService';
import { getHistory } from '../services/storageService';

const renderFormattedText = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Convert **bold** to <strong>
    const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      // Convert *italic* to <em>
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={j}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
    return (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {parts}
      </React.Fragment>
    );
  });
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
  languageCode?: string;
}

const HeaderAssistantIcon: React.FC = () => (
  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 shadow-lg backdrop-blur-sm">
    <Stethoscope size={24} className="text-white" strokeWidth={2.2} />
    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-300 text-[#005f91] ring-2 ring-[#1378d6]">
      <Sparkles size={11} strokeWidth={2.6} />
    </span>
  </div>
);

const AssistantAvatar: React.FC = () => (
  <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#008AD1] to-blue-600 text-white shadow-md md:h-10 md:w-10">
    <BotMessageSquare size={16} strokeWidth={2.1} className="md:h-[18px] md:w-[18px]" />
    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-300 text-[#005f91] ring-2 ring-white/70 md:h-4 md:w-4">
      <Sparkles size={8} strokeWidth={2.6} className="md:h-[9px] md:w-[9px]" />
    </span>
  </div>
);

const UserAvatar: React.FC = () => (
  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-md md:h-10 md:w-10">
    <UserRound size={16} strokeWidth={2.1} className="md:h-[18px] md:w-[18px]" />
  </div>
);

export const AIDoctor: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hello. I\'m your AI Medical Assistant. I can help you with health concerns, explain medical symptoms, and provide general health guidance. Please describe your symptoms or ask any health-related questions.\n\nImportant: This is not a substitute for professional medical advice. Always consult a qualified doctor for serious concerns.',
      timestamp: new Date()
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState('auto');
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(0);
  const [voiceConverseMode, setVoiceConverseMode] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceIconRef = useRef<SVGSVGElement>(null);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputValueRef = useRef(inputValue);
  const voiceConverseModeRef = useRef(voiceConverseMode);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckRef = useRef<number | null>(null);
  const detectedVoiceLanguageRef = useRef<string>('auto');

  // Keep refs in sync
  useEffect(() => { inputValueRef.current = inputValue; }, [inputValue]);
  useEffect(() => { voiceConverseModeRef.current = voiceConverseMode; }, [voiceConverseMode]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch patient records for RAG context
  useEffect(() => {
    (async () => {
      const records = await getHistory();
      setMedicalRecords(records);
    })();
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
        setShowImagePreview(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImageFile(null);
    setShowImagePreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVoiceStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick a MIME type the browser actually supports
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const ext = actualMime.includes('mp4') ? 'mp4' : actualMime.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        await transcribeAudio(audioBlob, ext);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Please allow microphone access to use voice input');
    }
  };

  const handleVoiceStop = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Voice converse: start recording for converse mode with silence detection
  const startVoiceConverse = async () => {
    setVoiceConverseMode(true);
    setIsVoiceRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        stopSilenceDetection();
        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const ext = actualMime.includes('mp4') ? 'mp4' : actualMime.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        setIsVoiceRecording(false);
        await transcribeAudio(audioBlob, ext);
        // After transcription, start auto-submit countdown
        startAutoSubmitCountdown();
      };

      mediaRecorder.start();

      // Set up silence detection using Web Audio API
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);
      const SILENCE_THRESHOLD = 15; // RMS below this = silence
      const SILENCE_DURATION = 3000; // 3 seconds of silence → auto-stop
      let speechDetected = false;

      const checkSilence = () => {
        analyser.getByteTimeDomainData(dataArray);
        // Calculate RMS (root mean square) to detect audio level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length) * 100;

        if (rms > SILENCE_THRESHOLD) {
          // Voice detected — clear any silence timer
          speechDetected = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (speechDetected && !silenceTimerRef.current) {
          // Silence after speech — start countdown to auto-stop
          silenceTimerRef.current = setTimeout(() => {
            // Auto-stop recording after sustained silence
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
          }, SILENCE_DURATION);
        }

        silenceCheckRef.current = requestAnimationFrame(checkSilence);
      };

      silenceCheckRef.current = requestAnimationFrame(checkSilence);
    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Please allow microphone access to use voice input');
      setIsVoiceRecording(false);
      setVoiceConverseMode(false);
    }
  };

  const stopSilenceDetection = () => {
    if (silenceCheckRef.current) {
      cancelAnimationFrame(silenceCheckRef.current);
      silenceCheckRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const stopVoiceConverse = () => {
    if (mediaRecorderRef.current && isVoiceRecording) {
      mediaRecorderRef.current.stop();
    }
    // Don't clear voiceConverseMode yet — we need it for auto-speak
  };

  const cancelVoiceConverse = () => {
    if (autoSubmitTimerRef.current) {
      clearInterval(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    stopSilenceDetection();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setAutoSubmitCountdown(0);
    setVoiceConverseMode(false);
    setIsVoiceRecording(false);
  };

  // Auto-submit countdown using refs to avoid stale closures
  const sendMessageRef = useRef<() => void>(() => {});
  
  const startAutoSubmitCountdown = () => {
    if (autoSubmitTimerRef.current) clearInterval(autoSubmitTimerRef.current);
    
    let countdown = 5;
    setAutoSubmitCountdown(countdown);
    
    const timer = setInterval(() => {
      countdown--;
      setAutoSubmitCountdown(countdown);
      
      if (countdown <= 0) {
        clearInterval(timer);
        autoSubmitTimerRef.current = null;
        // Use ref to get latest inputValue
        if (inputValueRef.current.trim()) {
          sendMessageRef.current();
        } else {
          setVoiceConverseMode(false);
        }
      }
    }, 1000);
    
    autoSubmitTimerRef.current = timer;
  };

  const transcribeAudio = async (audioBlob: Blob, ext = 'webm') => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${ext}`);
      if (activeLanguage !== 'auto') {
        formData.append('language', activeLanguage);
      }

      const apiBase = (import.meta as any).env?.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/api/groq/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Transcription failed');
      }

      const data = await res.json();
      if (data.text) {
        const detectedLanguage = normalizeLanguageCode(data.language_code || data.language);
        if (detectedLanguage !== 'auto') {
          detectedVoiceLanguageRef.current = detectedLanguage;
        }
        setInputValue(prev => prev ? `${prev} ${data.text}` : data.text);
      } else {
        alert('Could not transcribe audio. Please try again or type your message.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      alert('Voice transcription failed. Please type your message instead.');
    }
  };

  // ── Text-to-Speech via ElevenLabs with fallback to browser ─────────────────────────────
  const stripMarkdown = (text: string) =>
    text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^[•\-]\s*/gm, '');

  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const resolveTurnLanguage = useCallback((text: string, preferredLanguage?: string) => {
    const explicitLanguage = normalizeLanguageCode(preferredLanguage || activeLanguage);
    if (explicitLanguage !== 'auto') return explicitLanguage;

    const voiceLanguage = normalizeLanguageCode(detectedVoiceLanguageRef.current);
    if (voiceLanguage !== 'auto') return voiceLanguage;

    return detectLanguageFromText(text);
  }, [activeLanguage]);

  const getSpeechLanguageParts = (languageCode?: string) => {
    const normalized = normalizeLanguageCode(languageCode);
    const full = normalized === 'auto' ? 'en-IN' : normalized;
    const base = full.split('-')[0].toLowerCase();
    return { full, base };
  };

  // Fallback: Browser SpeechSynthesis for when ElevenLabs is unavailable
  const useBrowserTTS = (text: string, messageId: string, languageCode?: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Browser TTS not supported');
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const voices = window.speechSynthesis.getVoices();
    const { full: targetFullLang, base: targetBaseLang } = getSpeechLanguageParts(languageCode);
    utterance.lang = targetFullLang;
    const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(targetBaseLang));
    
    // Prefer female voices
    const isFemale = (v: SpeechSynthesisVoice) =>
      /female|woman|zira|susan|samantha|heera|swara|shruti/i.test(v.name);
    const voice =
      langVoices.find(isFemale) ||
      langVoices[0] ||
      voices.filter(v => v.lang.toLowerCase().startsWith('en')).find(isFemale) ||
      voices.find(v => v.lang.startsWith('en'));

    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.pitch = 1.1;

    utterance.onend = () => {
      setSpeakingId(null);
    };
    utterance.onerror = () => {
      setSpeakingId(null);
    };

    setSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const speakText = useCallback(async (text: string, messageId: string, languageCode?: string) => {
    // If already speaking this message, stop
    if (speakingId === messageId) {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
      return;
    }

    // Stop any current playback
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    const cleaned = stripMarkdown(text);
    const resolvedLanguageCode = resolveTurnLanguage(cleaned, languageCode);

    setSpeakingId(messageId);

    try {
      const apiBase = (import.meta as any).env?.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/api/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass full language code (hi-IN, te-IN, etc.) for proper language detection
        body: JSON.stringify({ text: cleaned, language_code: resolvedLanguageCode }),
      });

      // If ElevenLabs is unavailable (402, 503, etc.), use browser TTS
      if (res.status === 503 || res.status === 402 || res.status === 403) {
        console.warn('ElevenLabs unavailable, using browser TTS');
        useBrowserTTS(cleaned, messageId, resolvedLanguageCode);
        return;
      }

      if (!res.ok) {
        console.warn('ElevenLabs error:', res.status, 'falling back to browser TTS');
        useBrowserTTS(cleaned, messageId, resolvedLanguageCode);
        return;
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        setSpeakingId(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        ttsAudioRef.current = null;
        setSpeakingId(null);
      };

      await audio.play();
    } catch (err) {
      console.error('ElevenLabs TTS error, falling back to browser:', err);
      useBrowserTTS(cleaned, messageId, resolvedLanguageCode);
    }
  }, [speakingId, resolveTurnLanguage]);

  // Cancel speech & timers on unmount
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (autoSubmitTimerRef.current) {
        clearInterval(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
      if (silenceCheckRef.current) {
        cancelAnimationFrame(silenceCheckRef.current);
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Keep sendMessageRef in sync so the countdown timer can call it
  useEffect(() => { sendMessageRef.current = sendMessage; });

  const sendMessage = async () => {
    // Cancel any running countdown
    if (autoSubmitTimerRef.current) {
      clearInterval(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
      setAutoSubmitCountdown(0);
    }
    
    if (!inputValue.trim() && !imageFile) return;
    const turnLanguageCode = resolveTurnLanguage(inputValue);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue || 'Attached image',
      image: selectedImage || undefined,
      timestamp: new Date(),
      languageCode: turnLanguageCode
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Prepare for assistant response
    setLoading(true);
    
    try {
      let assistantResponse = '';
      let base64Image = undefined;
      let mimeType = undefined;

      // If there's an image, analyze it differently
      if (imageFile && selectedImage) {
        base64Image = selectedImage.split(',')[1];
        mimeType = imageFile.type;
        
        // Use symptom analysis with image
        const result = await analyzeSymptoms(inputValue, base64Image, mimeType, turnLanguageCode);
        const resultLanguageCode = normalizeLanguageCode(result.language_code || turnLanguageCode);
        assistantResponse = result.text || 'I could not analyze the image clearly. Could you please describe your symptoms or upload a clearer photo?';
        
        if (result.followUpQuestions && result.followUpQuestions.length > 0) {
          assistantResponse += '\n\n' + result.followUpQuestions.map((q: string) => `• ${q}`).join('\n');
        }
        detectedVoiceLanguageRef.current = resultLanguageCode;
      } else if (inputValue.trim()) {
        // Regular chat message
        const result = await chatWithAssistant(
          messages.map(m => ({
            role: m.role,
            text: m.content
          })),
          inputValue,
          medicalRecords,
          turnLanguageCode,
          voiceConverseModeRef.current
        );
        assistantResponse = result;
        detectedVoiceLanguageRef.current = turnLanguageCode;
      }

      // Add assistant response
      const assistantLanguageCode = detectedVoiceLanguageRef.current !== 'auto'
        ? detectedVoiceLanguageRef.current
        : turnLanguageCode;
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
        languageCode: assistantLanguageCode
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-speak response in voice converse mode
      if (voiceConverseModeRef.current && assistantResponse) {
        speakText(assistantResponse, assistantMessage.id, assistantLanguageCode);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again. If the problem persists, please contact support.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setVoiceConverseMode(false);
    }

    // Clear image
    removeImage();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadTranscript = () => {
    const transcript = messages
      .map(m => `[${m.role.toUpperCase()}] ${m.timestamp.toLocaleTimeString()}\n${m.content}`)
      .join('\n\n---\n\n');
    
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(transcript));
    element.setAttribute('download', `medical-chat-${new Date().toISOString().split('T')[0]}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const languages = [
    { code: 'auto', label: 'Auto Detect' },
    { code: 'en-IN', label: 'English' },
    { code: 'hi-IN', label: 'Hindi' },
    { code: 'te-IN', label: 'Telugu' }
  ];

  return (
    <div className="flex flex-col h-screen max-h-[800px] md:max-h-screen bg-gradient-to-b from-blue-50 to-white rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#008AD1] to-blue-600 text-white p-4 md:p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <HeaderAssistantIcon />
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">AI Medical Assistant</h2>
              <p className="text-sm md:text-base text-blue-100 mt-1">Chat with your virtual doctor</p>
            </div>
          </div>
          <div className="text-right text-xs md:text-sm space-y-1">
            <div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gradient-to-b from-blue-50/50 to-white">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 md:gap-4 animate-fadeIn ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && <AssistantAvatar />}
            
            <div
              className={`max-w-xs md:max-w-md lg:max-w-2xl rounded-2xl px-4 md:px-5 py-3 md:py-4 shadow-sm ${
                message.role === 'user'
                  ? 'bg-[#008AD1] text-white rounded-br-none'
                  : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
              }`}
            >
              {/* Image if present */}
              {message.image && (
                <div className="mb-2 rounded-lg overflow-hidden max-w-xs">
                  <img src={message.image} alt="Attached" className="w-full h-auto" />
                </div>
              )}
              
              {/* Text content */}
              <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
                {message.role === 'assistant' ? renderFormattedText(message.content) : message.content}
              </div>

              {/* Message actions */}
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                    title="Copy"
                  >
                    <Copy size={14} />
                    {copiedId === message.id ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => speakText(message.content, message.id, message.languageCode)}
                    className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                      speakingId === message.id
                        ? 'text-blue-600 bg-blue-50 font-bold'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title={speakingId === message.id ? 'Stop reading' : 'Read aloud'}
                  >
                    {speakingId === message.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    {speakingId === message.id ? 'Stop' : 'Read'}
                  </button>
                </div>
              )}
            </div>

            {message.role === 'user' && <UserAvatar />}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <AssistantAvatar />
            <div className="bg-white rounded-2xl rounded-bl-none px-4 md:px-5 py-3 md:py-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin text-[#008AD1]" />
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {showImagePreview && selectedImage && (
        <div className="px-4 md:px-6 pb-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Image size={16} className="text-[#008AD1]" />
              Attached Image
            </p>
            <button
              onClick={removeImage}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="rounded-lg overflow-hidden max-w-xs border border-gray-200">
            <img src={selectedImage} alt="Preview" className="w-full h-auto" />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4 md:p-6 shadow-lg">
        <div className="space-y-3">
          {/* Input Form */}
          <div className="relative flex items-end border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-[#008AD1] focus-within:border-transparent bg-white overflow-hidden">
              {/* Text Input */}
              <textarea
                value={inputValue}
                onChange={(e) => {
                  detectedVoiceLanguageRef.current = 'auto';
                  setInputValue(e.target.value);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Describe your symptoms or ask a health question..."
                className="flex-1 px-4 py-2 border-none focus:outline-none resize-none bg-transparent"
                rows={1}
                disabled={loading}
              />

              {/* Action Buttons inside input */}
              <div className="flex items-center gap-2 p-2 self-end">
                {/* Image Upload */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="p-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 rounded-lg transition-colors"
                  title="Upload image"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* Mic Button - Speech to Text only */}
                <button
                  onClick={isRecording ? handleVoiceStop : handleVoiceStart}
                  disabled={loading || isVoiceRecording}
                  className={`p-2.5 rounded-full transition-all shadow-md ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white scale-110 animate-pulse'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Speech to text'}
                >
                  <Mic size={20} strokeWidth={2} />
                </button>

                {/* Voice Converse Button - Talk to AI Doctor */}
                <div className="relative flex items-center gap-1">
                  <button
                    onClick={isVoiceRecording ? stopVoiceConverse : voiceConverseMode ? cancelVoiceConverse : startVoiceConverse}
                    disabled={loading || isRecording}
                    className={`p-2.5 rounded-full transition-all shadow-md ${
                      isVoiceRecording
                        ? 'bg-purple-500 hover:bg-purple-600 text-white scale-110 animate-pulse'
                        : voiceConverseMode
                          ? 'bg-purple-100 hover:bg-purple-200 text-purple-700 ring-2 ring-purple-400'
                          : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 disabled:opacity-50'
                    }`}
                    title={isVoiceRecording ? 'Stop & send to AI' : voiceConverseMode ? 'Cancel voice converse' : 'Voice converse with AI'}
                  >
                    <AudioLines size={20} strokeWidth={2} />
                  </button>
                  {autoSubmitCountdown > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                      {autoSubmitCountdown}
                    </span>
                  )}
                </div>

                {/* Send Button */}
                <button
                  onClick={() => { cancelVoiceConverse(); sendMessage(); }}
                  disabled={loading || (!inputValue.trim() && !imageFile)}
                  className="p-2.5 bg-[#008AD1] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-all shadow-md hover:shadow-lg"
                  title="Send message"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Press Shift+Enter for new line</span>
            <button
              onClick={downloadTranscript}
              className="flex items-center gap-1 hover:text-gray-700 px-3 py-1 hover:bg-gray-100 rounded transition-colors"
            >
              <Download size={14} />
              Download Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
