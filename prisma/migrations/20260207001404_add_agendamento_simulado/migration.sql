/*
  Warnings:

  - You are about to drop the column `tempoLimiteMin` on the `AgendamentoSimulado` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AgendamentoSimulado" DROP COLUMN "tempoLimiteMin";

-- AlterTable
ALTER TABLE "AgendamentoSimuladoQuestao" ADD COLUMN     "pontos" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
