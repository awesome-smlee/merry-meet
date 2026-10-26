import './globals.css';
import './responsive.css';
const siteUrl = process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` :
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4173');
const description = '참여자의 가능한 시간을 모아 약속을 정하고, 만날 장소를 함께 선택하세요.';
export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Meet Soon',
  description,
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Meet Soon',
    title: 'Meet Soon · 우리 곧 만나요',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Meet Soon · 우리 곧 만나요',
    description,
  },
  robots: { index: false, follow: false },
};
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#eaf2ff',
};
export default function Layout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
