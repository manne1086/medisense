
import React from 'react';
import { loginWithGoogle } from '../services/authService';
import { Activity, AlertCircle } from './Icons';

export const Login: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-white/60 backdrop-blur-xl rounded-[3rem] border border-white/60 shadow-2xl">
      <div className="p-6 bg-[#008AD1] text-white rounded-3xl shadow-2xl mb-8 animate-bounce">
        <Activity size={48} />
      </div>
      <h2 className="text-4xl font-black text-gray-900 mb-4 text-center tracking-tight">Welcome to MediSense</h2>
      <p className="text-gray-500 mb-10 text-center max-w-sm font-medium leading-relaxed">
        Your AI-powered medical companion. Please sign in to securely store and analyze your health data.
      </p>

      {message && (
        <div className="mb-6 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 border border-red-100 max-w-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}
      
      <button
        onClick={loginWithGoogle}
        className="flex items-center gap-4 bg-white hover:bg-gray-50 text-gray-700 px-8 py-4 rounded-2xl font-bold shadow-xl border border-gray-100 transition-all hover:scale-105 active:scale-95"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg" alt="Google" className="w-6 h-6" />
        Continue with Google
      </button>

      <div className="mt-8 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Secure OAuth 2.0 Encryption</span>
      </div>
    </div>
  );
};
