import { firebaseConfig } from "./firebase-config.js";

export const TIPOS_RELATORIO = {
    carro_adiantado: { id: "carro_adiantado", label: "Carro adiantado", informativo: false },
    atraso_frequente: { id: "atraso_frequente", label: "Atraso frequente", informativo: false },
    nao_login_tdm: { id: "nao_login_tdm", label: "Não realizou login no TDM", informativo: false },
    nao_acatou_ciop: { id: "nao_acatou_ciop", label: "Não acatou ordens do CIOP", informativo: false },
    supressao_viagem: { id: "supressao_viagem", label: "Supressão de viagem", informativo: false },
    desvio_itinerario: { id: "desvio_itinerario", label: "Desvio de itinerário (Sem justificativa)", informativo: false },
    informativo: { id: "informativo", label: "Relatório informativo", informativo: true }
};

const MODELOS_GEMINI = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
const API_PROXY_FALLBACK = "https://62wvo4yk9b.execute-api.sa-east-1.amazonaws.com";

let ultimoErroIa = "";

export function obterUltimoErroIa() {
    return ultimoErroIa;
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
        carro_adiantado:
            "No dia " + data + ", " + f + ", apresentou saída adiantada em relação ao horário previsto, comprometendo a regularidade do serviço.\n\n" +
            "Conforme monitoramento e registros operacionais, o veículo iniciou a viagem antes do horário programado, sem autorização prévia do CIOP.\n\n" +
            "Providências: orientação formal ao funcionário, reforço das normas de pontualidade e registro da ocorrência para acompanhamento.",

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

function extrairTextoGemini(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const texto = parts.map((p) => p.text || "").join("").trim();
    return texto || null;
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
    let relatorioIaScriptUrl = "";
    for (const url of candidatos) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) continue;
            const cfg = await res.json();
            const api = String(cfg?.awsApiUrl || "").trim().replace(/\/+$/, "");
            if (api) awsApiUrl = api;
            if (cfg?.relatorioIaScriptUrl) relatorioIaScriptUrl = String(cfg.relatorioIaScriptUrl).trim();
            if (awsApiUrl && relatorioIaScriptUrl) break;
        } catch { /* tenta próximo */ }
    }
    return { awsApiUrl, relatorioIaScriptUrl };
}

async function chamarGeminiAppsScript(prompt) {
    try {
        const { relatorioIaScriptUrl } = await obterUrlsIa();
        if (!relatorioIaScriptUrl) return null;
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

async function chamarGeminiRest(prompt) {
    const apiKey = String(firebaseConfig?.apiKey || "").trim();
    if (!apiKey) {
        ultimoErroIa = "Chave da API não configurada.";
        return null;
    }

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 2048 }
    };

    for (const model of MODELOS_GEMINI) {
        try {
            const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(apiKey);
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                ultimoErroIa = data?.error?.message || ("Gemini HTTP " + res.status);
                continue;
            }
            const texto = extrairTextoGemini(data);
            if (texto) {
                ultimoErroIa = "";
                return texto;
            }
        } catch (err) {
            ultimoErroIa = err?.message || "Falha na chamada Gemini.";
        }
    }
    return null;
}

async function gerarComIa(prompt) {
    return (await chamarGeminiAppsScript(prompt))
        || (await chamarGeminiProxy(prompt))
        || (await chamarGeminiRest(prompt));
}

function montarErroIaIndisponivel() {
    const detalhe = String(ultimoErroIa || "").trim();
    const orientacao = "Para habilitar a IA: implante scripts/relatorio-ia.gs no Google Apps Script "
        + "(chave GEMINI_API_KEY nas propriedades) e defina relatorioIaScriptUrl em assets/data/portal-runtime.json, "
        + "ou rode export GEMINI_API_KEY=sua_chave && bash scripts/deploy-bus2-proxy.sh.";
    return detalhe ? detalhe + " — " + orientacao : orientacao;
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
