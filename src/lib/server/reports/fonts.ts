// Fonts are inlined at build time so PDF generation works on any Node host,
// including serverless platforms without a writable/predictable filesystem.
import tamilRegular from '../fonts/NotoSansTamil-Regular.ttf?inline';
import tamilBold from '../fonts/NotoSansTamil-Bold.ttf?inline';
import latinRegular from '../fonts/NotoSans-Regular.ttf?inline';
import latinBold from '../fonts/NotoSans-Bold.ttf?inline';
import logoPng from '../../../../static/logo.png?inline';

const decode = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

let cache: Record<string, Buffer> | null = null;

export function reportFonts(): Record<'ta' | 'ta-bold' | 'lat' | 'lat-bold', Buffer> {
	cache ??= {
		ta: decode(tamilRegular),
		'ta-bold': decode(tamilBold),
		lat: decode(latinRegular),
		'lat-bold': decode(latinBold)
	};
	return cache as Record<'ta' | 'ta-bold' | 'lat' | 'lat-bold', Buffer>;
}

let logo: Buffer | null = null;

/** The event logo (static/logo.png), embedded in report headers. */
export function reportLogo(): Buffer {
	logo ??= decode(logoPng);
	return logo;
}
