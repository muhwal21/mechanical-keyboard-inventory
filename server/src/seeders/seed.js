import 'dotenv/config';
import bcrypt from 'bcryptjs';
import catalog from './catalog.json' with { type: 'json' };
import { Category, Product, sequelize, StockMovement, Supplier, User } from '../models/index.js';
import { migrateInventoryFields } from '../db/migrations.js';

const categoryLabels = {
  keyboard: 'Keyboard',
  switch: 'Switches',
  aksesoris: 'Accessories',
  keycaps: 'Keycaps',
  deskmat: 'Deskmats',
};

// Simulated on-hand quantities for the demo. A few items sit at or below the reorder
// point (6) and one is out of stock, so the restock list and status badges have data.
const demoStockLevels = [14, 3, 22, 9, 18, 0, 27, 11, 16, 24, 5, 13, 19, 8, 21, 2, 12, 15, 10, 26, 4, 17, 20];
const restockNotes = ['Restock dari supplier', 'Barang datang dari distributor', 'Pembelian ulang batch baru'];
const saleNotes = ['Penjualan toko offline', 'Pesanan marketplace dikirim', 'Dipakai untuk unit display'];

function daysAgo(days, hour) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, (days * 17) % 60, 0, 0);
  // Never place demo entries in the future when the seed runs early in the day.
  return date > new Date() ? new Date(Date.now() - (24 - hour) * 60 * 1000) : date;
}

// Builds a believable seven-day history for one product: an opening balance followed by
// stock-in and stock-out entries. Every row stores the balance before and after.
function demoHistory(index, targetStock) {
  const events = [];
  if (index % 3 === 0) events.push({ type: 'IN', quantity: 5 + (index % 4), at: daysAgo(index % 7, 10), note: restockNotes[index % 3] });
  if (index % 2 === 0) events.push({ type: 'OUT', quantity: 2 + (index % 3), at: daysAgo((index + 3) % 7, 15), note: saleNotes[index % 3] });
  if (index % 5 === 1) events.push({ type: 'OUT', quantity: 1 + (index % 2), at: daysAgo((index + 1) % 7, 13), note: saleNotes[(index + 1) % 3] });
  if (index % 4 === 2) events.push({ type: 'IN', quantity: 4, at: daysAgo((index + 5) % 7, 9), note: restockNotes[(index + 1) % 3] });
  events.sort((a, b) => a.at - b.at);

  const netChange = events.reduce((sum, event) => sum + (event.type === 'IN' ? event.quantity : -event.quantity), 0);
  let opening = Math.max(0, targetStock - netChange);
  let balance = opening;
  let lowest = opening;
  for (const event of events) {
    balance += event.type === 'IN' ? event.quantity : -event.quantity;
    lowest = Math.min(lowest, balance);
  }
  if (lowest < 0) opening -= lowest;

  return { opening, openedAt: daysAgo(8, 8), events };
}

const supplierSources = [
  { host: 'www.noirgear.com', name: 'Noir Gear Official Store', website: 'https://www.noirgear.com' },
  { host: 'worklouder.cc', name: 'Work Louder Official Store', website: 'https://worklouder.cc' },
];

function productDefaults(source, categoryId, supplierId, index) {
  const isUsd = source.harga_usd != null;
  const priceMin = source.harga_idr_min ?? source.harga_usd ?? null;
  const priceMax = source.harga_idr_max ?? source.harga_usd ?? null;
  const specs = source.spek && typeof source.spek === 'object' ? source.spek : {};
  const simulatedStock = demoStockLevels[index % demoStockLevels.length];
  const imageExtension = source.gambar?.[0]
    ? new URL(source.gambar[0]).pathname.split('.').pop().toLowerCase()
    : null;
  const localImageExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(imageExtension) ? imageExtension : null;

  return {
    category_id: categoryId,
    sku: source.id,
    name: source.nama,
    brand: source.brand ?? 'Unknown brand',
    description: source.deskripsi ?? '',
    price_min: priceMin,
    price_max: priceMax,
    purchase_price: null,
    selling_price: null,
    currency: isUsd ? 'USD' : 'IDR',
    listing_status: source.status ?? 'Ready',
    warehouse_stock: simulatedStock,
    reorder_point: 6,
    storage_location: `A-${String(index + 1).padStart(2, '0')}`,
    supplier_id: supplierId,
    source_url: source.url ?? source.url_sumber ?? null,
    image_url: localImageExtension ? `/images/${source.id}.${localImageExtension}` : null,
    specifications: specs,
    variants: Array.isArray(source.varian) ? source.varian : [],
    is_active: true,
  };
}

