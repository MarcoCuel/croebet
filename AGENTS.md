# Estilos do Croebet

- Use Tailwind CSS para estilizar as páginas e os componentes do projeto Next.js.
- Defina cores reutilizáveis como tokens semânticos no bloco `@theme` de `app/globals.css` e referencie esses tokens nos componentes.
- A cor principal da marca é `#AD158F`. Use o token `brand` para o logo e os botões primários.

## Ícones

- Use Phosphor Icons (`@phosphor-icons/react`) como padrão. Importe cada ícone pelo seu módulo em `/dist/ssr` nos Server Components e em `/dist/csr` nos Client Components.
- Use o peso regular nos controles e o peso fill nas ilustrações. Defina tamanho e cor com Tailwind e marque ícones decorativos com `aria-hidden`. Dê um nome acessível a botões que exibem apenas um ícone.

## Moeda

- A moeda fictícia do Croebet se chama Croin no singular e Croins no plural. Use essa grafia na interface e na documentação.
