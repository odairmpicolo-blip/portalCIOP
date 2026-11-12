export const TIPOS_RELATORIO = {
    carro_adiantado: { id: "carro_adiantado", label: "Carro adiantado", informativo: false },
    atraso_frequente: { id: "atraso_frequente", label: "Atraso frequente", informativo: false },
    nao_login_tdm: { id: "nao_login_tdm", label: "Não realizou login no TDM", informativo: false },
    nao_acatou_ciop: { id: "nao_acatou_ciop", label: "Não acatou ordens do CIOP", informativo: false },
    nao_acatou_cmtu: { id: "nao_acatou_cmtu", label: "Não acatou ordens vindas da CMTU", informativo: false },
    supressao_viagem: { id: "supressao_viagem", label: "Supressão de viagem", informativo: false },
    desvio_itinerario: { id: "desvio_itinerario", label: "Desvio de itinerário (Sem justificativa)", informativo: false },
    informativo: { id: "informativo", label: "Relatório informativo", informativo: true }
};

const API_PROXY_FALLBACK = "https://62wvo4yk9b.execute-api.sa-east-1.amazonaws.com";

let ultimoErroIa = "";
let relatorioIaScriptUrlOverride = "";

export function obterUltimoErroIa() {
    return ultimoErroIa;
}

/** Define URL do Apps Script (prioridade sobre portal-runtime.json). */
export function configurarRelatorioIa(opts = {}) {
    relatorioIaScriptUrlOverride = String(opts.scriptUrl || "").trim();
}

function ctxLinha(ctx) {
    return ctx.linha ? ", na linha/rota " + ctx.linha : "";
}

function ctxCarro(ctx) {
    return ctx.carro ? ", conduzindo o carro " + ctx.carro : "";
}

/** "às 14:35" quando o horário foi informado; placeholder visível quando não. */
function ctxHorario(ctx) {
    const h = String(ctx.horario || "").trim();
    return h ? "às " + h : "às ___:___";
}

/** "No dia 12/11/2026, às 14:35," — abertura padrão de todos os modelos. */
function abertura(ctx) {
    return "No dia " + (ctx.data || "___/___/____") + ", " + ctxHorario(ctx) + ",";
}

function blocoFuncionario(ctx) {
    const funcao = (ctx.funcao || "função").toLowerCase();
    const nome = ctx.nome || "nome do funcionário";
    const registro = ctx.registro || "registro";
    return "o(a) " + funcao + " " + nome + ", registro " + registro + ctxCarro(ctx) + ctxLinha(ctx);
}

