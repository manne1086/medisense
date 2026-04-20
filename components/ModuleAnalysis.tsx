import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload, FileText, Loader2, ShieldAlert, CheckCircle2, TrendingUp,
  ArrowUpRight, ArrowDownRight, Activity, Info, Brain, Eye, Sparkles, Shield,
  Clock, RotateCcw, ZoomIn, AlertCircle, FileImage,
  Beaker, CircleCheck, BarChart3, Flame, Droplets,
  Heart, Zap, Target, Gauge, BadgeCheck, ShieldCheck, Microscope, Scan,
  AlertTriangle, ClipboardList, TriangleAlert
} from './Icons';
import { processMedicalReport } from '../services/grokService';
import { getHistory, saveReport, clearHistory } from '../services/storageService';
import { analysisCache } from '../services/cacheService';
import {
  MedicalReport,
  AIAnalysisResult,
  ComparativeMetric,
  RiskCondition,
  LifestyleIntervention,
  AnalysisOverview,
  InsightConfidence,
  AnalysisCategoryBreakdown,
  PatientOverallStatus,
  UnusualFinding,
  BorderlineFinding,
  SyndromeScore,
  LipidRiskProfile,
  ActionTimeline,
  ConfidenceScoring,
  ClinicalSummaryItem
} from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

// ─── Pipeline Types ─────────────────────────────────────────────────
type PipelineStep = 'upload' | 'extraction' | 'reasoning' | 'complete';

interface PipelineState {
  current: PipelineStep;
  uploadComplete: boolean;
  extractionComplete: boolean;
  reasoningComplete: boolean;
  summaryReady: boolean;
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  previewUrl: string;
  base64: string;
  kind: 'image' | 'pdf';
}

interface DerivedOverview {
  overallStatus: PatientOverallStatus;
  headline: string;
  keyConcerns: string[];
  stableIndicators: string[];
  nextSteps: string[];
  questionsToAsk: string[];
  confidence: InsightConfidence;
  extractionQuality: InsightConfidence;
}

const chartTooltipStyle = {
  borderRadius: '12px',
  border: 'none',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
  fontSize: '12px',
  fontWeight: 'bold'
};

const formatBytes = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDisplayDate = (value?: string | Date) => {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Could not read the selected file.'));
  reader.readAsDataURL(file);
});

const revokePreview = (file: UploadedFile | null) => {
  if (file?.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(file.previewUrl);
  }
};

const uniqueStrings = (items: string[]) => Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));

const getMetricNarrative = (metric: ComparativeMetric) => {
  if (metric.deltaPercent === null) {
    return 'This is the first saved result for this marker, so there is no earlier comparison yet.';
  }

  const direction = metric.deltaPercent > 0 ? 'higher' : 'lower';
  if (metric.status === 'Critical') {
    return `${metric.name} is ${direction} than before and deserves earlier review with a clinician.`;
  }
  if (metric.status === 'Warning') {
    return `${metric.name} is ${direction} than before and is worth monitoring or discussing at follow-up.`;
  }
  return `${metric.name} looks relatively steady compared with the previous saved result.`;
};

const buildOverview = (
  analysis: AIAnalysisResult,
  report: MedicalReport,
  history: MedicalReport[]
): DerivedOverview => {
  const overview: AnalysisOverview | undefined = analysis.overview;
  const flaggedComparisons = analysis.comparisons.filter(metric => metric.status !== 'Normal');
  const stableComparisons = analysis.comparisons.filter(metric => metric.status === 'Normal');
  const highRisks = analysis.risks.filter(risk => risk.probability === 'High');
  const mediumRisks = analysis.risks.filter(risk => risk.probability === 'Medium');

  let fallbackStatus: PatientOverallStatus = 'Looks Okay';
  if (highRisks.length >= 2 || flaggedComparisons.filter(metric => metric.status === 'Critical').length >= 2) {
    fallbackStatus = 'Needs Urgent Review';
  } else if (highRisks.length > 0 || flaggedComparisons.some(metric => metric.status === 'Critical')) {
    fallbackStatus = 'Book Doctor Visit';
  } else if (mediumRisks.length > 0 || flaggedComparisons.length > 0) {
    fallbackStatus = 'Monitor';
  }

  const headline = overview?.headline?.trim()
    || (flaggedComparisons[0]
      ? `${flaggedComparisons[0].name} stands out most in this report.`
      : analysis.risks[0]
        ? `This report suggests follow-up around ${analysis.risks[0].condition.toLowerCase()}.`
        : `${report.type} looks broadly stable based on the extracted values.`);

  const keyConcerns = uniqueStrings(
    (overview?.keyConcerns?.length ? overview.keyConcerns : [
      ...flaggedComparisons.map(metric => getMetricNarrative(metric)),
      ...analysis.risks.map(risk => risk.reasoning)
    ]).slice(0, 3)
  );

  const stableIndicators = uniqueStrings(
    (overview?.stableIndicators?.length ? overview.stableIndicators : [
      ...stableComparisons.slice(0, 3).map(metric => `${metric.name} looks stable in this report.`),
      !flaggedComparisons.length ? 'No major abnormal trend stands out in the extracted markers.' : ''
    ]).slice(0, 3)
  );

  const nextSteps = uniqueStrings(
    (overview?.nextSteps?.length ? overview.nextSteps : [
      ...analysis.preventiveMeasures.slice(0, 3).map(item => `${item.title}: ${item.description}`),
      flaggedComparisons.length > 0 ? 'Discuss the abnormal values with a qualified doctor, especially if you have related symptoms.' : '',
      Math.max(history.length - 1, 0) > 0 ? 'Keep uploading future reports so MediSense can compare trends over time.' : 'Save future reports here to build a clearer trend history.'
    ]).slice(0, 3)
  );

  const questionsToAsk = uniqueStrings(
    (overview?.questionsToAsk?.length ? overview.questionsToAsk : [
      flaggedComparisons[0] ? `Should I repeat or monitor my ${flaggedComparisons[0].name} result?` : '',
      analysis.risks[0] ? `Do these findings suggest any early signs of ${analysis.risks[0].condition.toLowerCase()}?` : '',
      Math.max(history.length - 1, 0) > 0 ? 'How do these values compare with my previous reports?' : 'Which result matters most for follow-up?'
    ]).slice(0, 3)
  );

  return {
    overallStatus: overview?.overallStatus || fallbackStatus,
    headline,
    keyConcerns: keyConcerns.length > 0 ? keyConcerns : ['Some values may need a doctor to interpret in context.'],
    stableIndicators: stableIndicators.length > 0 ? stableIndicators : ['A few extracted markers appear stable, but clinician review is still recommended.'],
    nextSteps: nextSteps.length > 0 ? nextSteps : ['Review this report with a qualified healthcare professional.'],
    questionsToAsk: questionsToAsk.length > 0 ? questionsToAsk : ['Which of these results should I monitor first?'],
    confidence: overview?.confidence || analysis.extractionQuality || 'Medium',
    extractionQuality: analysis.extractionQuality || overview?.confidence || (report.biomarkers.length >= 6 ? 'High' : report.biomarkers.length >= 3 ? 'Medium' : 'Low')
  };
};

