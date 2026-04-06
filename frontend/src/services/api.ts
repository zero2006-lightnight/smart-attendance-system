import axios from 'axios';

const API_BASE_URL = 'https://smart-attendance-api-sjii.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth service
export const auth = {
  register: async (email: string, password: string, name: string) => {
    const response = await api.post('/auth/register', { email, password, name });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Admin user management service
export const adminUsers = {
  createUser: async (email: string, name: string, password?: string, role?: string) => {
    const response = await api.post('/admin/users', { email, name, password, role });
    return response.data;
  },

  listUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },

  deleteUser: async (userId: number) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },
};

// Face enrollment service
export const faceEnrollment = {
  enrollFace: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/users/face-enroll', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Attendance service
export const attendance = {
  getTodayStats: async () => {
    const response = await api.get('/attendance/today');
    return response.data;
  },

  getRecent: async (limit: number = 10) => {
    const response = await api.get(`/attendance/recent?limit=${limit}`);
    return response.data;
  },
};

// Recognition service
export interface BoundingBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RecognitionMatch {
  user_id: number;
  name: string;
  email: string;
  confidence: number;
}

export interface FaceDetectionResponse {
  faces: BoundingBox[];
  count: number;
}

export interface RecognitionResponse {
  matches: RecognitionMatch[];
  unknown_count: number;
}

export interface LivenessResponse {
  is_live: boolean;
  blink_count: number;
  confidence: number;
  message: string;
}

export const recognition = {
  detectFaces: async (imageBase64: string): Promise<FaceDetectionResponse> => {
    const response = await api.post('/recognition/detect', { image: imageBase64 });
    return response.data;
  },

  recognizeFaces: async (imageBase64: string): Promise<RecognitionResponse> => {
    const response = await api.post('/recognition/recognize', { image: imageBase64 });
    return response.data;
  },

  checkLiveness: async (frames: { frame: string; timestamp: number }[]): Promise<LivenessResponse> => {
    const response = await api.post('/recognition/liveness', { frames });
    return response.data;
  },

  markAttendance: async (userId: number, photoData?: string) => {
    const response = await api.post('/recognition/mark-attendance', { 
      user_id: userId, 
      photo_data: photoData 
    });
    return response.data;
  },
};

export default api;