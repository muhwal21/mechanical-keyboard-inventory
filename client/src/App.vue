<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import {
  AlertTriangle, ArrowDownToLine, ArrowDownUp, ArrowUpFromLine, Boxes,
  Check, ChevronDown, CircleDollarSign, ExternalLink, History, LayoutDashboard,
  LogOut, Package, Plus, Search, Settings, ShieldCheck, TrendingUp, Warehouse, X,
} from '@lucide/vue';
import { apiRequest, get, post, put, remove, setCsrfToken } from './api.js';

const user = ref(null);
const checkingSession = ref(true);
const apiUnavailable = ref(false);
const activePage = ref('overview');
const loading = ref(false);
const busy = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const csrfToken = ref('');
const dashboard = ref({ summary: {}, categories: [], lowStockProducts: [], recentMovements: [] });
const products = ref([]);
const categories = ref([]);
const movements = ref([]);
const searchQuery = ref('');
const selectedCategory = ref('');
const lowStockOnly = ref(false);
const productModalOpen = ref(false);
const movementModalOpen = ref(false);
const editingProduct = ref(null);

const loginForm = reactive({ email: '', password: '' });
const productForm = reactive({
  sku: '', name: '', brand: 'Noir Gear', category_id: '', description: '',
  price_min: '', price_max: '', currency: 'IDR', listing_status: 'Ready',
  reorder_point: 6, source_url: '', image_url: '', specifications: {}, variants: [], is_active: true,
});
const movementForm = reactive({ product_id: '', movement_type: 'IN', quantity: '', note: '' });

const pageTitle = computed(() => ({
  overview: 'Ringkasan inventaris',
  products: 'Katalog produk',
  movements: 'Pergerakan stok',
}[activePage.value]));

const navItems = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'products', label: 'Produk', icon: Package },
  { id: 'movements', label: 'Pergerakan stok', icon: ArrowDownUp },
];

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

async function refreshCsrf() {
  const response = await get('/auth/csrf');
  csrfToken.value = response.csrfToken;
  setCsrfToken(response.csrfToken);
}

async function loadAll({ clear = true } = {}) {
  loading.value = true;
  if (clear) clearNotices();
  try {
    const [summary, categoryData, productData, movementData] = await Promise.all([
      get('/dashboard'), get('/categories'), get('/products'), get('/stock-movements'),
    ]);
    dashboard.value = summary;
    categories.value = categoryData.categories;
    products.value = productData.products;
    movements.value = movementData.movements;
  } catch (error) {
    if (error.message.includes('API belum tersambung')) apiUnavailable.value = true;
    handleError(error);
  } finally {
    loading.value = false;
  }
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
      const params = new URLSearchParams();
      if (searchQuery.value.trim()) params.set('search', searchQuery.value.trim());
      if (selectedCategory.value) params.set('categoryId', selectedCategory.value);
      if (lowStockOnly.value) params.set('lowStock', 'true');
      const query = params.toString() ? `?${params}` : '';
      const [productData, categoryData] = await Promise.all([get(`/products${query}`), get('/categories')]);
      products.value = productData.products;
      categories.value = categoryData.categories;
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
    sku: '', name: '', brand: 'Noir Gear', category_id: categories.value[0]?.id ?? '', description: '',
    price_min: '', price_max: '', currency: 'IDR', listing_status: 'Ready',
    reorder_point: 6, source_url: '', image_url: '', specifications: {}, variants: [], is_active: true,
  });
}

function openCreateProduct() {
  editingProduct.value = null;
  resetProductForm();
  productModalOpen.value = true;
}

function openEditProduct(product) {
  editingProduct.value = product;
  Object.assign(productForm, {
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category_id: String(product.category_id),
    description: product.description ?? '',
    price_min: product.price_min ?? '',
    price_max: product.price_max ?? '',
    currency: product.currency ?? 'IDR',
    listing_status: product.listing_status ?? 'Ready',
    reorder_point: product.reorder_point,
    source_url: product.source_url ?? '',
    image_url: product.image_url ?? '',
    specifications: product.specifications ?? {},
    variants: product.variants ?? [],
    is_active: product.is_active,
  });
  productModalOpen.value = true;
}

