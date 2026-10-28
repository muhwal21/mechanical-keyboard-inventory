<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import {
  AlertTriangle, ArrowDownToLine, ArrowDownUp, ArrowUpFromLine, Boxes, Building2,
  Check, ChevronDown, CircleDollarSign, ExternalLink, History, Keyboard,
  LayoutDashboard, LogOut, Mail, MapPin, Package, Phone, Plus, Search,
  Settings, ShieldCheck, Truck, X, Moon, Sun,
} from '@lucide/vue';
import { get, post, put, remove, setCsrfToken } from './api.js';

const user = ref(null);
function readThemePreference() {
  try {
    const saved = localStorage.getItem('keystock-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Browser storage can be blocked; fall back to the system preference below.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const themeMode = ref(readThemePreference());
document.documentElement.dataset.theme = themeMode.value;

function setTheme(mode) {
  themeMode.value = mode;
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem('keystock-theme', mode);
  } catch {
    // Theme still applies for this page even if browser storage is unavailable.
  }
}

function toggleTheme() {
  setTheme(themeMode.value === 'dark' ? 'light' : 'dark');
}

const checkingSession = ref(true);
const apiUnavailable = ref(false);
const activePage = ref('overview');
const loading = ref(false);
const busy = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const csrfToken = ref('');
const dashboard = ref({ summary: {}, categories: [], lowStockProducts: [], movementTrend: [], recentMovements: [] });
const products = ref([]); // rows shown in the product table (may be filtered)
const catalog = ref([]); // every active product, used by dropdowns and counts
const categories = ref([]);
const suppliers = ref([]);
const movements = ref([]);
const searchQuery = ref('');
const selectedCategory = ref('');
const selectedSupplier = ref('');
const stockFilter = ref('all');
const movementSearch = ref('');
const movementTypeFilter = ref('');
const productModalOpen = ref(false);
const supplierModalOpen = ref(false);
const movementModalOpen = ref(false);
const pendingConfirmation = ref(null);
const editingProduct = ref(null);
const editingSupplier = ref(null);
// Validation feedback shown inside the open dialog (page notices sit behind the backdrop).
const formError = ref('');
const fieldErrors = ref({});

const loginForm = reactive({ email: '', password: '' });
const productForm = reactive({
  sku: '', name: '', brand: '', category_id: '', supplier_id: '', description: '',
  price_min: '', price_max: '', purchase_price: '', selling_price: '', currency: 'IDR',
  listing_status: 'Ready', reorder_point: 10, storage_location: '', source_url: '',
  image_url: '', specifications: {}, variants: [], is_active: true,
});
const supplierForm = reactive({
  name: '', contact_person: '', phone: '', email: '', city: '', website: '', notes: '', is_active: true,
});
const movementForm = reactive({ product_id: '', movement_type: 'IN', quantity: '', note: '' });

const pageTitle = computed(() => ({
  overview: 'Ringkasan stok',
  products: 'Produk',
  suppliers: 'Supplier',
  movements: 'Pergerakan stok',
}[activePage.value]));

const navItems = [
  { id: 'overview', label: 'Ringkasan', short: 'Ringkasan', icon: LayoutDashboard },
  { id: 'products', label: 'Produk', short: 'Produk', icon: Package },
  { id: 'suppliers', label: 'Supplier', short: 'Supplier', icon: Truck },
  { id: 'movements', label: 'Pergerakan stok', short: 'Stok', icon: ArrowDownUp },
];

const today = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date());
const filteredProducts = computed(() => products.value.filter((product) => (
  !selectedSupplier.value || String(product.supplier_id) === selectedSupplier.value
)));
const productStats = computed(() => {
  const rows = filteredProducts.value;
  return {
    sku: rows.length,
    units: rows.reduce((sum, product) => sum + Number(product.warehouse_stock || 0), 0),
    lowStock: rows.filter((product) => Number(product.warehouse_stock) <= Number(product.reorder_point)).length,
    supplied: rows.filter((product) => product.supplier_id).length,
  };
});

const selectedMovementProduct = computed(() => (
  catalog.value.find((product) => String(product.id) === String(movementForm.product_id)) ?? null
));

// Preview of the balance after saving, mirroring the rules in server/src/services/stockService.js.
const movementPreview = computed(() => {
  const product = selectedMovementProduct.value;
  if (!product || movementForm.quantity === '' || movementForm.quantity == null) return null;
  const quantity = Number(movementForm.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) return null;
  const before = Number(product.warehouse_stock);
  const after = {
    IN: before + quantity,
    OUT: before - quantity,
    ADJUSTMENT: quantity,
  }[movementForm.movement_type];
  return { before, after, invalid: after < 0 };
});

const filteredMovements = computed(() => {
  const term = movementSearch.value.trim().toLowerCase();
  return movements.value.filter((item) => {
    if (movementTypeFilter.value && item.movement_type !== movementTypeFilter.value) return false;
    if (!term) return true;
    return [item.product?.name, item.product?.sku, item.product?.brand, item.user?.name, item.note]
      .some((value) => value?.toLowerCase().includes(term));
  });
});

function clearNotices() {
  errorMessage.value = '';
  successMessage.value = '';
}

function showSuccess(message) {
  errorMessage.value = '';
  successMessage.value = message;
  window.setTimeout(() => { successMessage.value = ''; }, 3500);
}

function handleError(error) {
  errorMessage.value = error.message || 'Terjadi kesalahan. Coba lagi.';
  successMessage.value = '';
}

function clearFormErrors() {
  formError.value = '';
  fieldErrors.value = {};
}

async function handleFormError(error) {
  formError.value = error.message || 'Data belum bisa disimpan. Coba lagi.';
  fieldErrors.value = error.fields ?? {};
  // Bring the first invalid field (or the summary notice) into view inside the dialog.
  await nextTick();
  document.querySelector('.modal-body .invalid, .modal-body .error-notice')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function toFormNumber(value) {
  return value == null || value === '' ? '' : Number(value);
}

async function refreshCsrf() {
  const response = await get('/auth/csrf');
  csrfToken.value = response.csrfToken;
  setCsrfToken(response.csrfToken);
}

async function loadAll({ clear = true } = {}) {
  loading.value = true;
  if (clear) clearNotices();
  try {
    const supplierPath = user.value?.role === 'admin' ? '/suppliers?includeArchived=true' : '/suppliers';
    const requests = [get('/dashboard'), get('/categories'), get('/products'), get(supplierPath), get('/stock-movements')];
    if (hasProductFilters()) requests.push(get(productQuery()));
    const [summary, categoryData, catalogData, supplierData, movementData, filteredData] = await Promise.all(requests);
    dashboard.value = summary;
    categories.value = categoryData.categories;
    catalog.value = catalogData.products;
    products.value = (filteredData ?? catalogData).products;
    suppliers.value = supplierData.suppliers;
    movements.value = movementData.movements;
  } catch (error) {
    if (error.message.includes('API belum tersambung')) apiUnavailable.value = true;
    handleError(error);
  } finally {
    loading.value = false;
  }
}

function hasProductFilters() {
  return Boolean(searchQuery.value.trim() || selectedCategory.value || stockFilter.value === 'low');
}

function productQuery() {
  const params = new URLSearchParams();
  if (searchQuery.value.trim()) params.set('search', searchQuery.value.trim());
  if (selectedCategory.value) params.set('categoryId', selectedCategory.value);
  if (stockFilter.value === 'low') params.set('lowStock', 'true');
  const query = params.toString() ? `?${params}` : '';
  return `/products${query}`;
}

async function navigate(page) {
  activePage.value = page;
  clearNotices();
  if (page === 'overview') {
    await loadAll();
    return;
  }

  loading.value = true;
  try {
    if (page === 'products') {
      const supplierPath = user.value.role === 'admin' ? '/suppliers?includeArchived=true' : '/suppliers';
      const [catalogData, categoryData, supplierData, filteredData] = await Promise.all([
        get('/products'), get('/categories'), get(supplierPath), hasProductFilters() ? get(productQuery()) : null,
      ]);
      catalog.value = catalogData.products;
      products.value = (filteredData ?? catalogData).products;
      categories.value = categoryData.categories;
      suppliers.value = supplierData.suppliers;
    } else if (page === 'suppliers') {
      const supplierPath = user.value.role === 'admin' ? '/suppliers?includeArchived=true' : '/suppliers';
      const [supplierData, productData] = await Promise.all([get(supplierPath), get('/products')]);
      suppliers.value = supplierData.suppliers;
      catalog.value = productData.products;
    } else {
      const data = await get('/stock-movements');
      movements.value = data.movements;
    }
  } catch (error) {
    handleError(error);
  } finally {
    loading.value = false;
  }
}

function showLowStock() {
  stockFilter.value = 'low';
  navigate('products');
}

async function submitLogin() {
  busy.value = true;
  clearNotices();
  try {
    if (!csrfToken.value) await refreshCsrf();
    const result = await post('/auth/login', loginForm);
    user.value = result.user;
    csrfToken.value = result.csrfToken;
    setCsrfToken(result.csrfToken);
    apiUnavailable.value = false;
    await loadAll();
  } catch (error) {
    handleError(error);
  } finally {
    busy.value = false;
  }
}

async function logout() {
  busy.value = true;
  clearNotices();
  try {
    await post('/auth/logout', {});
    user.value = null;
    csrfToken.value = '';
    setCsrfToken('');
    await refreshCsrf();
  } catch (error) {
    handleError(error);
  } finally {
    busy.value = false;
  }
}

function resetProductForm() {
  Object.assign(productForm, {
    sku: '', name: '', brand: '', category_id: categories.value[0]?.id ?? '',
    supplier_id: suppliers.value.find((supplier) => supplier.is_active)?.id ?? '', description: '',
    price_min: '', price_max: '', purchase_price: '', selling_price: '', currency: 'IDR',
    listing_status: 'Ready', reorder_point: 10, storage_location: '', source_url: '',
    image_url: '', specifications: {}, variants: [], is_active: true,
  });
}

function openCreateProduct() {
  clearFormErrors();
  editingProduct.value = null;
  resetProductForm();
  productModalOpen.value = true;
}

function openEditProduct(product) {
  clearFormErrors();
  editingProduct.value = product;
  Object.assign(productForm, {
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category_id: String(product.category_id),
    supplier_id: product.supplier_id ? String(product.supplier_id) : '',
    description: product.description ?? '',
    price_min: toFormNumber(product.price_min),
    price_max: toFormNumber(product.price_max),
    purchase_price: toFormNumber(product.purchase_price),
    selling_price: toFormNumber(product.selling_price),
    currency: product.currency ?? 'IDR',
    listing_status: product.listing_status ?? 'Ready',
    reorder_point: product.reorder_point,
    storage_location: product.storage_location ?? '',
    source_url: product.source_url ?? '',
    image_url: product.image_url ?? '',
    specifications: product.specifications ?? {},
    variants: product.variants ?? [],
    is_active: product.is_active,
  });
  productModalOpen.value = true;
}

function productPayload() {
  const numeric = (value) => value === '' || value == null ? null : Number(value);
  return {
    ...productForm,
    category_id: Number(productForm.category_id),
    supplier_id: productForm.supplier_id ? Number(productForm.supplier_id) : null,
    price_min: numeric(productForm.price_min),
    price_max: numeric(productForm.price_max),
    purchase_price: numeric(productForm.purchase_price),
    selling_price: numeric(productForm.selling_price),
    reorder_point: Number(productForm.reorder_point),
  };
}

async function saveProduct() {
  busy.value = true;
  clearNotices();
  clearFormErrors();
  try {
    if (editingProduct.value) {
      await put(`/products/${editingProduct.value.id}`, productPayload());
      showSuccess('Perubahan produk disimpan.');
    } else {
      await post('/products', productPayload());
      showSuccess('Produk baru ditambahkan. Catat stok awal lewat pergerakan stok.');
    }
    productModalOpen.value = false;
    await loadAll({ clear: false });
    activePage.value = 'products';
  } catch (error) {
    handleFormError(error);
  } finally {
    busy.value = false;
  }
}

function archiveProduct(product) {
  clearNotices();
  pendingConfirmation.value = {
    title: 'Arsipkan produk ini?',
    message: `${product.name} tidak akan muncul di katalog aktif. Riwayat stoknya tetap disimpan.`,
    confirmLabel: 'Arsipkan produk',
    action: async () => {
      await remove(`/products/${product.id}`);
      showSuccess('Produk diarsipkan; riwayat stok tetap tersimpan.');
      await loadAll({ clear: false });
      activePage.value = 'products';
    },
  };
}

function resetSupplierForm() {
  Object.assign(supplierForm, { name: '', contact_person: '', phone: '', email: '', city: '', website: '', notes: '', is_active: true });
}

function openCreateSupplier() {
  clearFormErrors();
  editingSupplier.value = null;
  resetSupplierForm();
  supplierModalOpen.value = true;
}

function openEditSupplier(supplier) {
  clearFormErrors();
  editingSupplier.value = supplier;
  Object.assign(supplierForm, {
    name: supplier.name,
    contact_person: supplier.contact_person ?? '',
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    city: supplier.city ?? '',
    website: supplier.website ?? '',
    notes: supplier.notes ?? '',
    is_active: supplier.is_active,
  });
  supplierModalOpen.value = true;
}

async function saveSupplier() {
  busy.value = true;
  clearNotices();
  clearFormErrors();
  try {
    if (editingSupplier.value) {
      await put(`/suppliers/${editingSupplier.value.id}`, supplierForm);
      showSuccess('Informasi supplier diperbarui.');
    } else {
      await post('/suppliers', supplierForm);
      showSuccess('Supplier ditambahkan.');
    }
    supplierModalOpen.value = false;
    await loadAll({ clear: false });
    activePage.value = 'suppliers';
  } catch (error) {
    handleFormError(error);
  } finally {
    busy.value = false;
  }
}

function archiveSupplier(supplier) {
  clearNotices();
  pendingConfirmation.value = {
    title: 'Arsipkan supplier ini?',
    message: `${supplier.name} akan dinonaktifkan. Produk dan riwayat stok yang terhubung tetap disimpan.`,
    confirmLabel: 'Arsipkan supplier',
    action: async () => {
      await remove(`/suppliers/${supplier.id}`);
      showSuccess('Supplier diarsipkan; data produk tetap tersimpan.');
      await loadAll({ clear: false });
      activePage.value = 'suppliers';
    },
  };
}

function cancelPendingConfirmation() {
  if (!busy.value) pendingConfirmation.value = null;
}

async function confirmPendingAction() {
  const request = pendingConfirmation.value;
  if (!request || busy.value) return;
  busy.value = true;
  clearNotices();
  try {
    await request.action();
    pendingConfirmation.value = null;
  } catch (error) {
    pendingConfirmation.value = null;
    handleError(error);
  } finally {
    busy.value = false;
  }
}

function openMovement(product = null, type = 'IN') {
  clearFormErrors();
  Object.assign(movementForm, {
    product_id: String(product?.id ?? catalog.value[0]?.id ?? ''),
    movement_type: type, quantity: '', note: '',
  });
  movementModalOpen.value = true;
}

async function saveMovement() {
  busy.value = true;
  clearNotices();
  clearFormErrors();
  try {
    const movementType = movementForm.movement_type;
    await post('/stock-movements', {
      product_id: Number(movementForm.product_id),
      movement_type: movementType,
      quantity: Number(movementForm.quantity),
      note: movementForm.note,
    });
    movementModalOpen.value = false;
    showSuccess(movementType === 'IN' ? 'Stok masuk berhasil dicatat.' : movementType === 'OUT' ? 'Stok keluar berhasil dicatat.' : 'Saldo stok berhasil disesuaikan.');
    await loadAll({ clear: false });
    activePage.value = 'movements';
  } catch (error) {
    handleFormError(error);
  } finally {
    busy.value = false;
  }
}

async function applyProductFilters() {
  loading.value = true;
  clearNotices();
  try {
    const response = await get(productQuery());
    products.value = response.products;
  } catch (error) {
    handleError(error);
  } finally {
    loading.value = false;
  }
}

function stockState(product) {
  if (Number(product.warehouse_stock) === 0) return { label: 'Habis', tone: 'empty' };
  if (Number(product.warehouse_stock) <= Number(product.reorder_point)) return { label: 'Perlu restock', tone: 'low' };
  return { label: 'Tersedia', tone: 'good' };
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value ?? 0));
}

