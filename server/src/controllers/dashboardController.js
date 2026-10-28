import { Op, literal } from 'sequelize';
import { Category, Product, StockMovement, Supplier, User } from '../models/index.js';

export async function getDashboard(req, res, next) {
  try {
    const [activeProducts, stockValueRows, lowStockProducts, categories, recentMovements, activeSuppliers, pricedPurchaseProducts] = await Promise.all([
      Product.count({ where: { is_active: true } }),
      Product.findAll({ attributes: ['warehouse_stock', 'purchase_price'], where: { is_active: true } }),
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
      Product.count({ where: { is_active: true, purchase_price: { [Op.ne]: null } } }),
    ]);

    const totalStock = stockValueRows.reduce((sum, product) => sum + product.warehouse_stock, 0);
    const inventoryCost = pricedPurchaseProducts
      ? stockValueRows.reduce((sum, product) => sum + (Number(product.purchase_price) || 0) * product.warehouse_stock, 0)
      : null;
    const lowStockCount = await Product.count({ where: { is_active: true, [Op.and]: [literal('warehouse_stock <= reorder_point')] } });
    const outOfStockCount = await Product.count({ where: { is_active: true, warehouse_stock: 0 } });
    return res.json({
      summary: { activeProducts, totalStock, lowStockCount, outOfStockCount, inventoryCost, pricedPurchaseProducts, activeSuppliers },
      categories,
      lowStockProducts,
      recentMovements,
    });
  } catch (error) {
    return next(error);
  }
}
