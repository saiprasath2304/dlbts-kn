import Papa from 'papaparse';
import ExcelJS from 'exceljs';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export class UploadError extends Error {}

/** Read the first sheet of a CSV/XLSX upload into header->value records. */
export async function readRecords(file: File): Promise<Record<string, unknown>[]> {
	if (!file || file.size === 0) throw new UploadError('EMPTY_FILE');
	if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('UNREADABLE');
	const name = file.name.toLowerCase();

	if (name.endsWith('.csv') || file.type === 'text/csv') {
		const text = (await file.text()).replace(/^\uFEFF/, '');
		const parsed = Papa.parse<Record<string, unknown>>(text, {
			header: true,
			skipEmptyLines: 'greedy'
		});
		if (parsed.errors.some((e) => e.type === 'Delimiter' && parsed.data.length === 0))
			throw new UploadError('UNREADABLE');
		return parsed.data;
	}

	if (name.endsWith('.xlsx')) {
		const wb = new ExcelJS.Workbook();
		try {
			await wb.xlsx.load(await file.arrayBuffer());
		} catch {
			throw new UploadError('UNREADABLE');
		}
		const ws = wb.worksheets[0];
		if (!ws) throw new UploadError('EMPTY_FILE');
		const headers: string[] = [];
		ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => (headers[col] = c.text.trim()));
		const out: Record<string, unknown>[] = [];
		ws.eachRow({ includeEmpty: false }, (row, n) => {
			if (n === 1) return;
			const rec: Record<string, unknown> = {};
			headers.forEach((h, col) => {
				if (h) rec[h] = row.getCell(col).text;
			});
			out.push(rec);
		});
		return out;
	}
	throw new UploadError('UNREADABLE');
}

export async function toXlsx(
	sheet: string,
	header: readonly string[],
	rows: readonly (readonly unknown[])[]
): Promise<Uint8Array<ArrayBuffer>> {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet(sheet);
	ws.addRow([...header]).font = { bold: true };
	for (const r of rows)
		ws.addRow(r.map((v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v)));
	ws.columns.forEach((c) => (c.width = 22));
	return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