function productPayload() {
  return {
    ...productForm,
    category_id: Number(productForm.category_id),
    price_min: productForm.price_min === '' ? null : Number(productForm.price_min),
    price_max: productForm.price_max === '' ? null : Number(productForm.price_max),
    reorder_point: Number(productForm.reorder_point),
  };
}

async function saveProduct() {
  busy.value = true;
  clearNotices();
  try {
    if (editingProduct.value) {
      await put(`/products/${editingProduct.value.id}`, productPayload());
      showSuccess('Perubahan produk disimpan.');
    } else {
      await post('/products', productPayload());
      showSuccess('Produk baru ditambahkan.');
    }
    productModalOpen.value = false;
    await loadAll({ clear: false });
    activePage.value = 'products';
  } catch (error) {
    handleError(error);
  } finally {
    busy.value = false;
  }
}

async function archiveProduct(product) {
  if (!window.confirm(`Arsipkan ${product.name}? Riwayat stoknya akan tetap disimpan.`)) return;
  clearNotices();
  try {
    await remove(`/products/${product.id}`);
    showSuccess('Produk diarsipkan; riwayat stok tetap tersimpan.');
    await loadAll({ clear: false });
    activePage.value = 'products';
  } catch (error) {
    handleError(error);
  }
}

function openMovement(product = null) {
  Object.assign(movementForm, {
    product_id: product?.id ?? products.value[0]?.id ?? '',
    movement_type: 'IN',
    quantity: '',
    note: '',
  });
  movementModalOpen.value = true;
}

async function saveMovement() {
  busy.value = true;
  clearNotices();
  try {
    const quantity = Number(movementForm.quantity);
    await post('/stock-movements', {
      product_id: Number(movementForm.product_id),
      movement_type: movementForm.movement_type,
      quantity,
      note: movementForm.note,
    });
    movementModalOpen.value = false;
    showSuccess(movementForm.movement_type === 'IN' ? 'Stok masuk berhasil dicatat.' : movementForm.movement_type === 'OUT' ? 'Stok keluar berhasil dicatat.' : 'Penyesuaian stok berhasil dicatat.');
    await loadAll({ clear: false });
    activePage.value = 'movements';
  } catch (error) {
    handleError(error);
  } finally {
    busy.value = false;
  }
}

function runSearch() {
  if (activePage.value !== 'products') activePage.value = 'products';
  navigate('products');
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value ?? 0));
}

function formatPrice(product) {
  const min = product.price_min;
  const max = product.price_max;
  if (min == null && max == null) return 'Belum ada harga';
  const format = (amount) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: product.currency ?? 'IDR', maximumFractionDigits: 0,
  }).format(Number(amount));
  if (min == null) return format(max);
  if (max == null || Number(min) === Number(max)) return format(min);
  return `${format(min)} – ${format(max)}`;
}

function stockState(product) {
  return product.warehouse_stock <= product.reorder_point
    ? { label: 'Stok menipis', className: 'warning' }
    : { label: 'Stok aman', className: 'success' };
}

function movementLabel(type) {
  return { IN: 'Stok masuk', OUT: 'Stok keluar', ADJUSTMENT: 'Penyesuaian' }[type] ?? type;
}

function movementIcon(type) {
  return { IN: ArrowDownToLine, OUT: ArrowUpFromLine, ADJUSTMENT: ArrowDownUp }[type] ?? History;
}

