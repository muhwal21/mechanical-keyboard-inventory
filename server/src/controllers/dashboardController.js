import { Op, literal } from 'sequelize';
import { Category, Product, StockMovement, Supplier, User } from '../models/index.js';

export async function getDashboard(req, res, next) {
  try {
    const trendStart = new Date();
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setDate(trendStart.getDate() - 6);
    const [activeProducts, stockValueRows, lowStockProducts, categories, recentMovements, activeSuppliers, trendRows] = await Promise.all([
      Product.count({ where: { is_active: true } }),
      Product.findAll({ attributes: ['warehouse_stock', 'purchase_price', 'currency'], where: { is_active: true } }),
      Product.findAll({
        where: { is_active: true, [Op.and]: [literal('warehouse_stock <= reorder_point')] },
        include: [
          { model: Category, as: 'category', attributes: ['name'] },
          { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] },
        ],
        order: [['warehouse_stock', 'ASC'], ['name', 'ASC']],
        limit: 6,
      }),
      Category.findAll({ attributes: ['id', 'name', 'slug'], order: [['name', 'ASC']] }),
      StockMovement.findAll({
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'brand'] },
          { model: User, as: 'user', attributes: ['id', 'name'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 6,
      }),
      Supplier.count({ where: { is_active: true } }),
      StockMovement.findAll({
        attributes: ['movement_type', 'createdAt'],
        where: { createdAt: { [Op.gte]: trendStart } },
        order: [['createdAt', 'ASC']],
      }),
    ]);

    const totalStock = stockValueRows.reduce((sum, product) => sum + product.warehouse_stock, 0);
    // Inventory value is reported in rupiah only; USD-priced items are not mixed into the IDR total.
    const pricedRows = stockValueRows.filter((product) => product.purchase_price != null && product.currency === 'IDR');
    const pricedPurchaseProducts = pricedRows.length;
    const inventoryCost = pricedPurchaseProducts
      ? pricedRows.reduce((sum, product) => sum + Number(product.purchase_price) * product.warehouse_stock, 0)
      : null;
    const lowStockCount = await Product.count({ where: { is_active: true, [Op.and]: [literal('warehouse_stock <= reorder_point')] } });
    const outOfStockCount = await Product.count({ where: { is_active: true, warehouse_stock: 0 } });
    const trendByDate = new Map();
    const dayKey = (value) => {
      const date = new Date(value);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(trendStart);
      date.setDate(date.getDate() + offset);
      const key = dayKey(date);
      trendByDate.set(key, { date: key, in: 0, out: 0, adjustment: 0, total: 0 });
    }

    for (const movement of trendRows) {
      const day = trendByDate.get(dayKey(movement.createdAt));
      if (!day) continue;
      const type = movement.movement_type.toLowerCase();
      day[type] += 1;
      day.total += 1;
    }

    return res.json({
      summary: { activeProducts, totalStock, lowStockCount, outOfStockCount, inventoryCost, pricedPurchaseProducts, activeSuppliers },
      categories,
      lowStockProducts,
      movementTrend: [...trendByDate.values()],
      recentMovements,
    });
  } catch (error) {
    return next(error);
  }
}
