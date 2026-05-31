import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shopee ストアデコ作成ツール',
  description: 'Shopeeストアデコレーション画像を簡単作成 (1080×1080px)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
