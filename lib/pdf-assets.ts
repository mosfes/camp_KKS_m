/**
 * โหลดฟอนต์/รูปจากโฟลเดอร์ public สำหรับสร้าง PDF ในเบราว์เซอร์
 * ไฟล์เหล่านี้เสิร์ฟจาก CDN ของ Vercel (ไม่นับเป็น function invocation)
 * และแคชไว้ในหน่วยความจำ จึงโหลดครั้งเดียวต่อการเปิดหน้า
 */
const assetCache = new Map<string, Promise<Uint8Array>>();

export function loadPublicAsset(publicPath: string): Promise<Uint8Array> {
  const key = publicPath.replace(/^\/+/, "");
  let pending = assetCache.get(key);

  if (!pending) {
    pending = fetch(`/${key}`, { cache: "force-cache" }).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(`โหลดไฟล์ ${key} ไม่สำเร็จ (${response.status})`);
        }

        return new Uint8Array(await response.arrayBuffer());
      },
    );
    pending.catch(() => assetCache.delete(key));
    assetCache.set(key, pending);
  }

  return pending;
}
