import axios from 'axios';
import type { User, GovernmentProgramTypeValue } from '../../types/auth';

const BENEFICIARY_TYPE_MAP: Record<string, GovernmentProgramTypeValue> = {
  seniorCitizen: 'SENIOR_CITIZEN',
  pwd: 'PWD',
  student: 'STUDENT',
  soloParent: 'SOLO_PARENT',
  healthcareWorker: 'HEALTHCARE_WORKER',
};

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timeout. Please check your connection and try again.';
    }
    if (error.response?.status === 401) {
      error.message = error.response?.data?.message || 'Session expired. Please log in again.';
    }
    // Server-side error responses — translate to friendly user-facing messages.
    if (error.response?.status === 504) {
      return Promise.reject(new Error('The server took too long to respond. Please try again.'));
    }
    if (error.response?.status === 503) {
      return Promise.reject(new Error('Service is temporarily unavailable. Please try again in a moment.'));
    }
    if (error.response?.status === 429) {
      return Promise.reject(new Error('Too many requests. Please slow down and try again in a minute.'));
    }
    return Promise.reject(error);
  }
);

function buildResidentUser(resident: Record<string, unknown>): User {
  const firstName = (resident.firstName as string) || '';
  const lastName = (resident.lastName as string) || '';
  const middleName = (resident.middleName as string) || '';
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

  // Collect the resident's beneficiary types from the backend response
  const beneficiaryTypes: GovernmentProgramTypeValue[] = [];
  for (const [key, type] of Object.entries(BENEFICIARY_TYPE_MAP)) {
    if (resident[key] != null) {
      beneficiaryTypes.push(type);
    }
  }

  return {
    id: resident.id as string,
    name: fullName || (resident.username as string) || 'Resident',
    email: (resident.email as string) || '',
    username: (resident.username as string) || '',
    residentId: resident.residentId as string | undefined,
    role: 'resident',
    status: resident.status as string | undefined,
    barangay: resident.barangay as User['barangay'],
    picturePath: (resident.picturePath as string) || null,
    createdAt: (resident.createdAt as string) || new Date().toISOString(),
    beneficiaryTypes,
    firstName,
    middleName,
    lastName,
    extensionName: (resident.extensionName as string) || null,
    birthdate: (resident.birthdate as string) || null,
    sex: (resident.sex as string) || null,
    civilStatus: (resident.civilStatus as string) || null,
    streetAddress: (resident.streetAddress as string) || null,
    contactNumber: (resident.contactNumber as string) || null,
    emergencyContactPerson: (resident.emergencyContactPerson as string) || null,
    emergencyContactNumber: (resident.emergencyContactNumber as string) || null,
  } as User;
}

export const authService = {
  async portalLogin(credentials: { credential: string; password: string }): Promise<{ resident: Record<string, unknown> }> {
    try {
      const response = await api.post('/auth/portal/login', credentials);
      const result = response.data.data;
      if (!result?.resident) throw new Error('Invalid response from server');
      return { resident: result.resident };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(err.response?.data?.message || err.message || 'Login failed');
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // silent
    }
  },

  async getIdCardInfo(): Promise<{
    barangayName?: string;
    barangayLogoPath?: string | null;
    municipality?: {
      municipalityName?: string;
      municipalityLogoPath?: string | null;
      idBackgroundFrontPath?: string | null;
      idBackgroundBackPath?: string | null;
    } | null;
  }> {
    try {
      const response = await api.get('/auth/id-card-info');
      return response.data.data ?? {};
    } catch {
      return {};
    }
  },

  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get('/auth/me');
      const data = response.data.data;
      if (data.resident) return buildResidentUser(data.resident);
      throw new Error('Not a resident account');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(err.response?.data?.message || err.message || 'Not authenticated');
    }
  },

  async updateMyProfile(payload: Record<string, unknown>): Promise<void> {
    try {
      await api.put('/residents/me', payload);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(err.response?.data?.message || err.message || 'Failed to update profile');
    }
  },
};

export default api;
