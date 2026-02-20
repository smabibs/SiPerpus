import { NextRequest, NextResponse } from 'next/server';
import { getDb, logAudit } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const db = getDb();
        const body = await req.json();
        const { action, ids } = body as { action: string; ids: number[] };

        if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Action dan IDs wajib diisi' }, { status: 400 });
        }

        let affected = 0;

        const run = db.transaction(() => {
            switch (action) {
                case 'delete_books': {
                    for (const id of ids) {
                        const book = db.prepare('SELECT title FROM books WHERE id = ?').get(id) as { title: string } | undefined;
                        const activeLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE book_id = ? AND status = 'dipinjam'").get(id) as { c: number };
                        if (activeLoans.c > 0) continue; // skip books with active loans
                        db.prepare('DELETE FROM loans WHERE book_id = ?').run(id);
                        const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
                        if (result.changes > 0) {
                            affected++;
                            logAudit('BULK_DELETE', 'book', id, book?.title || 'Unknown');
                        }
                    }
                    break;
                }
                case 'delete_members': {
                    for (const id of ids) {
                        const member = db.prepare('SELECT name FROM members WHERE id = ?').get(id) as { name: string } | undefined;
                        const activeLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE member_id = ? AND status = 'dipinjam'").get(id) as { c: number };
                        if (activeLoans.c > 0) continue; // skip members with active loans
                        const result = db.prepare('DELETE FROM members WHERE id = ?').run(id);
                        if (result.changes > 0) {
                            affected++;
                            logAudit('BULK_DELETE', 'member', id, member?.name || 'Unknown');
                        }
                    }
                    break;
                }
                case 'return_loans': {
                    for (const id of ids) {
                        const loan = db.prepare("SELECT l.*, b.title as book_title, m.name as member_name FROM loans l JOIN books b ON l.book_id = b.id JOIN members m ON l.member_id = m.id WHERE l.id = ? AND l.status = 'dipinjam'").get(id) as {
                            book_id: number; due_date: string; quantity: number;
                            book_title: string; member_name: string;
                        } | undefined;
                        if (!loan) continue;

                        const loanQty = loan.quantity || 1;
                        const dueDate = new Date(loan.due_date);
                        const today = new Date();
                        let fine = 0;
                        if (today > dueDate) {
                            const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                            fine = diffDays * 1000 * loanQty;
                        }

                        db.prepare(`UPDATE loans SET status='dikembalikan', return_date=datetime('now','localtime'), fine=? WHERE id=?`).run(fine, id);
                        db.prepare('UPDATE books SET available_copies = available_copies + ? WHERE id = ?').run(loanQty, loan.book_id);
                        affected++;
                        logAudit('BULK_RETURN', 'loan', id, loan.book_title, `Peminjam: ${loan.member_name}, Denda: ${fine}`);
                    }
                    break;
                }
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        });

        run();

        return NextResponse.json({
            success: true,
            affected,
            message: `${affected} item berhasil diproses`,
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
