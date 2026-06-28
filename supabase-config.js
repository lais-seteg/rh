// ── Supabase REST API — fetch() direto ───────────────────────
// Sem biblioteca externa. Sem CDN. Sem conflito de nomes.
// Funciona com file://, Live Server e servidores web.
// Os códigos de acesso ficam APENAS no banco de dados.

// Lê credenciais do config.js (arquivo gitignored — não vai ao repositório).
// Se config.js não existir, exibe aviso no console.
if (!window.SB_URL || !window.SB_KEY) {
  console.error(
    '[Config] config.js não encontrado ou incompleto.\n' +
    'Renomeie config.example.js para config.js e preencha as credenciais.'
  );
}

const _SB_BASE = window.SB_URL || '';
const _SB_KEY  = window.SB_KEY  || '';

const _SB_HEADS = {
  'apikey':        _SB_KEY,
  'Authorization': 'Bearer ' + _SB_KEY,
  'Content-Type':  'application/json',
  'Accept':        'application/json',
  'Prefer':        'return=representation'
};

// ── Função auxiliar de GET ────────────────────────────────────
async function _sbGet(path) {
  const url = _SB_BASE + path;
  let res;
  try {
    res = await fetch(url, { method: 'GET', headers: _SB_HEADS });
  } catch (networkErr) {
    console.error('[Supabase] Erro de rede — verifique conexão e URL do projeto:', networkErr);
    throw new Error('Erro de rede: ' + networkErr.message);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => String(res.status));
    console.error('[Supabase] HTTP ' + res.status + ' em ' + url);
    console.error('[Supabase] Resposta:', txt);

    if (res.status === 401) {
      console.error(
        '[Supabase] CHAVE INVÁLIDA — vá em Project Settings → API e copie a chave "anon public".'
      );
    }
    if (res.status === 400 || res.status === 404) {
      console.error(
        '[Supabase] Tabela não encontrada ou query inválida. Verifique o nome da tabela e colunas.'
      );
    }
    if (res.status === 403 || (res.status === 200 && txt === '[]')) {
      console.error(
        '[Supabase] RLS pode estar bloqueando a leitura. ' +
        'No Supabase, vá em Authentication → Policies e crie uma policy SELECT para anon na tabela usuarios_acesso.'
      );
    }

    throw new Error('Supabase ' + res.status + ': ' + txt);
  }

  return res.json();
}

// ── Função auxiliar de POST ───────────────────────────────────
async function _sbPost(path, body) {
  const url = _SB_BASE + path;
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: _SB_HEADS, body: JSON.stringify(body) });
  } catch (networkErr) {
    throw new Error('Erro de rede: ' + networkErr.message);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => String(res.status));
    throw new Error('Supabase ' + res.status + ': ' + txt);
  }
  return res.json().catch(() => null);
}

// ── Função auxiliar de PATCH ──────────────────────────────────
async function _sbPatch(path, body) {
  const url = _SB_BASE + path;
  const headers = { ..._SB_HEADS, 'Prefer': 'return=minimal' };
  let res;
  try {
    res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  } catch (networkErr) {
    throw new Error('Erro de rede: ' + networkErr.message);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => String(res.status));
    throw new Error('Supabase ' + res.status + ': ' + txt);
  }
  return true;
}

// ── Organograma — funções de leitura ──────────────────────────
async function sbCarregarGestores() {
  try {
    return await _sbGet('/gestores?ativo=eq.true&select=id,nome,setor&order=nome.asc');
  } catch(e) {
    console.error('[db] sbCarregarGestores:', e);
    return [];
  }
}

async function sbCarregarLideres() {
  try {
    return await _sbGet('/lideres?ativo=eq.true&select=id,nome,setor,gestor_id&order=nome.asc');
  } catch(e) {
    console.error('[db] sbCarregarLideres:', e);
    return [];
  }
}

// ── Organograma — funções de escrita ──────────────────────────
async function sbCriarGestor(nome, setor) {
  return _sbPost('/gestores', { nome, setor, ativo: true });
}

async function sbEditarGestor(id, nome, setor) {
  return _sbPatch('/gestores?id=eq.' + encodeURIComponent(id), { nome, setor });
}

