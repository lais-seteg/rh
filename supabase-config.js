// ── Supabase REST API — fetch() direto ───────────────────────
// Sem biblioteca externa. Sem CDN. Sem conflito de nomes.
// Funciona com file://, Live Server e servidores web.
// Os códigos de acesso ficam APENAS no banco de dados.

const _SB_BASE = 'https://gpfitwckyqgmmyzncgpj.supabase.co/rest/v1';

// IMPORTANTE: use a chave "anon public" do seu projeto Supabase.
// Acesse: Supabase Dashboard → Project Settings → API → anon public
// A chave correta começa com "eyJ..." (formato JWT) OU "sb_publishable_..."
// se o seu projeto já usa o novo sistema de chaves.
const _SB_KEY  = 'sb_publishable_4hBxkrCEKz1WhinTLh0Yog_Ccx8ps4j';

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
