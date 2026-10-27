import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import * as QRCode from "qrcode";

const CERTIFICATE_FONT_FAMILY = "CertificateTHSarabunNew";

export type CertificateTextStyle = {
  xPercent: number;
  yPercent: number;
  fontSize: number;
  color: string;
};

export type CertificateRenderRecipient = {
  fullName: string;
  numberText: string | null;
  verificationUrl: string | null;
};

export type CertificateRenderManifest = {
  version: 1;
  template: {
    url: string;
    format: string | null;
  };
  fontUrl: string;
  nameStyle: CertificateTextStyle;
  numberStyle: CertificateTextStyle;
  qrStyle: {
    xPercent: number;
    yPercent: number;
    size: number;
  };
  recipients: CertificateRenderRecipient[];
};

const binaryCache = new Map<string, Promise<ArrayBuffer>>();
let canvasFontPromise: Promise<void> | null = null;

function fetchBinary(url: string): Promise<ArrayBuffer> {
  const cached = binaryCache.get(url);

  if (cached) return cached;

  const request = fetch(url, { cache: "force-cache" }).then(
    async (response) => {
      if (!response.ok) {
        throw new Error(
          `โหลดไฟล์สำหรับเกียรติบัตรไม่สำเร็จ (${response.status})`,
        );
      }

      return response.arrayBuffer();
    },
  );

  binaryCache.set(url, request);
  request.catch(() => binaryCache.delete(url));

  return request;
}

function isPng(buffer: ArrayBuffer, format: string | null): boolean {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8));
  const hasPngSignature =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  return hasPngSignature || format?.toLowerCase() === "png";
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("เปิดรูปภาพเกียรติบัตรไม่สำเร็จ"));
    image.src = source;
  });
}

async function loadImageFromBuffer(
  buffer: ArrayBuffer,
  format: string | null,
): Promise<HTMLImageElement> {
  const blob = new Blob([buffer], {
    type: isPng(buffer, format) ? "image/png" : "image/jpeg",
  });
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function ensureCanvasFont(fontUrl: string): Promise<void> {
  if (canvasFontPromise) return canvasFontPromise;

  canvasFontPromise = (async () => {
    const font = new FontFace(CERTIFICATE_FONT_FAMILY, `url("${fontUrl}")`);

    await font.load();
    document.fonts.add(font);
  })();

  canvasFontPromise.catch(() => {
    canvasFontPromise = null;
  });

  return canvasFontPromise;
}

function drawCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  style: CertificateTextStyle,
  width: number,
  height: number,
) {
  context.save();
  context.fillStyle = style.color;
  context.font = `${style.fontSize}px "${CERTIFICATE_FONT_FAMILY}"`;
  // Center manually instead of relying on textAlign: some browsers (Safari)
  // ignore it for fonts added at runtime, which shifts text off its anchor.
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(
    text,
    (style.xPercent / 100) * width - context.measureText(text).width / 2,
    (style.yPercent / 100) * height + style.fontSize / 3,
  );
  context.restore();
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("สร้างไฟล์ PNG ไม่สำเร็จ"));
      }
    }, "image/png");
  });
}

