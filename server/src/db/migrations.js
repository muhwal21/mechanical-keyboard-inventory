import { DataTypes } from 'sequelize';
import { sequelize } from '../models/index.js';

export async function migrateInventoryFields() {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('products');

  if (!columns.purchase_price) {
    await queryInterface.addColumn('products', 'purchase_price', { type: DataTypes.DECIMAL(14, 2), allowNull: true });
  }
  if (!columns.selling_price) {
    await queryInterface.addColumn('products', 'selling_price', { type: DataTypes.DECIMAL(14, 2), allowNull: true });
  }
  if (!columns.storage_location) {
    await queryInterface.addColumn('products', 'storage_location', { type: DataTypes.STRING(80), allowNull: true });
  }
  if (!columns.supplier_id) {
    await queryInterface.addColumn('products', 'supplier_id', { type: DataTypes.INTEGER.UNSIGNED, allowNull: true });
  }

  const [foreignKeys] = await sequelize.query(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'supplier_id'
      AND REFERENCED_TABLE_NAME = 'suppliers'
    LIMIT 1
  `);
  if (foreignKeys.length === 0) {
    await queryInterface.addConstraint('products', {
      fields: ['supplier_id'],
      type: 'foreign key',
      name: 'fk_products_supplier',
      references: { table: 'suppliers', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  }
}
