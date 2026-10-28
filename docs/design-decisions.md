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

The implementation follows the references' clear summary cards, compact operational tables, and activity history. The interface uses grayscale surfaces with blue for navigation, green for successful/available states, yellow for low stock, and red for critical or archive actions. Destructive archive actions use an in-app confirmation dialog, and successful saves show a green confirmation notice. Light and dark mode selections persist; source product photos retain their original colors. A small seven-day chart counts real stock-log entries, while category mix and low-stock items stay simple for a single stockroom. Its product page is a stock table, not a customer-facing product grid.

## Product data

- Product brand, such as Noir Gear, Work Louder, or Gateron.
- SKU, category, variant specifications, and product source link.
- Purchase price and selling price as separate editable values.
- Existing source listing price range remains a reference only; it is not treated as a verified purchase cost.
- Supplier, supplier contact details, storage location, on-hand quantity, and reorder point.
- Stock movement history that records before/after quantity, user, time, and note.

The current catalog has 23 sourced items from Noir Gear and Work Louder. Those names stay as product brands in the catalog where accurate; they will be removed from the application name, login copy, and dashboard chrome. Supplier contact details and purchase prices not present in the source catalog remain blank. Seed stock and storage locations are simulated for the academic demo.
