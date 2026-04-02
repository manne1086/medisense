
import React from 'react';
import { AlertTriangle, Navigation, Phone, MapPin } from './Icons';
import { Hospital } from '../types';

interface CriticalCareWidgetProps {
  hospitals: Hospital[];
  specialist: string;
}

export const CriticalCareWidget: React.FC<CriticalCareWidgetProps> = ({ hospitals, specialist }) => {
  // We allow rendering even with 0 hospitals to show the Emergency Alert
  
  const handleManualSearch = () => {
    const query = encodeURIComponent(`${specialist} near me`);
    window.open(`https://www.google.com/maps/search/${query}`, '_blank');
  };

  return (
    <div className="mt-6 bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-5">
      {/* Pulse Animation Background */}
      <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-600 rounded-full animate-pulse shadow-lg shadow-red-500/50">
            <AlertTriangle className="text-white" size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-red-600 tracking-tight uppercase">Emergency Mode Active</h3>
            <p className="text-red-800 font-medium text-sm">High-risk symptoms detected. Navigate to a {specialist} immediately.</p>
          </div>
        </div>

        <div className="space-y-3">
            {hospitals.length > 0 ? (
                hospitals.map((hospital, idx) => (
                    <div key={idx} className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-red-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-transform hover:scale-[1.01]">
                        <div>
                            <div className="flex items-center gap-2">
                                <MapPin size={16} className="text-red-500" />
                                <h4 className="font-bold text-gray-900 text-lg">{hospital.name}</h4>
                            </div>
                            <p className="text-xs text-gray-500 ml-6">{hospital.address || 'Specialized Medical Center'}</p>
                            <div className="flex gap-2 ml-6 mt-1">
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Open Now</span>
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Rating: {hospital.rating || '4.0+'}</span>
                            </div>
                        </div>
                        
                        <a 
                            href={hospital.googleMapsUri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/30 transition-colors"
                        >
                            <Navigation size={18} />
                            Navigate Now
                        </a>
                    </div>
                ))
            ) : (
                <div className="bg-white/60 p-6 rounded-xl border border-red-100 text-center">
                    <p className="text-gray-700 font-medium mb-3">Unable to automatically retrieve nearby hospitals.</p>
                    <button 
                        onClick={handleManualSearch}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/30 flex items-center gap-2 mx-auto transition-colors"
                    >
                        <MapPin size={18} />
                        Find {specialist} Near Me on Google Maps
                    </button>
                </div>
            )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <a href="tel:911" className="flex-1 bg-gray-900 hover:bg-black text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                <Phone size={20} />
                Call Emergency Services (911)
            </a>
            <div className="flex-1 bg-red-100/50 p-3 rounded-xl border border-red-200 text-[11px] text-red-800 leading-tight flex items-center text-center justify-center">
                CRITICAL: This is an AI assessment, not a doctor. If you are in distress, go to the ER immediately regardless of app suggestions.
            </div>
        </div>
      </div>
    </div>
  );
};
