import { z } from 'zod';

const optionalUrl = z.union([z.string().url().max(1000), z.literal('')]).optional().transform((value) => value || null);
const optionalImage = z.union([
  z.string().url().max(1000),
  z.string().regex(/^\/images\/[A-Za-z0-9._-]+$/),
  z.literal(''),
]).optional().transform((value) => value || null);
const optionalPrice = z.preprocess(
  (value) => value === '' ? null : value,
  z.union([z.null(), z.coerce.number().nonnegative()]).default(null),
);

const optionalSupplierId = z.preprocess(
  (value) => value === '' ? null : value,
  z.union([z.null(), z.coerce.number().int().positive()]).default(null),
);

export const loginSchema = z.object({
  email: z.string().trim().email().max(190),
  password: z.string().min(1).max(200),
});

export const productSchema = z.object({
  sku: z.string().trim().min(2).max(100).regex(/^[A-Za-z0-9._-]+$/, 'SKU hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.'),
  name: z.string().trim().min(2).max(190),
  brand: z.string().trim().min(1).max(120),
  category_id: z.coerce.number().int().positive(),
  supplier_id: optionalSupplierId,
  description: z.string().trim().max(5000).optional().default(''),
  price_min: optionalPrice,
  price_max: optionalPrice,
  purchase_price: optionalPrice,
  selling_price: optionalPrice,
  currency: z.string().trim().length(3).toUpperCase().default('IDR'),
  listing_status: z.string().trim().min(1).max(120).default('Ready'),
  reorder_point: z.coerce.number().int().nonnegative().max(1000000),
  storage_location: z.string().trim().max(80).optional().default(''),
  source_url: optionalUrl,
  image_url: optionalImage,
  specifications: z.record(z.string(), z.unknown()).optional().default({}),
  variants: z.array(z.string().max(190)).optional().default([]),
  is_active: z.coerce.boolean().optional().default(true),
}).refine((data) => data.price_min == null || data.price_max == null || data.price_min <= data.price_max, {
  path: ['price_max'], message: 'Harga maksimum harus sama dengan atau lebih besar dari harga minimum.',
}).refine((data) => data.purchase_price == null || data.selling_price == null || data.currency !== '' || data.purchase_price <= data.selling_price, {
  path: ['selling_price'], message: 'Harga jual harus sama dengan atau lebih besar dari harga beli.',
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(150),
  contact_person: z.string().trim().max(120).optional().transform((value) => value || null),
  phone: z.string().trim().max(40).optional().transform((value) => value || null),
  email: z.union([z.string().trim().email().max(190), z.literal('')]).optional().transform((value) => value || null),
  city: z.string().trim().max(100).optional().transform((value) => value || null),
  website: optionalUrl,
  notes: z.string().trim().max(500).optional().transform((value) => value || null),
  is_active: z.coerce.boolean().optional().default(true),
});

export const movementSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  movement_type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.coerce.number().int().nonnegative().max(1000000),
  note: z.string().trim().max(500).optional().default(''),
}).refine((data) => data.movement_type === 'ADJUSTMENT' || data.quantity > 0, {
  path: ['quantity'], message: 'Jumlah harus lebih dari nol.',
});
