import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2, XCircle, Clock, 
  ArrowLeft, Layers, FileText,
  RotateCcw, Minus, User, GraduationCap
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getShuffleMap } from "@/lib/utils"; // ── Importado o getShuffleMap ──

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResultadoSimuladoPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session) redirect("/login");

  const simuladoId = parseInt(id);
  if (isNaN(simuladoId)) redirect("/estudante");

  // 1. Busca os dados incluindo o Aluno e o Professor da Turma
  const simulado = await prisma.simulado.findUnique({
    where: {
      id: simuladoId,
      usuarioId: parseInt(session.sub),
    },
    include: {
      usuario: {
        select: { nome: true, fotoUrl: true } 
      },
      agendamentoOrigem: {
        select: {
          turmaId: true,
          titulo: true,
          turma: { 
            select: { 
              nome: true,
              professores: {
                include: {
                  professor: { select: { nome: true, fotoUrl: true } } 
                }
              }
            } 
          },
        },
      },
      simuladosQuestoes: {
        orderBy: { id: "asc" },
        include: {
          questao: {
            select: {
              id: true, // Adicionado o ID da questão para a semente
              enunciado: true,
              alternativaA: true,
              alternativaB: true,
              alternativaC: true,
              alternativaD: true,
              alternativaE: true,
              alternativaCorreta: true,
              dificuldade: true,
              unidadeCurricular: { select: { nome: true } },
            },
          },
        },
      },
    },
  });

  if (!simulado) redirect("/estudante");
  if (simulado.status !== "CONCLUIDO") redirect(`/estudante/simulado/${simuladoId}`);

  // 2. Extração de Nomes
  const nomeAluno = simulado.usuario?.nome || session.name || "Estudante";
  const fotoAluno = simulado.usuario?.fotoUrl || null;
  const professor = simulado.agendamentoOrigem?.turma?.professores?.[0]?.professor;
  const nomeProfessor = professor?.nome || "Professor não atribuído";
  const fotoProfessor = professor?.fotoUrl || null;

  // 3. Cálculos de Desempenho
  const formatTempo = (segundos: number | null) => {
    if (!segundos) return "--";
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
  };

  const acertos = simulado.acertos ?? 0;
  const erros = simulado.erros ?? 0;
  const total = simulado.qtdeQuestoes;
  const naoRespondidas = total - (simulado.questoesRespondidas ?? total);
  const percentual = simulado.notaPercentual ?? 0;

  const tier = percentual >= 80 ? 'excellent' : percentual >= 60 ? 'good' : percentual >= 40 ? 'average' : 'critical';
  const tierConfig = {
    excellent: { ring: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Excelente', labelColor: 'text-emerald-700 bg-emerald-100' },
    good:      { ring: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200',    label: 'Bom',       labelColor: 'text-blue-700 bg-blue-100' },
    average:   { ring: 'text-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Regular',   labelColor: 'text-amber-700 bg-amber-100' },
    critical:  { ring: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Atenção',   labelColor: 'text-red-700 bg-red-100' },
  }[tier];

  const backUrl = simulado.agendamentoOrigem
    ? `/estudante/turmas/${simulado.agendamentoOrigem.turmaId}/agendamentos`
    : "/estudante/simulado";
  const backLabel = simulado.agendamentoOrigem ? "Voltar para Simulados" : "Meus Simulados";
  const tituloSimulado = simulado.agendamentoOrigem?.titulo || `Simulado #${simulado.id}`;

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentual / 100) * circumference;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="animate-in fade-in duration-700 max-w-4xl mx-auto pb-10">

        {/* ── Top bar ──────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-6 py-3 md:py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Link href={backUrl} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-bold">
              <div className="p-1.5 bg-slate-100 rounded-lg hover:bg-indigo-100 transition-colors">
                <ArrowLeft size={16} />
              </div>
              <span className="hidden sm:inline">{backLabel}</span>
              <span className="sm:hidden">Voltar</span>
            </Link>
            <div className="text-right">
              <p className="font-bold text-slate-800 text-sm md:text-base truncate max-w-[200px] md:max-w-[300px]">{tituloSimulado}</p>
              {simulado.agendamentoOrigem?.turma && (
                <p className="text-[10px] md:text-xs text-slate-400 font-medium">{simulado.agendamentoOrigem.turma.nome}</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

          {/* ── Quadro de Identificação (Aluno e Professor) ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 shadow-sm border border-slate-100 gap-4">
            
            {/* Aluno */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Avatar className="h-12 w-12 md:h-14 md:w-14 ring-2 ring-indigo-50 shadow-sm shrink-0">
                <AvatarImage src={fotoAluno || ""} />
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
                  {nomeAluno.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-indigo-400" />
                  <span className="text-[10px] md:text-xs font-bold text-indigo-600 uppercase tracking-wider">Aluno</span>
                </div>
                <span className="text-sm md:text-base font-bold text-slate-800 truncate">{nomeAluno}</span>
              </div>
            </div>

            {/* Divisor Mobile/Desktop */}
            <div className="h-px w-full sm:w-px sm:h-12 bg-slate-100 shrink-0" />

            {/* Professor */}
            <div className="flex items-center sm:flex-row-reverse gap-3 w-full sm:w-auto text-left sm:text-right">
              <Avatar className="h-12 w-12 md:h-14 md:w-14 ring-2 ring-slate-50 shadow-sm shrink-0">
                <AvatarImage src={fotoProfessor || ""} />
                <AvatarFallback className="bg-slate-200 text-slate-600 font-bold">
                  {nomeProfessor.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center sm:justify-end gap-1.5">
                  <GraduationCap size={12} className="text-slate-400" />
                  <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Professor</span>
                </div>
                <span className="text-sm md:text-base font-bold text-slate-800 truncate">{nomeProfessor}</span>
              </div>
            </div>

          </div>

          {/* ── Score Dashboard ─────────────────────────────── */}
          <Card className="border-0 shadow-xl bg-white overflow-hidden rounded-[2rem]">
            <div className={cn("h-1.5 w-full", tierConfig.bg)} />
            <CardContent className="p-6 md:p-10 text-center space-y-6 md:space-y-8">
              
              {/* Score ring */}
              <div className="relative mx-auto w-40 h-40 md:w-48 md:h-48 drop-shadow-sm">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                  {/* Background ring */}
                  <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
                  {/* Score ring */}
                  <circle
                    cx="64" cy="64" r={radius} fill="none"
                    stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                    className={cn("transition-all duration-1000 ease-out", tierConfig.ring)}
                    style={{ strokeDasharray: circumference, strokeDashoffset }}
                  />
                </svg>
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl md:text-6xl font-black text-slate-800 leading-none tracking-tighter">{percentual}</span>
                  <span className="text-sm md:text-base text-slate-400 font-bold mt-1">%</span>
                </div>
              </div>

              {/* Performance badge */}
              <div className="flex flex-col items-center gap-2.5">
                <Badge className={cn("px-5 py-1.5 text-sm uppercase tracking-widest font-black border shadow-sm", tierConfig.labelColor, tierConfig.border)}>
                  {tierConfig.label}
                </Badge>
                <p className="text-xs md:text-sm font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                  {simulado.dataConclusao
                    ? `Enviado em ${simulado.dataConclusao.toLocaleDateString("pt-BR")} às ${simulado.dataConclusao.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit'})}`
                    : "Prova concluída"}
                </p>
              </div>

              {/* ── Stats Strip ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 pt-4 border-t border-slate-100">
                <StatPill icon={CheckCircle2} value={acertos} label="Acertos" color="text-emerald-600" bg="bg-emerald-50" borderColor="border-emerald-100" />
                <StatPill icon={XCircle} value={erros} label="Erros" color="text-red-500" bg="bg-red-50" borderColor="border-red-100" />
                <StatPill icon={Minus} value={naoRespondidas} label="Em branco" color="text-slate-400" bg="bg-slate-50" borderColor="border-slate-200" />
                <StatPill icon={Clock} value={formatTempo(simulado.tempoGastoSegundos)} label="Tempo" color="text-indigo-600" bg="bg-indigo-50" borderColor="border-indigo-100" />
              </div>

              {/* ── Visual Breakdown Bar ── */}
              <div className="space-y-3 pt-2">
                <div className="flex h-3 md:h-4 rounded-full overflow-hidden bg-slate-100 shadow-inner">
                  {acertos > 0 && (
                    <div className="bg-emerald-500 transition-all duration-700 ease-out" style={{ width: `${(acertos / total) * 100}%` }} />
                  )}
                  {erros > 0 && (
                    <div className="bg-red-400 transition-all duration-700 ease-out" style={{ width: `${(erros / total) * 100}%` }} />
                  )}
                  {naoRespondidas > 0 && (
                    <div className="bg-slate-300 transition-all duration-700 ease-out" style={{ width: `${(naoRespondidas / total) * 100}%` }} />
                  )}
                </div>
                <div className="flex items-center justify-center gap-4 md:gap-6 text-[10px] md:text-xs text-slate-500 font-bold">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> Acertos</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-sm" /> Erros</span>
                  {naoRespondidas > 0 && (
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm" /> Em branco</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Gabarito ────────────────────────────────────── */}
          <section className="space-y-4 md:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 md:p-2.5 bg-slate-800 rounded-xl shadow-lg">
                  <FileText className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Correção Detalhada</h2>
                  <p className="text-xs md:text-sm font-medium text-slate-500">Gabarito das {total} questões</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap sm:justify-end max-w-[60%]">
                {simulado.simuladosQuestoes.map((sq, i) => (
                  <a
                    key={sq.id}
                    href={`#q${i + 1}`}
                    className={cn(
                      "w-2.5 h-2.5 md:w-3 md:h-3 rounded-full transition-all hover:scale-125 shrink-0 shadow-sm",
                      sq.correta ? "bg-emerald-400" : "bg-red-400"
                    )}
                    title={`Ir para Questão ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {simulado.simuladosQuestoes.map((sq, index) => {
                const acertou = sq.correta;
                const questao = sq.questao;

                // ── MÁGICA DO MAPA NA CORREÇÃO ──
                // Carrega a mesma semente usada no simulado
                const mapa = getShuffleMap(simulado.id, questao.id);

                // Função auxiliar para puxar o texto correto da tabela original
                const getTextoAlternativa = (letraReal: string) => {
                  switch (letraReal) {
                    case 'A': return questao.alternativaA;
                    case 'B': return questao.alternativaB;
                    case 'C': return questao.alternativaC;
                    case 'D': return questao.alternativaD;
                    case 'E': return questao.alternativaE;
                    default: return "";
                  }
                };

                // Monta o dicionário visual (exatamente como o aluno viu na tela)
                const alternativasMapVisuais = {
                  A: getTextoAlternativa(mapa["A"]),
                  B: getTextoAlternativa(mapa["B"]),
                  C: getTextoAlternativa(mapa["C"]),
                  D: getTextoAlternativa(mapa["D"]),
                  E: getTextoAlternativa(mapa["E"]),
                };

                return (
                  <Card
                    key={sq.id}
                    id={`q${index + 1}`}
                    className="overflow-hidden border-slate-200 shadow-sm bg-white scroll-mt-24 rounded-2xl"
                  >
                    <div className={cn("h-1.5 w-full", acertou ? "bg-emerald-500" : "bg-red-500")} />

                    <CardContent className="p-4 md:p-6 md:pt-7">
                      {/* Header row */}
                      <div className="flex items-start sm:items-center justify-between gap-3 mb-4 md:mb-5">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-sm md:text-base font-black text-slate-800 shrink-0">Questão {index + 1}</span>
                          {questao.unidadeCurricular && (
                            <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 px-2 font-semibold bg-slate-50 truncate max-w-[200px]">
                              {questao.unidadeCurricular.nome}
                            </Badge>
                          )}
                        </div>
                        <Badge className={cn(
                          "shrink-0 gap-1.5 px-2.5 py-1 text-[10px] md:text-xs border-0 font-bold shadow-sm",
                          acertou 
                            ? "bg-emerald-100 text-emerald-700" 
                            : "bg-red-100 text-red-700"
                        )}>
                          {acertou ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span>{acertou ? "Correta" : "Incorreta"}</span>
                        </Badge>
                      </div>

                      {/* Enunciado */}
                      <p className="text-slate-700 text-sm md:text-base leading-relaxed mb-5 font-medium whitespace-pre-wrap">
                        {questao.enunciado}
                      </p>

                      {/* Alternativas */}
                      <div className="space-y-2 md:space-y-2.5">
                        {(Object.keys(alternativasMapVisuais) as Array<keyof typeof alternativasMapVisuais>).map((letraVisual) => {
                          const texto = alternativasMapVisuais[letraVisual];
                          
                          // Qual é a letra correspondente no banco para essa letra visual?
                          const letraReal = mapa[letraVisual];
                          
                          // É o gabarito se a letra REAL for igual à alternativa correta do banco
                          const isGabarito = letraReal === questao.alternativaCorreta?.toUpperCase();
                          
                          // Foi a que o aluno marcou se a letra VISUAL for a mesma que foi salva
                          const isMarcada = letraVisual === sq.alternativaMarcada;

                          let wrapperClass = "border-slate-100 bg-slate-50/30 opacity-50";
                          let dotClass = "bg-white border-slate-200 text-slate-400";
                          let trailingBadge: React.ReactNode = null;

                          if (isGabarito && isMarcada) {
                            wrapperClass = "border-emerald-300 bg-emerald-50 opacity-100 shadow-sm ring-1 ring-emerald-100";
                            dotClass = "bg-emerald-500 border-emerald-500 text-white";
                            trailingBadge = <Badge className="bg-emerald-500 text-white text-[10px] px-2 shrink-0">Você acertou</Badge>;
                          } else if (isGabarito) {
                            wrapperClass = "border-emerald-300 bg-emerald-50 opacity-100 ring-1 ring-emerald-100";
                            dotClass = "bg-emerald-500 border-emerald-500 text-white";
                            trailingBadge = <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-white text-[10px] px-2 shrink-0">Resposta Correta</Badge>;
                          } else if (isMarcada) {
                            wrapperClass = "border-red-300 bg-red-50 opacity-100 ring-1 ring-red-100";
                            dotClass = "bg-red-500 border-red-500 text-white";
                            trailingBadge = <Badge className="bg-red-500 text-white text-[10px] px-2 shrink-0">Sua Resposta</Badge>;
                          }

                          return (
                            <div
                              key={letraVisual}
                              className={cn("flex items-start gap-3 p-3 md:p-3.5 rounded-xl border text-sm transition-all", wrapperClass)}
                            >
                              <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border-2 mt-0.5", dotClass)}>
                                {letraVisual}
                              </span>
                              <span className="flex-1 leading-relaxed font-medium text-slate-700 pt-0.5">{texto}</span>
                              {trailingBadge && <div className="mt-1">{trailingBadge}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex justify-center pt-6 pb-10">
              <Button asChild size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all font-bold px-8 h-12 text-sm md:text-base rounded-xl">
                <Link href={backUrl}>
                  <ArrowLeft size={18} />
                  Voltar para Simulados
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Compact stat pill ────────────────────────────────────────
function StatPill({
  icon: Icon, value, label, color, bg, borderColor,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  color: string;
  bg: string;
  borderColor: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 py-4 rounded-2xl border shadow-sm", bg, borderColor)}>
      <Icon className={cn("h-5 w-5", color)} />
      <span className={cn("text-xl md:text-2xl font-black leading-none", color)}>{value}</span>
      <span className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}