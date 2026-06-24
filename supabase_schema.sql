-- ═══════════════════════════════════════════════════════════════════
-- SGRH — Script completo para Supabase
-- Atualizado: junho / 2026
-- Execute no SQL Editor do Supabase: Project Settings → SQL Editor
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. Tabela de usuários e acesso ──────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios_acesso (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome               TEXT NOT NULL,
  codigo_acesso      TEXT NOT NULL UNIQUE,
  perfil             TEXT NOT NULL,   -- 'rh' | 'direcao' | 'gestao' | 'lider'
  setor              TEXT,
  gestor_responsavel TEXT,
  ativo              BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now()
);


-- ── 2. Tabela de vínculos gestor-líder ─────────────────────────────
CREATE TABLE IF NOT EXISTS vinculos_gestor_lider (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gestor_id  UUID REFERENCES usuarios_acesso(id),
  lider_id   UUID REFERENCES usuarios_acesso(id),
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ── 3. Gestores (Organograma) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS gestores (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  setor      TEXT NOT NULL,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ── 4. Líderes (Organograma) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lideres (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  setor      TEXT NOT NULL,
  gestor_id  UUID REFERENCES gestores(id),
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ── 5. Colaboradores da Seteg (Organograma) ────────────────────────
CREATE TABLE IF NOT EXISTS colaboradores (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome         TEXT NOT NULL,
  cargo        TEXT NOT NULL,
  setor        TEXT NOT NULL,
  lider_direto TEXT,
  ativo        BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);


-- ── 6. Tabela Salarial (Organograma) — NOVA ────────────────────────
CREATE TABLE IF NOT EXISTS tabela_salarial (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cargo      TEXT NOT NULL,
  setor      TEXT NOT NULL,
  salario    TEXT NOT NULL,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════
-- RLS — Row Level Security (segurança por linha)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE usuarios_acesso       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_gestor_lider ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestores               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lideres                ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabela_salarial        ENABLE ROW LEVEL SECURITY;


-- ── Políticas de acesso via chave anon ─────────────────────────────

-- usuarios_acesso (somente leitura — o sistema autentica por código)
CREATE POLICY "anon_select_usuarios"
  ON usuarios_acesso FOR SELECT TO anon USING (true);

-- vinculos_gestor_lider (somente leitura)
CREATE POLICY "anon_select_vinculos"
  ON vinculos_gestor_lider FOR SELECT TO anon USING (true);

-- gestores
CREATE POLICY "anon_select_gestores"
  ON gestores FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_gestores"
  ON gestores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_gestores"
  ON gestores FOR UPDATE TO anon USING (true);

-- lideres
CREATE POLICY "anon_select_lideres"
  ON lideres FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_lideres"
  ON lideres FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_lideres"
  ON lideres FOR UPDATE TO anon USING (true);

-- colaboradores
CREATE POLICY "anon_select_colab"
  ON colaboradores FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_colab"
  ON colaboradores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_colab"
  ON colaboradores FOR UPDATE TO anon USING (true);

-- tabela_salarial
CREATE POLICY "anon_select_tabsal"
  ON tabela_salarial FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_tabsal"
  ON tabela_salarial FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_tabsal"
  ON tabela_salarial FOR UPDATE TO anon USING (true);


-- ═══════════════════════════════════════════════════════════════════
-- DADOS INICIAIS
-- Execute este bloco SOMENTE se as tabelas estiverem vazias.
-- ═══════════════════════════════════════════════════════════════════

-- Gestores
INSERT INTO gestores (nome, setor)
SELECT nome, setor FROM (VALUES
  ('Gustavo Toledo',    'Projetos'),
  ('Hugo',              'Inovação'),
  ('Haddad',            'Financeiro'),
  ('Matheus Fontenelle','Comercial')
) AS v(nome, setor)
WHERE NOT EXISTS (SELECT 1 FROM gestores LIMIT 1);

-- Após inserir os gestores, copie os UUIDs gerados e insira os líderes
-- substituindo <uuid_xxx> pelos IDs reais:
--
-- INSERT INTO lideres (nome, setor, gestor_id) VALUES
--   ('Lizabeth Silva',     'Projetos',   '<uuid_gustavo>'),
--   ('Juliana Vicente',    'Projetos',   '<uuid_gustavo>'),
--   ('Marcelo Holderbaum', 'Projetos',   '<uuid_gustavo>'),
--   ('Carina Rodrigues',   'Projetos',   '<uuid_gustavo>'),
--   ('Fernando Sousa',     'Projetos',   '<uuid_gustavo>'),
--   ('Henrique Lima',      'Projetos',   '<uuid_gustavo>'),
--   ('Laize Rodrigues',    'Projetos',   '<uuid_gustavo>'),
--   ('Tiago Soares',       'Projetos',   '<uuid_gustavo>'),
--   ('Juliana Aquino',     'Projetos',   '<uuid_gustavo>'),
--   ('Gyrliane Sales',     'Projetos',   '<uuid_gustavo>'),
--   ('Ricardo Silveira',   'Inovação',   '<uuid_hugo>'),
--   ('Nadia Vieira',       'Financeiro', '<uuid_haddad>'),
--   ('Mariângela Ciodaro', 'Comercial',  '<uuid_matheus>');
