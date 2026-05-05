import React from 'react';
import { loginWithGoogle } from '../services/authService';
import { AlertCircle } from './Icons';

export const LandingPage: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="bg-background font-body-md text-on-background selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      {/* TopAppBar */}
      <header className="bg-white/70 backdrop-blur-2xl font-epilogue antialiased tracking-tight docked full-width top-0 sticky z-50 border-b border-white/20 shadow-[0_4px_24px_rgba(0,82,255,0.04)]">
        {message && (
          <div className="bg-red-50 p-3 flex items-center justify-center gap-2 text-red-700 text-sm font-semibold">
            <AlertCircle size={18} className="shrink-0" />
            <span>{message}</span>
          </div>
        )}
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <div className="text-2xl font-black text-primary tracking-tighter">MediSense</div>

          <button onClick={loginWithGoogle} className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-full font-bold active:scale-95 transition-all duration-200 shadow-lg flex items-center gap-2">
            <img alt="Google icon" className="w-5 h-5" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" />
            Continue with Google
          </button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center overflow-hidden">
          <div className="lg:col-span-6 space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-container text-primary font-label-sm uppercase tracking-widest">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              Clinical Grade AI
            </div>
            <h1 className="font-h1 text-h1 text-on-surface leading-tight">
              Your AI Medical Companion for a <span className="text-primary">Healthier Tomorrow</span>
            </h1>
            <p className="text-body-lg text-secondary max-w-xl">
              Securely store, analyze, and understand your health data with clinical-grade AI. Get instant summaries and long-term trend insights.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={loginWithGoogle} className="bg-primary text-white px-8 py-4 rounded-full font-bold text-lg active:scale-95 transition-all flex items-center gap-3 shadow-xl hover:shadow-primary/20">
                <img alt="Google icon" className="w-6 h-6 brightness-0 invert" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" />
                Continue with Google
              </button>
              <button className="glass-card px-8 py-4 rounded-full font-bold text-lg text-primary active:scale-95 transition-all flex items-center gap-2">
                View Technology
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
          <div className="lg:col-span-6 relative">
            {/* Asymmetric Floating Cards */}
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-surface-container-high/50 border-4 border-white shadow-2xl">
              <img className="w-full h-full object-cover opacity-40" alt="Medical aesthetic" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB8u9PoVg5rTLP__yZjZGUOu6NhAGhoiYS7t3ARlDluyNhgznfsge71iBlDbDKiP_1xJv-zNolwT_5GkFYemVrdBPrIUDYPPy97W3e1XqEtQqx3ZwQvBrtBdcVSZkBOVWYCOcgm5JvaFYfbkJDuOfq_GnnrFuBirV6icnI2QImzQmUmesPN_yUbO9PFTE7GPnXLqtY-AWUY3vYm6ftv59BTWSS2LkvmjgeU0wP69WaUtmaNLFo7TLRjKljH2gaHbZCtc1wpQhV8h5o" />
              {/* Glassmorphism Overlays */}
              <div className="absolute top-12 left-8 glass-card rounded-lg p-6 w-72 transform -rotate-3 z-10 inner-highlight">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-primary font-bold">Biomarkers</span>
                  <span className="text-tertiary text-xs bg-tertiary-container/10 px-2 py-1 rounded">Optimal</span>
                </div>
                <div className="space-y-4">
                  <div className="h-12 w-full bg-surface-container rounded-md relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-full h-2/3 bg-primary/20 rounded-t-sm"></div>
                    <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-primary rounded-t-sm"></div>
                  </div>
                  <p className="text-sm font-semibold text-on-surface-variant">Hemoglobin A1c: 5.4%</p>
                </div>
              </div>
              <div className="absolute bottom-12 right-8 glass-card rounded-lg p-6 w-80 transform rotate-2 z-20 inner-highlight">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white">
                    <span className="material-symbols-outlined">smart_toy</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">MediSense AI</p>
                    <p className="text-xs text-secondary">Always Online</p>
                  </div>
                </div>
                <div className="bg-surface-container-low p-3 rounded-lg text-sm mb-2 text-on-surface-variant">
                  "Based on your latest report, your lipid profile shows marked improvement. Should we track your fiber intake?"
                </div>
                <div className="bg-primary-container text-on-primary-container p-3 rounded-lg text-sm self-end ml-8">
                  "Yes, please add that to my tracking."
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="max-w-7xl mx-auto px-6 py-section-gap">
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-h2 text-h2 text-on-surface">Simplified Clinical Intelligence</h2>
            <p className="text-secondary max-w-2xl mx-auto">Three steps to a more informed version of your health journey.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-6 group">
              <div className="w-20 h-20 bg-surface-container-high rounded-xl flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-primary text-4xl">login</span>
              </div>
              <h3 className="font-h3 text-h3">1. Sign In</h3>
              <p className="text-secondary">Instant access using your secure Google account. No complex registration.</p>
            </div>
            <div className="text-center space-y-6 group">
              <div className="w-20 h-20 bg-surface-container-high rounded-xl flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-primary text-4xl">upload_file</span>
              </div>
              <h3 className="font-h3 text-h3">2. Upload Records</h3>
              <p className="text-secondary">Drop PDFs, photos, or prescriptions. Our AI extracts every data point.</p>
            </div>
            <div className="text-center space-y-6 group">
              <div className="w-20 h-20 bg-surface-container-high rounded-xl flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <span className="material-symbols-outlined text-primary text-4xl">insights</span>
              </div>
              <h3 className="font-h3 text-h3">3. Get AI Insights</h3>
              <p className="text-secondary">Receive clear summaries, risk assessments, and biomarker trends.</p>
            </div>
          </div>
        </section>

        {/* Visual Analytics Section */}
        <section className="max-w-7xl mx-auto px-6 py-section-gap overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="font-h2 text-h2">Visualize Your Path to Vitality</h2>
              <p className="text-body-lg text-secondary">MediSense transforms rows of data into beautiful, actionable charts. Understand how your cholesterol, glucose, and hormone levels interact across years of data.</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-tertiary-container mt-1">check_circle</span>
                  <div>
                    <p className="font-bold">Automated Trend Lines</p>
                    <p className="text-secondary">See where you're headed before you get there.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-tertiary-container mt-1">check_circle</span>
                  <div>
                    <p className="font-bold">Inter-Biomarker Correlation</p>
                    <p className="text-secondary">How your weight gain affects your blood pressure.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative bg-white p-8 rounded-lg shadow-2xl border border-surface-container-high">
              <div className="flex items-center justify-between mb-8">
                <h5 className="font-bold text-lg">Health Snapshot: 2024</h5>
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <div className="w-3 h-3 rounded-full bg-secondary"></div>
                </div>
              </div>
              {/* Mock Analytics Chart */}
              <div className="space-y-8">
                <div className="h-48 flex items-end justify-between gap-4">
                  <div className="w-full bg-primary/10 rounded-t-lg relative" style={{ height: '60%' }}>
                    <div className="absolute inset-x-0 bottom-0 bg-primary/40 rounded-t-lg" style={{ height: '70%' }}></div>
                  </div>
                  <div className="w-full bg-primary/10 rounded-t-lg relative" style={{ height: '80%' }}>
                    <div className="absolute inset-x-0 bottom-0 bg-primary/40 rounded-t-lg" style={{ height: '85%' }}></div>
                  </div>
                  <div className="w-full bg-primary/10 rounded-t-lg relative" style={{ height: '50%' }}>
                    <div className="absolute inset-x-0 bottom-0 bg-primary/40 rounded-t-lg" style={{ height: '40%' }}></div>
                  </div>
                  <div className="w-full bg-primary/10 rounded-t-lg relative" style={{ height: '90%' }}>
                    <div className="absolute inset-x-0 bottom-0 bg-primary/40 rounded-t-lg" style={{ height: '95%' }}></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-container rounded-lg">
                    <p className="text-xs text-secondary mb-1">HbA1c Trend</p>
                    <p className="text-xl font-bold text-primary">-0.4% &darr;</p>
                  </div>
                  <div className="p-4 bg-surface-container rounded-lg">
                    <p className="text-xs text-secondary mb-1">Vitamin D</p>
                    <p className="text-xl font-bold text-tertiary-container">+15% &uarr;</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Trust */}
        <section className="bg-surface py-20">
          <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center items-center gap-12 opacity-80 grayscale hover:grayscale-0 transition-all">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-secondary">google</span>
              <span className="font-bold text-secondary">Secure Google Sign-in</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-secondary">lock</span>
              <span className="font-bold text-secondary">End-to-End Encrypted</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-secondary">health_and_safety</span>
              <span className="font-bold text-secondary">HIPAA Compliant Standards</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-secondary">verified</span>
              <span className="font-bold text-secondary">GDPR Protected</span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-5xl mx-auto px-6 py-section-gap text-center">
          <div className="glass-card p-16 rounded-lg inner-highlight relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-tertiary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            <h2 className="font-h1 text-h1 mb-6">Ready to decode your health?</h2>
            <p className="text-body-lg text-secondary mb-10 max-w-2xl mx-auto">Join thousands of proactive patients using MediSense to manage their medical journey with precision and clarity.</p>
            <div className="flex justify-center">
              <button onClick={loginWithGoogle} className="bg-primary text-white px-10 py-5 rounded-full font-bold text-xl active:scale-95 transition-all flex items-center gap-4 shadow-2xl hover:shadow-primary/40">
                <img alt="Google icon" className="w-7 h-7 brightness-0 invert" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" />
                Continue with Google
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 font-epilogue text-sm leading-relaxed full-width rounded-t-[48px] border-t border-slate-200">
        <div className="w-full px-8 py-16 mt-20 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="text-xl font-bold text-primary">MediSense</div>
            <p className="text-slate-500 max-w-md">
              &copy; 2024 MediSense AI. Clinical intelligence for modern healthcare. Medical Disclaimer: MediSense provides AI-driven insights for informational purposes only and does not replace professional medical advice.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="flex flex-col gap-3">
              <p className="font-bold text-on-surface mb-2">Legal</p>
              <a className="text-slate-500 hover:text-primary transition-all cursor-pointer" href="#">Privacy Policy</a>
              <a className="text-slate-500 hover:text-primary transition-all cursor-pointer" href="#">Terms of Service</a>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-bold text-on-surface mb-2">Security</p>
              <a className="text-slate-500 hover:text-primary transition-all cursor-pointer" href="#">Security Whitepaper</a>
              <a className="text-slate-500 hover:text-primary transition-all cursor-pointer" href="#">HIPAA Compliance</a>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-bold text-on-surface mb-2">Region</p>
              <a className="text-slate-500 hover:text-primary transition-all cursor-pointer" href="#">GDPR</a>
              <a className="text-slate-500 hover:text-primary transition-all cursor-pointer" href="#">India (Local)</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
