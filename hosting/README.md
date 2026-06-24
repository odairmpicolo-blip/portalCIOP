# Domínio: www.portalciop.com.br (GitHub Pages)

## ✅ Já configurado automaticamente
- GitHub Pages → `www.portalciop.com.br`
- Firebase Auth → `portalciop.com.br` e `www.portalciop.com.br`

## ⚠️ Você só precisa de 1 registro DNS (mais fácil que 4 registros A)

### No Registro.br

1. Acesse https://registro.br/login/ e entre na conta
2. Clique em **portalciop.com.br**
3. Role até **Configurar endereçamento**
4. Clique em **Configurar zona DNS** (ou **Salvar e editar DNS**)
5. Se pedir, ative **Modo avançado**
6. Clique em **Nova entrada** / **+**
7. Preencha **exatamente**:

| Campo | Valor |
|-------|--------|
| **Tipo** | `CNAME` |
| **Nome** | `www` |
| **Dados** | `odairmpicolo-blip.github.io` |

8. **Salvar** a zona

### (Opcional) Redirecionar portalciop.com.br → www

Na mesma página, em **Endereço do site** (modo simples), se houver campo para o domínio raiz, use:

`https://www.portalciop.com.br`

---

## Depois de salvar (15 min – 2 h)

Avise no chat para ativar HTTPS, ou rode:

```bash
gh api -X PUT repos/odairmpicolo-blip/portalCIOP/pages \
  -f build_type=workflow \
  -f cname=www.portalciop.com.br \
  -f https_enforced=true
```

## URLs

- Site no GitHub (funciona agora): https://odairmpicolo-blip.github.io/portalCIOP/
- Com DNS: https://www.portalciop.com.br
