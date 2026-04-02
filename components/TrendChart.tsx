
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { TrendPoint } from '../types';

interface TrendChartProps {
  data: TrendPoint[];
  minRange?: number;
  maxRange?: number;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, minRange, maxRange }) => {
  
  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-white/90 backdrop-blur-sm p-3 border border-gray-100 shadow-xl rounded-xl text-xs z-50">
          <p className="font-semibold text-gray-700 mb-1">{label}</p>
          <p className="text-indigo-600 font-bold text-lg">{point.value} <span className="text-xs font-normal text-gray-500">{point.unit}</span></p>
          <div className="flex items-center gap-1 mt-1">
             <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
             <p className="text-gray-400 italic">{point.source}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const domainMax = Math.max(...data.map(d => d.value), maxRange ? maxRange * 1.1 : 0);
  const domainMin = Math.min(...data.map(d => d.value), minRange ? minRange * 0.9 : 0);

  return (
    <div className="w-full h-full min-h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 10 }} 
            dy={5}
            interval="preserveStartEnd"
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            domain={[domainMin, domainMax]} 
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Reference Range (Green Zone) */}
          {minRange && maxRange && (
              <ReferenceArea 
                y1={minRange} 
                y2={maxRange} 
                fill="#22c55e" 
                fillOpacity={0.08} 
              />
          )}

          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#6366f1" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorValue)" 
            dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: '#6366f1' }}
            activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
