// ── Constantes ───────────────────────────────────────────────────────────
const STORAGE_KEY = "portalRH_v3";
const SESSION_KEY = "portalRH_sessao";

// Estrutura local dos usuários — usada apenas para Organograma e Configurações.
// Códigos de acesso NÃO existem aqui; ficam exclusivamente no banco de dados.
const usuarios = [
  { nome: "RH",      perfil: "rh",      setor: "RH",       lideresVinculados: [] },
  { nome: "Direção", perfil: "direcao", setor: "Direção",  lideresVinculados: [] },
  {
    nome: "Gustavo Toledo", perfil: "gestao", setor: "Projetos",
    lideresVinculados: [
      "Lizabeth Silva","Juliana Vicente","Marcelo Holderbaum","Carina Rodrigues",
      "Fernando Sousa","Henrique Lima","Laize Rodrigues","Tiago Soares",
      "Juliana Aquino","Gyrliane Sales"
    ]
  },
  { nome: "Hugo",               perfil: "gestao", setor: "Inovação",   lideresVinculados: ["Ricardo Silveira"]   },
  { nome: "Haddad",             perfil: "gestao", setor: "Financeiro", lideresVinculados: ["Nadia Vieira"]       },
  { nome: "Matheus Fontenelle", perfil: "gestao", setor: "Comercial",  lideresVinculados: ["Mariângela Ciodaro"] },
  { nome: "Lizabeth Silva",     perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Juliana Vicente",    perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Marcelo Holderbaum", perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Carina Rodrigues",   perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Fernando Sousa",     perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Henrique Lima",      perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Laize Rodrigues",    perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Tiago Soares",       perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Juliana Aquino",     perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Gyrliane Sales",     perfil: "lider",  gestor: "Gustavo Toledo",    setor: "Projetos"   },
  { nome: "Ricardo Silveira",   perfil: "lider",  gestor: "Hugo",              setor: "Inovação"   },
  { nome: "Nadia Vieira",       perfil: "lider",  gestor: "Haddad",            setor: "Financeiro" },
  { nome: "Mariângela Ciodaro", perfil: "lider",  gestor: "Matheus Fontenelle",setor: "Comercial"  }
];

const TIPO_INFO = {
  selecao:     { label: "Seleção",         titulo: "Requisição de Pessoal | Seleção" },
  indicacao:   { label: "Indicação",       titulo: "Requisição de Pessoal | Indicação" },
  mudancaCargo:{ label: "Mudança de Cargo",titulo: "Solicitação de Mudança de Cargo" }
};

const BENS = [
  { id: "va", label: "Vale Alimentação (Cartão Caju)" },
  { id: "am", label: "Auxílio Mobilidade" },
  { id: "vt", label: "Vale Transporte (VT)" },
  { id: "ps", label: "Plano de Saúde" },
  { id: "po", label: "Plano Odontológico" },
  { id: "sv", label: "Seguro de Vida" },
  { id: "do", label: "Day Off de Aniversário" },
  { id: "ac", label: "Ajuda de Custo (Moradia)" }
];

const STATUS_LIST = [
  "Aguardando análise do gestor",
  "Aprovada pelo gestor","Reprovada pelo gestor",
  "Encaminhada ao RH",
  "Em análise pelo RH","Aprovada pelo RH","Reprovada pelo RH",
  "Aprovada pela Direção","Reprovada pela Direção",
  "Devolvida para ajuste","Finalizada"
];

// ── Estado ───────────────────────────────────────────────────────────────
let solicitacoes = [];
let usuarioAtual = null;
let filtroStatus = "";
let filtroOrigem = "";   // "" | "propria" | "liderados" — só usado por gestao
let paginaAtual = 1;
let tipoFormAtual = null;
let idEdicaoAtual = null;
let idDetalhesAtual = null;
let formOrigin = "novaSolicitacao";
let dashPagina = 1;
let dashLista = [];
const DASH_PER_PAGE = 10;

// ── Permissões centralizadas ──────────────────────────────────────────────
function podeVerSolicitacao(usuario, item) {
  if (!usuario || !item) return false;
  const criador = item.criadoPor || item.criadoPorNome || "";
  if (usuario.perfil === "rh") return true;
  if (usuario.perfil === "direcao") return true;
  if (usuario.perfil === "lider") return criador === usuario.nome;
  if (usuario.perfil === "gestao") {
    return criador === usuario.nome ||
           (usuario.lideresVinculados || []).includes(criador);
  }
  return false;
}

function podeAlterarStatus(usuario, item) {
  if (!usuario || !item) return false;
  const criador = item.criadoPor || item.criadoPorNome || "";
  if (usuario.perfil === "rh") return true;
  if (usuario.perfil === "direcao") return true;
  if (usuario.perfil === "gestao") {
    return criador === usuario.nome ||
           (usuario.lideresVinculados || []).includes(criador);
  }
  return false;
}

function getAcoesDisponiveis(usuario, item) {
  const p = usuario.perfil;
  const s = item.status;
  const criador = item.criadoPor || item.criadoPorNome || "";

  if (p === "gestao") {
    const isPropria  = criador === usuario.nome;
    const isLiderado = (usuario.lideresVinculados || []).includes(criador);
    if (!isPropria && !isLiderado) return [];

    if (s === "Aguardando análise do gestor") return [
      { label: "Aprovar",              novoStatus: "Aprovada pelo gestor",  reqObs: true  },
      { label: "Reprovar",             novoStatus: "Reprovada pelo gestor", reqObs: true  },
      { label: "Devolver para ajuste", novoStatus: "Devolvida para ajuste", reqObs: true  }
    ];
    if (s === "Aprovada pelo gestor") return [];
    if (s === "Devolvida para ajuste" && isPropria) return [
      { label: "Reenviar ao gestor", novoStatus: "Aguardando análise do gestor", reqObs: false }
    ];
    return [];
  }

  if (p === "rh") {
    const opcoes = [
      { label: "Colocar em análise", novoStatus: "Em análise pelo RH",   reqObs: false },
      { label: "Aprovar",            novoStatus: "Aprovada pelo RH",      reqObs: true  },
      { label: "Reprovar",           novoStatus: "Reprovada pelo RH",     reqObs: true  },
      { label: "Finalizar",          novoStatus: "Finalizada",            reqObs: false },
      { label: "Devolver para ajuste", novoStatus: "Devolvida para ajuste", reqObs: true }
    ];
    return opcoes.filter(a => a.novoStatus !== s);
  }

  if (p === "direcao") {
    const opcoes = [
      { label: "Aprovar",              novoStatus: "Aprovada pela Direção",  reqObs: true  },
      { label: "Reprovar",             novoStatus: "Reprovada pela Direção", reqObs: true  },
      { label: "Encaminhar ao RH",     novoStatus: "Encaminhada ao RH",      reqObs: false },
      { label: "Devolver para ajuste", novoStatus: "Devolvida para ajuste",  reqObs: true  },
      { label: "Finalizar",            novoStatus: "Finalizada",             reqObs: false }
    ];
    return opcoes.filter(a => a.novoStatus !== s);
  }

  return [];
}

// ── Init ─────────────────────────────────────────────────────────────────
function init() {
  carregarLocal();
  const sessao = sessionStorage.getItem(SESSION_KEY);
  if (sessao) {
    try {
      usuarioAtual = JSON.parse(sessao);
      mostrarApp();
      mostrarView("dashboard");
    } catch(e) {
      mostrarLogin();
    }
  } else {
    mostrarLogin();
  }
  vincularListeners();
}

// ── Auth ─────────────────────────────────────────────────────────────────
async function login() {
  const btnEntrar = document.getElementById("btnEntrar");
  const erro      = document.getElementById("loginErro");
  const campo     = document.getElementById("inputCodigo");
  const codigo    = campo.value.trim();

  if (!codigo) {
    erro.textContent = "Digite seu código de acesso.";
    erro.classList.remove("hidden");
    return;
  }

  // Feedback visual durante a consulta ao banco
  btnEntrar.disabled    = true;
  btnEntrar.textContent = "Verificando...";
  erro.classList.add("hidden");

  try {
    const { user, erro: msgErro } = await autenticarPorCodigo(codigo);

    if (!user) {
      erro.textContent = msgErro || "Código inválido. Tente novamente.";
      erro.classList.remove("hidden");
      campo.value = "";
      campo.focus();
      return;
    }

    // Autenticação bem-sucedida — código nunca é armazenado
    usuarioAtual = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    campo.value = "";
    mostrarApp();
    mostrarView("dashboard");
    mostrarToast("Bem-vindo(a), " + user.nome + ".");

  } catch (e) {
    erro.textContent = "Erro inesperado. Tente novamente.";
    erro.classList.remove("hidden");
    console.error("[login]", e);
  } finally {
    btnEntrar.disabled    = false;
    btnEntrar.textContent = "Entrar";
  }
}

function logout() {
  usuarioAtual = null;
  sessionStorage.removeItem(SESSION_KEY);
  mostrarLogin();
}

function mostrarLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

function mostrarApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  atualizarSidebar();
}

const PERFIL_LABEL = { rh: "RH", direcao: "Direção", gestao: "Gestão", lider: "Líder" };

