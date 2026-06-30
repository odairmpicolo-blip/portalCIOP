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
    return ctx.linha ? ", linha/rota " + ctx.linha : "";
}

function ctxCarro(ctx) {
    return ctx.carro ? ", carro " + ctx.carro : "";
}

function blocoFuncionario(ctx) {
    const funcao = (ctx.funcao || "função").toLowerCase();
    const nome = ctx.nome || "nome do funcionário";
    const registro = ctx.registro || "registro";
    return "o(a) " + funcao + " " + nome + ", registro " + registro + ctxCarro(ctx) + ctxLinha(ctx);
}

export function gerarTextoModelo(tipoId, ctx) {
    const data = ctx.data || "___/___/____";
    const f = blocoFuncionario(ctx);

    const modelos = {
        carro_adiantado: (() => {
            const funcao = (ctx.funcao || "função").toLowerCase();
            const nome = ctx.nome || "nome do funcionário";
            const registro = ctx.registro || "registro";
            const quantidade = String(ctx.quantidade || ctx.minutos || "").trim() || "___";
            return (
                "No dia " + data + ", o(a) " + funcao + " " + nome + ", registro " + registro +
                ", apresentou saída adiantada de " + quantidade + " minutos em relação ao horário previsto, comprometendo a regularidade do serviço.\n\n" +
                "Conforme monitoramento e registros operacionais, o veículo iniciou a viagem antes do horário programado, sem autorização prévia do CIOP.\n\n" +
                "Providências: orientação formal ao funcionário, reforço das normas de pontualidade e registro da ocorrência para acompanhamento."
            );
        })(),

        atraso_frequente:
            "No dia " + data + ", " + f + ", foi identificado histórico de atrasos frequentes no cumprimento dos horários da linha.\n\n" +
            "A recorrência de atrasos impacta a confiabilidade do serviço e a experiência do usuário, exigindo acompanhamento e medidas corretivas.\n\n" +
            "Providências: ciência ao funcionário, reforço das orientações operacionais e monitoramento das próximas saídas.",

        nao_login_tdm:
            "No dia " + data + ", " + f + ", não realizou login no sistema TDM conforme exigido para início da operação.\n\n" +
            "A ausência de login impede o registro adequado da jornada e dificulta o controle operacional e de fiscalização.\n\n" +
            "Providências: orientação imediata sobre a obrigatoriedade do login no TDM e registro da ocorrência para ciência da supervisão.",

        nao_acatou_ciop:
            "No dia " + data + ", " + f + ", deixou de acatar ordens emitidas pelo CIOP durante a operação.\n\n" +
            "O não cumprimento das determinações do centro de controle compromete a segurança, a regularidade e a padronização do serviço.\n\n" +
            "Providências: registro formal da ocorrência, ciência ao funcionário e encaminhamento à supervisão para as medidas cabíveis.",

        nao_acatou_cmtu: (() => {
            const agente = String(ctx.agenteOrgaoGestor || ctx.agenteCmtu || "").trim() || "nome do agente do órgão gestor";
            return (
                "No dia " + data + ", " + f + ", deixou de acatar ordens transmitidas pela CMTU (órgão gestor), em desacordo com as determinações recebidas durante a operação.\n\n" +
                "Conforme registros e monitoramento, a ordem foi repassada pelo(a) agente do órgão gestor " + agente +
                ", não sendo cumprida pelo funcionário.\n\n" +
                "Ressalta-se que ordens vindas do órgão gestor não cumpridas configuram infração passível de autuação, nos termos da regulamentação aplicável.\n\n" +
                "Providências: ciência ao funcionário, registro formal da ocorrência e encaminhamento à supervisão para as providências cabíveis, inclusive comunicação ao órgão gestor quando aplicável."
            );
        })(),

        supressao_viagem:
            "No dia " + data + ", " + f + ", houve supressão de viagem prevista no horário de operação.\n\n" +
            "A viagem não foi realizada conforme programação, gerando impacto na oferta de serviço aos usuários.\n\n" +
            "Providências: apuração dos motivos, registro operacional e comunicação à supervisão para acompanhamento.",

        desvio_itinerario:
            "No dia " + data + ", " + f + ", realizou desvio de itinerário sem justificativa operacional.\n\n" +
            "O desvio não autorizado altera o trajeto previsto e pode afetar a regularidade e a segurança da operação.\n\n" +
            "Providências: orientação ao funcionário, reforço das normas de trajeto e registro para acompanhamento.",

        informativo:
            "No dia " + data + ", o CIOP registra as informações abaixo para conhecimento e providências internas.\n\n" +
            (ctx.carro || ctx.linha ? "Referência operacional" + ctxCarro(ctx) + ctxLinha(ctx) + ".\n\n" : "") +
            "Descreva os fatos observados, contexto, impactos e encaminhamentos necessários."
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
        "Data: " + (ctx.data || "") + ".",
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
