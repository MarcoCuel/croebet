export const demoDataEvent = "croebet:data-changed";
export function announceDemoData() {
  window.dispatchEvent(new Event(demoDataEvent));
}
export async function withDemoLock<T>(operation: () => T): Promise<T> {
  if (!navigator.locks)
    throw new Error(
      "Este navegador não oferece o bloqueio necessário para atualizar os dados com segurança.",
    );
  return navigator.locks.request("croebet:demo-data", operation);
}
