const API_KEY = import.meta.env.VITE_SARVAM_API_KEY as string;

const TARGET_SAMPLE_RATE = 16000;
const RECORDING_BUFFER_SIZE = 4096;

let currentAudio: HTMLAudioElement | null = null;

type WebkitWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const getAudioContextConstructor = (): typeof AudioContext | null => {
  return window.AudioContext ?? (window as WebkitWindow).webkitAudioContext ?? null;
};

export const stopSpeaking = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
};

const isKeyMissing = () =>
  !API_KEY || API_KEY === 'your_sarvam_key_here';

export interface AudioCaptureSession {
  stop: () => Promise<Blob>;
  cancel: () => Promise<void>;
}

export const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return '';
};

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (outputSampleRate >= inputSampleRate) {
    return buffer;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count += 1;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function encodeMonoWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const pcmValue = sample < 0 ? sample * 32768 : sample * 32767;
    view.setInt16(offset, pcmValue, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function audioBufferTo16kHzWav(audioBuffer: AudioBuffer): Blob {
  const monoSamples = new Float32Array(audioBuffer.length);

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < audioBuffer.length; i++) {
      monoSamples[i] += channelData[i] / audioBuffer.numberOfChannels;
    }
  }

  const outputSampleRate =
    audioBuffer.sampleRate > TARGET_SAMPLE_RATE
      ? TARGET_SAMPLE_RATE
      : audioBuffer.sampleRate;
  const normalizedSamples =
    outputSampleRate === audioBuffer.sampleRate
      ? monoSamples
      : downsampleBuffer(monoSamples, audioBuffer.sampleRate, outputSampleRate);

  return encodeMonoWav(normalizedSamples, outputSampleRate);
}

export const startAudioCapture = async (): Promise<AudioCaptureSession> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone capture is not supported in this browser.');
  }

  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) {
    throw new Error('This browser cannot process microphone audio.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(RECORDING_BUFFER_SIZE, 1, 1);
  const mutedOutput = audioContext.createGain();
  const recordedChunks: Float32Array[] = [];

  mutedOutput.gain.value = 0;
  processor.onaudioprocess = (event) => {
    const samples = event.inputBuffer.getChannelData(0);
    recordedChunks.push(new Float32Array(samples));
  };

  source.connect(processor);
  processor.connect(mutedOutput);
  mutedOutput.connect(audioContext.destination);
  await audioContext.resume().catch(() => undefined);

  let closed = false;
  const cleanup = async () => {
    if (closed) {
      return;
    }

    closed = true;
    processor.onaudioprocess = null;

    try {
      source.disconnect();
    } catch {}

    try {
      processor.disconnect();
    } catch {}

    try {
      mutedOutput.disconnect();
    } catch {}

    stream.getTracks().forEach((track) => track.stop());

    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined);
    }
  };

  return {
    stop: async () => {
      const inputSampleRate = audioContext.sampleRate;
      await cleanup();

      const mergedSamples = mergeChunks(recordedChunks);
      if (!mergedSamples.length) {
        throw new Error('No microphone audio captured. Please try again.');
      }

      const normalizedSamples =
        inputSampleRate > TARGET_SAMPLE_RATE
          ? downsampleBuffer(mergedSamples, inputSampleRate, TARGET_SAMPLE_RATE)
          : mergedSamples;
      const outputSampleRate =
        inputSampleRate > TARGET_SAMPLE_RATE ? TARGET_SAMPLE_RATE : inputSampleRate;

      return encodeMonoWav(normalizedSamples, outputSampleRate);
    },
    cancel: cleanup,
  };
};

async function convertTo16kHzWav(blob: Blob): Promise<Blob> {
  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) {
    throw new Error('Browser audio decoder unavailable.');
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContextClass();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return audioBufferTo16kHzWav(audioBuffer);
  } finally {
    if (audioContext.state !== 'closed') {
      await audioContext.close().catch(() => undefined);
    }
  }
}

function isWavBlob(blob: Blob): boolean {
  return blob.type.includes('wav');
}

function getAudioExtension(mimeType: string): string {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('webm')) return 'webm';
  return 'bin';
}

async function prepareAudioForStt(audioBlob: Blob): Promise<File> {
  if (!audioBlob.size) {
    throw new Error('Recorded audio is empty. Please speak for a moment and try again.');
  }

  let uploadBlob = audioBlob;
  let fileName = `recording.${getAudioExtension(audioBlob.type)}`;

  if (!isWavBlob(audioBlob)) {
    try {
      uploadBlob = await convertTo16kHzWav(audioBlob);
      fileName = 'recording.wav';
    } catch (error) {
      console.warn('[Sarvam STT] WAV conversion failed, uploading original blob.', error);
    }
  }

  return new File(
    [uploadBlob],
    fileName,
    { type: uploadBlob.type || audioBlob.type || 'application/octet-stream' }
  );
}

export interface STTResult {
  text: string;
  languageCode?: string;
}

export const transcribeAudio = async (audioBlob: Blob): Promise<STTResult> => {
  if (isKeyMissing()) {
    throw new Error('Sarvam API key not configured. Add VITE_SARVAM_API_KEY to .env.local');
  }

  const file = await prepareAudioForStt(audioBlob);

  console.log(`[Sarvam STT] Uploading ${file.type || 'audio blob'}: size=${file.size} bytes`);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'saaras:v3');

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': API_KEY },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`STT failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return {
    text: data.transcript || '',
    languageCode: data.language_code || data.language || '',
  };
};

function getSpeakerForLanguage(languageCode: string): string {
  const code = languageCode.toLowerCase();
  if (code.includes('hi')) return 'ritu';
  if (code.includes('te')) return 'shruti';
  if (code.includes('ta')) return 'kavya';
  if (code.includes('en')) return 'amelia';
  return 'ritu';
}

export const speakText = async (text: string, languageCode: string = 'en-IN'): Promise<void> => {
  if (isKeyMissing()) {
    console.warn('Sarvam API key not set. Skipping TTS.');
    return;
  }

  stopSpeaking();

  let targetLang = languageCode;
  if (!targetLang.includes('-')) {
    targetLang = `${targetLang}-IN`;
  }

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      target_language_code: targetLang,
      speaker: getSpeakerForLanguage(targetLang),
      speech_sample_rate: 16000,
      enable_preprocessing: true,
      model: 'bulbul:v3',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  if (!data.audios || data.audios.length === 0) {
    throw new Error('TTS failed: No audio returned from Sarvam API');
  }

  const binaryString = window.atob(data.audios[0]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'audio/wav' });

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;

  return new Promise((resolve) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
    audio.play().catch(() => resolve());
  });
};
