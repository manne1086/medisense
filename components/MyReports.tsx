import React, { useState, useEffect } from 'react';
import {
  FileText, Clock, Heart, AlertCircle, CheckCircle2, ChevronLeft,
  TrendingUp, TrendingDown, Activity, Shield, Pill, Flame, Target,
  Droplets, Beaker, Brain, Gauge, Eye, Loader2, RotateCcw, X, Trash2
} from './Icons';
import { getHistory, deleteReport } from '../services/storageService';
import { MedicalReport, RiskCondition, Biomarker, LifestyleIntervention } from '../types';
import { BiomarkerTrends } from './BiomarkerTrends';
import { DoctorSummary } from './DoctorSummary';

// ─── Status helpers ─────────────────────────────────────────────────

const getOverallStatus = (report: MedicalReport) => {
  const overview = report.analysis?.overview;
  if (overview?.overallStatus) return overview.overallStatus;
  const highRisks = report.analysis?.risks?.filter(r => r.probability === 'High').length ?? 0;
  if (highRisks > 0) return 'Needs Attention';
  return 'Stable';
};

const getStatusStyle = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('urgent') || s.includes('attention') || s.includes('critical'))
    return { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-500 text-white', dot: 'bg-red-500' };
  if (s.includes('monitor') || s.includes('warning'))
    return { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-500 text-white', dot: 'bg-amber-500' };
  return { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' };
};

const getBiomarkerIcon = (name: string) => {
  const l = name.toLowerCase();
  if (l.includes('glucose') || l.includes('sugar')) return <Droplets size={16} />;
  if (l.includes('cholesterol') || l.includes('lipid')) return <Beaker size={16} />;
  if (l.includes('pressure') || l.includes('systolic') || l.includes('diastolic')) return <Activity size={16} />;
  if (l.includes('hemoglobin') || l.includes('hb')) return <Heart size={16} />;
  if (l.includes('creatinine') || l.includes('kidney')) return <Target size={16} />;
  return <Gauge size={16} />;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
};

// ─── Report Detail View ────────────────────────────────────────────

const ReportDetail: React.FC<{ report: MedicalReport; onBack: () => void; onDeleted: () => void }> = ({ report, onBack, onDeleted }) => {
  const status = getOverallStatus(report);
  const style = getStatusStyle(status);
  const analysis = report.analysis;
  const overview = analysis?.overview;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await deleteReport(report.id);
    setIsDeleting(false);
    if (success) {
      onDeleted();
    } else {
      alert('Failed to delete report. Please try again.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm shadow-xl border border-gray-100 animate-in fade-in zoom-in">
            <div className="w-14 h-14 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Report?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              This action cannot be undone. The report from {formatDate(report.date)} will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900">{report.type || 'Medical Report'}</h3>
          <p className="text-sm text-gray-400 font-medium">{formatDate(report.date)} at {formatTime(report.date)}</p>
        </div>
        <span className={`${style.badge} text-xs font-bold px-3 py-1.5 rounded-full`}>{status}</span>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete report"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Overview card */}
      {overview && (
        <div className={`${style.bg} rounded-2xl p-6 border border-white/60`}>
          <h4 className="text-lg font-bold text-gray-900 mb-2">{overview.headline || 'Health Summary'}</h4>
          {analysis?.plainLanguageSummary && (
            <p className="text-gray-700 leading-relaxed mb-4">{analysis.plainLanguageSummary}</p>
          )}
          {!analysis?.plainLanguageSummary && analysis?.summary && (
            <p className="text-gray-700 leading-relaxed mb-4">{analysis.summary}</p>
          )}

          {/* Key concerns & stable indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {overview.keyConcerns && overview.keyConcerns.length > 0 && (
              <div>
                <h5 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertCircle size={12} /> Key Concerns
                </h5>
                <ul className="space-y-1">
                  {overview.keyConcerns.map((c, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {overview.stableIndicators && overview.stableIndicators.length > 0 && (
              <div>
                <h5 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Stable Indicators
                </h5>
                <ul className="space-y-1">
                  {overview.stableIndicators.map((s, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Next steps */}
          {overview.nextSteps && overview.nextSteps.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200/50">
              <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                <TrendingUp size={12} /> Recommended Next Steps
              </h5>
              <ul className="space-y-1">
                {overview.nextSteps.map((n, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">{i + 1}.</span>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Questions to ask */}
          {overview.questionsToAsk && overview.questionsToAsk.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200/50">
              <h5 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Brain size={12} /> Questions to Ask Your Doctor
              </h5>
              <ul className="space-y-1">
                {overview.questionsToAsk.map((q, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Summary fallback when no overview */}
      {!overview && analysis?.summary && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Analysis Summary</h4>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{analysis.summary}</p>
        </div>
      )}

      {/* Biomarkers grid */}
      {report.biomarkers && report.biomarkers.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity size={14} className="text-indigo-500" /> Biomarkers ({report.biomarkers.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {report.biomarkers.map((b, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-2 text-gray-400">
                  {getBiomarkerIcon(b.name)}
                  <span className="text-[10px] font-bold uppercase tracking-wider">{b.category || 'Other'}</span>
                </div>
                <p className="text-sm font-bold text-gray-900 mb-1 truncate" title={b.name}>{b.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-gray-900">{b.value}</span>
                  <span className="text-xs text-gray-400 font-medium">{b.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      {analysis?.risks && analysis.risks.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flame size={14} className="text-red-500" /> Risk Assessment
          </h4>
          <div className="space-y-3">
            {analysis.risks.map((risk, i) => {
              const rStyle = risk.probability === 'High' ? 'bg-red-50 border-red-100' : risk.probability === 'Medium' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100';
              const badgeStyle = risk.probability === 'High' ? 'bg-red-500 text-white' : risk.probability === 'Medium' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white';
              return (
                <div key={i} className={`${rStyle} border rounded-xl p-4`}>
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-bold text-gray-900 text-sm">{risk.condition}</h5>
                    <span className={`${badgeStyle} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase`}>{risk.probability}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{risk.reasoning}</p>
                  {risk.forecastHorizon && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Clock size={11} /> {risk.forecastHorizon}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prescriptions */}
      {report.prescriptions && report.prescriptions.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Pill size={14} className="text-teal-500" /> Prescriptions ({report.prescriptions.length})
          </h4>
          <div className="space-y-2">
            {report.prescriptions.map((med, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                  <Pill size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{med.name}</p>
                  <p className="text-xs text-gray-500">{med.dosage} &bull; {med.frequency}</p>
                  {med.description && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{med.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preventive measures */}
      {analysis?.preventiveMeasures && analysis.preventiveMeasures.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield size={14} className="text-emerald-500" /> Recommended Actions
          </h4>
          <div className="space-y-2">
            {analysis.preventiveMeasures.map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-widest">{item.category}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">{item.impact} impact</span>
                  </div>
                  <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────

export const MyReports: React.FC = () => {
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getHistory();
      // Sort newest first
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setReports(data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [lastRefresh]);

  const handleRefresh = async () => {
    setLastRefresh(Date.now());
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 size={32} className="text-indigo-500 animate-spin mb-4" />
        <p className="text-gray-400 font-medium text-sm">Loading your reports...</p>
      </div>
    );
  }

  // Detail view
  if (selectedReport) {
    return (
      <div className="glass-panel rounded-3xl border border-white/60 p-6 md:p-8">
        <ReportDetail 
          report={selectedReport} 
          onBack={() => setSelectedReport(null)}
          onDeleted={() => {
            setSelectedReport(null);
            handleRefresh();
          }}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Biomarker Trends Section */}
      {reports.length >= 2 && (
        <div className="glass-panel rounded-3xl border border-white/60 p-6 md:p-8">
          <BiomarkerTrends reports={reports} />
        </div>
      )}

      {/* Doctor Visit Summary Section */}
      {reports.length >= 1 && (
        <div className="glass-panel rounded-3xl border border-white/60 p-6 md:p-8">
          <DoctorSummary reports={reports} />
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-0">
      {/* Header */}
      <div className="glass-panel rounded-t-3xl border border-white/60 p-8 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-blue-200">
              <FileText size={28} />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">My Reports</h2>
              <p className="text-sm text-gray-400 font-medium mt-0.5">
                {reports.length} report{reports.length !== 1 ? 's' : ''} stored
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRefresh} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl transition-colors">
              <RotateCcw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="glass-panel rounded-b-3xl border border-t-0 border-white/60 min-h-[500px]">
        <div className="p-6 md:p-8">
          {reports.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mx-auto mb-6">
                <FileText size={36} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No reports yet</h3>
              <p className="text-gray-400 font-medium text-sm max-w-md mx-auto">
                Upload your first medical report in the <strong>Report Analysis</strong> tab. All your reports and AI summaries will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report, idx) => {
                const status = getOverallStatus(report);
                const style = getStatusStyle(status);
                const biomarkerCount = report.biomarkers?.length ?? 0;
                const riskCount = report.analysis?.risks?.length ?? 0;
                const highRisks = report.analysis?.risks?.filter(r => r.probability === 'High').length ?? 0;
                const headline = report.analysis?.overview?.headline || report.analysis?.summary?.substring(0, 120) || 'No summary available';

                return (
                  <button
                    key={report.id || idx}
                    onClick={() => setSelectedReport(report)}
                    className="w-full text-left bg-white hover:bg-gray-50 rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Status dot */}
                      <div className="pt-1">
                        <div className={`w-3 h-3 rounded-full ${style.dot}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div>
                            <h4 className="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors">
                              {report.type || 'Medical Report'}
                            </h4>
                            <p className="text-xs text-gray-400 font-medium flex items-center gap-2">
                              <Clock size={11} />
                              {formatDate(report.date)} &bull; {timeAgo(report.date)}
                            </p>
                          </div>
                          <span className={`${style.badge} text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0`}>{status}</span>
                        </div>

                        <p className="text-sm text-gray-500 leading-relaxed mt-2 line-clamp-2">
                          {headline}
                        </p>

                        {/* Quick stats */}
                        <div className="flex items-center gap-4 mt-3 text-xs font-medium text-gray-400">
                          {biomarkerCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Activity size={12} /> {biomarkerCount} biomarkers
                            </span>
                          )}
                          {riskCount > 0 && (
                            <span className={`flex items-center gap-1 ${highRisks > 0 ? 'text-red-400' : ''}`}>
                              <Flame size={12} /> {riskCount} risk{riskCount > 1 ? 's' : ''} {highRisks > 0 && `(${highRisks} high)`}
                            </span>
                          )}
                          {report.prescriptions && report.prescriptions.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Pill size={12} /> {report.prescriptions.length} medications
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
