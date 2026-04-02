import React, { useEffect, useRef, useState } from 'react';
import {
  startAudioCapture,
  transcribeAudio,
  speakText,
  stopSpeaking,
  type AudioCaptureSession,
} from '../services/sarvamService';
import { TriageResult } from '../types';

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'speaking' | 'error';

interface VoiceButtonProps {
  onTranscript: (text: string, languageCode: string) => void;
  onRequestTriage: (text: string, languageCode: string) => void;
  triageResult: TriageResult | null;
  iconOnly?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onTranscript,
  onRequestTriage,
  triageResult,
  iconOnly = false,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const recordingSessionRef = useRef<AudioCaptureSession | null>(null);
  const waitingForTriageRef = useRef(false);
  const lastTriageResultRef = useRef<TriageResult | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    if (
      triageResult &&
      triageResult !== lastTriageResultRef.current &&
      waitingForTriageRef.current
    ) {
      lastTriageResultRef.current = triageResult;
      waitingForTriageRef.current = false;
      setVoiceState('speaking');
      speakText(triageResult.text, triageResult.language_code)
        .finally(() => setVoiceState('idle'));
    }
  }, [triageResult]);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
      }

      if (recordingSessionRef.current) {
        void recordingSessionRef.current.cancel();
        recordingSessionRef.current = null;
      }

      stopSpeaking();
    };
  }, []);

  const showError = (msg: string) => {
    if (errorTimeoutRef.current !== null) {
      window.clearTimeout(errorTimeoutRef.current);
    }

    waitingForTriageRef.current = false;
    setVoiceState('error');
    setErrorMsg(msg);
    errorTimeoutRef.current = window.setTimeout(() => {
      setVoiceState('idle');
      setErrorMsg('');
      errorTimeoutRef.current = null;
    }, 4000);
  };

  const processAudio = async (audioBlob: Blob) => {
    const result = await transcribeAudio(audioBlob);
    if (!result.text.trim()) {
      showError('No speech detected - please try again.');
      return;
    }

    const detectedLanguage = result.languageCode || 'auto';
    onTranscript(result.text, detectedLanguage);
    waitingForTriageRef.current = true;
    onRequestTriage(result.text, detectedLanguage);
  };

  const startRecording = async () => {
    setErrorMsg('');

    if (!window.isSecureContext) {
      showError('Microphone capture needs HTTPS or localhost.');
      return;
    }

    try {
      const session = await startAudioCapture();
      recordingSessionRef.current = session;
      setVoiceState('recording');
    } catch (err: any) {
      console.error('Mic Error:', err);

      if (err.name === 'NotAllowedError') {
        showError('Microphone access denied - allow mic in browser settings.');
        return;
      }

      if (err.name === 'NotFoundError') {
        showError('No microphone found. Connect one and try again.');
        return;
      }

      showError(err.message || 'Microphone setup failed.');
    }
  };

  const stopRecording = async () => {
    const session = recordingSessionRef.current;
    if (!session || isStoppingRef.current) {
      return;
    }

    isStoppingRef.current = true;
    recordingSessionRef.current = null;
    setVoiceState('transcribing');

    try {
      const audioBlob = await session.stop();
      await processAudio(audioBlob);
    } catch (err: any) {
      console.error('STT Error:', err);
      showError(err.message || 'Transcription failed.');
    } finally {
      isStoppingRef.current = false;
    }
  };

  const handleStop = () => {
    stopSpeaking();
    waitingForTriageRef.current = false;
    setVoiceState('idle');
  };

  const handleClick = () => {
    if (voiceState === 'idle' || voiceState === 'error') {
      void startRecording();
      return;
    }

    if (voiceState === 'recording') {
      void stopRecording();
    }
  };

  const stateConfig: Record<VoiceState, { label: string; color: string; pulse: boolean }> = {
    idle: { label: 'Speak Symptoms', color: 'bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700', pulse: false },
    recording: { label: 'Tap to Stop', color: 'bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700', pulse: true },
    transcribing: { label: 'Transcribing...', color: 'bg-gradient-to-br from-amber-400 to-orange-500', pulse: false },
    speaking: { label: 'AI Speaking...', color: 'bg-gradient-to-br from-teal-500 to-cyan-600', pulse: true },
    error: { label: 'Try Again', color: 'bg-gradient-to-br from-gray-400 to-gray-500', pulse: false },
  };

  const cfg = stateConfig[voiceState];
  const isDisabled = voiceState === 'transcribing';

  if (iconOnly) {
    const iconColorMap: Record<VoiceState, string> = {
      idle: 'text-gray-400 hover:text-violet-500 hover:bg-violet-50',
      recording: 'text-red-500 bg-red-50 hover:bg-red-100',
      transcribing: 'text-amber-500 bg-amber-50',
      speaking: 'text-teal-500 bg-teal-50 hover:bg-teal-100',
      error: 'text-red-400 hover:text-red-600 hover:bg-red-50',
    };

    return (
      <div className="relative flex items-center">
        <button
          onClick={voiceState === 'speaking' ? handleStop : handleClick}
          disabled={isDisabled}
          title={errorMsg || cfg.label}
          className={`
            relative flex items-center justify-center w-8 h-8 rounded-lg
            transition-all duration-200 active:scale-90
            disabled:opacity-50 disabled:active:scale-100
            ${iconColorMap[voiceState]}
          `}
        >
          {cfg.pulse && (
            <span className="absolute inset-0 rounded-lg animate-ping opacity-20 bg-current pointer-events-none" />
          )}
          {voiceState === 'speaking' ? <StopIcon /> : <MicIcon state={voiceState} />}
        </button>
        {voiceState === 'error' && errorMsg && (
          <span className="absolute bottom-full mb-3 right-0 md:-right-8 text-sm text-red-500 bg-white border border-red-200 rounded-full px-4 py-1.5 whitespace-nowrap shadow-sm z-50">
            {errorMsg}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-3">
        <button
          onClick={voiceState === 'speaking' ? handleStop : handleClick}
          disabled={isDisabled}
          title={cfg.label}
          className={`
            relative flex items-center gap-2 text-sm font-medium text-white
            px-4 py-2 rounded-xl border border-white/20 shadow-lg shadow-purple-500/20
            transition-all duration-300 active:scale-95
            disabled:opacity-60 disabled:active:scale-100
            ${cfg.color}
          `}
        >
          {cfg.pulse && (
            <span className="absolute inset-0 rounded-xl animate-ping opacity-30 bg-white pointer-events-none" />
          )}
          <MicIcon state={voiceState} />
          <span>{cfg.label}</span>
        </button>
      </div>
      {voiceState === 'error' && errorMsg && (
        <p className="text-xs text-red-500 mt-0.5 pl-1">{errorMsg}</p>
      )}
    </div>
  );
};

const MicIcon: React.FC<{ state: VoiceState }> = ({ state }) => {
  if (state === 'transcribing') {
    return (
      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    );
  }

  if (state === 'speaking') {
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
      </svg>
    );
  }

  return (
    <svg className={`w-4 h-4 ${state === 'recording' ? 'animate-pulse' : ''}`} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 15c1.66 0 3-1.34 3-3V6a3 3 0 00-6 0v6c0 1.66 1.34 3 3 3zm-1-9a1 1 0 012 0v6a1 1 0 01-2 0V6zm6.91 6H17a5 5 0 01-10 0H5.09A6.978 6.978 0 0011 18.93V21H9v2h6v-2h-2v-2.07A6.978 6.978 0 0018.91 12z" />
    </svg>
  );
};

const StopIcon: React.FC = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
