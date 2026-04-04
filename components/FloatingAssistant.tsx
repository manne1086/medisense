import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Stethoscope, Mic, Upload } from './Icons';
import { chatWithAssistant } from '../services/grokService';
import { ChatMessage } from '../types';

export const FloatingAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', role: 'model', text: 'Hello, I am MediSense. How can I assist you today?', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const responseText = await chatWithAssistant(history, userMsg.text);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "I'm having trouble connecting.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[500px] transition-all duration-300 origin-bottom-right animate-in fade-in slide-in-from-bottom-10">
          {/* Header */}
          <div className="bg-primary/90 text-white p-4 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Stethoscope size={18} />
              <span className="font-semibold">MediSense Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full">
              <X size={18} />
            </button>
          </div>

          {/* Chat Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-white/40" ref={scrollRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-white text-gray-800 shadow-sm rounded-tl-none border border-white/60'
                  }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/50 p-3 rounded-2xl rounded-tl-none border border-white/60">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 bg-white/60 border-t border-white/50">
            <div className="flex items-center gap-0 bg-white/80 rounded-xl px-1 py-1 border-none focus-within:ring-2 focus-within:ring-primary/50">
              <button className="p-2 text-gray-400 hover:text-primary transition-colors">
                <Upload size={18} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about your health..."
                className="flex-1 bg-transparent border-none px-2 py-2 text-sm outline-none placeholder:text-gray-400"
              />
              <button className="p-2 text-gray-400 hover:text-primary transition-colors">
                <Mic size={18} />
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-white p-2 rounded-lg transition-colors disabled:opacity-50 mr-1"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-red-500 rotate-90 scale-0 opacity-0 absolute' : 'bg-primary hover:scale-110 animate-float'
          }`}
      >
        <MessageCircle color="white" size={28} />
      </button>

      {/* Close State Trigger (Visual swap) */}
      {isOpen && (
        <button
          onClick={() => setIsOpen(false)}
          className="w-12 h-12 bg-white/80 backdrop-blur text-gray-600 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-all"
        >
          <X size={24} />
        </button>
      )}
    </div>
  );
};