import sharp from "sharp";

export const avatarMaxBytes = 10 * 1024 * 1024;
export const avatarContentTypes = ["image/jpeg", "image/png", "image/webp"];
export class InvalidAvatar extends Error {}

export async function processAvatar(input: Buffer, contentType: string): Promise<Buffer> {
  if (!avatarContentTypes.includes(contentType) || input.length === 0 || input.length > avatarMaxBytes)
    throw new InvalidAvatar("Escolha uma imagem JPG, PNG ou WebP de até 10 MB.");
  try {
    const image = sharp(input, { limitInputPixels: 25_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[contentType];
    if (metadata.format !== expected || (metadata.pages ?? 1) > 1 || !metadata.width || !metadata.height || metadata.width > 10000 || metadata.height > 10000)
      throw new Error("Formato ou dimensões inválidos");
    // Re-encoding strips EXIF and other input metadata. Only this result is stored.
    return await image.rotate().resize(256, 256, { fit: "cover", position: "centre" }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new InvalidAvatar("Não foi possível abrir essa imagem. Escolha um JPG, PNG ou WebP estático de até 25 megapixels.");
  }
}
