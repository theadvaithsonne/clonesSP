import axios from 'axios';

export const officeApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_OFFICE_API_URL ?? 'https://backend.networkchains.com',
});

officeApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('office_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
