
import { MedicalReport } from '../types';
import { AUTH_FAILURE_MESSAGE, getAuthToken, handleAuthFailure } from './authService';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000';
const API_URL = `${API_BASE}/api`;

export const getHistory = async (): Promise<MedicalReport[]> => {
  const token = getAuthToken();
  if (!token) {
    console.warn('No auth token found - cannot fetch history');
    return [];
  }

  try {
    console.log('[storageService] Fetching history from:', `${API_URL}/records`);
    const response = await fetch(`${API_URL}/records`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData.error || errData.message || response.statusText;
      if (response.status === 401) {
        handleAuthFailure(message);
        return [];
      }
      throw new Error(`Server returned ${response.status}: ${message}`);
    }
    
    const data = await response.json();
    console.log('[storageService] Received', data.length, 'records from server');
    
    // Map MongoDB _id to id field
    return data.map((record: any) => ({
      ...record,
      id: record._id || record.id
    }));
  } catch (error) {
    console.error('[storageService] Error fetching history:', error);
    return [];
  }
};

export const saveReport = async (report: MedicalReport): Promise<MedicalReport[]> => {
  const token = getAuthToken();
  if (!token) {
    console.error('[storageService] No auth token found - cannot save report');
    throw new Error(AUTH_FAILURE_MESSAGE);
  }

  try {
    console.log('[storageService] Saving report:', report.type, 'to:', `${API_URL}/records`);
    
    // Ensure date is set
    const reportWithDate = {
      ...report,
      date: report.date || new Date().toISOString()
    };

    const response = await fetch(`${API_URL}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(reportWithDate)
    });

    console.log('[storageService] Save response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[storageService] Server error:', response.status, errorData);
      const message = errorData.error || errorData.message || response.statusText;
      if (response.status === 401) {
        throw new Error(handleAuthFailure(message));
      }
      throw new Error(`Server error: ${response.status} - ${message}`);
    }

    console.log('[storageService] Report saved successfully');
    
    // Fetch fresh history to ensure sync
    const history = await getHistory();
    console.log('[storageService] Fetched updated history with', history.length, 'records');
    return history;
  } catch (error) {
    console.error('[storageService] Error saving report:', error);
    throw error; // Propagate error so caller can handle it
  }
};

export const clearHistory = async (): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token found');
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/records`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleAuthFailure(errorData.error || errorData.message || response.statusText);
        return false;
      }
      throw new Error('Failed to clear history');
    }

    return true;
  } catch (error) {
    console.error('Error clearing history:', error);
    return false;
  }
};

export const deleteReport = async (reportId: string): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token found');
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/records/${reportId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleAuthFailure(errorData.error || errorData.message || response.statusText);
        return false;
      }
      throw new Error('Failed to delete report');
    }

    return true;
  } catch (error) {
    console.error('Error deleting report:', error);
    return false;
  }
};
