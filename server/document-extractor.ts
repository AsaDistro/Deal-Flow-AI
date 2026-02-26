import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

const objectStorageService = new ObjectStorageService();

async function downloadFileBuffer(objectPath: string): Promise<Buffer> {
  const normalizedPath = objectStorageService.normalizeObjectEntityPath(objectPath);
  const file = await objectStorageService.getObjectEntityFile(normalizedPath);
  const [contents] = await file.download();
  return contents;
}

function extractXlsx(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }
  }

  return parts.join("\n\n");
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractCsvOrText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

export async function extractDocumentText(objectPath: string, fileName: string, mimeType: string | null): Promise<string> {
  try {
    const buffer = await downloadFileBuffer(objectPath);
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const type = mimeType?.toLowerCase() || "";

    if (ext === "xlsx" || ext === "xls" || type.includes("spreadsheet")) {
      return extractXlsx(buffer);
    }

    if (ext === "docx" || type.includes("wordprocessingml")) {
      return await extractDocx(buffer);
    }

    if (ext === "csv" || ext === "txt" || ext === "md" || ext === "json" ||
        type.includes("text/") || type.includes("csv") || type.includes("json")) {
      return extractCsvOrText(buffer);
    }

    if (ext === "pdf" || type.includes("pdf")) {
      return `[PDF file - content extraction not yet supported. File: ${fileName}]`;
    }

    return `[Binary file - content extraction not supported for this format. File: ${fileName}, Type: ${type || ext}]`;
  } catch (error) {
    console.error(`Failed to extract text from ${fileName}:`, error);
    return `[Failed to extract content from ${fileName}]`;
  }
}
