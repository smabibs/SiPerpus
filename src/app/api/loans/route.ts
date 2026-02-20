import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || '';
        const member_id = searchParams.get('member_id') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: (string | number)[] = [];

        if (status) {
            if (status === 'terlambat') {
                whereClause += ` AND l.status = 'dipinjam' AND date(l.due_date) < date('now')`;
            } else {
                whereClause += ' AND l.status = ?';
                params.push(status);
            }
        }
        if (member_id) {
            whereClause += ' AND l.member_id = ?';
            params.push(parseInt(member_id));
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM loans l ${whereClause}`).get(...params) as { c: number };
        const loans = db.prepare(`
      SELECT l.*,
        COALESCE(l.quantity, 1) as quantity,
        b.title as book_title, b.isbn as book_isbn, b.author as book_author,
        m.name as member_name, m.member_id as member_code, m.class as member_class, m.type as member_type,
        CASE 
          WHEN l.status = 'dipinjam' AND date(l.due_date) < date('now') THEN 'terlambat'
          ELSE l.status 
        END as computed_status,
        CASE
          WHEN l.status = 'dipinjam' AND date(l.due_date) < date('now') 
          THEN CAST((julianday('now') - julianday(l.due_date)) AS INTEGER) * 1000 * COALESCE(l.quantity, 1)
          ELSE 0
        END as computed_fine
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

        return NextResponse.json({ loans, total: total.c, page, limit });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { book_id, member_id, loan_days = 7, quantity = 1, notes } = body;

        if (!book_id || !member_id) {
            return NextResponse.json({ error: 'Buku dan anggota wajib dipilih' }, { status: 400 });
        }

        const qty = Math.max(1, parseInt(String(quantity)) || 1);

        const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id) as { available_copies: number; title: string } | undefined;
        if (!book) return NextResponse.json({ error: 'Buku tidak ditemukan' }, { status: 404 });
        if (book.available_copies < qty) {
            return NextResponse.json({
                error: `Stok tidak mencukupi. Tersedia: ${book.available_copies} eksemplar, diminta: ${qty}`
            }, { status: 400 });
        }

        const member = db.prepare("SELECT * FROM members WHERE id = ? AND status = 'aktif'").get(member_id);
        if (!member) return NextResponse.json({ error: 'Anggota tidak ditemukan atau tidak aktif' }, { status: 404 });

        // Check if member already borrowed this book (and hasn't returned yet)
        const existingLoan = db.prepare("SELECT id FROM loans WHERE book_id = ? AND member_id = ? AND status = 'dipinjam'").get(book_id, member_id);
        if (existingLoan) return NextResponse.json({ error: 'Anggota sudah meminjam buku ini dan belum dikembalikan' }, { status: 400 });

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + loan_days);
        const dueDateStr = dueDate.toISOString().replace('T', ' ').substring(0, 19);

        const result = db.prepare(`
      INSERT INTO loans (book_id, member_id, quantity, due_date, status, notes)
      VALUES (?, ?, ?, ?, 'dipinjam', ?)
    `).run(book_id, member_id, qty, dueDateStr, notes || null);

        // Deduct available copies by quantity
        db.prepare('UPDATE books SET available_copies = available_copies - ? WHERE id = ?').run(qty, book_id);

        const newLoan = db.prepare(`
      SELECT l.*, COALESCE(l.quantity,1) as quantity, b.title as book_title, b.isbn as book_isbn, m.name as member_name, m.member_id as member_code
      FROM loans l JOIN books b ON l.book_id = b.id JOIN members m ON l.member_id = m.id
      WHERE l.id = ?
    `).get(result.lastInsertRowid) as { book_title: string; member_name: string };
        logAudit('CREATE', 'loan', result.lastInsertRowid, newLoan?.book_title || '', `Peminjam: ${newLoan?.member_name}, Qty: ${qty}`);
        return NextResponse.json(newLoan, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { id, action, return_quantity, notes } = body;

        if (!id || action !== 'return') {
            return NextResponse.json({ error: 'ID dan action wajib diisi' }, { status: 400 });
        }

        const loan = db.prepare("SELECT * FROM loans WHERE id = ? AND status = 'dipinjam'").get(id) as {
            book_id: number; due_date: string; quantity: number;
        } | undefined;
        if (!loan) return NextResponse.json({ error: 'Peminjaman tidak ditemukan atau sudah dikembalikan' }, { status: 404 });

        const loanQty = loan.quantity || 1;
        const returnQty = Math.min(Math.max(1, parseInt(String(return_quantity)) || loanQty), loanQty);

        // Calculate fine (per quantity returned, per day late)
        const dueDate = new Date(loan.due_date);
        const today = new Date();
        let fine = 0;
        if (today > dueDate) {
            const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            // Fine is per-copy per-day
            fine = diffDays * 1000 * returnQty;
        }

        // If returning all copies, mark as dikembalikan. Otherwise partial return is not supported
        // (partial returns create complexity — we mark the whole loan as returned when all copies come back)
        db.prepare(`
      UPDATE loans SET status='dikembalikan', return_date=datetime('now','localtime'), fine=?, notes=?
      WHERE id=?
    `).run(fine, notes || null, id);

        // Restore available copies by return quantity
        db.prepare('UPDATE books SET available_copies = available_copies + ? WHERE id = ?').run(returnQty, loan.book_id);

        const updated = db.prepare(`
      SELECT l.*, COALESCE(l.quantity,1) as quantity, b.title as book_title, b.isbn as book_isbn, m.name as member_name, m.member_id as member_code
      FROM loans l JOIN books b ON l.book_id = b.id JOIN members m ON l.member_id = m.id
      WHERE l.id = ?
    `).get(id) as { book_title: string; member_name: string };
        logAudit('RETURN', 'loan', id, updated?.book_title || '', `Peminjam: ${updated?.member_name}, Denda: ${fine}`);
        return NextResponse.json(updated);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
