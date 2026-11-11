"use client";

import * as QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * วาด QR ของเกียรติบัตรในเบราว์เซอร์ (แทนการสร้างรูป QR บนเซิร์ฟเวอร์)
 * ใช้เป็น <image> ภายใน <svg> ของภาพตัวอย่างเกียรติบัตร
 */
export default function CertificateQrImage({
  url,
  size,
  x,
  y,
}: {
  url: string;
  size: number;
  x: number;
  y: number;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: Math.round(size),
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) return null;

  return <image height={size} href={dataUrl} width={size} x={x} y={y} />;
}
