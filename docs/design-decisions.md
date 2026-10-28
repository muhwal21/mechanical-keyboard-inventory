# Design direction: mechanical keyboard inventory

## Product identity

The application is a multi-brand mechanical keyboard stockroom. Its name must not use a product brand. The `brand` field belongs to each product record; the supplier is a separate business that sells the item to the stockroom.

Example: a Gateron switch can have `Gateron` as its brand, while the supplier can be a local keyboard distributor with its own contact name, phone, email, and website. A brand is not automatically the supplier.

## Inventory is not a storefront

| Inventory workspace | E-commerce storefront |
| --- | --- |
| Quantity on hand, reorder point, out-of-stock state, and storage location | Product discovery, shopping cart, checkout, and order confirmation |
| Purchase cost, selling price, supplier, and supplier contact | Promotions, ad campaigns, reviews, and customer-facing merchandising |
| Stock-in, stock-out, and adjustment history with actor and timestamp | Sales orders and payment status |
| Operational product table with filters and stock actions | Photo-led product cards and buy actions |

This project can retain a product image, source listing, and listing status as references. It will not show carts, checkout, advertising actions, or customer orders in the MVP.

## Reference comparison

- [Quantara inventory dashboard](https://dribbble.com/shots/26722810-Quantara-Dashboard-Inventory-Management) emphasizes stock visibility: summary metrics, stock-level analysis, item/location details, reorder information, and recent inventory activity. These patterns fit the dashboard and stock history.
- [Store Inventory Dashboard](https://dribbble.com/shots/25005705-Store-Inventory-Dashboard) mixes stock levels with per-item sales statistics, product edits, and ad promotion actions. The useful parts for this project are the compact stock view and direct product editing. The advertising and customer-sales elements are outside this inventory MVP.

### How the Quantara layout maps to KeyStock

The interface follows the Quantara shot closely, in black and white:

| Quantara | KeyStock |
| --- | --- |
| Pill top navigation with an active dot | Same; becomes a floating bottom tab bar on phones |
| "Inventory" title with three KPI chips (total, low stock, out of stock) | "Ringkasan stok" with total units (+7-day change), restock count, out-of-stock count |
| Overview bar: "x items require restocking", download, refresh, add stock | Restock alert, CSV export, refresh, record movement |
| Analytic View: min/avg/max stock + monthly heatmap | Lowest/average/highest stock per SKU + daily heatmap of stock transactions (7/14/30 days, rows: in, out, adjustment, all) |
| Inventory History: item details + buyer contact | Product detail: rack, last movement, category, reorder point, stock, last three movements, supplier email/phone buttons |
| Route map | Rack map: one tile per storage location, colored by stock status |
| Recent Activities table with status filter and pagination | Same, filtered by movement type, 8 rows per page |

Color rules: neutral black/white/gray for surfaces, text, primary buttons, navigation, and the heatmap. Color appears only as stock status — green (aman / stok masuk), yellow (perlu restock / penyesuaian), red (habis / stok keluar / destructive actions). Light and dark mode are two sets of CSS variables (no inversion filter), and the first visit follows the operating system setting. Destructive archive actions use an in-app confirmation dialog. Product photos keep their original colors. The product page is a stock table, not a customer-facing product grid.

## Product data

- Product brand, such as Noir Gear, Work Louder, or Gateron.
- SKU, category, variant specifications, and product source link.
- Purchase price and selling price as separate editable values.
- Existing source listing price range remains a reference only; it is not treated as a verified purchase cost.
- Supplier, supplier contact details, storage location, on-hand quantity, and reorder point.
- Stock movement history that records before/after quantity, user, time, and note.

The current catalog has 23 sourced items from Noir Gear and Work Louder. Those names stay as product brands in the catalog where accurate; they are kept out of the application name, login copy, and dashboard chrome. Supplier contact details and purchase prices not present in the source catalog remain blank. Seed stock and storage locations are simulated for the academic demo.