function atualizarSidebar() {
  if (!usuarioAtual) return;
  const label = PERFIL_LABEL[usuarioAtual.perfil] || usuarioAtual.perfil;

  document.getElementById("sidebarAvatar").textContent = usuarioAtual.nome.charAt(0).toUpperCase();
  document.getElementById("sidebarNome").textContent = usuarioAtual.nome;
  document.getElementById("sidebarPerfil").textContent = "Perfil: " + label;
  document.getElementById("topPerfil").textContent = label;

  const elSetor = document.getElementById("sidebarSetor");
  if (elSetor) elSetor.textContent = usuarioAtual.setor ? "Setor: " + usuarioAtual.setor : "";

  const elGestor = document.getElementById("sidebarGestor");
  if (elGestor) {
    elGestor.textContent = usuarioAtual.gestor ? "Gestor: " + usuarioAtual.gestor : "";
    elGestor.style.display = usuarioAtual.gestor ? "" : "none";
  }

  // Boas-vindas na top-bar (visível em todas as telas exceto dashboard)
  const elBoasVindas = document.getElementById("topBoasVindas");
  if (elBoasVindas) {
    elBoasVindas.innerHTML = "Bem-vindo(a), <strong>" + esc(usuarioAtual.nome) + "</strong>";
  }
}

// ── Views ────────────────────────────────────────────────────────────────
const VIEW_TITLES = {
  dashboard: "Dashboard",
  novaSolicitacao: "Nova Solicitação",
  solicitacoes: "Solicitações",
  configuracoes: "Organograma"
};

function mostrarView(nome) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const viewId = "view" + nome.charAt(0).toUpperCase() + nome.slice(1);
  const el = document.getElementById(viewId);
  if (el) el.classList.add("active");

  // Dashboard: oculta top-bar e usa header próprio
  const isDash = nome === "dashboard";
  document.body.classList.toggle("dash-active", isDash);
  if (!isDash) document.getElementById("topBarTitle").textContent = VIEW_TITLES[nome] || nome;

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const navBtn = document.querySelector(`.nav-item[data-view="${nome}"]`);
  if (navBtn) navBtn.classList.add("active");

  if (nome === "dashboard") renderDashboard();
  if (nome === "solicitacoes") renderListagem();
  if (nome === "configuracoes") renderOrganograma();
}

function mostrarViewForm() {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("viewFormulario").classList.add("active");
  document.body.classList.remove("dash-active");
  document.getElementById("topBarTitle").textContent = TIPO_INFO[tipoFormAtual]?.titulo || "Formulário";
}

// ── Dashboard ────────────────────────────────────────────────────────────
function renderDashboard() {
  dashPagina = 1;
  const lista = minhaLista();
  dashLista = [...lista].sort((a,b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));

  const KPI_DEFS = [
    { label: "Total",          icon: "⊟", classe: "",              desc: "registradas",           count: lista.length },
    { label: "Aguard. Gestor", icon: "⏱", classe: "kpi-fila",      desc: "aguardando o gestor",   count: lista.filter(s=>s.status==="Aguardando análise do gestor").length },
    { label: "Aprov. Gestor",  icon: "✓", classe: "kpi-analise",   desc: "aprovadas pelo gestor", count: lista.filter(s=>s.status==="Aprovada pelo gestor").length },
    { label: "Enc. ao RH",     icon: "→", classe: "kpi-rh",        desc: "encaminhadas ao RH",    count: lista.filter(s=>s.status==="Encaminhada ao RH").length },
    { label: "Análise RH",     icon: "⊙", classe: "kpi-analise",   desc: "em análise pelo RH",    count: lista.filter(s=>s.status==="Em análise pelo RH").length },
    { label: "Aprovadas",      icon: "✓", classe: "kpi-aprovado",  desc: "aprovadas (RH/Direção)",count: lista.filter(s=>["Aprovada pelo RH","Aprovada pela Direção"].includes(s.status)).length },
    { label: "Reprovadas",     icon: "✕", classe: "kpi-reprovado", desc: "reprovadas",            count: lista.filter(s=>["Reprovada pelo gestor","Reprovada pelo RH","Reprovada pela Direção"].includes(s.status)).length },
    { label: "Finalizadas",    icon: "◉", classe: "kpi-finalizada",desc: "concluídas",            count: lista.filter(s=>s.status==="Finalizada").length }
  ];

  const kpisHTML = KPI_DEFS.map(k => `
    <div class="kpi-card ${k.classe}">
      <div class="kpi-top">
        <span class="kpi-icon">${k.icon}</span>
        <span class="kpi-label">${k.label}</span>
      </div>
      <strong class="kpi-value">${k.count}</strong>
      <span class="kpi-desc">${k.desc}</span>
    </div>`).join("");

  const perfilLabel = PERFIL_LABEL[usuarioAtual.perfil] || usuarioAtual.perfil;

  document.getElementById("dashContent").innerHTML = `
    <div class="dash-welcome-bar">
      <span>Bem-vindo(a),</span>
      <strong>${esc(usuarioAtual.nome)}</strong>
      <span class="dash-welcome-perfil">${esc(perfilLabel)}</span>
    </div>
    <div class="dashboard-kpis">${kpisHTML}</div>
    <div class="dash-recentes">
      <div class="dash-recentes-header">
        <h3 class="dash-recentes-title">Solicitações Recentes</h3>
      </div>
      <div id="dashRecentesBody"></div>
      <div id="dashRecentesFooter"></div>
    </div>`;

  renderDashRecentes();
}

function renderDashRecentes() {
  const total = dashLista.length;
  const totalPags = Math.max(1, Math.ceil(total / DASH_PER_PAGE));
  if (dashPagina > totalPags) dashPagina = totalPags;
  const inicio = (dashPagina - 1) * DASH_PER_PAGE;
  const fim = Math.min(inicio + DASH_PER_PAGE, total);
  const pagina = dashLista.slice(inicio, fim);

  const body   = document.getElementById("dashRecentesBody");
  const footer = document.getElementById("dashRecentesFooter");
  if (!body) return;

  if (!total) {
    body.innerHTML = `<div class="dash-empty-compact">
      <p class="dash-empty-c-title">Nenhuma solicitação registrada.</p>
      <p class="dash-empty-c-sub">As solicitações criadas aparecerão aqui.</p>
    </div>`;
    footer.innerHTML = "";
    return;
  }

  body.innerHTML = `<div class="dash-table-wrap"><table class="dash-table-full">
    <thead><tr>
      <th>Nº</th><th>Tipo</th><th>Solicitante</th>
      <th>Status</th><th>Criado em</th><th>Atualizado</th><th></th>
    </tr></thead>
    <tbody>${pagina.map(item => `<tr>
      <td><span class="id-cell">${item.id}</span></td>
      <td><span class="dash-tipo-label">${TIPO_INFO[item.tipo]?.label || item.tipo}</span></td>
      <td class="dash-td-criador">${esc(item.criadoPor || item.criadoPorNome || "—")}</td>
      <td>${statusBadge(item.status)}</td>
      <td class="dash-td-data">${formatarData(item.dataCriacao)}</td>
      <td class="dash-td-data">${formatarData(item.dataAtualizacao)}</td>
      <td><button class="btn-dash-ver" onclick="verDetalhes('${item.id}')">Ver →</button></td>
    </tr>`).join("")}</tbody>
  </table></div>`;

  footer.innerHTML = `<div class="dash-pagination">
    <span class="dash-pag-info">Mostrando ${inicio+1}–${fim} de ${total} registro${total!==1?"s":""}</span>
    <div class="dash-pag-controls">
      <button class="btn-pagination" id="dashPrevPage" ${dashPagina<=1?"disabled":""}>‹</button>
      <span class="page-number">${dashPagina}</span>
      <span class="dash-pag-sep">/ ${totalPags}</span>
      <button class="btn-pagination" id="dashNextPage" ${dashPagina>=totalPags?"disabled":""}>›</button>
    </div>
  </div>`;

  document.getElementById("dashPrevPage")?.addEventListener("click", () => { dashPagina--; renderDashRecentes(); });
  document.getElementById("dashNextPage")?.addEventListener("click", () => { dashPagina++; renderDashRecentes(); });
}

// ── Formulários ──────────────────────────────────────────────────────────
function abrirFormPorTipo(tipo) {
  tipoFormAtual = tipo;
  idEdicaoAtual = null;
  formOrigin = "novaSolicitacao";
  renderFormPorTipo(tipo, null);
  mostrarViewForm();
}

function abrirFormParaEditar(id) {
  const item = solicitacoes.find(s => s.id === id);
  if (!item) return;
  tipoFormAtual = item.tipo;
  idEdicaoAtual = id;
  formOrigin = "solicitacoes";
  renderFormPorTipo(item.tipo, item.dados);
  mostrarViewForm();
}

function renderFormPorTipo(tipo, dados) {
  const info = TIPO_INFO[tipo];
  document.getElementById("formTitulo").textContent = info.titulo;
  document.getElementById("formSubtitulo").textContent = info.label;
  let html = (tipo === "selecao" || tipo === "indicacao")
    ? htmlFormSelecaoIndicacao(tipo, dados)
    : htmlFormMudancaCargo(dados);
  document.getElementById("formBody").innerHTML = html;
  afterFormRender();
}