async function sbExcluirGestor(id) {
  // Desvincula líderes antes de excluir o gestor (soft delete)
  await _sbPatch('/lideres?gestor_id=eq.' + encodeURIComponent(id), { ativo: false }).catch(() => {});
  return _sbPatch('/gestores?id=eq.' + encodeURIComponent(id), { ativo: false });
}

async function sbCriarLider(nome, setor, gestorId) {
  return _sbPost('/lideres', { nome, setor, gestor_id: gestorId, ativo: true });
}

async function sbEditarLider(id, nome, setor, gestorId) {
  return _sbPatch('/lideres?id=eq.' + encodeURIComponent(id), { nome, setor, gestor_id: gestorId });
}

async function sbExcluirLider(id) {
  return _sbPatch('/lideres?id=eq.' + encodeURIComponent(id), { ativo: false });
}

// ── Colaboradores — funções de leitura ──────────────────────── [ALTERADO]
async function sbCarregarColaboradores() {
  try {
    return await _sbGet('/colaboradores?ativo=eq.true&select=id,nome,cargo,setor,lider_direto&order=nome.asc');
  } catch(e) {
    console.error('[db] sbCarregarColaboradores:', e);
    return [];
  }
}

// ── Colaboradores — funções de escrita ──────────────────────── [ALTERADO]
async function sbCriarColaborador(nome, cargo, setor, liderDireto) {
  return _sbPost('/colaboradores', { nome, cargo, setor, lider_direto: liderDireto || null, ativo: true });
}

async function sbEditarColaborador(id, nome, cargo, setor, liderDireto) {
  return _sbPatch('/colaboradores?id=eq.' + encodeURIComponent(id), { nome, cargo, setor, lider_direto: liderDireto || null });
}

async function sbExcluirColaborador(id) {
  return _sbPatch('/colaboradores?id=eq.' + encodeURIComponent(id), { ativo: false });
}

