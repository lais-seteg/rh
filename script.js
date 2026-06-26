// ── Constantes ───────────────────────────────────────────────────────────
const STORAGE_KEY = "portalRH_v3";

const CLOCKIFY_API_KEY = 'ODUwOThjOTUtYmJlNS00Nzg5LWI3NmYtYzRjYjZlZGE3NDIw';
const CLOCKIFY_BASE_URL = 'https://api.clockify.me/api/v1';
let projetosClockify = [];
let _tabelaSalarial = [];
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

// [ALTERADO] Benefícios reordenados conforme especificação
const BENS = [
  { id: "va", label: "Vale Alimentação (Cartão Caju)" },
  { id: "vt", label: "Vale Transporte (VT)" },
  { id: "po", label: "Plano Odontológico" },
  { id: "do", label: "Day Off de Aniversário" },
  { id: "am", label: "Auxílio Mobilidade" },
  { id: "ps", label: "Plano de Saúde" },
  { id: "sv", label: "Seguro de Vida" },
  { id: "ac", label: "Ajuda de Custo (Moradia)" }
];

const STATUS_LIST = [
  "Aguardando análise do gestor",
  "Reprovada pelo gestor",
  "Encaminhada ao RH",
  "Em análise pelo RH",
  "Seleção em andamento",
  "Finalizada"
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
let formOrigin = "solicitacoes";
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
    if (s === "Aguardando análise do gestor") return ["aprovar", "reprovar"];
    return [];
  }

  if (p === "rh") {
    if (s === "Encaminhada ao RH")     return ["analise"];
    if (s === "Em análise pelo RH")    return ["selecao", "finalizar"];
    if (s === "Seleção em andamento")  return ["finalizar"];
    return [];
  }

  if (p === "direcao") {
    if (s === "Aguardando análise do gestor") return ["aprovar", "reprovar"];
    if (s === "Encaminhada ao RH")            return ["analise"];
    if (s === "Em análise pelo RH")           return ["selecao", "finalizar"];
    if (s === "Seleção em andamento")         return ["finalizar"];
    return [];
  }

  return [];
}

// ── Init ─────────────────────────────────────────────────────────────────

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
  document.documentElement.removeAttribute('data-theme');
}

function mostrarApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  applyTheme(localStorage.getItem('sgrh_theme') || 'light');
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
  dashboard:     "Dashboard",
  solicitacoes:  "Solicitações",
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
  // Foca o primeiro campo editável do formulário
  setTimeout(() => {
    const fb = document.getElementById("formBody");
    const primeiro = fb && fb.querySelector("input:not([type=hidden]):not([readonly]):not([disabled]), select:not([disabled])");
    if (primeiro) primeiro.focus();
  }, 80);
}

