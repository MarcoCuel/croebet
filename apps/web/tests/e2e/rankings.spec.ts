import { test, expect } from '@playwright/test';
import { startPublicApi } from '../public-api-fixture';
let closeApi: (()=>Promise<void>) | undefined;
let unavailable=false;
let showLosers=false;
const avatar = (width: number, height: number) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/></svg>`)}`;
test.beforeAll(async()=>{closeApi=await startPublicApi(()=>null,async(req,res)=>{
  if (!req.url?.startsWith('/api/v1/rankings?')) return false;
  const q=new URL(req.url,'http://fixture').searchParams;
  res.setHeader('content-type','application/json');
  if(unavailable){res.statusCode=503;res.end('{}');return true;}
  const category=q.get('category');
  const items=category==='losers' && !showLosers?[]:Array.from({length:4},(_,i)=>({userId:`93089d02-0b34-4b78-9d3e-f2679c190b${60+i}`,username:`Player${i}`,displayName:`Jogador ${i}`,avatarUrl:i===2?null:avatar(i===0?80:160,i===0?160:80),position:i+1,value:category==='losers'?4-i:100-i,games:100}));
  res.end(JSON.stringify({category,period:q.get('period'),page:Number(q.get('page')),items,own:null,hasMore:false}));return true;
});});
test.afterAll(async()=>{await closeApi?.();});
test('fotos verticais e horizontais mantêm recorte circular no pódio e na lista',async({page})=>{
  unavailable=false;await page.goto('/rankings');
  const wins=page.getByRole('region',{name:'Vitórias',exact:true});
  const images=wins.locator('[data-slot="avatar-image"]');
  await expect(images).toHaveCount(3);
  for(const image of await images.all()) {
    await expect(image).toBeVisible();
    await expect.poll(()=>image.evaluate((element: HTMLImageElement)=>{
      const style=getComputedStyle(element);
      const {width,height}=element.getBoundingClientRect();
      return element.complete && element.naturalWidth>0 && width===height &&
        style.objectFit==='cover' && parseFloat(style.borderTopLeftRadius)>=width/2;
    })).toBe(true);
    await expect(image.locator('..').locator('[data-slot="avatar-fallback"]')).toBeHidden();
  }
  await expect(wins.getByRole('link',{name:'Posição 3 Jogador 2',exact:true}).locator('[data-slot="avatar-fallback"]')).toBeVisible();
});
test('cards preservam pódio, filtros independentes e empty state',async({page})=>{
  unavailable=false;await page.goto('/rankings');
  const wins=page.getByRole('region',{name:'Vitórias',exact:true});
  const rich=page.getByRole('region',{name:'Mais ricos',exact:true});
  const losers=page.getByRole('region',{name:'Maiores perdedores',exact:true});
  await expect(wins.getByRole('list',{name:'Pódio de Vitórias'}).getByRole('listitem')).toHaveCount(3);
  const podium = wins.getByRole('list',{name:'Pódio de Vitórias'});
  const columns = await Promise.all([1,2,3].map(position => podium.getByRole('link',{name:`Posição ${position} Jogador ${position-1}`,exact:true}).boundingBox()));
  const [first,second,third] = columns;
  expect(first && second && third).toBeTruthy();
  expect(second!.x).toBeLessThan(first!.x);
  expect(first!.x).toBeLessThan(third!.x);
  expect(first!.y).toBeLessThan(second!.y);
  expect(second!.y).toBeLessThan(third!.y);
  expect(Math.abs(first!.y + first!.height - second!.y - second!.height)).toBeLessThan(1);
  expect(Math.abs(first!.y + first!.height - third!.y - third!.height)).toBeLessThan(1);
  await expect(rich.getByRole('navigation')).toHaveCount(0);
  await expect(losers.getByText('Ninguém perdeu ainda. Suspeito.')).toBeVisible();
  await wins.getByRole('link',{name:'Geral',exact:true}).click();
  await expect(wins.getByRole('link',{name:'Geral',exact:true})).toHaveAttribute('aria-current','page');
  await expect(losers.getByRole('link',{name:'Este mês',exact:true})).toHaveAttribute('aria-current','page');
  await expect(rich.getByRole('link',{name:'Posição 1 Jogador 0',exact:true})).toHaveAttribute('href','/perfil/Player0');
  await expect(page.getByText('Vitórias e perdas por período.',{exact:false})).toHaveCount(0);
});
test('indisponibilidade oferece retentativa sem afirmar que não existem jogadores',async({page})=>{
  unavailable=true;await page.goto('/rankings');
  await expect(page.getByText('O placar ficou indisponível.',{exact:true})).toHaveCount(3);
  unavailable=false;await page.getByRole('link',{name:'Tentar novamente',exact:true}).first().click();
  await expect(page.getByRole('list',{name:'Pódio de Mais ricos'})).toBeVisible();
});

test('maiores perdedores mostra derrotas no pódio e lista, com singular e plural',async({page})=>{
  unavailable=false;showLosers=true;
  try {
    await page.goto('/rankings');
    const losers=page.getByRole('region',{name:'Maiores perdedores',exact:true});
    await expect(losers.getByText('4derrotas',{exact:true})).toBeVisible();
    await expect(losers.getByText('1derrota',{exact:true})).toBeVisible();
    await expect(losers.getByText('Croins',{exact:true})).toHaveCount(0);
    await losers.getByRole('link',{name:'Geral',exact:true}).click();
    await expect(losers.getByRole('link',{name:'Geral',exact:true})).toHaveAttribute('aria-current','page');
    await expect(losers.getByText('4derrotas',{exact:true})).toBeVisible();
  } finally {showLosers=false;}
});
