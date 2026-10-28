import { ForeignKeyConstraintError, UniqueConstraintError, ValidationError } from 'sequelize';

export function notFound(req, res) {
  return res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({ message: 'SKU atau email sudah digunakan.' });
  }
  if (error instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ message: 'Data masih dipakai oleh catatan lain dan tidak dapat dihapus.' });
  }
  if (error instanceof ValidationError) {
    return res.status(400).json({ message: 'Data tidak memenuhi validasi.' });
  }
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
}
