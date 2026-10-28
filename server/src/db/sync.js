import { sequelize } from '../models/index.js';

try {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('MySQL connection ready; models synchronized.');
} catch (error) {
  console.error('Database sync failed:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
