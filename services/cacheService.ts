/**
 * Cache Service - Persists analysis data to localStorage
 * Survives tab switches and page refreshes
 */

import { AIAnalysisResult, MedicalReport } from '../types';

const CACHE_KEYS = {
  CURRENT_ANALYSIS: 'medisense_current_analysis',
  CURRENT_REPORT: 'medisense_current_report',
  PIPELINE_STATE: 'medisense_pipeline_state',
  UPLOADED_FILE_META: 'medisense_uploaded_file_meta',
  CACHE_TIMESTAMP: 'medisense_cache_timestamp'
};

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UploadedFileMeta {
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  kind: 'image' | 'pdf';
}

interface PipelineStateCached {
  current: 'upload' | 'extraction' | 'reasoning' | 'complete';
  uploadComplete: boolean;
  extractionComplete: boolean;
  reasoningComplete: boolean;
  summaryReady: boolean;
}

export const analysisCache = {
  /**
   * Save analysis data to localStorage
   */
  saveAnalysis: (analysis: AIAnalysisResult, report: MedicalReport, pipeline: PipelineStateCached) => {
    try {
      localStorage.setItem(CACHE_KEYS.CURRENT_ANALYSIS, JSON.stringify(analysis));
      localStorage.setItem(CACHE_KEYS.CURRENT_REPORT, JSON.stringify(report));
      localStorage.setItem(CACHE_KEYS.PIPELINE_STATE, JSON.stringify(pipeline));
      localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, new Date().toISOString());
    } catch (error) {
      console.error('Failed to save analysis cache:', error);
    }
  },

  /**
   * Save uploaded file metadata (not base64 to save space)
   */
  saveFileMetadata: (file: { name: string; type: string; size: number; uploadedAt: Date; kind: 'image' | 'pdf' }) => {
    try {
      const meta: UploadedFileMeta = {
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: file.uploadedAt.toISOString(),
        kind: file.kind
      };
      localStorage.setItem(CACHE_KEYS.UPLOADED_FILE_META, JSON.stringify(meta));
    } catch (error) {
      console.error('Failed to save file metadata cache:', error);
    }
  },

  /**
   * Retrieve cached analysis
   */
  getAnalysis: (): { analysis: AIAnalysisResult; report: MedicalReport; pipeline: PipelineStateCached } | null => {
    try {
      const timestamp = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
      if (timestamp) {
        const cacheAge = Date.now() - new Date(timestamp).getTime();
        if (cacheAge > CACHE_EXPIRY_MS) {
          analysisCache.clearAnalysis();
          return null;
        }
      }

      const analysis = localStorage.getItem(CACHE_KEYS.CURRENT_ANALYSIS);
      const report = localStorage.getItem(CACHE_KEYS.CURRENT_REPORT);
      const pipeline = localStorage.getItem(CACHE_KEYS.PIPELINE_STATE);

      if (analysis && report && pipeline) {
        return {
          analysis: JSON.parse(analysis),
          report: JSON.parse(report),
          pipeline: JSON.parse(pipeline)
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve analysis cache:', error);
      return null;
    }
  },

  /**
   * Retrieve cached file metadata
   */
  getFileMetadata: (): UploadedFileMeta | null => {
    try {
      const meta = localStorage.getItem(CACHE_KEYS.UPLOADED_FILE_META);
      return meta ? JSON.parse(meta) : null;
    } catch (error) {
      console.error('Failed to retrieve file metadata cache:', error);
      return null;
    }
  },

  /**
   * Clear all cached analysis data
   */
  clearAnalysis: () => {
    try {
      localStorage.removeItem(CACHE_KEYS.CURRENT_ANALYSIS);
      localStorage.removeItem(CACHE_KEYS.CURRENT_REPORT);
      localStorage.removeItem(CACHE_KEYS.PIPELINE_STATE);
      localStorage.removeItem(CACHE_KEYS.UPLOADED_FILE_META);
      localStorage.removeItem(CACHE_KEYS.CACHE_TIMESTAMP);
    } catch (error) {
      console.error('Failed to clear analysis cache:', error);
    }
  },

  /**
   * Check if cache exists and is valid
   */
  hasValidCache: (): boolean => {
    try {
      const timestamp = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
      if (!timestamp) return false;
      const cacheAge = Date.now() - new Date(timestamp).getTime();
      if (cacheAge > CACHE_EXPIRY_MS) {
        analysisCache.clearAnalysis();
        return false;
      }
      return !!localStorage.getItem(CACHE_KEYS.CURRENT_ANALYSIS);
    } catch (error) {
      return false;
    }
  }
};
