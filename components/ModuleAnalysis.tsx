
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Loader2, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Activity, Info, Calendar } from './Icons';
import { processMedicalReport } from '../services/grokService';
import { getHistory, saveReport, clearHistory } from '../services/storageService';
import { MedicalReport, AIAnalysisResult, ComparativeMetric } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const ModuleAnalysis: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'trends' | 'latest'>('trends');
    const [history, setHistory] = useState<MedicalReport[]>([]);

    // Analysis State
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysisResult | null>(null);

    // Drag and Drop State
    const [dragActive, setDragActive] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const data = await getHistory();
            setHistory(data);
            if (data.length > 0) setActiveTab('trends');
        };
        fetchData();
    }, []);

    // --- Handlers ---

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('image/')) {
            alert("Please upload an image file (JPG, PNG, WEBP).");
            return;
        }

        setIsProcessing(true);
        setActiveTab('latest');
        setCurrentAnalysis(null);

        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];

                try {
                    const { analysis, extractedRecord } = await processMedicalReport(base64, file.type, history);
                    setCurrentAnalysis(analysis);
                    const recordToSave = {
                        ...extractedRecord,
                        analysis: {
                            summary: analysis.summary,
                            risks: analysis.risks,
                            preventiveMeasures: analysis.preventiveMeasures
                        }
                    };
                    const newHistory = await saveReport(recordToSave);
                    setHistory(newHistory);
                } catch (err) {
                    console.error("Analysis Process Failed:", err);
                    alert("Failed to extract data from report. Please ensure the image is a clear medical report.");
                } finally {
                    setIsProcessing(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error(error);
            setIsProcessing(false);
            alert("Upload failed.");
        }
    };

    const onDrag = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    // --- Data Transformation for Charts ---
    const chartData = history.map(h => {
        const point: any = { date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) };
        h.biomarkers.forEach(b => {
            if (b.name.includes('Glucose')) point['Glucose'] = b.value;
            if (b.name.includes('Systolic')) point['Systolic'] = b.value;
            if (b.name.includes('Diastolic')) point['Diastolic'] = b.value;
            if (b.name.includes('Cholesterol')) point['Cholesterol'] = b.value;
        });
        return point;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
            case 'Warning': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        }
    };

    const renderMetricRow = (m: ComparativeMetric) => {
        const isBadTrend = m.status === 'Critical' || m.status === 'Warning';
        return (
            <tr key={m.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="py-4 px-6">
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{m.name}</span>
                        <span className={`text-[10px] w-fit px-1.5 py-0.5 rounded border uppercase font-black mt-1 ${getStatusBadge(m.status)}`}>
                            {m.status}
                        </span>
                    </div>
                </td>
                <td className="py-4 px-6">
                    <div className="flex items-baseline gap-1">
                        <span className="font-black text-gray-900 text-lg">{m.currentValue}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{m.unit}</span>
                    </div>
                </td>
                <td className="py-4 px-6 font-medium text-gray-400">
                    {m.previousValue || '--'}
                </td>
                <td className="py-4 px-6">
                    {m.deltaPercent !== null ? (
                        <div className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg w-fit ${isBadTrend ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {m.deltaPercent > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {Math.abs(m.deltaPercent)}%
                        </div>
                    ) : <span className="text-gray-300 text-xs italic">First Entry</span>}
                </td>
                <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`w-full ${isBadTrend ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ height: '60%' }}></div>
                        </div>
                        <span className="text-xs text-gray-500 font-medium leading-tight max-w-[150px]">{m.velocity}</span>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="glass-panel rounded-3xl min-h-[700px] flex flex-col shadow-2xl border border-white/60 relative overflow-hidden">

            {/* Dashboard Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20">
                        <Activity size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Health Analytics</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Longitudinal AI Reasoning Active</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={clearHistory}
                        className="text-xs font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                    >
                        Purge All Data
                    </button>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="bg-gray-100/80 px-4 py-2 rounded-xl flex items-center gap-2">
                        <ShieldAlert size={14} className="text-gray-400" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">SECURE CLOUD ENCLAVE</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex p-2 gap-2 bg-gray-50/50 border-b border-gray-100">
                <button
                    onClick={() => setActiveTab('trends')}
                    className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${activeTab === 'trends' ? 'bg-white shadow-lg text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <TrendingUp size={18} /> Trend Evolution
                </button>
                <button
                    onClick={() => setActiveTab('latest')}
                    className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${activeTab === 'latest' ? 'bg-white shadow-lg text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <FileText size={18} /> Deep Insight
                </button>
            </div>

            {/* Main Analysis Container */}
            <div className="flex-1 bg-white p-8 overflow-y-auto">

                {activeTab === 'trends' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Biomarker Cards */}
                            <div className="bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Activity size={120} />
                                </div>
                                <div className="flex justify-between items-center mb-8 relative z-10">
                                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Metabolic Trajectory</h3>
                                    <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-full">GLUCOSE</span>
                                </div>
                                <div className="h-64 relative z-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorGlu" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="date" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} tickMargin={15} stroke="#94a3b8" />
                                            <YAxis fontSize={10} fontWeight="900" tickLine={false} axisLine={false} stroke="#94a3b8" />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                            />
                                            <Area type="monotone" dataKey="Glucose" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorGlu)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100 group transition-all">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Hemodynamic Load</h3>
                                    <div className="flex gap-2">
                                        <span className="text-[10px] font-black bg-red-100 text-red-700 px-3 py-1 rounded-full uppercase">Sys</span>
                                        <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-3 py-1 rounded-full uppercase">Dia</span>
                                    </div>
                                </div>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="date" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} tickMargin={15} stroke="#94a3b8" />
                                            <YAxis fontSize={10} fontWeight="900" tickLine={false} axisLine={false} stroke="#94a3b8" />
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                                            <Area type="monotone" dataKey="Systolic" name="Systolic" stroke="#ef4444" strokeWidth={4} fill="none" dot={{ r: 4 }} />
                                            <Area type="monotone" dataKey="Diastolic" name="Diastolic" stroke="#f59e0b" strokeWidth={4} fill="none" strokeDasharray="5 5" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Empty State / CTA */}
                        <div className="bg-indigo-600 rounded-[2.5rem] p-12 text-center text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                                <svg width="100%" height="100%"><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" /></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
                            </div>
                            <div className="relative z-10">
                                <h4 className="text-3xl font-black mb-4">Start Your Longitudinal Profile</h4>
                                <p className="text-indigo-100 mb-8 max-w-xl mx-auto font-medium">MediSense uses Bayesian modeling to predict health shifts before they become clinical issues. The more reports you upload, the higher the forecast confidence.</p>
                                <button
                                    onClick={() => setActiveTab('latest')}
                                    className="bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-transform active:scale-95 shadow-xl"
                                >
                                    Upload Current Lab
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'latest' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">

                        {!isProcessing && !currentAnalysis && (
                            <div
                                className={`border-4 border-dashed rounded-[3rem] p-20 text-center transition-all duration-500 ${dragActive ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-gray-100 hover:border-indigo-300 hover:bg-gray-50/30'}`}
                                onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
                            >
                                <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl">
                                    <Upload size={40} />
                                </div>
                                <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Ingest Lab Documents</h3>
                                <p className="text-gray-400 mb-10 max-w-md mx-auto font-bold leading-relaxed text-sm">Drop your PDF or JPG lab reports here. Our vision engine will extract biomarkers and cross-reference with your history.</p>
                                <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-5 rounded-[1.5rem] cursor-pointer font-black shadow-2xl shadow-indigo-500/40 transition-all active:scale-95 inline-block uppercase tracking-widest text-sm">
                                    Select Document
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e.target.files)} />
                                </label>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="flex flex-col items-center justify-center py-40">
                                <div className="relative mb-10">
                                    <Loader2 size={80} className="text-indigo-600 animate-spin" strokeWidth={3} />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Activity size={32} className="text-indigo-300 animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight animate-pulse">Analyzing Biomarkers</h3>
                                <p className="text-gray-400 mt-4 font-bold uppercase tracking-widest text-xs">Bayesian Cross-Referencing in progress</p>
                            </div>
                        )}

                        {currentAnalysis && (
                            <div className="space-y-8">
                                <div className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-[2rem] flex items-center gap-4">
                                    <div className="p-3 bg-indigo-600 rounded-xl text-white">
                                        <Info size={20} />
                                    </div>
                                    <p className="text-sm text-indigo-900 font-bold leading-relaxed">
                                        <span className="uppercase tracking-tighter mr-2 opacity-60">Insight:</span>
                                        Bayesian inference detects a {currentAnalysis.risks[0]?.probability || 'Low'} confidence trend for chronic shifts. Regular monitoring advised.
                                    </p>
                                </div>

                                {/* Summary Block */}
                                <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-6">Expert Reasoning Log</h3>
                                    <p className="text-gray-800 leading-8 text-lg font-medium whitespace-pre-line border-l-4 border-indigo-500 pl-8">
                                        {currentAnalysis.summary}
                                    </p>
                                </div>

                                {/* Differential Grid */}
                                <div className="bg-gray-50/50 rounded-[2.5rem] border border-gray-100 overflow-hidden">
                                    <div className="px-10 py-8 border-b border-gray-200/50 flex justify-between items-center">
                                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Differential Metrics</h3>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">N=4 Timepoints</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white">
                                                    <th className="py-6 px-10">Biomarker</th>
                                                    <th className="py-6 px-10">Absolute</th>
                                                    <th className="py-6 px-10">Historical</th>
                                                    <th className="py-6 px-10">Delta</th>
                                                    <th className="py-6 px-10">Velocity Analysis</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white/40">
                                                {currentAnalysis.comparisons?.map(renderMetricRow)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Risks and Interventions Split */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                    <div className="space-y-6">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Risk Horizons</h4>
                                        {currentAnalysis.risks?.map((risk, idx) => (
                                            <div key={idx} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm group hover:border-red-200 transition-colors">
                                                <div className="flex justify-between items-start mb-6">
                                                    <h5 className="text-xl font-black text-gray-900 leading-tight">{risk.condition}</h5>
                                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${risk.probability === 'High' ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'}`}>
                                                        {risk.probability} RISK
                                                    </div>
                                                </div>
                                                <p className="text-gray-600 text-sm leading-relaxed mb-6 font-medium">{risk.reasoning}</p>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{ width: '40%' }}></div>
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase whitespace-nowrap">Horizon: {risk.forecastHorizon}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-6">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Preventive Action Plan</h4>
                                        <div className="space-y-4">
                                            {currentAnalysis.preventiveMeasures?.map((item, idx) => (
                                                <div key={idx} className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex gap-5 group hover:bg-emerald-50 transition-all">
                                                    <div className="p-3 bg-white rounded-2xl text-emerald-600 shadow-sm shrink-0 h-fit group-hover:scale-110 transition-transform">
                                                        <CheckCircle2 size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-widest">{item.category}</span>
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Impact: {item.impact}</span>
                                                        </div>
                                                        <h5 className="font-bold text-gray-900 mb-1">{item.title}</h5>
                                                        <p className="text-xs text-gray-600 font-medium leading-relaxed">{item.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