function htmlFormSelecaoIndicacao(tipo, dados) {
  const d = dados || {};
  const ind = tipo === "indicacao";
  const sel = (field, opts, val) =>
    `<select id="${field}" class="form-control"><option value="">Selecione</option>${opts.map(o=>`<option ${val===o?"selected":""}>${o}</option>`).join("")}</select>`;

  return `
  <div class="form-section-block">
    <h3 class="form-subtitle">1. Informações da Vaga</h3>
    <div class="form-grid">
      ${ind ? `<div class="form-group full-width">
        <label class="form-label required">Nome da pessoa indicada</label>
        <input id="f_nomeIndicada" class="form-control" value="${esc(d.nomeIndicada)}" />
      </div>` : ""}
      <div class="form-group">
        <label class="form-label required">Cargo</label>
        <input id="f_cargo" class="form-control" value="${esc(d.cargo)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Tipo de contrato</label>
        ${sel("f_tipoContrato",["CLT","PJ","Estágio","Horista"],d.tipoContrato)}
      </div>
      <div class="form-group">
        <label class="form-label">Horário</label>
        <input id="f_horario" class="form-control" value="${esc(d.horario)}" placeholder="Ex: 08h às 17h" />
      </div>
      <div class="form-group">
        <label class="form-label">Salário</label>
        <input id="f_salario" class="form-control mask-real" value="${esc(d.salario)}" placeholder="R$ 0,00" />
      </div>
      <div class="form-group">
        <label class="form-label required">Setor / Cliente</label>
        <input id="f_setorCliente" class="form-control" value="${esc(d.setorCliente)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Departamento / Projeto</label>
        <input id="f_departamentoProjeto" class="form-control" value="${esc(d.departamentoProjeto)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">CNPJ (empresa)</label>
        ${sel("f_cnpjEmpresa",["Seteg","Licenza"],d.cnpjEmpresa)}
      </div>
      <div class="form-group">
        <label class="form-label required">Número de vagas</label>
        <input id="f_numVagas" class="form-control" type="number" min="1" value="${esc(d.numVagas)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Modalidade</label>
        ${sel("f_modalidade",["Presencial","Híbrido","Remoto"],d.modalidade)}
      </div>
      <div class="form-group">
        <label class="form-label">Data de início</label>
        <input id="f_dataInicio" class="form-control" type="date" value="${esc(d.dataInicio)}" />
      </div>
      <div class="form-group full-width">
        <label class="form-label required">Tipo de requisição</label>
        ${sel("f_tipoRequisicao",["Substituição","Aumento de Quadro","Licença/Afastamento","Quadro Extra/Temporário"],d.tipoRequisicao)}
      </div>
    </div>
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">2. Benefícios</h3>
    ${htmlBeneficiosCheckboxes(d.beneficios, true)}
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">3. Dados do Solicitante</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label required">Nome</label>
        <input id="f_solNome" class="form-control" value="${esc(d.solNome)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Cargo</label>
        <input id="f_solCargo" class="form-control" value="${esc(d.solCargo)}" />
      </div>
    </div>
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">4. Perfil do Cargo Solicitado</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label required">Formação acadêmica</label>
        <select id="f_formAcademica" class="form-control">
          <option value="">Selecione</option>
          ${["Ensino Médio Incompleto","Ensino Médio Completo","Superior Incompleto","Superior Completo","Pós-Graduado","Mestrado","Doutorado","Outros"].map(o=>`<option ${d.formAcademica===o?"selected":""}>${o}</option>`).join("")}
        </select>
      </div>
      <div class="form-group" id="grupoFormOutro" style="display:${(d.formAcademica||"").toUpperCase()==="OUTROS"?"":"none"}">
        <label class="form-label">Especifique a formação</label>
        <input id="f_formAcademicaOutro" class="form-control" value="${esc(d.formAcademicaOutro)}" />
      </div>
      <div class="form-group full-width">
        <label class="form-label">Conhecimentos indispensáveis</label>
        <textarea id="f_conhecimentos" class="form-control" rows="3">${esc(d.conhecimentos)}</textarea>
      </div>
      <div class="form-group full-width">
        <label class="form-label">Experiência desejada</label>
        <textarea id="f_experiencia" class="form-control" rows="3">${esc(d.experiencia)}</textarea>
      </div>
      <div class="form-group full-width">
        <label class="form-label">Observações gerais</label>
        <textarea id="f_observacoes" class="form-control" rows="3">${esc(d.observacoes)}</textarea>
      </div>
    </div>
  </div>`;
}

function htmlFormMudancaCargo(dados) {
  const d = dados || {};
  const sel = (field, opts, val) =>
    `<select id="${field}" class="form-control"><option value="">Selecione</option>${opts.map(o=>`<option ${val===o?"selected":""}>${o}</option>`).join("")}</select>`;

  return `
  <div class="form-section-block">
    <h3 class="form-subtitle">1. Informações do Colaborador</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label required">Nome completo</label>
        <input id="f_nomeColaborador" class="form-control" value="${esc(d.nomeColaborador)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Setor / Departamento atual</label>
        <input id="f_setorAtual" class="form-control" value="${esc(d.setorAtual)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Cargo atual</label>
        <input id="f_cargoAtual" class="form-control" value="${esc(d.cargoAtual)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Líder imediato atual</label>
        <input id="f_liderAtual" class="form-control" value="${esc(d.liderAtual)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Salário atual</label>
        <input id="f_salarioAtual" class="form-control mask-real" value="${esc(d.salarioAtual)}" placeholder="R$ 0,00" />
      </div>
      <div class="form-group">
        <label class="form-label">Horário de trabalho atual</label>
        <input id="f_horarioAtual" class="form-control" value="${esc(d.horarioAtual)}" />
      </div>
    </div>
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">2. Informações da Mudança Solicitada</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label required">Cargo proposto / novo cargo</label>
        <input id="f_cargoNovo" class="form-control" value="${esc(d.cargoNovo)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Setor / Departamento de destino</label>
        <input id="f_setorDestino" class="form-control" value="${esc(d.setorDestino)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Nome do novo líder imediato</label>
        <input id="f_novoLider" class="form-control" value="${esc(d.novoLider)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Salário após a mudança</label>
        <input id="f_salarioNovo" class="form-control mask-real" value="${esc(d.salarioNovo)}" placeholder="R$ 0,00" />
      </div>
      <div class="form-group">
        <label class="form-label">Horário após a mudança</label>
        <input id="f_horarioNovo" class="form-control" value="${esc(d.horarioNovo)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Data prevista para a mudança</label>
        <input id="f_dataMudanca" class="form-control" type="date" value="${esc(d.dataMudanca)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Tipo de mudança de cargo</label>
        <select id="f_tipoMudanca" class="form-control">
          <option value="">Selecione</option>
          ${["Promoção","Readequação","Transferência lateral","Outra"].map(o=>`<option ${d.tipoMudanca===o?"selected":""}>${o}</option>`).join("")}
        </select>
      </div>
      <div class="form-group" id="grupoTipoMudancaOutro" style="display:${(d.tipoMudanca||"").toUpperCase()==="OUTRA"?"":"none"}">
        <label class="form-label">Especifique o tipo</label>
        <input id="f_tipoMudancaOutro" class="form-control" value="${esc(d.tipoMudancaOutro)}" />
      </div>
    </div>
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">3. Benefícios</h3>
    ${htmlBeneficiosCheckboxes(d.beneficios, false)}
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">4. Justificativa / Observações Importantes</h3>
    <div class="form-grid">
      <div class="form-group full-width">
        <textarea id="f_justificativa" class="form-control" rows="5" placeholder="Descreva a justificativa e observações importantes...">${esc(d.justificativa)}</textarea>
      </div>
    </div>
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">5. Dados do Solicitante / Responsável</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label required">Nome</label>
        <input id="f_respNome" class="form-control" value="${esc(d.respNome)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Cargo</label>
        <input id="f_respCargo" class="form-control" value="${esc(d.respCargo)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Data</label>
        <input id="f_respData" class="form-control" type="date" value="${esc(d.respData)}" />
      </div>
    </div>
  </div>`;
}

function htmlBeneficiosCheckboxes(selecionados, comOutros) {
  const lista = Array.isArray(selecionados) ? selecionados : [];
  const temOutros = lista.some(l => l === "Outros" || l.startsWith("Outros: "));
  const outrosEspec = (lista.find(l => l.startsWith("Outros: ")) || "").replace("Outros: ", "");

  let html = '<div class="checkbox-group">';
  BENS.forEach(b => {
    const checked = lista.includes(b.label) ? "checked" : "";
    html += `<label class="checkbox-item">
      <input type="checkbox" id="f_chk_${b.id}" ${checked} />
      <span class="checkbox-label">${b.label}</span>
    </label>`;
  });
  if (comOutros) {
    html += `<label class="checkbox-item">
      <input type="checkbox" id="f_chk_outros" ${temOutros?"checked":""} />
      <span class="checkbox-label">Outros</span>
    </label>
    <div id="grupoBenefOutros" class="benef-outros-field" style="display:${temOutros?"":"none"}">
      <input id="f_benefOutros" class="form-control" placeholder="Especifique o benefício" value="${esc(outrosEspec)}" />
    </div>`;
  }
  html += '</div>';
  return html;
}

function afterFormRender() {
  document.querySelectorAll(".mask-real").forEach(el => {
    el.addEventListener("input", () => mascaraReais(el));
  });
  const fa = document.getElementById("f_formAcademica");
  if (fa) fa.addEventListener("change", toggleFormOutro);
  const tm = document.getElementById("f_tipoMudanca");
  if (tm) tm.addEventListener("change", toggleTipoMudancaOutro);
  const bo = document.getElementById("f_chk_outros");
  if (bo) bo.addEventListener("change", toggleBenefOutros);

  // Enter em input/select envia o formulário; Ctrl+Enter em textarea também.
  // Remove listener anterior para evitar disparos múltiplos ao trocar tipo de formulário.
  const formBody = document.getElementById("formBody");
  if (formBody) {
    if (formBody._enterHandler) {
      formBody.removeEventListener("keydown", formBody._enterHandler);
    }
    formBody._enterHandler = function(e) {
      if (e.key !== "Enter") return;
      if (e.target.tagName === "TEXTAREA" && !e.ctrlKey) return;
      e.preventDefault();
      salvarSolicitacao();
    };
    formBody.addEventListener("keydown", formBody._enterHandler);
  }
}

