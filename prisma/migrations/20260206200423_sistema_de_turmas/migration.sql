-- CreateEnum
CREATE TYPE "StatusTurmaAluno" AS ENUM ('PENDENTE', 'ATIVO', 'REMOVIDO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusEntrega" AS ENUM ('PENDENTE', 'ENTREGUE', 'CORRIGIDO', 'ATRASADO');

-- CreateEnum
CREATE TYPE "TipoMaterial" AS ENUM ('PDF_UPLOAD', 'LINK_EXTERNO', 'GOOGLE_DRIVE', 'VIDEO_YOUTUBE');

-- CreateEnum
CREATE TYPE "TipoModuloItem" AS ENUM ('MATERIAL', 'AGENDAMENTO_SIMULADO', 'TAREFA');

-- CreateEnum
CREATE TYPE "StatusAgendamentoEntrega" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ABANDONADO', 'ANULADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoEventoGamificacao" ADD VALUE 'TAREFA_ENTREGUE';
ALTER TYPE "TipoEventoGamificacao" ADD VALUE 'CHECKIN_REALIZADO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoMovimentoPontos" ADD VALUE 'TAREFA_ENTREGUE';
ALTER TYPE "TipoMovimentoPontos" ADD VALUE 'CHECKIN_AULA';

-- AlterTable
ALTER TABLE "Simulado" ADD COLUMN     "agendamentoId" INTEGER;

-- CreateTable
CREATE TABLE "Turma" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "imagemUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaProfessor" (
    "turmaId" INTEGER NOT NULL,
    "professorId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PROFESSOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurmaProfessor_pkey" PRIMARY KEY ("turmaId","professorId")
);

-- CreateTable
CREATE TABLE "TurmaAluno" (
    "turmaId" INTEGER NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "status" "StatusTurmaAluno" NOT NULL DEFAULT 'PENDENTE',
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TurmaAluno_pkey" PRIMARY KEY ("turmaId","alunoId")
);

-- CreateTable
CREATE TABLE "ModuloTurma" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuloTurma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuloItem" (
    "id" SERIAL NOT NULL,
    "moduloId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoModuloItem" NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "materialId" INTEGER,
    "agendamentoId" INTEGER,
    "tarefaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuloItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialTurma" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoMaterial" NOT NULL DEFAULT 'PDF_UPLOAD',
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialTurma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendamentoSimulado" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "duracaoMinutos" INTEGER NOT NULL DEFAULT 60,
    "criadoPorId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "config" JSONB NOT NULL,
    "qtdeQuestoes" INTEGER NOT NULL,
    "tempoLimiteMin" INTEGER NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'RASCUNHO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendamentoSimulado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendamentoSimuladoQuestao" (
    "id" SERIAL NOT NULL,
    "agendamentoId" INTEGER NOT NULL,
    "questaoId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgendamentoSimuladoQuestao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendamentoEntrega" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "agendamentoId" INTEGER NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "simuladoId" INTEGER,
    "status" "StatusAgendamentoEntrega" NOT NULL DEFAULT 'PENDENTE',
    "notaAcertos" INTEGER,
    "notaPercentual" DOUBLE PRECISION,
    "iniciadoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendamentoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataEntrega" TIMESTAMP(3),
    "notaMaxima" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaTarefa" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "tarefaId" INTEGER NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "textoResposta" TEXT,
    "status" "StatusEntrega" NOT NULL DEFAULT 'PENDENTE',
    "nota" DOUBLE PRECISION,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregueEm" TIMESTAMP(3),
    "corrigidoEm" TIMESTAMP(3),

    CONSTRAINT "EntregaTarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaTarefaArquivo" (
    "id" SERIAL NOT NULL,
    "entregaTarefaId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaTarefaArquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvisoTurma" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "fixado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisoTurma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvisoTurmaAnexo" (
    "id" SERIAL NOT NULL,
    "avisoId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "nome" TEXT,
    "tipo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvisoTurmaAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComentarioAviso" (
    "id" SERIAL NOT NULL,
    "avisoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComentarioAviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicoForum" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "agendamentoId" INTEGER,
    "materialId" INTEGER,
    "tarefaId" INTEGER,
    "solucaoRespostaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicoForum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespostaForum" (
    "id" SERIAL NOT NULL,
    "topicoId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ehSolucao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RespostaForum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoCheckIn" (
    "id" SERIAL NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "abertoPorId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessaoCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInRegistro" (
    "id" SERIAL NOT NULL,
    "sessaoId" INTEGER NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "realizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLong" DOUBLE PRECISION,

    CONSTRAINT "CheckInRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Turma_codigo_key" ON "Turma"("codigo");

-- CreateIndex
CREATE INDEX "TurmaProfessor_professorId_idx" ON "TurmaProfessor"("professorId");

-- CreateIndex
CREATE INDEX "TurmaAluno_turmaId_idx" ON "TurmaAluno"("turmaId");

-- CreateIndex
CREATE INDEX "TurmaAluno_alunoId_idx" ON "TurmaAluno"("alunoId");

-- CreateIndex
CREATE INDEX "TurmaAluno_status_idx" ON "TurmaAluno"("status");

-- CreateIndex
CREATE INDEX "ModuloTurma_turmaId_ordem_idx" ON "ModuloTurma"("turmaId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "ModuloTurma_id_turmaId_key" ON "ModuloTurma"("id", "turmaId");

-- CreateIndex
CREATE INDEX "ModuloItem_moduloId_ordem_idx" ON "ModuloItem"("moduloId", "ordem");

-- CreateIndex
CREATE INDEX "ModuloItem_materialId_idx" ON "ModuloItem"("materialId");

-- CreateIndex
CREATE INDEX "ModuloItem_agendamentoId_idx" ON "ModuloItem"("agendamentoId");

-- CreateIndex
CREATE INDEX "ModuloItem_tarefaId_idx" ON "ModuloItem"("tarefaId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuloItem_moduloId_ordem_key" ON "ModuloItem"("moduloId", "ordem");

-- CreateIndex
CREATE INDEX "MaterialTurma_turmaId_idx" ON "MaterialTurma"("turmaId");

-- CreateIndex
CREATE INDEX "MaterialTurma_autorId_idx" ON "MaterialTurma"("autorId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialTurma_id_turmaId_key" ON "MaterialTurma"("id", "turmaId");

-- CreateIndex
CREATE INDEX "AgendamentoSimulado_turmaId_status_idx" ON "AgendamentoSimulado"("turmaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgendamentoSimulado_id_turmaId_key" ON "AgendamentoSimulado"("id", "turmaId");

-- CreateIndex
CREATE INDEX "AgendamentoSimuladoQuestao_agendamentoId_ordem_idx" ON "AgendamentoSimuladoQuestao"("agendamentoId", "ordem");

-- CreateIndex
CREATE INDEX "AgendamentoSimuladoQuestao_questaoId_idx" ON "AgendamentoSimuladoQuestao"("questaoId");

-- CreateIndex
CREATE UNIQUE INDEX "AgendamentoSimuladoQuestao_agendamentoId_questaoId_key" ON "AgendamentoSimuladoQuestao"("agendamentoId", "questaoId");

-- CreateIndex
CREATE UNIQUE INDEX "AgendamentoSimuladoQuestao_agendamentoId_ordem_key" ON "AgendamentoSimuladoQuestao"("agendamentoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "AgendamentoEntrega_simuladoId_key" ON "AgendamentoEntrega"("simuladoId");

-- CreateIndex
CREATE INDEX "AgendamentoEntrega_agendamentoId_idx" ON "AgendamentoEntrega"("agendamentoId");

-- CreateIndex
CREATE INDEX "AgendamentoEntrega_turmaId_alunoId_idx" ON "AgendamentoEntrega"("turmaId", "alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "AgendamentoEntrega_agendamentoId_alunoId_key" ON "AgendamentoEntrega"("agendamentoId", "alunoId");

-- CreateIndex
CREATE INDEX "Tarefa_turmaId_idx" ON "Tarefa"("turmaId");

-- CreateIndex
CREATE INDEX "Tarefa_criadoPorId_idx" ON "Tarefa"("criadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "Tarefa_id_turmaId_key" ON "Tarefa"("id", "turmaId");

-- CreateIndex
CREATE INDEX "EntregaTarefa_tarefaId_idx" ON "EntregaTarefa"("tarefaId");

-- CreateIndex
CREATE INDEX "EntregaTarefa_turmaId_alunoId_idx" ON "EntregaTarefa"("turmaId", "alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaTarefa_tarefaId_alunoId_key" ON "EntregaTarefa"("tarefaId", "alunoId");

-- CreateIndex
CREATE INDEX "EntregaTarefaArquivo_entregaTarefaId_idx" ON "EntregaTarefaArquivo"("entregaTarefaId");

-- CreateIndex
CREATE INDEX "AvisoTurma_turmaId_idx" ON "AvisoTurma"("turmaId");

-- CreateIndex
CREATE INDEX "AvisoTurma_turmaId_fixado_createdAt_idx" ON "AvisoTurma"("turmaId", "fixado", "createdAt");

-- CreateIndex
CREATE INDEX "AvisoTurmaAnexo_avisoId_idx" ON "AvisoTurmaAnexo"("avisoId");

-- CreateIndex
CREATE INDEX "ComentarioAviso_avisoId_createdAt_idx" ON "ComentarioAviso"("avisoId", "createdAt");

-- CreateIndex
CREATE INDEX "ComentarioAviso_usuarioId_idx" ON "ComentarioAviso"("usuarioId");

-- CreateIndex
CREATE INDEX "TopicoForum_turmaId_idx" ON "TopicoForum"("turmaId");

-- CreateIndex
CREATE INDEX "TopicoForum_autorId_idx" ON "TopicoForum"("autorId");

-- CreateIndex
CREATE INDEX "TopicoForum_agendamentoId_idx" ON "TopicoForum"("agendamentoId");

-- CreateIndex
CREATE INDEX "TopicoForum_materialId_idx" ON "TopicoForum"("materialId");

-- CreateIndex
CREATE INDEX "TopicoForum_tarefaId_idx" ON "TopicoForum"("tarefaId");

-- CreateIndex
CREATE INDEX "RespostaForum_topicoId_createdAt_idx" ON "RespostaForum"("topicoId", "createdAt");

-- CreateIndex
CREATE INDEX "RespostaForum_autorId_idx" ON "RespostaForum"("autorId");

-- CreateIndex
CREATE INDEX "SessaoCheckIn_turmaId_ativo_idx" ON "SessaoCheckIn"("turmaId", "ativo");

-- CreateIndex
CREATE INDEX "SessaoCheckIn_abertoPorId_idx" ON "SessaoCheckIn"("abertoPorId");

-- CreateIndex
CREATE INDEX "CheckInRegistro_sessaoId_idx" ON "CheckInRegistro"("sessaoId");

-- CreateIndex
CREATE INDEX "CheckInRegistro_turmaId_alunoId_idx" ON "CheckInRegistro"("turmaId", "alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInRegistro_sessaoId_alunoId_key" ON "CheckInRegistro"("sessaoId", "alunoId");

-- AddForeignKey
ALTER TABLE "Simulado" ADD CONSTRAINT "Simulado_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "AgendamentoSimulado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaProfessor" ADD CONSTRAINT "TurmaProfessor_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaProfessor" ADD CONSTRAINT "TurmaProfessor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaAluno" ADD CONSTRAINT "TurmaAluno_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaAluno" ADD CONSTRAINT "TurmaAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloTurma" ADD CONSTRAINT "ModuloTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloTurma" ADD CONSTRAINT "ModuloTurma_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloTurma" ADD CONSTRAINT "ModuloTurma_turmaId_autorId_fkey" FOREIGN KEY ("turmaId", "autorId") REFERENCES "TurmaProfessor"("turmaId", "professorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloItem" ADD CONSTRAINT "ModuloItem_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "ModuloTurma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloItem" ADD CONSTRAINT "ModuloItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialTurma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloItem" ADD CONSTRAINT "ModuloItem_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "AgendamentoSimulado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuloItem" ADD CONSTRAINT "ModuloItem_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTurma" ADD CONSTRAINT "MaterialTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTurma" ADD CONSTRAINT "MaterialTurma_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTurma" ADD CONSTRAINT "MaterialTurma_turmaId_autorId_fkey" FOREIGN KEY ("turmaId", "autorId") REFERENCES "TurmaProfessor"("turmaId", "professorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoSimulado" ADD CONSTRAINT "AgendamentoSimulado_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoSimulado" ADD CONSTRAINT "AgendamentoSimulado_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoSimulado" ADD CONSTRAINT "AgendamentoSimulado_turmaId_criadoPorId_fkey" FOREIGN KEY ("turmaId", "criadoPorId") REFERENCES "TurmaProfessor"("turmaId", "professorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoSimuladoQuestao" ADD CONSTRAINT "AgendamentoSimuladoQuestao_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "AgendamentoSimulado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoSimuladoQuestao" ADD CONSTRAINT "AgendamentoSimuladoQuestao_questaoId_fkey" FOREIGN KEY ("questaoId") REFERENCES "Questao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoEntrega" ADD CONSTRAINT "AgendamentoEntrega_agendamentoId_turmaId_fkey" FOREIGN KEY ("agendamentoId", "turmaId") REFERENCES "AgendamentoSimulado"("id", "turmaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoEntrega" ADD CONSTRAINT "AgendamentoEntrega_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoEntrega" ADD CONSTRAINT "AgendamentoEntrega_turmaId_alunoId_fkey" FOREIGN KEY ("turmaId", "alunoId") REFERENCES "TurmaAluno"("turmaId", "alunoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoEntrega" ADD CONSTRAINT "AgendamentoEntrega_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_turmaId_criadoPorId_fkey" FOREIGN KEY ("turmaId", "criadoPorId") REFERENCES "TurmaProfessor"("turmaId", "professorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaTarefa" ADD CONSTRAINT "EntregaTarefa_tarefaId_turmaId_fkey" FOREIGN KEY ("tarefaId", "turmaId") REFERENCES "Tarefa"("id", "turmaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaTarefa" ADD CONSTRAINT "EntregaTarefa_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaTarefa" ADD CONSTRAINT "EntregaTarefa_turmaId_alunoId_fkey" FOREIGN KEY ("turmaId", "alunoId") REFERENCES "TurmaAluno"("turmaId", "alunoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaTarefaArquivo" ADD CONSTRAINT "EntregaTarefaArquivo_entregaTarefaId_fkey" FOREIGN KEY ("entregaTarefaId") REFERENCES "EntregaTarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisoTurma" ADD CONSTRAINT "AvisoTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisoTurma" ADD CONSTRAINT "AvisoTurma_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisoTurma" ADD CONSTRAINT "AvisoTurma_turmaId_autorId_fkey" FOREIGN KEY ("turmaId", "autorId") REFERENCES "TurmaProfessor"("turmaId", "professorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisoTurmaAnexo" ADD CONSTRAINT "AvisoTurmaAnexo_avisoId_fkey" FOREIGN KEY ("avisoId") REFERENCES "AvisoTurma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioAviso" ADD CONSTRAINT "ComentarioAviso_avisoId_fkey" FOREIGN KEY ("avisoId") REFERENCES "AvisoTurma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioAviso" ADD CONSTRAINT "ComentarioAviso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicoForum" ADD CONSTRAINT "TopicoForum_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicoForum" ADD CONSTRAINT "TopicoForum_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicoForum" ADD CONSTRAINT "TopicoForum_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "AgendamentoSimulado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicoForum" ADD CONSTRAINT "TopicoForum_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialTurma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicoForum" ADD CONSTRAINT "TopicoForum_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicoForum" ADD CONSTRAINT "TopicoForum_solucaoRespostaId_fkey" FOREIGN KEY ("solucaoRespostaId") REFERENCES "RespostaForum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaForum" ADD CONSTRAINT "RespostaForum_topicoId_fkey" FOREIGN KEY ("topicoId") REFERENCES "TopicoForum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaForum" ADD CONSTRAINT "RespostaForum_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCheckIn" ADD CONSTRAINT "SessaoCheckIn_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCheckIn" ADD CONSTRAINT "SessaoCheckIn_abertoPorId_fkey" FOREIGN KEY ("abertoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCheckIn" ADD CONSTRAINT "SessaoCheckIn_turmaId_abertoPorId_fkey" FOREIGN KEY ("turmaId", "abertoPorId") REFERENCES "TurmaProfessor"("turmaId", "professorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInRegistro" ADD CONSTRAINT "CheckInRegistro_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInRegistro" ADD CONSTRAINT "CheckInRegistro_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInRegistro" ADD CONSTRAINT "CheckInRegistro_turmaId_alunoId_fkey" FOREIGN KEY ("turmaId", "alunoId") REFERENCES "TurmaAluno"("turmaId", "alunoId") ON DELETE CASCADE ON UPDATE CASCADE;
