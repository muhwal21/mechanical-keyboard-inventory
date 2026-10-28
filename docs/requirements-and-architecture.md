# Requirements and Architecture

## Project case

Noir Gear Inventory is a small warehouse inventory system for mechanical keyboards and related products. The owner can review stock, maintain a catalog, and record each stock change. Marketplace listing state is descriptive only; the MVP will not call marketplace APIs or claim automatic synchronization.

The product source catalog contains 23 sample items across keyboards, switches, accessories, keycaps, and deskmats. Warehouse quantities will be clearly marked as simulated seed data.

## User roles

- **Admin:** view dashboard; create, read, update, and archive products; record stock movements.
- **Staff:** view dashboard and products; record stock movements; cannot delete products or manage users.

## MVP features

1. Login, logout, and server-side session.
2. Dashboard counts for active products, estimated stock on hand, low-stock products, and recent movements.
3. Product catalog with category, SKU, brand, price, source listing status, stock quantity, and reorder point.
4. Product CRUD with server-side validation.
5. Stock-in, stock-out, and adjustment movements. Each movement records actor, product, quantity, before/after balance, note, and timestamp.
6. Search, category filter, and low-stock filter.

## MVC request flow

1. Vue submits a JSON request to an Express route.
2. Authentication, role, CSRF, and validation middleware check the request.
3. The controller calls a domain service and Sequelize model.
4. Sequelize uses parameter binding for SQL values and commits a transaction.
5. Express returns a JSON response; Vue updates the visible product or stock summary.

## Database relationships

- `categories` 1-to-many `products`.
- `products` 1-to-many `stock_movements`.
- `users` 1-to-many `stock_movements`.
- Session records are persisted in MySQL by the session store. They are separate from the four domain tables.

See [erd.mmd](./erd.mmd).

## Security decisions

- Hash passwords with a password hashing function; never store plain-text passwords.
- Keep authentication in an HTTP-only, same-site session cookie; use secure cookies in production.
- Require a session-bound CSRF token on state-changing API requests.
- Validate fields on the server and use Sequelize parameter binding for SQL values.
- Render user-provided text through Vue's escaped interpolation; do not render untrusted HTML with `v-html`.
- Restrict destructive actions to the admin role.
- Keep database credentials and session secrets in environment variables.

## Initial implementation order

1. Requirements, schema, and repository setup.
2. MySQL connection, migrations, seed data, and authentication.
3. Product and stock-movement API.
4. Vue dashboard and CRUD flows.
5. Deployment configuration and submission evidence.
