import './globals.css';
import './responsive.css';
export const metadata = {
  title: 'Meet Soon',
  description: '참여자의 가능한 시간을 모아 약속을 정하고, 만날 장소를 함께 선택하세요.',
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
