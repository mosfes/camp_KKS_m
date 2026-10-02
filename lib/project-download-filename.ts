type ProjectDownloadFilenameInput = {
  projectCode?: string | null;
  projectName?: string | null;
  fallbackCode: string | number;
  extension: "docx" | "pdf";
};

type ProjectSummaryDownloadFilenameInput = {
  projectName?: string | null;
  extension: "docx" | "pdf";
};

function sanitizeFilenamePart(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/:*?"<>|%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

export function buildProjectDownloadFilename({
  projectCode,
  projectName,
  fallbackCode,
  extension,
}: ProjectDownloadFilenameInput) {
  const code = sanitizeFilenamePart(projectCode || "");
  const name = sanitizeFilenamePart(projectName || "โครงการ");
  const baseName = [code, name].filter(Boolean).join(" ");

  return `${baseName || `project-${fallbackCode}`}.${extension}`;
}

export function buildProjectSummaryDownloadFilename({
  projectName,
  extension,
}: ProjectSummaryDownloadFilenameInput) {
  const name = sanitizeFilenamePart(projectName || "โครงการ");

  return `สรุป ${name || "โครงการ"}.${extension}`;
}

function encodeRFC5987(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function projectDownloadContentDisposition(filename: string) {
  const extension =
    filename
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "") || "bin";
  const asciiStem = filename
    .slice(0, -(extension.length + 1))
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\/:*?"<>|%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const asciiFilename = `${asciiStem || "project-document"}.${extension}`;

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeRFC5987(filename)}`;
}
