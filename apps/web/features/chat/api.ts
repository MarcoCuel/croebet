import { chatPageSchema, chatSyncSchema, chatReceiptSchema, commandResultSchema } from "@croebet/shared";
async function request(path: string, method = "GET", body?: unknown, signal?: AbortSignal) {
  const headers: Record<string,string> = {};
  if (method!=="GET") {
    const response=await fetch("/api/v1/auth/csrf",{credentials:"same-origin",cache:"no-store",signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)});
    if(!response.ok) throw new Error("Não foi possível conectar. Tente novamente.");
    headers["x-csrf-token"]=(await response.json()).token;
    headers["content-type"]="application/json";
  }
  const response=await fetch(`/api/v1/chat${path}`,{method,headers,credentials:"same-origin",cache:"no-store",body:method==="GET"?undefined:JSON.stringify(body??{}),signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)});
  if(!response.ok) { const data=await response.json().catch(()=>null); throw new Error(data?.error?.message??"Chat indisponível. Tente novamente."); }
  return response.json();
}
export const loadChat = async (before?:string,signal?:AbortSignal) => chatPageSchema.parse(await request(before?`?before=${before}`:"", "GET", undefined,signal));
export const syncChat = async (after:string,signal?:AbortSignal) => chatSyncSchema.parse(await request(`/sync?after=${after}`,"GET",undefined,signal));
export const sendChat = async (requestId:string,text:string) => chatReceiptSchema.parse(await request("","POST",{requestId,text}));
export const deleteChat = async (id:string) => commandResultSchema.parse(await request(`/messages/${id}`,"DELETE"));
export const muteChat = async (id:string,minutes:number) => commandResultSchema.parse(await request(`/users/${id}/mute`,"PATCH",{minutes}));
