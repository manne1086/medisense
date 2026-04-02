import React, { useState, useRef, useEffect } from 'react';
import { Stethoscope, Activity, MapPin, Loader2, Camera, X, AlertCircle, HeartPulse, Sparkles, MessageSquareHeart } from 'lucide-react';
import { analyzeSymptoms, findNearbyHospitals } from '../services/grokService';
import { TriageResult, SeverityLevel, Hospital } from '../types';
import { CriticalCareWidget } from './CriticalCareWidget';
import { VoiceButton } from './VoiceButton';

export const ModuleTriage: React.FC = () => {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // Latest language returned by speech-to-text for voice-triggered triage.
  const [detectedLanguage, setDetectedLanguage] = useState('auto');
  const symptomsRef = useRef('');
  const detectedLanguageRef = useRef('auto');
  // Tracks whether the latest triage was voice-triggered (so VoiceButton can read result aloud)
  const voiceTriggeredRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const [voiceResult, setVoiceResult] = useState<TriageResult | null>(null);

  // Helper for async location fetching
  const getLocationAsync = (): Promise<{ lat: number, lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }),
        (error) => reject(error)
      );
    });
  };

  // Manual Location Trigger
  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const loc = await getLocationAsync();
      setUserLocation(loc);
    } catch (error) {
      console.error(error);
      alert("Unable to retrieve location. Please check browser permissions.");
    } finally {
      setLocating(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert("Please upload a valid image (JPEG, PNG, or WEBP).");
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Voice-triggered triage wrapper
  const handleVoiceTriage = (transcriptText: string, languageCode: string) => {
    symptomsRef.current = transcriptText;
    detectedLanguageRef.current = languageCode;
    voiceTriggeredRef.current = true;
    setSymptoms(transcriptText);
    setDetectedLanguage(languageCode);
    setVoiceResult(null);
    void handleTriage(languageCode, transcriptText);
  };

  const handleTriage = async (languageCode: string = 'auto', symptomsOverride?: string) => {
    const currentSymptoms = symptomsOverride ?? symptomsRef.current;
    if (!currentSymptoms && !imageFile) return;

    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    setResult(null);

    // START LOCATION REQUEST IMMEDIATELY (User Gesture)
    // We store the promise but don't await it yet. This ensures the browser prompt triggers now.
    let locPromise: Promise<{ lat: number, lng: number } | null> | null = null;
    if (!userLocation) {
      setLocating(true);
      locPromise = getLocationAsync()
        .then(loc => {
          setLocating(false);
          setUserLocation(loc); // Optimistic update
          return loc;
        })
        .catch(e => {
          console.warn("Location prompt dismissed or denied", e);
          setLocating(false);
          return null;
        });
    }

    try {
      let base64Image = undefined;
      let mimeType = undefined;

      if (imageFile && imagePreview) {
        base64Image = imagePreview.split(',')[1];
        mimeType = imageFile.type;
      }

      // 1. Clinical Analysis (with language hint for multilingual response)
      const data = await analyzeSymptoms(currentSymptoms, base64Image, mimeType, languageCode);

      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      // Only trigger emergency routing for explicit emergency severity.
      const isHighRisk = data.severity === SeverityLevel.EMERGENCY;

      // 2. High-Risk Geospatial Search
      if (isHighRisk) {
        let currentLoc = userLocation;

        // If we started a location request earlier, await it now
        if (!currentLoc && locPromise) {
          currentLoc = await locPromise;
        }

        if (currentLoc) {
          // Find hospitals via Gemini Maps Grounding
          const hospitals = await findNearbyHospitals(
            'Hospital or Emergency Room',
            currentLoc.lat,
            currentLoc.lng
          );
          // Attaching hospitals temporarily for backward UI compatibility if needed
          (data as any).hospitals = hospitals;
        }
      }

      setResult(data);
      // If voice-triggered, also update voiceResult to signal VoiceButton
      if (voiceTriggeredRef.current) {
        setVoiceResult(data);
        voiceTriggeredRef.current = false;
      }

    } catch (e) {
      if (requestId !== activeRequestIdRef.current) {
        return;
      }
      console.error(e);
      alert("Error analyzing symptoms. Please try again.");
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const getEmotionColor = (emotion: string | undefined) => {
    switch (emotion) {
      case 'alert': return 'border-red-500 bg-red-50 text-red-800';
      case 'friendly': return 'border-purple-500 bg-purple-50 text-purple-800';
      case 'calm': default: return 'border-blue-500 bg-blue-50 text-blue-800';
    }
  };

  const isCritical = result?.severity === SeverityLevel.EMERGENCY;
  const isUrgent = result?.severity === SeverityLevel.URGENT;
  const needsFollowUp = !!result?.needsFollowUp && (result?.followUpQuestions?.length ?? 0) > 0;

  return (
    <div className="glass-panel rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl border-t border-white/80 min-h-[600px] flex flex-col relative overflow-hidden group">
      {/* Dynamic ambient background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-blue-300/20 to-purple-400/10 rounded-full blur-3xl -z-10 animate-pulse group-hover:scale-105 transition-transform duration-1000" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] bg-gradient-to-tr from-cyan-300/20 to-blue-500/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="relative p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl text-blue-600 shadow-inner">
          <Activity size={24} className="animate-[pulse_3s_ease-in-out_infinite]" />
          <div className="absolute -top-1 -right-1">
            <Sparkles size={14} className="text-yellow-500 animate-[spin_4s_linear_infinite]" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-700">AI Doctor</h2>
          <p className="text-sm text-gray-500 font-medium">Multilingual Voice Agent</p>
        </div>

        {/* Location Status */}
        <div className="ml-auto">
          {!userLocation ? (
            <button
              onClick={handleGetLocation}
              disabled={locating}
              className="flex items-center gap-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-colors disabled:opacity-70"
            >
              {locating ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
              {locating ? "Locating..." : "Enable Location"}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-full border border-green-100">
              <MapPin size={12} />
              Location Active
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col space-y-4">
        {/* Input bar with icons inside */}
        <div className="relative">
          <textarea
            className="w-full bg-white/50 border border-white/50 rounded-2xl p-4 pr-24 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none transition-all hover:bg-white/70 shadow-inner"
            rows={3}
            placeholder="Describe symptoms (e.g., 'Sharp chest pain radiating to left arm')..."
            value={symptoms}
            onChange={(e) => {
              symptomsRef.current = e.target.value;
              setSymptoms(e.target.value);
            }}
          />

          {/* Right-side icon buttons inside the textarea */}
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {/* Camera (photo) icon */}
            <label
              title={imageFile ? 'Change Photo' : 'Add Symptom Photo'}
              className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
            >
              <Camera size={18} />
              <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleImageChange} />
            </label>

            {/* Mic (voice) icon */}
            <VoiceButton
              onTranscript={(text, langCode) => {
                symptomsRef.current = text;
                setSymptoms(text);
                setDetectedLanguage(langCode);
                detectedLanguageRef.current = langCode;
              }}
              onRequestTriage={handleVoiceTriage}
              triageResult={voiceResult}
              iconOnly
            />
          </div>
          {/* Suggestion Chips */}
          {!result && !loading && (
            <div className="mt-3 flex flex-wrap gap-2 px-1">
              <span className="text-xs text-gray-400 font-medium mr-1 uppercase tracking-wider py-1.5 flex items-center gap-1">
                <MessageSquareHeart size={12} /> Try asking:
              </span>
              {["I've had a headache for 2 days", "My stomach hurts after eating", "How much paracetamol for fever?"].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    symptomsRef.current = suggestion;
                    setSymptoms(suggestion);
                  }}
                  className="text-xs text-blue-600 bg-blue-50/70 hover:bg-blue-100 hover:text-blue-700 border border-blue-100/50 px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Image preview thumbnail */}
        <div className="relative z-10">
          {imagePreview && (
            <div className="relative inline-block mb-2 group">
              <img src={imagePreview} alt="Symptom" className="h-14 w-14 rounded-xl object-cover border-2 border-white/60 shadow-lg group-hover:shadow-blue-200/50 transition-all" />
              <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:scale-110 hover:bg-red-600 transition-transform">
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex justify-end mt-2">
            <button
              onClick={() => { void handleTriage(); }}
              disabled={loading || (!symptoms && !imageFile)}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold px-8 py-3.5 rounded-2xl shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span className="animate-pulse">Analyzing...</span>
                </>
              ) : (
                <>
                  <HeartPulse size={20} />
                  Analyze & Triage
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Card */}
        {result && (
          <div className="mt-4 animate-in fade-in zoom-in-95 duration-500">
            {/* High Risk Overlay Widget */}
            {isCritical && (result as any).hospitals && (
              <CriticalCareWidget
                hospitals={(result as any).hospitals || []}
                specialist={'Hospital'}
              />
            )}

            <div className={`relative overflow-hidden group glass-card rounded-3xl p-6 md:p-8 mt-6 border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ${isCritical ? 'ring-red-500/50 bg-gradient-to-br from-white/90 to-red-50/50 hover:shadow-red-200/50' : isUrgent ? 'ring-amber-500/40 bg-gradient-to-br from-white/90 to-amber-50/50 hover:shadow-amber-200/50' : result.emotion === 'friendly' ? 'ring-purple-500/30 bg-gradient-to-br from-white/90 to-purple-50/50 hover:shadow-purple-200/50' : 'ring-blue-500/30 bg-gradient-to-br from-white/90 to-blue-50/50 hover:shadow-blue-200/50'} transition-all duration-300`}>
               
              {/* Decorative emotion glow */}
              <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-30 -z-10 rounded-full ${isCritical ? 'bg-red-400' : isUrgent ? 'bg-amber-400' : result.emotion === 'friendly' ? 'bg-purple-400' : 'bg-blue-400'}`} />

              <div className="flex items-start gap-4 lg:gap-6 relative z-10">
                <div className={`mt-1 flex-shrink-0 p-3 lg:p-4 rounded-full shadow-sm ${isCritical ? 'bg-red-100 text-red-900' : isUrgent ? 'bg-amber-100 text-amber-900' : getEmotionColor(result.emotion).replace('border-', 'bg-').replace('text-', 'text-opacity-90 ')} ${isCritical ? 'animate-[pulse_1s_ease-in-out_infinite]' : ''}`}>
                  <Stethoscope size={28} className={isCritical ? 'text-red-600' : isUrgent ? 'text-amber-600' : result.emotion === 'friendly' ? 'text-purple-600' : 'text-blue-600'} />
                </div>
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">
                    {isCritical ? (
                      <><span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /> Emergency Guidance</>
                    ) : isUrgent ? (
                      <><span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" /> Urgent Guidance</>
                    ) : needsFollowUp ? (
                      <><MessageSquareHeart size={12} className="text-blue-400" /> Need More Details</>
                    ) : (
                      <><Sparkles size={12} className={result.emotion === 'friendly' ? 'text-purple-400' : 'text-blue-400'} /> AI Guidance</>
                    )}
                  </h3>
                  <p className="text-xl md:text-2xl text-gray-800 leading-relaxed font-semibold tracking-tight">
                    {result.text}
                  </p>

                  {needsFollowUp && (
                    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                        <AlertCircle size={16} />
                        Please answer these so I can narrow it down:
                      </div>
                      <div className="mt-3 space-y-2">
                        {result.followUpQuestions?.map((question, index) => (
                          <div key={`${index}-${question}`} className="flex items-start gap-3 rounded-xl bg-white/80 px-3 py-2 text-sm text-gray-700 shadow-sm">
                            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {index + 1}
                            </span>
                            <span>{question}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
