import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Paperclip, Mic, X, Loader2, AlertCircle, Image, Copy, Download, Volume2
} from 'lucide-react';
import { chatWithAssistant, analyzeSymptoms } from '../services/grokService';
import { getHistory } from '../services/storageService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
}

export const AIDoctor: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hello! 👋 I\'m your AI Medical Assistant. I can help you with health concerns, explain medical symptoms, and provide general health guidance. Please describe your symptoms or ask any health-related questions.\n\n⚠️ Note: This is not a substitute for professional medical advice. Always consult a qualified doctor for serious concerns.',
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceIconRef = useRef<SVGSVGElement>(null);

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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
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

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      // For now, using placeholder transcription
      // In production, integrate with a speech-to-text service
      const alertMsg = `Voice feature requires integration with a speech-to-text service like:
- Google Cloud Speech-to-Text
- Azure Speech Services
- AssemblyAI

For now, please type your message or paste transcribed text.`;
      
      console.log('Audio recorded, would transcribe:', audioBlob.size, 'bytes');
      alert('Voice transcription requires API setup. Please type your message instead.');
    } catch (error) {
      console.error('Transcription error:', error);
      alert('Failed to transcribe audio');
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() && !imageFile) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue || '📸 Image attachment',
      image: selectedImage || undefined,
      timestamp: new Date()
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
        const result = await analyzeSymptoms(inputValue, base64Image, mimeType, activeLanguage);
        assistantResponse = result.text || 'I received your image. Please describe what you need help with.';
      } else if (inputValue.trim()) {
        // Regular chat message
        const result = await chatWithAssistant(
          messages.map(m => ({
            role: m.role,
            text: m.content
          })),
          inputValue,
          medicalRecords
        );
        assistantResponse = result;
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
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
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">🏥 AI Medical Assistant</h2>
            <p className="text-sm md:text-base text-blue-100 mt-1">Chat with your virtual doctor</p>
          </div>
          <div className="text-right text-xs md:text-sm space-y-1">
            <div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
        
        {/* Language Selector */}
        <div className="flex gap-2 flex-wrap">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setActiveLanguage(lang.code)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeLanguage === lang.code
                  ? 'bg-white text-[#008AD1] shadow-md'
                  : 'bg-white/30 text-white hover:bg-white/40'
              }`}
            >
              {lang.label}
            </button>
          ))}
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
            {message.role === 'assistant' && (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#008AD1] to-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                🤖
              </div>
            )}
            
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
              <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>

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
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                    title="Read aloud"
                  >
                    <Volume2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                👤
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#008AD1] to-blue-600 flex items-center justify-center text-white flex-shrink-0">
              🤖
            </div>
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
            <p className="text-sm font-medium text-gray-700">📎 Attached Image</p>
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
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Describe your symptoms or ask a health question..."
                className="flex-1 px-4 py-3 border-none focus:outline-none resize-none bg-transparent"
                rows={3}
                disabled={loading}
              />

              {/* Action Buttons inside input */}
              <div className="flex items-center gap-1 p-2 self-end">
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

                {/* Voice Input */}
                <button
                  onClick={isRecording ? handleVoiceStop : handleVoiceStart}
                  disabled={loading}
                  className={`p-2 rounded-lg transition-colors ${
                    isRecording
                      ? 'bg-red-100 hover:bg-red-200 text-red-600'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  <Mic size={18} ref={voiceIconRef} />
                </button>

                {/* Send Button */}
                <button
                  onClick={sendMessage}
                  disabled={loading || (!inputValue.trim() && !imageFile)}
                  className="p-2 bg-[#008AD1] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-md hover:shadow-lg"
                  title="Send message"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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