async function seed({ fresh = false } = {}) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12 || adminPassword.toLowerCase().includes('replace-with')) {
    throw new Error('Set SEED_ADMIN_EMAIL and a custom SEED_ADMIN_PASSWORD of at least 12 characters in .env.');
  }

  await sequelize.authenticate();
  if (fresh) {
    // --fresh drops and recreates the five domain tables (demo reset). Sessions are kept.
    await sequelize.sync({ force: true });
    console.log('Tabel dihapus dan dibuat ulang (--fresh).');
  } else {
    await sequelize.sync();
  }
  await migrateInventoryFields();

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const [admin] = await User.unscoped().findOrCreate({
    where: { email: adminEmail },
    defaults: {
      name: process.env.SEED_ADMIN_NAME ?? 'KeyStock Admin',
      email: adminEmail,
      password_hash: passwordHash,
      role: 'admin',
      is_active: true,
    },
  });
  await admin.update({ role: 'admin', is_active: true, name: process.env.SEED_ADMIN_NAME ?? admin.name });

  let staffUser = null;
  const staffEmail = process.env.SEED_STAFF_EMAIL?.toLowerCase();
  const staffPassword = process.env.SEED_STAFF_PASSWORD;
  if (Boolean(staffEmail) !== Boolean(staffPassword)) {
    throw new Error('Set both SEED_STAFF_EMAIL and SEED_STAFF_PASSWORD, or leave both unset.');
  }
  if (staffEmail && staffPassword) {
    if (staffPassword.length < 12 || staffPassword.toLowerCase().includes('replace-with')) {
      throw new Error('SEED_STAFF_PASSWORD must be a custom password with at least 12 characters.');
    }
    const [staff] = await User.unscoped().findOrCreate({
      where: { email: staffEmail },
      defaults: {
      name: process.env.SEED_STAFF_NAME?.trim() || 'Inventory Staff',
        email: staffEmail,
        password_hash: await bcrypt.hash(staffPassword, 12),
        role: 'staff',
        is_active: true,
      },
    });
    await staff.update({ role: 'staff', is_active: true, name: process.env.SEED_STAFF_NAME?.trim() || staff.name });
    staffUser = staff;
  }

  const supplierIds = new Map();
  for (const source of supplierSources) {
    const [supplier] = await Supplier.findOrCreate({
      where: { name: source.name },
      defaults: {
        website: source.website,
        notes: 'Supplier reference from product source; contact details have not been verified.',
        is_active: true,
      },
    });
    supplierIds.set(source.host, supplier.id);
  }

  const categoryIds = new Map();
  for (const [slug, name] of Object.entries(categoryLabels)) {
    const [category] = await Category.findOrCreate({ where: { slug }, defaults: { slug, name } });
    categoryIds.set(slug, category.id);
  }

  let inserted = 0;
  for (const [index, source] of catalog.produk.entries()) {
    const categoryId = categoryIds.get(source.kategori);
    if (!categoryId) continue;
    const host = new URL(source.url ?? source.url_sumber).hostname;
    const supplierId = supplierIds.get(host) ?? null;

    await sequelize.transaction(async (transaction) => {
      const [product, created] = await Product.findOrCreate({
        where: { sku: source.id },
        defaults: productDefaults(source, categoryId, supplierId, index),
        transaction,
      });

      if (created) {
        inserted += 1;
        const history = demoHistory(index, product.warehouse_stock);
        await StockMovement.create({
          product_id: product.id,
          user_id: admin.id,
          movement_type: 'ADJUSTMENT',
          quantity: history.opening,
          stock_before: 0,
          stock_after: history.opening,
          note: 'Stok awal simulasi untuk demo UAS.',
          createdAt: history.openedAt,
        }, { transaction });

        let balance = history.opening;
        for (const [eventIndex, event] of history.events.entries()) {
          const before = balance;
          balance += event.type === 'IN' ? event.quantity : -event.quantity;
          await StockMovement.create({
            product_id: product.id,
            user_id: (staffUser && eventIndex % 2 === 0) ? staffUser.id : admin.id,
            movement_type: event.type,
            quantity: event.quantity,
            stock_before: before,
            stock_after: balance,
            note: event.note,
            createdAt: event.at,
          }, { transaction });
        }
        // Keep the product balance equal to the last movement.
        if (balance !== product.warehouse_stock) await product.update({ warehouse_stock: balance }, { transaction });
      } else {
        const defaults = productDefaults(source, categoryId, supplierId, index);
        const sourcePriceWasUsedAsSellingPrice = product.selling_price != null
          && defaults.price_min != null
          && Number(product.selling_price) === Number(defaults.price_min);
        await product.update({
          supplier_id: product.supplier_id ?? defaults.supplier_id,
          purchase_price: product.purchase_price ?? defaults.purchase_price,
          selling_price: sourcePriceWasUsedAsSellingPrice ? null : product.selling_price,
          storage_location: product.storage_location || defaults.storage_location,
        }, { transaction });
      }
    });
  }

  console.log(`Seed selesai: ${inserted} produk baru, ${catalog.produk.length} produk pada katalog sumber.`);
}

try {
  await seed({ fresh: process.argv.includes('--fresh') });
} catch (error) {
  console.error('Seed gagal:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
