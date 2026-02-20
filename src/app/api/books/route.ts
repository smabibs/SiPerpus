import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';
        const subject_id = searchParams.get('subject_id') || '';
        const category_id = searchParams.get('category_id') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: (string | number)[] = [];

        if (search) {
            whereClause += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.publisher LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (subject_id) {
            whereClause += ' AND b.subject_id = ?';
            params.push(parseInt(subject_id));
        }
        if (category_id) {
            whereClause += ' AND b.category_id = ?';
            params.push(parseInt(category_id));
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM books b ${whereClause}`).get(...params) as { c: number };
        const books = db.prepare(`
      SELECT b.*, s.name as subject_name, s.color as subject_color, c.name as category_name,
        (SELECT GROUP_CONCAT(t.id || ':' || t.name || ':' || t.color, '|') FROM book_tags bt JOIN tags t ON bt.tag_id = t.id WHERE bt.book_id = b.id) as tags_raw
      FROM books b
      LEFT JOIN subjects s ON b.subject_id = s.id
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

        // Parse tags_raw into array
        const booksWithTags = (books as Record<string, unknown>[]).map(book => {
            const tagsRaw = book.tags_raw as string | null;
            const tags = tagsRaw ? tagsRaw.split('|').map(t => {
                const [id, name, color] = t.split(':');
                return { id: parseInt(id), name, color };
            }) : [];
            const { tags_raw: _, ...rest } = book;
            return { ...rest, tags };
        });

        return NextResponse.json({ books: booksWithTags, total: total.c, page, limit });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { isbn, title, author, publisher, year, edition, subject_id, category_id, total_copies, shelf_location, description, language, tag_ids } = body;

        if (!title) return NextResponse.json({ error: 'Judul buku wajib diisi' }, { status: 400 });

        const insertBook = db.transaction(() => {
            const stmt = db.prepare(`
          INSERT INTO books (isbn, title, author, publisher, year, edition, subject_id, category_id, total_copies, available_copies, shelf_location, description, language)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
            const result = stmt.run(
                isbn || null, title, author || null, publisher || null,
                year || null, edition || null,
                subject_id || null, category_id || null,
                total_copies || 1, total_copies || 1,
                shelf_location || null, description || null, language || 'Indonesia'
            );

            // Sync tags
            if (tag_ids && Array.isArray(tag_ids)) {
                const insertTag = db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)');
                for (const tagId of tag_ids) {
                    insertTag.run(result.lastInsertRowid, tagId);
                }
            }

            return result;
        });

        const result = insertBook();
        const newBook = db.prepare('SELECT b.*, s.name as subject_name, s.color as subject_color, c.name as category_name FROM books b LEFT JOIN subjects s ON b.subject_id = s.id LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?').get(result.lastInsertRowid);
        logAudit('CREATE', 'book', result.lastInsertRowid, title, `ISBN: ${isbn || '-'}`);
        return NextResponse.json(newBook, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { id, isbn, title, author, publisher, year, edition, subject_id, category_id, total_copies, shelf_location, description, language, tag_ids } = body;

        if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

        const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as { available_copies: number; total_copies: number } | undefined;
        if (!existing) return NextResponse.json({ error: 'Buku tidak ditemukan' }, { status: 404 });

        const borrowed = existing.total_copies - existing.available_copies;
        const newAvailable = Math.max(0, (total_copies || existing.total_copies) - borrowed);

        const updateBook = db.transaction(() => {
            db.prepare(`
          UPDATE books SET isbn=?, title=?, author=?, publisher=?, year=?, edition=?, subject_id=?, category_id=?,
          total_copies=?, available_copies=?, shelf_location=?, description=?, language=?, updated_at=datetime('now','localtime')
          WHERE id=?
        `).run(isbn || null, title, author || null, publisher || null, year || null, edition || null,
                subject_id || null, category_id || null, total_copies || 1, newAvailable, shelf_location || null, description || null, language || 'Indonesia', id);

            // Sync tags
            if (tag_ids !== undefined && Array.isArray(tag_ids)) {
                db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(id);
                const insertTag = db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)');
                for (const tagId of tag_ids) {
                    insertTag.run(id, tagId);
                }
            }
        });
        updateBook();

        const updated = db.prepare('SELECT b.*, s.name as subject_name, s.color as subject_color, c.name as category_name FROM books b LEFT JOIN subjects s ON b.subject_id = s.id LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?').get(id);
        logAudit('UPDATE', 'book', id, title);
        return NextResponse.json(updated);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const db = getDb();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });

        const book = db.prepare('SELECT title FROM books WHERE id = ?').get(id) as { title: string } | undefined;
        if (!book) return NextResponse.json({ error: 'Buku tidak ditemukan' }, { status: 404 });

        // Block if book is currently on loan
        const activeLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE book_id = ? AND status = 'dipinjam'").get(id) as { c: number };
        if (activeLoans.c > 0) {
            return NextResponse.json({ error: `Buku "${book.title}" sedang dipinjam (${activeLoans.c} peminjaman aktif). Kembalikan dulu sebelum menghapus.` }, { status: 400 });
        }

        // Delete in a transaction: remove loan history first, then the book
        const deleteBook = db.transaction(() => {
            db.prepare('DELETE FROM loans WHERE book_id = ?').run(id);
            db.prepare('DELETE FROM books WHERE id = ?').run(id);
        });
        deleteBook();
        logAudit('DELETE', 'book', id, book.title);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

