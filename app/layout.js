import './globals.css';
export const metadata = {
  title: 'Meet Soon',
  description: '친구들과 함께 고르는 가장 따뜻한 약속',
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