function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
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
    <div class="loading-mark"><Warehouse :size="24" /></div>
    <span>Menyiapkan inventaris...</span>
  </div>

  <div v-else-if="apiUnavailable && !user" class="unavailable-screen">
    <div class="unavailable-card">
      <div class="loading-mark"><Warehouse :size="24" /></div>
      <h1>API belum tersambung</h1>
      <p>Pastikan MySQL dan server Node.js sedang berjalan, lalu muat ulang halaman.</p>
      <code>npm run dev</code>
    </div>
  </div>

  <div v-else-if="!user" class="auth-page">
    <section class="auth-panel">
      <a class="brand auth-brand" href="#">
        <span class="brand-symbol"><Warehouse :size="22" /></span>
        <span><strong>NOIR GEAR</strong><small>INVENTORY SYSTEM</small></span>
      </a>
      <div class="auth-content">
        <div class="eyebrow"><span class="eyebrow-dot"></span> WAREHOUSE CONTROL</div>
        <h1>Selamat datang<br />kembali.</h1>
        <p>Masuk untuk mengelola produk dan pergerakan stok Noir Gear.</p>
        <div v-if="errorMessage" class="notice error-notice"><AlertTriangle :size="17" />{{ errorMessage }}</div>
        <form class="login-form" @submit.prevent="submitLogin">
          <label for="email">Email</label>
          <input id="email" v-model="loginForm.email" type="email" autocomplete="username" placeholder="nama@noirgear.local" required />
          <label for="password">Kata sandi</label>
          <input id="password" v-model="loginForm.password" type="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required />
          <button class="button primary full" type="submit" :disabled="busy">
            {{ busy ? 'Memeriksa...' : 'Masuk ke dashboard' }}
            <ChevronDown class="button-arrow" :size="17" />
          </button>
        </form>
        <p class="auth-footnote"><ShieldCheck :size="15" /> Sesi login dilindungi dan tersimpan di server.</p>
      </div>
      <div class="auth-footer">© 2026 Noir Gear Inventory · Demo akademik</div>
    </section>
    <section class="auth-art" aria-label="Ilustrasi mechanical keyboard">
      <div class="art-topline"><span>NOIR GEAR / WAREHOUSE</span><span>01 — 05</span></div>
      <div class="art-caption"><span class="art-kicker">PRECISION IN EVERY KEY</span><h2>Every part<br />in its place.</h2><p>Kontrol inventaris yang tertata untuk gear yang dibuat dengan teliti.</p></div>
      <div class="keyboard-art" aria-hidden="true"><img src="/keyboard-placeholder.svg" alt="" /></div>
      <div class="art-bottomline"><span>MECHANICAL KEYBOARD · ACCESSORIES</span><span>EST. 2026</span></div>
    </section>
  </div>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="navigate('overview')">
        <span class="brand-symbol"><Warehouse :size="22" /></span>
        <span><strong>NOIR GEAR</strong><small>INVENTORY SYSTEM</small></span>
      </a>

      <div class="side-label">MENU UTAMA</div>
      <nav class="side-nav" aria-label="Navigasi utama">
        <button v-for="item in navItems" :key="item.id" class="nav-item" :class="{ active: activePage === item.id }" @click="navigate(item.id)">
          <component :is="item.icon" :size="18" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
          <span v-if="item.id === 'products'" class="nav-count">{{ dashboard.summary?.activeProducts ?? products.length }}</span>
        </button>
      </nav>

      <div class="side-label category-side-label">KATEGORI</div>
      <div class="category-nav">
        <button v-for="category in categories" :key="category.id" class="category-item" @click="selectedCategory = String(category.id); navigate('products')">
          <span class="category-dot" :class="`dot-${category.slug}`"></span>
          <span>{{ category.name }}</span>
          <small>{{ category.product_count ?? '' }}</small>
        </button>
      </div>

      <div class="sidebar-bottom">
        <div class="sync-card">
          <div class="sync-icon"><ShieldCheck :size="17" /></div>
          <div><strong>Stok pusat</strong><span>Data diperbarui manual</span></div>
          <span class="sync-dot"></span>
        </div>
        <div class="user-card">
          <div class="avatar">{{ user.name?.slice(0, 1).toUpperCase() }}</div>
          <div class="user-meta"><strong>{{ user.name }}</strong><span>{{ user.role === 'admin' ? 'Administrator' : 'Staff gudang' }}</span></div>
          <button class="icon-button quiet" title="Keluar" aria-label="Keluar" :disabled="busy" @click="logout"><LogOut :size="17" /></button>
        </div>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div class="breadcrumb"><span>Inventory</span><span class="crumb-separator">/</span><strong>{{ pageTitle }}</strong></div>
        <div class="top-actions">
          <span class="today-label">{{ new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()) }}</span>
          <span class="top-divider"></span>
          <div class="top-user"><div class="avatar small-avatar">{{ user.name?.slice(0, 1).toUpperCase() }}</div><span>{{ user.name }}</span></div>
        </div>
      </header>

      <div class="content-wrap">
        <div v-if="errorMessage" class="notice error-notice page-notice"><AlertTriangle :size="17" />{{ errorMessage }}<button class="icon-button quiet" @click="errorMessage = ''"><X :size="15" /></button></div>
        <div v-if="successMessage" class="notice success-notice page-notice"><Check :size="17" />{{ successMessage }}<button class="icon-button quiet" @click="successMessage = ''"><X :size="15" /></button></div>

        <template v-if="activePage === 'overview'">
          <section class="welcome-row">
            <div><div class="eyebrow muted-eyebrow">RINGKASAN INVENTARIS</div><h1>Halo, {{ user.name?.split(' ')[0] }} <span class="wave">✦</span></h1><p>Pantau kondisi stok dan aktivitas gudang hari ini.</p></div>
            <button class="button primary" @click="openMovement()"><ArrowDownUp :size="17" /> Catat pergerakan</button>
          </section>

          <section class="stats-grid">
            <article class="stat-card">
              <div class="stat-top"><span class="stat-icon icon-indigo"><Package :size="19" /></span><span class="stat-note">Katalog aktif</span></div>
              <div class="stat-value">{{ formatNumber(dashboard.summary?.activeProducts) }}</div>
              <div class="stat-foot"><span class="stat-foot-label">{{ categories.length }} kategori produk</span><span class="stat-foot-icon"><TrendingUp :size="15" /></span></div>
            </article>
            <article class="stat-card">
              <div class="stat-top"><span class="stat-icon icon-green"><Boxes :size="19" /></span><span class="stat-note">Stok gudang</span></div>
              <div class="stat-value">{{ formatNumber(dashboard.summary?.totalStock) }} <small>unit</small></div>
              <div class="stat-foot"><span class="stat-foot-label">Saldo simulasi untuk demo</span><span class="stock-pulse"></span></div>
            </article>
            <article class="stat-card">
              <div class="stat-top"><span class="stat-icon icon-orange"><AlertTriangle :size="19" /></span><span class="stat-note">Perlu perhatian</span></div>
              <div class="stat-value">{{ formatNumber(dashboard.summary?.lowStockCount) }}</div>
              <div class="stat-foot"><span class="stat-foot-label">Produk di bawah batas minimum</span><button class="text-link" @click="lowStockOnly = true; navigate('products')">Lihat <span>↗</span></button></div>
            </article>
            <article class="stat-card accent-stat-card">
              <div class="stat-top"><span class="stat-icon icon-dark"><History :size="19" /></span><span class="stat-note">Pergerakan tercatat</span></div>
              <div class="stat-value">{{ formatNumber(movements.length) }}</div>
              <div class="stat-foot"><span class="stat-foot-label">Riwayat stok terbaru</span><button class="text-link" @click="navigate('movements')">Buka log <span>↗</span></button></div>
            </article>
          </section>

          <section class="dashboard-grid">
            <article class="panel inventory-panel">
              <div class="panel-heading"><div><h2>Perlu restock</h2><p>Produk dengan stok pada atau di bawah batas minimum.</p></div><button class="link-button" @click="lowStockOnly = true; navigate('products')">Semua produk <span>↗</span></button></div>
              <div v-if="dashboard.lowStockProducts?.length" class="low-stock-list">
                <div v-for="product in dashboard.lowStockProducts" :key="product.id" class="low-stock-row">
                  <img class="mini-product-image" :src="product.image_url || '/keyboard-placeholder.svg'" alt="" @error="onImageError" />
                  <div class="low-product-info"><strong>{{ product.name }}</strong><span>{{ product.category?.name ?? product.sku }}</span></div>
                  <div class="stock-meter"><div class="meter-track"><span :style="{ width: `${Math.min(100, (product.warehouse_stock / Math.max(1, product.reorder_point)) * 100)}%` }"></span></div><small>{{ product.warehouse_stock }} / {{ product.reorder_point }} unit</small></div>
                  <span class="badge warning">Stok menipis</span>
                  <button class="icon-button subtle" title="Catat stok masuk" aria-label="Catat stok masuk" @click="openMovement(product)"><Plus :size="17" /></button>
                </div>
              </div>
              <div v-else class="empty-state compact-empty"><div class="empty-icon"><Check :size="21" /></div><strong>Stok semua produk aman</strong><span>Belum ada produk yang perlu diisi ulang.</span></div>
            </article>

            <article class="panel category-panel">
              <div class="panel-heading"><div><h2>Kategori produk</h2><p>Distribusi katalog inventaris.</p></div><button class="icon-button subtle" title="Buka produk" aria-label="Buka produk" @click="navigate('products')"><ExternalLink :size="16" /></button></div>
              <div class="category-chart">
                <div v-for="(category, index) in dashboard.categories" :key="category.id" class="category-bar-row">
                  <div class="bar-label"><span class="category-dot" :class="`dot-${category.slug}`"></span><span>{{ category.name }}</span><strong>{{ category.product_count ?? products.filter((p) => p.category_id === category.id).length }}</strong></div>
                  <div class="bar-track"><span :class="`bar-${index % 5}`" :style="{ width: `${Math.max(6, ((category.product_count ?? products.filter((p) => p.category_id === category.id).length) / Math.max(1, dashboard.summary?.activeProducts ?? 1)) * 100)}%` }"></span></div>
                </div>
              </div>
              <div class="category-foot"><span><span class="legend-square"></span> Jumlah produk aktif</span><strong>{{ categories.length }} kategori</strong></div>
            </article>
          </section>

          <section class="panel recent-panel">
            <div class="panel-heading"><div><h2>Aktivitas stok terbaru</h2><p>Jejak perubahan stok tersimpan per pengguna.</p></div><button class="link-button" @click="navigate('movements')">Lihat semua <span>↗</span></button></div>
            <div v-if="dashboard.recentMovements?.length" class="table-scroll"><table class="data-table"><thead><tr><th>JENIS</th><th>PRODUK</th><th>PELAKSANA</th><th>PERUBAHAN</th><th>WAKTU</th><th>CATATAN</th></tr></thead><tbody>
              <tr v-for="item in dashboard.recentMovements" :key="item.id"><td><span class="movement-kind" :class="`kind-${item.movement_type.toLowerCase()}`"><component :is="movementIcon(item.movement_type)" :size="15" /> {{ movementLabel(item.movement_type) }}</span></td><td><strong>{{ item.product?.name }}</strong><small class="cell-subtext">{{ item.product?.sku }}</small></td><td>{{ item.user?.name }}</td><td><strong :class="item.movement_type === 'OUT' ? 'negative-value' : item.movement_type === 'IN' ? 'positive-value' : ''">{{ item.movement_type === 'OUT' ? '−' : item.movement_type === 'IN' ? '+' : '↔' }}{{ formatNumber(item.quantity) }} unit</strong><small class="cell-subtext">{{ formatNumber(item.stock_before) }} → {{ formatNumber(item.stock_after) }}</small></td><td>{{ formatDate(item.created_at) }}</td><td class="note-cell">{{ item.note || '—' }}</td></tr>
            </tbody></table></div>
            <div v-else class="empty-state compact-empty"><div class="empty-icon"><History :size="21" /></div><strong>Belum ada aktivitas</strong><span>Catat pergerakan stok untuk mulai membuat riwayat.</span><button class="button secondary small-button" @click="openMovement()"><Plus :size="15" /> Catat stok pertama</button></div>
          </section>
        </template>

        <template v-else-if="activePage === 'products'">
          <section class="welcome-row page-title-row">
            <div><div class="eyebrow muted-eyebrow">KATALOG INVENTARIS</div><h1>Produk</h1><p>Kelola keyboard mechanical dan aksesori Noir Gear.</p></div>
            <button v-if="user.role === 'admin'" class="button primary" @click="openCreateProduct()"><Plus :size="17" /> Tambah produk</button>
          </section>
          <section class="panel product-panel">
            <div class="product-toolbar">
              <div class="search-field"><Search :size="17" /><input v-model="searchQuery" type="search" placeholder="Cari nama, SKU, atau brand..." @keydown.enter="runSearch" /><button v-if="searchQuery" class="clear-search" @click="searchQuery = ''; runSearch()"><X :size="15" /></button></div>
              <select v-model="selectedCategory" class="filter-select" aria-label="Filter kategori" @change="runSearch"><option value="">Semua kategori</option><option v-for="category in categories" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select>
              <label class="toggle-filter"><input v-model="lowStockOnly" type="checkbox" @change="runSearch" /><span class="toggle-track"></span><span>Stok menipis</span></label>
            </div>
            <div v-if="loading" class="loading-inline"><span class="spinner"></span> Memuat produk...</div>
            <div v-else-if="products.length" class="table-scroll"><table class="data-table product-table"><thead><tr><th>PRODUK</th><th>KATEGORI</th><th>HARGA SUMBER</th><th>STOK GUDANG</th><th>STATUS LISTING</th><th>AKSI</th></tr></thead><tbody>
              <tr v-for="product in products" :key="product.id"><td><div class="product-cell"><img class="product-thumb" :src="product.image_url || '/keyboard-placeholder.svg'" :alt="product.name" @error="onImageError" /><div><strong>{{ product.name }}</strong><small>{{ product.brand }} · {{ product.sku }}</small></div></div></td><td><span class="category-pill"><span class="category-dot" :class="`dot-${product.category?.slug}`"></span>{{ product.category?.name ?? 'Lainnya' }}</span></td><td class="price-cell">{{ formatPrice(product) }}</td><td><div class="stock-cell"><strong>{{ formatNumber(product.warehouse_stock) }}</strong><span>{{ stockState(product).label }}</span></div></td><td><span class="listing-badge" :class="product.listing_status?.toLowerCase().includes('sold out') ? 'listing-off' : 'listing-on'"><span></span>{{ product.listing_status }}</span></td><td><div class="row-actions"><a v-if="product.source_url" class="icon-button subtle" :href="product.source_url" target="_blank" rel="noopener noreferrer" title="Buka sumber produk" aria-label="Buka sumber produk"><ExternalLink :size="16" /></a><button class="icon-button subtle" title="Catat pergerakan stok" aria-label="Catat pergerakan stok" @click="openMovement(product)"><ArrowDownUp :size="16" /></button><template v-if="user.role === 'admin'"><button class="icon-button subtle" title="Edit produk" aria-label="Edit produk" @click="openEditProduct(product)"><Settings :size="16" /></button><button class="icon-button danger-quiet" title="Arsipkan produk" aria-label="Arsipkan produk" @click="archiveProduct(product)"><X :size="16" /></button></template></div></td></tr>
            </tbody></table></div>
            <div v-else class="empty-state"><div class="empty-icon"><Package :size="22" /></div><strong>Produk tidak ditemukan</strong><span>Coba ubah pencarian atau filter kategori.</span><button v-if="user.role === 'admin'" class="button secondary small-button" @click="openCreateProduct()"><Plus :size="15" /> Tambah produk pertama</button></div>
            <div class="table-footer"><span>Menampilkan <strong>{{ products.length }}</strong> produk yang cocok</span><span class="table-footer-note"><ShieldCheck :size="14" /> Nilai stok awal merupakan data simulasi.</span></div>
          </section>
        </template>

        <template v-else>
          <section class="welcome-row page-title-row">
            <div><div class="eyebrow muted-eyebrow">AUDIT STOK</div><h1>Pergerakan stok</h1><p>Catatan masuk, keluar, dan penyesuaian saldo gudang.</p></div>
            <button class="button primary" @click="openMovement()"><Plus :size="17" /> Catat pergerakan</button>
          </section>
          <section class="panel movement-panel">
            <div class="panel-heading movement-heading"><div><h2>Riwayat inventaris</h2><p>{{ movements.length }} catatan terakhir</p></div><div class="history-tag"><History :size="16" /> Audit trail aktif</div></div>
            <div v-if="loading" class="loading-inline"><span class="spinner"></span> Memuat riwayat...</div>
            <div v-else-if="movements.length" class="table-scroll"><table class="data-table movement-table"><thead><tr><th>JENIS AKTIVITAS</th><th>PRODUK</th><th>STOK SEBELUM / SESUDAH</th><th>JUMLAH</th><th>DICATAT OLEH</th><th>WAKTU</th><th>CATATAN</th></tr></thead><tbody>
              <tr v-for="item in movements" :key="item.id"><td><span class="movement-kind" :class="`kind-${item.movement_type.toLowerCase()}`"><component :is="movementIcon(item.movement_type)" :size="15" /> {{ movementLabel(item.movement_type) }}</span></td><td><strong>{{ item.product?.name }}</strong><small class="cell-subtext">{{ item.product?.sku }}</small></td><td><span class="balance-pair">{{ formatNumber(item.stock_before) }} <span>→</span> <strong>{{ formatNumber(item.stock_after) }}</strong></span></td><td><strong :class="item.movement_type === 'OUT' ? 'negative-value' : item.movement_type === 'IN' ? 'positive-value' : ''">{{ item.movement_type === 'OUT' ? '−' : item.movement_type === 'IN' ? '+' : '↔' }}{{ formatNumber(item.quantity) }}</strong> unit</td><td>{{ item.user?.name }}</td><td>{{ formatDate(item.created_at) }}</td><td class="note-cell">{{ item.note || '—' }}</td></tr>
            </tbody></table></div>
            <div v-else class="empty-state"><div class="empty-icon"><History :size="22" /></div><strong>Belum ada riwayat</strong><span>Setiap perubahan saldo stok akan muncul di sini.</span></div>
          </section>
        </template>

        <footer class="app-footer"><span>NOIR GEAR INVENTORY <i>·</i> DEMO AKADEMIK</span><span><span class="footer-live"></span> Data marketplace tidak disinkronkan otomatis</span></footer>
      </div>
    </main>

    <div v-if="productModalOpen" class="modal-backdrop" @click.self="productModalOpen = false">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <header class="modal-header"><div><div class="eyebrow muted-eyebrow">KATALOG PRODUK</div><h2 id="product-modal-title">{{ editingProduct ? 'Edit produk' : 'Tambah produk' }}</h2></div><button class="icon-button subtle" title="Tutup" aria-label="Tutup" @click="productModalOpen = false"><X :size="19" /></button></header>
        <form class="modal-form" @submit.prevent="saveProduct">
          <div class="form-grid"><label>Nama produk<input v-model="productForm.name" required maxlength="190" placeholder="Contoh: Noir Spade65 QMK/VIA" /></label><label>SKU<input v-model="productForm.sku" required maxlength="100" pattern="[A-Za-z0-9._-]+" placeholder="noir-spade65-qmk" /></label><label>Brand<input v-model="productForm.brand" required maxlength="120" /></label><label>Kategori<select v-model="productForm.category_id" required><option value="" disabled>Pilih kategori</option><option v-for="category in categories" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select></label><label>Harga mulai<input v-model="productForm.price_min" type="number" min="0" step="1" placeholder="Opsional" /></label><label>Harga maksimum<input v-model="productForm.price_max" type="number" min="0" step="1" placeholder="Opsional" /></label><label>Mata uang<select v-model="productForm.currency"><option value="IDR">IDR — Rupiah</option><option value="USD">USD — Dollar</option></select></label><label>Batas restock<input v-model="productForm.reorder_point" type="number" min="0" step="1" required /></label><label class="full-field">Status listing<input v-model="productForm.listing_status" maxlength="120" placeholder="Ready / Sold out (saat dicek)" /></label><label class="full-field">Deskripsi<textarea v-model="productForm.description" rows="3" maxlength="5000" placeholder="Deskripsi singkat produk"></textarea></label><label class="full-field">URL sumber produk<input v-model="productForm.source_url" type="url" placeholder="https://..." /></label><label class="full-field">URL gambar atau path gambar lokal<input v-model="productForm.image_url" type="text" placeholder="https://... atau /images/nama-produk.jpg" /></label></div>
          <p class="form-hint"><ShieldCheck :size="15" /> Saldo gudang baru dimulai dari 0. Catat stok awal lewat pergerakan stok agar riwayat audit tetap lengkap.</p>
          <div class="modal-actions"><button type="button" class="button secondary" @click="productModalOpen = false">Batal</button><button type="submit" class="button primary" :disabled="busy"><Check :size="16" /> {{ busy ? 'Menyimpan...' : 'Simpan produk' }}</button></div>
        </form>
      </section>
    </div>

    <div v-if="movementModalOpen" class="modal-backdrop" @click.self="movementModalOpen = false">
      <section class="modal-card movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-modal-title">
        <header class="modal-header"><div><div class="eyebrow muted-eyebrow">CATATAN INVENTARIS</div><h2 id="movement-modal-title">Pergerakan stok</h2></div><button class="icon-button subtle" title="Tutup" aria-label="Tutup" @click="movementModalOpen = false"><X :size="19" /></button></header>
        <form class="modal-form" @submit.prevent="saveMovement">
          <label>Produk<select v-model="movementForm.product_id" required><option value="" disabled>Pilih produk</option><option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }} · {{ product.warehouse_stock }} unit</option></select></label>
          <div class="movement-type-picker"><button v-for="type in [{id:'IN',label:'Stok masuk',icon:ArrowDownToLine},{id:'OUT',label:'Stok keluar',icon:ArrowUpFromLine},{id:'ADJUSTMENT',label:'Penyesuaian',icon:ArrowDownUp}]" :key="type.id" type="button" class="movement-type-option" :class="{ selected: movementForm.movement_type === type.id }" @click="movementForm.movement_type = type.id"><component :is="type.icon" :size="17" /><span>{{ type.label }}</span></button></div>
          <label>{{ movementForm.movement_type === 'ADJUSTMENT' ? 'Saldo baru setelah penyesuaian' : 'Jumlah unit' }}<input v-model="movementForm.quantity" type="number" min="0" step="1" required :placeholder="movementForm.movement_type === 'ADJUSTMENT' ? 'Masukkan saldo akhir' : 'Masukkan jumlah unit'" /></label>
          <label>Catatan<textarea v-model="movementForm.note" rows="3" maxlength="500" placeholder="Contoh: Restock batch Oktober"></textarea></label>
          <p class="form-hint"><ShieldCheck :size="15" /> Perubahan saldo disimpan bersama identitas pengguna dan waktu pencatatan.</p>
          <div class="modal-actions"><button type="button" class="button secondary" @click="movementModalOpen = false">Batal</button><button type="submit" class="button primary" :disabled="busy"><Check :size="16" /> {{ busy ? 'Mencatat...' : 'Simpan pergerakan' }}</button></div>
        </form>
      </section>
    </div>
  </div>
</template>