function formatMoney(value, currency = 'IDR', emptyText = 'Belum diisi') {
  if (value == null || value === '') return emptyText;
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: currency || 'IDR', maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency} ${formatNumber(value)}`;
  }
}

function formatReferencePrice(product) {
  const min = product.price_min;
  const max = product.price_max;
  if (min == null && max == null) return '—';
  if (min == null) return formatMoney(max, product.currency);
  if (max == null || Number(min) === Number(max)) return formatMoney(min, product.currency);
  return `${formatMoney(min, product.currency)}–${formatMoney(max, product.currency)}`;
}

function movementLabel(type) {
  return { IN: 'Stok masuk', OUT: 'Stok keluar', ADJUSTMENT: 'Penyesuaian' }[type] ?? type;
}

function movementSign(type) {
  return { IN: '+', OUT: '−', ADJUSTMENT: '↔' }[type] ?? '';
}

function movementTone(type) {
  return { IN: 'positive-value', OUT: 'negative-value' }[type] ?? '';
}

function movementIcon(type) {
  return { IN: ArrowDownToLine, OUT: ArrowUpFromLine, ADJUSTMENT: ArrowDownUp }[type] ?? History;
}

function formatDate(date) {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(parsed);
}

function formatTrendDay(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(new Date(year, month - 1, day));
}

function trendSegmentStyle(count, total) {
  return { height: total ? `${(count / total) * 100}%` : '0%' };
}

function trendHeight(total) {
  const max = Math.max(1, ...(dashboard.value.movementTrend ?? []).map((day) => day.total));
  return `${total ? Math.max(8, (total / max) * 100) : 0}%`;
}

function productsForSupplier(supplierId) {
  return catalog.value.filter((product) => Number(product.supplier_id) === Number(supplierId)).length;
}

function onImageError(event) {
  event.target.src = '/keyboard-placeholder.svg';
}

onMounted(async () => {
  try {
    await refreshCsrf();
    const session = await get('/auth/me');
    user.value = session.user;
    if (user.value) await loadAll();
  } catch (error) {
    apiUnavailable.value = true;
    handleError(error);
  } finally {
    checkingSession.value = false;
  }
});
</script>

<template>
  <div v-if="checkingSession" class="loading-screen">
    <div class="loading-mark"><Keyboard :size="24" /></div>
    <span>Menyiapkan inventaris...</span>
  </div>

  <div v-else-if="apiUnavailable && !user" class="unavailable-screen">
    <div class="unavailable-card">
      <div class="loading-mark"><Keyboard :size="24" /></div>
      <h1>Server inventaris belum tersambung</h1>
      <p>Pastikan MySQL dan API Node.js berjalan, lalu muat ulang halaman.</p>
      <code>npm run dev</code>
    </div>
  </div>

  <div v-else-if="!user" class="auth-page">
    <section class="auth-panel">
      <div class="auth-topline">
        <a class="brand auth-brand" href="#">
          <span class="brand-mark"><Keyboard :size="21" /></span>
          <span><strong>KEYSTOCK</strong><small>INVENTORY WORKSPACE</small></span>
        </a>
        <button class="theme-toggle" type="button" :aria-label="themeMode === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'" @click="toggleTheme">
          <Sun v-if="themeMode === 'dark'" :size="16" /><Moon v-else :size="16" />
          <span>{{ themeMode === 'dark' ? 'Mode terang' : 'Mode gelap' }}</span>
        </button>
      </div>
      <div class="auth-content">
        <div class="eyebrow"><span class="eyebrow-dot"></span> MECHANICAL KEYBOARD STOCKROOM</div>
        <h1>Kelola stok<br />dengan jelas.</h1>
        <p>Pantau produk, harga, supplier, dan pergerakan stok dari satu tempat.</p>
        <div v-if="errorMessage" class="notice error-notice"><AlertTriangle :size="17" />{{ errorMessage }}</div>
        <form class="login-form" @submit.prevent="submitLogin">
          <label for="email">Email</label>
          <input id="email" v-model="loginForm.email" type="email" autocomplete="username" placeholder="admin@keystock.local" required />
          <label for="password">Kata sandi</label>
          <input id="password" v-model="loginForm.password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required />
          <button class="button primary full" type="submit" :disabled="busy">
            {{ busy ? 'Memeriksa...' : 'Masuk ke inventaris' }}
            <ChevronDown class="button-arrow" :size="17" />
          </button>
        </form>
        <p class="auth-footnote"><ShieldCheck :size="15" /> Sesi login dilindungi dan tersimpan di server.</p>
      </div>
      <div class="auth-footer">© 2026 KeyStock · Demo inventaris akademik</div>
    </section>
    <section class="auth-art" aria-label="Ilustrasi mechanical keyboard">
      <div class="art-topline"><span>KEYSTOCK / STOCKROOM</span><span>MECHANICAL · ACCESSORIES</span></div>
      <div class="art-caption"><span class="art-kicker">PARTS IN PLACE</span><h2>Know what<br />you have.</h2><p>Informasi brand, supplier, harga, lokasi, dan jumlah stok tertata untuk kebutuhan operasional.</p></div>
      <div class="keyboard-art" aria-hidden="true"><img src="/keyboard-placeholder.svg" alt="" /></div>
      <div class="art-bottomline"><span>PRODUCT · SUPPLIER · STOCK MOVEMENT</span><span>01 / 04</span></div>
    </section>
  </div>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="navigate('overview')">
        <span class="brand-mark"><Keyboard :size="21" /></span>
        <span><strong>KEYSTOCK</strong><small>INVENTORY WORKSPACE</small></span>
      </a>

      <div class="side-label">WORKSPACE</div>
      <nav class="side-nav" aria-label="Navigasi inventaris">
        <button v-for="item in navItems" :key="item.id" class="nav-item" :class="{ active: activePage === item.id }" :aria-current="activePage === item.id ? 'page' : undefined" @click="navigate(item.id)">
          <component :is="item.icon" :size="18" :stroke-width="1.8" />
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-short">{{ item.short }}</span>
          <span v-if="item.id === 'products'" class="nav-count">{{ dashboard.summary?.activeProducts ?? products.length }}</span>
          <span v-if="item.id === 'suppliers'" class="nav-count">{{ suppliers.filter((supplier) => supplier.is_active).length }}</span>
        </button>
      </nav>

      <div class="sidebar-note">
        <span class="sidebar-note-icon"><Boxes :size="17" /></span>
        <div><strong>Stok internal</strong><span>Perubahan dicatat manual</span></div>
        <span class="connection-dot"></span>
      </div>

      <div class="user-card">
        <div class="avatar">{{ user.name?.slice(0, 1).toUpperCase() }}</div>
        <div class="user-meta"><strong>{{ user.name }}</strong><span>{{ user.role === 'admin' ? 'Administrator' : 'Staff inventaris' }}</span></div>
        <button class="icon-button quiet" title="Keluar" aria-label="Keluar" :disabled="busy" @click="logout"><LogOut :size="17" /></button>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <a class="topbar-brand" href="#" aria-label="KeyStock — ringkasan" @click.prevent="navigate('overview')"><span class="brand-mark"><Keyboard :size="17" /></span><strong>KEYSTOCK</strong></a>
        <div class="breadcrumb"><span>Workspace</span><span class="crumb-separator">/</span><strong>{{ pageTitle }}</strong></div>
        <div class="top-actions"><button class="theme-toggle" type="button" :aria-label="themeMode === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'" @click="toggleTheme"><Sun v-if="themeMode === 'dark'" :size="16" /><Moon v-else :size="16" /><span>{{ themeMode === 'dark' ? 'Mode terang' : 'Mode gelap' }}</span></button><span class="today-label">{{ today }}</span><span class="top-divider"></span><div class="top-user"><div class="avatar small-avatar">{{ user.name?.slice(0, 1).toUpperCase() }}</div><span>{{ user.name }}</span></div><button class="icon-button subtle mobile-logout" title="Keluar" aria-label="Keluar" :disabled="busy" @click="logout"><LogOut :size="16" /></button></div>
      </header>

      <div class="content-wrap">
        <div v-if="errorMessage" class="notice error-notice page-notice"><AlertTriangle :size="17" />{{ errorMessage }}<button class="icon-button quiet" @click="errorMessage = ''"><X :size="15" /></button></div>
        <div v-if="successMessage" class="notice success-notice page-notice"><Check :size="17" />{{ successMessage }}<button class="icon-button quiet" @click="successMessage = ''"><X :size="15" /></button></div>

        <template v-if="activePage === 'overview'">
          <section class="page-heading">
            <div><div class="eyebrow muted-eyebrow">INVENTORY OVERVIEW</div><h1>Ringkasan stok</h1><p>Pantau jumlah fisik, stok minimum, dan aktivitas gudang.</p></div>
            <div class="heading-actions"><button class="button secondary" @click="navigate('products')"><Package :size="16" /> Lihat produk</button><button class="button primary" @click="openMovement()"><ArrowDownUp :size="16" /> Catat pergerakan</button></div>
          </section>

          <section class="metric-grid">
            <article class="metric-card"><div class="metric-top"><span class="metric-icon icon-blue"><Package :size="18" /></span><span class="metric-caption">Jenis produk aktif</span></div><div class="metric-value">{{ formatNumber(dashboard.summary?.activeProducts) }}</div><div class="metric-foot">SKU tersimpan di katalog inventaris</div></article>
            <article class="metric-card"><div class="metric-top"><span class="metric-icon icon-green"><Boxes :size="18" /></span><span class="metric-caption">Jumlah stok fisik</span></div><div class="metric-value">{{ formatNumber(dashboard.summary?.totalStock) }} <small>unit</small></div><div class="metric-foot">Saldo stok demo, dicatat lewat log</div></article>
            <article class="metric-card"><div class="metric-top"><span class="metric-icon icon-violet"><CircleDollarSign :size="18" /></span><span class="metric-caption">Nilai modal tercatat</span></div><div class="metric-value compact-value" :class="{ 'is-empty': dashboard.summary?.inventoryCost == null }">{{ formatMoney(dashboard.summary?.inventoryCost, 'IDR', '—') }}</div><div class="metric-foot">{{ dashboard.summary?.pricedPurchaseProducts ? `${formatNumber(dashboard.summary.pricedPurchaseProducts)} SKU dengan harga beli` : 'Isi harga beli produk untuk menghitung' }}</div></article>
            <article class="metric-card alert-metric"><div class="metric-top"><span class="metric-icon icon-amber"><AlertTriangle :size="18" /></span><span class="metric-caption">Perlu perhatian</span></div><div class="metric-value">{{ formatNumber(dashboard.summary?.lowStockCount) }}</div><div class="metric-foot"><span>{{ formatNumber(dashboard.summary?.outOfStockCount) }} produk habis</span><button class="text-link" @click="showLowStock">Tinjau <span>↗</span></button></div></article>
          </section>

          <section class="dashboard-grid insight-grid">
            <article class="panel trend-panel">
              <div class="panel-heading"><div><div class="panel-kicker">MOVEMENT ANALYTICS</div><h2>Aktivitas stok</h2><p>Jumlah transaksi inventaris selama tujuh hari terakhir.</p></div><span class="period-tag">7 hari</span></div>
              <div class="trend-legend"><span><i class="legend-in"></i>Masuk</span><span><i class="legend-out"></i>Keluar</span><span><i class="legend-adjustment"></i>Penyesuaian</span></div>
              <div class="trend-chart" role="img" aria-label="Grafik transaksi stok tujuh hari terakhir">
                <div v-for="day in dashboard.movementTrend" :key="day.date" class="trend-column">
                  <strong>{{ day.total }}</strong>
                  <div class="trend-track"><div class="trend-bar-stack" :style="{ height: trendHeight(day.total) }"><i class="trend-adjustment" :style="trendSegmentStyle(day.adjustment, day.total)"></i><i class="trend-out" :style="trendSegmentStyle(day.out, day.total)"></i><i class="trend-in" :style="trendSegmentStyle(day.in, day.total)"></i></div></div>
                  <small>{{ formatTrendDay(day.date) }}</small>
                </div>
              </div>
              <div class="trend-foot"><span>{{ formatNumber(dashboard.movementTrend?.reduce((sum, day) => sum + day.total, 0)) }} transaksi tercatat</span><span class="trend-data-note">Dihitung dari log stok, bukan data penjualan</span></div>
            </article>

            <article class="panel category-panel">
              <div class="panel-heading"><div><div class="panel-kicker">STOCK MIX</div><h2>Produk per kategori</h2><p>SKU aktif dalam katalog inventaris.</p></div></div>
              <div class="category-chart"><div v-for="(category, index) in categories" :key="category.id" class="category-bar-row"><div class="bar-label"><span class="category-dot" :class="`dot-${category.slug}`"></span><span>{{ category.name }}</span><strong>{{ category.product_count ?? 0 }}</strong></div><div class="bar-track"><span :class="`bar-${index % 5}`" :style="{ width: `${Math.max(3, ((category.product_count ?? 0) / Math.max(1, dashboard.summary?.activeProducts ?? 1)) * 100)}%` }"></span></div></div></div>
              <div class="category-foot"><span><span class="legend-square"></span> SKU aktif</span><strong>{{ categories.length }} kategori</strong></div>
              <div class="source-note"><ShieldCheck :size="15" /><span>Harga modal hanya dihitung untuk SKU yang memiliki harga beli.</span></div>
            </article>
          </section>

          <section class="panel stock-panel stock-panel-wide">
            <article>
              <div class="panel-heading"><div><div class="panel-kicker">STOCK CONTROL</div><h2>Perlu restock</h2><p>Produk yang menyentuh atau melewati batas minimum.</p></div><button class="link-button" @click="showLowStock">Semua perhatian <span>↗</span></button></div>
              <div v-if="loading" class="loading-inline"><span class="spinner"></span> Memuat stok...</div>
              <div v-else-if="dashboard.lowStockProducts?.length" class="attention-table-wrap"><table class="data-table attention-table stack-table"><thead><tr><th>PRODUK</th><th>SUPPLIER</th><th>LOKASI</th><th>SISA / MINIMUM</th><th></th></tr></thead><tbody>
                <tr v-for="product in dashboard.lowStockProducts" :key="product.id"><td class="cell-primary"><div class="product-cell compact-product"><img class="product-thumb" :src="product.image_url || '/keyboard-placeholder.svg'" :alt="product.name" loading="lazy" @error="onImageError" /><div><strong>{{ product.name }}</strong><small>{{ product.brand }} · {{ product.sku }}</small></div></div></td><td data-label="Supplier">{{ product.supplier?.name ?? 'Belum dipilih' }}</td><td data-label="Lokasi">{{ product.storage_location || '—' }}</td><td data-label="Sisa / minimum"><span class="stock-count" :class="stockState(product).tone">{{ formatNumber(product.warehouse_stock) }} <small>/ {{ formatNumber(product.reorder_point) }}</small></span></td><td class="cell-actions"><button class="icon-button subtle" title="Catat stok masuk" aria-label="Catat stok masuk" @click="openMovement(product, 'IN')"><Plus :size="17" /></button></td></tr>
              </tbody></table></div>
              <div v-else class="empty-state compact-empty"><div class="empty-icon"><Check :size="21" /></div><strong>Belum ada stok di bawah minimum</strong><span>Daftar ini akan menampilkan produk saat jumlahnya perlu diisi ulang.</span></div>
            </article>
          </section>

          <section class="panel recent-panel">
            <div class="panel-heading"><div><div class="panel-kicker">MOVEMENT LOG</div><h2>Pergerakan stok terbaru</h2><p>Setiap perubahan saldo tersimpan bersama pengguna dan waktunya.</p></div><button class="link-button" @click="navigate('movements')">Buka riwayat <span>↗</span></button></div>
            <div v-if="dashboard.recentMovements?.length" class="table-scroll"><table class="data-table stack-table"><thead><tr><th>AKTIVITAS</th><th>PRODUK</th><th>PERUBAHAN</th><th>DICATAT OLEH</th><th>WAKTU</th><th>CATATAN</th></tr></thead><tbody>
              <tr v-for="item in dashboard.recentMovements" :key="item.id"><td data-label="Aktivitas"><span class="movement-kind" :class="`kind-${item.movement_type.toLowerCase()}`"><component :is="movementIcon(item.movement_type)" :size="14" /> {{ movementLabel(item.movement_type) }}</span></td><td class="cell-primary"><strong>{{ item.product?.name }}</strong><small class="cell-subtext">{{ item.product?.brand }} · {{ item.product?.sku }}</small></td><td data-label="Perubahan"><strong :class="movementTone(item.movement_type)">{{ movementSign(item.movement_type) }}{{ formatNumber(item.quantity) }} unit</strong><small class="cell-subtext">{{ formatNumber(item.stock_before) }} → {{ formatNumber(item.stock_after) }}</small></td><td data-label="Dicatat oleh">{{ item.user?.name }}</td><td data-label="Waktu">{{ formatDate(item.createdAt ?? item.created_at) }}</td><td data-label="Catatan" class="note-cell">{{ item.note || '—' }}</td></tr>
            </tbody></table></div>
            <div v-else class="empty-state compact-empty"><div class="empty-icon"><History :size="21" /></div><strong>Belum ada catatan pergerakan</strong><span>Gunakan aksi stok masuk, stok keluar, atau penyesuaian.</span></div>
          </section>
        </template>

        <template v-else-if="activePage === 'products'">
          <section class="page-heading">
            <div><div class="eyebrow muted-eyebrow">PRODUCT & STOCK REGISTER</div><h1>Produk</h1><p>Kelola SKU, brand, supplier, harga, dan lokasi penyimpanan.</p></div>
            <div class="heading-actions"><button v-if="user.role === 'admin'" class="button primary" @click="openCreateProduct()"><Plus :size="16" /> Tambah produk</button></div>
          </section>
          <section class="product-stat-grid" aria-label="Ringkasan produk yang ditampilkan">
            <article class="product-stat-card"><span>SKU ditampilkan</span><strong>{{ formatNumber(productStats.sku) }}</strong></article>
            <article class="product-stat-card"><span>Jumlah unit stok</span><strong>{{ formatNumber(productStats.units) }}</strong></article>
            <article class="product-stat-card"><span>Perlu restock</span><strong :class="productStats.lowStock ? 'stat-warning' : ''">{{ formatNumber(productStats.lowStock) }}</strong></article>
            <article class="product-stat-card"><span>SKU dengan supplier</span><strong>{{ formatNumber(productStats.supplied) }}</strong></article>
          </section>
          <section class="panel table-panel">
            <div class="table-toolbar"><div class="search-field"><Search :size="17" /><input v-model="searchQuery" type="search" placeholder="Cari nama, SKU, atau brand..." @keydown.enter="applyProductFilters" /><button v-if="searchQuery" class="clear-search" aria-label="Hapus pencarian" @click="searchQuery = ''; applyProductFilters()"><X :size="14" /></button></div>
              <select v-model="selectedCategory" class="filter-select" aria-label="Filter kategori" @change="applyProductFilters"><option value="">Semua kategori</option><option v-for="category in categories" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select>
              <select v-model="selectedSupplier" class="filter-select" aria-label="Filter supplier"><option value="">Semua supplier</option><option v-for="supplier in suppliers.filter((entry) => entry.is_active)" :key="supplier.id" :value="String(supplier.id)">{{ supplier.name }}</option></select>
              <select v-model="stockFilter" class="filter-select stock-filter" aria-label="Filter kondisi stok" @change="applyProductFilters"><option value="all">Semua stok</option><option value="low">Perlu restock</option></select>
            </div>
            <div v-if="loading" class="loading-inline"><span class="spinner"></span> Memuat produk...</div>
            <div v-else-if="filteredProducts.length" class="table-scroll"><table class="data-table product-table stack-table"><thead><tr><th>PRODUK</th><th>SUPPLIER / KONTAK</th><th>HARGA BELI / JUAL</th><th>STOK</th><th>LOKASI</th><th>KONDISI</th><th>AKSI</th></tr></thead><tbody>
              <tr v-for="product in filteredProducts" :key="product.id">
                <td class="cell-primary"><div class="product-cell"><img class="product-thumb" :src="product.image_url || '/keyboard-placeholder.svg'" :alt="product.name" loading="lazy" @error="onImageError" /><div><strong :title="product.name">{{ product.name }}</strong><small>{{ product.brand }} · {{ product.category?.name ?? 'Lainnya' }} · {{ product.sku }}</small></div></div></td>
                <td data-label="Supplier"><div class="supplier-cell"><strong>{{ product.supplier?.name ?? 'Belum ditentukan' }}</strong><small>{{ product.supplier?.phone || product.supplier?.email || 'Kontak belum dicatat' }}</small></div></td>
                <td data-label="Harga beli / jual" class="money-pair-cell"><div><span>Beli</span><strong :class="{ 'is-empty': product.purchase_price == null }">{{ formatMoney(product.purchase_price, product.currency, '—') }}</strong></div><div><span>Jual</span><strong :class="{ 'is-empty': product.selling_price == null }">{{ formatMoney(product.selling_price, product.currency, '—') }}</strong></div><small v-if="product.price_min != null || product.price_max != null" class="cell-subtext">Ref. {{ formatReferencePrice(product) }}</small></td>
                <td data-label="Stok" class="span-2"><span class="stock-count" :class="stockState(product).tone">{{ formatNumber(product.warehouse_stock) }} <small>unit</small></span><small class="cell-subtext">min. {{ formatNumber(product.reorder_point) }}</small></td>
                <td data-label="Lokasi" class="span-2"><span class="location-tag">{{ product.storage_location || '—' }}</span></td>
                <td data-label="Kondisi" class="span-2"><span class="stock-badge" :class="stockState(product).tone"><span></span>{{ stockState(product).label }}</span></td>
                <td class="cell-actions"><div class="row-actions"><a v-if="product.source_url" class="icon-button subtle" :href="product.source_url" target="_blank" rel="noopener noreferrer" title="Buka sumber produk" aria-label="Buka sumber produk"><ExternalLink :size="15" /></a><button class="icon-button subtle" title="Catat pergerakan stok" aria-label="Catat pergerakan stok" @click="openMovement(product)"><ArrowDownUp :size="15" /></button><template v-if="user.role === 'admin'"><button class="icon-button subtle" title="Edit produk" aria-label="Edit produk" @click="openEditProduct(product)"><Settings :size="15" /></button><button class="icon-button danger-quiet" title="Arsipkan produk" aria-label="Arsipkan produk" @click="archiveProduct(product)"><X :size="15" /></button></template></div></td>
              </tr>
            </tbody></table></div>
            <div v-else class="empty-state"><div class="empty-icon"><Package :size="22" /></div><strong>Produk tidak ditemukan</strong><span>Ubah kata pencarian atau filter, lalu coba lagi.</span><button v-if="user.role === 'admin'" class="button secondary small-button" @click="openCreateProduct()"><Plus :size="15" /> Tambah produk pertama</button></div>
            <div class="table-footer"><span>Menampilkan <strong>{{ filteredProducts.length }}</strong> produk</span><span class="table-footer-note"><ShieldCheck :size="14" /> Harga beli tidak diasumsikan dari harga katalog.</span></div>
          </section>
        </template>

        <template v-else-if="activePage === 'suppliers'">
          <section class="page-heading">
            <div><div class="eyebrow muted-eyebrow">PURCHASING CONTACTS</div><h1>Supplier</h1><p>Catat toko atau distributor tempat produk diperoleh. Brand produk dikelola terpisah.</p></div>
            <div class="heading-actions"><button v-if="user.role === 'admin'" class="button primary" @click="openCreateSupplier()"><Plus :size="16" /> Tambah supplier</button></div>
          </section>
          <section class="supplier-summary-grid"><article class="supplier-summary-card"><span class="supplier-summary-icon"><Truck :size="17" /></span><div><small>Supplier aktif</small><strong>{{ suppliers.filter((supplier) => supplier.is_active).length }}</strong></div></article><article class="supplier-summary-card"><span class="supplier-summary-icon contact-icon"><Building2 :size="17" /></span><div><small>Produk dengan supplier</small><strong>{{ catalog.filter((product) => product.supplier_id).length }}</strong></div></article><article class="supplier-summary-card"><span class="supplier-summary-icon warning-icon"><AlertTriangle :size="17" /></span><div><small>Kontak perlu dilengkapi</small><strong>{{ suppliers.filter((supplier) => supplier.is_active && !supplier.phone && !supplier.email).length }}</strong></div></article></section>
          <div v-if="loading" class="loading-inline panel"><span class="spinner"></span> Memuat supplier...</div>
          <section v-else-if="suppliers.length" class="supplier-grid"><article v-for="supplier in suppliers" :key="supplier.id" class="panel supplier-card" :class="{ archived: !supplier.is_active }">
            <div class="supplier-card-head"><div class="supplier-avatar"><Truck :size="18" /></div><span class="stock-badge" :class="supplier.is_active ? 'good' : 'empty'"><span></span>{{ supplier.is_active ? 'Aktif' : 'Diarsipkan' }}</span><div v-if="user.role === 'admin'" class="supplier-actions"><button class="icon-button subtle" title="Edit supplier" aria-label="Edit supplier" @click="openEditSupplier(supplier)"><Settings :size="15" /></button><button v-if="supplier.is_active" class="icon-button danger-quiet" title="Arsipkan supplier" aria-label="Arsipkan supplier" @click="archiveSupplier(supplier)"><X :size="15" /></button></div></div>
            <h2>{{ supplier.name }}</h2><p class="supplier-contact-person">{{ supplier.contact_person || 'Kontak person belum dicatat' }}</p>
            <div class="supplier-contact-list"><a v-if="supplier.phone" :href="`tel:${supplier.phone}`"><Phone :size="15" />{{ supplier.phone }}</a><span v-else class="missing-contact"><Phone :size="15" />Nomor telepon belum dicatat</span><a v-if="supplier.email" :href="`mailto:${supplier.email}`"><Mail :size="15" />{{ supplier.email }}</a><span v-else class="missing-contact"><Mail :size="15" />Email belum dicatat</span><span v-if="supplier.city"><MapPin :size="15" />{{ supplier.city }}</span><a v-if="supplier.website" :href="supplier.website" target="_blank" rel="noopener noreferrer"><ExternalLink :size="15" />Buka situs supplier</a></div>
            <div class="supplier-card-footer"><span><Package :size="14" /> {{ productsForSupplier(supplier.id) }} produk terhubung</span><span v-if="supplier.notes" class="supplier-note">{{ supplier.notes }}</span></div>
          </article></section>
          <section v-else class="panel empty-state supplier-empty"><div class="empty-icon"><Truck :size="22" /></div><strong>Belum ada supplier</strong><span>Tambahkan supplier untuk menghubungkan produk dengan sumber pembelian.</span><button v-if="user.role === 'admin'" class="button secondary small-button" @click="openCreateSupplier()"><Plus :size="15" /> Tambah supplier</button></section>
        </template>

        <template v-else>
          <section class="page-heading">
            <div><div class="eyebrow muted-eyebrow">INVENTORY AUDIT TRAIL</div><h1>Pergerakan stok</h1><p>Riwayat stok masuk, stok keluar, dan penyesuaian.</p></div>
            <div class="heading-actions"><button class="button primary" @click="openMovement()"><Plus :size="16" /> Catat pergerakan</button></div>
          </section>
          <section class="panel movement-panel">
            <div class="panel-heading"><div><div class="panel-kicker">STOCK MOVEMENTS</div><h2>Riwayat inventaris</h2><p>{{ filteredMovements.length }} dari {{ movements.length }} catatan terbaru</p></div><div class="audit-tag"><History :size="15" /> Audit trail aktif</div></div>
            <div class="table-toolbar"><div class="search-field"><Search :size="17" /><input v-model="movementSearch" type="search" placeholder="Cari produk, SKU, pengguna, atau catatan..." aria-label="Cari riwayat stok" /><button v-if="movementSearch" class="clear-search" type="button" aria-label="Hapus pencarian" @click="movementSearch = ''"><X :size="14" /></button></div><select v-model="movementTypeFilter" class="filter-select" aria-label="Filter jenis pergerakan"><option value="">Semua aktivitas</option><option value="IN">Stok masuk</option><option value="OUT">Stok keluar</option><option value="ADJUSTMENT">Penyesuaian</option></select></div>
            <div v-if="loading" class="loading-inline"><span class="spinner"></span> Memuat riwayat...</div>
            <div v-else-if="filteredMovements.length" class="table-scroll"><table class="data-table movement-table stack-table"><thead><tr><th>AKTIVITAS</th><th>PRODUK</th><th>STOK SEBELUM / SESUDAH</th><th>JUMLAH</th><th>DICATAT OLEH</th><th>WAKTU</th><th>CATATAN</th></tr></thead><tbody>
              <tr v-for="item in filteredMovements" :key="item.id"><td data-label="Aktivitas"><span class="movement-kind" :class="`kind-${item.movement_type.toLowerCase()}`"><component :is="movementIcon(item.movement_type)" :size="14" /> {{ movementLabel(item.movement_type) }}</span></td><td class="cell-primary"><strong>{{ item.product?.name }}</strong><small class="cell-subtext">{{ item.product?.brand }} · {{ item.product?.sku }}</small></td><td data-label="Sebelum → sesudah"><span class="balance-pair">{{ formatNumber(item.stock_before) }} <span>→</span> <strong>{{ formatNumber(item.stock_after) }}</strong></span></td><td data-label="Jumlah"><strong :class="movementTone(item.movement_type)">{{ movementSign(item.movement_type) }}{{ formatNumber(item.quantity) }}</strong> unit</td><td data-label="Dicatat oleh">{{ item.user?.name }}</td><td data-label="Waktu">{{ formatDate(item.createdAt ?? item.created_at) }}</td><td data-label="Catatan" class="note-cell">{{ item.note || '—' }}</td></tr>
            </tbody></table></div>
            <div v-else class="empty-state"><div class="empty-icon"><History :size="22" /></div><strong>{{ movements.length ? 'Tidak ada catatan yang cocok' : 'Belum ada riwayat' }}</strong><span>{{ movements.length ? 'Ubah kata pencarian atau filter aktivitas.' : 'Setiap perubahan saldo akan dicatat di halaman ini.' }}</span></div>
          </section>
        </template>

        <footer class="app-footer"><span>KEYSTOCK <i>·</i> MECHANICAL KEYBOARD INVENTORY</span><span><span class="footer-live"></span> Data stok demo · Sinkronisasi marketplace belum aktif</span></footer>
      </div>
    </main>

    <div v-if="productModalOpen" class="modal-backdrop" @click.self="productModalOpen = false">
      <section class="modal-card product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <header class="modal-header"><div><div class="eyebrow muted-eyebrow">PRODUCT REGISTER</div><h2 id="product-modal-title">{{ editingProduct ? 'Edit produk' : 'Tambah produk' }}</h2></div><button class="icon-button subtle" type="button" title="Tutup" aria-label="Tutup" @click="productModalOpen = false"><X :size="18" /></button></header>
        <form class="modal-form" @submit.prevent="saveProduct">
          <div class="modal-body">
            <div v-if="formError" class="notice error-notice" role="alert"><AlertTriangle :size="17" />{{ formError }}</div>
            <fieldset class="form-section">
              <legend>Identitas produk</legend>
              <div class="form-grid">
                <label class="full-field" :class="{ invalid: fieldErrors.name }">Nama produk<input v-model="productForm.name" required maxlength="190" placeholder="Contoh: Gateron Milky Yellow Pro" /><small v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</small></label>
                <label :class="{ invalid: fieldErrors.sku }">SKU<input v-model="productForm.sku" required maxlength="100" pattern="[A-Za-z0-9._-]+" title="Huruf, angka, titik, garis bawah, atau tanda hubung" placeholder="gateron-milky-yellow-pro" /><small v-if="fieldErrors.sku" class="field-error">{{ fieldErrors.sku }}</small></label>
                <label :class="{ invalid: fieldErrors.brand }">Brand / pembuat<input v-model="productForm.brand" required maxlength="120" placeholder="Contoh: Gateron" /><small v-if="fieldErrors.brand" class="field-error">{{ fieldErrors.brand }}</small></label>
                <label :class="{ invalid: fieldErrors.category_id }">Kategori<select v-model="productForm.category_id" required><option value="" disabled>Pilih kategori</option><option v-for="category in categories" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select><small v-if="fieldErrors.category_id" class="field-error">{{ fieldErrors.category_id }}</small></label>
                <label :class="{ invalid: fieldErrors.reorder_point }">Batas minimum stok<input v-model="productForm.reorder_point" type="number" min="0" step="1" required /><small v-if="fieldErrors.reorder_point" class="field-error">{{ fieldErrors.reorder_point }}</small></label>
              </div>
            </fieldset>
            <fieldset class="form-section">
              <legend>Supplier &amp; penyimpanan</legend>
              <div class="form-grid">
                <label :class="{ invalid: fieldErrors.supplier_id }">Supplier<select v-model="productForm.supplier_id"><option value="">Belum ditentukan</option><option v-for="supplier in suppliers" :key="supplier.id" :value="String(supplier.id)">{{ supplier.name }}{{ supplier.is_active ? '' : ' (arsip)' }}</option></select><small v-if="fieldErrors.supplier_id" class="field-error">{{ fieldErrors.supplier_id }}</small></label>
                <label :class="{ invalid: fieldErrors.storage_location }">Lokasi rak<input v-model="productForm.storage_location" maxlength="80" placeholder="Contoh: A-01 / Drawer 2" /><small v-if="fieldErrors.storage_location" class="field-error">{{ fieldErrors.storage_location }}</small></label>
              </div>
            </fieldset>
            <fieldset class="form-section">
              <legend>Harga inventaris</legend>
              <div class="form-grid three-columns">
                <label :class="{ invalid: fieldErrors.purchase_price }">Harga beli<input v-model="productForm.purchase_price" type="number" min="0" step="1" inputmode="numeric" placeholder="Belum dicatat" /><small v-if="fieldErrors.purchase_price" class="field-error">{{ fieldErrors.purchase_price }}</small></label>
                <label :class="{ invalid: fieldErrors.selling_price }">Harga jual<input v-model="productForm.selling_price" type="number" min="0" step="1" inputmode="numeric" placeholder="Belum ditentukan" /><small v-if="fieldErrors.selling_price" class="field-error">{{ fieldErrors.selling_price }}</small></label>
                <label>Mata uang<select v-model="productForm.currency"><option value="IDR">IDR — Rupiah</option><option value="USD">USD — Dollar</option></select></label>
              </div>
            </fieldset>
            <fieldset class="form-section">
              <legend>Deskripsi &amp; gambar</legend>
              <div class="form-grid">
                <label class="full-field" :class="{ invalid: fieldErrors.description }">Deskripsi / spesifikasi<textarea v-model="productForm.description" rows="3" maxlength="5000" placeholder="Layout, tipe switch, koneksi, atau detail lain"></textarea><small v-if="fieldErrors.description" class="field-error">{{ fieldErrors.description }}</small></label>
                <label class="full-field" :class="{ invalid: fieldErrors.image_url }">URL gambar atau path lokal<input v-model="productForm.image_url" type="text" placeholder="https://... atau /images/nama-produk.jpg" /><small v-if="fieldErrors.image_url" class="field-error">{{ fieldErrors.image_url }}</small></label>
              </div>
            </fieldset>
            <details class="form-section optional-section" :open="Boolean(fieldErrors.source_url || fieldErrors.price_max || fieldErrors.price_min || fieldErrors.listing_status)">
              <summary>Referensi listing <span>opsional</span></summary>
              <div class="form-grid">
                <label :class="{ invalid: fieldErrors.listing_status }">Status sumber listing<input v-model="productForm.listing_status" maxlength="120" placeholder="Referensi saja" /><small v-if="fieldErrors.listing_status" class="field-error">{{ fieldErrors.listing_status }}</small></label>
                <label class="full-field" :class="{ invalid: fieldErrors.source_url }">URL sumber produk<input v-model="productForm.source_url" type="url" placeholder="https://..." /><small v-if="fieldErrors.source_url" class="field-error">{{ fieldErrors.source_url }}</small></label>
                <label :class="{ invalid: fieldErrors.price_min }">Harga referensi terendah<input v-model="productForm.price_min" type="number" min="0" step="1" placeholder="Opsional" /><small v-if="fieldErrors.price_min" class="field-error">{{ fieldErrors.price_min }}</small></label>
                <label :class="{ invalid: fieldErrors.price_max }">Harga referensi tertinggi<input v-model="productForm.price_max" type="number" min="0" step="1" placeholder="Opsional" /><small v-if="fieldErrors.price_max" class="field-error">{{ fieldErrors.price_max }}</small></label>
              </div>
            </details>
            <p class="form-hint"><ShieldCheck :size="15" /> Brand adalah pembuat produk; supplier adalah sumber pembelian. Stok awal dicatat lewat pergerakan stok, bukan diketik langsung.</p>
          </div>
          <div class="modal-actions"><button type="button" class="button secondary" @click="productModalOpen = false">Batal</button><button type="submit" class="button primary" :disabled="busy"><Check :size="16" /> {{ busy ? 'Menyimpan...' : 'Simpan produk' }}</button></div>
        </form>
      </section>
    </div>

    <div v-if="supplierModalOpen" class="modal-backdrop" @click.self="supplierModalOpen = false">
      <section class="modal-card supplier-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-modal-title">
        <header class="modal-header"><div><div class="eyebrow muted-eyebrow">SUPPLIER CONTACTS</div><h2 id="supplier-modal-title">{{ editingSupplier ? 'Edit supplier' : 'Tambah supplier' }}</h2></div><button class="icon-button subtle" type="button" title="Tutup" aria-label="Tutup" @click="supplierModalOpen = false"><X :size="18" /></button></header>
        <form class="modal-form" @submit.prevent="saveSupplier">
          <div class="modal-body">
            <div v-if="formError" class="notice error-notice" role="alert"><AlertTriangle :size="17" />{{ formError }}</div>
            <div class="form-grid">
              <label class="full-field" :class="{ invalid: fieldErrors.name }">Nama toko / distributor<input v-model="supplierForm.name" required maxlength="150" placeholder="Contoh: Toko Keyboard Indonesia" /><small v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</small></label>
              <label :class="{ invalid: fieldErrors.contact_person }">Nama kontak<input v-model="supplierForm.contact_person" maxlength="120" placeholder="Opsional" /><small v-if="fieldErrors.contact_person" class="field-error">{{ fieldErrors.contact_person }}</small></label>
              <label :class="{ invalid: fieldErrors.phone }">Nomor telepon<input v-model="supplierForm.phone" type="tel" maxlength="40" placeholder="+62..." /><small v-if="fieldErrors.phone" class="field-error">{{ fieldErrors.phone }}</small></label>
              <label :class="{ invalid: fieldErrors.email }">Email<input v-model="supplierForm.email" type="email" maxlength="190" placeholder="kontak@toko.id" /><small v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</small></label>
              <label :class="{ invalid: fieldErrors.city }">Kota<input v-model="supplierForm.city" maxlength="100" placeholder="Opsional" /><small v-if="fieldErrors.city" class="field-error">{{ fieldErrors.city }}</small></label>
              <label class="full-field" :class="{ invalid: fieldErrors.website }">Situs / katalog<input v-model="supplierForm.website" type="url" placeholder="https://..." /><small v-if="fieldErrors.website" class="field-error">{{ fieldErrors.website }}</small></label>
              <label class="full-field" :class="{ invalid: fieldErrors.notes }">Catatan<textarea v-model="supplierForm.notes" rows="3" maxlength="500" placeholder="Syarat pembelian, waktu pengiriman, dan catatan lain"></textarea><small v-if="fieldErrors.notes" class="field-error">{{ fieldErrors.notes }}</small></label>
            </div>
            <p class="form-hint"><Truck :size="15" /> Kontak tidak dibuat otomatis. Isi hanya informasi supplier yang sudah diketahui.</p>
          </div>
          <div class="modal-actions"><button type="button" class="button secondary" @click="supplierModalOpen = false">Batal</button><button type="submit" class="button primary" :disabled="busy"><Check :size="16" /> {{ busy ? 'Menyimpan...' : 'Simpan supplier' }}</button></div>
        </form>
      </section>
    </div>

    <div v-if="movementModalOpen" class="modal-backdrop" @click.self="movementModalOpen = false">
      <section class="modal-card movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-modal-title">
        <header class="modal-header"><div><div class="eyebrow muted-eyebrow">STOCK CONTROL</div><h2 id="movement-modal-title">Catat pergerakan stok</h2></div><button class="icon-button subtle" type="button" title="Tutup" aria-label="Tutup" @click="movementModalOpen = false"><X :size="18" /></button></header>
        <form class="modal-form" @submit.prevent="saveMovement">
          <div class="modal-body">
            <div v-if="formError" class="notice error-notice" role="alert"><AlertTriangle :size="17" />{{ formError }}</div>
            <label :class="{ invalid: fieldErrors.product_id }">Produk<select v-model="movementForm.product_id" required><option value="" disabled>Pilih produk</option><option v-for="product in catalog" :key="product.id" :value="String(product.id)">{{ product.name }} · {{ formatNumber(product.warehouse_stock) }} unit</option></select><small v-if="fieldErrors.product_id" class="field-error">{{ fieldErrors.product_id }}</small></label>
            <div class="movement-type-picker" role="radiogroup" aria-label="Jenis pergerakan"><button v-for="type in [{id:'IN',label:'Stok masuk',icon:ArrowDownToLine},{id:'OUT',label:'Stok keluar',icon:ArrowUpFromLine},{id:'ADJUSTMENT',label:'Penyesuaian',icon:ArrowDownUp}]" :key="type.id" type="button" role="radio" :aria-checked="movementForm.movement_type === type.id" class="movement-type-option" :class="[{ selected: movementForm.movement_type === type.id }, `kind-${type.id.toLowerCase()}`]" @click="movementForm.movement_type = type.id"><component :is="type.icon" :size="17" /><span>{{ type.label }}</span></button></div>
            <label :class="{ invalid: fieldErrors.quantity }">{{ movementForm.movement_type === 'ADJUSTMENT' ? 'Jumlah saldo setelah penyesuaian' : 'Jumlah unit' }}<input v-model="movementForm.quantity" type="number" min="0" step="1" inputmode="numeric" required :placeholder="movementForm.movement_type === 'ADJUSTMENT' ? 'Masukkan saldo akhir' : 'Masukkan jumlah unit'" /><small v-if="fieldErrors.quantity" class="field-error">{{ fieldErrors.quantity }}</small></label>
            <div v-if="selectedMovementProduct" class="stock-preview" :class="{ invalid: movementPreview?.invalid }" aria-live="polite">
              <div><span>Stok sekarang</span><strong>{{ formatNumber(selectedMovementProduct.warehouse_stock) }} <small>unit</small></strong></div>
              <span class="stock-preview-arrow">→</span>
              <div><span>Setelah disimpan</span><strong>{{ movementPreview ? formatNumber(movementPreview.after) : '—' }} <small v-if="movementPreview">unit</small></strong></div>
              <p v-if="movementPreview?.invalid">Stok keluar melebihi stok yang tersedia.</p>
            </div>
            <label :class="{ invalid: fieldErrors.note }">Catatan<textarea v-model="movementForm.note" rows="3" maxlength="500" placeholder="Contoh: Pembelian dari supplier atau stok rusak"></textarea><small v-if="fieldErrors.note" class="field-error">{{ fieldErrors.note }}</small></label>
            <p class="form-hint"><ShieldCheck :size="15" /> Perubahan saldo menyimpan stok sebelum/sesudah, pengguna, dan waktu.</p>
          </div>
          <div class="modal-actions"><button type="button" class="button secondary" @click="movementModalOpen = false">Batal</button><button type="submit" class="button primary" :disabled="busy || movementPreview?.invalid"><Check :size="16" /> {{ busy ? 'Mencatat...' : 'Simpan pergerakan' }}</button></div>
        </form>
      </section>
    </div>

    <div v-if="pendingConfirmation" class="modal-backdrop confirmation-backdrop" @click.self="cancelPendingConfirmation">
      <section class="modal-card confirmation-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" :aria-busy="busy">
        <div class="confirm-icon"><AlertTriangle :size="21" /></div>
        <div class="confirm-copy"><div class="panel-kicker">KONFIRMASI AKSI</div><h2 id="confirmation-title">{{ pendingConfirmation.title }}</h2><p>{{ pendingConfirmation.message }}</p></div>
        <div class="modal-actions"><button type="button" class="button secondary" :disabled="busy" @click="cancelPendingConfirmation">Batal</button><button type="button" class="button danger-button" :disabled="busy" @click="confirmPendingAction"><AlertTriangle :size="16" />{{ busy ? 'Mengarsipkan...' : pendingConfirmation.confirmLabel }}</button></div>
      </section>
    </div>
  </div>
</template>
