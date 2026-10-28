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

const supplierSources = [
  { host: 'www.noirgear.com', name: 'Noir Gear Official Store', website: 'https://www.noirgear.com' },
  { host: 'worklouder.cc', name: 'Work Louder Official Store', website: 'https://worklouder.cc' },
];

function productDefaults(source, categoryId, supplierId, index) {
  const isUsd = source.harga_usd != null;
  const priceMin = source.harga_idr_min ?? source.harga_usd ?? null;
  const priceMax = source.harga_idr_max ?? source.harga_usd ?? null;
  const specs = source.spek && typeof source.spek === 'object' ? source.spek : {};
  const simulatedStock = 8 + ((index * 7) % 23);
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

async function seed() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12 || adminPassword.toLowerCase().includes('replace-with')) {
    throw new Error('Set SEED_ADMIN_EMAIL and a custom SEED_ADMIN_PASSWORD of at least 12 characters in .env.');
  }

  await sequelize.authenticate();
  await sequelize.sync();
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
        await StockMovement.create({
          product_id: product.id,
          user_id: admin.id,
          movement_type: 'ADJUSTMENT',
          quantity: product.warehouse_stock,
          stock_before: 0,
          stock_after: product.warehouse_stock,
          note: 'Stok awal simulasi untuk demo UAS.',
        }, { transaction });
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
  await seed();
} catch (error) {
  console.error('Seed gagal:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
