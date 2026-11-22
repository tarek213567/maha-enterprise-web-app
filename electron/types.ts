export type PartyType = 'SUPPLIER' | 'BUYER' | 'BOTH';
export type PaymentMethod = 'CASH' | 'BANK' | 'DUE' | 'PARTIAL';
export type AdjustmentType = 'SHRINKAGE' | 'DAMAGE' | 'SPILLAGE' | 'AUDIT_CORRECTION';
export type SectorType = 'jute' | 'maize' | 'mustard' | 'general';
export type SectorFilter = 'all' | 'jute' | 'maize' | 'mustard';
export type CashbookCategory =
  | 'SALE_CASH'
  | 'DUE_COLLECTION'
  | 'PURCHASE_CASH'
  | 'SUPPLIER_PAYMENT'
  | 'EXPENSE'
  | 'CAPITAL_IN'
  | 'DRAWING'
  | 'BANK_TRANSFER'
  | 'OTHER';

export type ExpenseCategory =
  | 'RENT'
  | 'ELECTRICITY'
  | 'SALARY'
  | 'LABOR'
  | 'FOOD_ENTERTAINMENT'
  | 'TRANSPORT'
  | 'REPAIR'
  | 'TAX_LEGAL'
  | 'MISC';

export interface Commodity {
  id: number;
  name_bn: string;
  name_en: string;
  sector?: SectorType;
  default_bag_weight_kg: number;
  current_stock_kg: number;
  current_stock_bags: number;
  current_wac_per_kg: number;
  current_wac_per_mon: number;
  notes?: string;
  is_active: number;
  is_pinned?: number;
  is_test_draft?: number;
  last_payment?: number;
  created_at: string;
  updated_at: string;
}

export interface Party {
  id: number;
  name: string;
  phone?: string;
  address: string;
  party_type: PartyType;
  sector?: SectorType;
  opening_balance: number; // positive = receivable from party, negative = payable to party
  current_balance: number;
  total_due?: number; // alias for current_balance (receivable due)
  notes?: string;
  is_active: number;
  is_pinned?: number;
  is_test_draft?: number;
  last_payment?: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id?: number;
  purchase_id?: number;
  commodity_id: number;
  commodity_name_bn?: string;
  bags_count: number;
  gross_weight_kg: number;
  bag_deduction_kg: number;
  net_weight_kg: number;
  net_weight_mon: number;
  rate_per_mon: number;
  gross_amount: number;
  labor_cost: number;
  transport_cost: number;
  bag_cost: number;
  other_cost: number;
  total_landed_cost: number;
  cost_per_mon: number;
  cost_per_kg: number;
}

export interface Purchase {
  id: number;
  invoice_no: string;
  purchase_date: string;
  sector?: SectorType;
  purchase_scale_kg?: number;
  billed_maund?: number;
  actual_weight_kg?: number;
  extra_weight_kg?: number;
  party_id: number;
  party_name?: string;
  party_phone?: string;
  party_address?: string;
  commodity_id: number;
  commodity_name?: string;
  bags_count: number;
  gross_weight_kg: number;
  bag_deduction_kg: number;
  net_weight_kg: number;
  net_weight_mon: number;
  rate_per_mon: number;
  gross_amount: number;
  labor_cost: number;
  transport_cost: number;
  bag_cost: number;
  other_cost: number;
  total_landed_cost: number;
  cost_per_mon: number;
  cost_per_kg: number;
  payment_method: PaymentMethod;
  paid_amount: number;
  due_amount: number;
  is_test_draft?: number;
  notes?: string;
  created_at: string;
}

