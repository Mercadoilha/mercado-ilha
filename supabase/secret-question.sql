-- Adiciona campos de pergunta/resposta secreta à tabela profiles
-- Usados para recuperação de senha sem e-mail (quando resposta correta)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS secret_question TEXT,
  ADD COLUMN IF NOT EXISTS secret_answer   TEXT;

-- A resposta é guardada em minúsculas e sem espaços extras para comparação case-insensitive.
-- Somente o próprio usuário (ou admin) pode ver/atualizar esses campos via RLS existente.
