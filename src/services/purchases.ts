import { dbService } from './api';

export const paymentMap: Record<string, 'CASH' | 'BANK' | 'DUE' | 'PARTIAL'> = {
  'নগদ পরিশোধ': 'CASH',
  'নগদ': 'CASH',
  'CASH': 'CASH',
  'সম্পূর্ণ বাকি': 'DUE',
  'বাকি': 'DUE',
  'DUE': 'DUE',
  'CREDIT': 'DUE',
  'UNPAID': 'DUE',
  'আংশিক বাকি': 'PARTIAL',
  'আংশিক': 'PARTIAL',
  'PARTIAL': 'PARTIAL',
  'ব্যাংক': 'BANK',
  'BANK': 'BANK',
};

export const resolvePaymentMethod = (
  payment: string,
  paidAmount?: number,
  grossAmount?: number
): 'CASH' | 'BANK' | 'DUE' | 'PARTIAL' => {
  if (paymentMap[payment]) return paymentMap[payment];
  if (paidAmount !== undefined && grossAmount !== undefined) {
    if (paidAmount >= grossAmount) return 'CASH';
    if (paidAmount <= 0) return 'DUE';
    return 'PARTIAL';
  }
  return 'CASH';
};

export const purchaseService = dbService.purchases;
export default purchaseService;

