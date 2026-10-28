import { sequelize, Product, StockMovement } from '../models/index.js';

export class StockError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function recordMovement({ productId, userId, type, quantity, note }) {
  return sequelize.transaction(async (transaction) => {
    const product = await Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!product || !product.is_active) throw new StockError('Produk tidak ditemukan.', 404);

    const stockBefore = product.warehouse_stock;
    let stockAfter = stockBefore;
    if (type === 'IN') stockAfter += quantity;
    if (type === 'OUT') {
      if (quantity > stockBefore) throw new StockError('Stok keluar melebihi stok yang tersedia.');
      stockAfter -= quantity;
    }
    if (type === 'ADJUSTMENT') {
      stockAfter = quantity;
      if (stockAfter === stockBefore) throw new StockError('Jumlah penyesuaian sama dengan stok saat ini.');
    }

    product.warehouse_stock = stockAfter;
    await product.save({ transaction });

    const movement = await StockMovement.create({
      product_id: product.id,
      user_id: userId,
      movement_type: type,
      quantity: Math.abs(stockAfter - stockBefore),
      stock_before: stockBefore,
      stock_after: stockAfter,
      note: note || null,
    }, { transaction });

    return { movement, product };
  });
}
