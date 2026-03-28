import { useState, useCallback, useEffect } from 'react';
import type { DB, Kasa } from '@/types';
import { genId } from '@/lib/utils-tr';

const STORAGE_KEY = 'sobaYonetim';

function makeDefaultDB(): DB {
  const nowIso = new Date().toISOString();
  return {
    _version: 0,
    products: [],
    sales: [],
    suppliers: [],
    orders: [],
    cari: [],
    kasa: [],
    kasalar: [
      { id: 'nakit', name: 'Nakit', icon: '💵' },
      { id: 'banka', name: 'Banka', icon: '🏦' },
    ] as Kasa[],
    bankTransactions: [],
    matchRules: [],
    monitorRules: [
      { id: genId(), isDefault: true, createdAt: nowIso, updatedAt: nowIso, name: 'Stok Tükendi Uyarısı', type: 'stok_sifir', level: 'critical', interval: 30, popup: true, active: true, threshold: 0 },
      { id: genId(), isDefault: true, createdAt: nowIso, updatedAt: nowIso, name: 'Düşük Stok Uyarısı', type: 'stok_min', level: 'warning', interval: 60, popup: true, active: true, threshold: undefined },
      { id: genId(), isDefault: true, createdAt: nowIso, updatedAt: nowIso, name: 'Düşük Kasa Bakiyesi', type: 'kasa_min', level: 'warning', interval: 300, popup: true, active: true, threshold: 1000, kasa: 'nakit' },
    ],
    monitorLog: [],
    stockMovements: [],
    peletSuppliers: [],
    peletOrders: [],
    boruSuppliers: [],
    boruOrders: [],
    invoices: [],
    budgets: [],
    returns: [],
    _activityLog: [],
    company: { id: genId(), createdAt: nowIso },
    settings: {},
    pelletSettings: { gramaj: 14, kgFiyat: 6.5, cuvalKg: 15, critDays: 3 },
    ortakEmanetler: [],
    installments: [],
  };
}

function loadFromStorage(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultDB();
    const parsed = JSON.parse(raw);
    const def = makeDefaultDB();
    const merged = { ...def, ...parsed };
    if (!merged.kasalar || merged.kasalar.length === 0) merged.kasalar = def.kasalar;
    if (!merged.monitorRules || merged.monitorRules.length === 0) merged.monitorRules = def.monitorRules;
    if (!merged.pelletSettings) merged.pelletSettings = def.pelletSettings;
    if (!merged.company || typeof merged.company !== 'object') merged.company = def.company;
    if (!Array.isArray(merged.products)) merged.products = [];
    if (!Array.isArray(merged.sales)) merged.sales = [];
    if (!Array.isArray(merged.suppliers)) merged.suppliers = [];
    if (!Array.isArray(merged.orders)) merged.orders = [];
    if (!Array.isArray(merged.cari)) merged.cari = [];
    if (!Array.isArray(merged.kasa)) merged.kasa = [];
    if (!Array.isArray(merged.bankTransactions)) merged.bankTransactions = [];
    if (!Array.isArray(merged.matchRules)) merged.matchRules = [];
    if (!Array.isArray(merged.monitorLog)) merged.monitorLog = [];
    if (!Array.isArray(merged.stockMovements)) merged.stockMovements = [];
    if (!Array.isArray(merged.peletSuppliers)) merged.peletSuppliers = [];
    if (!Array.isArray(merged.peletOrders)) merged.peletOrders = [];
    if (!Array.isArray(merged.boruSuppliers)) merged.boruSuppliers = [];
    if (!Array.isArray(merged.boruOrders)) merged.boruOrders = [];
    if (!Array.isArray(merged.invoices)) merged.invoices = [];
    if (!Array.isArray(merged.budgets)) merged.budgets = [];
    if (!Array.isArray(merged.returns)) merged.returns = [];
    if (!Array.isArray(merged._activityLog)) merged._activityLog = [];
    if (!Array.isArray(merged.ortakEmanetler)) merged.ortakEmanetler = [];
    if (!Array.isArray(merged.installments)) merged.installments = [];
    return merged;
  } catch {
    return makeDefaultDB();
  }
}

let _isSaving = false;
let _lastSaveTime = 0;

function saveToStorage(db: DB): boolean {
  const now = Date.now();
  if (_isSaving || now - _lastSaveTime < 200) return false;
  _isSaving = true;
  _lastSaveTime = now;
  try {
    db._version = (db._version || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  } finally {
    _isSaving = false;
  }
}

export function useDB() {
  const [db, setDb] = useState<DB>(loadFromStorage);

  const save = useCallback((updater: (prev: DB) => DB) => {
    setDb(prev => {
      const next = updater(prev);
      saveToStorage(next);
      return next;
    });
  }, []);

  const logActivity = useCallback((action: string, detail?: string) => {
    save(prev => {
      const log = [{ id: genId(), action, detail: detail || '', time: new Date().toISOString() }, ...(prev._activityLog || [])].slice(0, 50);
      return { ...prev, _activityLog: log };
    });
  }, [save]);

  const exportJSON = useCallback(() => {
    const data = JSON.stringify(db, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soba-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [db]);

  const importJSON = useCallback((file: File): Promise<boolean> => {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          setDb(data);
          saveToStorage(data);
          resolve(true);
        } catch {
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  // Kasa bakiyeleri
  const getKasaBakiye = useCallback((kasaId: string) => {
    return db.kasa.filter(k => k.kasa === kasaId).reduce((sum, k) => {
      return sum + (k.type === 'gelir' ? k.amount : -k.amount);
    }, 0);
  }, [db.kasa]);

  const getTotalKasa = useCallback(() => {
    return db.kasa.reduce((sum, k) => sum + (k.type === 'gelir' ? k.amount : -k.amount), 0);
  }, [db.kasa]);

  return { db, save, logActivity, exportJSON, importJSON, getKasaBakiye, getTotalKasa };
}
