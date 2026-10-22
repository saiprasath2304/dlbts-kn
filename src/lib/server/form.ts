/** Small helpers for reading HTML form fields safely. */
export const str = (f: FormData, name: string): string => String(f.get(name) ?? '').trim();
export const optStr = (f: FormData, name: string): string | null => str(f, name) || null;
export const bool = (f: FormData, name: string): boolean => {
	const v = f.get(name);
	return v === 'on' || v === 'true' || v === '1' || v === 'yes';
};
export const int = (f: FormData, name: string, fallback = 0): number => {
	const n = Number.parseInt(str(f, name), 10);
	return Number.isFinite(n) ? n : fallback;
};
export const num = (f: FormData, name: string): number | null => {
	const raw = str(f, name).replace(',', '.');
	if (raw === '') return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
};
export const isUuid = (v: string | null | undefined): v is string =>
	!!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
