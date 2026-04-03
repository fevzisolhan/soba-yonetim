import { useState, useCallback, useEffect, useRef } from 'react';
import type { DB, Kasa, ProductCategory } from '@/types';
import { genId } from '@/lib/utils-tr';

// Firebase config
const FIREBASE_PROJECT = 'pars-4850c';
const FIREBASE_API_KEY = 'AIzaSyBL2_YIVMPBwojAfK7pzd2Eg5AG1sUyfig';
const FIREBASE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/sync/main?key=${FIREBASE_API_KEY}`;

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
      { id: 'pos_ziraat', name: 'POS Ziraat', icon: '🏧' },
      { id: 'pos_is', name: 'POS İş', icon: '🏧' },
      { id: 'pos_yk', name: 'POS YapıKredi', icon: '🏧' },
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
    productCategories: [
      { id: 'soba',     name: 'Soba',        icon: '🔥', createdAt: nowIso },
      { id: 'aksesuar', name: 'Aksesuar',     icon: '🔧', createdAt: nowIso },
      { id: 'yedek',    name: 'Yedek Parça',  icon: '⚙️', createdAt: nowIso },
      { id: 'boru',     name: 'Boru',         icon: '🔩', createdAt: nowIso },
      { id: 'pelet',    name: 'Pelet',        icon: '🪵', createdAt: nowIso },
    ] as ProductCategory[],
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
    // POS kasalarını eksikse ekle
    const posIds = ['pos_ziraat', 'pos_is', 'pos_yk'];
    posIds.forEach(pid => {
      if (!merged.kasalar.find((k: Kasa) => k.id === pid)) {
        const defKasa = def.kasalar.find(k => k.id === pid);
        if (defKasa) merged.kasalar.push(defKasa);
      }
    });
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
    if (!Array.isArray(merged.productCategories) || merged.productCategories.length === 0) merged.productCategories = def.productCategories;
    return merged;
  } catch {
    return makeDefaultDB();
  }
}

let _isSaving = false;
let _pendingDb: DB | null = null;

function saveToStorage(db: DB): boolean {
  if (_isSaving) {
    // Kayıt devam ederken yeni veri geldi → beklet
    _pendingDb = db;
    return false;
  }
  _isSaving = true;
  try {
    db._version = (db._version || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  } finally {
    _isSaving = false;
    // Bekleyen veri varsa hemen yaz
    if (_pendingDb) {
      const pending = _pendingDb;
      _pendingDb = null;
      saveToStorage(pending);
    }
  }
}

// Firebase REST API - veriyi Firestore'a kaydet
async function saveToFirebase(db: DB): Promise<void> {
  try {
    const payload = {
      fields: {
        data: { stringValue: JSON.stringify(db) },
        version: { integerValue: String(db._version || 0) },
        updatedAt: { stringValue: new Date().toISOString() },
      }
    };
    await fetch(FIREBASE_DOC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Sessizce hata yut, localStorage zaten kaydetti
  }
}

// Firebase REST API - veriyi Firestore'dan oku
async function loadFromFirebase(): Promise<DB | null> {
  try {
    const res = await fetch(FIREBASE_DOC_URL);
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.fields?.data?.stringValue;
    if (!raw) return null;
    return JSON.parse(raw) as DB;
  } catch {
    return null;
  }
}

export function useDB() {
  const [db, setDb] = useState<DB>(loadFromStorage);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Uygulama açılınca Firebase'den en güncel veriyi çek
  useEffect(() => {
    loadFromFirebase().then(cloudDb => {
      if (!cloudDb) return;
      const localDb = loadFromStorage();
      // Hangisi daha yeni ise onu kullan
      if ((cloudDb._version || 0) > (localDb._version || 0)) {
        saveToStorage(cloudDb);
        setDb(cloudDb);
      }
    });
    // Cleanup: unmount'ta pending Firebase sync'i iptal et
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, []);

  const save = useCallback((updater: (prev: DB) => DB) => {
    setDb(prev => {
      const next = updater(prev);
      saveToStorage(next);
      // Debounce: 1 saniye bekle sonra Firebase'e gönder
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        saveToFirebase(next);
      }, 1000);
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
          const raw = JSON.parse(e.target?.result as string);
          // Güvenlik: default yapıyla merge et, eksik alanları tamamla
          const def = makeDefaultDB();
          const data: DB = { ...def, ...raw };
          // Zorunlu array alanları kontrol et
          const arrayKeys: (keyof DB)[] = ['products','sales','suppliers','orders','cari','kasa','bankTransactions','matchRules','monitorRules','monitorLog','stockMovements','peletSuppliers','peletOrders','boruSuppliers','boruOrders','invoices','budgets','returns','_activityLog','ortakEmanetler','installments'];
          for (const key of arrayKeys) {
            if (!Array.isArray(data[key])) (data as any)[key] = [];
          }
          if (!data.kasalar || data.kasalar.length === 0) data.kasalar = def.kasalar;
          if (!data.company || typeof data.company !== 'object') data.company = def.company;
          if (!data.pelletSettings) data.pelletSettings = def.pelletSettings;
          if (!Array.isArray(data.productCategories) || data.productCategories.length === 0) data.productCategories = def.productCategories;
          setDb(data);
          saveToStorage(data);
          saveToFirebase(data);
          resolve(true);
        } catch {
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const getKasaBakiye = useCallback((kasaId: string) => {
    return db.kasa.filter(k => !k.deleted && k.kasa === kasaId).reduce((sum, k) => {
      return sum + (k.type === 'gelir' ? k.amount : -k.amount);
    }, 0);
  }, [db.kasa]);

  const getTotalKasa = useCallback(() => {
    return db.kasa.filter(k => !k.deleted).reduce((sum, k) => sum + (k.type === 'gelir' ? k.amount : -k.amount), 0);
  }, [db.kasa]);

  return { db, save, logActivity, exportJSON, importJSON, getKasaBakiye, getTotalKasa };
}