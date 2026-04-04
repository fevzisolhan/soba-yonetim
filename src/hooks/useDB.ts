import { useState, useCallback, useEffect, useRef } from 'react';
import type { DB, Kasa, ProductCategory } from '@/types';
import { genId } from '@/lib/utils-tr';
import { logger } from '@/lib/logger';

// Firebase config
const FIREBASE_PROJECT = 'pars-4850c';
const FIREBASE_API_KEY = 'AIzaSyBL2_YIVMPBwojAfK7pzd2Eg5AG1sUyfig';
const FIREBASE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/sync/main?key=${FIREBASE_API_KEY}`;

// ── Sync durum yayıncısı ────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'loading';
type SyncListener = (status: SyncStatus, detail?: string) => void;
const _syncListeners: SyncListener[] = [];
let _currentSyncStatus: SyncStatus = 'idle';

function emitSync(status: SyncStatus, detail?: string) {
  _currentSyncStatus = status;
  _syncListeners.forEach(fn => { try { fn(status, detail); } catch { /* ignore */ } });
}

export function onSyncStatus(fn: SyncListener): () => void {
  _syncListeners.push(fn);
  return () => { const i = _syncListeners.indexOf(fn); if (i >= 0) _syncListeners.splice(i, 1); };
}
export function getSyncStatus() { return _currentSyncStatus; }

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

// ── Firebase REST API ───────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // üstel geri çekilme

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        const delay = RETRY_DELAYS[attempt] ?? 8000;
        logger.warn('firebase', `Bağlantı denemesi ${attempt + 1}/${retries + 1} başarısız — ${delay}ms bekleyip tekrar denenecek`, { error: String(e) });
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

async function saveToFirebase(db: DB): Promise<void> {
  const t = logger.time('firebase', `Firebase kayıt v${db._version}`);
  emitSync('saving');
  try {
    const payload = {
      fields: {
        data: { stringValue: JSON.stringify(db) },
        version: { integerValue: String(db._version || 0) },
        updatedAt: { stringValue: new Date().toISOString() },
      }
    };
    const res = await fetchWithRetry(FIREBASE_DOC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const ms = t.end({ version: db._version, ok: res.ok });
    if (res.ok) {
      emitSync('saved', `v${db._version} · ${ms}ms`);
      logger.info('sync', `Firebase\'e kaydedildi`, { version: db._version, ms });
    } else {
      const body = await res.text().catch(() => '');
      emitSync('error', `HTTP ${res.status}`);
      logger.error('firebase', `Firebase kayıt hatası HTTP ${res.status}`, { body: body.slice(0, 200) });
    }
  } catch (e) {
    t.end({ error: String(e) });
    emitSync('error', 'Bağlantı hatası');
    logger.error('firebase', 'Firebase kayıt tamamen başarısız', { error: String(e) });
  }
}

async function loadFromFirebase(): Promise<DB | null> {
  const t = logger.time('firebase', 'Firebase yükle');
  try {
    const res = await fetchWithRetry(FIREBASE_DOC_URL, { method: 'GET' });
    if (!res.ok) { t.end({ status: res.status }); return null; }
    const json = await res.json();
    const raw = json?.fields?.data?.stringValue;
    if (!raw) { t.end({ empty: true }); return null; }
    const data = JSON.parse(raw) as DB;
    const ms = t.end({ version: data._version });
    logger.info('firebase', 'Firebase\'den yüklendi', { version: data._version, ms });
    return data;
  } catch (e) {
    t.end({ error: String(e) });
    logger.warn('firebase', 'Firebase yükleme başarısız (çevrimdışı?)', { error: String(e) });
    return null;
  }
}

export function useDB() {
  const [db, setDb] = useState<DB>(loadFromStorage);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Uygulama açılınca Firebase'den en güncel veriyi çek
  useEffect(() => {
    emitSync('loading');
    logger.info('db', 'Uygulama DB yükleniyor', { localVersion: db._version });
    loadFromFirebase().then(cloudDb => {
      if (!cloudDb) {
        emitSync('idle');
        logger.info('db', 'Firebase boş, yerel veri kullanılıyor');
        return;
      }
      const localDb = loadFromStorage();
      if ((cloudDb._version || 0) > (localDb._version || 0)) {
        logger.info('db', 'Bulut verisi daha güncel — güncelleniyor', {
          local: localDb._version, cloud: cloudDb._version
        });
        saveToStorage(cloudDb);
        setDb(cloudDb);
      } else {
        logger.info('db', 'Yerel veri güncel', { version: localDb._version });
      }
      emitSync('idle');
    });
    // Cleanup: unmount'ta pending Firebase sync'i iptal et
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback((updater: (prev: DB) => DB) => {
    setDb(prev => {
      const t = logger.time('db', 'save()');
      const next = updater(prev);
      // Sync timestamp ekle
      (next as DB & { _lastSyncAt?: string })._lastSyncAt = new Date().toISOString();
      saveToStorage(next);
      t.end({ version: next._version });
      // Debounce: 1.2 saniye bekle sonra Firebase'e gönder
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        saveToFirebase(next);
      }, 1200);
      return next;
    });
  }, []);

  const logActivity = useCallback((action: string, detail?: string) => {
    save(prev => {
      const log = [{ id: genId(), action, detail: detail || '', time: new Date().toISOString() }, ...(prev._activityLog || [])].slice(0, 200);
      return { ...prev, _activityLog: log };
    });
  }, [save]);

  // Otomatik aktivite loglayan save wrapper'ı
  const saveWithLog = useCallback((updater: (prev: DB) => DB, action?: string, detail?: string) => {
    save(prev => {
      let next = updater(prev);
      if (action) {
        const log = [{ id: genId(), action, detail: detail || '', time: new Date().toISOString() }, ...(next._activityLog || [])].slice(0, 200);
        next = { ...next, _activityLog: log };
      }
      return next;
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

  return { db, save, saveWithLog, logActivity, exportJSON, importJSON, getKasaBakiye, getTotalKasa, emitSync };
}