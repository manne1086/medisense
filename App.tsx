
import React, { useState, useEffect } from 'react';
import { ModuleTriage } from './components/ModuleTriage';
import { ModuleAnalysis } from './components/ModuleAnalysis';
import { ModulePrescription } from './components/ModulePrescription';
import { FloatingAssistant } from './components/FloatingAssistant';
import { AlertTriangle, Activity, FileText, Pill } from './components/Icons';
import { Login } from './components/Login';
import { isAuthenticated, handleAuthCallback, logout } from './services/authService';

function App() {
  const [activeTab, setActiveTab] = useState<'triage' | 'analysis' | 'prescription'>('triage');
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    if (handleAuthCallback()) {
      setIsAuth(true);
    } else {
      setIsAuth(isAuthenticated());
    }
  }, []);

  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
        <Login />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-800 pb-20 relative overflow-x-hidden selection:bg-blue-200 selection:text-blue-900 font-sans">
      
      {/* Background Shapes matching reference image */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Left Dark Blue Shape */}
        <svg 
          className="absolute top-[10%] -left-[10%] w-[80vw] h-[80vh] md:w-[50vw] md:h-[90vh] text-[#008AD1] opacity-90" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0 100 V 20 Q 30 0 60 40 T 40 100 Z" />
        </svg>

         {/* Additional blob to smooth the left shape */}
        <div className="absolute top-[25%] -left-[5%] w-[40vw] h-[40vw] bg-[#008AD1] rounded-full mix-blend-multiply filter blur-3xl opacity-50 md:hidden"></div>

        {/* Right Light Blue Shape */}
        <svg 
          className="absolute top-0 right-0 w-[60vw] h-[100vh] text-blue-50 -z-10" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M100 0 V 100 H 60 C 20 80 0 50 60 20 C 80 10 90 0 100 0 Z" />
        </svg>

        {/* Floating circles/dots from the image */}
        <div className="hidden md:flex gap-3 absolute bottom-10 left-1/2 transform -translate-x-1/2">
            <div className="w-3 h-3 rounded-full bg-[#008AD1]"></div>
            <div className="w-3 h-3 rounded-full bg-blue-200"></div>
            <div className="w-3 h-3 rounded-full bg-blue-100"></div>
            <div className="w-3 h-3 rounded-full bg-blue-50"></div>
            <div className="w-3 h-3 rounded-full bg-blue-50"></div>
        </div>
      </div>

      {/* Disclaimer Banner */}
      <div className="bg-red-500/90 text-white text-xs sm:text-sm p-2 text-center backdrop-blur-sm sticky top-0 z-40 shadow-md flex items-center justify-center gap-2">
        <AlertTriangle size={16} />
        <span className="font-medium">MEDICAL DISCLAIMER: This is an AI tool. Not a diagnosis. Consult a doctor immediately for emergencies.</span>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl relative z-10">
        {/* Header */}
        <header className="mb-10 text-center space-y-3 relative">
          <button 
            onClick={logout}
            className="absolute right-0 top-0 text-xs font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors"
          >
            Logout
          </button>
          <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur px-4 py-2 rounded-full border border-white/60 shadow-sm mb-2">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
             <span className="text-xs font-semibold text-gray-600 tracking-wide uppercase">System Online • HIPAA Mode Active</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#008AD1] drop-shadow-sm">
            MediSense AI
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto font-medium">
            Agentic Diagnostic Assistant utilizing Multimodal Triage and Predictive Risk Scoring.
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-10">
            <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-1 shadow-lg border border-white/60 overflow-x-auto max-w-full bg-white/60 backdrop-blur-xl">
                <button
                    onClick={() => setActiveTab('triage')}
                    className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'triage' 
                        ? 'bg-[#008AD1] text-white shadow-md' 
                        : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                    }`}
                >
                    <Activity size={18} />
                    AI Doctor
                </button>
                <button
                    onClick={() => setActiveTab('analysis')}
                    className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'analysis' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                    }`}
                >
                    <FileText size={18} />
                    Report Analysis
                </button>
                <button
                    onClick={() => setActiveTab('prescription')}
                    className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'prescription' 
                        ? 'bg-teal-600 text-white shadow-md' 
                        : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                    }`}
                >
                    <Pill size={18} />
                    Prescriptions
                </button>
            </div>
        </div>

        {/* Tab Content Area */}
        <div className="min-h-[600px]">
            {activeTab === 'triage' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
                    <ModuleTriage />
                </div>
            )}
            {activeTab === 'analysis' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
                    <ModuleAnalysis />
                </div>
            )}
            {activeTab === 'prescription' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
                    <ModulePrescription />
                </div>
            )}
        </div>

      </main>

      {/* Floating Widget */}
      <FloatingAssistant />

    </div>
  );
}

export default App;
