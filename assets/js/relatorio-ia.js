import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

export const TIPOS_RELATORIO = {
    carro_adiantado: {
        id: "carro_adiantado",
        label: "Carro adiantado",
        informativo: false
    },
    atraso_frequente: {
        id: "atraso_frequente",
        label: "Atraso frequente",
        informativo: false
    },
    nao_login_tdm: {
        id: "nao_login_tdm",
        label: "Não realizou login no TDM",
        informativo: false
    },
    nao_acatou_ciop: {
        id: "nao_acatou_ciop",
        label: "Não acatou ordens do CIOP",
        informativo: false
    },
    supressao_viagem: {
        id: "supressao_viagem",
        label: "Supressão de viagem",
        informativo: false
    },
    desvio_itinerario: {
        id: "desvio_itinerario",
        label: "Desvio de itinerário (Sem justificativa)",
        informativo: false
    },
    informativo: {
        id: "informativo",
        label: "Relatório informativo",
        informativo: true
    }
};

let modeloIa = null;
let iaIndisponivel = false;

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
            (ctx.carro || ctx.linha
                ? "Referência operacional" + ctxCarro(ctx) + ctxLinha(ctx) + ".\n\n"
                : "") +
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

async function obterModeloIa() {
    if (modeloIa) return modeloIa;
    if (iaIndisponivel) return null;
    try {
        const { getAI, GoogleAIBackend, getGenerativeModel } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-ai.js");
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const ai = getAI(app, { backend: new GoogleAIBackend() });
        modeloIa = getGenerativeModel(ai, { model: "gemini-2.0-flash" });
        return modeloIa;
    } catch (err) {
        console.warn("IA indisponível:", err);
        iaIndisponivel = true;
        return null;
    }
}

async function gerarComGemini(prompt) {
    const model = await obterModeloIa();
    if (!model) return null;
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.()?.trim();
    return text || null;
}

export async function gerarTextoIA(tipoId, ctx) {
    try {
        const ia = await gerarComGemini(montarPromptGeracao(tipoId, ctx));
        if (ia) return { texto: ia, origem: "ia" };
    } catch (err) {
        console.warn("Falha IA geração:", err);
    }
    return { texto: gerarTextoModelo(tipoId, ctx), origem: "modelo" };
}

export async function corrigirTextoIA(texto) {
    const base = String(texto || "").trim();
    if (!base) return { texto: "", origem: "vazio" };
    try {
        const ia = await gerarComGemini(montarPromptCorrecao(base));
        if (ia) return { texto: ia, origem: "ia" };
    } catch (err) {
        console.warn("Falha IA correção:", err);
    }
    return { texto: melhorarTextoLocal(base), origem: "local" };
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
