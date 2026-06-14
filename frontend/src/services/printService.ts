import axios from 'axios';
import { getApiError } from '../lib/apiError';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/print`;

export interface PrintResult { success: boolean; message: string }

export interface PrinterStatus {
  receipt: { configured: boolean; online: boolean };
  kitchen: { configured: boolean; online: boolean };
}

async function safePrint(request: () => Promise<PrintResult>): Promise<PrintResult> {
  try {
    return await request();
  } catch (err) {
    return { success: false, message: getApiError(err) };
  }
}

export const printService = {
  kitchen: (orderId: string): Promise<PrintResult> =>
    safePrint(() => axios.post<{ message: string }>(`${BASE}/kitchen/${orderId}`).then((r) => ({ success: true, message: r.data.message }))),

  receipt: (orderId: string): Promise<PrintResult> =>
    safePrint(() => axios.post<{ message: string }>(`${BASE}/receipt/${orderId}`).then((r) => ({ success: true, message: r.data.message }))),

  sessionReceipt: (sessionId: string): Promise<PrintResult> =>
    safePrint(() => axios.post<{ message: string }>(`${BASE}/session/${sessionId}`).then((r) => ({ success: true, message: r.data.message }))),

  test: (role: 'receipt' | 'kitchen'): Promise<PrintResult> =>
    safePrint(() => axios.post<{ message: string }>(`${BASE}/test`, { role }).then((r) => ({ success: true, message: r.data.message }))),

  status: (): Promise<PrinterStatus> =>
    axios.get<PrinterStatus>(`${BASE}/status`).then((r) => r.data),
};
