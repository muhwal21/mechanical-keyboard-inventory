import { Op, literal } from 'sequelize';
import { Category, Product, Supplier } from '../models/index.js';

const productIncludes = [
  { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
  { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'contact_person', 'phone', 'email', 'city', 'website'] },
];

export async function listProducts(req, res, next) {
  try {
    const where = { is_active: true };
    const search = req.query.search?.trim();
    const categoryId = Number(req.query.categoryId);

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { brand: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
      ];
    }
    if (Number.isInteger(categoryId) && categoryId > 0) where.category_id = categoryId;
    if (req.query.lowStock === 'true') where[Op.and] = [literal('warehouse_stock <= reorder_point')];

    const products = await Product.findAll({ where, include: productIncludes, order: [['name', 'ASC']] });
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
}

export async function listCategories(req, res, next) {
  try {
    const categories = await Category.findAll({
      attributes: ['id', 'slug', 'name'],
      order: [['name', 'ASC']],
    });
    const counts = await Promise.all(categories.map(async (category) => ({
      ...category.toJSON(),
      product_count: await Product.count({ where: { category_id: category.id, is_active: true } }),
    })));
    return res.json({ categories: counts });
  } catch (error) {
    return next(error);
  }
}

export async function createProduct(req, res, next) {
  try {
    const product = await Product.create({ ...req.body, warehouse_stock: 0 });
    const saved = await Product.findByPk(product.id, { include: productIncludes });
    return res.status(201).json({ product: saved });
  } catch (error) {
    return next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await Product.findByPk(Number(req.params.id));
    if (!product || !product.is_active) return res.status(404).json({ message: 'Produk tidak ditemukan.' });
    await product.update(req.body);
    const saved = await Product.findByPk(product.id, { include: productIncludes });
    return res.json({ product: saved });
  } catch (error) {
    return next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByPk(Number(req.params.id));
    if (!product || !product.is_active) return res.status(404).json({ message: 'Produk tidak ditemukan.' });
    await product.update({ is_active: false });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
