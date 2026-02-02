-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ALUNO', 'PROFESSOR', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "NivelDificuldade" AS ENUM ('MUITO_FACIL', 'FACIL', 'MEDIO', 'DIFICIL', 'MUITO_DIFICIL');

-- CreateEnum
CREATE TYPE "NivelCognitivo" AS ENUM ('LEMBRAR', 'ENTENDER', 'APLICAR', 'ANALISAR', 'AVALIAR', 'CRIAR');

-- CreateEnum
CREATE TYPE "StatusSimulado" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'ABANDONADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "CategoriaOrigem" AS ENUM ('INSTITUCIONAL_INTERNA', 'CONCURSO_PUBLICO', 'CONCURSO_MILITAR', 'VESTIBULAR', 'CERTIFICACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "RaridadeConquista" AS ENUM ('COMUM', 'INCOMUM', 'RARO', 'EPICO', 'LENDARIO', 'MITICO');

-- CreateEnum
CREATE TYPE "CategoriaConquista" AS ENUM ('INICIO_ENGAJAMENTO', 'PERFORMANCE_VELOCIDADE', 'MAESTRIA_UC', 'OBJETO_CONHECIMENTO', 'DESEMPENHO_AVANCADO', 'OCULTA', 'IMPOSSIVEL');

-- CreateEnum
CREATE TYPE "TipoRequisitoConquista" AS ENUM ('SIMULADOS_TOTAL', 'QUESTOES_TOTAL', 'ACERTOS_TOTAL', 'STREAK_DIAS', 'NIVEL_ALCANCADO', 'NOTA_PERCENTUAL_MINIMA', 'SIMULADO_TIPO_ESPECIFICO', 'CONQUISTAS_TOTAL', 'TEMPO_ESTUDO_HORAS', 'REVISOES_ERRO_TOTAL', 'HORARIO_ESPECIFICO', 'QUESTOES_NO_SIMULADO_MIN', 'TEMPO_GASTO_SEGUNDOS_MAX', 'ACERTOS_NO_SIMULADO_MIN', 'ERROS_NO_SIMULADO_MAX');

-- CreateEnum
CREATE TYPE "TipoEventoGamificacao" AS ENUM ('LOGIN', 'SIMULADO_FINALIZADO', 'SIMULADO_ANULADO', 'SIMULADO_ABANDONADO', 'QUESTAO_RESPONDIDA', 'CADERNO_ERROS_REVISADA', 'PERFIL_ATUALIZADO', 'RANKING_ATUALIZADO', 'MANUAL');