/*
  ═══════════════════════════════════════════════════════════════
  SQL COMPLETO — SGRH Requisições RH (atualizado jun/2026)
  Execute no SQL Editor do Supabase: Project Settings → SQL Editor
  ═══════════════════════════════════════════════════════════════

  -- ── 1. Tabela de usuários e acesso ──────────────────────────
  CREATE TABLE IF NOT EXISTS usuarios_acesso (
    id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome               TEXT NOT NULL,
    codigo_acesso      TEXT NOT NULL UNIQUE,
    perfil             TEXT NOT NULL,
    setor              TEXT,
    gestor_responsavel TEXT,
    ativo              BOOLEAN DEFAULT true,
    created_at         TIMESTAMPTZ DEFAULT now()
  );

  -- ── 2. Tabela de vínculos gestor-líder ───────────────────────
  CREATE TABLE IF NOT EXISTS vinculos_gestor_lider (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gestor_id  UUID REFERENCES usuarios_acesso(id),
    lider_id   UUID REFERENCES usuarios_acesso(id),
    ativo      BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- ── 3. Tabela de gestores (Organograma) ──────────────────────
  CREATE TABLE IF NOT EXISTS gestores (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome       TEXT NOT NULL,
    setor      TEXT NOT NULL,
    ativo      BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- ── 4. Tabela de líderes (Organograma) ───────────────────────
  CREATE TABLE IF NOT EXISTS lideres (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome       TEXT NOT NULL,
    setor      TEXT NOT NULL,
    gestor_id  UUID REFERENCES gestores(id),
    ativo      BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- ── 5. Tabela de colaboradores (Organograma) ─────────────────
  CREATE TABLE IF NOT EXISTS colaboradores (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome         TEXT NOT NULL,
    cargo        TEXT NOT NULL,
    setor        TEXT NOT NULL,
    lider_direto TEXT,
    ativo        BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT now()
  );

  -- ── 6. Tabela Salarial (Organograma — nova) ──────────────────
  CREATE TABLE IF NOT EXISTS tabela_salarial (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cargo      TEXT NOT NULL,
    setor      TEXT NOT NULL,
    salario    TEXT NOT NULL,
    ativo      BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- ══ RLS — Habilitar segurança por linha ══════════════════════
  ALTER TABLE usuarios_acesso       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE vinculos_gestor_lider ENABLE ROW LEVEL SECURITY;
  ALTER TABLE gestores               ENABLE ROW LEVEL SECURITY;
  ALTER TABLE lideres                ENABLE ROW LEVEL SECURITY;
  ALTER TABLE colaboradores          ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tabela_salarial        ENABLE ROW LEVEL SECURITY;

  -- ══ Políticas de acesso anônimo (anon key) ═══════════════════

  -- usuarios_acesso
  CREATE POLICY "anon_select_usuarios" ON usuarios_acesso
    FOR SELECT TO anon USING (true);

  -- vinculos_gestor_lider
  CREATE POLICY "anon_select_vinculos" ON vinculos_gestor_lider
    FOR SELECT TO anon USING (true);

  -- gestores
  CREATE POLICY "anon_select_gestores" ON gestores FOR SELECT TO anon USING (true);
  CREATE POLICY "anon_insert_gestores" ON gestores FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "anon_update_gestores" ON gestores FOR UPDATE TO anon USING (true);

  -- lideres
  CREATE POLICY "anon_select_lideres"  ON lideres  FOR SELECT TO anon USING (true);
  CREATE POLICY "anon_insert_lideres"  ON lideres  FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "anon_update_lideres"  ON lideres  FOR UPDATE TO anon USING (true);

  -- colaboradores
  CREATE POLICY "anon_select_colab"    ON colaboradores FOR SELECT TO anon USING (true);
  CREATE POLICY "anon_insert_colab"    ON colaboradores FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "anon_update_colab"    ON colaboradores FOR UPDATE TO anon USING (true);

  -- tabela_salarial
  CREATE POLICY "anon_select_tabsal"   ON tabela_salarial FOR SELECT TO anon USING (true);
  CREATE POLICY "anon_insert_tabsal"   ON tabela_salarial FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "anon_update_tabsal"   ON tabela_salarial FOR UPDATE TO anon USING (true);

  -- ══ Dados iniciais — execute após criar as tabelas ════════════

  -- Gestores (pula se já existirem)
  INSERT INTO gestores (nome, setor)
  SELECT nome, setor FROM (VALUES
    ('Gustavo Toledo',    'Projetos'),
    ('Hugo',              'Inovação'),
    ('Haddad',            'Financeiro'),
    ('Matheus Fontenelle','Comercial')
  ) AS v(nome, setor)
  WHERE NOT EXISTS (SELECT 1 FROM gestores LIMIT 1);

  -- Após inserir gestores, copie os IDs retornados e insira os líderes:
  -- INSERT INTO lideres (nome, setor, gestor_id) VALUES
  --   ('Lizabeth Silva',    'Projetos',   '<uuid_gustavo>'),
  --   ('Juliana Vicente',   'Projetos',   '<uuid_gustavo>'),
  --   ('Ricardo Silveira',  'Inovação',   '<uuid_hugo>'),
  --   ('Nadia Vieira',      'Financeiro', '<uuid_haddad>'),
  --   ('Mariângela Ciodaro','Comercial',  '<uuid_matheus>');
  ═══════════════════════════════════════════════════════════════
*/

// ── Tabela Salarial — funções de leitura e escrita ───────────
async function sbCarregarTabelaSalarial() {
  try {
    return await _sbGet('/tabela_salarial?ativo=eq.true&select=id,cargo,setor,salario_clt,salario_pj&order=cargo.asc');
  } catch(e) {
    console.error('[db] sbCarregarTabelaSalarial:', e);
    return [];
  }
}

async function sbCriarEntradaSalarial(cargo, setor, salario_clt, salario_pj) {
  return _sbPost('/tabela_salarial', { cargo, setor, salario_clt, salario_pj, ativo: true });
}

async function sbEditarEntradaSalarial(id, cargo, setor, salario_clt, salario_pj) {
  return _sbPatch('/tabela_salarial?id=eq.' + encodeURIComponent(id), { cargo, setor, salario_clt, salario_pj });
}

async function sbExcluirEntradaSalarial(id) {
  return _sbPatch('/tabela_salarial?id=eq.' + encodeURIComponent(id), { ativo: false });
}

