/**
 * 画像URLをサーバー経由で取得するプロキシAPI
 * ブラウザのCORS制限を回避して外部サイトの画像を取得する
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl || !imageUrl.startsWith('http')) {
    return new Response('Invalid URL', { status: 400 });
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': new URL(imageUrl).origin + '/',
      },
    });

    if (!res.ok) {
      return new Response(`Remote server returned ${res.status}`, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) {
      return new Response('Not an image', { status: 400 });
    }

    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new Response('Failed to fetch image', { status: 500 });
  }
}
