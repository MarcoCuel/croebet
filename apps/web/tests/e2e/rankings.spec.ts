import { test, expect } from '@playwright/test';
import { startPublicApi } from '../public-api-fixture';
let closeApi: (()=>Promise<void>) | undefined;
let unavailable=false;
test.beforeAll(async()=>{closeApi=await startPublicApi(()=>null,async(req,res)=>{
  if (!req.url?.startsWith('/api/v1/rankings?')) return false;
  const q=new URL(req.url,'http://fixture').searchParams;
  res.setHeader('content-type','application/json');
  if(unavailable){res.statusCode=503;res.end('{}');return true;}
  const category=q.get('category');
  const items=category==='losers'?[]:Array.from({length:4},(_,i)=>({userId:`93089d02-0b34-4b78-9d3e-f2679c190b${60+i}`,username:`Player${i}`,displayName:`Jogador ${i}`,avatarUrl:null,position:i+1,value:100-i,games:100}));
  res.end(JSON.stringify({category,period:q.get('period'),page:Number(q.get('page')),items,own:null,hasMore:false}));return true;
});});
test.afterAll(async()=>{await closeApi?.();});
test('cards preservam pódio, filtros independentes e empty state',async({page})=>{
  unavailable=false;await page.goto('/rankings');
  const wins=page.getByRole('region',{name:'Vitórias',exact:true});
  const rich=page.getByRole('region',{name:'Mais ricos',exact:true});
  const losers=page.getByRole('region',{name:'Maiores perdedores',exact:true});
  await expect(wins.getByRole('list',{name:'Pódio de Vitórias'}).getByRole('listitem')).toHaveCount(3);
  await expect(rich.getByRole('navigation')).toHaveCount(0);
  await expect(losers.getByText('Ninguém no prejuízo. Suspeito.')).toBeVisible();
  await wins.getByRole('link',{name:'Geral',exact:true}).click();
  await expect(wins.getByRole('link',{name:'Geral',exact:true})).toHaveAttribute('aria-current','page');
  await expect(losers.getByRole('link',{name:'Este mês',exact:true})).toHaveAttribute('aria-current','page');
  await expect(rich.getByRole('link',{name:'Jogador 0',exact:true})).toHaveAttribute('href','/perfil/Player0');
  await expect(page.getByText('Vitórias e perdas por período.',{exact:false})).toHaveCount(0);
});
test('indisponibilidade oferece retentativa sem afirmar que não existem jogadores',async({page})=>{
  unavailable=true;await page.goto('/rankings');
  await expect(page.getByText('O placar ficou indisponível.',{exact:true})).toHaveCount(3);
  unavailable=false;await page.getByRole('link',{name:'Tentar novamente',exact:true}).first().click();
  await expect(page.getByRole('list',{name:'Pódio de Mais ricos'})).toBeVisible();
});
