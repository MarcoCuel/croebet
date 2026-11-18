const avatarKey = (name: string) => `croebet:demo-avatar:${name.toLowerCase()}`;

export function readAvatar(name: string): string | null {
  try {
    const saved = window.localStorage.getItem(avatarKey(name));
    return saved?.startsWith("data:image/jpeg;base64,") ? saved : null;
  } catch {
    return null;
  }
}

export function persistAvatar(name: string, avatar: string | null) {
  if (avatar) window.localStorage.setItem(avatarKey(name), avatar);
  else window.localStorage.removeItem(avatarKey(name));
}

export async function prepareAvatar(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Escolha uma imagem de até 10 MB.");

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto.");
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    throw new Error("Não foi possível abrir essa imagem. Escolha outra foto.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
