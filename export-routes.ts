import express from 'express';
import PDFDocument from 'pdfkit';
import { query } from './db';
import { adminAuth, superAdminAuth, parseId } from './middleware';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows: any[], columns: string[]): string {
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => escapeCsv(row[col])).join(',')
  );
  return header + '\n' + lines.join('\n');
}

export function setupExportRoutes(app: express.Application) {

  // ─── 1. Invoice PDF ─────────────────────────────────────────────────
  app.get('/api/export/appointments/:id/invoice', adminAuth, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) return res.status(400).json({ error: 'Invalid appointment ID' });

      const rows: any = await query(
        `SELECT a.*, s.name as service_name, s.price as service_price, s.duration as service_duration,
                sl.name as salon_name, sl.address as salon_address,
                b.name as barber_name
         FROM appointments a
         JOIN services s ON a.service_id = s.id
         JOIN salons sl ON a.salon_id = sl.id
         JOIN barbers b ON a.barber_id = b.id
         WHERE a.id = ?`,
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });

      const apt = rows[0];
      const aptDate = apt.appointment_date ? new Date(apt.appointment_date) : null;
      const aptDateStr = aptDate ? aptDate.toISOString().slice(0, 10).replace(/-/g, '') : '00000000';
      const dateStr = aptDateStr;
      const invoiceNo = `INV-${dateStr}-${String(apt.id).padStart(4, '0')}`;

      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${apt.id}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('AutoZap', 50, 50);
      doc.fontSize(10).font('Helvetica').text('Professional Salon Solutions', 50, 78, { continued: false });

      // Invoice title
      doc.fontSize(18).font('Helvetica-Bold').text('INVOICE', 400, 50, { align: 'right' });
      doc.fontSize(10).font('Helvetica').text(`Invoice #: ${invoiceNo}`, 400, 76, { align: 'right' });
      doc.fontSize(10).font('Helvetica').text(`Date: ${apt.appointment_date ? (typeof apt.appointment_date === 'string' ? apt.appointment_date : new Date(apt.appointment_date).toLocaleDateString()) : 'N/A'}`, 400, 92, { align: 'right' });

      // Horizontal line
      doc.moveTo(50, 115).lineTo(545, 115).stroke();

      // Bill To
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To', 50, 135);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${apt.customer_name || apt.customer_phone}`, 50, 155);
      doc.text(`Phone: ${apt.customer_phone}`, 50, 171);

      // Salon Info
      doc.fontSize(12).font('Helvetica-Bold').text('Salon', 300, 135);
      doc.fontSize(10).font('Helvetica');
      doc.text(apt.salon_name, 300, 155);
      doc.text(apt.salon_address || '', 300, 171);

      // Service Details Table
      const tableTop = 220;
      doc.moveTo(50, tableTop - 8).lineTo(545, tableTop - 8).stroke();
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Service', 50, tableTop);
      doc.text('Duration', 300, tableTop, { width: 90, align: 'center' });
      doc.text('Price', 460, tableTop, { width: 80, align: 'right' });
      doc.moveTo(50, tableTop + 18).lineTo(545, tableTop + 18).stroke();

      doc.fontSize(10).font('Helvetica');
      const rowY = tableTop + 26;
      doc.text(apt.service_name, 50, rowY);
      doc.text(`${apt.service_duration} min`, 300, rowY, { width: 90, align: 'center' });
      doc.text(`Rs. ${parseFloat(apt.service_price).toFixed(2)}`, 460, rowY, { width: 80, align: 'right' });

      // Extra details
      const extraY = rowY + 30;
      doc.moveTo(50, extraY - 6).lineTo(545, extraY - 6).stroke();
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Barber:', 50, extraY);
      doc.fontSize(10).font('Helvetica');
      doc.text(apt.barber_name, 130, extraY);
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Date:', 50, extraY + 16);
      doc.fontSize(10).font('Helvetica');
      doc.text(apt.appointment_date ? new Date(apt.appointment_date).toLocaleDateString() : 'N/A', 130, extraY + 16);
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Time:', 50, extraY + 32);
      doc.fontSize(10).font('Helvetica');
      doc.text(apt.appointment_time ? apt.appointment_time.slice(0, 5) : 'N/A', 130, extraY + 32);
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Status:', 50, extraY + 48);
      doc.fontSize(10).font('Helvetica');
      doc.text(apt.status, 130, extraY + 48);

      // Total
      const totalY = extraY + 80;
      doc.moveTo(350, totalY - 6).lineTo(545, totalY - 6).stroke();
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('Total:', 380, totalY);
      doc.text(`Rs. ${parseFloat(apt.service_price).toFixed(2)}`, 460, totalY, { width: 80, align: 'right' });
      doc.moveTo(350, totalY + 22).lineTo(545, totalY + 22).stroke();

      // Footer
      doc.fontSize(10).font('Helvetica').fillColor('#888');
      doc.text('Thank you for choosing AutoZap', 50, 700, { align: 'center' });

      doc.end();
    } catch (e: any) {
      console.error('[Export] Invoice PDF error:', e?.message || e);
      res.status(500).json({ error: 'Failed to generate invoice' });
    }
  });

  // ─── 2. Appointments CSV ────────────────────────────────────────────
  app.get('/api/export/appointments/csv', adminAuth, async (req, res) => {
    try {
      const { salon_id, status, date_from, date_to } = req.query;
      let sql = `SELECT a.id, a.customer_name, a.customer_phone, sl.name as salon_name,
                        s.name as service_name, b.name as barber_name,
                        a.appointment_date, a.appointment_time, a.status, a.created_at
                 FROM appointments a
                 JOIN services s ON a.service_id = s.id
                 JOIN salons sl ON a.salon_id = sl.id
                 JOIN barbers b ON a.barber_id = b.id
                 WHERE 1=1`;
      const params: any[] = [];
      if (salon_id) { sql += ' AND a.salon_id = ?'; params.push(Number(salon_id)); }
      if (status) { sql += ' AND a.status = ?'; params.push(status); }
      if (date_from) { sql += ' AND a.appointment_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND a.appointment_date <= ?'; params.push(date_to); }
      sql += ' ORDER BY a.created_at DESC';

      const rows: any = await query(sql, params);
      const columns = ['id', 'customer_name', 'customer_phone', 'salon_name', 'service_name', 'barber_name', 'appointment_date', 'appointment_time', 'status', 'created_at'];
      const csv = toCsv(rows, columns);

      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="appointments-${dateTag}.csv"`);
      res.send(csv);
    } catch (e: any) {
      console.error('[Export] Appointments CSV error:', e?.message || e);
      res.status(500).json({ error: 'Failed to export appointments' });
    }
  });

  // ─── 3. Customers CSV ───────────────────────────────────────────────
  app.get('/api/export/customers/csv', adminAuth, async (req, res) => {
    try {
      const rows: any = await query(
        `SELECT phone, name, COALESCE(loyalty_points, 0) as loyalty_points,
                COALESCE(status, 'New') as status_val,
                last_active, COALESCE(total_visits, 0) as visit_count
         FROM customers
         ORDER BY last_active DESC`
      );
      const mapped = rows.map((r: any) => ({
        phone: r.phone,
        name: r.name || '',
        email: '',
        loyalty_points: r.loyalty_points || 0,
        status: r.status_val || 'New',
        last_active: r.last_active || '',
        visit_count: r.visit_count || 0
      }));
      const columns = ['phone', 'name', 'email', 'loyalty_points', 'status', 'last_active', 'visit_count'];
      const csv = toCsv(mapped, columns);

      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="customers-${dateTag}.csv"`);
      res.send(csv);
    } catch (e: any) {
      console.error('[Export] Customers CSV error:', e?.message || e);
      res.status(500).json({ error: 'Failed to export customers' });
    }
  });

  // ─── 4. Finances CSV ────────────────────────────────────────────────
  app.get('/api/export/finances/csv', adminAuth, async (req, res) => {
    try {
      const { salon_id, date_from, date_to } = req.query;

      // Revenue from completed appointments
      let revSql = `SELECT a.appointment_date, s.price, sl.name as salon_name
                    FROM appointments a
                    JOIN services s ON a.service_id = s.id
                    JOIN salons sl ON a.salon_id = sl.id
                    WHERE a.status = 'completed'`;
      const revParams: any[] = [];
      if (salon_id) { revSql += ' AND a.salon_id = ?'; revParams.push(Number(salon_id)); }
      if (date_from) { revSql += ' AND a.appointment_date >= ?'; revParams.push(date_from); }
      if (date_to) { revSql += ' AND a.appointment_date <= ?'; revParams.push(date_to); }
      revSql += ' ORDER BY a.appointment_date DESC';
      const revenueRows: any = await query(revSql, revParams);

      // Expenses
      let expSql = `SELECT e.*, sl.name as salon_name
                    FROM expenses e
                    JOIN salons sl ON e.salon_id = sl.id
                    WHERE 1=1`;
      const expParams: any[] = [];
      if (salon_id) { expSql += ' AND e.salon_id = ?'; expParams.push(Number(salon_id)); }
      if (date_from) { expSql += ' AND e.date >= ?'; expParams.push(date_from); }
      if (date_to) { expSql += ' AND e.date <= ?'; expParams.push(date_to); }
      expSql += ' ORDER BY e.date DESC';
      const expenseRows: any = await query(expSql, expParams);

      const combined: any[] = [];
      for (const r of revenueRows) {
        combined.push({
          type: 'Revenue',
          description: 'Appointment revenue',
          amount: r.price,
          category: 'Service',
          date: r.appointment_date,
          salon: r.salon_name
        });
      }
      for (const e of expenseRows) {
        combined.push({
          type: 'Expense',
          description: e.description,
          amount: e.amount,
          category: e.category || 'General',
          date: e.date,
          salon: e.salon_name
        });
      }
      combined.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });

      const columns = ['type', 'description', 'amount', 'category', 'date', 'salon'];
      const csv = toCsv(combined, columns);

      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="finances-${dateTag}.csv"`);
      res.send(csv);
    } catch (e: any) {
      console.error('[Export] Finances CSV error:', e?.message || e);
      res.status(500).json({ error: 'Failed to export finances' });
    }
  });

  // ─── 5. Database Backup ─────────────────────────────────────────────
  app.post('/api/admin/database/backup', superAdminAuth, async (req, res) => {
    try {
      let tableNames: string[] = [];
      if (process.env.USE_SQLITE === 'true') {
        const rows: any = await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", []);
        tableNames = rows.map((r: any) => r.name);
      } else {
        const tables: any = await query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?", [process.env.DB_NAME || 'autozap_platform']);
        tableNames = tables.map((t: any) => t.TABLE_NAME);
      }

      const dump: Record<string, any[]> = {};
      for (const name of tableNames) {
        try {
          const quote = process.env.USE_SQLITE === 'true' ? '"' : '`';
          const rows: any = await query(`SELECT * FROM ${quote}${name}${quote}`);
          dump[name] = rows;
        } catch (e) {
          console.warn(`[Backup] Skipping table ${name}:`, e);
          dump[name] = [];
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const json = JSON.stringify(dump, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="autozap-backup-${timestamp}.json"`);
      res.send(json);
    } catch (e: any) {
      console.error('[Backup] Error:', e?.message || e);
      res.status(500).json({ error: 'Failed to create backup' });
    }
  });

  // ─── 6. Database Restore ────────────────────────────────────────────
  app.post('/api/admin/database/restore', superAdminAuth, async (req, res) => {
    try {
      const { tables } = req.body;
      if (!tables || typeof tables !== 'object') {
        return res.status(400).json({ error: 'Body must contain { tables: { tableName: rows[] } }' });
      }

      let restoredCount = 0;
      const isSqlite = process.env.USE_SQLITE === 'true';
      const q = isSqlite ? '"' : '`';

      const allowedTableNames = new Set<string>();
      if (isSqlite) {
        const rows: any = await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", []);
        for (const r of rows) allowedTableNames.add(r.name);
      } else {
        const rows: any = await query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?", [process.env.DB_NAME || 'autozap_platform']);
        for (const r of rows) allowedTableNames.add(r.TABLE_NAME);
      }
      const validTableRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const validColumnRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

      for (const [tableName, rows] of Object.entries(tables)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        if (!allowedTableNames.has(tableName) || !validTableRegex.test(tableName)) {
          console.warn(`[Restore] Skipping invalid table: ${tableName}`);
          continue;
        }

        try {
          if (isSqlite) {
            await query('PRAGMA foreign_keys = OFF');
          } else {
            await query('SET FOREIGN_KEY_CHECKS = 0');
          }
          if (isSqlite) {
            await query(`DELETE FROM ${q}${tableName}${q}`);
          } else {
            await query(`TRUNCATE TABLE ${q}${tableName}${q}`);
          }

          for (const row of rows as any[]) {
            const keys = Object.keys(row).filter(k => validColumnRegex.test(k));
            if (keys.length === 0) continue;
            const placeholders = keys.map(() => '?').join(',');
            const values = keys.map(k => row[k]);
            await query(
              `INSERT INTO ${q}${tableName}${q} (${keys.map(k => q + k + q).join(',')}) VALUES (${placeholders})`,
              values
            );
          }
          restoredCount++;
        } catch (e: any) {
          console.warn(`[Restore] Failed to restore table ${tableName}:`, e?.message || e);
        } finally {
          if (isSqlite) {
            await query('PRAGMA foreign_keys = ON');
          } else {
            await query('SET FOREIGN_KEY_CHECKS = 1');
          }
        }
      }

      res.json({ success: true, tables_restored: restoredCount });
    } catch (e: any) {
      console.error('[Restore] Error:', e?.message || e);
      res.status(500).json({ error: 'Failed to restore database' });
    }
  });
}
