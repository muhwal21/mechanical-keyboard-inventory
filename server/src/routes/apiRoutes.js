import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, getCsrfToken, getCurrentUser, logout } from '../controllers/authController.js';
import { getDashboard } from '../controllers/dashboardController.js';
import { createProduct, deleteProduct, listCategories, listProducts, updateProduct } from '../controllers/productController.js';
import { archiveSupplier, createSupplier, listSuppliers, updateSupplier } from '../controllers/supplierController.js';
import { createMovement, listMovements } from '../controllers/stockMovementController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, movementSchema, productSchema, supplierSchema } from '../middleware/validators.js';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' },
});

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.get('/auth/csrf', getCsrfToken);
router.get('/auth/me', getCurrentUser);
router.post('/auth/login', loginLimiter, validateBody(loginSchema), login);
router.post('/auth/logout', requireAuth, logout);

router.use(requireAuth);
router.get('/dashboard', getDashboard);
router.get('/categories', listCategories);
router.get('/suppliers', listSuppliers);
router.post('/suppliers', requireRole('admin'), validateBody(supplierSchema), createSupplier);
router.put('/suppliers/:id', requireRole('admin'), validateBody(supplierSchema), updateSupplier);
router.delete('/suppliers/:id', requireRole('admin'), archiveSupplier);
router.get('/products', listProducts);
router.post('/products', requireRole('admin'), validateBody(productSchema), createProduct);
router.put('/products/:id', requireRole('admin'), validateBody(productSchema), updateProduct);
router.delete('/products/:id', requireRole('admin'), deleteProduct);
router.get('/stock-movements', listMovements);
router.post('/stock-movements', validateBody(movementSchema), createMovement);

export default router;