// ── Solicitações RH ───────────────────────────────────────────
/*
  Execute no SQL Editor do Supabase para criar a tabela de solicitações:

  CREATE TABLE IF NOT EXISTS solicitacoes (
    id               TEXT PRIMARY KEY,
    tipo             TEXT NOT NULL,
    status           TEXT NOT NULL,
    criado_por       TEXT,
    data_criacao     TIMESTAMPTZ,
    data_atualizacao TIMESTAMPTZ,
    objeto           JSONB NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT now()
  );

  ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "anon_select_solicitacoes" ON solicitacoes FOR SELECT TO anon USING (true);
  CREATE POLICY "anon_insert_solicitacoes" ON solicitacoes FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "anon_update_solicitacoes" ON solicitacoes FOR UPDATE TO anon USING (true);
  CREATE POLICY "anon_delete_solicitacoes" ON solicitacoes FOR DELETE TO anon USING (true);
*/

async function sbCarregarSolicitacoes() {
  try {
    const rows = await _sbGet('/solicitacoes?select=objeto&order=data_criacao.desc.nullslast');
    return (rows || []).map(r => r.objeto).filter(Boolean);
  } catch(e) {
    console.error('[db] sbCarregarSolicitacoes:', e);
    return null;
  }
}

async function sbUpsertSolicitacao(item) {
  const row = {
    id:               item.id,
    tipo:             item.tipo || '',
    status:           item.status || '',
    criado_por:       item.criadoPor || item.criadoPorNome || '',
    data_criacao:     item.dataCriacao || item.data_criacao || null,
    data_atualizacao: item.dataAtualizacao || item.data_ultima_edicao || null,
    objeto:           item
  };
  const url = _SB_BASE + '/solicitacoes';
  const headers = { ..._SB_HEADS, 'Prefer': 'resolution=merge-duplicates,return=minimal' };
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(row) });
  } catch(e) {
    throw new Error('Erro de rede: ' + e.message);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => String(res.status));
    throw new Error('Supabase ' + res.status + ': ' + txt);
  }
  return true;
}

async function sbExcluirSolicitacao(id) {
  const url = _SB_BASE + '/solicitacoes?id=eq.' + encodeURIComponent(id);
  let res;
  try {
    res = await fetch(url, { method: 'DELETE', headers: _SB_HEADS });
  } catch(e) {
    throw new Error('Erro de rede: ' + e.message);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => String(res.status));
    throw new Error('Supabase ' + res.status + ': ' + txt);
  }
  return true;
}

// ── Autenticar pelo código de acesso ─────────────────────────
async function autenticarPorCodigo(codigo) {
  if (!codigo || !codigo.trim()) {
    return { user: null, erro: 'Informe o código de acesso.' };
  }

  try {
    // Buscar usuário na tabela usuarios_acesso
    const enc = encodeURIComponent(codigo.trim());
    const rows = await _sbGet(
      '/usuarios_acesso' +
      '?codigo_acesso=eq.' + enc +
      '&ativo=eq.true' +
      '&select=id,nome,perfil,setor,gestor_responsavel' +
      '&limit=1'
    );

    if (!rows || rows.length === 0) {
      return { user: null, erro: 'Código inválido. Tente novamente.' };
    }

    const u = rows[0];

    // Para gestão: buscar nomes dos líderes vinculados
    let lideresVinculados = [];
    if (u.perfil === 'gestao') {
      const vinculos = await _sbGet(
        '/vinculos_gestor_lider' +
        '?gestor_id=eq.' + u.id +
        '&ativo=eq.true' +
        '&select=lider_id'
      );

      if (vinculos && vinculos.length > 0) {
        const ids = vinculos.map(v => v.lider_id);
        const lidRows = await _sbGet(
          '/usuarios_acesso' +
          '?id=in.(' + ids.join(',') + ')' +
          '&select=nome'
        );
        lideresVinculados = (lidRows || []).map(l => l.nome).filter(Boolean);
      }
    }

    // Objeto de sessão — código NUNCA incluído
    return {
      user: {
        id:                u.id,
        nome:              u.nome,
        perfil:            u.perfil,
        setor:             u.setor,
        gestor:            u.gestor_responsavel || null,
        lideresVinculados: lideresVinculados
      },
      erro: null
    };

  } catch (e) {
    console.error('[db] autenticarPorCodigo:', e);
    // Mensagem amigável sem expor detalhes técnicos ao usuário
    return { user: null, erro: 'Falha na conexão. Verifique sua internet e tente novamente.' };
  }
}
