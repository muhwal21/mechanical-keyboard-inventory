import { Op, literal } from 'sequelize';
import { Category, Product, StockMovement, User } from '../models/index.js';

export async function getDashboard(req, res, next) {
  try {
    const [activeProducts, stockValueRows, lowStockProducts, categories, recentMovements] = await Promise.all([
      Product.count({ where: { is_active: true } }),
      Product.findAll({ attributes: ['warehouse_stock'], where: { is_active: true } }),
      Product.findAll({
        where: { is_active: true, [Op.and]: [literal('warehouse_stock <= reorder_point')] },
        include: [{ model: Category, as: 'category', attributes: ['name'] }],
        order: [['warehouse_stock', 'ASC'], ['name', 'ASC']],
        limit: 6,
      }),
      Category.findAll({ attributes: ['id', 'name', 'slug'], order: [['name', 'ASC']] }),
      StockMovement.findAll({
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
          { model: User, as: 'user', attributes: ['id', 'name'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 6,
      }),
    ]);

    const totalStock = stockValueRows.reduce((sum, product) => sum + product.warehouse_stock, 0);
    return res.json({
      summary: { activeProducts, totalStock, lowStockCount: await Product.count({ where: { is_active: true, [Op.and]: [literal('warehouse_stock <= reorder_point')] } }) },
      categories,
      lowStockProducts,
      recentMovements,
    });
  } catch (error) {
    return next(error);
  }
}
