import sharp from "sharp";
import { mediaContentTypes, mediaMaxBytes } from "@croebet/shared";
import { ManagementError } from "../admin/service.ts";
export async function processMedia(input: Buffer, contentType: string) {
  try {
    if (!(mediaContentTypes as readonly string[]).includes(contentType) || !input.length || input.length > mediaMaxBytes) throw Error();
    const image = sharp(input, { limitInputPixels: 25_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== ({ "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[contentType]) || (metadata.pages ?? 1) > 1) throw Error();
    const { data, info } = await image.rotate().resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new ManagementError(400, "INVALID_IMAGE", "Escolha um JPG, PNG ou WebP estático de até 10 MB e 25 megapixels.");
  }
}
