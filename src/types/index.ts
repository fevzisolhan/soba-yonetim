export interface Product {
  id: string;
  name: string;
  category: 'soba' | 'aksesuar' | 'yedek' | 'boru' | 'pelet';
  brand?: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  barcode?: string;
  description?: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  cost: number;
  total: number;
}

export interface Sale {
  id: string;
  customerId?: string;
  productId?: string;
  productName: string;
  productCategory?: string;
  quantity: number;
  unitPrice: number;
  cost: number;
  discount: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  profit: number;
  payment: 'nakit' | 'kart' | 'havale' | 'cari';
  status: 'tamamlandi' | 'iade' | 'iptal';
  returnReason?: string;
  returnNote?: string;
  returnedAt?: string;
  items?: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  taxNo?: string;
  contact?: string;
  phone: string;
  email?: string;
  address?: string;
  keywords?: string;
  note?: string;
  totalOrders: number;
  totalAmount: number;
  cariId?: string;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
}

export interface OrderPayment {
  id: string;
  amount: number;
  type: string;
  date: string;
  note?: string;
  by?: string;
}

export interface Order {
  id: string;
  supplierId: string;
  items: OrderItem[];
  products?: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentType?: string;
  paymentNote?: string;
  payments: OrderPayment[];
  deliveryDate?: string;
  note?: string;
  status: 'bekliyor' | 'yolda' | 'tamamlandi' | 'iptal';
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  share?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Cari {
  id: string;
  name: string;
  type: 'musteri' | 'tedarikci';
  taxNo?: string;
  phone?: string;
  email?: string;
  address?: string;
  keywords?: string;
  balance: number;
  lastTransaction?: string;
  ortak?: boolean;
  partnerId?: string;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KasaEntry {
  id: string;
  type: 'gelir' | 'gider';
  category?: string;
  amount: number;
  kasa: string;
  cariId?: string;
  description?: string;
  relatedId?: string;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  matchedCariId?: string;
  matchScore: number;
  status: 'unmatched' | 'matched' | 'confirmed';
  hash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchRule {
  id: string;
  name: string;
  keywords: string;
  cariId?: string;
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorRule {
  id: string;
  name: string;
  type: 'stok_min' | 'stok_sifir' | 'kasa_min' | 'alacak_vadeli' | 'borc_vadeli' | 'satis_hedef';
  level: 'critical' | 'warning' | 'info';
  interval: number;
  popup: boolean;
  active: boolean;
  threshold?: number;
  kasa?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorLog {
  id: string;
  ruleId?: string;
  ruleName?: string;
  level?: string;
  message?: string;
  time: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'giris' | 'cikis' | 'duzeltme' | 'satis' | 'siparis';
  amount: number;
  before: number;
  after: number;
  note?: string;
  date: string;
}

export interface PeletSupplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  tonPrice?: number;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PeletOrder {
  id: string;
  supplierId: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  deliveryDate?: string;
  note?: string;
  status: 'bekliyor' | 'yolda' | 'tamamlandi' | 'iptal';
  createdAt: string;
  updatedAt: string;
}

export interface BoruSupplier {
  id: string;
  name: string;
  type?: string;
  taxNo?: string;
  contact?: string;
  phone: string;
  email?: string;
  address?: string;
  note?: string;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoruOrder {
  id: string;
  supplierId: string;
  items: string;
  amount: number;
  deliveryDate?: string;
  note?: string;
  status: 'bekliyor' | 'yolda' | 'tamamlandi' | 'iptal';
  createdAt: string;
  updatedAt: string;
}

export interface Kasa {
  id: string;
  name: string;
  icon: string;
}

export interface Company {
  id: string;
  name?: string;
  taxNo?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: string;
}

export interface Return {
  id: string;
  saleId?: string;
  reason?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  detail?: string;
  time: string;
}

export interface PelletSettings {
  gramaj: number;
  kgFiyat: number;
  cuvalKg: number;
  critDays: number;
}

export interface InvoiceItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  type: 'satis' | 'alis';
  cariId?: string;
  cariName: string;
  cariTaxNo?: string;
  cariAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  vatTotal: number;
  discount: number;
  total: number;
  payment: 'nakit' | 'kart' | 'havale' | 'cari' | 'cek';
  status: 'taslak' | 'onaylandi' | 'iptal' | 'odendi';
  dueDate?: string;
  note?: string;
  kasaEntryId?: string;
  cariUpdated?: boolean;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  monthlyLimit: number;
  color: string;
  kasaCategories: string[];
}

export interface Budget {
  categories: BudgetCategory[];
  year: number;
  month: number;
}

export interface Installment {
  id: string;
  invoiceId: string;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: 'bekliyor' | 'odendi' | 'gecikti';
  note?: string;
  createdAt: string;
}

export interface DB {
  _version: number;
  products: Product[];
  sales: Sale[];
  suppliers: Supplier[];
  orders: Order[];
  cari: Cari[];
  kasa: KasaEntry[];
  kasalar: Kasa[];
  bankTransactions: BankTransaction[];
  matchRules: MatchRule[];
  monitorRules: MonitorRule[];
  monitorLog: MonitorLog[];
  stockMovements: StockMovement[];
  peletSuppliers: PeletSupplier[];
  peletOrders: PeletOrder[];
  boruSuppliers: BoruSupplier[];
  boruOrders: BoruOrder[];
  returns: Return[];
  _activityLog: ActivityLog[];
  company: Company;
  settings: Record<string, unknown>;
  pelletSettings: PelletSettings;
  invoices: Invoice[];
  budgets: BudgetCategory[];
  partners: Partner[];
  ortakEmanetler: unknown[];
  installments: Installment[];
}