export async function renderCertificatePng(
  manifest: CertificateRenderManifest,
): Promise<Blob> {
  const recipient = manifest.recipients[0];

  if (!recipient) {
    throw new Error("ไม่พบข้อมูลผู้รับเกียรติบัตร");
  }

  const [templateBuffer] = await Promise.all([
    fetchBinary(manifest.template.url),
    ensureCanvasFont(manifest.fontUrl),
  ]);
  const template = await loadImageFromBuffer(
    templateBuffer,
    manifest.template.format,
  );
  const canvas = document.createElement("canvas");

  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("อุปกรณ์นี้ไม่รองรับการสร้างรูปเกียรติบัตร");
  }

  context.drawImage(template, 0, 0, canvas.width, canvas.height);
  drawCanvasText(
    context,
    recipient.fullName,
    manifest.nameStyle,
    canvas.width,
    canvas.height,
  );

  if (recipient.numberText) {
    drawCanvasText(
      context,
      recipient.numberText,
      manifest.numberStyle,
      canvas.width,
      canvas.height,
    );
  }

  if (recipient.verificationUrl) {
    const qrDataUrl = await QRCode.toDataURL(recipient.verificationUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: Math.round(manifest.qrStyle.size),
    });
    const qrImage = await loadImage(qrDataUrl);
    const qrSize = manifest.qrStyle.size;

    context.drawImage(
      qrImage,
      (manifest.qrStyle.xPercent / 100) * canvas.width - qrSize / 2,
      (manifest.qrStyle.yPercent / 100) * canvas.height - qrSize / 2,
      qrSize,
      qrSize,
    );
  }

  return canvasToPng(canvas);
}

export async function renderCertificatesPdf(
  manifest: CertificateRenderManifest,
): Promise<Blob> {
  if (manifest.recipients.length === 0) {
    throw new Error("ไม่พบข้อมูลผู้รับเกียรติบัตร");
  }

  const [templateBuffer, fontBuffer] = await Promise.all([
    fetchBinary(manifest.template.url),
    fetchBinary(manifest.fontUrl),
  ]);
  const pdfDocument = await PDFDocument.create();

  pdfDocument.registerFontkit(fontkit);

  const [template, font] = await Promise.all([
    isPng(templateBuffer, manifest.template.format)
      ? pdfDocument.embedPng(templateBuffer)
      : pdfDocument.embedJpg(templateBuffer),
    pdfDocument.embedFont(fontBuffer),
  ]);
  const { width, height } = template.scale(1);
  const nameColor = hexToRgb(manifest.nameStyle.color);
  const numberColor = hexToRgb(manifest.numberStyle.color);

  for (const recipient of manifest.recipients) {
    const page = pdfDocument.addPage([width, height]);

    page.drawImage(template, { x: 0, y: 0, width, height });

    const nameWidth = font.widthOfTextAtSize(
      recipient.fullName,
      manifest.nameStyle.fontSize,
    );

    page.drawText(recipient.fullName, {
      x: (manifest.nameStyle.xPercent / 100) * width - nameWidth / 2,
      y:
        (1 - manifest.nameStyle.yPercent / 100) * height -
        manifest.nameStyle.fontSize / 3,
      size: manifest.nameStyle.fontSize,
      font,
      color: rgb(nameColor.r, nameColor.g, nameColor.b),
    });

    if (recipient.numberText) {
      const numberWidth = font.widthOfTextAtSize(
        recipient.numberText,
        manifest.numberStyle.fontSize,
      );

      page.drawText(recipient.numberText, {
        x: (manifest.numberStyle.xPercent / 100) * width - numberWidth / 2,
        y:
          (1 - manifest.numberStyle.yPercent / 100) * height -
          manifest.numberStyle.fontSize / 3,
        size: manifest.numberStyle.fontSize,
        font,
        color: rgb(numberColor.r, numberColor.g, numberColor.b),
      });
    }

    if (recipient.verificationUrl) {
      const qrDataUrl = await QRCode.toDataURL(recipient.verificationUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: Math.round(manifest.qrStyle.size),
      });
      const qrBuffer = await fetch(qrDataUrl).then((response) =>
        response.arrayBuffer(),
      );
      const qrImage = await pdfDocument.embedPng(qrBuffer);
      const qrSize = manifest.qrStyle.size;

      page.drawImage(qrImage, {
        x: (manifest.qrStyle.xPercent / 100) * width - qrSize / 2,
        y: (1 - manifest.qrStyle.yPercent / 100) * height - qrSize / 2,
        width: qrSize,
        height: qrSize,
      });
    }
  }

  const pdfBytes = await pdfDocument.save();

  return new Blob([new Uint8Array(pdfBytes).buffer], {
    type: "application/pdf",
  });
}

export function downloadCertificateBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
