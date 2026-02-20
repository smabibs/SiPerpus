import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getDb } from '@/lib/db';

// ── GET: Download template Excel ────────────────────────────────────────────
export async function GET() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SiPERPUS';

    // ── Sheet 1: Template Data ─────────────────────────────────────────────
    const ws = wb.addWorksheet('Katalog Buku');

    const ACCENT = '1E3A8A';
    const COLS = [
        { header: 'ISBN', key: 'isbn', width: 18, note: 'Nomor ISBN buku (opsional)' },
        { header: 'Judul Buku *', key: 'title', width: 40, note: 'Judul buku (WAJIB)' },
        { header: 'Pengarang', key: 'author', width: 28, note: 'Nama pengarang / penulis' },
        { header: 'Penerbit', key: 'publisher', width: 24, note: 'Nama penerbit' },
        { header: 'Tahun Terbit', key: 'year', width: 14, note: 'Tahun terbit (angka, mis: 2022)' },
        { header: 'Edisi', key: 'edition', width: 12, note: 'Edisi buku (mis: 1, 2, Revisi)' },
        { header: 'Jumlah Eksemplar', key: 'total_copies', width: 18, note: 'Jumlah eksemplar (default: 1)' },
        { header: 'Lokasi Rak', key: 'shelf_location', width: 14, note: 'Kode lokasi rak (mis: A-01)' },
        { header: 'Bahasa', key: 'language', width: 14, note: 'Indonesia / Inggris / Arab / Lainnya' },
        { header: 'Mata Pelajaran', key: 'subject', width: 22, note: 'Nama mata pelajaran (harus terdaftar)' },
        { header: 'Deskripsi', key: 'description', width: 36, note: 'Ringkasan / deskripsi buku (opsional)' },
    ];

    ws.columns = COLS.map(c => ({ key: c.key, width: c.width }));

    // Header row
    const headerRow = ws.addRow(COLS.map(c => c.header));
    headerRow.height = 28;
    headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ACCENT}` } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
        };
    });

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: `K1` };

    // Sample rows
    const samples = [
        ['978-602-01-0001-1', 'Matematika XI Semester 1', 'Kemendikbud', 'Erlangga', 2023, '2', 3, 'A-01', 'Indonesia', 'Matematika', 'Buku teks matematika kelas XI'],
        ['978-602-01-0002-2', 'Fisika untuk SMA Kelas XII', 'Bob Foster', 'Erlangga', 2022, '3', 2, 'A-02', 'Indonesia', 'Fisika', ''],
        ['', 'Laskar Pelangi', 'Andrea Hirata', 'Bentang Pustaka', 2005, '', 1, 'F-01', 'Indonesia', '', 'Novel inspiratif'],
    ];
    samples.forEach((row, i) => {
        const r = ws.addRow(row);
        r.height = 20;
        r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF0F4FF' : 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle' };
            cell.font = { size: 10.5, color: { argb: 'FF1F2937' } };
        });
    });

    // ── Sheet 2: Petunjuk ──────────────────────────────────────────────────
    const wsInfo = wb.addWorksheet('📋 Petunjuk');
    wsInfo.getColumn('A').width = 28;
    wsInfo.getColumn('B').width = 60;

    const addInfoRow = (label: string, value: string, bold = false) => {
        const r = wsInfo.addRow([label, value]);
        r.getCell(1).font = { bold: true, size: 11, color: { argb: `FF${ACCENT}` } };
        r.getCell(2).font = { bold, size: 11 };
        r.height = 20;
    };

    wsInfo.addRow([]);
    addInfoRow('SiPERPUS — Template Import Buku', '', true);
    wsInfo.addRow([]);
    addInfoRow('KOLOM WAJIB', 'Judul Buku (kolom B)', true);
    addInfoRow('KOLOM OPSIONAL', 'Semua kolom lainnya');
    wsInfo.addRow([]);
    addInfoRow('Mata Pelajaran', 'Harus sama persis dengan nama yang terdaftar di aplikasi');
    addInfoRow('Jumlah Eksemplar', 'Angka bulat, minimum 1. Kosong = 1 eksemplar');
    addInfoRow('Tahun Terbit', 'Angka 4 digit (mis: 2023)');
    addInfoRow('Bahasa', 'Indonesia / Inggris / Arab / Lainnya');
    wsInfo.addRow([]);
    addInfoRow('TIPS', 'Hapus baris contoh (baris 2-4) sebelum mengisi data Anda');
    addInfoRow('', 'Baris kosong akan diabaikan otomatis');
    addInfoRow('', 'Jika ISBN sudah ada di database, buku akan dilewati (tidak duplikat)');

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="template-import-buku.xlsx"',
        },
    });
}

// ── POST: Parse & insert books from uploaded Excel ──────────────────────────
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'File Excel wajib diupload' }, { status: 400 });

        const buffer = new Uint8Array(await file.arrayBuffer()).buffer;
        const wb = new ExcelJS.Workbook();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (wb.xlsx as any).load(buffer);

        // Find first sheet (Katalog Buku or index 0)
        const ws = wb.worksheets[0];
        if (!ws) return NextResponse.json({ error: 'File tidak valid atau sheet kosong' }, { status: 400 });

        const db = getDb();

        // Cache subjects by name (case-insensitive)
        const subjects = db.prepare('SELECT id, name FROM subjects').all() as { id: number; name: string }[];
        const subjectMap = new Map(subjects.map(s => [s.name.toLowerCase().trim(), s.id]));

        const results = { imported: 0, skipped: 0, errors: [] as string[] };
        const insertStmt = db.prepare(`
            INSERT INTO books (isbn, title, author, publisher, year, edition, subject_id,
                total_copies, available_copies, shelf_location, description, language)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let rowNum = 0;
        ws.eachRow((row, idx) => {
            if (idx === 1) return; // skip header
            rowNum++;

            const vals = (row.values as ExcelJS.CellValue[]).slice(1); // ExcelJS uses 1-indexed, slice(1) to fix
            const isbn = String(vals[0] ?? '').trim();
            const title = String(vals[1] ?? '').trim();
            const author = String(vals[2] ?? '').trim();
            const publisher = String(vals[3] ?? '').trim();
            const yearRaw = vals[4];
            const year = yearRaw ? parseInt(String(yearRaw)) || null : null;
            const edition = String(vals[5] ?? '').trim() || null;
            const totalCopiesRaw = vals[6];
            const totalCopies = totalCopiesRaw ? Math.max(1, parseInt(String(totalCopiesRaw)) || 1) : 1;
            const shelfLocation = String(vals[7] ?? '').trim() || null;
            const language = String(vals[8] ?? '').trim() || 'Indonesia';
            const subjectName = String(vals[9] ?? '').trim();
            const description = String(vals[10] ?? '').trim() || null;

            if (!title) return; // skip empty rows

            // Check duplicate ISBN
            if (isbn) {
                const exists = db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn);
                if (exists) {
                    results.skipped++;
                    results.errors.push(`Baris ${idx}: ISBN "${isbn}" sudah ada, dilewati`);
                    return;
                }
            }

            // Resolve subject
            const subjectId = subjectName ? (subjectMap.get(subjectName.toLowerCase()) ?? null) : null;
            if (subjectName && !subjectId) {
                results.errors.push(`Baris ${idx}: Mata pelajaran "${subjectName}" tidak ditemukan, diabaikan`);
            }

            try {
                insertStmt.run(
                    isbn || null, title, author || null, publisher || null,
                    year, edition, subjectId,
                    totalCopies, totalCopies,
                    shelfLocation, description, language || 'Indonesia'
                );
                results.imported++;
            } catch (e) {
                results.errors.push(`Baris ${idx} ("${title}"): ${String(e)}`);
            }
        });

        if (rowNum === 0) return NextResponse.json({ error: 'File tidak berisi data buku' }, { status: 400 });

        return NextResponse.json(results);
    } catch (e) {
        return NextResponse.json({ error: `Gagal membaca file: ${String(e)}` }, { status: 500 });
    }
}