export interface Sale {
  id: number;
  invoice_no: string;
  sale_date: string;
  sector?: SectorType;
  party_id: number;
  party_name?: string;
  party_phone?: string;
  party_address?: string;
  commodity_id: number;
  commodity_name?: string;
  bags_count: number;
  gross_weight_kg: number;
  bag_deduction_kg: number;
  net_weight_kg: number;
  net_weight_mon: number;
  rate_per_mon: number;
  gross_amount: number;
  loading_charge: number;
  damaged_bag_deduction: number;
  discount_amount: number;
  net_invoice_amount: number;
  total_amount?: number; // alias for net_invoice_amount
  previous_due?: number; // customer due before this invoice
  paid_amount: number;
  due_amount: number;
  remaining_due?: number; // customer due after this invoice (= grand_total - paid_amount)
  vehicle_no?: string;
  truck_no?: string;
  driver_name?: string;
  driver_phone?: string;
  destination?: string;
  transport_info?: string;
  cogs_amount: number;
  realized_profit: number;
  is_test_draft?: number;
  notes?: string;
  created_at: string;
}

export interface StockAdjustment {
  id: number;
  adjustment_date: string;
  commodity_id: number;
  commodity_name?: string;
  adjustment_type: AdjustmentType;
  lost_weight_kg: number;
  lost_weight_mon: number;
  lost_bags: number;
  wac_at_time: number;
  cost_value: number;
  reason: string;
  notes?: string;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  entry_date: string;
  sector?: 'jute' | 'maize' | 'mustard';
  party_id: number;
  party_name?: string;
  transaction_type: 'PURCHASE' | 'SALE' | 'PAYMENT_RECEIVED' | 'PAYMENT_GIVEN' | 'ADJUSTMENT' | 'OPENING';
  reference_id?: number;
  reference_no?: string;
  debit: number;
  credit: number;
  running_balance: number;
  is_test_draft?: number;
  description: string;
  notes?: string;
  created_at: string;
}

export interface RecycleBinItem {
  id: string;
  module_type: 'purchase' | 'sale' | 'crop' | 'commodity' | 'party' | 'customer' | 'creditor' | 'cashbook' | 'cash' | 'expense' | 'shrinkage' | 'note' | 'ledger' | string;
  module_label: string;
  original_id: string;
  title: string;
  amount: number;
  sector?: string;
  payload_json: string;
  deleted_at: string;
  expires_at: string;
}

export interface CashbookEntry {
  id: number;
  entry_date: string;
  sector?: SectorType;
  entry_type: 'INFLOW' | 'OUTFLOW';
  category: CashbookCategory;
  amount: number;
  payment_mode: 'CASH' | 'BANK';
  reference_id?: number;
  reference_no?: string;
  party_id?: number;
  party_name?: string;
  is_test_draft?: number;
  description: string;
  created_at: string;
}

export interface Expense {
  id: number;
  expense_date: string;
  sector?: SectorType;
  category: ExpenseCategory;
  category_name_bn?: string;
  amount: number;
  paid_to: string;
  payment_mode: 'CASH' | 'BANK';
  is_test_draft?: number;
  notes?: string;
  created_at: string;
}

export interface BusinessProfile {
  org_name: string;
  proprietor: string;
  contacts: string[];
  location: string;
  default_backup_dir: string;
  auto_backup_on_exit: boolean;
  mon_in_kg: number; // 40
}

export interface DashboardStats {
  today_purchases_amount: number;
  today_purchases_mon: number;
  today_sales_amount: number;
  today_sales_cash?: number;
  today_sales_due?: number;
  today_operating_expense?: number;
  today_sales_mon: number;
  today_cash_in: number;
  today_cash_out: number;
  closing_cash_balance: number;
  total_receivable: number;
  total_payable: number;
  total_stock_value: number;
  total_stock_mon: number;
  total_stock_bags: number;
  monthly_sales_revenue: number;
  monthly_gross_profit: number;
  monthly_net_profit: number;
  todaySales?: {
    total_amount: number;
    cash_amount: number;
    due_amount: number;
    mon?: number;
  };
  todayOperatingExpense?: number;
}

export type NoteCategory = 'সাধারণ' | 'জরুরি হিসাব' | 'বেপারী স্মরণিকা' | 'দরদাম' | string;

export interface Note {
  id: number;
  title: string;
  content: string;
  category: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}


