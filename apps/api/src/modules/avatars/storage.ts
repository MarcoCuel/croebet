import type { readConfig } from "../../config.ts";
import { createImageStorage } from "../storage/images.ts";
export { type ImageStorage as AvatarStorage, validImageKey as validAvatarKey } from "../storage/images.ts";
export const avatarUrl = (key: string | null | undefined) => key ? `/api/v1/avatars/${key}` : null;
export const createAvatarStorage = (config: ReturnType<typeof readConfig>) => createImageStorage(config, "avatars");