function toggleFormOutro() {
  const val = document.getElementById("f_formAcademica")?.value || "";
  const g = document.getElementById("grupoFormOutro");
  if (g) g.style.display = val === "Outros" ? "" : "none";
  if (val !== "Outros") { const el = document.getElementById("f_formAcademicaOutro"); if (el) el.value = ""; }
}

function toggleTipoMudancaOutro() {
  const val = document.getElementById("f_tipoMudanca")?.value || "";
  const g = document.getElementById("grupoTipoMudancaOutro");
  if (g) g.style.display = val === "Outra" ? "" : "none";
  if (val !== "Outra") { const el = document.getElementById("f_tipoMudancaOutro"); if (el) el.value = ""; }
}

function toggleBenefOutros() {
  const chkd = document.getElementById("f_chk_outros")?.checked;
  const g = document.getElementById("grupoBenefOutros");
  if (g) g.style.display = chkd ? "" : "none";
  if (!chkd) { const el = document.getElementById("f_benefOutros"); if (el) el.value = ""; }
}

// ── Coleta ────────────────────────────────────────────────────────────────
function coletarForm() {
  if (tipoFormAtual === "selecao" || tipoFormAtual === "indicacao") {
    const dados = {
      cargo: uv("f_cargo"),
      tipoContrato: uv("f_tipoContrato"),
      horario: uv("f_horario"),
      salario: v("f_salario"),
      setorCliente: uv("f_setorCliente"),
      departamentoProjeto: uv("f_departamentoProjeto"),
      cnpjEmpresa: uv("f_cnpjEmpresa"),
      numVagas: v("f_numVagas"),
      modalidade: uv("f_modalidade"),
      dataInicio: v("f_dataInicio"),
      tipoRequisicao: uv("f_tipoRequisicao"),
      beneficios: coletarBeneficios(true),
      solNome: uv("f_solNome"),
      solCargo: uv("f_solCargo"),
      formAcademica: uv("f_formAcademica"),
      formAcademicaOutro: uv("f_formAcademicaOutro"),
      conhecimentos: uv("f_conhecimentos"),
      experiencia: uv("f_experiencia"),
      observacoes: uv("f_observacoes")
    };
    if (tipoFormAtual === "indicacao") dados.nomeIndicada = uv("f_nomeIndicada");
    return dados;
  } else {
    return {
      nomeColaborador: uv("f_nomeColaborador"),
      setorAtual: uv("f_setorAtual"),
      cargoAtual: uv("f_cargoAtual"),
      liderAtual: uv("f_liderAtual"),
      salarioAtual: v("f_salarioAtual"),
      horarioAtual: uv("f_horarioAtual"),
      cargoNovo: uv("f_cargoNovo"),
      setorDestino: uv("f_setorDestino"),
      novoLider: uv("f_novoLider"),
      salarioNovo: v("f_salarioNovo"),
      horarioNovo: uv("f_horarioNovo"),
      dataMudanca: v("f_dataMudanca"),
      tipoMudanca: uv("f_tipoMudanca"),
      tipoMudancaOutro: uv("f_tipoMudancaOutro"),
      beneficios: coletarBeneficios(false),
      justificativa: uv("f_justificativa"),
      respNome: uv("f_respNome"),
      respCargo: uv("f_respCargo"),
      respData: v("f_respData")
    };
  }
}

function coletarBeneficios(comOutros) {
  const selecionados = BENS
    .filter(b => document.getElementById("f_chk_" + b.id)?.checked)
    .map(b => b.label);
  if (comOutros) {
    const chkOutros = document.getElementById("f_chk_outros");
    if (chkOutros?.checked) {
      const espec = document.getElementById("f_benefOutros")?.value?.trim();
      selecionados.push(espec ? "Outros: " + espec : "Outros");
    }
  }
  return selecionados;
}

function validarForm(dados) {
  if (tipoFormAtual === "selecao" || tipoFormAtual === "indicacao") {
    if (tipoFormAtual === "indicacao" && !dados.nomeIndicada) return "Informe o nome da pessoa indicada.";
    if (!dados.cargo)           return "Informe o cargo.";
    if (!dados.tipoContrato)    return "Informe o tipo de contrato.";
    if (!dados.horario)         return "Informe o horário de trabalho.";
    if (!dados.salario)         return "Informe o salário.";
    if (!dados.setorCliente)    return "Informe o Setor / Cliente.";
    if (!dados.departamentoProjeto) return "Informe o Departamento / Projeto.";
    if (!dados.cnpjEmpresa)     return "Informe a empresa (CNPJ).";
    if (!dados.numVagas)        return "Informe o número de vagas.";
    if (!dados.modalidade)      return "Informe a modalidade.";
    if (!dados.dataInicio)      return "Informe a data de início.";
    if (!dados.tipoRequisicao)  return "Informe o tipo de requisição.";
    if (!dados.solNome)         return "Informe o nome do solicitante.";
    if (!dados.solCargo)        return "Informe o cargo do solicitante.";
    if (!dados.formAcademica)   return "Informe a formação acadêmica exigida.";
    if (dados.formAcademica === "OUTROS" && !dados.formAcademicaOutro) return "Especifique a formação acadêmica.";

    if (!dados.conhecimentos)   return "Informe os conhecimentos indispensáveis.";
    if (!dados.experiencia)     return "Informe a experiência desejada.";
  } else {
    if (!dados.nomeColaborador)  return "Informe o nome completo do colaborador.";
    if (!dados.setorAtual)       return "Informe o setor/departamento atual.";
    if (!dados.cargoAtual)       return "Informe o cargo atual.";
    if (!dados.liderAtual)       return "Informe o líder imediato atual.";
    if (!dados.salarioAtual)     return "Informe o salário atual.";
    if (!dados.horarioAtual)     return "Informe o horário de trabalho atual.";
    if (!dados.cargoNovo)        return "Informe o cargo proposto.";
    if (!dados.setorDestino)     return "Informe o setor/departamento de destino.";
    if (!dados.novoLider)        return "Informe o nome do novo líder imediato.";
    if (!dados.salarioNovo)      return "Informe o salário após a mudança.";
    if (!dados.horarioNovo)      return "Informe o horário após a mudança.";
    if (!dados.dataMudanca)      return "Informe a data prevista para a mudança.";
    if (!dados.tipoMudanca)      return "Informe o tipo de mudança de cargo.";
    if (dados.tipoMudanca === "OUTRA" && !dados.tipoMudancaOutro) return "Especifique o tipo de mudança.";

    if (!dados.justificativa)    return "Informe a justificativa / observações.";
    if (!dados.respNome)         return "Informe o nome do responsável.";
    if (!dados.respCargo)        return "Informe o cargo do responsável.";
    if (!dados.respData)         return "Informe a data.";
  }
  return null;
}

// ── Salvar / Editar / Excluir ─────────────────────────────────────────────
function salvarSolicitacao() {
  const dados = coletarForm();
  const erro = validarForm(dados);
  if (erro) { mostrarToast(erro); return; }

  if (idEdicaoAtual) {
    const idx = solicitacoes.findIndex(s => s.id === idEdicaoAtual);
    if (idx === -1) return;
    const item = solicitacoes[idx];
    if (!podeEditarLider(item)) {
      mostrarToast("Você não tem permissão para editar esta solicitação.");
      return;
    }
    const novo = {
      ...item,
      dados,
      dataAtualizacao: new Date().toISOString(),
      historico: [...(item.historico||[]), {
        data: new Date().toISOString(),
        usuario: usuarioAtual.nome,
        acao: "Formulário atualizado.",
        statusAnterior: item.status,
        novoStatus: item.status,
        obs: ""
      }]
    };
    solicitacoes[idx] = novo;
    mostrarToast("Solicitação atualizada com sucesso.");
  } else {
    const id = gerarId();
    const novo = {
      id,
      tipo: tipoFormAtual,
      criadoPor: usuarioAtual.nome,
      criadoPorNome: usuarioAtual.nome,
      criadoPorCodigo: usuarioAtual.codigo,
      criadoPorPerfil: usuarioAtual.perfil,
      gestorResponsavel: usuarioAtual.gestor || null,
      setorResponsavel: usuarioAtual.setor || null,
      dados,
      status: "Aguardando análise do gestor",
      historico: [{
        data: new Date().toISOString(),
        usuario: usuarioAtual.nome.toUpperCase(),
        perfil: (PERFIL_LABEL[usuarioAtual.perfil] || "LÍDER").toUpperCase(),
        acao: "SOLICITAÇÃO CRIADA.",
        statusAnterior: null,
        novoStatus: "Aguardando análise do gestor",
        obs: ""
      }],
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString()
    };
    solicitacoes.unshift(novo);
    salvarLocal();
    const _origemSucesso = formOrigin;
    document.getElementById("sucessoNumero").textContent = "Protocolo " + id;
    document.getElementById("btnSucessoOk").onclick = () => {
      fecharModal("modalSucesso");
      mostrarView(_origemSucesso);
    };
    document.getElementById("modalSucesso").classList.add("active");
    return;
  }

  salvarLocal();
  mostrarView(formOrigin);
}

function editarSolicitacao(id) {
  const item = solicitacoes.find(s => s.id === id);
  if (!item) return;
  if (!podeEditarLider(item)) {
    mostrarToast("Não é possível editar esta solicitação (status ou permissão inválida).");
    return;
  }
  abrirFormParaEditar(id);
}

