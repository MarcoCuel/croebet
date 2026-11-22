import { tableVisualPresetSchema, type TableVisualPreset } from "@croebet/shared";
import { managementRequest } from "@/features/admin/management-api";
export const tableSettingsKey = "croebet:table-laboratory:v1";
export const tableSettingsEvent = "croebet:table-visual-settings";
export function readTableVisualPreset() {
  return managementRequest("/table-visual-settings", tableVisualPresetSchema);
}
export function saveTableVisualPreset(preset: TableVisualPreset) {
  return managementRequest("/admin/table-visual-settings", tableVisualPresetSchema, "PATCH", preset);
}
export function notifyTableVisualPreset() {
  // Storage is only a cross-tab notification, never the source of the global preset.
  try { localStorage.setItem("croebet:table-visual-revision", crypto.randomUUID()); } catch { /* Optional notification. */ }
  window.dispatchEvent(new Event(tableSettingsEvent));
}
