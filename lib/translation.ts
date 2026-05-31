export async function translateText(
  text: string,
  targetLang: string,
  sourceLang = 'ja'
): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Translation request failed');
  const data = await res.json();
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'Translation failed');
  }
  return data.responseData.translatedText as string;
}

export async function translateTextGoogle(
  text: string,
  targetLang: string
): Promise<string> {
  // Fallback: use Google Translate unofficial endpoint
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Translation request failed');
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const translated = (data[0] as any[]).map((item: any[]) => item[0]).join('');
  return translated;
}
