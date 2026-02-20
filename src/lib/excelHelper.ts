import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

interface SchoolSettings {
    school_name: string;
    school_address: string;
    school_city: string;
    school_phone: string;
    school_email: string;
    school_npsn: string;
    school_logo: string;
    library_head: string;
}

const SETTING_DEFAULTS: SchoolSettings = {
    school_name: 'SMA Negeri 1 Contoh',
    school_address: 'Jl. Pendidikan No. 1',
    school_city: 'Jakarta',
    school_phone: '',
    school_email: '',
    school_npsn: '',
    school_logo: '',
    library_head: '',
};

export function getSchoolSettings(db: Database.Database): SchoolSettings {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result = { ...SETTING_DEFAULTS };
    for (const row of rows) {
        if (row.key in result) {
            (result as Record<string, string>)[row.key] = row.value;
        }
    }
    return result;
}

/**
 * Adds a styled school identity header to the top of a worksheet.
 * Returns the number of rows consumed (so the caller knows where data starts).
 */
export async function addSchoolHeader(
    ws: ExcelJS.Worksheet,
    school: SchoolSettings,
    totalCols: number,
    accentColor: string, // ARGB without FF prefix, e.g. '1E3A8A'
    docTitle: string,
    docSubtitle: string,
): Promise<number> {
    const lastCol = String.fromCharCode(64 + totalCols); // e.g. 12 → 'L'



    // Row 1: School name
    ws.mergeCells(`A1:${lastCol}1`);
    ws.getCell('A1').value = school.school_name.toUpperCase();
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: `FF${accentColor}` } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 40;

    // Row 2: Address + city
    const addressLine = [school.school_address, school.school_city].filter(Boolean).join(', ');
    ws.mergeCells(`A2:${lastCol}2`);
    ws.getCell('A2').value = addressLine || ' ';
    ws.getCell('A2').font = { size: 10, color: { argb: 'FF444444' } };
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;

    // Row 3: Phone / email / NPSN
    const contactParts: string[] = [];
    if (school.school_phone) contactParts.push(`Telp: ${school.school_phone}`);
    if (school.school_email) contactParts.push(`Email: ${school.school_email}`);
    if (school.school_npsn) contactParts.push(`NPSN: ${school.school_npsn}`);
    ws.mergeCells(`A3:${lastCol}3`);
    ws.getCell('A3').value = contactParts.join('   |   ') || ' ';
    ws.getCell('A3').font = { size: 9.5, color: { argb: 'FF666666' } };
    ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 20;

    // Row 4: Divider (thick bottom border)
    ws.mergeCells(`A4:${lastCol}4`);
    ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${accentColor}` } };
    ws.getRow(4).height = 4;

    // Row 5: Document title
    ws.mergeCells(`A5:${lastCol}5`);
    ws.getCell('A5').value = docTitle.toUpperCase();
    ws.getCell('A5').font = { bold: true, size: 12, color: { argb: `FF${accentColor}` } };
    ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(5).height = 24;

    // Row 6: Subtitle / print date
    ws.mergeCells(`A6:${lastCol}6`);
    ws.getCell('A6').value = docSubtitle;
    ws.getCell('A6').font = { italic: true, size: 9.5, color: { argb: 'FF777777' } };
    ws.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(6).height = 16;

    // Row 7: Spacer
    ws.addRow([]);
    ws.getRow(7).height = 6;

    return 7; // header occupies rows 1–7, data header starts at row 8
}

/**
 * Adds a signature/footer section at the bottom of a worksheet.
 */
export function addSignatureFooter(
    ws: ExcelJS.Worksheet,
    school: SchoolSettings,
    totalCols: number,
    accentColor: string,
) {
    const lastCol = String.fromCharCode(64 + totalCols);
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    ws.addRow([]); // spacer
    const cityDateRow = ws.addRow([]);
    ws.mergeCells(`A${cityDateRow.number}:${lastCol}${cityDateRow.number}`);
    ws.getCell(`A${cityDateRow.number}`).value = `${school.school_city || 'Jakarta'}, ${today}`;
    ws.getCell(`A${cityDateRow.number}`).alignment = { horizontal: 'right' };
    ws.getCell(`A${cityDateRow.number}`).font = { size: 10.5 };
    cityDateRow.height = 18;

    const headLabel = ws.addRow([]);
    ws.mergeCells(`A${headLabel.number}:${lastCol}${headLabel.number}`);
    ws.getCell(`A${headLabel.number}`).value = 'Kepala Perpustakaan,';
    ws.getCell(`A${headLabel.number}`).alignment = { horizontal: 'right' };
    ws.getCell(`A${headLabel.number}`).font = { size: 10.5 };
    headLabel.height = 16;

    // spacer for signature
    for (let i = 0; i < 3; i++) { ws.addRow([]); }

    const headName = ws.addRow([]);
    ws.mergeCells(`A${headName.number}:${lastCol}${headName.number}`);
    ws.getCell(`A${headName.number}`).value = school.library_head || '( ..................... )';
    ws.getCell(`A${headName.number}`).alignment = { horizontal: 'right' };
    ws.getCell(`A${headName.number}`).font = { bold: true, underline: true, size: 10.5, color: { argb: `FF${accentColor}` } };
    headName.height = 18;
}