export function gerarTextoModelo(tipoId, ctx) {
    const ab = abertura(ctx);
    const f = blocoFuncionario(ctx);

    const modelos = {
        carro_adiantado: (() => {
            const quantidade = String(ctx.quantidade || ctx.minutos || "").trim() || "___";
            return (
                ab + " " + f + ", realizou a viagem com adiantamento de " + quantidade +
                " minutos em relação ao horário previsto na programação, sem autorização prévia do CIOP.\n\n" +
                "Conforme monitoramento e registros operacionais, o veículo antecipou a saída, o que prejudica os usuários que aguardavam o ônibus no horário programado e compromete a regularidade do serviço.\n\n" +
                "Solicita-se a ciência do funcionário e a orientação quanto ao cumprimento dos horários estabelecidos."
            );
        })(),

        atraso_frequente:
            ab + " " + f + ", apresentou atrasos recorrentes no cumprimento dos horários programados da linha, conforme histórico identificado pelo monitoramento.\n\n" +
            "Conforme monitoramento e registros operacionais, a reincidência de atrasos impacta a confiabilidade do serviço e a experiência dos usuários, exigindo acompanhamento e medidas corretivas.\n\n" +
            "Solicita-se a orientação do funcionário e a adoção das providências cabíveis.",

        nao_login_tdm:
            ab + " " + f + ", iniciou a operação sem realizar o login no sistema TDM, conforme exigido para o início da jornada.\n\n" +
            "A ausência do login impede o registro adequado da jornada e dificulta o controle operacional e a fiscalização do serviço.\n\n" +
            "Solicita-se a orientação do funcionário quanto à obrigatoriedade do login no TDM antes do início da viagem.",

        nao_acatou_ciop:
            ab + " " + f + ", deixou de acatar as ordens emitidas pelo CIOP durante a operação.\n\n" +
            "Conforme registros e monitoramento, a determinação foi repassada ao funcionário e não foi cumprida, o que compromete a segurança, a regularidade e a padronização do serviço.\n\n" +
            "Solicita-se a ciência do funcionário e as providências cabíveis.",

        nao_acatou_cmtu: (() => {
            const agente = String(ctx.agenteOrgaoGestor || ctx.agenteCmtu || "").trim() || "nome do agente do órgão gestor";
            return (
                ab + " " + f + ", deixou de acatar ordem transmitida pela CMTU (órgão gestor), em desacordo com as determinações recebidas durante a operação.\n\n" +
                "Conforme registros e monitoramento, a ordem foi repassada pelo(a) agente do órgão gestor " + agente +
                " e não foi cumprida pelo funcionário.\n\n" +
                "Ressalta-se que o descumprimento de ordens do órgão gestor configura infração passível de autuação, nos termos da regulamentação aplicável. Solicita-se as providências cabíveis."
            );
        })(),

        supressao_viagem:
            ab + " " + f + ", suprimiu viagem prevista na programação, sem justificativa operacional registrada.\n\n" +
            "A viagem não foi realizada conforme o planejado, gerando impacto na oferta de serviço e prejuízo aos usuários que aguardavam o atendimento.\n\n" +
            "Solicita-se a apresentação de justificativa pelo funcionário e as providências cabíveis.",

        desvio_itinerario:
            ab + " " + f + ", realizou desvio do itinerário previsto, sem justificativa operacional e sem autorização do CIOP.\n\n" +
            "O desvio não autorizado altera o trajeto programado, deixa de atender os pontos de parada da linha e pode afetar a regularidade e a segurança da operação.\n\n" +
            "Solicita-se a apresentação de justificativa pelo funcionário e as providências cabíveis.",

        informativo:
            ab + " o CIOP registra, para conhecimento, as informações descritas a seguir.\n\n" +
            (ctx.carro || ctx.linha
                ? "Referência operacional: " + [ctx.carro ? "carro " + ctx.carro : "", ctx.linha ? "linha/rota " + ctx.linha : ""].filter(Boolean).join(", ") + ".\n\n"
                : "") +
            "Fatos observados: descreva aqui o que ocorreu.\n\n" +
            "Impactos na operação: descreva aqui as consequências.\n\n" +
            "Encaminhamentos: descreva aqui as providências adotadas ou necessárias."
    };

    return modelos[tipoId] || modelos.informativo;
}

function montarPromptGeracao(tipoId, ctx) {
    const tipo = TIPOS_RELATORIO[tipoId] || TIPOS_RELATORIO.informativo;
    const base = gerarTextoModelo(tipoId, ctx);
    return [
        "Você redige relatórios operacionais da TCGL (transporte coletivo) em português do Brasil.",
        "Tipo: " + tipo.label + ".",
        tipo.informativo
            ? "Relatório informativo SEM identificação de funcionário. Use tom formal e objetivo."
            : "Funcionário: " + (ctx.funcao || "") + " " + (ctx.nome || "") + ", registro " + (ctx.registro || "") + ".",
        "Data: " + (ctx.data || "") + (ctx.horario ? ", horário da ocorrência: " + ctx.horario : "") + ".",
        (ctx.carro ? "Carro: " + ctx.carro + ". " : "") + (ctx.linha ? "Linha: " + ctx.linha + "." : ""),
        (ctx.quantidade || ctx.minutos ? "Minutos de adiantamento: " + (ctx.quantidade || ctx.minutos) + "." : ""),
        (ctx.agenteOrgaoGestor || ctx.agenteCmtu
            ? "Agente do órgão gestor (CMTU): " + (ctx.agenteOrgaoGestor || ctx.agenteCmtu) + "."
            : ""),
        "Use o modelo abaixo como base, melhore redação e mantenha parágrafos curtos. Não invente fatos não informados.",
        "Retorne somente o texto do relatório, sem título e sem comentários.",
        "Modelo:\n" + base
    ].filter(Boolean).join("\n");
}

function montarPromptCorrecao(texto) {
    return [
        "Corrija ortografia, gramática e clareza do texto abaixo, em português do Brasil.",
        "Mantenha o sentido, tom formal de relatório operacional e a estrutura em parágrafos.",
        "Retorne apenas o texto corrigido, sem explicações.",
        "Texto:\n" + texto
    ].join("\n");
}