-- CreateEnum
CREATE TYPE "EventoConquista" AS ENUM ('LOGIN', 'SIMULADO_FINALIZADO', 'CADERNO_ERROS', 'PERFIL', 'RANKING', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusAuditoriaConquista" AS ENUM ('APROVADA', 'PENDENTE', 'REJEITADA');

-- CreateEnum
CREATE TYPE "TipoMovimentoPontos" AS ENUM ('LOGIN_DIARIO', 'SIMULADO_COMPLETO', 'META_QUESTOES', 'ACERTO_QUESTAO', 'CONQUISTA', 'STREAK_BONUS', 'AJUSTE_ADMIN');

-- CreateEnum
CREATE TYPE "TipoStreak" AS ENUM ('LOGIN', 'SIMULADO', 'CADERNO_ERROS');

-- CreateEnum
CREATE TYPE "TipoJanela" AS ENUM ('EM_DIAS', 'EM_SEMANAS', 'EM_MESES');

-- CreateEnum
CREATE TYPE "OperadorComparacao" AS ENUM ('GTE', 'LTE', 'EQ', 'BETWEEN');

-- CreateEnum
CREATE TYPE "LogicaGrupo" AS ENUM ('AND', 'OR');

-- CreateEnum
CREATE TYPE "RankingPeriodo" AS ENUM ('SEMANAL', 'MENSAL', 'ROLLING_90D', 'ROLLING_180D', 'ROLLING_12M', 'GERAL');

-- CreateEnum
CREATE TYPE "RankingTipo" AS ENUM ('XP_GANHO', 'XP_TOTAL', 'STREAK');

-- CreateEnum
CREATE TYPE "MetricaConquista" AS ENUM ('SIMULADOS_TOTAL', 'QUESTOES_TOTAL', 'ACERTOS_TOTAL', 'ERROS_TOTAL', 'STREAK_DIAS', 'NIVEL_ALCANCADO', 'NOTA_PERCENTUAL', 'QUESTOES_NO_SIMULADO', 'ACERTOS_NO_SIMULADO', 'ERROS_NO_SIMULADO', 'TEMPO_ESTUDO_MINUTOS', 'TEMPO_GASTO_SEGUNDOS', 'RANK_POSICAO', 'RANK_PERCENTIL', 'RANK_VALOR');

-- CreateTable
CREATE TABLE "Instituicao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Instituicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banca" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Banca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conquista" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "requisitoTipo" "TipoRequisitoConquista",
    "requisitoValor" INTEGER,
    "raridade" "RaridadeConquista" NOT NULL DEFAULT 'COMUM',
    "categoria" "CategoriaConquista" NOT NULL DEFAULT 'INICIO_ENGAJAMENTO',
    "pontos" INTEGER NOT NULL DEFAULT 10,
    "bonusMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "oculta" BOOLEAN NOT NULL DEFAULT false,
    "impossivel" BOOLEAN NOT NULL DEFAULT false,
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "requiresManualAudit" BOOLEAN NOT NULL DEFAULT false,
    "icone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cooldownDias" INTEGER,
    "maximoPorPeriodo" INTEGER,
    "evento" "EventoConquista" NOT NULL DEFAULT 'SIMULADO_FINALIZADO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "unidadeCurricularId" INTEGER,
    "conhecimentoId" INTEGER,

    CONSTRAINT "Conquista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Titulo" (
    "id" SERIAL NOT NULL,
    "nivel" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "minPontos" INTEGER NOT NULL,
    "urlImagem" TEXT,
    "corHex" TEXT,

    CONSTRAINT "Titulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoUsuario" NOT NULL DEFAULT 'ALUNO',
    "fotoUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "mudancaSenhaObrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "tokenVerificacao" TEXT,
    "tokenExpiraEm" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiraEm" TIMESTAMP(3),
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioGamificacao" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "ultimoEmailConquistasEm" TIMESTAMP(3),
    "acertosTotal" INTEGER NOT NULL DEFAULT 0,
    "errosTotal" INTEGER NOT NULL DEFAULT 0,
    "pontos" INTEGER NOT NULL DEFAULT 0,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "badges" TEXT[],
    "tempoTotalEstudo" INTEGER NOT NULL DEFAULT 0,
    "simuladosConcluidos" INTEGER NOT NULL DEFAULT 0,
    "questoesRespondidas" INTEGER NOT NULL DEFAULT 0,
    "simuladosAnulados" INTEGER NOT NULL DEFAULT 0,
    "simuladosAbandonados" INTEGER NOT NULL DEFAULT 0,
    "preferencias" JSONB DEFAULT '{}',
    "tituloId" INTEGER,
    "streakAtual" INTEGER NOT NULL DEFAULT 0,
    "maiorStreak" INTEGER NOT NULL DEFAULT 0,
    "ultimoLoginStreak" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioGamificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioStreak" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoStreak" NOT NULL,
    "atual" INTEGER NOT NULL DEFAULT 0,
    "recorde" INTEGER NOT NULL DEFAULT 0,
    "ultimoDia" TIMESTAMP(3),

    CONSTRAINT "UsuarioStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioConquista" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "conquistaId" INTEGER NOT NULL,
    "dataConquista" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusAuditoria" "StatusAuditoriaConquista" NOT NULL DEFAULT 'APROVADA',
    "auditadaPorId" INTEGER,
    "eventoId" INTEGER,
    "pontosConcedidos" INTEGER,
    "multiplierAplicado" DOUBLE PRECISION,
    "notificadoEm" TIMESTAMP(3),
    "contexto" JSONB,

    CONSTRAINT "UsuarioConquista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioMetricasDiarias" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "dia" DATE NOT NULL,
    "xpGanho" INTEGER NOT NULL DEFAULT 0,
    "simuladosConcluidos" INTEGER NOT NULL DEFAULT 0,
    "questoesRespondidas" INTEGER NOT NULL DEFAULT 0,
    "acertos" INTEGER NOT NULL DEFAULT 0,
    "tempoEstudoMin" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsuarioMetricasDiarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoPontos" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "tipo" "TipoMovimentoPontos" NOT NULL,
    "motivo" TEXT,
    "metadata" JSONB,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simuladoId" INTEGER,
    "conquistaId" INTEGER,
    "dedupKey" TEXT,
    "saldoApos" INTEGER,

    CONSTRAINT "HistoricoPontos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamificacaoEvento" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoEventoGamificacao" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simuladoId" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "GamificacaoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConquistaRegra" (
    "id" SERIAL NOT NULL,
    "conquistaId" INTEGER NOT NULL,
    "metrica" "MetricaConquista" NOT NULL,
    "operador" "OperadorComparacao" NOT NULL DEFAULT 'GTE',
    "valorInt" INTEGER,
    "valorFloat" DOUBLE PRECISION,
    "janelaTipo" "TipoJanela",
    "janelaValor" INTEGER,
    "grupo" INTEGER NOT NULL DEFAULT 0,
    "logicaGrupo" "LogicaGrupo" NOT NULL DEFAULT 'AND',
    "unidadeCurricularId" INTEGER,
    "conhecimentoId" INTEGER,
    "tipoSimulado" TEXT,

    CONSTRAINT "ConquistaRegra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" SERIAL NOT NULL,
    "periodo" "RankingPeriodo" NOT NULL,
    "tipo" "RankingTipo" NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "totalUsuarios" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingEntry" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "posicao" INTEGER NOT NULL,
    "valorInt" INTEGER NOT NULL,
    "percentil" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RankingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioBadge" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "obtidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestaoFavorita" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "questaoId" INTEGER NOT NULL,

    CONSTRAINT "QuestaoFavorita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoTecnico" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursoTecnico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadeCurricular" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargaHoraria" INTEGER,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cursoTecnicoId" INTEGER NOT NULL,

    CONSTRAINT "UnidadeCurricular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subfuncao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "funcaoId" INTEGER NOT NULL,

    CONSTRAINT "Subfuncao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capacidade" (
    "id" SERIAL NOT NULL,
    "sigla" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capacidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjetoConhecimento" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjetoConhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubConhecimento" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conhecimentoId" INTEGER NOT NULL,

    CONSTRAINT "SubConhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoFuncao" (
    "id" SERIAL NOT NULL,
    "cursoTecnicoId" INTEGER NOT NULL,
    "funcaoId" INTEGER NOT NULL,

    CONSTRAINT "CursoFuncao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadeCurricularConhecimento" (
    "id" SERIAL NOT NULL,
    "ordem" INTEGER,
    "cargaHorariaParcial" INTEGER,
    "unidadeCurricularId" INTEGER NOT NULL,
    "conhecimentoId" INTEGER NOT NULL,

    CONSTRAINT "UnidadeCurricularConhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacidadeConhecimento" (
    "id" SERIAL NOT NULL,
    "capacidadeId" INTEGER NOT NULL,
    "conhecimentoId" INTEGER NOT NULL,

    CONSTRAINT "CapacidadeConhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubfuncaoCapacidade" (
    "id" SERIAL NOT NULL,
    "subfuncaoId" INTEGER NOT NULL,
    "capacidadeId" INTEGER NOT NULL,

    CONSTRAINT "SubfuncaoCapacidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoEstudo" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "duracaoSeg" INTEGER,
    "origem" TEXT,

    CONSTRAINT "SessaoEstudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "enunciado" TEXT NOT NULL,
    "alternativaA" TEXT NOT NULL,
    "alternativaB" TEXT NOT NULL,
    "alternativaC" TEXT NOT NULL,
    "alternativaD" TEXT NOT NULL,
    "alternativaE" TEXT NOT NULL,
    "alternativaCorreta" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "dificuldade" "NivelDificuldade" DEFAULT 'MEDIO',
    "nivelCognitivo" "NivelCognitivo" DEFAULT 'APLICAR',
    "categoriaOrigem" "CategoriaOrigem" DEFAULT 'INSTITUCIONAL_INTERNA',
    "instituicaoId" INTEGER,
    "bancaId" INTEGER,
    "ano" INTEGER,
    "prova" TEXT,
    "observacoes" TEXT,
    "palavrasChave" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cursoTecnicoId" INTEGER,
    "unidadeCurricularId" INTEGER,
    "funcaoId" INTEGER,
    "subfuncaoId" INTEGER,
    "conhecimentoId" INTEGER,
    "subConhecimentoId" INTEGER,
    "capacidadeId" INTEGER,

    CONSTRAINT "Questao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagemQuestao" (
    "id" SERIAL NOT NULL,
    "url" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "dados" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "questaoId" INTEGER NOT NULL,

    CONSTRAINT "ImagemQuestao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulado" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "tipo" TEXT NOT NULL,
    "qtdeQuestoes" INTEGER NOT NULL,
    "tempoLimiteMinutos" INTEGER NOT NULL,
    "tempoGastoSegundos" INTEGER,
    "tempoGastoMinutos" INTEGER,
    "alertasTempo" INTEGER[] DEFAULT ARRAY[30, 10, 5]::INTEGER[],
    "dataInicio" TIMESTAMP(3),
    "dataConclusao" TIMESTAMP(3),
    "notaAcertos" INTEGER,
    "notaPercentual" DOUBLE PRECISION,
    "status" "StatusSimulado" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "questoesRespondidas" INTEGER,
    "acertos" INTEGER,
    "erros" INTEGER,
    "mediaTempoPorQuestaoSeg" DOUBLE PRECISION,
    "gamificacaoProcessadaEm" TIMESTAMP(3),
    "xpConcedido" INTEGER,
    "strikesUsados" INTEGER NOT NULL DEFAULT 0,
    "strikesMax" INTEGER NOT NULL DEFAULT 3,
    "anuladoMotivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usuarioId" INTEGER,

    CONSTRAINT "Simulado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoSimulado" (
    "id" SERIAL NOT NULL,
    "simuladoId" INTEGER NOT NULL,
    "feedbackGeral" TEXT NOT NULL,
    "pontosFortes" TEXT,
    "pontosFracos" TEXT,
    "recomendacoes" TEXT,
    "modeloIA" TEXT,
    "versaoPrompt" INTEGER NOT NULL DEFAULT 1,
    "tokensTotal" INTEGER,
    "tempoGeracaoMs" INTEGER,
    "metricasResumo" JSONB DEFAULT '{}',
    "hashEntrada" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoSimulado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimuladosQuestao" (
    "id" SERIAL NOT NULL,
    "alternativaMarcada" TEXT,
    "correta" BOOLEAN,
    "tempoResposta" INTEGER,
    "simuladoId" INTEGER NOT NULL,
    "questaoId" INTEGER NOT NULL,

    CONSTRAINT "SimuladosQuestao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestaoErro" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "questaoId" INTEGER NOT NULL,
    "vezesErrada" INTEGER NOT NULL DEFAULT 1,
    "ultimoErro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisada" BOOLEAN NOT NULL DEFAULT false,
    "proximaRevisao" TIMESTAMP(3),

    CONSTRAINT "QuestaoErro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestaoTentativa" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "questaoId" INTEGER NOT NULL,
    "alternativaMarcada" TEXT NOT NULL,
    "correta" BOOLEAN NOT NULL,
    "tempoResposta" INTEGER,
    "origem" TEXT,

    CONSTRAINT "QuestaoTentativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER,
    "usuarioNome" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "acao" TEXT NOT NULL,
    "recurso" TEXT,
    "detalhes" JSONB,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenBlacklist" (
    "id" SERIAL NOT NULL,
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instituicao_codigo_key" ON "Instituicao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Instituicao_nome_key" ON "Instituicao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Instituicao_sigla_key" ON "Instituicao"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "Banca_codigo_key" ON "Banca"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Banca_nome_key" ON "Banca"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Banca_sigla_key" ON "Banca"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "Conquista_key_key" ON "Conquista"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_nivel_key" ON "Titulo"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_minPontos_key" ON "Titulo"("minPontos");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioGamificacao_usuarioId_key" ON "UsuarioGamificacao"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuarioGamificacao_pontos_nivel_idx" ON "UsuarioGamificacao"("pontos", "nivel");

-- CreateIndex
CREATE INDEX "UsuarioGamificacao_streakAtual_idx" ON "UsuarioGamificacao"("streakAtual");

-- CreateIndex
CREATE INDEX "UsuarioStreak_usuarioId_tipo_idx" ON "UsuarioStreak"("usuarioId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioStreak_usuarioId_tipo_key" ON "UsuarioStreak"("usuarioId", "tipo");

-- CreateIndex
CREATE INDEX "UsuarioConquista_usuarioId_idx" ON "UsuarioConquista"("usuarioId");

-- CreateIndex
CREATE INDEX "UsuarioConquista_conquistaId_idx" ON "UsuarioConquista"("conquistaId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioConquista_usuarioId_conquistaId_key" ON "UsuarioConquista"("usuarioId", "conquistaId");

-- CreateIndex
CREATE INDEX "UsuarioMetricasDiarias_dia_idx" ON "UsuarioMetricasDiarias"("dia");

-- CreateIndex
CREATE INDEX "UsuarioMetricasDiarias_usuarioId_dia_idx" ON "UsuarioMetricasDiarias"("usuarioId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioMetricasDiarias_usuarioId_dia_key" ON "UsuarioMetricasDiarias"("usuarioId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricoPontos_dedupKey_key" ON "HistoricoPontos"("dedupKey");

-- CreateIndex
CREATE INDEX "HistoricoPontos_usuarioId_data_idx" ON "HistoricoPontos"("usuarioId", "data");

-- CreateIndex
CREATE INDEX "HistoricoPontos_usuarioId_tipo_data_idx" ON "HistoricoPontos"("usuarioId", "tipo", "data");

-- CreateIndex
CREATE INDEX "GamificacaoEvento_usuarioId_tipo_createdAt_idx" ON "GamificacaoEvento"("usuarioId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "GamificacaoEvento_tipo_createdAt_idx" ON "GamificacaoEvento"("tipo", "createdAt");

-- CreateIndex
CREATE INDEX "ConquistaRegra_conquistaId_idx" ON "ConquistaRegra"("conquistaId");

-- CreateIndex
CREATE INDEX "RankingSnapshot_periodo_tipo_fim_idx" ON "RankingSnapshot"("periodo", "tipo", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "RankingSnapshot_periodo_tipo_inicio_fim_key" ON "RankingSnapshot"("periodo", "tipo", "inicio", "fim");

-- CreateIndex
CREATE INDEX "RankingEntry_snapshotId_posicao_idx" ON "RankingEntry"("snapshotId", "posicao");

-- CreateIndex
CREATE INDEX "RankingEntry_usuarioId_idx" ON "RankingEntry"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "RankingEntry_snapshotId_usuarioId_key" ON "RankingEntry"("snapshotId", "usuarioId");

-- CreateIndex
CREATE INDEX "UsuarioBadge_usuarioId_idx" ON "UsuarioBadge"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioBadge_usuarioId_badgeKey_key" ON "UsuarioBadge"("usuarioId", "badgeKey");

-- CreateIndex
CREATE INDEX "QuestaoFavorita_usuarioId_idx" ON "QuestaoFavorita"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestaoFavorita_usuarioId_questaoId_key" ON "QuestaoFavorita"("usuarioId", "questaoId");

-- CreateIndex
CREATE UNIQUE INDEX "CursoTecnico_codigo_key" ON "CursoTecnico"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CursoTecnico_nome_key" ON "CursoTecnico"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeCurricular_codigo_key" ON "UnidadeCurricular"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeCurricular_nome_key" ON "UnidadeCurricular"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Funcao_codigo_key" ON "Funcao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Funcao_nome_key" ON "Funcao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Subfuncao_codigo_key" ON "Subfuncao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Subfuncao_nome_key" ON "Subfuncao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Capacidade_sigla_key" ON "Capacidade"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "ObjetoConhecimento_codigo_key" ON "ObjetoConhecimento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ObjetoConhecimento_nome_key" ON "ObjetoConhecimento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "SubConhecimento_codigo_key" ON "SubConhecimento"("codigo");

-- CreateIndex
CREATE INDEX "CursoFuncao_cursoTecnicoId_idx" ON "CursoFuncao"("cursoTecnicoId");

-- CreateIndex
CREATE INDEX "CursoFuncao_funcaoId_idx" ON "CursoFuncao"("funcaoId");

-- CreateIndex
CREATE UNIQUE INDEX "CursoFuncao_cursoTecnicoId_funcaoId_key" ON "CursoFuncao"("cursoTecnicoId", "funcaoId");

-- CreateIndex
CREATE INDEX "UnidadeCurricularConhecimento_unidadeCurricularId_idx" ON "UnidadeCurricularConhecimento"("unidadeCurricularId");

-- CreateIndex
CREATE INDEX "UnidadeCurricularConhecimento_conhecimentoId_idx" ON "UnidadeCurricularConhecimento"("conhecimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeCurricularConhecimento_unidadeCurricularId_conhecime_key" ON "UnidadeCurricularConhecimento"("unidadeCurricularId", "conhecimentoId");

-- CreateIndex
CREATE INDEX "CapacidadeConhecimento_capacidadeId_idx" ON "CapacidadeConhecimento"("capacidadeId");

-- CreateIndex
CREATE INDEX "CapacidadeConhecimento_conhecimentoId_idx" ON "CapacidadeConhecimento"("conhecimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "CapacidadeConhecimento_capacidadeId_conhecimentoId_key" ON "CapacidadeConhecimento"("capacidadeId", "conhecimentoId");

-- CreateIndex
CREATE INDEX "SubfuncaoCapacidade_subfuncaoId_idx" ON "SubfuncaoCapacidade"("subfuncaoId");

-- CreateIndex
CREATE INDEX "SubfuncaoCapacidade_capacidadeId_idx" ON "SubfuncaoCapacidade"("capacidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "SubfuncaoCapacidade_subfuncaoId_capacidadeId_key" ON "SubfuncaoCapacidade"("subfuncaoId", "capacidadeId");

-- CreateIndex
CREATE INDEX "SessaoEstudo_usuarioId_inicio_idx" ON "SessaoEstudo"("usuarioId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "Questao_codigo_key" ON "Questao"("codigo");

-- CreateIndex
CREATE INDEX "Questao_ativa_idx" ON "Questao"("ativa");

-- CreateIndex
CREATE INDEX "Questao_instituicaoId_idx" ON "Questao"("instituicaoId");

-- CreateIndex
CREATE INDEX "Questao_cursoTecnicoId_idx" ON "Questao"("cursoTecnicoId");

-- CreateIndex
CREATE INDEX "Questao_unidadeCurricularId_idx" ON "Questao"("unidadeCurricularId");

-- CreateIndex
CREATE INDEX "Questao_dificuldade_idx" ON "Questao"("dificuldade");

-- CreateIndex
CREATE INDEX "Questao_nivelCognitivo_idx" ON "Questao"("nivelCognitivo");

-- CreateIndex
CREATE INDEX "ImagemQuestao_questaoId_idx" ON "ImagemQuestao"("questaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Simulado_codigo_key" ON "Simulado"("codigo");

-- CreateIndex
CREATE INDEX "Simulado_usuarioId_status_createdAt_idx" ON "Simulado"("usuarioId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Simulado_status_createdAt_idx" ON "Simulado"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Simulado_tipo_status_idx" ON "Simulado"("tipo", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoSimulado_simuladoId_key" ON "AvaliacaoSimulado"("simuladoId");

-- CreateIndex
CREATE INDEX "SimuladosQuestao_simuladoId_idx" ON "SimuladosQuestao"("simuladoId");

-- CreateIndex
CREATE INDEX "SimuladosQuestao_questaoId_idx" ON "SimuladosQuestao"("questaoId");

-- CreateIndex
CREATE UNIQUE INDEX "SimuladosQuestao_simuladoId_questaoId_key" ON "SimuladosQuestao"("simuladoId", "questaoId");

-- CreateIndex
CREATE INDEX "QuestaoErro_usuarioId_revisada_idx" ON "QuestaoErro"("usuarioId", "revisada");

-- CreateIndex
CREATE INDEX "QuestaoErro_questaoId_idx" ON "QuestaoErro"("questaoId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestaoErro_usuarioId_questaoId_key" ON "QuestaoErro"("usuarioId", "questaoId");

-- CreateIndex
CREATE INDEX "QuestaoTentativa_usuarioId_idx" ON "QuestaoTentativa"("usuarioId");

-- CreateIndex
CREATE INDEX "QuestaoTentativa_questaoId_idx" ON "QuestaoTentativa"("questaoId");

-- CreateIndex
CREATE INDEX "QuestaoTentativa_createdAt_idx" ON "QuestaoTentativa"("createdAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_acao_idx" ON "LogAuditoria"("usuarioId", "acao");

-- CreateIndex
CREATE INDEX "LogAuditoria_createdAt_idx" ON "LogAuditoria"("createdAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_acao_idx" ON "LogAuditoria"("acao");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBlacklist_jti_key" ON "TokenBlacklist"("jti");

-- CreateIndex
CREATE INDEX "TokenBlacklist_jti_idx" ON "TokenBlacklist"("jti");

-- CreateIndex
CREATE INDEX "TokenBlacklist_expiresAt_idx" ON "TokenBlacklist"("expiresAt");

-- AddForeignKey
ALTER TABLE "Conquista" ADD CONSTRAINT "Conquista_unidadeCurricularId_fkey" FOREIGN KEY ("unidadeCurricularId") REFERENCES "UnidadeCurricular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conquista" ADD CONSTRAINT "Conquista_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "ObjetoConhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioGamificacao" ADD CONSTRAINT "UsuarioGamificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioGamificacao" ADD CONSTRAINT "UsuarioGamificacao_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioStreak" ADD CONSTRAINT "UsuarioStreak_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioConquista" ADD CONSTRAINT "UsuarioConquista_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioConquista" ADD CONSTRAINT "UsuarioConquista_conquistaId_fkey" FOREIGN KEY ("conquistaId") REFERENCES "Conquista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioConquista" ADD CONSTRAINT "UsuarioConquista_auditadaPorId_fkey" FOREIGN KEY ("auditadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioConquista" ADD CONSTRAINT "UsuarioConquista_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "GamificacaoEvento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioMetricasDiarias" ADD CONSTRAINT "UsuarioMetricasDiarias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPontos" ADD CONSTRAINT "HistoricoPontos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPontos" ADD CONSTRAINT "HistoricoPontos_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPontos" ADD CONSTRAINT "HistoricoPontos_conquistaId_fkey" FOREIGN KEY ("conquistaId") REFERENCES "Conquista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificacaoEvento" ADD CONSTRAINT "GamificacaoEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamificacaoEvento" ADD CONSTRAINT "GamificacaoEvento_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaRegra" ADD CONSTRAINT "ConquistaRegra_conquistaId_fkey" FOREIGN KEY ("conquistaId") REFERENCES "Conquista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaRegra" ADD CONSTRAINT "ConquistaRegra_unidadeCurricularId_fkey" FOREIGN KEY ("unidadeCurricularId") REFERENCES "UnidadeCurricular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquistaRegra" ADD CONSTRAINT "ConquistaRegra_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "ObjetoConhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntry" ADD CONSTRAINT "RankingEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RankingSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingEntry" ADD CONSTRAINT "RankingEntry_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioBadge" ADD CONSTRAINT "UsuarioBadge_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestaoFavorita" ADD CONSTRAINT "QuestaoFavorita_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestaoFavorita" ADD CONSTRAINT "QuestaoFavorita_questaoId_fkey" FOREIGN KEY ("questaoId") REFERENCES "Questao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeCurricular" ADD CONSTRAINT "UnidadeCurricular_cursoTecnicoId_fkey" FOREIGN KEY ("cursoTecnicoId") REFERENCES "CursoTecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subfuncao" ADD CONSTRAINT "Subfuncao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubConhecimento" ADD CONSTRAINT "SubConhecimento_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "ObjetoConhecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoFuncao" ADD CONSTRAINT "CursoFuncao_cursoTecnicoId_fkey" FOREIGN KEY ("cursoTecnicoId") REFERENCES "CursoTecnico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoFuncao" ADD CONSTRAINT "CursoFuncao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeCurricularConhecimento" ADD CONSTRAINT "UnidadeCurricularConhecimento_unidadeCurricularId_fkey" FOREIGN KEY ("unidadeCurricularId") REFERENCES "UnidadeCurricular"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeCurricularConhecimento" ADD CONSTRAINT "UnidadeCurricularConhecimento_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "ObjetoConhecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacidadeConhecimento" ADD CONSTRAINT "CapacidadeConhecimento_capacidadeId_fkey" FOREIGN KEY ("capacidadeId") REFERENCES "Capacidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacidadeConhecimento" ADD CONSTRAINT "CapacidadeConhecimento_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "ObjetoConhecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubfuncaoCapacidade" ADD CONSTRAINT "SubfuncaoCapacidade_subfuncaoId_fkey" FOREIGN KEY ("subfuncaoId") REFERENCES "Subfuncao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubfuncaoCapacidade" ADD CONSTRAINT "SubfuncaoCapacidade_capacidadeId_fkey" FOREIGN KEY ("capacidadeId") REFERENCES "Capacidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoEstudo" ADD CONSTRAINT "SessaoEstudo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "Instituicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_bancaId_fkey" FOREIGN KEY ("bancaId") REFERENCES "Banca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_cursoTecnicoId_fkey" FOREIGN KEY ("cursoTecnicoId") REFERENCES "CursoTecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_unidadeCurricularId_fkey" FOREIGN KEY ("unidadeCurricularId") REFERENCES "UnidadeCurricular"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_subfuncaoId_fkey" FOREIGN KEY ("subfuncaoId") REFERENCES "Subfuncao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "ObjetoConhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_subConhecimentoId_fkey" FOREIGN KEY ("subConhecimentoId") REFERENCES "SubConhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questao" ADD CONSTRAINT "Questao_capacidadeId_fkey" FOREIGN KEY ("capacidadeId") REFERENCES "Capacidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagemQuestao" ADD CONSTRAINT "ImagemQuestao_questaoId_fkey" FOREIGN KEY ("questaoId") REFERENCES "Questao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulado" ADD CONSTRAINT "Simulado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoSimulado" ADD CONSTRAINT "AvaliacaoSimulado_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimuladosQuestao" ADD CONSTRAINT "SimuladosQuestao_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimuladosQuestao" ADD CONSTRAINT "SimuladosQuestao_questaoId_fkey" FOREIGN KEY ("questaoId") REFERENCES "Questao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestaoErro" ADD CONSTRAINT "QuestaoErro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestaoErro" ADD CONSTRAINT "QuestaoErro_questaoId_fkey" FOREIGN KEY ("questaoId") REFERENCES "Questao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestaoTentativa" ADD CONSTRAINT "QuestaoTentativa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestaoTentativa" ADD CONSTRAINT "QuestaoTentativa_questaoId_fkey" FOREIGN KEY ("questaoId") REFERENCES "Questao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