function abrirModalExcluir(id) {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) {
    mostrarToast("Apenas RH e Direção podem excluir solicitações."); return;
  }
  document.getElementById("excluirId").value = id;
  document.getElementById("modalExcluir").classList.add("active");
}

function confirmarExcluir() {
  const id = document.getElementById("excluirId").value;
  if (!id) return;
  solicitacoes = solicitacoes.filter(s => s.id !== id);
  salvarLocal();
  fecharModal("modalExcluir");
  renderListagem();
  renderDashboard();
  mostrarToast("Solicitação excluída.");
}

function podeEditarLider(item) {
  const criador = item.criadoPor || item.criadoPorNome || "";
  const ehCriador = criador === usuarioAtual.nome;
  const perfilPermitido = usuarioAtual.perfil === "lider" || usuarioAtual.perfil === "gestao";
  return perfilPermitido && ehCriador && item.status === "Devolvida para ajuste";
}

// ── Modal de Decisão ──────────────────────────────────────────────────────
let _acoesCurrent = [];

function abrirModalDecisao(id) {
  const item = solicitacoes.find(s => s.id === id);
  if (!item) return;

  const acoes = getAcoesDisponiveis(usuarioAtual, item);
  if (!acoes.length) {
    mostrarToast("Nenhuma ação disponível para esta solicitação no momento."); return;
  }

  _acoesCurrent = acoes;
  document.getElementById("decisaoId").value = id;
  document.getElementById("modalDecisaoSub").textContent =
    `${item.id} — ${TIPO_INFO[item.tipo]?.label || item.tipo} — ${item.status}`;
  document.getElementById("decisaoObs").value = "";
  document.getElementById("decisaoObsWrap").style.display = "none";
  document.getElementById("btnConfirmarDecisao").disabled = true;
  document.getElementById("decisaoAcoes").dataset.selected = "";

  document.getElementById("decisaoAcoes").innerHTML = acoes.map((a, i) => `
    <button class="decisao-btn" onclick="selecionarAcao(${i})">${a.label}</button>`).join("");

  document.getElementById("modalDecisao").classList.add("active");
}

function selecionarAcao(idx) {
  const acao = _acoesCurrent[idx];
  if (!acao) return;

  document.querySelectorAll(".decisao-btn").forEach((btn, i) => {
    btn.classList.toggle("decisao-btn-selected", i === idx);
  });
  document.getElementById("decisaoAcoes").dataset.selected = idx;

  const obsWrap = document.getElementById("decisaoObsWrap");
  obsWrap.style.display = "";
  const obsEl = document.getElementById("decisaoObs");
  obsEl.placeholder = acao.reqObs
    ? "Observação ou justificativa obrigatória..."
    : "Observação (opcional)...";

  const confirmBtn = document.getElementById("btnConfirmarDecisao");
  confirmBtn.disabled = acao.reqObs ? !obsEl.value.trim() : false;
  obsEl.oninput = () => {
    if (acao.reqObs) confirmBtn.disabled = !obsEl.value.trim();
  };
}

function salvarDecisao() {
  const selIdx = parseInt(document.getElementById("decisaoAcoes").dataset.selected ?? "-1");
  const acao = _acoesCurrent[selIdx];
  if (!acao) { mostrarToast("Selecione uma ação antes de confirmar."); return; }

  const id  = document.getElementById("decisaoId").value;
  const obs = document.getElementById("decisaoObs").value.trim().toUpperCase();

  if (acao.reqObs && !obs) {
    mostrarToast("A observação é obrigatória para esta ação."); return;
  }

  const idx = solicitacoes.findIndex(s => s.id === id);
  if (idx === -1) return;
  const item = solicitacoes[idx];

  const histEntry = {
    data: new Date().toISOString(),
    usuario: usuarioAtual.nome.toUpperCase(),
    perfil: (PERFIL_LABEL[usuarioAtual.perfil] || usuarioAtual.perfil).toUpperCase(),
    acao: acao.label.toUpperCase(),
    statusAnterior: item.status,
    novoStatus: acao.novoStatus,
    obs: obs || ""
  };

  const updates = {
    status: acao.novoStatus,
    dataAtualizacao: new Date().toISOString(),
    historico: [...(item.historico || []), histEntry]
  };

  if (usuarioAtual.perfil === "gestao") {
    updates.observacaoGestor  = obs;
    updates.dataAnaliseGestor = new Date().toISOString();
    updates.gestorAnalise     = usuarioAtual.nome.toUpperCase();
    updates.decisaoGestor     = acao.label.toUpperCase();
  }
  if (usuarioAtual.perfil === "direcao") {
    updates.observacaoDirecao  = obs;
    updates.dataAnaliseDirecao = new Date().toISOString();
    updates.direcaoAnalise     = usuarioAtual.nome.toUpperCase();
    updates.decisaoDirecao     = acao.label.toUpperCase();
  }
  if (usuarioAtual.perfil === "rh") {
    updates.observacaoRh  = obs;
    updates.dataAnaliseRh = new Date().toISOString();
    updates.rhAnalise     = usuarioAtual.nome.toUpperCase();
    updates.decisaoRh     = acao.label.toUpperCase();
  }

  // ── Encaminhamento automático ao RH após decisão do gestor ───────────
  const decisoesGestorQueEncaminham = ["Aprovada pelo gestor", "Reprovada pelo gestor"];
  if (usuarioAtual.perfil === "gestao" && decisoesGestorQueEncaminham.includes(acao.novoStatus)) {
    const encaminharEntry = {
      data: new Date().toISOString(),
      usuario: "SISTEMA",
      perfil: "AUTOMÁTICO",
      acao: "ENCAMINHADA AO RH",
      statusAnterior: acao.novoStatus,
      novoStatus: "Encaminhada ao RH",
      obs: "Encaminhamento automático após decisão do gestor."
    };
    updates.status = "Encaminhada ao RH";
    updates.historico = [...updates.historico, encaminharEntry];
    updates.dataAtualizacao = new Date().toISOString();
  }

  solicitacoes[idx] = { ...item, ...updates };
  salvarLocal();
  fecharModal("modalDecisao");
  renderListagem();
  renderDashboard();
  mostrarToast("Decisão registrada com sucesso.");
}

// ── Detalhes ──────────────────────────────────────────────────────────────
function verDetalhes(id) {
  const item = solicitacoes.find(s => s.id === id);
  if (!item) return;
  if (!podeVerSolicitacao(usuarioAtual, item)) {
    mostrarToast("Acesso não permitido."); return;
  }
  idDetalhesAtual = id;
  document.getElementById("modalDetalhesTitulo").textContent = TIPO_INFO[item.tipo]?.titulo || "Detalhes";
  document.getElementById("modalDetalhesBody").innerHTML = gerarHTMLDetalhes(item);
  document.getElementById("modalDetalhes").classList.add("active");
}