// ── Dashboard ────────────────────────────────────────────────────────────
function renderDashboard() {
  dashPagina = 1;
  const lista = minhaLista();
  dashLista = [...lista].sort((a,b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));

  const KPI_DEFS = [
    { label: "Total",           icon: "⊟", classe: "",              desc: "registradas",          count: lista.length },
    { label: "Aguard. Gestor",  icon: "⏱", classe: "kpi-fila",      desc: "aguardando o gestor",  count: lista.filter(s=>s.status==="Aguardando análise do gestor").length },
    { label: "Enc. ao RH",      icon: "→", classe: "kpi-rh",        desc: "encaminhadas ao RH",   count: lista.filter(s=>s.status==="Encaminhada ao RH").length },
    { label: "Análise RH",      icon: "⊙", classe: "kpi-analise",   desc: "em análise pelo RH",   count: lista.filter(s=>s.status==="Em análise pelo RH").length },
    { label: "Em Seleção",      icon: "▶", classe: "kpi-selecao",   desc: "seleção em andamento", count: lista.filter(s=>s.status==="Seleção em andamento").length },
    { label: "Reprovadas",      icon: "✕", classe: "kpi-reprovado", desc: "reprovadas pelo gestor",count: lista.filter(s=>s.status==="Reprovada pelo gestor").length },
    { label: "Finalizadas",     icon: "◉", classe: "kpi-finalizada",desc: "concluídas",           count: lista.filter(s=>s.status==="Finalizada").length }
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
      <div class="dash-welcome-spacer"></div>
      <button class="theme-toggle" id="themeToggleDash" title="Alternar tema claro/escuro" onclick="toggleTheme(); sincronizarThemeToggleDash()">
        <div class="theme-toggle-slider" id="themeSliderDash"></div>
      </button>
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
  sincronizarThemeToggleDash();
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
      <th>Status</th><th>Criado em</th><th>Atualizado</th><th>Ações</th>
    </tr></thead>
    <tbody>${pagina.map(item => `<tr>
      <td><span class="id-cell">${item.id}</span></td>
      <td><span class="dash-tipo-label">${TIPO_INFO[item.tipo]?.label || item.tipo}</span></td>
      <td class="dash-td-criador">${esc(item.criadoPor || item.criadoPorNome || "—")}</td>
      <td>${statusBadge(item.status)}</td>
      <td class="dash-td-data">${formatarData(item.dataCriacao)}</td>
      <td class="dash-td-data">${formatarData(item.dataAtualizacao)}</td>
      <td><div class="table-actions">${gerarBotoesAcaoItem(item)}</div></td>
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
  formOrigin = "solicitacoes";
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

const CARGOS_RH = [
  "ANALISTA ADMINISTRATIVO","ANALISTA AMBIENTAL","ANALISTA DE DEPARTAMENTO PESSOAL",
  "ANALISTA DE INOVAÇÃO","ANALISTA DE RH","ASSISTENTE ADMINISTRATIVO","ASSISTENTE AMBIENTAL",
  "ASSISTENTE DE COMPRAS","ASSISTENTE DE COMUNICAÇÃO","ASSISTENTE FINANCEIRO",
  "AUXILIAR OPERACIONAL DE SERVIÇOS DIVERSOS","CEO","COORDENADOR(A) BIÓTICO",
  "COORDENADOR(A) DE LICENCIAMENTO","COORDENADOR(A) FINANCEIRO","COORDENADOR(A) GEOAMBIENTAL",
  "DIRETOR DE INOVAÇÃO","DIRETOR DE PROJETOS","ESTAGIÁRIO(A)",
  "GERENTE ADMINISTRATIVO FINANCEIRO","GERENTE EXECUTIVO(A)","HEAD DE LICENCIAMENTO"
];

// [ALTERADO] Formulário de Seleção/Indicação reestruturado com novos campos obrigatórios
function htmlFormSelecaoIndicacao(tipo, dados) {
  const d = dados || {};
  const ind = tipo === "indicacao";
  const sel = (field, opts, val) =>
    `<select id="${field}" class="form-control"><option value="">Selecione</option>${opts.map(o=>`<option ${val===o?"selected":""}>${o}</option>`).join("")}</select>`;

  const localVal       = (d.localTrabalho || "").toUpperCase();
  const isExterno      = localVal.includes("EXTERNO");
  const isSede         = localVal.includes("SEDE");
  const canSeeSalario  = ["rh","direcao"].includes(usuarioAtual?.perfil);

  return `
  <!-- [ALTERADO] Seção 1 — adicionados campos: Setor e Salário -->
  <div class="form-section-block">
    <h3 class="form-subtitle">1. Informações da Vaga</h3>
    <div class="form-grid">
      ${ind ? `<div class="form-group full-width">
        <label class="form-label required">Nome da pessoa indicada</label>
        <input id="f_nomeIndicada" class="form-control" value="${esc(d.nomeIndicada)}" />
      </div>` : ""}
      <div class="form-group">
        <label class="form-label required">Cargo</label>
        <select id="f_cargo" class="form-control">
          <option value="">Selecione</option>
          ${CARGOS_RH.map(c=>`<option ${(d.cargo||"").toUpperCase()===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label required">Setor</label>
        <input id="f_setor" class="form-control" placeholder="Ex: Projetos, Inovação, Financeiro..." value="${esc(d.setor)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Tipo de contrato</label>
        ${sel("f_tipoContrato",["CLT","PJ","Estágio","Horista"],d.tipoContrato)}
      </div>
      ${canSeeSalario ? `
      <div class="form-group">
        <label class="form-label required">Salário</label>
        <input id="f_salario" class="form-control mask-real" placeholder="R$ 0,00" value="${esc(d.salario)}" />
      </div>` : `<input type="hidden" id="f_salario" value="${esc(d.salario)}" />`}
      <div class="form-group">
        <label class="form-label required">Local de trabalho</label>
        ${sel("f_localTrabalho",["Sede","Externo / Campo"],d.localTrabalho)}
      </div>
      <!-- [ALTERADO] Info horário padrão para SEDE — somente leitura -->
      <div class="form-group" id="infoJornadaSede" style="display:${isSede?"":"none"}">
        <label class="form-label">Jornada / Horário (padrão Sede)</label>
        <div class="jornada-sede-info">
          <span class="jornada-sede-icone">🕗</span>
          <span>08:00 às 17:00 — definido automaticamente (não editável)</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Projeto (Clockify)</label>
        <div class="clockify-input-wrapper">
          <input id="f_nomeProjetoClockify" class="form-control" placeholder="Buscar projeto..." value="${esc(d.nomeProjetoClockify)}" autocomplete="off" />
          <div class="clockify-suggestions" id="clockifySuggestionsRH"></div>
        </div>
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
        <label class="form-label">Data de início prevista</label>
        <input id="f_dataInicio" class="form-control" type="date" value="${esc(d.dataInicio)}" />
      </div>
      <div class="form-group full-width">
        <label class="form-label required">Tipo de requisição</label>
        ${sel("f_tipoRequisicao",["Substituição","Aumento de Quadro","Licença/Afastamento","Quadro Extra/Temporário"],d.tipoRequisicao)}
      </div>
    </div>
  </div>

  <!-- [ALTERADO] Seção Jornada e Benefícios — exibida somente quando Local = EXTERNO -->
  <div class="form-section-block" id="grupoJornadaBeneficios" style="display:${isExterno?"":"none"}">
    <h3 class="form-subtitle">2. Jornada e Benefícios</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label required">Jornada / Horário de Trabalho</label>
        <input id="f_jornada" class="form-control" placeholder="Ex: 08:00 às 18:00, Segunda a Sexta" value="${esc(d.jornada)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Quantidade de horas semanais</label>
        <input id="f_horasSemana" class="form-control" type="number" min="1" max="60" placeholder="Ex: 44" value="${esc(d.horasSemana)}" />
      </div>
      <div class="form-group full-width">
        <label class="form-label">Benefícios</label>
        ${htmlBeneficiosCheckboxes(d.beneficios, true)}
      </div>
    </div>
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">3. Perfil do Cargo Solicitado</h3>
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
        <label class="form-label required">Conhecimentos indispensáveis</label>
        <textarea id="f_conhecimentos" class="form-control" rows="3">${esc(d.conhecimentos)}</textarea>
      </div>
      <div class="form-group full-width">
        <label class="form-label required">Experiência desejada</label>
        <textarea id="f_experiencia" class="form-control" rows="3">${esc(d.experiencia)}</textarea>
      </div>
      <div class="form-group full-width">
        <label class="form-label">Observações gerais</label>
        <textarea id="f_observacoes" class="form-control" rows="3">${esc(d.observacoes)}</textarea>
      </div>
    </div>
  </div>`;
}

// [ALTERADO] Formulário de Mudança de Cargo — campos reestruturados conforme especificação
// Removidos: Cargo proposto, Tipo de mudança, Horário após mudança, Tabela de benefícios
// Adicionados: Setor de Destino, Departamento de Destino, Novo Líder Imediato, Salário, Data Prevista
function htmlFormMudancaCargo(dados) {
  const d = dados || {};
  const canSeeSalario = ["rh","direcao"].includes(usuarioAtual?.perfil);
  return `
  <div class="form-section-block">
    <h3 class="form-subtitle">1. Informações do Colaborador</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label required">Nome</label>
        <input id="f_nomeColaborador" class="form-control" value="${esc(d.nomeColaborador)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Cargo atual</label>
        <input id="f_cargoAtual" class="form-control" value="${esc(d.cargoAtual)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Líder imediato atual</label>
        <input id="f_liderAtual" class="form-control" value="${esc(d.liderAtual)}" />
      </div>
    </div>
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">2. Justificativa / Observações</h3>
    <div class="form-grid">
      <div class="form-group full-width">
        <p class="form-hint">Se houver mudança de horários ou benefícios, informar neste campo.</p>
        <textarea id="f_justificativa" class="form-control" rows="5" placeholder="Descreva a justificativa e observações importantes...">${esc(d.justificativa)}</textarea>
      </div>
    </div>
  </div>

  <div class="form-section-block">
    <h3 class="form-subtitle">3. Informações da Mudança Solicitada</h3>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label required">Novo Cargo</label>
        <select id="f_novoCargo" class="form-control">
          <option value="">Selecione</option>
          ${CARGOS_RH.map(c=>`<option ${(d.novoCargo||"").toUpperCase()===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label required">Setor de Destino</label>
        <input id="f_setorDestino" class="form-control" placeholder="Ex: Projetos, Inovação..." value="${esc(d.setorDestino)}" />
      </div>
      <div class="form-group">
        <label class="form-label required">Novo Líder Imediato</label>
        <input id="f_novoLider" class="form-control" placeholder="Nome do novo líder" value="${esc(d.novoLider)}" />
      </div>
      ${canSeeSalario ? `
      <div class="form-group">
        <label class="form-label">Salário</label>
        <input id="f_salario" class="form-control mask-real" placeholder="Preenchido automaticamente ao selecionar o cargo" value="${esc(d.salario)}" />
      </div>` : `<input type="hidden" id="f_salario" value="${esc(d.salario)}" />`}
      <div class="form-group">
        <label class="form-label required">Data Prevista para a Mudança</label>
        <input id="f_dataPrevista" class="form-control" type="date" value="${esc(d.dataPrevista)}" />
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

// [ALTERADO] afterFormRender atualizado com novos listeners
function afterFormRender() {
  document.querySelectorAll(".mask-real").forEach(el => {
    el.addEventListener("input", () => mascaraReais(el));
  });
  const fa = document.getElementById("f_formAcademica");
  if (fa) fa.addEventListener("change", toggleFormOutro);
  const tm = document.getElementById("f_tipoMudanca");
  if (tm) tm.addEventListener("change", toggleTipoMudancaOutro);

  // [ALTERADO] Local de Trabalho — novo handler que controla jornada e benefícios
  const lt = document.getElementById("f_localTrabalho");
  if (lt) {
    lt.addEventListener("change", toggleLocalTrabalho);
    if (lt.value) toggleLocalTrabalho(); // aplica estado inicial ao editar
  }

  // Auto-fill de setor e salário a partir da tabela salarial ao selecionar cargo (seleção/indicação)
  const fCargoSel = document.getElementById('f_cargo');
  if (fCargoSel) {
    fCargoSel.addEventListener('change', function() {
      const cargoSel = this.value.toUpperCase();
      const entrada = _tabelaSalarial.find(e => (e.cargo || '').toUpperCase() === cargoSel);
      if (entrada) {
        const fSetor   = document.getElementById('f_setor');
        const fSalario = document.getElementById('f_salario');
        if (fSetor)   fSetor.value   = entrada.setor   || '';
        if (fSalario) fSalario.value = entrada.salario || '';
      }
    });
  }

  // Auto-fill de salário ao selecionar novo cargo (mudança de cargo)
  const fNovoCargo = document.getElementById('f_novoCargo');
  if (fNovoCargo) {
    fNovoCargo.addEventListener('change', function() {
      const cargoSel = this.value.toUpperCase();
      const entrada = _tabelaSalarial.find(e => (e.cargo || '').toUpperCase() === cargoSel);
      if (entrada) {
        const fSalario = document.getElementById('f_salario');
        if (fSalario) fSalario.value = entrada.salario || '';
      }
    });
  }

  // [ALTERADO] Outro Projeto — habilita/desabilita campos manuais
  const op = document.getElementById("f_outroProjeto");
  if (op) {
    op.addEventListener("change", toggleOutroProjeto);
    if (op.checked) toggleOutroProjeto(); // aplica estado inicial ao editar
  }

  // [ALTERADO] Outros benefícios — toggle do campo de especificação
  const chkOutros = document.getElementById("f_chk_outros");
  if (chkOutros) {
    chkOutros.addEventListener("change", () => {
      const g = document.getElementById("grupoBenefOutros");
      if (g) g.style.display = chkOutros.checked ? "" : "none";
    });
  }

  // Enter em input/select envia o formulário; Ctrl+Enter em textarea também.
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
  configurarClockifyAutocomplete();
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

// [ALTERADO] toggleAjudaCusto substituído por toggleLocalTrabalho
// Controla exibição de jornada+horas+benefícios (EXTERNO) e info padrão (SEDE)
function toggleLocalTrabalho() {
  const val = (document.getElementById("f_localTrabalho")?.value || "").toUpperCase();
  const isExterno = val.includes("EXTERNO");
  const isSede    = val.includes("SEDE");

  const grupoJornada = document.getElementById("grupoJornadaBeneficios");
  const infoSede     = document.getElementById("infoJornadaSede");

  if (grupoJornada) grupoJornada.style.display = isExterno ? "" : "none";
  if (infoSede)     infoSede.style.display     = isSede    ? "" : "none";

  // Limpa campos de externo ao trocar para sede
  if (!isExterno) {
    const fJornada = document.getElementById("f_jornada");
    const fHoras   = document.getElementById("f_horasSemana");
    if (fJornada) fJornada.value = "";
    if (fHoras)   fHoras.value   = "";
    // desmarca todos os benefícios
    BENS.forEach(b => {
      const chk = document.getElementById("f_chk_" + b.id);
      if (chk) chk.checked = false;
    });
    const chkOut = document.getElementById("f_chk_outros");
    if (chkOut) { chkOut.checked = false; }
    const gOut = document.getElementById("grupoBenefOutros");
    if (gOut) gOut.style.display = "none";
  }
}

// [ALTERADO] Toggle para "Outro Projeto" — habilita preenchimento manual de projeto e código
function toggleOutroProjeto() {
  const checked   = document.getElementById("f_outroProjeto")?.checked;
  const codeField = document.getElementById("f_codigoClockify");
  const nomeField = document.getElementById("f_nomeProjetoClockify");

  if (codeField) {
    codeField.readOnly    = !checked;
    codeField.placeholder = checked ? "Código do projeto (manual)" : "Preenchido automaticamente";
    if (!checked) codeField.value = "";
  }
  if (nomeField) {
    nomeField.placeholder = checked ? "Nome do projeto (manual)" : "Buscar projeto...";
    if (!checked) {
      nomeField.value = "";
      nomeField.dataset.clockifyId = "";
    }
  }
}

// ── Coleta ────────────────────────────────────────────────────────────────
// [ALTERADO] coletarForm — inclui novos campos: setor, salário, jornada, horas, benefícios, outroProjeto
function coletarForm() {
  if (tipoFormAtual === "selecao" || tipoFormAtual === "indicacao") {
    const localTrabalho = uv("f_localTrabalho");
    const isExterno     = localTrabalho.toUpperCase().includes("EXTERNO");

    const dados = {
      cargo:               uv("f_cargo"),
      setor:               uv("f_setor"),            // [ALTERADO] novo campo obrigatório
      tipoContrato:        uv("f_tipoContrato"),
      salario:             v("f_salario"),            // [ALTERADO] novo campo obrigatório
      localTrabalho:       localTrabalho,
      // [ALTERADO] jornada: 08:00-17:00 automático para Sede; editável para Externo
      jornada:             isExterno ? uv("f_jornada") : "08:00 às 17:00",
      horasSemana:         isExterno ? v("f_horasSemana") : "",
      beneficios:          isExterno ? coletarBeneficios(true) : [],
      nomeProjetoClockify: uv("f_nomeProjetoClockify"),
      numVagas:            v("f_numVagas"),
      modalidade:          uv("f_modalidade"),
      dataInicio:          v("f_dataInicio"),
      tipoRequisicao:      uv("f_tipoRequisicao"),
      solNome:             usuarioAtual?.nome || "",
      solCargo:            usuarioAtual?.setor || PERFIL_LABEL[usuarioAtual?.perfil] || "",
      formAcademica:       uv("f_formAcademica"),
      formAcademicaOutro:  uv("f_formAcademicaOutro"),
      conhecimentos:       uv("f_conhecimentos"),
      experiencia:         uv("f_experiencia"),
      observacoes:         uv("f_observacoes")
    };
    if (tipoFormAtual === "indicacao") dados.nomeIndicada = uv("f_nomeIndicada");
    return dados;
  } else {
    // [ALTERADO] Mudança de cargo — novos campos: setorDestino, departamentoDestino, novoLider, salario, dataPrevista
    return {
      nomeColaborador: uv("f_nomeColaborador"),
      cargoAtual:      uv("f_cargoAtual"),
      liderAtual:      uv("f_liderAtual"),
      novoCargo:       uv("f_novoCargo"),
      setorDestino:    uv("f_setorDestino"),
      novoLider:       uv("f_novoLider"),
      salario:         v("f_salario"),
      dataPrevista:    v("f_dataPrevista"),
      justificativa:   uv("f_justificativa"),
      respNome:        usuarioAtual?.nome || "",
      respCargo:       usuarioAtual?.setor || PERFIL_LABEL[usuarioAtual?.perfil] || ""
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

// [ALTERADO] validarForm — validações atualizadas com novos campos obrigatórios
function validarForm(dados) {
  if (tipoFormAtual === "selecao" || tipoFormAtual === "indicacao") {
    if (tipoFormAtual === "indicacao" && !dados.nomeIndicada) return "Informe o nome da pessoa indicada.";
    if (!dados.cargo)                 return "Selecione o cargo.";
    if (!dados.setor)                 return "Informe o setor.";
    if (!dados.tipoContrato)          return "Informe o tipo de contrato.";
    if (["rh","direcao"].includes(usuarioAtual?.perfil) && !dados.salario) return "Informe o salário.";
    if (!dados.localTrabalho)         return "Informe o local de trabalho.";
    // jornada e horas obrigatórios apenas para Externo
    const isExterno = (dados.localTrabalho || "").toUpperCase().includes("EXTERNO");
    if (isExterno && !dados.jornada)     return "Informe a jornada / horário de trabalho.";
    if (isExterno && !dados.horasSemana) return "Informe a quantidade de horas semanais.";
    if (!dados.numVagas)              return "Informe o número de vagas.";
    if (!dados.modalidade)            return "Informe a modalidade.";
    if (!dados.tipoRequisicao)        return "Informe o tipo de requisição.";
    if (!dados.formAcademica)         return "Informe a formação acadêmica exigida.";
    if (dados.formAcademica === "OUTROS" && !dados.formAcademicaOutro) return "Especifique a formação acadêmica.";
    if (!dados.conhecimentos)         return "Informe os conhecimentos indispensáveis.";
    if (!dados.experiencia)           return "Informe a experiência desejada.";
  } else {
    if (!dados.nomeColaborador) return "Informe o nome do colaborador.";
    if (!dados.cargoAtual)      return "Informe o cargo atual.";
    if (!dados.liderAtual)      return "Informe o líder imediato atual.";
    if (!dados.justificativa)   return "Informe a justificativa / observações.";
    if (!dados.novoCargo)       return "Selecione o novo cargo.";
    if (!dados.setorDestino)    return "Informe o setor de destino.";
    if (!dados.novoLider)       return "Informe o novo líder imediato.";
    if (!dados.dataPrevista)    return "Informe a data prevista para a mudança.";
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
    const agora = new Date().toISOString();
    const novo = {
      ...item,
      dados,
      dataAtualizacao:    agora,
      data_ultima_edicao: agora, // [ALTERADO] auditoria automática
      historico: [...(item.historico||[]), {
        data:           agora,
        usuario:        usuarioAtual.nome,
        acao:           "Formulário atualizado.",
        statusAnterior: item.status,
        novoStatus:     item.status,
        obs:            ""
      }]
    };
    solicitacoes[idx] = novo;
    _syncItem(novo);
    mostrarToast("Solicitação atualizada com sucesso.");
  } else {
    const id     = gerarId();
    const agora  = new Date().toISOString();
    const novo = {
      id,
      tipo:              tipoFormAtual,
      criadoPor:         usuarioAtual.nome,
      criadoPorNome:     usuarioAtual.nome,
      criadoPorCodigo:   usuarioAtual.codigo,
      criadoPorPerfil:   usuarioAtual.perfil,
      gestorResponsavel: usuarioAtual.gestor || null,
      setorResponsavel:  usuarioAtual.setor  || null,
      dados,
      status: "Aguardando análise do gestor",
      historico: [{
        data:           agora,
        usuario:        usuarioAtual.nome.toUpperCase(),
        perfil:         (PERFIL_LABEL[usuarioAtual.perfil] || "LÍDER").toUpperCase(),
        acao:           "SOLICITAÇÃO CRIADA.",
        statusAnterior: null,
        novoStatus:     "Aguardando análise do gestor",
        obs:            ""
      }],
      dataCriacao:        agora, // [ALTERADO] auditoria — data de criação automática
      data_criacao:       agora, // [ALTERADO] campo canônico de auditoria
      dataAtualizacao:    agora,
      data_ultima_edicao: agora  // [ALTERADO] campo canônico de auditoria
    };
    solicitacoes.unshift(novo);
    salvarLocal();
    _syncItem(novo);
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
  sbExcluirSolicitacao(id).catch(e => console.error('[sync] Erro ao excluir:', e));
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

  const agoraDec = new Date().toISOString();
  const updates = {
    status:             acao.novoStatus,
    dataAtualizacao:    agoraDec,
    data_ultima_edicao: agoraDec, // [ALTERADO] auditoria automática
    historico:          [...(item.historico || []), histEntry]
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
  _syncItem(solicitacoes[idx]);
  fecharModal("modalDecisao");
  renderListagem();
  renderDashboard();
  mostrarToast("Decisão registrada com sucesso.");
}

// ── Ações rápidas de status ────────────────────────────────────────────────
function aprovarDireto(id) {
  const idx = solicitacoes.findIndex(s => s.id === id);
  if (idx === -1) return;
  const item = solicitacoes[idx];
  if (item.status !== "Aguardando análise do gestor") return;

  const agora = new Date().toISOString();
  solicitacoes[idx] = {
    ...item,
    status:             "Encaminhada ao RH",
    dataAtualizacao:    agora,
    data_ultima_edicao: agora, // [ALTERADO] auditoria
    gestorAnalise:      usuarioAtual.nome.toUpperCase(),
    decisaoGestor:      "APROVADA",
    dataAnaliseGestor:  agora,
    historico: [...(item.historico || []),
      {
        data:           agora,
        usuario:        usuarioAtual.nome.toUpperCase(),
        perfil:         "GESTOR",
        acao:           "APROVADA PELO GESTOR",
        statusAnterior: item.status,
        novoStatus:     "Encaminhada ao RH",
        obs:            ""
      }
    ]
  };
  salvarLocal();
  _syncItem(solicitacoes[idx]);
  renderListagem();
  renderDashboard();
  mostrarToast("Solicitação aprovada e encaminhada ao RH.");
}

function abrirModalRejeitar(id) {
  document.getElementById("rejeitarId").value = id;
  document.getElementById("rejeitarObs").value = "";
  document.getElementById("modalRejeitar").classList.add("active");
  setTimeout(() => document.getElementById("rejeitarObs").focus(), 100);
}

function confirmarRejeitar() {
  const id  = document.getElementById("rejeitarId").value;
  const obs = document.getElementById("rejeitarObs").value.trim().toUpperCase();
  if (!obs) { mostrarToast("Informe a justificativa para reprovar."); return; }

  const idx = solicitacoes.findIndex(s => s.id === id);
  if (idx === -1) return;
  const item = solicitacoes[idx];

  const agora = new Date().toISOString();
  solicitacoes[idx] = {
    ...item,
    status:             "Reprovada pelo gestor",
    dataAtualizacao:    agora,
    data_ultima_edicao: agora, // [ALTERADO] auditoria
    gestorAnalise:      usuarioAtual.nome.toUpperCase(),
    decisaoGestor:      "REPROVADA",
    observacaoGestor:   obs,
    dataAnaliseGestor:  agora,
    historico: [...(item.historico || []),
      {
        data:           agora,
        usuario:        usuarioAtual.nome.toUpperCase(),
        perfil:         "GESTOR",
        acao:           "REPROVADA PELO GESTOR",
        statusAnterior: item.status,
        novoStatus:     "Reprovada pelo gestor",
        obs
      }
    ]
  };
  salvarLocal();
  _syncItem(solicitacoes[idx]);
  fecharModal("modalRejeitar");
  renderListagem();
  renderDashboard();
  mostrarToast("Solicitação reprovada.");
}

function abrirModalRhAcao(id, novoStatus) {
  document.getElementById("rhAcaoId").value = id;
  document.getElementById("rhAcaoStatus").value = novoStatus;
  document.getElementById("rhAcaoObs").value = "";
  const contratadoWrap = document.getElementById("rhAcaoContratadoWrap");
  const contratadoInput = document.getElementById("rhAcaoContratado");
  if (novoStatus === "Finalizada") {
    contratadoWrap.style.display = "";
    if (contratadoInput) contratadoInput.value = "";
  } else {
    contratadoWrap.style.display = "none";
  }
  const statusLabel = {
    "Em análise pelo RH":   "Em análise pelo RH",
    "Seleção em andamento": "Seleção em andamento",
    "Finalizada":           "Finalizar solicitação"
  };
  document.getElementById("rhAcaoTitulo").textContent = statusLabel[novoStatus] || novoStatus;
  document.getElementById("modalRhAcao").classList.add("active");
  setTimeout(() => document.getElementById("rhAcaoObs").focus(), 100);
}

function confirmarRhAcao() {
  const id        = document.getElementById("rhAcaoId").value;
  const novoStatus= document.getElementById("rhAcaoStatus").value;
  const obs       = document.getElementById("rhAcaoObs").value.trim().toUpperCase();
  const contratado= (document.getElementById("rhAcaoContratado")?.value || "").trim().toUpperCase();

  const idx = solicitacoes.findIndex(s => s.id === id);
  if (idx === -1) return;
  const item = solicitacoes[idx];

  const ACOES = {
    "Em análise pelo RH":   "EM ANÁLISE PELO RH",
    "Seleção em andamento": "SELEÇÃO EM ANDAMENTO",
    "Finalizada":           "FINALIZADA"
  };

  const agora = new Date().toISOString();
  const updates = {
    status:             novoStatus,
    dataAtualizacao:    agora,
    data_ultima_edicao: agora, // [ALTERADO] auditoria automática
    historico: [...(item.historico || []),
      {
        data:           agora,
        usuario:        usuarioAtual.nome.toUpperCase(),
        perfil:         "RH",
        acao:           ACOES[novoStatus] || novoStatus.toUpperCase(),
        statusAnterior: item.status,
        novoStatus,
        obs
      }
    ]
  };

  if (obs) updates.observacaoRh = obs;
  if (novoStatus === "Finalizada" && contratado) updates.contratado = contratado;

  solicitacoes[idx] = { ...item, ...updates };
  salvarLocal();
  _syncItem(solicitacoes[idx]);
  fecharModal("modalRhAcao");
  renderListagem();
  renderDashboard();
  mostrarToast("Status atualizado: " + novoStatus + ".");
}

function avancarStatusRH(id, novoStatus) {
  abrirModalRhAcao(id, novoStatus);
}

function abrirModalObs(id) {
  document.getElementById("obsId").value = id;
  document.getElementById("obsTexto").value = "";
  document.getElementById("modalObs").classList.add("active");
  setTimeout(() => document.getElementById("obsTexto").focus(), 100);
}

function confirmarObs() {
  const id  = document.getElementById("obsId").value;
  const obs = document.getElementById("obsTexto").value.trim().toUpperCase();
  if (!obs) { mostrarToast("Informe a observação antes de salvar."); return; }

  const idx = solicitacoes.findIndex(s => s.id === id);
  if (idx === -1) return;
  const item = solicitacoes[idx];

  const agora = new Date().toISOString();
  const perfil = (PERFIL_LABEL[usuarioAtual.perfil] || usuarioAtual.perfil).toUpperCase();
  solicitacoes[idx] = {
    ...item,
    dataAtualizacao: agora,
    historico: [...(item.historico || []),
      {
        data: agora,
        usuario: usuarioAtual.nome.toUpperCase(),
        perfil,
        acao: "OBSERVAÇÃO REGISTRADA",
        statusAnterior: item.status,
        novoStatus: item.status,
        obs
      }
    ]
  };
  salvarLocal();
  _syncItem(solicitacoes[idx]);
  fecharModal("modalObs");
  renderListagem();
  renderDashboard();
  mostrarToast("Observação registrada com sucesso.");
}

function sincronizarThemeToggleDash() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const slider = document.getElementById("themeSliderDash");
  if (!slider) return;
  if (theme === 'light') {
    slider.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2"/></svg>`;
  } else {
    slider.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
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

  // [ALTERADO] gerarHTMLDetalhes — exibe novos campos: setor, salário, jornada, horas, benefícios
  if (tipo === "selecao" || tipo === "indicacao") {
    const beneficiosExib = Array.isArray(d.beneficios) && d.beneficios.length
      ? d.beneficios.join(" • ")
      : null;
    camposHTML = `
      ${tipo === "indicacao" ? det("Pessoa Indicada", d.nomeIndicada, "full") : ""}
      ${det("Cargo", d.cargo)}
      ${det("Setor", d.setor)}
      ${det("Tipo de Contrato", d.tipoContrato)}
      ${["rh","direcao"].includes(usuarioAtual?.perfil) ? det("Salário", d.salario) : ""}
      ${det("Local de Trabalho", d.localTrabalho)}
      ${d.jornada ? det("Jornada / Horário", d.jornada) : ""}
      ${d.horasSemana ? det("Horas Semanais", d.horasSemana + "h") : ""}
      ${beneficiosExib ? det("Benefícios", beneficiosExib, "full") : ""}
      ${det("Projeto (Clockify)", d.nomeProjetoClockify)} ${det("Código do Projeto", d.codigoClockify)}
      ${d.outroProjeto ? det("Tipo de Projeto", "Outro (manual)") : ""}
      ${det("Número de vagas", d.numVagas)} ${det("Modalidade", d.modalidade)}
      ${d.dataInicio ? det("Data de início prevista", formatarData(d.dataInicio)) : ""}
      ${det("Tipo de Requisição", d.tipoRequisicao, "full")}
      ${["rh","direcao"].includes(usuarioAtual?.perfil) ? `
      <div class="detail-section-title full"><span>Dados do Solicitante</span></div>
      ${det("Nome", d.solNome)} ${det("Cargo", d.solCargo)}
      ` : ""}
      <div class="detail-section-title full"><span>Perfil do Cargo</span></div>
      ${det("Formação acadêmica", d.formAcademica === "Outros" ? (d.formAcademicaOutro || "Outros") : d.formAcademica)}
      ${det("Conhecimentos indispensáveis", d.conhecimentos, "full")}
      ${det("Experiência desejada", d.experiencia, "full")}
      ${d.observacoes ? det("Observações gerais", d.observacoes, "full") : ""}
    `;
  } else {
    // [ALTERADO] Detalhes de mudança de cargo com novos campos
    const canSeePrivado = ["rh","direcao"].includes(usuarioAtual?.perfil);
    camposHTML = `
      <div class="detail-section-title full"><span>Informações do Colaborador</span></div>
      ${det("Nome", d.nomeColaborador, "full")}
      ${det("Cargo Atual", d.cargoAtual)} ${det("Líder Atual", d.liderAtual)}
      <div class="detail-section-title full"><span>Mudança Solicitada</span></div>
      ${d.novoCargo ? det("Novo Cargo", d.novoCargo) : ""}
      ${det("Setor de Destino", d.setorDestino)}
      ${det("Novo Líder Imediato", d.novoLider)}
      ${canSeePrivado && d.salario ? det("Salário", d.salario) : ""}
      ${d.dataPrevista ? det("Data Prevista", formatarData(d.dataPrevista)) : ""}
      ${det("Justificativa / Observações", d.justificativa, "full")}
      ${canSeePrivado ? `
        <div class="detail-section-title full"><span>Dados do Solicitante</span></div>
        ${det("Nome", d.respNome)} ${det("Setor", d.respCargo)}
      ` : ""}
    `;
  }

  // Blocos de análise
  const blocoGestor = item.decisaoGestor ? `
    <div class="detail-section-title full"><span>Análise do Gestor</span></div>
    ${det("Gestor", item.gestorAnalise)} ${det("Decisão", item.decisaoGestor)}
    ${det("Data da análise", formatarDataHora(item.dataAnaliseGestor))}
    ${item.observacaoGestor ? det("Observação", item.observacaoGestor, "full") : ""}` : "";

  const blocoRh = (item.observacaoRh || item.contratado || item.status === "Finalizada") ? `
    <div class="detail-section-title full"><span>Informações do RH</span></div>
    ${item.observacaoRh ? det("Observações do RH", item.observacaoRh, "full") : ""}
    ${item.contratado ? det("Pessoa Contratada", item.contratado, "full") : ""}` : "";

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

function gerarBotoesAcaoItem(item) {
  const acoesDisp = getAcoesDisponiveis(usuarioAtual, item);
  const SVG_VER    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const SVG_CHECK  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`;
  const SVG_X      = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const SVG_CLOCK  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const SVG_PLAY   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  const SVG_TRASH  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  const SVG_EDIT   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const SVG_OBS    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;

  let acoes = `<button class="btn-acao btn-acao-ver" title="Visualizar" onclick="verDetalhes('${item.id}')">${SVG_VER}</button>`;

  if (usuarioAtual.perfil === "gestao" && acoesDisp.includes("aprovar")) {
    acoes += `<button class="btn-acao btn-acao-aprovar" title="Aprovar" onclick="aprovarDireto('${item.id}')">${SVG_CHECK}</button>`;
    acoes += `<button class="btn-acao btn-acao-reprovar" title="Reprovar" onclick="abrirModalRejeitar('${item.id}')">${SVG_X}</button>`;
  }

  if (usuarioAtual.perfil === "rh") {
    // Observação — sempre disponível
    acoes += `<button class="btn-acao btn-acao-obs" title="Registrar observação" onclick="abrirModalObs('${item.id}')">${SVG_OBS}</button>`;
    if (acoesDisp.includes("analise")) {
      acoes += `<button class="btn-acao btn-acao-avancar" title="Em análise" onclick="abrirModalRhAcao('${item.id}','Em análise pelo RH')">${SVG_CLOCK}</button>`;
    }
    if (acoesDisp.includes("selecao")) {
      acoes += `<button class="btn-acao btn-acao-avancar" title="Seleção em andamento" onclick="abrirModalRhAcao('${item.id}','Seleção em andamento')">${SVG_PLAY}</button>`;
    }
    if (acoesDisp.includes("finalizar")) {
      acoes += `<button class="btn-acao btn-acao-finalizar" title="Finalizar" onclick="abrirModalRhAcao('${item.id}','Finalizada')">${SVG_CHECK}</button>`;
    }
    acoes += `<button class="btn-acao btn-acao-danger" title="Excluir" onclick="abrirModalExcluir('${item.id}')">${SVG_TRASH}</button>`;
  }

  if (usuarioAtual.perfil === "direcao") {
    acoes += `<button class="btn-acao btn-acao-obs" title="Registrar observação" onclick="abrirModalObs('${item.id}')">${SVG_OBS}</button>`;
    if (acoesDisp.includes("aprovar")) {
      acoes += `<button class="btn-acao btn-acao-aprovar" title="Aprovar" onclick="aprovarDireto('${item.id}')">${SVG_CHECK}</button>`;
      acoes += `<button class="btn-acao btn-acao-reprovar" title="Reprovar" onclick="abrirModalRejeitar('${item.id}')">${SVG_X}</button>`;
    }
    if (acoesDisp.includes("analise")) {
      acoes += `<button class="btn-acao btn-acao-avancar" title="Em análise" onclick="abrirModalRhAcao('${item.id}','Em análise pelo RH')">${SVG_CLOCK}</button>`;
    }
    if (acoesDisp.includes("selecao")) {
      acoes += `<button class="btn-acao btn-acao-avancar" title="Seleção em andamento" onclick="abrirModalRhAcao('${item.id}','Seleção em andamento')">${SVG_PLAY}</button>`;
    }
    if (acoesDisp.includes("finalizar")) {
      acoes += `<button class="btn-acao btn-acao-finalizar" title="Finalizar" onclick="abrirModalRhAcao('${item.id}','Finalizada')">${SVG_CHECK}</button>`;
    }
    acoes += `<button class="btn-acao btn-acao-danger" title="Excluir" onclick="abrirModalExcluir('${item.id}')">${SVG_TRASH}</button>`;
  }

  if (podeEditarLider(item)) {
    acoes += `<button class="btn-acao" title="Editar" onclick="editarSolicitacao('${item.id}')">${SVG_EDIT}</button>`;
  }

  return acoes;
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

    const acoes = gerarBotoesAcaoItem(item);

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
// [ALTERADO] Estado dos colaboradores — aba exclusiva para RH e Direção
let _orgColaboradores   = [];
let _orgTabAtiva        = 'gestores';
let _orgColabFiltro     = { busca: '', setor: '', cargo: '' };
let _orgEditColabId     = null;
let _orgDelColabId      = null;

async function renderOrganograma() {
  const el = document.getElementById("orgContent");
  if (!el) return;
  el.innerHTML = `<div class="org-loading">Carregando organograma...</div>`;

  const canAdmin = ["rh", "direcao"].includes(usuarioAtual?.perfil);
  const [gestores, lideres, colaboradores, tabelaSalarial] = await Promise.all([
    sbCarregarGestores(),
    sbCarregarLideres(),
    canAdmin ? sbCarregarColaboradores()    : Promise.resolve([]),
    canAdmin ? sbCarregarTabelaSalarial()   : Promise.resolve([])
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

  if (canAdmin) {
    _orgColaboradores = colaboradores;
    _tabelaSalarial   = tabelaSalarial;
  }

  renderOrganogramaUI();
}

// [ALTERADO] Extrai geração dos accordions de gestores para reutilização
function gerarAccordionsGestores(gestores, canAdmin) {
  return gestores.map((g, i) => {
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
}

// [ALTERADO] renderOrganogramaUI — tabs para RH/Direção, visualização simples para Gestão/Líder
function renderOrganogramaUI() {
  const el = document.getElementById("orgContent");
  if (!el) return;

  const perfil = usuarioAtual.perfil;

  // ── LÍDER: card "Meu Gestor" ──────────────────────────────────────────
  if (perfil === "lider") {
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
  if (perfil === "gestao") {
    const gestores = _orgGestores.filter(g => g.nome === usuarioAtual.nome);
    if (!gestores.length) {
      el.innerHTML = `<p style="color:var(--text-muted);padding:1rem">Nenhum gestor encontrado.</p>`;
      return;
    }
    el.innerHTML = `<div class="acc-wrapper">${gerarAccordionsGestores(gestores, false)}</div>`;
    return;
  }

  // ── RH / DIREÇÃO: três abas ───────────────────────────────────────────
  const isGest  = _orgTabAtiva === 'gestores';
  const isColab = _orgTabAtiva === 'colaboradores';
  const isTs    = _orgTabAtiva === 'tabelaSalarial';
  const gestoresHTML = _orgGestores.length
    ? `<div class="acc-wrapper">${gerarAccordionsGestores(_orgGestores, true)}</div>`
    : `<p style="color:var(--text-muted);padding:1rem">Nenhum gestor cadastrado.</p>`;

  el.innerHTML = `
    <div class="org-tabs">
      <button class="org-tab${isGest ? ' active' : ''}" onclick="switchOrgTab('gestores')">Gestores e Líderes</button>
      <button class="org-tab${isColab ? ' active' : ''}" onclick="switchOrgTab('colaboradores')">Colaboradores da Seteg</button>
      <button class="org-tab${isTs ? ' active' : ''}" onclick="switchOrgTab('tabelaSalarial')">Tabela Salarial</button>
      <div class="org-tabs-spacer"></div>
      <button id="btnNovoGestor" class="btn btn-primary org-tabs-action" onclick="abrirModalNovoGestor()"${isGest ? '' : ' style="display:none"'}>+ Novo Gestor</button>
      <button id="btnNovaSalarial" class="btn btn-primary org-tabs-action" onclick="abrirModalNovaSalarial()"${isTs ? '' : ' style="display:none"'}>+ Nova Entrada</button>
    </div>
    <div class="org-tab-content" id="orgTabGestores"${isGest ? '' : ' style="display:none"'}>
      ${gestoresHTML}
    </div>
    <div class="org-tab-content" id="orgTabColaboradores"${isColab ? '' : ' style="display:none"'}>
      ${gerarHTMLColaboradores()}
    </div>
    <div class="org-tab-content" id="orgTabTabelaSalarial"${isTs ? '' : ' style="display:none"'}>
      ${gerarHTMLTabelaSalarial()}
    </div>`;
}

function switchOrgTab(tab) {
  _orgTabAtiva = tab;
  const isGest  = tab === 'gestores';
  const isColab = tab === 'colaboradores';
  const isTs    = tab === 'tabelaSalarial';
  const tGest  = document.getElementById("orgTabGestores");
  const tColab = document.getElementById("orgTabColaboradores");
  const tTs    = document.getElementById("orgTabTabelaSalarial");
  document.querySelectorAll('.org-tab').forEach((btn, i) => {
    btn.classList.toggle('active', (isGest && i === 0) || (isColab && i === 1) || (isTs && i === 2));
  });
  if (tGest)  tGest.style.display  = isGest  ? '' : 'none';
  if (tColab) tColab.style.display = isColab ? '' : 'none';
  if (tTs)    tTs.style.display    = isTs    ? '' : 'none';
  const btnNovoGestor   = document.getElementById("btnNovoGestor");
  const btnNovaSalarial = document.getElementById("btnNovaSalarial");
  if (btnNovoGestor)   btnNovoGestor.style.display   = isGest ? '' : 'none';
  if (btnNovaSalarial) btnNovaSalarial.style.display  = isTs   ? '' : 'none';
}

// [ALTERADO] Gera HTML da tabela de colaboradores com filtros
function gerarHTMLColaboradores() {
  const f = _orgColabFiltro;
  const lista = _orgColaboradores.filter(c => {
    const busca = f.busca.toLowerCase();
    const matchBusca = !busca ||
      (c.nome  || '').toLowerCase().includes(busca) ||
      (c.cargo || '').toLowerCase().includes(busca);
    const matchSetor = !f.setor || (c.setor || '').toLowerCase().includes(f.setor.toLowerCase());
    const matchCargo = !f.cargo || (c.cargo || '').toLowerCase().includes(f.cargo.toLowerCase());
    return matchBusca && matchSetor && matchCargo;
  });

  const rowsHTML = lista.length
    ? lista.map(c => `
        <tr>
          <td>${esc(c.nome)}</td>
          <td>${esc(c.cargo || '—')}</td>
          <td>${esc(c.setor || '—')}</td>
          <td>${esc(c.lider_direto || '—')}</td>
          <td class="colab-actions">
            <button class="btn-org-leader btn-org-leader-edit" title="Editar"
              onclick="abrirModalEditarColab('${esc(String(c.id))}')">✏</button>
            <button class="btn-org-leader btn-org-leader-delete" title="Excluir"
              onclick="abrirModalExcluirColab('${esc(String(c.id))}')">✕</button>
          </td>
        </tr>`).join("")
    : `<tr><td colspan="5" class="colab-empty">Nenhum colaborador encontrado.</td></tr>`;

  const total = _orgColaboradores.length;
  const found = lista.length;
  const countMsg = total === 0
    ? 'Nenhum colaborador cadastrado.'
    : `${found} de ${total} colaborador${total !== 1 ? 'es' : ''}`;

  return `
    <div class="colab-toolbar">
      <input class="colab-search" type="text" placeholder="Buscar por nome ou cargo…"
        value="${esc(f.busca)}" oninput="filtrarColaboradores('busca', this.value)">
      <input class="colab-filter" type="text" placeholder="Filtrar por setor…"
        value="${esc(f.setor)}" oninput="filtrarColaboradores('setor', this.value)">
      <input class="colab-filter" type="text" placeholder="Filtrar por cargo…"
        value="${esc(f.cargo)}" oninput="filtrarColaboradores('cargo', this.value)">
      <button class="btn btn-primary" onclick="abrirModalNovoColab()">+ Novo Colaborador</button>
    </div>
    <div class="colab-table-wrap">
      <table class="colab-table">
        <thead>
          <tr><th>Nome</th><th>Cargo</th><th>Setor</th><th>Líder Direto</th><th>Ações</th></tr>
        </thead>
        <tbody id="colabTbody">${rowsHTML}</tbody>
      </table>
    </div>
    <p class="colab-count" id="colabCount">${countMsg}</p>`;
}

function filtrarColaboradores(campo, valor) {
  _orgColabFiltro[campo] = valor;
  const f = _orgColabFiltro;

  const lista = _orgColaboradores.filter(c => {
    const busca = f.busca.toLowerCase();
    const matchBusca = !busca ||
      (c.nome  || '').toLowerCase().includes(busca) ||
      (c.cargo || '').toLowerCase().includes(busca);
    const matchSetor = !f.setor || (c.setor || '').toLowerCase().includes(f.setor.toLowerCase());
    const matchCargo = !f.cargo || (c.cargo || '').toLowerCase().includes(f.cargo.toLowerCase());
    return matchBusca && matchSetor && matchCargo;
  });

  const rowsHTML = lista.length
    ? lista.map(c => `
        <tr>
          <td>${esc(c.nome)}</td>
          <td>${esc(c.cargo || '—')}</td>
          <td>${esc(c.setor || '—')}</td>
          <td>${esc(c.lider_direto || '—')}</td>
          <td class="colab-actions">
            <button class="btn-org-leader btn-org-leader-edit" title="Editar"
              onclick="abrirModalEditarColab('${esc(String(c.id))}')">✏</button>
            <button class="btn-org-leader btn-org-leader-delete" title="Excluir"
              onclick="abrirModalExcluirColab('${esc(String(c.id))}')">✕</button>
          </td>
        </tr>`).join('')
    : `<tr><td colspan="5" class="colab-empty">Nenhum colaborador encontrado.</td></tr>`;

  const total = _orgColaboradores.length;
  const found = lista.length;
  const countMsg = total === 0
    ? 'Nenhum colaborador cadastrado.'
    : `${found} de ${total} colaborador${total !== 1 ? 'es' : ''}`;

  const tbody = document.getElementById('colabTbody');
  const count = document.getElementById('colabCount');
  if (tbody) tbody.innerHTML = rowsHTML;
  if (count) count.textContent = countMsg;
}

// ── Tabela Salarial ───────────────────────────────────────────────────────

function gerarHTMLTabelaSalarial() {
  const rowsHTML = _tabelaSalarial.length
    ? _tabelaSalarial.map(e => `
        <tr>
          <td>${esc(e.cargo)}</td>
          <td>${esc(e.setor)}</td>
          <td>${esc(e.salario)}</td>
          <td class="colab-actions">
            <button class="btn-org-leader btn-org-leader-edit" title="Editar"
              onclick="abrirModalEditarSalarial('${esc(String(e.id))}')">✏</button>
            <button class="btn-org-leader btn-org-leader-delete" title="Excluir"
              onclick="abrirModalExcluirSalarial('${esc(String(e.id))}', '${esc(e.cargo)}')">✕</button>
          </td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="colab-empty">Nenhuma entrada cadastrada. Use o botão acima para adicionar.</td></tr>`;

  return `
    <div class="colab-table-wrap">
      <table class="colab-table">
        <thead>
          <tr><th>Cargo</th><th>Setor</th><th>Salário</th><th>Ações</th></tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
    <p class="colab-count">${_tabelaSalarial.length} ${_tabelaSalarial.length === 1 ? 'entrada' : 'entradas'} cadastrada${_tabelaSalarial.length === 1 ? '' : 's'}</p>`;
}

let _tsEditId = null;
let _tsDelId  = null;

function _popularSelectCargo(selectId, valorAtual) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o cargo</option>' +
    CARGOS_RH.map(c => `<option value="${c}" ${valorAtual === c ? 'selected' : ''}>${c}</option>`).join('');
}

function abrirModalNovaSalarial() {
  if (!["rh","direcao"].includes(usuarioAtual?.perfil)) return;
  _popularSelectCargo("tsCargo", "");
  document.getElementById("tsSetor").value   = "";
  document.getElementById("tsSalario").value = "";
  document.getElementById("modalNovaSalarial").classList.add("active");
  document.getElementById("tsCargo").focus();
}

async function salvarNovaSalarial() {
  const cargo   = document.getElementById("tsCargo").value.trim();
  const setor   = document.getElementById("tsSetor").value.trim();
  const salario = document.getElementById("tsSalario").value.trim();
  if (!cargo)   { mostrarToast("Selecione o cargo."); return; }
  if (!setor)   { mostrarToast("Informe o setor."); return; }
  if (!salario) { mostrarToast("Informe o salário."); return; }
  const btn = document.querySelector("#modalNovaSalarial .btn-primary");
  if (btn) { btn.disabled = true; btn.textContent = "Salvando..."; }
  try {
    await sbCriarEntradaSalarial(cargo.toUpperCase(), setor, salario);
    fecharModal("modalNovaSalarial");
    mostrarToast("Entrada cadastrada com sucesso.");
    _tabelaSalarial = await sbCarregarTabelaSalarial();
    const container = document.getElementById("orgTabTabelaSalarial");
    if (container) container.innerHTML = gerarHTMLTabelaSalarial();
  } catch(e) {
    mostrarToast("Erro ao salvar. Verifique a conexão.");
    console.error("[ts] salvarNovaSalarial:", e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Salvar"; }
  }
}

function abrirModalEditarSalarial(id) {
  if (!["rh","direcao"].includes(usuarioAtual?.perfil)) return;
  const e = _tabelaSalarial.find(x => String(x.id) === String(id));
  if (!e) return;
  _tsEditId = id;
  _popularSelectCargo("tsEditCargo", e.cargo);
  document.getElementById("tsEditSetor").value   = e.setor;
  document.getElementById("tsEditSalario").value = e.salario;
  document.getElementById("modalEditarSalarial").classList.add("active");
}

async function salvarEditarSalarial() {
  if (!_tsEditId) return;
  const cargo   = document.getElementById("tsEditCargo").value.trim();
  const setor   = document.getElementById("tsEditSetor").value.trim();
  const salario = document.getElementById("tsEditSalario").value.trim();
  if (!cargo)   { mostrarToast("Selecione o cargo."); return; }
  if (!setor)   { mostrarToast("Informe o setor."); return; }
  if (!salario) { mostrarToast("Informe o salário."); return; }
  try {
    await sbEditarEntradaSalarial(_tsEditId, cargo.toUpperCase(), setor, salario);
    fecharModal("modalEditarSalarial");
    mostrarToast("Entrada atualizada.");
    _tabelaSalarial = await sbCarregarTabelaSalarial();
    const container = document.getElementById("orgTabTabelaSalarial");
    if (container) container.innerHTML = gerarHTMLTabelaSalarial();
  } catch(e) {
    mostrarToast("Erro ao atualizar. Verifique a conexão.");
    console.error("[ts] salvarEditarSalarial:", e);
  }
}

function abrirModalExcluirSalarial(id, cargo) {
  if (!["rh","direcao"].includes(usuarioAtual?.perfil)) return;
  _tsDelId = id;
  const el = document.getElementById("excluirSalarialNome");
  if (el) el.textContent = cargo || "";
  document.getElementById("modalExcluirSalarial").classList.add("active");
}

async function confirmarExcluirSalarial() {
  if (!_tsDelId) return;
  try {
    await sbExcluirEntradaSalarial(_tsDelId);
    _tsDelId = null;
    fecharModal("modalExcluirSalarial");
    mostrarToast("Entrada excluída.");
    _tabelaSalarial = await sbCarregarTabelaSalarial();
    const container = document.getElementById("orgTabTabelaSalarial");
    if (container) container.innerHTML = gerarHTMLTabelaSalarial();
  } catch(e) {
    mostrarToast("Erro ao excluir. Verifique a conexão.");
    console.error("[ts] confirmarExcluirSalarial:", e);
  }
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

// ── Org: Colaborador — Novo ───────────────────────────────────────────────
// [ALTERADO]
function abrirModalNovoColab() {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  ["colabNome","colabCargo","colabSetor","colabLider"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("modalNovoColab").classList.add("active");
  document.getElementById("colabNome").focus();
}

async function salvarNovoColab() {
  const nome  = document.getElementById("colabNome").value.trim();
  const cargo = document.getElementById("colabCargo").value.trim();
  const setor = document.getElementById("colabSetor").value.trim();
  const lider = document.getElementById("colabLider").value.trim();
  if (!nome)  { mostrarToast("Informe o nome do colaborador."); return; }
  if (!cargo) { mostrarToast("Informe o cargo."); return; }
  if (!setor) { mostrarToast("Informe o setor."); return; }
  const btn = document.getElementById("btnSalvarNovoColab");
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    await sbCriarColaborador(nome, cargo, setor, lider);
    fecharModal("modalNovoColab");
    mostrarToast("Colaborador criado com sucesso.");
    _orgTabAtiva = 'colaboradores';
    await renderOrganograma();
  } catch(e) {
    mostrarToast("Erro ao salvar colaborador.");
    console.error("[org] salvarNovoColab:", e);
  } finally {
    btn.disabled = false; btn.textContent = "Salvar";
  }
}

// ── Org: Colaborador — Editar ─────────────────────────────────────────────
// [ALTERADO]
function abrirModalEditarColab(id) {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  const c = _orgColaboradores.find(x => String(x.id) === String(id));
  if (!c) return;
  _orgEditColabId = id;
  document.getElementById("editColabNome").value  = c.nome || "";
  document.getElementById("editColabCargo").value = c.cargo || "";
  document.getElementById("editColabSetor").value = c.setor || "";
  document.getElementById("editColabLider").value = c.lider_direto || "";
  document.getElementById("modalEditarColab").classList.add("active");
  document.getElementById("editColabNome").focus();
}

async function salvarEditarColab() {
  const id    = _orgEditColabId;
  const nome  = document.getElementById("editColabNome").value.trim();
  const cargo = document.getElementById("editColabCargo").value.trim();
  const setor = document.getElementById("editColabSetor").value.trim();
  const lider = document.getElementById("editColabLider").value.trim();
  if (!nome)  { mostrarToast("Informe o nome."); return; }
  if (!cargo) { mostrarToast("Informe o cargo."); return; }
  if (!setor) { mostrarToast("Informe o setor."); return; }
  try {
    await sbEditarColaborador(id, nome, cargo, setor, lider);
    fecharModal("modalEditarColab");
    mostrarToast("Colaborador atualizado com sucesso.");
    _orgTabAtiva = 'colaboradores';
    await renderOrganograma();
  } catch(e) {
    mostrarToast("Erro ao atualizar colaborador.");
    console.error("[org] salvarEditarColab:", e);
  }
}

// ── Org: Colaborador — Excluir ────────────────────────────────────────────
// [ALTERADO]
function abrirModalExcluirColab(id) {
  if (!["rh","direcao"].includes(usuarioAtual.perfil)) return;
  _orgDelColabId = id;
  const c = _orgColaboradores.find(x => String(x.id) === String(id));
  const nomeEl = document.getElementById("excluirColabNome");
  if (nomeEl) nomeEl.textContent = c ? c.nome : "este colaborador";
  document.getElementById("modalExcluirColab").classList.add("active");
}

async function confirmarExcluirColab() {
  const id = _orgDelColabId;
  if (!id) return;
  try {
    await sbExcluirColaborador(id);
    fecharModal("modalExcluirColab");
    mostrarToast("Colaborador excluído.");
    _orgColaboradores = _orgColaboradores.filter(c => String(c.id) !== String(id));
    const container = document.getElementById("orgTabColaboradores");
    if (container) container.innerHTML = gerarHTMLColaboradores();
  } catch(e) {
    mostrarToast("Erro ao excluir colaborador.");
    console.error("[org] confirmarExcluirColab:", e);
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

function _syncItem(item) {
  if (!item) return;
  sbUpsertSolicitacao(item).catch(e => console.error('[sync] Erro ao salvar solicitação:', e));
}

async function carregarLocal() {
  const localData = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e) { return []; }
  })();

  try {
    const remote = await sbCarregarSolicitacoes();
    if (remote !== null) {
      if (remote.length > 0) {
        // Supabase tem dados — fonte principal
        solicitacoes = remote;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(solicitacoes));
      } else if (localData.length > 0) {
        // Supabase vazio mas localStorage tem dados — migra automaticamente
        solicitacoes = localData;
        console.log('[sync] Migrando ' + localData.length + ' solicitação(ões) para o Supabase...');
        localData.forEach(item => sbUpsertSolicitacao(item).catch(e => console.error('[sync] Migração:', e)));
      } else {
        solicitacoes = [];
      }
      return;
    }
  } catch(e) {
    console.error('[sync] Falha ao carregar do Supabase, usando cache local:', e);
  }
  solicitacoes = localData;
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
    "Reprovada pelo gestor":        "status-reprov",
    "Encaminhada ao RH":            "status-encaminhada",
    "Em análise pelo RH":           "status-analise-rh",
    "Seleção em andamento":         "status-selecao",
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

// ── Tema claro / escuro ───────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const logoImg = document.querySelector('.sidebar-logo img');
  if (logoImg) {
    logoImg.src = theme === 'light' ? 'images/logo-preto.png' : 'images/LOGO.png';
  }
  const slider = document.getElementById('themeSlider');
  if (!slider) return;
  if (theme === 'light') {
    slider.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  } else {
    slider.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem('sgrh_theme', next);
  sincronizarThemeToggleDash();
}

// ── Clockify ──────────────────────────────────────────────────────────────
function normalizar(str) {
  return (str || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function filtrarProjetosClockify(texto) {
  const t = normalizar(texto);
  if (t.length < 2) return [];
  return projetosClockify
    .filter(p =>
      normalizar(p._nome).includes(t) ||
      normalizar(p._code).includes(t) ||
      normalizar(p.clientName || '').includes(t) ||
      normalizar(p.name).includes(t)
    )
    .slice(0, 12);
}

function mostrarSugestoesClockify(projetos, estado) {
  const box = document.getElementById('clockifySuggestionsRH');
  if (!box) return;
  if (estado === 'loading') {
    box.innerHTML = `<div class="clockify-suggestion-msg">Buscando projetos...</div>`;
  } else if (estado === 'empty') {
    box.innerHTML = `<div class="clockify-suggestion-msg">Nenhum projeto encontrado</div>`;
  } else {
    box.innerHTML = projetos.map(p => {
      const nome = esc(p._nome);
      const code = esc(p._code);
      return `<div class="clockify-suggestion-item" data-id="${esc(p.id)}" data-nome="${nome}" data-code="${code}">
        <span class="suggestion-nome">${nome}</span>
        <span class="suggestion-code">${code}</span>
      </div>`;
    }).join('');
  }
  box.classList.add('active');
}

function esconderSugestoesClockify() {
  const box = document.getElementById('clockifySuggestionsRH');
  if (box) box.classList.remove('active');
}

function configurarClockifyAutocomplete() {
  const nomeField = document.getElementById('f_nomeProjetoClockify');
  const suggestionsBox = document.getElementById('clockifySuggestionsRH');
  if (!nomeField || !suggestionsBox) return;

  const buscarComDebounce = debounce((texto) => {
    if (!texto.trim() || texto.trim().length < 2) {
      esconderSugestoesClockify();
      return;
    }
    if (!projetosClockify.length) {
      mostrarSugestoesClockify([], 'empty');
      return;
    }
    const resultados = filtrarProjetosClockify(texto);
    mostrarSugestoesClockify(resultados, resultados.length ? 'list' : 'empty');
  }, 400);

  nomeField.addEventListener('input', () => {
    nomeField.dataset.clockifyId = '';
    mostrarSugestoesClockify([], 'loading');
    buscarComDebounce(nomeField.value);
  });

  suggestionsBox.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.clockify-suggestion-item');
    if (!item) return;
    e.preventDefault();
    nomeField.value = item.dataset.nome;
    nomeField.dataset.clockifyId = item.dataset.id;
    esconderSugestoesClockify();
  });

  nomeField.addEventListener('blur', () => {
    setTimeout(() => esconderSugestoesClockify(), 200);
  });

  nomeField.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') esconderSugestoesClockify();
  });
}

async function carregarProjetosClockify() {
  try {
    const wsRes = await fetch(`${CLOCKIFY_BASE_URL}/workspaces`, {
      headers: { 'X-Api-Key': CLOCKIFY_API_KEY }
    });
    if (!wsRes.ok) throw new Error(`Erro workspace: ${wsRes.status}`);
    const workspaces = await wsRes.json();
    if (!workspaces.length) throw new Error('Nenhum workspace encontrado');
    const wsId = workspaces[0].id;

    const todos = [];
    for (let page = 1; page < 100; page++) {
      const res = await fetch(
        `${CLOCKIFY_BASE_URL}/workspaces/${wsId}/projects?page=${page}&page-size=200&archived=false`,
        { headers: { 'X-Api-Key': CLOCKIFY_API_KEY } }
      );
      if (!res.ok) throw new Error(`Erro projetos: ${res.status}`);
      const lote = await res.json();
      if (!lote.length) break;
      todos.push(...lote);
      if (lote.length < 200) break;
    }

    const ignorar = /^(CANCELADO|FINALIZADO)/i;
    projetosClockify = todos
      .filter(p => !ignorar.test((p.name || '').trim()))
      .map(p => {
        const m = (p.name || '').match(/^(#[^\s(]+)\s*(?:\((.+)\))?$/);
        const code = m ? m[1] : p.name;
        const nome = (m && m[2] ? m[2].trim() : null)
                  || (p.clientName ? p.clientName.trim() : null)
                  || p.name;
        return { ...p, _code: code, _nome: nome };
      });

    console.log(`✅ ${projetosClockify.length} projetos Clockify carregados`);
  } catch(e) {
    console.error('Erro ao carregar projetos Clockify:', e);
  }
}

// ── Listeners ─────────────────────────────────────────────────────────────
function vincularListeners() {
  // Tema
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

  // Login
  document.getElementById("btnEntrar").addEventListener("click", () => login());
  document.getElementById("inputCodigo").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

  // Toggle visibilidade da senha no login
  document.getElementById("btnToggleSenha").addEventListener("click", () => {
    const campo  = document.getElementById("inputCodigo");
    const aberto = document.getElementById("iconOlhoAberto");
    const fechado = document.getElementById("iconOlhoFechado");
    const visivel = campo.type === "text";
    campo.type = visivel ? "password" : "text";
    aberto.style.display  = visivel ? "" : "none";
    fechado.style.display = visivel ? "none" : "";
  });

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

  // Teclado global: Esc e Enter
  document.addEventListener("keydown", e => {
    const modaisAtivos = [...document.querySelectorAll(".modal-overlay.active")];

    if (modaisAtivos.length) {
      if (e.key === "Escape") {
        e.preventDefault();
        // fecha apenas o modal mais recente
        modaisAtivos[modaisAtivos.length - 1].classList.remove("active");
      } else if (e.key === "Enter" && (e.target.tagName !== "TEXTAREA" || e.ctrlKey)) {
        // Enter (ou Ctrl+Enter em textarea) confirma o botão primário do modal ativo
        const topModal = modaisAtivos[modaisAtivos.length - 1];
        const btnPrimario = topModal.querySelector(".modal-footer .btn-primary, .modal-footer .btn-danger");
        if (btnPrimario && !btnPrimario.disabled) { e.preventDefault(); btnPrimario.click(); }
      }
      return;
    }

    // Sem modal aberto: Esc no formulário → voltar para a lista
    if (e.key === "Escape") {
      const viewForm = document.getElementById("viewFormulario");
      if (viewForm && viewForm.classList.contains("active")) {
        e.preventDefault();
        mostrarView(formOrigin);
      }
    }
  });
}

// ── Start ─────────────────────────────────────────────────────────────────
async function init() {
  await carregarLocal();
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
  carregarProjetosClockify();
}

init();
