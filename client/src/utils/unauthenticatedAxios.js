import axios from 'axios';
import { getApiBaseUrl } from './api';

export const unauthenticatedAxios = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});