function gerarHTMLDetalhes(item) {
  const d = item.dados || {};
  const hist = Array.isArray(item.historico) ? item.historico : [];
  const tipo = item.tipo;

  let camposHTML = "";

  if (tipo === "selecao" || tipo === "indicacao") {
    camposHTML = `
      ${tipo === "indicacao" ? det("Pessoa Indicada", d.nomeIndicada, "full") : ""}
      ${det("Cargo", d.cargo)} ${det("Tipo de Contrato", d.tipoContrato)}
      ${det("Horário", d.horario)} ${det("Salário", d.salario)}
      ${det("Setor / Cliente", d.setorCliente)} ${det("Departamento / Projeto", d.departamentoProjeto)}
      ${det("CNPJ (empresa)", d.cnpjEmpresa)} ${det("Número de vagas", d.numVagas)}
      ${det("Modalidade", d.modalidade)} ${det("Data de início", formatarData(d.dataInicio))}
      ${det("Tipo de Requisição", d.tipoRequisicao, "full")}
      <div class="detail-section-title full"><span>Benefícios</span></div>
      <div class="detail-item full"><div class="benef-chips">${(d.beneficios||[]).length ? d.beneficios.map(b=>`<span class="benef-chip">${b}</span>`).join("") : "<em style='color:var(--text-muted);font-size:.78rem'>Nenhum selecionado</em>"}</div></div>
      <div class="detail-section-title full"><span>Dados do Solicitante</span></div>
      ${det("Nome", d.solNome)} ${det("Cargo", d.solCargo)}
      <div class="detail-section-title full"><span>Perfil do Cargo</span></div>
      ${det("Formação acadêmica", d.formAcademica === "Outros" ? (d.formAcademicaOutro || "Outros") : d.formAcademica)}
      ${det("Conhecimentos indispensáveis", d.conhecimentos, "full")}
      ${det("Experiência desejada", d.experiencia, "full")}
      ${det("Observações gerais", d.observacoes, "full")}
    `;
  } else {
    const tipoMudExib = d.tipoMudanca === "Outra" ? (d.tipoMudancaOutro || "Outra") : d.tipoMudanca;
    camposHTML = `
      <div class="detail-section-title full"><span>Informações do Colaborador</span></div>
      ${det("Nome completo", d.nomeColaborador, "full")}
      ${det("Setor / Depto Atual", d.setorAtual)} ${det("Cargo Atual", d.cargoAtual)}
      ${det("Líder Atual", d.liderAtual)} ${det("Salário Atual", d.salarioAtual)}
      ${det("Horário Atual", d.horarioAtual)}
      <div class="detail-section-title full"><span>Mudança Solicitada</span></div>
      ${det("Cargo Novo", d.cargoNovo)} ${det("Setor Destino", d.setorDestino)}
      ${det("Novo Líder", d.novoLider)} ${det("Salário Novo", d.salarioNovo)}
      ${det("Horário Novo", d.horarioNovo)} ${det("Data Prevista", formatarData(d.dataMudanca))}
      ${det("Tipo de Mudança", tipoMudExib, "full")}
      <div class="detail-section-title full"><span>Benefícios</span></div>
      <div class="detail-item full"><div class="benef-chips">${(d.beneficios||[]).length ? d.beneficios.map(b=>`<span class="benef-chip">${b}</span>`).join("") : "<em style='color:var(--text-muted);font-size:.78rem'>Nenhum selecionado</em>"}</div></div>
      ${det("Justificativa", d.justificativa, "full")}
      <div class="detail-section-title full"><span>Dados do Responsável</span></div>
      ${det("Nome", d.respNome)} ${det("Cargo", d.respCargo)} ${det("Data", formatarData(d.respData))}
    `;
  }

  // Blocos de análise
  const blocoGestor = item.decisaoGestor ? `
    <div class="detail-section-title full"><span>Análise do Gestor</span></div>
    ${det("Gestor", item.gestorAnalise)} ${det("Decisão", item.decisaoGestor)}
    ${det("Data da análise", formatarDataHora(item.dataAnaliseGestor))}
    ${item.observacaoGestor ? det("Observação", item.observacaoGestor, "full") : ""}` : "";

  const blocoRh = item.decisaoRh ? `
    <div class="detail-section-title full"><span>Análise do RH</span></div>
    ${det("Decisão", item.decisaoRh)} ${det("Data da análise", formatarDataHora(item.dataAnaliseRh))}
    ${item.observacaoRh ? det("Observação", item.observacaoRh, "full") : ""}` : "";

  const blocoDirecao = item.decisaoDirecao ? `
    <div class="detail-section-title full"><span>Análise da Direção</span></div>
    ${det("Decisão", item.decisaoDirecao)} ${det("Data da análise", formatarDataHora(item.dataAnaliseDirecao))}
    ${item.observacaoDirecao ? det("Observação", item.observacaoDirecao, "full") : ""}` : "";

  // Histórico timeline
  const historicoHTML = hist.length
    ? `<div class="hist-timeline">${hist.map(h => `
        <div class="hist-entry">
          <div class="hist-meta">
            <span class="hist-user">${esc(h.usuario || "Sistema")}</span>
            ${h.perfil ? `<span class="hist-perfil-tag">${esc(h.perfil)}</span>` : ""}
            <span class="hist-data">${formatarDataHora(h.data)}</span>
          </div>
          <div class="hist-acao">${esc(h.acao)}</div>
          ${h.statusAnterior ? `<div class="hist-flow">
            <span class="hist-de">${esc(h.statusAnterior)}</span>
            <span class="hist-arrow">→</span>
            <span class="hist-para">${esc(h.novoStatus)}</span>
          </div>` : ""}
          ${h.obs ? `<div class="hist-obs">${esc(h.obs)}</div>` : ""}
        </div>`).join("")}</div>`
    : "<p style='color:var(--text-muted);font-size:.78rem'>Sem histórico registrado.</p>";

  return `<div class="detail-grid">
    <div class="detail-section-title full"><span>Identificação</span></div>
    ${det("Nº da Solicitação", item.id)} ${det("Tipo", TIPO_INFO[item.tipo]?.label)}
    ${det("Solicitante", item.criadoPor || item.criadoPorNome)} ${det("Status", statusBadge(item.status))}
    ${det("Setor", item.setorResponsavel)} ${det("Gestor responsável", item.gestorResponsavel)}
    ${det("Data de criação", formatarDataHora(item.dataCriacao))} ${det("Última atualização", formatarDataHora(item.dataAtualizacao))}
    ${camposHTML}
    ${blocoGestor}${blocoRh}${blocoDirecao}
    <div class="detail-section-title full"><span>Histórico de Movimentação</span></div>
    <div class="detail-item full">${historicoHTML}</div>
  </div>`;
}

function det(label, valor, extra) {
  return `<div class="detail-item ${extra||""}"><span>${label}</span><strong>${valor||"-"}</strong></div>`;
}

// ── Listagem ──────────────────────────────────────────────────────────────
function renderFiltroOrigem() {
  const wrap = document.getElementById("filtroOrigemWrap");
  if (!wrap) return;
  if (usuarioAtual.perfil !== "gestao") {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const opts = [
    { valor: "",         label: "Todas"                    },
    { valor: "propria",  label: "Minhas Solicitações"      },
    { valor: "liderados",label: "Solicitações dos Liderados"}
  ];
  wrap.innerHTML = opts.map(o => `
    <button class="filtro-origem-pill${filtroOrigem === o.valor ? " active" : ""}"
      data-origem="${o.valor}">${o.label}</button>`).join("");
  wrap.querySelectorAll(".filtro-origem-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      filtroOrigem = btn.dataset.origem;
      paginaAtual = 1;
      renderListagem();
    });
  });
}

function renderListagem() {
  renderFiltroOrigem();
  populateFiltros();
  const lista = listaFiltrada();
  const porPagina = Number(document.getElementById("perPage").value) || 20;
  const totalPags = Math.max(1, Math.ceil(lista.length / porPagina));
  if (paginaAtual > totalPags) paginaAtual = totalPags;

  const inicio = (paginaAtual - 1) * porPagina;
  const pagina = lista.slice(inicio, inicio + porPagina);
  const tbody = document.getElementById("tabelaBody");
  const empty = document.getElementById("emptyState");

  tbody.innerHTML = "";
  pagina.forEach(item => {
    const d = item.dados || {};
    const cargoVaga = d.cargo || d.cargoNovo || "-";
    const projetoDepto = d.departamentoProjeto || d.setorDestino || d.setorCliente || "-";
    const solicitante = item.criadoPor || item.criadoPorNome || "-";

    const acoesDisp = getAcoesDisponiveis(usuarioAtual, item);
    let acoes = `<button class="btn-icon" title="Visualizar" onclick="verDetalhes('${item.id}')">◉</button>`;
    if (acoesDisp.length > 0) {
      acoes += `<button class="btn-icon btn-icon-status" title="Registrar decisão" onclick="abrirModalDecisao('${item.id}')">⟳</button>`;
    }
    if (["rh","direcao"].includes(usuarioAtual.perfil)) {
      acoes += `<button class="btn-icon btn-icon-danger" title="Excluir" onclick="abrirModalExcluir('${item.id}')">✕</button>`;
    }
    if (podeEditarLider(item)) {
      acoes += `<button class="btn-icon" title="Editar" onclick="editarSolicitacao('${item.id}')">✎</button>`;
    }

    tbody.innerHTML += `<tr>
      <td><span class="id-cell">${item.id}</span></td>
      <td>${tipoBadge(item.tipo)}</td>
      <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(solicitante)}">${esc(solicitante)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(cargoVaga)}">${esc(cargoVaga)}</td>
      <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(projetoDepto)}">${esc(projetoDepto)}</td>
      <td>${statusBadge(item.status)}</td>
      <td style="white-space:nowrap;font-size:.75rem">${formatarData(item.dataCriacao)}</td>
      <td style="white-space:nowrap;font-size:.75rem">${formatarData(item.dataAtualizacao)}</td>
      <td><div class="table-actions">${acoes}</div></td>
    </tr>`;
  });

  empty.classList.toggle("visible", lista.length === 0);
  document.getElementById("paginationInfo").textContent = lista.length
    ? `${inicio + 1}–${Math.min(inicio + porPagina, lista.length)} de ${lista.length}`
    : "0 registros";
  document.getElementById("pageNumber").textContent = paginaAtual;
  document.getElementById("prevPage").disabled = paginaAtual <= 1;
  document.getElementById("nextPage").disabled = paginaAtual >= totalPags;
}

function populateFiltros() {
  const lista = minhaLista();

  // Solicitantes permitidos conforme perfil
  const elSol = document.getElementById("filtroSolicitante");
  if (elSol) {
    const val = elSol.value;
    const solicitantes = [...new Set(lista.map(s => s.criadoPor || s.criadoPorNome).filter(Boolean))].sort();
    elSol.innerHTML = `<option value="">Solicitante</option>` +
      solicitantes.map(s => `<option value="${esc(s)}" ${s===val?"selected":""}>${esc(s)}</option>`).join("");
  }

  // Gestor — visível apenas para rh e direcao
  const elGest = document.getElementById("filtroGestorResp");
  if (elGest) {
    if (["rh","direcao"].includes(usuarioAtual.perfil)) {
      const val = elGest.value;
      const gestores = [...new Set(lista.map(s => s.gestorResponsavel).filter(Boolean))].sort();
      elGest.innerHTML = `<option value="">Gestor</option>` +
        gestores.map(g => `<option value="${esc(g)}" ${g===val?"selected":""}>${esc(g)}</option>`).join("");
      elGest.closest(".filtro-item")?.style.removeProperty("display");
    } else {
      elGest.closest(".filtro-item")?.setAttribute("style","display:none");
    }
  }

  // Setor
  const elSet = document.getElementById("filtroSetorSol");
  if (elSet) {
    const val = elSet.value;
    const setores = [...new Set(lista.map(s => s.setorResponsavel).filter(Boolean))].sort();
    elSet.innerHTML = `<option value="">Setor</option>` +
      setores.map(s => `<option value="${esc(s)}" ${s===val?"selected":""}>${esc(s)}</option>`).join("");
  }
}

