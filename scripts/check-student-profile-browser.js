/*
 * Paste this expression into Chrome DevTools Console while signed in as a
 * student on /student/profile. It reads only the current DOM and prints no
 * account details or session data.
 */
(() => {
  const expectedOrigin = "https://www.kkscamp.com";
  const photo = [...document.images].find((image) => image.alt === "รูปโปรไฟล์");
  const imagePreloads = [...document.querySelectorAll('link[rel="preload"][as="image"]')];
  const result = {
    correctOrigin: location.origin === expectedOrigin,
    profileRoute: location.pathname === "/student/profile",
    photoOptimized: Boolean(photo?.currentSrc?.startsWith(`${expectedOrigin}/_next/image?`)),
    imagePreloadsSameOrigin:
      imagePreloads.length > 0 &&
      imagePreloads.every((link) =>
        link.href.startsWith(`${expectedOrigin}/_next/image?`),
      ),
    cloudinaryPreloadCount: imagePreloads.filter(
      (link) => new URL(link.href).hostname === "res.cloudinary.com",
    ).length,
  };
  console.table(result);
  return result;
})();
