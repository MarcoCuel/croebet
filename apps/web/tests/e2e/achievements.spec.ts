import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { achievementWriteSchema, type AchievementDefinition } from '@croebet/shared';
import { startPublicApi } from '../public-api-fixture';

const user={id:'93089d02-0b34-4b78-9d3e-f2679c190b5b',username:'Tonho',displayName:'Tonho',role:'admin'};
let definitions: AchievementDefinition[]=[];
let signedIn=true;
let unavailable=false;
let closeApi:(()=>Promise<void>)|undefined;
const definition=():AchievementDefinition=>({id:randomUUID(),name:'Só mais uma',icon:'playing-cards',metric:'games',active:true,order:0,version:1,levels:[1,25,100].map((target,i)=>({id:randomUUID(),target,description:`Complete ${target} partidas.`,locked:i===0}))});
test.beforeAll(async()=>{closeApi=await startPublicApi(()=>signedIn?user:null,async(req,res)=>{
  const path=new URL(req.url??'/','http://fixture').pathname;
  if(path==='/api/v1/auth/csrf'){res.setHeader('content-type','application/json');res.end(JSON.stringify({token:'fixture'}));return true;}
  if(!path.startsWith('/api/v1/admin/achievements')&&path!=='/api/v1/me/achievements')return false;
  res.setHeader('content-type','application/json');
  if(path==='/api/v1/me/achievements'){
    if(!signedIn){res.statusCode=401;res.end('{}');return true;}
    if(unavailable){res.statusCode=503;res.end('{}');return true;}
    res.end(JSON.stringify({stats:{currentStreak:3,games:18,lostCroins:10},items:definitions.filter(d=>d.active).map(d=>({id:d.id,name:d.name,icon:d.icon,iconNode:[['path',{d:'M4 4h16v16H4z'}]],metric:d.metric,current:18,levels:d.levels.map(l=>({id:l.id,target:l.target,description:l.description,unlockedAt:l.locked?'2026-11-20T12:00:00.000Z':null}))}))}));return true;
  }
  if(req.method==='GET'){
    const item=definitions.find(d=>path.endsWith(d.id));res.end(JSON.stringify(path==='/api/v1/admin/achievements'?{items:definitions}:item));return true;
  }
  let raw='';for await(const chunk of req)raw+=chunk;
  const parsed=achievementWriteSchema.safeParse(JSON.parse(raw));
  if(!parsed.success){res.statusCode=400;res.end(JSON.stringify({error:{message:parsed.error.issues[0].message}}));return true;}
  const body=parsed.data;
  const old=definitions.find(d=>path.endsWith(d.id));
  const saved={...body,id:old?.id??randomUUID(),version:(old?.version??0)+1,levels:body.levels.map(l=>({...l,locked:old?.levels.find(o=>o.id===l.id)?.locked??false}))};
  definitions=old?definitions.map(d=>d.id===old.id?saved:d):[...definitions,saved];res.end(JSON.stringify(saved));return true;
});});
test.afterAll(async()=>{await closeApi?.();});
test.beforeEach(async({context})=>{signedIn=true;unavailable=false;definitions=[definition()];await context.addCookies([{name:'croebet-session',value:'achievement-fixture',url:'http://127.0.0.1:3100'}]);});

test('conquistas mantêm cards, emblemas, níveis e progresso real',async({page})=>{
  await page.goto('/conquistas');
  await expect(page.getByRole('navigation',{name:'Navegação principal'}).filter({visible:true}).getByRole('link',{name:'Conquistas',exact:true})).toBeVisible();
  await expect(page.getByText('Conquistas liberadas',{exact:true})).toBeVisible();
  const progress=page.getByRole('progressbar',{name:'Só mais uma'});
  await expect(progress).toHaveAttribute('aria-valuenow','18');await expect(progress).toHaveAttribute('aria-valuemax','25');
  await expect(page.getByRole('heading',{name:'Só mais uma'})).toBeVisible();
  await expect(page.getByText('1/3',{exact:true})).toBeVisible();
  await expect(page.getByText('Complete 25 partidas.')).toBeVisible();
});
test('admin cria conquista com níveis livres, edita e desativa sem trocar o design público',async({page})=>{
  await page.goto('/admin/conquistas');
  await page.getByRole('link',{name:'Criar conquista',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('Volto amanhã');
  await page.getByLabel('Critério',{exact:true}).selectOption('dailyStreak');
  await page.getByLabel('Meta',{exact:true}).fill('3');await page.getByLabel('Descrição',{exact:true}).fill('Resgate por 3 dias seguidos.');
  for(let i=1;i<=4;i++){
    await page.getByRole('button',{name:'Adicionar nível',exact:true}).click();
    await page.getByLabel('Meta',{exact:true}).nth(i).fill(String((i+1)*3));
    await page.getByLabel('Descrição',{exact:true}).nth(i).fill(`Resgate por ${(i+1)*3} dias seguidos.`);
  }
  await page.getByRole('button',{name:'Salvar conquista',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/conquistas\/[a-f0-9-]+$/);
  await expect(page.getByLabel('Meta',{exact:true})).toHaveCount(5);
  await page.reload();await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('Volto amanhã');
  await page.getByLabel('Nome',{exact:true}).fill('Volto sempre');
  await page.getByRole('switch',{name:'Conquista ativa'}).click();
  await page.getByRole('button',{name:'Salvar conquista',exact:true}).click();
  await expect(page.getByText('Conquista salva.',{exact:true})).toBeVisible();
  await page.goto('/conquistas');await expect(page.getByRole('heading',{name:'Volto sempre',exact:true})).toHaveCount(0);
});
test('admin protege metas já conquistadas e mantém inclusão de níveis',async({page})=>{
  await page.goto(`/admin/conquistas/${definitions[0].id}`);
  await expect(page.getByLabel('Critério',{exact:true})).toBeDisabled();
  await expect(page.getByLabel('Meta',{exact:true}).first()).toBeDisabled();
  await expect(page.getByRole('button',{name:'Remover nível 1'})).toBeDisabled();
  await expect(page.getByLabel('Descrição',{exact:true}).first()).toBeEditable();
  await page.getByRole('button',{name:'Adicionar nível',exact:true}).click();
  await expect(page.getByLabel('Meta',{exact:true})).toHaveCount(4);
});
test('visitante redireciona e falha de serviço permite retentativa sem zerar o progresso',async({page})=>{
  signedIn=false;await page.goto('/conquistas');await expect(page).toHaveURL('/');
  signedIn=true;unavailable=true;await page.goto('/conquistas');
  await expect(page.getByText('Não foi possível carregar suas conquistas.',{exact:true})).toBeVisible();
  await expect(page.getByText('Conquistas liberadas',{exact:true})).toHaveCount(0);
  unavailable=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.getByRole('progressbar',{name:'Só mais uma'})).toBeVisible();
});
