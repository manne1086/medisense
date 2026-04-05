import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceLine, Legend
} from 'recharts';
import { Activity, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from './Icons';
import { MedicalReport } from '../types';

// ── Normal ranges for common biomarkers ─────────────────────────────
const NORMAL_RANGES: Record<string, { min: number; max: number; unit: string; label: string }> = {
  'glucose':          { min: 70,  max: 100,  unit: 'mg/dL',  label: 'Fasting Glucose' },
  'fasting glucose':  { min: 70,  max: 100,  unit: 'mg/dL',  label: 'Fasting Glucose' },
  'hba1c':            { min: 4.0, max: 5.7,  unit: '%',       label: 'HbA1c' },
  'glycated hemoglobin': { min: 4.0, max: 5.7, unit: '%',     label: 'HbA1c' },
  'cholesterol':      { min: 0,   max: 200,  unit: 'mg/dL',  label: 'Total Cholesterol' },
  'total cholesterol':{ min: 0,   max: 200,  unit: 'mg/dL',  label: 'Total Cholesterol' },
  'ldl':              { min: 0,   max: 100,  unit: 'mg/dL',  label: 'LDL Cholesterol' },
  'ldl cholesterol':  { min: 0,   max: 100,  unit: 'mg/dL',  label: 'LDL Cholesterol' },
  'hdl':              { min: 40,  max: 60,   unit: 'mg/dL',  label: 'HDL Cholesterol' },
  'hdl cholesterol':  { min: 40,  max: 60,   unit: 'mg/dL',  label: 'HDL Cholesterol' },
  'triglycerides':    { min: 0,   max: 150,  unit: 'mg/dL',  label: 'Triglycerides' },
  'creatinine':       { min: 0.7, max: 1.3,  unit: 'mg/dL',  label: 'Serum Creatinine' },
  'serum creatinine': { min: 0.7, max: 1.3,  unit: 'mg/dL',  label: 'Serum Creatinine' },
  'hemoglobin':       { min: 12.0,max: 17.5, unit: 'g/dL',   label: 'Hemoglobin' },
  'hb':               { min: 12.0,max: 17.5, unit: 'g/dL',   label: 'Hemoglobin' },
  'urea':             { min: 7,   max: 20,   unit: 'mg/dL',  label: 'Blood Urea' },
  'blood urea':       { min: 7,   max: 20,   unit: 'mg/dL',  label: 'Blood Urea' },
  'bun':              { min: 7,   max: 20,   unit: 'mg/dL',  label: 'BUN' },
  'uric acid':        { min: 3.5, max: 7.2,  unit: 'mg/dL',  label: 'Uric Acid' },
  'tsh':              { min: 0.4, max: 4.0,  unit: 'mIU/L',  label: 'TSH' },
  'vitamin d':        { min: 30,  max: 100,  unit: 'ng/mL',  label: 'Vitamin D' },
  'vitamin b12':      { min: 200, max: 900,  unit: 'pg/mL',  label: 'Vitamin B12' },
  'iron':             { min: 60,  max: 170,  unit: 'µg/dL',  label: 'Serum Iron' },
  'ferritin':         { min: 12,  max: 300,  unit: 'ng/mL',  label: 'Ferritin' },
  'calcium':          { min: 8.5, max: 10.5, unit: 'mg/dL',  label: 'Calcium' },
  'albumin':          { min: 3.5, max: 5.5,  unit: 'g/dL',   label: 'Albumin' },
  'bilirubin':        { min: 0.1, max: 1.2,  unit: 'mg/dL',  label: 'Total Bilirubin' },
  'total bilirubin':  { min: 0.1, max: 1.2,  unit: 'mg/dL',  label: 'Total Bilirubin' },
  'sgpt':             { min: 7,   max: 56,   unit: 'U/L',    label: 'SGPT (ALT)' },
  'alt':              { min: 7,   max: 56,   unit: 'U/L',    label: 'ALT' },
  'sgot':             { min: 10,  max: 40,   unit: 'U/L',    label: 'SGOT (AST)' },
  'ast':              { min: 10,  max: 40,   unit: 'U/L',    label: 'AST' },
  'platelet count':   { min: 150, max: 400,  unit: '×10³/µL',label: 'Platelet Count' },
  'platelets':        { min: 150, max: 400,  unit: '×10³/µL',label: 'Platelet Count' },
  'wbc':              { min: 4.5, max: 11.0, unit: '×10³/µL',label: 'WBC Count' },
  'rbc':              { min: 4.5, max: 5.5,  unit: '×10⁶/µL',label: 'RBC Count' },
};

// Build a reverse map: label → range entry (for canonical grouping)
const LABEL_TO_RANGE = new Map<string, { min: number; max: number; unit: string; label: string }>();
for (const entry of Object.values(NORMAL_RANGES)) {
  LABEL_TO_RANGE.set(entry.label.toLowerCase(), entry);
}

// Strip common prefixes/suffixes and parenthetical content to normalize names
const stripNoise = (name: string): string =>
  name
    .replace(/\(.*?\)/g, '')                      // remove parenthetical (serum), (fasting), etc.
    .replace(/\b(serum|blood|fasting|total|plasma|random|post[- ]?prandial|direct)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Map a raw biomarker name to a canonical label + normal range */
const canonicalize = (raw: string): { canonical: string; range: typeof NORMAL_RANGES[string] | null } => {
  const key = raw.toLowerCase().trim();

  // 1. Exact match in NORMAL_RANGES
  if (NORMAL_RANGES[key]) {
    const r = NORMAL_RANGES[key];
    return { canonical: r.label, range: r };
  }

  // 2. Match after stripping noise words
  const stripped = stripNoise(key);
  if (stripped && NORMAL_RANGES[stripped]) {
    const r = NORMAL_RANGES[stripped];
    return { canonical: r.label, range: r };
  }

  // 3. Check if any NORMAL_RANGES key is contained in the name or vice versa
  for (const [nrKey, entry] of Object.entries(NORMAL_RANGES)) {
    if (key.includes(nrKey) || nrKey.includes(stripped || key)) {
      return { canonical: entry.label, range: entry };
    }
  }

  // 4. Check by label name
  for (const [label, entry] of LABEL_TO_RANGE.entries()) {
    if (key.includes(label) || label.includes(stripped || key)) {
      return { canonical: entry.label, range: entry };
    }
  }

  // 5. No match — use cleaned-up raw name as canonical
  const fallback = stripped || key;
  return { canonical: fallback.charAt(0).toUpperCase() + fallback.slice(1), range: null };
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

interface BiomarkerTimeSeries {
  name: string;
  unit: string;
  normalRange: { min: number; max: number } | null;
  data: { date: string; value: number; reportDate: string }[];
  latestValue: number;
  trend: 'up' | 'down' | 'stable';
}

interface Props {
  reports: MedicalReport[];
}

export const BiomarkerTrends: React.FC<Props> = ({ reports }) => {
  const [activeBiomarker, setActiveBiomarker] = useState<string | null>(null);

  // Build time series for each biomarker across all reports
  const timeSeries = useMemo((): BiomarkerTimeSeries[] => {
    if (reports.length < 2) return [];

    const sorted = [...reports].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Collect all data points per canonicalized biomarker name
    const byName = new Map<string, { unit: string; range: typeof NORMAL_RANGES[string] | null; points: { date: string; value: number; reportDate: string }[] }>();

    for (const report of sorted) {
      for (const bm of report.biomarkers || []) {
        const { canonical, range } = canonicalize(bm.name);
        if (!byName.has(canonical)) {
          byName.set(canonical, { unit: bm.unit, range, points: [] });
        }
        byName.get(canonical)!.points.push({
          date: formatDate(report.date),
          value: bm.value,
          reportDate: report.date,
        });
      }
    }

    // Only keep biomarkers that appear in 2+ reports
    const series: BiomarkerTimeSeries[] = [];
    for (const [canonical, { unit, range, points }] of byName.entries()) {
      if (points.length < 2) continue;

      const latest = points[points.length - 1].value;
      const prev = points[points.length - 2].value;
      const delta = latest - prev;
      const trend: 'up' | 'down' | 'stable' =
        Math.abs(delta) / (prev || 1) < 0.02 ? 'stable' : delta > 0 ? 'up' : 'down';

      series.push({
        name: canonical,
        unit: unit || range?.unit || '',
        normalRange: range ? { min: range.min, max: range.max } : null,
        data: points,
        latestValue: latest,
        trend,
      });
    }

    // Sort: biomarkers with normal ranges first, then alphabetical
    series.sort((a, b) => {
      if (a.normalRange && !b.normalRange) return -1;
      if (!a.normalRange && b.normalRange) return 1;
      return a.name.localeCompare(b.name);
    });

    return series;
  }, [reports]);

  // Set default active biomarker
  const active = activeBiomarker && timeSeries.find(s => s.name === activeBiomarker)
    ? activeBiomarker
    : timeSeries[0]?.name || null;

  const currentSeries = timeSeries.find(s => s.name === active);

  if (timeSeries.length === 0) {
    return null; // Don't render if not enough data
  }

  // Pagination for biomarker pills
  const PILLS_PER_PAGE = 6;
  const [pillPage, setPillPage] = useState(0);
  const totalPages = Math.ceil(timeSeries.length / PILLS_PER_PAGE);
  const visiblePills = timeSeries.slice(pillPage * PILLS_PER_PAGE, (pillPage + 1) * PILLS_PER_PAGE);

  // Chart domain calculation
  const getYDomain = (series: BiomarkerTimeSeries): [number, number] => {
    const values = series.data.map(d => d.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (series.normalRange) {
      min = Math.min(min, series.normalRange.min);
      max = Math.max(max, series.normalRange.max);
    }
    const padding = (max - min) * 0.15 || 1;
    return [Math.max(0, min - padding), max + padding];
  };

  const isOutOfRange = (value: number, range: { min: number; max: number } | null) => {
    if (!range) return false;
    return value < range.min || value > range.max;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg">
          <Activity size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Biomarker Trends</h3>
          <p className="text-xs text-gray-400 font-medium">
            Tracking {timeSeries.length} biomarker{timeSeries.length !== 1 ? 's' : ''} across {reports.length} reports
          </p>
        </div>
      </div>

      {/* Biomarker selector pills */}
      <div className="flex items-center gap-2">
        {totalPages > 1 && (
          <button
            onClick={() => setPillPage(Math.max(0, pillPage - 1))}
            disabled={pillPage === 0}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <div className="flex gap-2 flex-wrap flex-1">
          {visiblePills.map(s => {
            const isActive = s.name === active;
            const outOfRange = isOutOfRange(s.latestValue, s.normalRange);
            return (
              <button
                key={s.name}
                onClick={() => setActiveBiomarker(s.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : outOfRange
                    ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.trend === 'up' ? <TrendingUp size={12} /> : s.trend === 'down' ? <TrendingDown size={12} /> : null}
                {s.name}
                <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {s.latestValue} {s.unit}
                </span>
              </button>
            );
          })}
        </div>
        {totalPages > 1 && (
          <button
            onClick={() => setPillPage(Math.min(totalPages - 1, pillPage + 1))}
            disabled={pillPage >= totalPages - 1}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors shrink-0"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Chart */}
      {currentSeries && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-gray-900 text-sm">{currentSeries.name}</h4>
              <p className="text-xs text-gray-400">
                {currentSeries.unit}
                {currentSeries.normalRange && (
                  <span className="ml-2 text-emerald-600">
                    Normal: {currentSeries.normalRange.min}–{currentSeries.normalRange.max}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {currentSeries.normalRange && isOutOfRange(currentSeries.latestValue, currentSeries.normalRange) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase">
                  Out of Range
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                currentSeries.trend === 'up' ? 'bg-amber-100 text-amber-700' :
                currentSeries.trend === 'down' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {currentSeries.trend === 'up' ? '↑ Rising' : currentSeries.trend === 'down' ? '↓ Falling' : '→ Stable'}
              </span>
            </div>
          </div>

          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentSeries.data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  domain={getYDomain(currentSeries)}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(v: number) => Number.isInteger(v) ? v.toString() : v.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [
                    `${value} ${currentSeries.unit}`,
                    currentSeries.name,
                  ]}
                />
                {/* Normal range band */}
                {currentSeries.normalRange && (
                  <ReferenceArea
                    y1={currentSeries.normalRange.min}
                    y2={currentSeries.normalRange.max}
                    {...{fill: "#10b981", fillOpacity: 0.08, stroke: "#10b981", strokeOpacity: 0.2, strokeDasharray: "4 4"} as any}
                  />
                )}
                {/* Normal range boundary lines */}
                {currentSeries.normalRange && (
                  <>
                    <ReferenceLine
                      y={currentSeries.normalRange.min}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{ value: 'Low', position: 'left', fontSize: 10, fill: '#10b981' }}
                    />
                    <ReferenceLine
                      y={currentSeries.normalRange.max}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{ value: 'High', position: 'left', fontSize: 10, fill: '#10b981' }}
                    />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, fill: '#6366f1', strokeWidth: 3, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Data table below chart */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {currentSeries.data.map((point, idx) => {
                const outOfRange = isOutOfRange(point.value, currentSeries.normalRange);
                const prevValue = idx > 0 ? currentSeries.data[idx - 1].value : null;
                const delta = prevValue !== null ? ((point.value - prevValue) / (prevValue || 1) * 100) : null;
                return (
                  <div
                    key={idx}
                    className={`shrink-0 px-3 py-2 rounded-lg text-center min-w-[80px] ${
                      outOfRange ? 'bg-red-50 border border-red-100' : 'bg-gray-50'
                    }`}
                  >
                    <p className="text-[10px] text-gray-400 font-medium">{point.date}</p>
                    <p className={`text-sm font-bold ${outOfRange ? 'text-red-700' : 'text-gray-900'}`}>
                      {point.value}
                    </p>
                    {delta !== null && (
                      <p className={`text-[10px] font-bold ${
                        delta > 0 ? 'text-amber-600' : delta < 0 ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
