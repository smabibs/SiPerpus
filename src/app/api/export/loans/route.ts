import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getDb } from '@/lib/db';
import { getSchoolSettings, addSchoolHeader, addSignatureFooter } from '@/lib/excelHelper';

const ACCENT = '4C1D95';
const ACCENT_LIGHT = 'FFF5F3FF';
const TOTAL_COLS = 15;

export async function GET() {
    try {
        const db = getDb();
        const school = getSchoolSettings(db);

        const loans = db.prepare(`
            SELECT l.id, b.isbn as book_isbn, b.title as book_title, b.author as book_author,
                   m.member_id as member_code, m.name as member_name, m.class as member_class, m.type as member_type,
                   COALESCE(l.quantity, 1) as quantity,
                   l.loan_date, l.due_date, l.return_date,
                   CASE
                     WHEN l.status = 'dipinjam' AND date(l.due_date) < date('now') THEN 'Terlambat'
                     WHEN l.status = 'dipinjam' THEN 'Dipinjam'
                     ELSE 'Dikembalikan'
                   END as status,
                   COALESCE(l.fine, 0) as fine,
                   l.notes
            FROM loans l
            JOIN books b ON l.book_id = b.id
            JOIN members m ON l.member_id = m.id
            ORDER BY l.created_at DESC
        `).all() as Record<string, string | number>[];

        const wb = new ExcelJS.Workbook();
        wb.creator = 'SiPERPUS';
        wb.created = new Date();

        const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const totalFine = (loans as Record<string, number>[]).reduce((s, l) => s + (l.fine || 0), 0);
        const overdue = loans.filter(l => l.status === 'Terlambat').length;
        const returned = loans.filter(l => l.status === 'Dikembalikan').length;

        const ws = wb.addWorksheet('Data Peminjaman', {
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
            headerFooter: {
                oddHeader: `&C&"Arial,Bold"${school.school_name} — DATA PEMINJAMAN`,
                oddFooter: `&L${school.school_address}, ${school.school_city}&RHalaman &P dari &N`,
            },
        });

        ws.columns = [
            { key: 'no', width: 5 }, { key: 'title', width: 34 }, { key: 'isbn', width: 16 }, { key: 'author', width: 18 },
            { key: 'code', width: 12 }, { key: 'member', width: 22 }, { key: 'class', width: 14 }, { key: 'type', width: 10 },
            { key: 'qty', width: 6 }, { key: 'loan_date', width: 13 }, { key: 'due_date', width: 13 }, { key: 'return_date', width: 13 },
            { key: 'status', width: 13 }, { key: 'fine', width: 14 }, { key: 'notes', width: 20 },
        ];

        // School identity header
        const headerEndRow = await addSchoolHeader(
            ws, school, TOTAL_COLS, ACCENT,
            'Data Peminjaman Buku Perpustakaan',
            `Dicetak: ${now}  ·  Total: ${loans.length} transaksi  ·  Terlambat: ${overdue}  ·  Dikembalikan: ${returned}`
        );

        // Column header
        const headerRow = ws.addRow([
            'No', 'Judul Buku', 'ISBN', 'Pengarang', 'ID Anggota', 'Nama Peminjam', 'Kelas', 'Tipe',
            'Jml', 'Tgl Pinjam', 'Jatuh Tempo', 'Tgl Kembali', 'Status', 'Denda (Rp)', 'Catatan'
        ]);
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });
        headerRow.height = 30;

        const dataStartRow = headerEndRow + 1;
        ws.autoFilter = { from: { row: dataStartRow, column: 1 }, to: { row: dataStartRow, column: TOTAL_COLS } };
        ws.views = [{ state: 'frozen', xSplit: 0, ySplit: dataStartRow, activeCell: `A${dataStartRow + 1}` }];

        const formatDate = (s: string | number) => s ? new Date(String(s)).toLocaleDateString('id-ID') : '-';

        loans.forEach((l, i) => {
            const status = String(l.status);
            const row = ws.addRow([
                i + 1, l.book_title, l.book_isbn || '', l.book_author || '',
                l.member_code, l.member_name, l.member_class || '-', l.member_type,
                l.quantity, formatDate(l.loan_date), formatDate(l.due_date),
                l.return_date ? formatDate(l.return_date) : '-',
                status, l.fine || 0, l.notes || '',
            ]);
            const isEven = (i + 1) % 2 === 0;
            row.eachCell((cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? ACCENT_LIGHT : 'FFFFFFFF' } };
                cell.border = { top: { style: 'hair', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } }, left: { style: 'hair', color: { argb: 'FFCCCCCC' } }, right: { style: 'hair', color: { argb: 'FFCCCCCC' } } };
                if (col === 1) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.font = { color: { argb: 'FF888888' }, size: 9.5 }; }
                else if (col === 9) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
                else if (col === 13) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    if (status === 'Terlambat') cell.font = { bold: true, color: { argb: 'FFDC2626' } };
                    else if (status === 'Dikembalikan') cell.font = { color: { argb: 'FF16A34A' } };
                    else cell.font = { color: { argb: 'FF2563EB' } };
                } else if (col === 14) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '#,##0';
                    if ((l.fine as number) > 0) cell.font = { bold: true, color: { argb: 'FFDC2626' } };
                } else { cell.alignment = { vertical: 'middle' }; }
            });
            row.height = 19;
        });

        // Summary row
        const summaryRow = ws.addRow([
            '', '', '', '', '', '', '', '', '',
            '', '', '', 'TOTAL DENDA', totalFine, ''
        ]);
        summaryRow.eachCell((cell, col) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            if (col === 14) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
            else if (col === 13) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
            else { cell.alignment = { vertical: 'middle', horizontal: 'center' }; }
        });
        summaryRow.height = 24;

        addSignatureFooter(ws, school, TOTAL_COLS, ACCENT);

        const buf = await wb.xlsx.writeBuffer();
        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="data-peminjaman-${new Date().toISOString().slice(0, 10)}.xlsx"`,
            },
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
