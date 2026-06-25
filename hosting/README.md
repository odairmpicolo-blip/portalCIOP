# Domínio: www.portalciop.com.br

O portal é hospedado **somente no GitHub Pages** — não usamos Firebase Hosting.

## Registro no Registro.br (obrigatório)

Na **Configurar zona DNS** → **Modo avançado** → **Nova entrada**:

| TIPO | NOME | DADOS |
|------|------|--------|
| **CNAME** | `www` | `odairmpicolo-blip.github.io` |

Salve e aguarde 15–30 min.

## (Opcional) portalciop.com.br sem www

Adicione **4 registros A** com nome vazio (não use `@`):

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

No GitHub Pages, configure redirecionamento de apex para www se necessário.

## URLs

- https://www.portalciop.com.br — portal **clássico** (padrão)
- https://www.portalciop.com.br/app/ — **novo portal** (experimental)
- `/?app=1` abre o novo portal direto
- https://odairmpicolo-blip.github.io/portalCIOP/ (espelho GitHub)

## Portal React

O app moderno fica em `/app/`. O deploy inclui build automático do `portal-app/` e fallback SPA (`hosting/404.html`).

Para abrir o novo portal: clique em **Novo portal** na toolbar ou acesse `/app/`.

## Ativar domínio no deploy

O arquivo `hosting/CNAME` contém `www.portalciop.com.br`. O workflow **Deploy GitHub Pages** publica automaticamente.
