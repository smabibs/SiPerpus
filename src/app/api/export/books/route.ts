import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getDb } from '@/lib/db';
import { getSchoolSettings, addSchoolHeader, addSignatureFooter } from '@/lib/excelHelper';

const ACCENT = '1E3A8A';
const ACCENT_LIGHT = 'FFEEF2FF';
const TOTAL_COLS = 12;

export async function GET() {
    try {
        const db = getDb();
        const school = getSchoolSettings(db);

        const books = db.prepare(`
            SELECT b.isbn, b.title, b.author, b.publisher, b.year,
                   s.name as subject_name, c.name as category_name,
                   b.total_copies, b.available_copies, b.shelf_location, b.language
            FROM books b
            LEFT JOIN subjects s ON b.subject_id = s.id
            LEFT JOIN categories c ON b.category_id = c.id
            ORDER BY b.title
        `).all() as Record<string, string | number>[];

        const wb = new ExcelJS.Workbook();
        wb.creator = 'SiPERPUS';
        wb.created = new Date();

        const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

        const ws = wb.addWorksheet('Daftar Buku', {
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
            headerFooter: {
                oddHeader: `&C&"Arial,Bold"${school.school_name} — DAFTAR BUKU`,
                oddFooter: `&L${school.school_address}, ${school.school_city}&RHalaman &P dari &N`,
            },
        });

        ws.columns = [
            { key: 'no', width: 4 }, { key: 'isbn', width: 18 }, { key: 'title', width: 40 },
            { key: 'author', width: 24 }, { key: 'publisher', width: 20 }, { key: 'year', width: 8 },
            { key: 'subject', width: 18 }, { key: 'category', width: 16 },
            { key: 'total', width: 10 }, { key: 'avail', width: 10 }, { key: 'shelf', width: 10 }, { key: 'lang', width: 12 },
        ];

        // School identity header
        const headerEndRow = await addSchoolHeader(
            ws, school, TOTAL_COLS, ACCENT,
            'Daftar Koleksi Buku Perpustakaan',
            `Dicetak: ${now}  ·  Total: ${books.length} judul buku`
        );

        // Column header row (row 8)
        const headerRow = ws.addRow([
            'No', 'ISBN', 'Judul Buku', 'Pengarang', 'Penerbit', 'Tahun',
            'Mata Pelajaran', 'Kategori', 'Total Eks', 'Tersedia', 'Rak', 'Bahasa'
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

        // Data rows
        books.forEach((book, i) => {
            const row = ws.addRow([
                i + 1, book.isbn || '', book.title, book.author || '', book.publisher || '',
                book.year || '', book.subject_name || '-', book.category_name || '-',
                book.total_copies, book.available_copies, book.shelf_location || '', book.language || 'Indonesia'
            ]);
            const isEven = (i + 1) % 2 === 0;
            row.eachCell((cell, col) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? ACCENT_LIGHT : 'FFFFFFFF' } };
                cell.border = { top: { style: 'hair', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } }, left: { style: 'hair', color: { argb: 'FFCCCCCC' } }, right: { style: 'hair', color: { argb: 'FFCCCCCC' } } };
                if (col === 1) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.font = { color: { argb: 'FF888888' }, size: 9.5 }; }
                else if (col === 9 || col === 10) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
                else { cell.alignment = { vertical: 'middle' }; }
                if (col === 10 && (book.available_copies as number) === 0) {
                    cell.font = { bold: true, color: { argb: 'FFE53E3E' } };
                }
            });
            row.height = 19;
        });

        // Summary row
        const summaryRow = ws.addRow([
            '', '', `Total: ${books.length} judul buku`, '', '', '', '', '',
            { formula: `SUM(I${dataStartRow + 1}:I${dataStartRow + books.length})` } as ExcelJS.CellValue,
            { formula: `SUM(J${dataStartRow + 1}:J${dataStartRow + books.length})` } as ExcelJS.CellValue,
            '', ''
        ]);
        summaryRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        summaryRow.height = 22;

        // Signature
        addSignatureFooter(ws, school, TOTAL_COLS, ACCENT);

        const buf = await wb.xlsx.writeBuffer();
        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="daftar-buku-${new Date().toISOString().slice(0, 10)}.xlsx"`,
            },
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
