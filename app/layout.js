import './globals.css';
import './responsive.css';
const siteUrl = process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` :
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4173');
const description = '간편하게 만날 날짜와 장소를 선택해요🍀';
export const metadata = {
  metadataBase: new URL(siteUrl),
  referrer: 'no-referrer',
  title: 'Meet Soon',
  description,
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Meet Soon',
    title: 'Meet Soon · 우리 얼른 보자규',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Meet Soon · 우리 얼른 보자규',
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
