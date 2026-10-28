import { Product, StockMovement, User } from '../models/index.js';
import { recordMovement, StockError } from '../services/stockService.js';

export async function listMovements(req, res, next) {
  try {
    const movements = await StockMovement.findAll({
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
        { model: User, as: 'user', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    return res.json({ movements });
  } catch (error) {
    return next(error);
  }
}

export async function createMovement(req, res, next) {
  try {
    const result = await recordMovement({
      productId: req.body.product_id,
      userId: req.user.id,
      type: req.body.movement_type,
      quantity: req.body.quantity,
      note: req.body.note,
    });
    const movement = await StockMovement.findByPk(result.movement.id, {
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
        { model: User, as: 'user', attributes: ['id', 'name'] },
      ],
    });
    return res.status(201).json({ movement, product: result.product });
  } catch (error) {
    if (error instanceof StockError) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}
