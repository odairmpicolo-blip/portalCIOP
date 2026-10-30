# Sessão do usuário

Um componente só, o cartão da página inicial. Folhas e páginas não desenham outra pílula, outro raio nem outro botão vermelho por cima.

## Onde vive

- Visual: `assets/css/portal-session.css` (`?v=20261030sess1`)
- Montagem e dados: `assets/js/auth.js` (`modernizarSessaoUsuario`, `garantirSessaoPadrao`)
- Casco: `assets/js/portal-shell.js` só injeta o mesmo HTML quando o cabeçalho ainda não tem `.ciop-session`
- Posição do tema: `assets/js/portal-design-system.js` coloca `.dk-theme-picker` logo depois da sessão

A home continua com as regras de `portal-home-2026.css`. O arquivo compartilhado não redesenha a home; ele repete as medidas que já vencem lá.

## Aparência

Cartão de vidro, raio 12 px, padding 6 px 10 px, largura máxima 340 px, sombra interna `--home-reflect` (ou o equivalente interno). Nome 12 px / peso 650 / `--home-ink` ou `--portal-text`. Cargo 10 px / peso 400 / cor secundária, só quando existe. Botões 11 px, altura mínima 30 px, raio 10 px, o mesmo vidro do cartão.

Claro: tinta `#102c53`, secundária `#3a5270`, cartão `rgba(255,255,255,.4)`.
Escuro: tinta `#f5f8ff`, secundária `#d5e3f4`, cartão `rgba(8,22,40,.56)`.

## Dados

`#usuarioLogado` recebe `cadastro.nome`. `#perfilUsuario` recebe `cadastro.cargo` e fica `hidden` se vier vazio. Não há texto “Usuário” no HTML. Enquanto `data-session-state` não é `ready`, o nome fica em tamanho zero, um traço reserva a linha e o leitor de tela ouve “Carregando sessão”. A autenticação, o tempo da sessão e as permissões não mudam.

## Ações

- **Sair** chama `logout()`.
- **Senha** chama `toggleSenhaPanel()` e só entra se a página já tinha o botão ou tem `#senhaPanel`.
- Na home o botão Senha do cabeçalho continua oculto. A troca fica em `#homeSettingsPassword`.

## Cabeçalho

Em `.header-actions` a ordem visual é sessão, seletor de tema, o restante da página (logo, Portal). A home não move o seletor: ele fica na lateral. Abaixo de 1100 px o cabeçalho empilha e o título não divide a linha com o cartão. Abaixo de 720 px o cartão vira uma coluna: nome e cargo em cima, botões embaixo, sem reticências.

## Apresentação

`#kiosk`, `.kiosk` e `html.portal-glass-kiosk` escondem `.ciop-session`. CIOP TV não carrega o casco. A sessão do Firebase, quando a página a usa, continua valendo.

## Páginas migradas

Home e as páginas com o markup da sessão passam pelo mesmo CSS e pelo mesmo normalizador:

`index.html`, `admin-usuarios`, `auditoria`, `auditoria-historico`, `automacoes`, `autuacoes`, `cartao-aniversario`, `comparacao-km`, `consulta-decreto`, `consulta-funcionario`, `consulta-veiculo`, `consumo-diario-2026-05-12`, `cr0108`, `cr0108-ajustes`, `criar-relatorio`, `criar-relatoriov2`, `dados-telemetria`, `desempenho-motoristas`, `escala-saida-carros`, `evidencias-autuacoes`, `evidencias-historico`, `fleetbus-agora`, `Folhadeservico`, `Folhadeservico1`, `folha-servico-relatorio`, `gerenciapatio`, `icv`, `incidentes-analise`, `incidentes-cad`, `incidentes-dashboard`, `integracoes`, `km-dashboard`, `liberacao-dashboard`, `liberacao-dashboard-corrigido`, `liberacao-lancamento`, `liberacao-relatorio`, `monitoramento`, `onibus-agora`, `onibus-agora-clever`, `onibus-horarios`, `performance-comparacao`, `pontualidade`, `pontualidade-ajustada`, `relatorio-ocorrencia`, `relatorios`, `sei-horario`, `tabelas-horarias`, `terminais-agora`.

Estilos locais de pílula ou vidro próprio saíram de ICV, Gerência de Pátio, Km, Tabelas horárias e dos ônibus (agora / horários / Clever). O raio 999 px e o fundo de vidro genérico deixaram de atingir `.ciop-session` em `portal-visual.css`, `portal-glass-desktop.css`, `portal-futuristic.css` e `portal-unify.css`.

## Fora do componente

- CIOP TV: `painel-ciop.html`, `painel-tv.html`. Sem controle de sessão na apresentação.
- `performance-tempo-real.html`: palco `.kiosk`, sem o cartão.
- `km-integral.html` e `km-coletiva.html`: palco em tela cheia, sem `.header`. O auth continua; o cartão não é encaixado num cabeçalho que a página não tem.
- Previews (`_preview-*.html`, `docs/padrao-portal/preview-*`) não são página do portal.

## Pendências

- Nome e cargo reais dependem do cadastro Firebase. Nesta passagem local não havia sessão autenticada: o estado de carregamento, os dois temas, a tela estreita e a ligação dos botões foram medidos no navegador; o texto do cadastro ao vivo não. A saudação da home (“Olá, …”) continua com o fallback dela até o auth gravar o nome.
- Dados de telemetria esconde o `.header` inteiro abaixo de 720 px (bloco do app nativo). O cartão some com o cabeçalho; não é um corte do nome.
- Esta padronização está no repositório de teste, ainda não publicada em www.portalciop.com.br.
