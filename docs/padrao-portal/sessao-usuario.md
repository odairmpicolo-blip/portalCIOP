# Sessão do usuário

Um componente só, em `portal-session.css`, para a página inicial e para as páginas internas. Folhas locais não desenham outra pílula, outro raio nem outro botão vermelho por cima.

## Onde vive

- Visual: `assets/css/portal-session.css` (`?v=20261030sess2`)
- Montagem e dados: `assets/js/auth.js` (`modernizarSessaoUsuario`, `garantirSessaoPadrao`, `garantirBotaoSenha`)
- Senha: `assets/js/portal-senha.js` (`toggleSenhaPanel`, `salvarNovaSenha`) e `assets/css/portal-senha.css`
- Casco: `assets/js/portal-shell.js` só injeta o mesmo HTML quando o cabeçalho ainda não tem `.ciop-session`
- A home usa o mesmo CSS. `portal-home-2026.css` não esconde mais o botão Senha

## Aparência

Cartão de vidro, raio 12 px, padding 6 px 10 px, largura máxima `min(340px, 100%)`, altura mínima 46 px. Nome 12 px / peso 650. Cargo 10 px / peso 400, só quando existe. Botões 11 px, altura mínima 30 px, raio 10 px, o mesmo vidro do cartão, tinta do texto (não vermelho).

Claro: tinta `#102c53`, secundária `#3a5270`, cartão `rgba(255,255,255,.4)`.
Escuro: tinta `#f5f8ff`, secundária `#d5e3f4`, cartão `rgba(8,22,40,.56)`.

Abaixo de 720 px o cartão vira uma coluna: nome e cargo em cima, Senha e Sair embaixo, sem reticências. Na home, até 600 px o topo é menu | cartão | avisos, e a busca desce para a linha seguinte.

## Dados

`#usuarioLogado` recebe `cadastro.nome`. `#perfilUsuario` recebe `cadastro.cargo` e fica `hidden` se vier vazio. Não há texto “Usuário” no HTML. Enquanto `data-session-state` não é `ready`, o nome fica em tamanho zero, a linha de identidade reserva cerca de 34 px e o leitor de tela ouve “Carregando sessão”. A autenticação, o tempo da sessão e as permissões não mudam.

## Ações

- **Senha** chama `toggleSenhaPanel()`. O painel é `#senhaPanel`. Se a página não tiver o painel, `portal-senha.js` cria o mesmo bloco. Cancelar fecha e limpa os campos. Salvar continua em `salvarNovaSenha` → `alterarSenha`.
- **Sair** chama `logout()`, que encerra o Firebase Auth e volta para `login.html`.
- Na home, Ajustes → Alterar senha fecha o diálogo e abre o mesmo `#senhaPanel`. O painel não é mais movido para dentro do diálogo.

## Cabeçalho

Em `.header-actions` a ordem visual é sessão, seletor de tema, o restante da página. Na home o seletor de tema continua no fluxo dos Ajustes, não ao lado do cartão.

## Apresentação

`#kiosk`, `.kiosk` e `html.portal-glass-kiosk` escondem `.ciop-session`. CIOP TV não carrega o casco.

## Páginas com o cartão

Home e as páginas abaixo carregam o CSS compartilhado, o normalizador e `portal-senha.js`. Cada uma tem um único `.ciop-session`, com Senha e Sair:

