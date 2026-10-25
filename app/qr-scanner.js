'use client';
import { useEffect, useRef, useState } from 'react';

export default function QrScanner({ onScan, onClose }) {
  const video = useRef(null);
  const scan = useRef(onScan);
  scan.current = onScan;
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let controls;
    async function start() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (disposed) return;
        controls = await new BrowserQRCodeReader().decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video.current,
          (result) => { if (result && !disposed) scan.current(result.getText()); },
        );
        if (disposed) controls.stop();
      } catch {
        if (!disposed) setError('카메라를 열지 못했어요. 카메라 권한을 허용하거나 코드를 직접 입력해 주세요.');
      }
    }
    start();
    return () => { disposed = true; controls?.stop(); };
  }, []);
  return <div className="qr-scanner">
    <video ref={video} muted playsInline aria-label="모임 QR 코드 스캔 카메라" />
    <p role={error ? 'alert' : 'status'}>{error || '초대 QR 코드를 카메라 안에 맞춰 주세요.'}</p>
    <button type="button" className="outline-button" onClick={onClose}>스캔 닫기</button>
  </div>;
}
