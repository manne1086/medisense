
import { MedicalReport } from '../types';

const API_URL = 'http://localhost:5000/api';

const getAuthToken = () => localStorage.getItem('medisense_auth_token');

export const getHistory = async (): Promise<MedicalReport[]> => {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const response = await fetch(`${API_URL}/records`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch history');
    const data = await response.json();
    // Map MongoDB _id to id field
    return data.map((record: any) => ({
      ...record,
      id: record._id || record.id
    }));
  } catch (error) {
    console.error('Error fetching history:', error);
    return [];
  }
};

export const saveReport = async (report: MedicalReport): Promise<MedicalReport[]> => {
  const token = getAuthToken();
  if (!token) {
    console.error('No auth token found');
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(report)
    });
    if (!response.ok) throw new Error('Failed to save report');
    return await getHistory();
  } catch (error) {
    console.error('Error saving report:', error);
    return [];
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
      throw new Error('Failed to delete report');
    }

    return true;
  } catch (error) {
    console.error('Error deleting report:', error);
    return false;
  }
};