`index.html`, `admin-usuarios`, `auditoria`, `auditoria-historico`, `automacoes`, `autuacoes`, `cartao-aniversario`, `comparacao-km`, `consulta-decreto`, `consulta-funcionario`, `consulta-veiculo`, `consumo-diario-2026-05-12`, `cr0108`, `cr0108-ajustes`, `criar-relatorio`, `criar-relatoriov2`, `dados-telemetria`, `desempenho-motoristas`, `escala-saida-carros`, `evidencias-autuacoes`, `evidencias-historico`, `fleetbus-agora`, `Folhadeservico`, `Folhadeservico1`, `folha-servico-relatorio`, `gerenciapatio`, `icv`, `incidentes-analise`, `incidentes-cad`, `incidentes-dashboard`, `integracoes`, `km-dashboard`, `liberacao-dashboard`, `liberacao-dashboard-corrigido`, `liberacao-lancamento`, `liberacao-relatorio`, `monitoramento`, `onibus-agora`, `onibus-agora-clever`, `onibus-horarios`, `performance-comparacao`, `pontualidade`, `pontualidade-ajustada`, `relatorio-ocorrencia`, `relatorios`, `sei-horario`, `tabelas-horarias`, `terminais-agora`.

Nesta passagem, Senha entrou onde o cartão existia e a ação estava ausente ou escondida: Auditoria, Histórico de auditoria, Automações, Consulta de funcionário, Consulta de veículo, Evidências de autuações, FleetBus Agora, Integrações, Monitoramento, SEI horário, Gerência de pátio e Tabelas horárias. Em Comparação de KM o botão Senha deixou de usar também a classe de Sair.

## Verificado no navegador local (127.0.0.1:8768)

Com `auth.js` bloqueado só para permanecer na página sem sessão Firebase:

- Home: Senha visível. Abre `#senhaPanel` e Cancelar fecha, com os campos vazios. Ajustes → Alterar senha abre o mesmo painel e fecha o diálogo.
- Criar Relatório, Auditoria e FleetBus Agora: o mesmo abrir e fechar, sem gravar senha.
- Home e Criar Relatório no mesmo cartão: raio 12 px, padding 6 px 10 px, Senha 54×30, Sair 41×30, fonte 11 px. Claro `rgb(16, 44, 83)` sobre `rgba(255,255,255,.4)`. Escuro `rgb(245, 248, 255)` e cargo `rgb(213, 227, 244)` sobre `rgba(8,22,40,.56)`.
- Larguras 1280, 768 e 390, temas claro e escuro. Em 390 os botões descem para a segunda linha. Sem corte de nome ou cargo e sem sobreposição com busca, avisos, saudação, título ou seletor de tema.
- Home em 1280: altura do cartão 48 px no carregamento e 48 px com nome e cargo de uma linha.
- CIOP TV (`painel-ciop.html?tela=tempo`): `#kiosk` presente, zero `.ciop-session`, zero Senha, zero Sair.

## Fora do componente

- CIOP TV: `painel-ciop.html`, `painel-tv.html` e as variantes `painel-tv-*` / `painel-ciop-icv.html`. Sem controle de sessão na apresentação.
- `performance-tempo-real.html`: palco `.kiosk`, sem o cartão.
- `pontualidade-tempo-real.html`: quadro ao vivo com cabeçalho próprio, sem o cartão do portal.
- `km-integral.html` e `km-coletiva.html`: palco em tela cheia, sem `.header`.
- `horarios-linha.html`, `percepcao-transporte.html`, `pontualidade-ao-vivo.html`, `pontualidade-incidentes.html`: sem o cabeçalho do portal.
- Previews (`_preview-*.html`, `docs/padrao-portal/preview-*`) não são página do portal.

## Pendências

- Nome e cargo reais dependem do cadastro Firebase. Neste navegador de teste não havia sessão autenticada: o preenchimento ao vivo não foi visto. A origem continua `cadastro.nome` e `cadastro.cargo` em `auth.js`.
- Sair não foi executado contra uma sessão Firebase. Sem login, a página cai em `login.html` antes do clique. `logout()` segue chamando `signOut` e indo para `login.html`.
- Dados de telemetria esconde o `.header` inteiro abaixo de 720 px (bloco do app nativo). O cartão some com o cabeçalho.
- Esta passagem está só no repositório de teste. www.portalciop.com.br ainda está no commit de produção `8be076c55`, em que a home esconde Senha.
