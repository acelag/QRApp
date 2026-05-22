import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/refunds`;

export const REFUND_METHODS = [
  { value: 'cash',          label: 'Cash',          icon: '💵' },
  { value: 'card',          label: 'Card',          icon: '💳' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { value: 'other',         label: 'Other',         icon: '📋' },
] as const;

export type RefundMethod = typeof REFUND_METHODS[number]['value'];

export function refundMethodLabel(method: string): string {
  return REFUND_METHODS.find((m) => m.value === method)?.label ?? method;
}

export interface Refund {
  id: string;
  orderId:       string | null;
  sessionId:     string | null;
  amount:        number;
  reason:        string;
  refundMethod:  string;
  createdBy:     string;
  createdByName: string;
  createdAt:     string;
}

export interface CreateRefundPayload {
  orderId?:     string;
  sessionId?:   string;
  amount:       number;
  reason:       string;
  refundMethod: string;
}

export const refundService = {
  getRefunds: (limit = 100, offset = 0) =>
    axios.get<Refund[]>(BASE, { params: { limit, offset } }).then((r) => r.data),

  createRefund: (payload: CreateRefundPayload) =>
    axios.post<Refund>(BASE, payload).then((r) => r.data),
};