function listaFiltrada() {
  const busca = (document.getElementById("buscaLista")?.value || "").toLowerCase();
  const fTipo = document.getElementById("filtroTipoSol")?.value || "";
  const fSol  = document.getElementById("filtroSolicitante")?.value || "";
  const fGest = document.getElementById("filtroGestorResp")?.value || "";
  const fSet  = document.getElementById("filtroSetorSol")?.value || "";
  const fData = document.getElementById("filtroDataCriacao")?.value || "";

  return minhaLista().filter(item => {
    const d = item.dados || {};
    const criador = item.criadoPor || item.criadoPorNome || "";
    const texto = [item.id, criador, d.cargo, d.cargoNovo, d.setorCliente,
      d.departamentoProjeto, d.nomeColaborador, d.setorDestino, TIPO_INFO[item.tipo]?.label
    ].filter(Boolean).join(" ").toLowerCase();
    const dataItem = (item.dataCriacao || "").slice(0, 10);

    // Filtro de origem para gestores
    const origemOk = (() => {
      if (filtroOrigem === "" || usuarioAtual.perfil !== "gestao") return true;
      if (filtroOrigem === "propria")   return criador === usuarioAtual.nome;
      if (filtroOrigem === "liderados") return (usuarioAtual.lideresVinculados || []).includes(criador);
      return true;
    })();

    return origemOk
      && (!filtroStatus || item.status === filtroStatus)
      && (!fTipo || item.tipo === fTipo)
      && (!fSol  || criador === fSol)
      && (!fGest || (item.gestorResponsavel || "") === fGest)
      && (!fSet  || (item.setorResponsavel || "") === fSet)
      && (!fData || dataItem === fData)
      && (!busca || texto.includes(busca));
  });
}

function minhaLista() {
  if (!usuarioAtual) return [];
  return solicitacoes.filter(s => podeVerSolicitacao(usuarioAtual, s));
}

// ── Organograma — estado ──────────────────────────────────────────────────
let _orgGestores        = [];
let _orgLideres         = [];
let _orgEditGestorId    = null;
let _orgEditLiderId     = null;
let _orgAddLiderGestId  = null;
let _orgDelGestorId     = null;
let _orgDelLiderId      = null;

async function renderOrganograma() {
  const el = document.getElementById("orgContent");
  if (!el) return;
  el.innerHTML = `<div class="org-loading">Carregando organograma...</div>`;

  const [gestores, lideres] = await Promise.all([
    sbCarregarGestores(),
    sbCarregarLideres()
  ]);

  // Fallback para dados estáticos se as tabelas ainda não existirem
  if (gestores.length === 0 && lideres.length === 0) {
    _orgGestores = usuarios
      .filter(u => u.perfil === "gestao")
      .map(u => ({ id: u.nome, nome: u.nome, setor: u.setor }));
    _orgLideres = usuarios
      .filter(u => u.perfil === "lider")
      .map(u => ({ id: u.nome, nome: u.nome, setor: u.setor, gestor_id: u.gestor }));
  } else {
    _orgGestores = gestores;
    _orgLideres  = lideres;
  }

  renderOrganogramaUI();
}

function renderOrganogramaUI() {
  const el = document.getElementById("orgContent");
  if (!el) return;

  const canAdmin = ["rh", "direcao"].includes(usuarioAtual.perfil);

  // ── LÍDER: card "Meu Gestor" ──────────────────────────────────────────
  if (usuarioAtual.perfil === "lider") {
    el.innerHTML = `
      <div class="org-meu-gestor">
        <div class="org-meu-gestor-hero">
          <p class="org-meu-gestor-eyebrow">Organograma</p>
          <h2 class="org-meu-gestor-title">Meu Gestor</h2>
        </div>
        <div class="org-meu-gestor-body">
          <div class="org-meu-gestor-group">
            <span class="org-meu-gestor-group-label">Gestor responsável</span>
            <span class="org-meu-gestor-group-value">${esc(usuarioAtual.gestor || "—")}</span>
          </div>
          <div class="org-meu-gestor-divider"></div>
          <div class="org-meu-gestor-group">
            <span class="org-meu-gestor-group-label">Setor</span>
            <span class="org-meu-gestor-group-value">${esc(usuarioAtual.setor || "—")}</span>
          </div>
        </div>
      </div>`;
    return;
  }

  // ── GESTÃO: apenas o próprio grupo (somente visualização) ─────────────
  let gestores = [..._orgGestores];
  if (usuarioAtual.perfil === "gestao") {
    gestores = gestores.filter(g => g.nome === usuarioAtual.nome);
  }

  if (!gestores.length) {
    el.innerHTML = `<p style="color:var(--text-muted);padding:1rem">Nenhum gestor encontrado.</p>`;
    return;
  }

  const adminHeaderHTML = canAdmin
    ? `<div class="org-admin-header">
        <button class="btn btn-primary" onclick="abrirModalNovoGestor()">+ Novo Gestor</button>
      </div>`
    : "";

  const accordionsHTML = gestores.map((g, i) => {
    const meuLideres = _orgLideres.filter(l => l.gestor_id === g.id);
    const n = meuLideres.length;
    const countTxt = n === 1 ? "1 líder vinculado" : `${n} líderes vinculados`;

    const leadersHTML = n
      ? meuLideres.map(l => `
          <div class="acc-leader-row">
            <span class="acc-leader-dot">•</span>
            <span class="acc-leader-name">${esc(l.nome)}</span>
            ${canAdmin ? `<div class="acc-leader-admin">
              <button class="btn-org-leader btn-org-leader-edit" title="Editar líder"
                onclick="abrirModalEditarLider('${esc(String(l.id))}')">✏</button>
              <button class="btn-org-leader btn-org-leader-delete" title="Excluir líder"
                onclick="abrirModalExcluirLider('${esc(String(l.id))}')">✕</button>
            </div>` : ""}
          </div>`).join("")
      : `<em style="color:var(--text-muted);font-size:.78rem">Nenhum líder vinculado.</em>`;

    const adminFooterHTML = canAdmin
      ? `<div class="acc-admin-footer">
          <button class="btn-org-action btn-org-add"
            onclick="abrirModalAdicionarLider('${esc(String(g.id))}')">➕ Adicionar Líder</button>
          <button class="btn-org-action btn-org-edit"
            onclick="abrirModalEditarGestor('${esc(String(g.id))}')">✏ Editar</button>
          <button class="btn-org-action btn-org-delete"
            onclick="abrirModalExcluirGestor('${esc(String(g.id))}')">🗑 Excluir</button>
        </div>`
      : "";

    return `
      <div class="acc-item" id="acc-${i}">
        <button class="acc-header" onclick="toggleAcc(${i})">
          <div class="acc-header-left">
            <span class="acc-name">${esc(g.nome)}</span>
            <span class="acc-setor">Setor: ${esc(g.setor)}</span>
            <span class="acc-count">${countTxt}</span>
          </div>
          <span class="acc-chevron">▼</span>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="acc-leaders">${leadersHTML}</div>
            ${adminFooterHTML}
          </div>
        </div>
      </div>`;
  }).join("");

  el.innerHTML = adminHeaderHTML + `<div class="acc-wrapper">${accordionsHTML}</div>`;
}

function toggleAcc(idx) {
  const item = document.getElementById("acc-" + idx);
  if (!item) return;
  const body = item.querySelector(".acc-body");
  const nowOpen = !item.classList.contains("open");
  item.classList.toggle("open", nowOpen);
  if (body) body.classList.toggle("open", nowOpen);
}

// ── Org: Gestor — Novo ────────────────────────────────────────────────────
function abrirModalNovoGestor() {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  document.getElementById("orgGestorNome").value = "";
  document.getElementById("orgGestorSetor").value = "";
  document.getElementById("modalNovoGestor").classList.add("active");
  document.getElementById("orgGestorNome").focus();
}

async function salvarNovoGestor() {
  const nome  = document.getElementById("orgGestorNome").value.trim();
  const setor = document.getElementById("orgGestorSetor").value.trim();
  if (!nome)  { mostrarToast("Informe o nome do gestor."); return; }
  if (!setor) { mostrarToast("Informe o setor."); return; }
  const btn = document.getElementById("btnSalvarNovoGestor");
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    await sbCriarGestor(nome, setor);
    fecharModal("modalNovoGestor");
    mostrarToast("Gestor criado com sucesso.");
    await renderOrganograma();
  } catch(e) {
    mostrarToast("Erro ao salvar gestor. Verifique a conexão.");
    console.error("[org] salvarNovoGestor:", e);
  } finally {
    btn.disabled = false; btn.textContent = "Salvar";
  }
}

// ── Org: Gestor — Editar ──────────────────────────────────────────────────
function abrirModalEditarGestor(id) {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  const g = _orgGestores.find(x => String(x.id) === String(id));
  if (!g) return;
  _orgEditGestorId = id;
  document.getElementById("editGestorId").value  = id;
  document.getElementById("editGestorNome").value = g.nome;
  document.getElementById("editGestorSetor").value = g.setor;
  document.getElementById("modalEditarGestor").classList.add("active");
  document.getElementById("editGestorNome").focus();
}

async function salvarEditarGestor() {
  const id    = _orgEditGestorId;
  const nome  = document.getElementById("editGestorNome").value.trim();
  const setor = document.getElementById("editGestorSetor").value.trim();
  if (!nome)  { mostrarToast("Informe o nome."); return; }
  if (!setor) { mostrarToast("Informe o setor."); return; }
  try {
    await sbEditarGestor(id, nome, setor);
    fecharModal("modalEditarGestor");
    mostrarToast("Gestor atualizado com sucesso.");
    await renderOrganograma();
  } catch(e) {
    mostrarToast("Erro ao atualizar gestor.");
    console.error("[org] salvarEditarGestor:", e);
  }
}

