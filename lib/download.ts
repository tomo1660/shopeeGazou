import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CountryCode, COUNTRIES } from './types';

export async function downloadImages(
  thumbnails: (string | null)[],
  getFullResImage: (index: number) => string | null,
  countryCode: CountryCode
): Promise<void> {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const zip = new JSZip();
  const folder = zip.folder(`shopee-${countryCode}-${country?.name || ''}`);

  let count = 0;
  for (let i = 0; i < thumbnails.length; i++) {
    const dataUrl = getFullResImage(i);
    if (dataUrl) {
      const base64 = dataUrl.split(',')[1];
      folder?.file(`image-${String(i + 1).padStart(2, '0')}.png`, base64, { base64: true });
      count++;
    }
  }

  if (count === 0) throw new Error('ダウンロードする画像がありません');

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `shopee-${countryCode}.zip`);
}
