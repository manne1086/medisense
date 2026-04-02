
import React, { useState } from 'react';
import { Pill, Upload, Calendar, Loader2, Leaf, HeartPulse, Info, CheckCircle2 } from './Icons';
import { analyzePrescription } from '../services/grokService';
import { generateICS, downloadICSFile } from '../services/analysisService';
import { saveReport } from '../services/storageService';
import { MedicalReport, Medication, LifestyleIntervention } from '../types';

export const ModulePrescription: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [interventions, setInterventions] = useState<LifestyleIntervention[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(f.type)) {
                alert("Please upload a valid image (JPEG, PNG, or WEBP).");
                return;
            }
            setFile(f);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(f);
        }
    };

    const handleAnalyze = async () => {
        if (!file || !preview) return;
        setAnalyzing(true);
        try {
            const base64 = preview.split(',')[1];
            const data = await analyzePrescription(base64, file.type);
            setMedications(data.medications || []);
            setInterventions(data.interventions || []);
        } catch (error) {
            console.error(error);
            alert("Failed to read prescription. Please ensure the photo is clear and contains legible medical text.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDownloadCalendar = () => {
        if (medications.length === 0) return;
        const icsContent = generateICS(medications);
        downloadICSFile(icsContent);
    };

    const handleSave = async () => {
        if (medications.length === 0) return;
        setIsSaving(true);
        try {
            const report: MedicalReport = {
                id: `rx-${Date.now()}`,
                date: new Date().toISOString(),
                type: 'Prescription',
                biomarkers: [], // Prescriptions don't always have biomarkers
                prescriptions: medications,
                interventions: interventions,
                analysis: undefined // Optional
            };
            await saveReport(report);
            alert("Prescription saved to your profile!");
        } catch (error) {
            console.error("Failed to save prescription:", error);
            alert("Failed to save prescription. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="glass-panel rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl border-t border-white/80 min-h-[600px] flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-teal-100 rounded-2xl text-teal-600">
                    <Pill size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Prescription Intelligence</h2>
                    <p className="text-xs text-gray-500">Automated scheduling and market alternative analysis</p>
                </div>
            </div>

            <div className="flex-1 space-y-6">
                {!medications.length && (
                    <div className="border-2 border-dashed border-teal-200 rounded-3xl p-10 flex flex-col items-center justify-center bg-teal-50/30 hover:bg-teal-50 transition-all group">
                        {preview ? (
                            <div className="relative w-full max-w-sm h-64 mb-6 shadow-2xl rounded-2xl overflow-hidden border-4 border-white">
                                <img src={preview} alt="Rx" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                            </div>
                        ) : (
                            <div className="w-20 h-20 bg-teal-100 text-teal-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <Upload size={32} />
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Scan Medical Prescription</h3>
                        <p className="text-gray-500 mb-8 max-w-xs text-center text-sm">Upload a clear photo of your prescription to identify meds and find cost-effective alternatives.</p>

                        <div className="flex flex-col w-full max-w-xs gap-3">
                            <label className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl cursor-pointer font-bold transition-all shadow-lg shadow-teal-500/30 text-center active:scale-95">
                                {preview ? "Replace Photo" : "Upload Image"}
                                <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                            </label>

                            <button
                                onClick={handleAnalyze}
                                disabled={!file || analyzing}
                                className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${!file ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-teal-700 bg-teal-100 hover:bg-teal-200 active:scale-95'}`}
                            >
                                {analyzing ? <Loader2 className="animate-spin" /> : <><HeartPulse size={18} /> Run AI Analysis</>}
                            </button>
                        </div>
                    </div>
                )}

                {medications.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Detected Regimen</h3>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Analysis Complete</p>
                            </div>
                            <button
                                onClick={handleDownloadCalendar}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 font-bold transition-transform active:scale-95"
                            >
                                <Calendar size={18} />
                                Export Reminders
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 font-bold transition-transform active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                {isSaving ? "Saving..." : "Save to Profile"}
                            </button>
                        </div>

                        <div className="space-y-6 mb-10">
                            {medications.map((med, idx) => (
                                <div key={idx} className="bg-white/70 p-6 rounded-3xl border border-white/60 shadow-sm hover:shadow-xl transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-start gap-4">
                                            <div className="h-12 w-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                                                <Pill size={22} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-xl leading-tight">{med.name}</h4>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <span className="bg-teal-50 text-teal-700 text-[10px] px-2.5 py-1 rounded-full font-black uppercase border border-teal-100 tracking-wider">
                                                        {med.type || "Medication"}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                                                        {med.dosage} • {med.frequency}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {med.description && (
                                        <div className="mt-4 bg-blue-50/40 p-4 rounded-2xl border border-blue-100/50 flex gap-3 mb-6">
                                            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-sm text-gray-700 leading-relaxed italic">
                                                {med.description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Alternatives Section - NEW ENHANCED DESIGN */}
                                    {med.alternatives && med.alternatives.length > 0 && (
                                        <div className="mt-6 border-t border-gray-100 pt-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="h-px flex-1 bg-gray-100"></div>
                                                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                                    Market Substitutes (Verified Salts)
                                                </h5>
                                                <div className="h-px flex-1 bg-gray-100"></div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {med.alternatives.map((alt, aidx) => (
                                                    <div key={aidx} className="bg-white/90 border border-gray-100 p-4 rounded-2xl flex flex-col justify-between hover:border-teal-200 hover:shadow-lg transition-all cursor-default">
                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="font-black text-gray-900 text-sm tracking-tight">{alt.name}</span>
                                                                <span className={`text-[8px] px-2 py-0.5 rounded-md font-black tracking-widest ${alt.type === 'Generic' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                                                    {alt.type.toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-gray-500 leading-snug font-medium">
                                                                {alt.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Lifestyle Interventions Section */}
                        <div className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 rounded-[2.5rem] border border-green-100 p-1 shadow-inner">
                            <div className="bg-white/60 p-6 rounded-t-[2.3rem] border-b border-green-100">
                                <h3 className="font-bold text-green-900 flex items-center gap-3 text-lg">
                                    <Leaf size={22} className="text-green-600" /> Supportive Lifestyle Interventions
                                </h3>
                                <p className="text-xs text-green-700/70 mt-1 ml-8">Context-aware advice based on your current medications</p>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {interventions.map((item, idx) => (
                                    <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform">
                                        <div className={`absolute top-0 right-0 p-2 px-3 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest ${item.impact === 'High' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                            {item.impact} IMPACT
                                        </div>
                                        <p className="text-[10px] font-black text-teal-500 mb-2 uppercase tracking-widest">{item.category}</p>
                                        <p className="font-bold text-gray-900 mb-2 text-md leading-tight">{item.title}</p>
                                        <p className="text-xs text-gray-600 leading-relaxed font-medium">{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => { setMedications([]); setInterventions([]); setFile(null); setPreview(null); }}
                            className="mt-10 w-full text-center py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                        >
                            + Scan New Prescription
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