// ── Org: Gestor — Excluir ─────────────────────────────────────────────────
function abrirModalExcluirGestor(id) {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  _orgDelGestorId = id;
  document.getElementById("excluirGestorId").value = id;
  document.getElementById("modalExcluirGestor").classList.add("active");
}

async function confirmarExcluirGestor() {
  const id = _orgDelGestorId;
  if (!id) return;
  try {
    await sbExcluirGestor(id);
    fecharModal("modalExcluirGestor");
    mostrarToast("Gestor excluído.");
    await renderOrganograma();
  } catch(e) {
    mostrarToast("Erro ao excluir gestor.");
    console.error("[org] confirmarExcluirGestor:", e);
  }
}

// ── Org: Líder — Adicionar ────────────────────────────────────────────────
function abrirModalAdicionarLider(gestorId) {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  _orgAddLiderGestId = gestorId;
  document.getElementById("addLiderGestorId").value = gestorId;
  document.getElementById("addLiderNome").value = "";
  document.getElementById("addLiderSetor").value = "";
  document.getElementById("modalAdicionarLider").classList.add("active");
  document.getElementById("addLiderNome").focus();
}

async function salvarAdicionarLider() {
  const gestorId = _orgAddLiderGestId;
  const nome  = document.getElementById("addLiderNome").value.trim();
  const setor = document.getElementById("addLiderSetor").value.trim();
  if (!nome)  { mostrarToast("Informe o nome do líder."); return; }
  if (!setor) { mostrarToast("Informe o setor."); return; }
  try {
    await sbCriarLider(nome, setor, gestorId);
    fecharModal("modalAdicionarLider");
    mostrarToast("Líder adicionado com sucesso.");
    await renderOrganograma();
  } catch(e) {
    mostrarToast("Erro ao adicionar líder.");
    console.error("[org] salvarAdicionarLider:", e);
  }
}

// ── Org: Líder — Editar ───────────────────────────────────────────────────
function abrirModalEditarLider(id) {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  const l = _orgLideres.find(x => String(x.id) === String(id));
  if (!l) return;
  _orgEditLiderId = id;
  document.getElementById("editLiderId").value    = id;
  document.getElementById("editLiderNome").value  = l.nome;
  document.getElementById("editLiderSetor").value = l.setor;
  const sel = document.getElementById("editLiderGestorId");
  sel.innerHTML = _orgGestores.map(g =>
    `<option value="${esc(String(g.id))}" ${String(g.id) === String(l.gestor_id) ? "selected" : ""}>${esc(g.nome)}</option>`
  ).join("");
  document.getElementById("modalEditarLider").classList.add("active");
  document.getElementById("editLiderNome").focus();
}

async function salvarEditarLider() {
  const id       = _orgEditLiderId;
  const nome     = document.getElementById("editLiderNome").value.trim();
  const setor    = document.getElementById("editLiderSetor").value.trim();
  const gestorId = document.getElementById("editLiderGestorId").value;
  if (!nome)     { mostrarToast("Informe o nome."); return; }
  if (!setor)    { mostrarToast("Informe o setor."); return; }
  if (!gestorId) { mostrarToast("Selecione o gestor responsável."); return; }
  try {
    await sbEditarLider(id, nome, setor, gestorId);
    fecharModal("modalEditarLider");
    mostrarToast("Líder atualizado com sucesso.");
    await renderOrganograma();
  } catch(e) {
    mostrarToast("Erro ao atualizar líder.");
    console.error("[org] salvarEditarLider:", e);
  }
}

// ── Org: Líder — Excluir ──────────────────────────────────────────────────
function abrirModalExcluirLider(id) {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  _orgDelLiderId = id;
  document.getElementById("excluirLiderId").value = id;
  document.getElementById("modalExcluirLider").classList.add("active");
}

async function confirmarExcluirLider() {
  const id = _orgDelLiderId;
  if (!id) return;
  try {
    await sbExcluirLider(id);
    fecharModal("modalExcluirLider");
    mostrarToast("Líder excluído.");
    await renderOrganograma();
  } catch(e) {
    mostrarToast("Erro ao excluir líder.");
    console.error("[org] confirmarExcluirLider:", e);
  }
}

// ── Utilitários ───────────────────────────────────────────────────────────
function gerarId() {
  const max = solicitacoes.length
    ? Math.max(...solicitacoes.map(s => parseInt(String(s.id).replace("RH-", "")) || 0))
    : 0;
  return "RH-" + String(max + 1).padStart(4, "0");
}

function salvarLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solicitacoes));
}

function carregarLocal() {
  try {
    solicitacoes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch(e) {
    solicitacoes = [];
  }
}

function mostrarToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

function fecharModal(id) {
  document.getElementById(id)?.classList.remove("active");
}

function statusBadge(status) {
  const cls = {
    "Aguardando análise do gestor": "status-aguard",
    "Aprovada pelo gestor":         "status-aprov-gest",
    "Reprovada pelo gestor":        "status-reprov",
    "Encaminhada ao RH":            "status-encaminhada",
    "Em análise pelo RH":           "status-analise-rh",
    "Aprovada pelo RH":             "status-aprov-rh",
    "Reprovada pelo RH":            "status-reprov",
    "Aprovada pela Direção":        "status-aprov-dir",
    "Reprovada pela Direção":       "status-reprov",
    "Devolvida para ajuste":        "status-devolvida",
    "Finalizada":                   "status-finalizada"
  };
  return `<span class="status-badge ${cls[status]||"status-aguard"}">${status||"Aguardando análise do gestor"}</span>`;
}

function tipoBadge(tipo) {
  const info = TIPO_INFO[tipo];
  if (!info) return tipo;
  return `<span style="font-size:.7rem;color:var(--text-secondary)">${info.label}</span>`;
}

function formatarData(d) {
  if (!d || typeof d !== "string") return "-";
  const dt = d.length > 10 ? new Date(d) : new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("pt-BR");
}

function formatarDataHora(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleString("pt-BR");
}

function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function mascaraReais(el) {
  let raw = el.value.replace(/\D/g, "");
  if (!raw) { el.value = ""; return; }
  const cents = parseInt(raw, 10);
  const reais = cents / 100;
  el.value = reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function v(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function uv(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  const type = el.type || "";
  if (type === "date" || type === "number" || type === "email" || el.classList.contains("mask-real")) {
    return el.value.trim();
  }
  return el.value.trim().toUpperCase();
}

// ── Listeners ─────────────────────────────────────────────────────────────
function vincularListeners() {
  // Login
  document.getElementById("btnEntrar").addEventListener("click", () => login());
  document.getElementById("inputCodigo").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

  // Logout — abre modal de confirmação
  document.getElementById("btnSair").addEventListener("click", () => {
    document.getElementById("modalSair").classList.add("active");
  });
  document.getElementById("btnConfirmarSair").addEventListener("click", () => {
    fecharModal("modalSair");
    logout();
  });

  // Nav items
  document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
    btn.addEventListener("click", () => mostrarView(btn.dataset.view));
  });

  // Tipo cards
  document.querySelectorAll(".tipo-card[data-tipo]").forEach(card => {
    card.addEventListener("click", () => abrirFormPorTipo(card.dataset.tipo));
  });

  // Form actions
  document.getElementById("btnVoltarForm").addEventListener("click", () => mostrarView(formOrigin));
  document.getElementById("btnSalvarForm").addEventListener("click", salvarSolicitacao);
  document.getElementById("btnLimparForm").addEventListener("click", () => {
    if (confirm("Limpar todos os campos?")) renderFormPorTipo(tipoFormAtual, null);
  });

  // Modal sucesso
  document.getElementById("btnSucessoOk").addEventListener("click", () => {
    fecharModal("modalSucesso");
    mostrarView(formOrigin);
  });

  // Modal decisão
  document.getElementById("btnConfirmarDecisao").addEventListener("click", salvarDecisao);

  // Excluir modal
  document.getElementById("btnConfirmarExcluir").addEventListener("click", confirmarExcluir);

  // Filter pills
  document.querySelectorAll(".filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      filtroStatus = btn.dataset.status || "";
      paginaAtual = 1;
      renderListagem();
    });
  });

  // Search
  document.getElementById("buscaLista").addEventListener("input", () => { paginaAtual = 1; renderListagem(); });

  // Filtros avançados
  ["filtroTipoSol","filtroSolicitante","filtroGestorResp","filtroSetorSol","filtroDataCriacao"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => { paginaAtual = 1; renderListagem(); });
  });
  document.getElementById("btnLimparFiltros")?.addEventListener("click", () => {
    ["filtroTipoSol","filtroSolicitante","filtroGestorResp","filtroSetorSol","filtroDataCriacao"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    paginaAtual = 1;
    renderListagem();
  });

  // Paginação
  document.getElementById("prevPage").addEventListener("click", () => { paginaAtual--; renderListagem(); });
  document.getElementById("nextPage").addEventListener("click", () => { paginaAtual++; renderListagem(); });
  document.getElementById("perPage").addEventListener("change", () => { paginaAtual = 1; renderListagem(); });

  // Fechar modais ao clicar fora
  document.querySelectorAll(".modal-overlay").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) m.classList.remove("active"); });
  });

  // Fechar com Escape
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────
init();
