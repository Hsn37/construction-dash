export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total: number;
  image_urls: string;
  created_at: string;
}

export interface Advance {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface Category {
  id: string;
  label: string;
  active: number; // 1 | 0 (SQLite integer boolean)
}
