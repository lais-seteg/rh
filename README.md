# SGRH — Sistema de Gestão de Requisições de Pessoal

Sistema web interno da **Seteg Soluções Ambientais** para gerenciamento do fluxo de requisições de pessoal. Permite que líderes e gestores criem solicitações de contratação ou mudança de cargo, e que RH e Direção as analisem, aprovem ou reprovem.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Como Rodar Localmente](#como-rodar-localmente)
- [Configuração do Supabase](#configuração-do-supabase)
- [Perfis de Acesso](#perfis-de-acesso)
- [Tipos de Solicitação](#tipos-de-solicitação)
- [Fluxo de Status](#fluxo-de-status)
- [Funcionalidades por Tela](#funcionalidades-por-tela)
- [Segurança](#segurança)
- [Deploy (Vercel)](#deploy-vercel)
- [Banco de Dados — SQL de Criação](#banco-de-dados--sql-de-criação)

---

## Visão Geral

O SGRH é uma aplicação **100% frontend** (HTML + CSS + JavaScript puro), sem frameworks ou bundlers. O backend é o [Supabase](https://supabase.com), acessado diretamente via REST API com `fetch()`. Não há servidor Node, PHP ou similar — basta servir os arquivos estáticos.

```
Usuário → Login com código de acesso → Dashboard → Criar / Acompanhar solicitações
                                                  ↓
                                         Gestor analisa
                                                  ↓
                                         RH analisa / encaminha
                                                  ↓
                                         Direção decide → Finaliza
```

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES2020+) |
| Backend / Banco | Supabase (PostgreSQL + REST API) |
| Hospedagem | Vercel (deploy automático via GitHub) |
| Fonte | Inter (Google Fonts) |
| Ícones | SVG inline (sem biblioteca externa) |

---

## Estrutura de Arquivos

```
requisicao_rh/
├── index.html          # Toda a estrutura HTML (login + app + modais)
├── style.css           # Estilos globais (tema escuro, componentes, responsividade)
├── script.js           # Toda a lógica da aplicação (autenticação, formulários, listagem, organograma)
├── supabase-config.js  # Funções de acesso ao banco (REST API via fetch)
├── config.js           # Credenciais do Supabase — NÃO vai ao repositório (gitignored)
├── config.example.js   # Modelo de configuração para novos ambientes
├── images/
│   ├── LOGO.png        # Logo da Seteg
│   └── favicon.png     # Ícone da aba do navegador
└── README.md           # Esta documentação
```

> **Atenção:** `config.js` está no `.gitignore` e nunca deve ser commitado. Ele contém as chaves da API.

---

## Como Rodar Localmente

### Pré-requisitos

- Qualquer servidor HTTP local (ex: extensão **Live Server** do VS Code, ou `npx serve`)
- Conta no Supabase com as tabelas criadas (ver seção abaixo)

### Passos

1. Clone o repositório:
   ```bash
   git clone https://github.com/lais-seteg/REQUISICAO_RH.git
   cd REQUISICAO_RH
   ```

2. Copie o arquivo de configuração:
   ```bash
   cp config.example.js config.js
   ```

3. Preencha `config.js` com suas credenciais do Supabase:
   ```js
   window.SB_URL = 'https://SEU_PROJETO.supabase.co/rest/v1';
   window.SB_KEY = 'sua_chave_anon_publica_aqui';
   ```

4. Abra `index.html` com um servidor local (não abrir direto como `file://` pode causar problemas de CORS em alguns navegadores).

---

## Configuração do Supabase

As credenciais ficam em **Project Settings → API** no painel do Supabase:

- **`SB_URL`**: URL do projeto + `/rest/v1` (ex: `https://xyzabc.supabase.co/rest/v1`)
- **`SB_KEY`**: Chave `anon public` — nunca use a `service_role` no frontend

---

## Perfis de Acesso

O sistema possui quatro perfis, cada um com visibilidade e permissões distintas:

| Perfil | Descrição | O que pode fazer |
|---|---|---|
| **Líder** | Colaborador com equipe direta | Cria solicitações; vê e edita apenas as próprias |
| **Gestão** | Gestor de área | Cria solicitações; analisa as dos líderes vinculados; aprova, reprova ou devolve |
| **RH** | Equipe de Recursos Humanos | Vê todas as solicitações; coloca em análise, aprova, reprova, encaminha ou finaliza |
| **Direção** | Diretoria | Vê todas as solicitações; aprova, reprova, encaminha ao RH ou finaliza |

A autenticação é feita por **código de acesso** armazenado exclusivamente no banco de dados (tabela `usuarios_acesso`). O código nunca é salvo em `sessionStorage` — apenas os dados do usuário (nome, perfil, setor).

---

## Tipos de Solicitação

### 1. Requisição de Pessoal — Seleção Externa
Usada para abrir uma vaga para contratação no mercado. Campos principais:
- Cargo, tipo de contrato (CLT, PJ, Estágio, Horista), horário, salário
- Setor/cliente, departamento/projeto, empresa (Seteg ou Licenza)
- Número de vagas, modalidade (Presencial, Híbrido, Remoto), data de início
- Tipo de requisição: Substituição, Aumento de Quadro, Licença/Afastamento, Quadro Extra
- Benefícios oferecidos (checkboxes com VA, VT, Plano de Saúde, etc.)
- Dados do solicitante e perfil desejado (formação, conhecimentos, experiência)

### 2. Requisição de Pessoal — Indicação
Mesmos campos da Seleção Externa, com campo adicional para o **nome da pessoa indicada**.

### 3. Solicitação de Mudança de Cargo
Usada para promoções, transferências ou readequações internas. Campos principais:
- Dados atuais do colaborador: nome, setor, cargo, líder, salário, horário
- Dados da mudança: cargo proposto, setor de destino, novo líder, salário novo, horário novo, data prevista
- Tipo de mudança: Promoção, Readequação, Transferência lateral, Outra
- Benefícios e justificativa

---

## Fluxo de Status

```
[Criada]
    ↓
Aguardando análise do gestor
    ├── Aprovada pelo gestor → (Direção pode encaminhar ao RH ou decidir)
    ├── Reprovada pelo gestor → (encerrado)
    └── Devolvida para ajuste → Solicitante corrige e reenvia ao gestor
                                        ↓
                              Encaminhada ao RH
                                        ↓
                              Em análise pelo RH
                                        ├── Aprovada pelo RH
                                        ├── Reprovada pelo RH
                                        ├── Devolvida para ajuste
                                        └── Finalizada
                                        ↓
                              Aprovada pela Direção
                              Reprovada pela Direção
                                        ↓
                                    Finalizada
```

Toda mudança de status exige uma **observação/justificativa** obrigatória quando a ação é de reprovação ou devolução.

---

## Funcionalidades por Tela

### Login
- Campo de código de acesso com **toggle de visibilidade** (ícone de olho)
- Validação no banco antes de autenticar
- Sessão salva em `sessionStorage` (encerra ao fechar o navegador)
- Mensagem de erro amigável sem expor detalhes técnicos

### Dashboard
- Barra de boas-vindas com nome e perfil do usuário
- **KPIs** (cards de contagem) por status: Total, Aguard. Gestor, Aprov. Gestor, Enc. ao RH, Análise RH, Aprovadas, Reprovadas, Finalizadas
- Tabela de **solicitações recentes** com paginação (10 por página)
- Botão "Ver →" que abre o modal de detalhes

### Nova Solicitação
- Seleção do tipo (Seleção, Indicação ou Mudança de Cargo) via cards visuais
- Formulário em seções numeradas com validação de campos obrigatórios
- Textos convertidos automaticamente para **maiúsculas** ao digitar
- Máscara monetária (R$) nos campos de salário
- Campo de formação "Outros" com especificação dinâmica

### Solicitações
- Tabela com todas as solicitações visíveis ao perfil logado
- **Filtros rápidos** por status (pills horizontais roláveis)
- **Filtros avançados**: tipo, solicitante, gestor, setor, data de criação
- Busca textual por cargo, projeto ou solicitante
- Paginação configurável (10, 20 ou 50 registros por página)
- Ações: Ver detalhes, Editar (se permitido), Excluir (se permitido), Alterar status
- Para gestores: filtro de origem (Próprias / Dos Liderados / Todas)

### Organograma
- Visualização da hierarquia gestores → líderes carregada do banco
- CRUD completo de gestores e líderes (apenas para perfis autorizados)
- Soft delete (registro marcado como `ativo = false`, nunca excluído fisicamente)

---

## Segurança

- **Códigos de acesso** ficam apenas no banco (`usuarios_acesso.codigo_acesso`) — nunca no frontend ou sessionStorage
- **Row Level Security (RLS)** habilitada em todas as tabelas do Supabase
- **Chave `anon`** usada no frontend — permissões mínimas necessárias
- **`config.js` no `.gitignore`** — credenciais nunca vão ao repositório
- Todos os valores exibidos no DOM passam pela função `esc()` (escape de HTML) para evitar XSS
- Sessão limitada a `sessionStorage` — expira ao fechar o navegador

---

## Deploy (Vercel)

O projeto é hospedado na **Vercel** com deploy automático a partir do branch `master`.

- `config.js` não existe no repositório — as credenciais são configuradas como **Environment Variables** na Vercel, e o arquivo é gerado em tempo de build via `vercel.json` ou script de pré-build.
- Qualquer push para `master` dispara um novo deploy automaticamente.

Para configurar um novo projeto na Vercel:
1. Importe o repositório no painel da Vercel
2. Configure as variáveis de ambiente `SB_URL` e `SB_KEY`
3. Verifique que `config.js` é gerado corretamente antes do deploy

---

## Banco de Dados — SQL de Criação

Execute no **SQL Editor** do Supabase (Settings → SQL Editor):

```sql
-- Tabela de usuários com acesso ao sistema
CREATE TABLE IF NOT EXISTS usuarios_acesso (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome                TEXT NOT NULL,
  perfil              TEXT NOT NULL CHECK (perfil IN ('rh','direcao','gestao','lider')),
  setor               TEXT,
  gestor_responsavel  TEXT,
  codigo_acesso       TEXT NOT NULL UNIQUE,
  ativo               BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Tabela de gestores (organograma)
CREATE TABLE IF NOT EXISTS gestores (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  setor      TEXT NOT NULL,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de líderes (organograma)
CREATE TABLE IF NOT EXISTS lideres (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  setor      TEXT NOT NULL,
  gestor_id  UUID REFERENCES gestores(id),
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vínculo gestor ↔ líder (para permissões de gestão)
CREATE TABLE IF NOT EXISTS vinculos_gestor_lider (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gestor_id  UUID REFERENCES usuarios_acesso(id),
  lider_id   UUID REFERENCES usuarios_acesso(id),
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE usuarios_acesso      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lideres              ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_gestor_lider ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (chave anon)
CREATE POLICY "anon_select_usuarios"  ON usuarios_acesso      FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_gestores"  ON gestores             FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_gestores"  ON gestores             FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_gestores"  ON gestores             FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_select_lideres"   ON lideres              FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_lideres"   ON lideres              FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_lideres"   ON lideres              FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_select_vinculos"  ON vinculos_gestor_lider FOR SELECT TO anon USING (true);
```

---

## Benefícios Cadastrados

| ID | Descrição |
|---|---|
| `va` | Vale Alimentação (Cartão Caju) |
| `am` | Auxílio Mobilidade |
| `vt` | Vale Transporte (VT) |
| `ps` | Plano de Saúde |
| `po` | Plano Odontológico |
| `sv` | Seguro de Vida |
| `do` | Day Off de Aniversário |
| `ac` | Ajuda de Custo (Moradia) |

---

*Seteg Soluções Ambientais · 2026*