const buildCategoryBreakdown = (
  analysis: AIAnalysisResult,
  report: MedicalReport
): AnalysisCategoryBreakdown[] => {
  if (analysis.categoryBreakdown && analysis.categoryBreakdown.length > 0) {
    return analysis.categoryBreakdown;
  }

  const flaggedNames = new Set(
    analysis.comparisons
      .filter(metric => metric.status !== 'Normal')
      .map(metric => metric.name.toLowerCase())
  );

  const categories: AnalysisCategoryBreakdown['name'][] = ['Metabolic', 'Cardiovascular', 'Hematology', 'Renal', 'Other'];

  return categories
    .map(category => {
      const biomarkers = report.biomarkers.filter(marker => marker.category === category);
      if (!biomarkers.length) return null;

      const flagged = biomarkers.filter(marker => {
        const markerName = marker.name.toLowerCase();
        return Array.from(flaggedNames).some(flaggedName => flaggedName.includes(markerName) || markerName.includes(flaggedName));
      }).length;

      return {
        name: category,
        total: biomarkers.length,
        flagged
      };
    })
    .filter((item): item is AnalysisCategoryBreakdown => Boolean(item));
};

// ═══════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

const AnalysisProgress: React.FC<{ pipeline: PipelineState }> = ({ pipeline }) => {
  const steps = [
    { key: 'upload' as PipelineStep, label: 'Upload Complete', icon: Upload, done: pipeline.uploadComplete },
    { key: 'extraction' as PipelineStep, label: 'Vision Extraction', icon: Eye, done: pipeline.extractionComplete },
    { key: 'reasoning' as PipelineStep, label: 'Clinical Reasoning', icon: Brain, done: pipeline.reasoningComplete },
    { key: 'complete' as PipelineStep, label: 'Summary Ready', icon: Sparkles, done: pipeline.summaryReady },
  ];
  const currentIdx = steps.findIndex(s => s.key === pipeline.current);

  return (
    <div className="w-full animate-fadeInUp">
      <div className="glass-panel rounded-2xl p-5 border border-white/60">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Analysis Pipeline</h4>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${pipeline.summaryReady ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`} />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {pipeline.summaryReady ? 'Complete' : 'Processing'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentIdx && !pipeline.summaryReady;
            const isDone = step.done;
            return (
              <React.Fragment key={step.key}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-500 ${isDone ? 'bg-emerald-50' : isActive ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${isDone ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200 animate-breathe' : 'bg-gray-200 text-gray-400'}`}>
                    {isDone ? <CircleCheck size={16} /> : <Icon size={16} />}
                  </div>
                  <span className={`text-[11px] font-bold whitespace-nowrap hidden md:inline ${isDone ? 'text-emerald-700' : isActive ? 'text-indigo-700' : 'text-gray-400'}`}>{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 min-w-[16px] h-0.5 mx-1">
                    <div className={`h-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AnalysisUploadPanel: React.FC<{
  onUpload: (files: FileList) => void;
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}> = ({ onUpload, dragActive, onDrag, onDrop }) => {
  const fileTypes = [
    { label: 'JPG', color: 'bg-blue-100 text-blue-700' },
    { label: 'PNG', color: 'bg-indigo-100 text-indigo-700' },
    { label: 'WEBP', color: 'bg-teal-100 text-teal-700' },
    { label: 'PDF', color: 'bg-rose-100 text-rose-700' },
  ];

  return (
    <div className="animate-fadeInUp">
      <div
        className={`relative rounded-[2rem] transition-all duration-500 overflow-hidden ${
          dragActive
            ? 'border-2 border-indigo-400 bg-indigo-50/60 shadow-2xl shadow-indigo-100 scale-[1.01]'
            : 'border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/20'
        }`}
        onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
      >
        <div className="p-12 sm:p-16 text-center relative">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
            <svg width="100%" height="100%"><pattern id="uploadGrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1" /></pattern><rect width="100%" height="100%" fill="url(#uploadGrid)" /></svg>
          </div>
          <div className="relative z-10">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center transition-all duration-300 ${dragActive ? 'bg-indigo-500 text-white scale-110 shadow-xl shadow-indigo-300' : 'bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-600'}`}>
              {dragActive ? <Scan size={36} /> : <Upload size={36} />}
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
              {dragActive ? 'Drop your file here' : 'Upload Medical Report'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-2xl mx-auto text-sm font-medium leading-relaxed">
              Upload a clear lab report image or searchable PDF to get a patient-friendly summary, flagged findings, risk insights, and trend charts.
            </p>
            <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
              {fileTypes.map(ft => (
                <span key={ft.label} className={`${ft.color} text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider`}>{ft.label}</span>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl cursor-pointer font-bold shadow-xl shadow-indigo-200 transition-all active:scale-95 text-sm">
              <FileImage size={18} />
              Browse Files
              <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => e.target.files && onUpload(e.target.files)} />
            </label>
            <div className="flex items-center justify-center gap-4 mt-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <span className="flex items-center gap-1"><Shield size={12} /> Secure Upload</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="flex items-center gap-1"><Zap size={12} /> Groq Vision + Reasoning</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="flex items-center gap-1"><Clock size={12} /> Best with clear scans</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DocumentPreviewPanel: React.FC<{
  file: UploadedFile;
  onRemove: () => void;
  report?: MedicalReport | null;
  extractionQuality?: InsightConfidence;
}> = ({ file, onRemove, report, extractionQuality }) => (
  <div className="animate-fadeInUp delay-100 glass-panel rounded-2xl border border-white/60 overflow-hidden">
    <div className="flex items-center justify-between p-4 border-b border-gray-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
          {file.kind === 'pdf' ? <FileText size={20} /> : <FileImage size={20} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{file.name}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {file.kind === 'pdf' ? 'PDF document' : 'Image file'} &bull; {formatBytes(file.size)} &bull; {file.uploadedAt.toLocaleTimeString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ZoomIn size={16} /></button>
        <button onClick={onRemove} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><RotateCcw size={16} /></button>
      </div>
    </div>
    <div className="p-4 bg-gray-50/50 space-y-4">
      <div className="flex flex-wrap gap-2">
        {report && (
          <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
            {report.type}
          </span>
        )}
        {report && (
          <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
            {formatDisplayDate(report.date)}
          </span>
        )}
        {extractionQuality && (
          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
            extractionQuality === 'High'
              ? 'bg-emerald-50 text-emerald-700'
              : extractionQuality === 'Medium'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-700'
          }`}>
            Extraction {extractionQuality}
          </span>
        )}
      </div>
      <div className="rounded-xl overflow-hidden bg-white shadow-inner min-h-[320px] flex items-center justify-center border border-gray-100">
        {file.kind === 'pdf' ? (
          <iframe
            title="Uploaded PDF preview"
            src={`${file.previewUrl}#toolbar=0&navpanes=0`}
            className="w-full h-[420px] bg-white"
          />
        ) : (
          <img src={file.previewUrl} alt="Report preview" className="max-h-[420px] object-contain" />
        )}
      </div>
      <p className="text-xs text-gray-500 font-medium leading-relaxed">
        {file.kind === 'pdf'
          ? 'Searchable PDFs usually give cleaner extraction. If the PDF is only a scan, uploading a clear image may work better.'
          : 'Clear, well-lit report images help the vision model extract biomarker values more accurately.'}
      </p>
    </div>
  </div>
);

const HealthSummaryCard: React.FC<{
  analysis: AIAnalysisResult;
  report: MedicalReport;
  history: MedicalReport[];
  overview: DerivedOverview;
}> = ({ analysis, report, history, overview }) => {
  const statusStyles: Record<PatientOverallStatus, { gradient: string; chip: string; note: string }> = {
    'Looks Okay': {
      gradient: 'from-emerald-500 to-teal-500',
      chip: 'bg-emerald-100 text-emerald-700',
      note: 'No obvious high-priority concern stands out from the extracted values.'
    },
    Monitor: {
      gradient: 'from-amber-500 to-orange-500',
      chip: 'bg-amber-100 text-amber-700',
      note: 'Some findings are worth keeping an eye on or discussing during routine follow-up.'
    },
    'Book Doctor Visit': {
      gradient: 'from-rose-500 to-orange-500',
      chip: 'bg-rose-100 text-rose-700',
      note: 'A few findings deserve a doctor review sooner rather than later.'
    },
    'Needs Urgent Review': {
      gradient: 'from-red-500 to-rose-600',
      chip: 'bg-red-100 text-red-700',
      note: 'This report shows multiple findings that deserve faster clinical attention.'
    }
  };
  const status = statusStyles[overview.overallStatus];
  const summaryText = analysis.plainLanguageSummary || analysis.summary;
  const priorReports = Math.max(history.length - 1, 0);

  return (
    <div className="animate-fadeInUp delay-200">
      <div className="flex items-center gap-2 mb-4">
        <Heart size={18} className="text-indigo-500" />
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Patient Health Summary</h3>
      </div>
      <div className="glass-panel rounded-[2rem] border border-white/60 overflow-hidden shadow-lg">
        <div className={`bg-gradient-to-r ${status.gradient} p-6 text-white`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                {overview.overallStatus === 'Looks Okay' ? <CircleCheck size={24} /> : <AlertCircle size={24} />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-black text-white/75 uppercase tracking-[0.2em]">Overall Status</span>
                  <span className="text-[10px] font-black bg-white/15 px-3 py-1 rounded-full uppercase tracking-widest">
                    {analysis.reportType || report.type}
                  </span>
                </div>
                <h4 className="text-2xl font-black tracking-tight">{overview.overallStatus}</h4>
                <p className="text-white/85 text-sm font-medium mt-1">{overview.headline}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:min-w-[220px]">
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                <div className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em]">AI Confidence</div>
                <div className="text-lg font-black mt-1">{overview.confidence}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                <div className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em]">Extraction Quality</div>
                <div className="text-lg font-black mt-1">{overview.extractionQuality}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Info size={16} className="text-indigo-500" />
              <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.22em]">Plain-Language Summary</p>
            </div>
            <p className="text-gray-700 leading-7 text-sm font-medium">{summaryText}</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
              <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.22em] mb-3">Top Concerns</h5>
              <div className="space-y-2">
                {overview.keyConcerns.map(item => (
                  <div key={item} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5" />
                    <p className="text-sm font-medium leading-relaxed text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
              <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.22em] mb-3">What Looks Stable</h5>
              <div className="space-y-2">
                {overview.stableIndicators.map(item => (
                  <div key={item} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                    <p className="text-sm font-medium leading-relaxed text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.22em] mb-3">What To Do Next</h5>
              <div className="space-y-2">
                {overview.nextSteps.map(item => (
                  <div key={item} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                    <p className="text-sm font-medium leading-relaxed text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-[0.22em] ${status.chip}`}>
                {overview.overallStatus}
              </span>
              <p className="text-sm text-gray-600 font-medium leading-relaxed mt-3">{status.note}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
              {priorReports > 0
                ? `Compared against ${priorReports} earlier saved report${priorReports > 1 ? 's' : ''}.`
                : 'No earlier report history yet, so future trend tracking will improve with more uploads.'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
            <Info size={18} className="text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-600 font-medium leading-relaxed">
              This is an AI-generated supportive analysis. It is <strong>not a medical diagnosis</strong>. Please consult your healthcare provider for definitive interpretation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryHighlights: React.FC<{
  analysis: AIAnalysisResult;
  report: MedicalReport;
  history: MedicalReport[];
  overview: DerivedOverview;
}> = ({ analysis, report, history, overview }) => {
  const followUpCount =
    analysis.comparisons.filter(metric => metric.status !== 'Normal').length
    + analysis.risks.filter(risk => risk.probability !== 'Low').length;
  const priorReports = Math.max(history.length - 1, 0);

  const cards = [
    {
      label: 'Report',
      value: report.type,
      helper: formatDisplayDate(analysis.reportDate || report.date),
      theme: 'bg-blue-50 text-blue-600',
      icon: <FileText size={18} />
    },
    {
      label: 'Markers Captured',
      value: String(report.biomarkers.length),
      helper: 'Structured values extracted',
      theme: 'bg-indigo-50 text-indigo-600',
      icon: <Microscope size={18} />
    },
    {
      label: 'Need Follow-Up',
      value: String(followUpCount),
      helper: overview.overallStatus,
      theme: followUpCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600',
      icon: <AlertCircle size={18} />
    },
    {
      label: 'Report History',
      value: String(priorReports),
      helper: priorReports > 0 ? 'Earlier reports available' : 'No prior reports yet',
      theme: 'bg-teal-50 text-teal-600',
      icon: <TrendingUp size={18} />
    }
  ];

  return (
    <div className="animate-fadeInUp delay-250">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="glass-panel rounded-2xl p-5 border border-white/60 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.theme}`}>
                {card.icon}
              </div>
              {card.label === 'Need Follow-Up' && (
                <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full uppercase tracking-widest">
                  {overview.confidence}
                </span>
              )}
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.22em]">{card.label}</p>
            <p className="text-lg font-black text-gray-900 tracking-tight mt-1">{card.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{card.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const FindingsGrid: React.FC<{ comparisons: ComparativeMetric[] }> = ({ comparisons }) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Critical': return { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', badge: 'bg-red-500 text-white', icon: <Flame size={16} /> };
      case 'Warning': return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', badge: 'bg-amber-500 text-white', icon: <AlertCircle size={16} /> };
      default: return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-500 text-white', icon: <CircleCheck size={16} /> };
    }
  };
  const getCategoryIcon = (name: string) => {
    const l = name.toLowerCase();
    if (l.includes('glucose') || l.includes('sugar')) return <Droplets size={20} />;
    if (l.includes('cholesterol') || l.includes('lipid')) return <Beaker size={20} />;
    if (l.includes('pressure') || l.includes('systolic') || l.includes('diastolic')) return <Activity size={20} />;
    if (l.includes('hemoglobin') || l.includes('hb')) return <Heart size={20} />;
    if (l.includes('creatinine') || l.includes('kidney')) return <Target size={20} />;
    return <Gauge size={20} />;
  };
  if (!comparisons || comparisons.length === 0) return null;

  return (
    <div className="animate-fadeInUp delay-300">
      <div className="flex items-center gap-2 mb-4">
        <Microscope size={18} className="text-indigo-500" />
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Key Findings</h3>
        <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{comparisons.length} Markers</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {comparisons.map((m, idx) => {
          const style = getStatusStyle(m.status);
          const isBad = m.status === 'Critical' || m.status === 'Warning';
          return (
            <div key={m.name} className={`${style.bg} ${style.border} border rounded-2xl p-5 transition-all hover:shadow-lg hover:scale-[1.01] animate-fadeInUp`} style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${style.bg} ${style.text} flex items-center justify-center`}>{getCategoryIcon(m.name)}</div>
                <span className={`${style.badge} text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider`}>{m.status}</span>
              </div>
              <h4 className="font-bold text-gray-900 text-sm mb-1">{m.name}</h4>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-2xl font-black text-gray-900">{m.currentValue}</span>
                <span className="text-xs font-bold text-gray-400">{m.unit}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Prev: {m.previousValue ?? '--'}</span>
                {m.deltaPercent !== null ? (
                  <div className={`flex items-center gap-0.5 text-[11px] font-black px-2 py-0.5 rounded-lg ${isBad ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {m.deltaPercent > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(m.deltaPercent)}%
                  </div>
                ) : <span className="text-[10px] text-gray-300 italic">First entry</span>}
              </div>
              <p className="text-[11px] text-gray-500 font-medium mt-2 leading-relaxed">{getMetricNarrative(m)}</p>
              {m.velocity && <p className="text-[11px] text-gray-400 font-bold mt-2 leading-relaxed">{m.velocity}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RiskChart: React.FC<{
  risks: RiskCondition[];
  comparisons: ComparativeMetric[];
  categoryBreakdown: AnalysisCategoryBreakdown[];
}> = ({ risks, comparisons, categoryBreakdown }) => {
  const normalCount = comparisons.filter(c => c.status === 'Normal').length;
  const warningCount = comparisons.filter(c => c.status === 'Warning').length;
  const criticalCount = comparisons.filter(c => c.status === 'Critical').length;
  const donutData = [
    { name: 'Normal', value: normalCount, fill: '#10b981' },
    { name: 'Caution', value: warningCount, fill: '#f59e0b' },
    { name: 'Critical', value: criticalCount, fill: '#ef4444' },
  ].filter(d => d.value > 0);

  const riskBarData = risks.map(r => ({
    name: r.condition.length > 22 ? r.condition.substring(0, 22) + '...' : r.condition,
    severity: r.probability === 'High' ? 90 : r.probability === 'Medium' ? 55 : 25,
    fill: r.probability === 'High' ? '#ef4444' : r.probability === 'Medium' ? '#f59e0b' : '#10b981',
  }));

  return (
    <div className="animate-fadeInUp delay-400">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-indigo-500" />
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Charts And Graphs</h3>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-6 border border-white/60">
          <h4 className="text-sm font-bold text-gray-700">Marker Distribution</h4>
          <p className="text-xs text-gray-500 font-medium mt-1">
            A quick view of how many extracted markers look normal, need monitoring, or deserve review.
          </p>
          <div className="h-52 flex items-center justify-center">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-2xl bg-gray-50 text-sm font-medium text-gray-400">
                No comparison markers available yet
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            {(donutData.length > 0 ? donutData : [{ name: 'Extracted', value: comparisons.length, fill: '#6366f1' }]).map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="text-xs font-bold text-gray-500">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/60">
          <h4 className="text-sm font-bold text-gray-700">Risk Severity</h4>
          <p className="text-xs text-gray-500 font-medium mt-1">
            These bars show how strongly the AI thinks each risk item deserves follow-up attention.
          </p>
          <div className="h-52">
            {riskBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskBarData} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} fontSize={10} fontWeight="700" tickLine={false} axisLine={false} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" fontSize={10} fontWeight="700" tickLine={false} axisLine={false} stroke="#94a3b8" width={100} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="severity" radius={[0, 8, 8, 0]}>
                    {riskBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-2xl bg-emerald-50 text-sm font-medium text-emerald-700 text-center px-4">
                No specific future risk horizon was flagged from this analysis.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/60">
          <h4 className="text-sm font-bold text-gray-700">Category Mix</h4>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Gray shows total extracted markers in each category. Indigo shows how many may need follow-up.
          </p>
          <div className="h-52">
            {categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={10} fontWeight="700" tickLine={false} axisLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} fontWeight="700" tickLine={false} axisLine={false} stroke="#94a3b8" />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="total" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="flagged" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-2xl bg-gray-50 text-sm font-medium text-gray-400 text-center px-4">
                Category mix will appear when biomarkers are extracted
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const BiomarkerTrendChart: React.FC<{ history: MedicalReport[] }> = ({ history }) => {
  const orderedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const chartData = orderedHistory.map(h => {
    const point: any = { date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) };
    h.biomarkers.forEach(b => {
      if (b.name.includes('Glucose')) point['Glucose'] = b.value;
      if (b.name.includes('Systolic')) point['Systolic'] = b.value;
      if (b.name.includes('Diastolic')) point['Diastolic'] = b.value;
      if (b.name.includes('Cholesterol')) point['Cholesterol'] = b.value;
      if (b.name.includes('Hemoglobin')) point['Hemoglobin'] = b.value;
    });
    return point;
  });
  if (chartData.length < 2) return null;

  return (
    <div className="animate-fadeInUp delay-500">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-indigo-500" />
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Biomarker Trends Over Time</h3>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6 border border-white/60">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-sm font-bold text-gray-700">Metabolic Trajectory</h4>
              <p className="text-xs text-gray-500 font-medium mt-1">This helps users see whether sugar or lipid-related markers are drifting over time.</p>
            </div>
            <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full uppercase">Trend</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGluNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={10} fontWeight="700" tickLine={false} axisLine={false} stroke="#94a3b8" />
                <YAxis fontSize={10} fontWeight="700" tickLine={false} axisLine={false} stroke="#94a3b8" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="Glucose" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorGluNew)" dot={{ fill: '#6366f1', r: 4 }} />
                <Area type="monotone" dataKey="Cholesterol" stroke="#0ea5e9" strokeWidth={3} fill="none" dot={{ fill: '#0ea5e9', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6 border border-white/60">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-sm font-bold text-gray-700">Vitals And Blood Trend</h4>
              <p className="text-xs text-gray-500 font-medium mt-1">This chart compares pressure-related and blood-related values when multiple reports are available.</p>
            </div>
            <div className="flex gap-1.5">
              <span className="text-[10px] font-black bg-red-100 text-red-700 px-2.5 py-1 rounded-full uppercase">Sys</span>
              <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full uppercase">Dia</span>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={10} fontWeight="700" tickLine={false} axisLine={false} stroke="#94a3b8" />
                <YAxis fontSize={10} fontWeight="700" tickLine={false} axisLine={false} stroke="#94a3b8" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="Systolic" stroke="#ef4444" strokeWidth={3} fill="none" dot={{ fill: '#ef4444', r: 4 }} />
                <Area type="monotone" dataKey="Diastolic" stroke="#f59e0b" strokeWidth={3} fill="none" dot={{ fill: '#f59e0b', r: 4 }} strokeDasharray="5 5" />
                <Area type="monotone" dataKey="Hemoglobin" stroke="#ec4899" strokeWidth={3} fill="none" dot={{ fill: '#ec4899', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailedInterpretation: React.FC<{
  risks: RiskCondition[];
  preventiveMeasures: LifestyleIntervention[];
  overview: DerivedOverview;
}> = ({ risks, preventiveMeasures, overview }) => (
  <div className="animate-fadeInUp delay-600">
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Flame size={18} className="text-red-500" />
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">What May Need Attention</h3>
        </div>
        <div className="space-y-4">
          {risks.length > 0 ? risks.map((risk, idx) => (
            <div key={idx} className="glass-panel rounded-2xl p-6 border border-white/60 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <h5 className="text-base font-bold text-gray-900 leading-tight flex-1 mr-3">{risk.condition}</h5>
                <div className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${risk.probability === 'High' ? 'bg-red-500 text-white' : risk.probability === 'Medium' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {risk.probability}
                </div>
              </div>
              <p className="text-sm text-gray-600 font-medium leading-relaxed mb-3">{risk.reasoning}</p>
              {risk.forecastHorizon && (
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Horizon: {risk.forecastHorizon}</span>
                </div>
              )}
            </div>
          )) : (
            <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-medium leading-relaxed text-emerald-700">
              No specific future risk item was highlighted in this run. Keep tracking future reports for stronger trend confidence.
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">What Looks Stable</h3>
        </div>
        <div className="space-y-3">
          {overview.stableIndicators.map((item, idx) => (
            <div key={idx} className="glass-panel rounded-2xl p-5 border border-white/60 hover:shadow-lg transition-all flex gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">{item}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-4 mt-6">
          <Shield size={18} className="text-blue-500" />
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Questions To Ask Your Doctor</h3>
        </div>
        <div className="space-y-3">
          {overview.questionsToAsk.map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm font-medium leading-relaxed text-gray-700">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <BadgeCheck size={18} className="text-emerald-500" />
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Recommended Actions</h3>
        </div>
        <div className="space-y-3">
          {(preventiveMeasures.length > 0 ? preventiveMeasures : overview.nextSteps.map((item, idx) => ({
            category: 'Medical' as LifestyleIntervention['category'],
            title: `Next Step ${idx + 1}`,
            description: item,
            impact: idx === 0 ? 'High' as LifestyleIntervention['impact'] : 'Medium' as LifestyleIntervention['impact']
          }))).map((item, idx) => {
            const impactDot = item.impact === 'High' ? 'bg-indigo-500' : item.impact === 'Medium' ? 'bg-blue-400' : 'bg-gray-400';
            return (
              <div key={idx} className="glass-panel rounded-2xl p-5 border border-white/60 hover:shadow-lg transition-all flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-widest">{item.category}</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${impactDot}`} />
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.impact}</span>
                    </div>
                  </div>
                  <h5 className="font-bold text-gray-900 text-sm mb-0.5">{item.title}</h5>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

// ─── 5-Layer Refined Analysis Components ─────────────────────────────

const urgencyColors: Record<string, string> = {
  IMMEDIATE: 'bg-red-600 text-white',
  URGENT: 'bg-amber-500 text-white',
  ROUTINE: 'bg-blue-500 text-white',
  INVESTIGATE: 'bg-purple-500 text-white'
};

const UnusualFindingsPanel: React.FC<{ findings: UnusualFinding[] }> = ({ findings }) => (
  <div className="animate-fadeInUp">
    <div className="flex items-center gap-2 mb-4">
      <AlertCircle size={18} className="text-red-500" />
      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Unusual Findings Investigation</h3>
      <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{findings.length} found</span>
    </div>
    <div className="space-y-4">
      {findings.map((f, idx) => (
        <div key={idx} className="glass-panel rounded-2xl p-6 border border-white/60 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h5 className="text-base font-bold text-gray-900">{f.testName}</h5>
              <p className="text-sm text-gray-500 font-medium">{f.result} {f.unit} <span className="text-gray-400">| Ref: {f.referenceRange}</span></p>
            </div>
            <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${urgencyColors[f.urgency] || urgencyColors.INVESTIGATE}`}>
              {f.urgency}
            </span>
          </div>
          {f.deviation && <p className="text-sm text-red-600 font-semibold mb-2">{f.deviation}</p>}
          <p className="text-sm text-gray-600 font-medium leading-relaxed mb-3">{f.clinicalSignificance}</p>
          {f.expectedCauses.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Possible Causes</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {f.expectedCauses.map((cause, i) => (
                  <span key={i} className="text-xs font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg">{cause}</span>
                ))}
              </div>
            </div>
          )}
          {f.nextSteps.length > 0 && (
            <div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Next Steps</span>
              <ul className="mt-1.5 space-y-1">
                {f.nextSteps.map((step, i) => (
                  <li key={i} className="text-xs text-gray-600 font-medium flex items-start gap-2">
                    <ArrowUpRight size={12} className="text-indigo-400 shrink-0 mt-0.5" /> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

const BorderlineFindingsPanel: React.FC<{ findings: BorderlineFinding[] }> = ({ findings }) => (
  <div className="animate-fadeInUp">
    <div className="flex items-center gap-2 mb-4">
      <Gauge size={18} className="text-amber-500" />
      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Borderline & Early Warning Tracker</h3>
      <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{findings.length} tracked</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {findings.map((f, idx) => (
        <div key={idx} className="glass-panel rounded-2xl p-5 border border-amber-100 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-bold text-gray-900">{f.testName}</h5>
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${f.boundaryType === 'UPPER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {f.boundaryType} boundary
            </span>
          </div>
          <p className="text-sm text-gray-600 font-medium mb-1">{f.result} {f.unit} <span className="text-gray-400">| Ref: {f.referenceRange}</span></p>
          <p className="text-xs text-amber-600 font-semibold mb-2">{f.distanceToAbnormal}</p>
          <p className="text-xs text-gray-600 leading-relaxed mb-2">{f.interpretation}</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-gray-50 rounded-lg p-2">
              <span className="font-black text-gray-400 uppercase tracking-wider block">Monitor</span>
              <span className="font-bold text-gray-700">{f.monitoringFrequency}</span>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <span className="font-black text-gray-400 uppercase tracking-wider block">Threshold</span>
              <span className="font-bold text-gray-700">{f.actionableThreshold}</span>
            </div>
          </div>
          {f.prediction && <p className="text-xs text-gray-500 font-medium mt-2 italic">{f.prediction}</p>}
          {f.patientCounseling && <p className="text-xs text-indigo-600 font-medium mt-2">{f.patientCounseling}</p>}
        </div>
      ))}
    </div>
  </div>
);

const SyndromeScoresPanel: React.FC<{ scores: SyndromeScore[] }> = ({ scores }) => (
  <div className="animate-fadeInUp">
    <div className="flex items-center gap-2 mb-4">
      <Microscope size={18} className="text-purple-500" />
      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Syndrome Scoring & Quantification</h3>
    </div>
    <div className="space-y-4">
      {scores.map((s, idx) => {
        const pct = s.criteriaTotal > 0 ? Math.round((s.criteriaMet / s.criteriaTotal) * 100) : 0;
        return (
          <div key={idx} className="glass-panel rounded-2xl p-6 border border-white/60 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h5 className="text-base font-bold text-gray-900">{s.syndromeName}</h5>
                <p className="text-sm text-gray-500 font-medium">{s.diagnosis}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-gray-900">{s.criteriaMet}/{s.criteriaTotal}</div>
                <div className="text-[10px] font-bold text-gray-400">criteria met</div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full h-3 bg-gray-100 rounded-full mb-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${pct >= 60 ? 'bg-red-500' : pct >= 40 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Criteria checklist */}
            {s.criteriaDetails.length > 0 && (
              <div className="space-y-2 mb-3">
                {s.criteriaDetails.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${c.status === 'MET' ? 'bg-red-100 text-red-600' : c.status === 'NOT_MET' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      {c.status === 'MET' ? <CheckCircle2 size={12} /> : c.status === 'NOT_MET' ? <CircleCheck size={12} /> : <AlertCircle size={12} />}
                    </div>
                    <span className={`font-medium ${c.status === 'MET' ? 'text-gray-900' : 'text-gray-500'}`}>{c.criterion}</span>
                    {c.value && <span className="ml-auto text-xs text-gray-400 font-semibold">{c.value}</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 text-[10px]">
              <span className="font-black text-gray-400 uppercase tracking-wider">Confidence: {s.confidence}%</span>
              {s.progressionRisk && <span className="font-bold text-amber-600">{s.progressionRisk}</span>}
              {s.interventionEffectiveness && <span className="font-bold text-emerald-600">{s.interventionEffectiveness}</span>}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const LipidRiskPanel: React.FC<{ profile: LipidRiskProfile }> = ({ profile }) => (
  <div className="animate-fadeInUp">
    <div className="flex items-center gap-2 mb-4">
      <Heart size={18} className="text-rose-500" />
      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Comprehensive Lipid Risk Assessment</h3>
    </div>
    <div className="glass-panel rounded-2xl p-6 border border-white/60">
      {profile.ratios.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {profile.ratios.map((r, idx) => (
            <div key={idx} className="bg-gray-50 rounded-xl p-4">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{r.name}</div>
              <div className="text-xl font-black text-gray-900">{r.value}</div>
              <div className="text-[10px] font-semibold text-gray-400 mb-1">Ref: {r.reference}</div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${r.status?.toLowerCase().includes('optimal') || r.status?.toLowerCase().includes('normal') ? 'bg-emerald-100 text-emerald-700' : r.status?.toLowerCase().includes('high') || r.status?.toLowerCase().includes('risk') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {r.status}
              </span>
              {r.interpretation && <p className="text-xs text-gray-500 font-medium mt-2">{r.interpretation}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="text-sm text-gray-700 font-medium leading-relaxed">{profile.compositeSummary}</p>
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        {profile.estimatedCVDRisk && (
          <div className="bg-rose-50 px-3 py-1.5 rounded-lg">
            <span className="font-black text-rose-700">CVD Risk: </span>
            <span className="font-semibold text-rose-600">{profile.estimatedCVDRisk}</span>
          </div>
        )}
        {profile.primaryConcern && (
          <div className="bg-amber-50 px-3 py-1.5 rounded-lg">
            <span className="font-black text-amber-700">Primary Concern: </span>
            <span className="font-semibold text-amber-600">{profile.primaryConcern}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const ActionTimelinePanel: React.FC<{ timeline: ActionTimeline }> = ({ timeline }) => {
  const sections = [
    { key: 'immediate', label: 'This Week', items: timeline.immediate, color: 'red', icon: Zap },
    { key: 'urgent', label: '2-4 Weeks', items: timeline.urgent, color: 'amber', icon: AlertCircle },
    { key: 'shortTerm', label: '3 Months', items: timeline.shortTerm, color: 'blue', icon: Target },
    { key: 'mediumTerm', label: '6 Months', items: timeline.mediumTerm, color: 'indigo', icon: Clock },
    { key: 'longTerm', label: 'Annual', items: timeline.longTerm, color: 'gray', icon: TrendingUp },
  ].filter(s => s.items.length > 0);

  return (
    <div className="animate-fadeInUp">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={18} className="text-indigo-500" />
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Action Timeline</h3>
      </div>
      <div className="space-y-4">
        {sections.map(({ key, label, items, color, icon: Icon }) => (
          <div key={key} className="glass-panel rounded-2xl p-5 border border-white/60">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${color}-100 text-${color}-600`}>
                <Icon size={16} />
              </div>
              <span className="text-sm font-bold text-gray-800">{label}</span>
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">{items.length} action{items.length > 1 ? 's' : ''}</span>
            </div>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="text-sm text-gray-700 font-medium flex items-start gap-2">
                  <CheckCircle2 size={14} className={`text-${color}-400 shrink-0 mt-0.5`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {timeline.redFlags.length > 0 && (
          <div className="rounded-2xl p-5 border-2 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 mb-3">
              <TriangleAlert size={18} className="text-red-600" />
              <span className="text-sm font-bold text-red-800">Red Flags — Seek Immediate Care If</span>
            </div>
            <ul className="space-y-2">
              {timeline.redFlags.map((flag, i) => (
                <li key={i} className="text-sm text-red-700 font-semibold flex items-start gap-2">
                  <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const ConfidenceScoringPanel: React.FC<{ scoring: ConfidenceScoring }> = ({ scoring }) => (
  <div className="animate-fadeInUp">
    <div className="flex items-center gap-2 mb-4">
      <Shield size={18} className="text-blue-500" />
      <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Analysis Confidence</h3>
    </div>
    <div className="glass-panel rounded-2xl p-5 border border-white/60">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none"
              stroke={scoring.overall >= 70 ? '#22c55e' : scoring.overall >= 40 ? '#f59e0b' : '#ef4444'}
              strokeWidth="3" strokeDasharray={`${scoring.overall} ${100 - scoring.overall}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-gray-900">{scoring.overall}%</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">
            {scoring.overall >= 70 ? 'High confidence analysis' : scoring.overall >= 40 ? 'Moderate confidence — some data gaps' : 'Low confidence — significant data missing'}
          </p>
        </div>
      </div>
      {scoring.missingData.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Missing Data</span>
          <div className="flex flex-wrap gap-2">
            {scoring.missingData.map((item, i) => (
              <span key={i} className="text-xs font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg">{item}</span>
            ))}
          </div>
        </div>
      )}
      {scoring.limitations.length > 0 && (
        <div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">Limitations</span>
          <ul className="space-y-1">
            {scoring.limitations.map((item, i) => (
              <li key={i} className="text-xs text-gray-500 font-medium flex items-start gap-2">
                <Info size={11} className="text-gray-400 shrink-0 mt-0.5" /> {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </div>
);

const ClinicalSummaryPanel: React.FC<{ items: ClinicalSummaryItem[] }> = ({ items }) => {
  const statusStyles: Record<string, string> = {
    confirmed: 'bg-red-100 text-red-700',
    probable: 'bg-amber-100 text-amber-700',
    investigate: 'bg-purple-100 text-purple-700',
    stable: 'bg-emerald-100 text-emerald-700'
  };
  return (
    <div className="animate-fadeInUp">
      <div className="flex items-center gap-2 mb-4">
        <Scan size={18} className="text-gray-600" />
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Clinical Findings Summary</h3>
      </div>
      <div className="glass-panel rounded-2xl p-5 border border-white/60">
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700 font-medium flex-1 mr-3">{item.finding}</span>
              <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${statusStyles[item.status] || statusStyles.investigate}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DisclaimerFooter: React.FC = () => (
  <div className="animate-fadeInUp delay-700">
    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 border border-gray-100 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <ShieldCheck size={20} />
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-800 mb-1">Medical Disclaimer</h4>
        <p className="text-xs text-gray-500 font-medium leading-relaxed">
          This analysis is generated by AI for informational and supportive purposes only.
          It does <strong>not</strong> constitute a medical diagnosis, treatment recommendation, or clinical advice.
          Always consult a qualified healthcare professional for urgent concerns, definitive diagnosis, and personalized care.
        </p>
      </div>
    </div>
  </div>
);

const ProcessingView: React.FC<{ pipeline: PipelineState }> = ({ pipeline }) => {
  const stepLabel =
    pipeline.current === 'upload' ? 'Uploading document...'
    : pipeline.current === 'extraction' ? 'Extracting medical data with AI vision...'
    : pipeline.current === 'reasoning' ? 'Running clinical reasoning...'
    : 'Preparing your results...';

  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-indigo-200 animate-breathe">
          <Loader2 size={40} className="text-white animate-spin" strokeWidth={2.5} />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          {pipeline.current === 'extraction' ? <Eye size={16} className="text-indigo-500" /> :
           pipeline.current === 'reasoning' ? <Brain size={16} className="text-indigo-500" /> :
           <Sparkles size={16} className="text-indigo-500" />}
        </div>
      </div>
      <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">{stepLabel}</h3>
      <p className="text-gray-400 font-medium text-sm max-w-md text-center">
        MediSense is using AI to extract and interpret your medical data. This typically takes 10-20 seconds.
      </p>
      <div className="mt-8 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 rounded-full bg-indigo-300 animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
};

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
    <div className="w-20 h-20 rounded-2xl bg-red-100 text-red-500 flex items-center justify-center mb-6">
      <AlertCircle size={36} />
    </div>
    <h3 className="text-xl font-black text-gray-900 mb-2">Analysis Failed</h3>
    <p className="text-gray-500 font-medium text-sm mb-6 text-center max-w-md">{message}</p>
    <button onClick={onRetry} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors active:scale-95">
      <RotateCcw size={16} /> Try Again
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export const ModuleAnalysis: React.FC = () => {
  const [history, setHistory] = useState<MedicalReport[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysisResult | null>(null);
  const [currentReport, setCurrentReport] = useState<MedicalReport | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineState>({
    current: 'upload',
    uploadComplete: false,
    extractionComplete: false,
    reasoningComplete: false,
    summaryReady: false,
  });

  // Initialize component with cached data if available
  useEffect(() => {
    (async () => {
      const data = await getHistory();
      setHistory(data);

      // Try to restore from cache
      const cached = analysisCache.getAnalysis();
      if (cached) {
        setCurrentAnalysis(cached.analysis);
        setCurrentReport(cached.report);
        setPipeline(cached.pipeline);
      }
    })();
  }, []);

  useEffect(() => () => revokePreview(uploadedFile), [uploadedFile]);

  const resetState = () => {
    setCurrentAnalysis(null);
    setCurrentReport(null);
    setUploadedFile(prev => {
      revokePreview(prev);
      return null;
    });
    setError(null);
    setIsProcessing(false);
    setPipeline({ current: 'upload', uploadComplete: false, extractionComplete: false, reasoningComplete: false, summaryReady: false });
    
    // Clear cache when resetting
    analysisCache.clearAnalysis();
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!supported.includes(file.type)) {
      setError('Unsupported file type. Please upload JPG, PNG, WEBP, or PDF.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setCurrentAnalysis(null);
    setCurrentReport(null);
    setPipeline({ current: 'upload', uploadComplete: false, extractionComplete: false, reasoningComplete: false, summaryReady: false });

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fileObj: UploadedFile = {
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        previewUrl: URL.createObjectURL(file),
        base64: dataUrl.split(',')[1],
        kind: file.type === 'application/pdf' ? 'pdf' : 'image'
      };

      setUploadedFile(prev => {
        revokePreview(prev);
        return fileObj;
      });
      
      // Cache file metadata
      analysisCache.saveFileMetadata(fileObj);
      
      setPipeline({ current: 'extraction', uploadComplete: true, extractionComplete: false, reasoningComplete: false, summaryReady: false });

      const { analysis, extractedRecord } = await processMedicalReport(
        fileObj.base64,
        file.type,
        history,
        () => {
          setPipeline(prev => ({ ...prev, current: 'reasoning', extractionComplete: true }));
        }
      );

      setPipeline({ current: 'complete', uploadComplete: true, extractionComplete: true, reasoningComplete: true, summaryReady: true });
      setCurrentAnalysis(analysis);
      setCurrentReport(extractedRecord);
      setIsProcessing(false);

      // Save to cache so data persists across tab switches
      analysisCache.saveAnalysis(
        analysis,
        extractedRecord,
        { current: 'complete', uploadComplete: true, extractionComplete: true, reasoningComplete: true, summaryReady: true }
      );

      const recordToSave: MedicalReport = {
        ...extractedRecord,
        analysis: {
          summary: analysis.summary,
          plainLanguageSummary: analysis.plainLanguageSummary,
          overview: analysis.overview,
          reportType: analysis.reportType,
          reportDate: analysis.reportDate,
          extractionQuality: analysis.extractionQuality,
          categoryBreakdown: analysis.categoryBreakdown,
          risks: analysis.risks,
          preventiveMeasures: analysis.preventiveMeasures
        }
      };

      try {
        const newHistory = await saveReport(recordToSave);
        if (newHistory.length > 0) {
          setHistory(newHistory);
        } else {
          setHistory(prev => [recordToSave, ...prev.filter(item => item.id !== recordToSave.id)]);
        }
      } catch (saveError: any) {
        console.error('Failed to save analyzed report:', saveError);
        setError(`Failed to save report: ${saveError.message || 'Unknown error. Please try again.'}`);
      }
    } catch (err: any) {
      setIsProcessing(false);
      console.error('Analysis Process Failed:', err);
      setError(err?.message || 'Failed to analyze the report. Please ensure the image or PDF is clear and contains medical data.');
      setPipeline({ current: 'upload', uploadComplete: false, extractionComplete: false, reasoningComplete: false, summaryReady: false });
    }
  }, [history]);

  const handleClearData = useCallback(async () => {
    if (!history.length || isClearingData) return;

    const confirmed = window.confirm('Clear all saved medical reports from your profile? This will not log you out.');
    if (!confirmed) return;

    setIsClearingData(true);
    const success = await clearHistory();
    setIsClearingData(false);

    if (!success) {
      window.alert('Could not clear your saved report history. Please try again.');
      return;
    }

    setHistory([]);
    resetState();
  }, [history.length, isClearingData]);

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files);
  };

  const showResults = !!currentAnalysis && !!currentReport && !isProcessing;
  const showUpload = !isProcessing && !currentAnalysis && !error;
  const showError = !!error && !isProcessing && !currentAnalysis;
  const overview = currentAnalysis && currentReport ? buildOverview(currentAnalysis, currentReport, history) : null;
  const categoryBreakdown = currentAnalysis && currentReport ? buildCategoryBreakdown(currentAnalysis, currentReport) : [];

  return (
    <div className="space-y-0">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="glass-panel rounded-t-3xl border border-white/60 p-8 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-xl shadow-indigo-200">
              <Microscope size={28} />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Health Report Intelligence</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI Analysis Ready</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Brain size={11} /> Groq Vision + Reasoning
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {showResults && (
              <button onClick={resetState} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl transition-colors">
                <Upload size={14} /> New Analysis
              </button>
            )}
            <button
              onClick={handleClearData}
              disabled={!history.length || isClearingData}
              className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isClearingData ? 'Clearing...' : 'Clear Data'}
            </button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-100/80 px-3 py-1.5 rounded-lg">
              <ShieldAlert size={12} className="text-gray-400" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Secure</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="glass-panel rounded-b-3xl border border-t-0 border-white/60 min-h-[600px]">
        <div className="p-6 md:p-8 space-y-8">

          {(isProcessing || showResults) && <AnalysisProgress pipeline={pipeline} />}

          {/* Upload */}
          {showUpload && (
            <div className="space-y-6">
              <AnalysisUploadPanel onUpload={handleFileUpload} dragActive={dragActive} onDrag={onDrag} onDrop={onDrop} />
              {history.length > 0 && (
                <div className="animate-fadeInUp delay-200">
                  <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-8 text-white text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <svg width="100%" height="100%"><pattern id="heroGrid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" /></pattern><rect width="100%" height="100%" fill="url(#heroGrid)" /></svg>
                    </div>
                    <div className="relative z-10">
                      <h4 className="text-xl font-black mb-2">You have {history.length} report{history.length > 1 ? 's' : ''} in your profile</h4>
                      <p className="text-blue-100 text-sm font-medium max-w-2xl mx-auto">
                        Upload more reports to help MediSense answer what patients care about first: what changed, what might matter, and what to do next.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="space-y-6">
              {uploadedFile && <DocumentPreviewPanel file={uploadedFile} report={currentReport} extractionQuality={currentAnalysis?.extractionQuality} onRemove={resetState} />}
              <ProcessingView pipeline={pipeline} />
            </div>
          )}

          {/* Error */}
          {showError && <ErrorState message={error!} onRetry={resetState} />}

          {/* ── Results Dashboard ────────────────────────────── */}
          {showResults && currentAnalysis && currentReport && overview && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {uploadedFile && (
                  <div className="lg:col-span-2">
                    <DocumentPreviewPanel file={uploadedFile} report={currentReport} extractionQuality={overview.extractionQuality} onRemove={resetState} />
                  </div>
                )}
                <div className={uploadedFile ? 'lg:col-span-3' : 'lg:col-span-5'}>
                  <HealthSummaryCard analysis={currentAnalysis} report={currentReport} history={history} overview={overview} />
                </div>
              </div>

              <SummaryHighlights analysis={currentAnalysis} report={currentReport} history={history} overview={overview} />

              {currentAnalysis.comparisons?.length > 0 && <FindingsGrid comparisons={currentAnalysis.comparisons} />}

              <RiskChart
                risks={currentAnalysis.risks}
                comparisons={currentAnalysis.comparisons || []}
                categoryBreakdown={categoryBreakdown}
              />

              {history.length >= 2 && <BiomarkerTrendChart history={history} />}

              {/* ── 5-Layer Refined Analysis ──────────────────── */}
              {currentAnalysis.clinicalSummaryItems && currentAnalysis.clinicalSummaryItems.length > 0 && (
                <ClinicalSummaryPanel items={currentAnalysis.clinicalSummaryItems} />
              )}

              {currentAnalysis.unusualFindings && currentAnalysis.unusualFindings.length > 0 && (
                <UnusualFindingsPanel findings={currentAnalysis.unusualFindings} />
              )}

              {currentAnalysis.borderlineFindings && currentAnalysis.borderlineFindings.length > 0 && (
                <BorderlineFindingsPanel findings={currentAnalysis.borderlineFindings} />
              )}

              {currentAnalysis.syndromeScores && currentAnalysis.syndromeScores.length > 0 && (
                <SyndromeScoresPanel scores={currentAnalysis.syndromeScores} />
              )}

              {currentAnalysis.lipidRiskProfile && (
                <LipidRiskPanel profile={currentAnalysis.lipidRiskProfile} />
              )}

              {currentAnalysis.actionTimeline && (
                <ActionTimelinePanel timeline={currentAnalysis.actionTimeline} />
              )}

              {currentAnalysis.confidenceScoring && (
                <ConfidenceScoringPanel scoring={currentAnalysis.confidenceScoring} />
              )}

              <DetailedInterpretation
                risks={currentAnalysis.risks}
                preventiveMeasures={currentAnalysis.preventiveMeasures}
                overview={overview}
              />

              <DisclaimerFooter />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