async function obterUrlsIa() {
    const candidatos = [];
    const path = String(window.location?.pathname || "").replace(/\\/g, "/");
    const pagesIdx = path.indexOf("/pages/");
    if (pagesIdx >= 0) candidatos.push(path.slice(0, pagesIdx) + "/assets/data/portal-runtime.json");
    try {
        candidatos.push(new URL("../assets/data/portal-runtime.json", window.location.href).href);
    } catch { /* ignore */ }

    let awsApiUrl = API_PROXY_FALLBACK;
    let relatorioIaScriptUrl = relatorioIaScriptUrlOverride;
    for (const url of candidatos) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) continue;
            const cfg = await res.json();
            const api = String(cfg?.awsApiUrl || "").trim().replace(/\/+$/, "");
            if (api) awsApiUrl = api;
            if (!relatorioIaScriptUrl && cfg?.relatorioIaScriptUrl) {
                relatorioIaScriptUrl = String(cfg.relatorioIaScriptUrl).trim();
            }
        } catch { /* tenta próximo */ }
    }
    return { awsApiUrl, relatorioIaScriptUrl };
}

async function chamarGeminiAppsScript(prompt) {
    try {
        const { relatorioIaScriptUrl } = await obterUrlsIa();
        if (!relatorioIaScriptUrl) {
            ultimoErroIa = "relatorioIaScriptUrl não configurada.";
            return null;
        }
        const res = await fetch(relatorioIaScriptUrl, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ prompt })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.texto) {
            ultimoErroIa = data?.erro || ("Apps Script HTTP " + res.status);
            return null;
        }
        ultimoErroIa = "";
        return String(data.texto).trim();
    } catch (err) {
        ultimoErroIa = err?.message || "Falha no Apps Script de IA.";
        return null;
    }
}

async function chamarGeminiProxy(prompt) {
    try {
        const { awsApiUrl } = await obterUrlsIa();
        const res = await fetch(awsApiUrl + "/relatorio-ia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.texto) {
            ultimoErroIa = data?.erro || data?.message || ("Proxy IA HTTP " + res.status);
            return null;
        }
        ultimoErroIa = "";
        return String(data.texto).trim();
    } catch (err) {
        ultimoErroIa = err?.message || "Falha no proxy de IA.";
        return null;
    }
}

async function gerarComIa(prompt) {
    return (await chamarGeminiAppsScript(prompt)) || (await chamarGeminiProxy(prompt));
}

function montarErroIaIndisponivel() {
    const detalhe = String(ultimoErroIa || "").trim();
    if (/relatorioIaScriptUrl não configurada/i.test(detalhe)) {
        return "IA não configurada. Implante scripts/relatorio-ia.gs no Google Apps Script "
            + "(chave GEMINI_API_KEY do AI Studio) e preencha relatorioIaScriptUrl em portal-runtime.json.";
    }
    if (/404|Not Found/i.test(detalhe)) {
        return "Proxy AWS sem rota /relatorio-ia. Rode: export GEMINI_API_KEY=sua_chave && bash scripts/deploy-bus2-proxy.sh";
    }
    if (/GEMINI_API_KEY não configurada/i.test(detalhe)) {
        return "Proxy AWS sem GEMINI_API_KEY. Configure a chave na Lambda ou use Apps Script.";
    }
    if (detalhe) return detalhe;
    return "IA indisponível. Configure Apps Script ou proxy AWS com chave do Gemini (AI Studio).";
}

export function resumirErroIa(erro) {
    const texto = String(erro || "").trim();
    if (!texto) return "IA indisponível.";
    return texto.length > 160 ? texto.slice(0, 157) + "…" : texto;
}

export async function gerarTextoIA(tipoId, ctx) {
    ultimoErroIa = "";
    try {
        const ia = await gerarComIa(montarPromptGeracao(tipoId, ctx));
        if (ia) return { texto: ia, origem: "ia" };
    } catch (err) {
        ultimoErroIa = err?.message || "Erro ao gerar com IA.";
        console.warn("Falha IA geração:", err);
    }
    return { texto: gerarTextoModelo(tipoId, ctx), origem: "modelo", erro: montarErroIaIndisponivel() };
}

export async function corrigirTextoIA(texto) {
    const base = String(texto || "").trim();
    if (!base) return { texto: "", origem: "vazio" };
    ultimoErroIa = "";
    try {
        const ia = await gerarComIa(montarPromptCorrecao(base));
        if (ia) return { texto: ia, origem: "ia" };
    } catch (err) {
        ultimoErroIa = err?.message || "Erro ao corrigir com IA.";
        console.warn("Falha IA correção:", err);
    }
    return { texto: melhorarTextoLocal(base), origem: "local", erro: montarErroIaIndisponivel() };
}

export function melhorarTextoLocal(texto) {
    return String(texto || "")
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ +([,.;:!?])/g, "$1")
        .replace(/(^|[.!?]\s+)([a-záàâãéêíóôõúç])/g, (_, p, c) => p + c.toUpperCase())
        .trim();
}
