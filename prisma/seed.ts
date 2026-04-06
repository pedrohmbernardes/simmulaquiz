import { 
  PrismaClient, 
  TipoUsuario, 
  NivelDificuldade, 
  NivelCognitivo, 
  TipoModuloItem, 
  TipoMaterial, 
  StatusAgendamento, 
  StatusTurmaAluno,
  TipoRequisitoConquista,
  StatusSimulado
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// 📂 IMPORTAÇÃO DE DADOS
import conquistasMeta from './conquistas_meta.json';
import curriculo from './curriculo.saep.automacao.json';
import relacionamentos from './relacionamentos.saep.automacao.json';
import { titulosData } from './titulos-data';
import { instituicoesData, bancasData } from './data-auxiliares';

const prisma = new PrismaClient();

// ============================================================
// 🛠️ HELPERS DE NORMALIZAÇÃO DE CÓDIGOS
// ============================================================

/** Normaliza "UC-01" -> "UC-0001" */
function normUC(code: string): string {
  if (!code) return '';
  const num = code.replace(/\D/g, '');
  return `UC-${num.padStart(4, '0')}`;
}

/** Normaliza "FUNC-01" -> "FUNC-0001" */
function normFuncao(code: string): string {
  if (!code) return '';
  const num = code.replace(/\D/g, '');
  return `FUNC-${num.padStart(4, '0')}`;
}

/** Normaliza "CONH-01" -> "OBJ-CONH-00001" */
function normConhecimento(code: string): string {
  if (!code) return '';
  const num = code.replace(/\D/g, '');
  return `OBJ-CONH-${num.padStart(5, '0')}`;
}

/** Normaliza Sigla de Capacidade (Trim) */
function normCapacidade(sigla: string): string {
  return String(sigla ?? '').trim();
}

// ============================================================
// 🚀 FUNÇÃO PRINCIPAL
// ============================================================
async function main() {
  console.log('🌱 [SEED] Iniciando população COMPLETA (v3 - SubConhecimentos)...');

  // ------------------------------------------------------------
  // 1. LIMPEZA SEGURA
  // ------------------------------------------------------------
  console.log('🧹 [LIMPEZA] Removendo dados antigos...');
  
  // LMS
  await prisma.entregaTarefaArquivo.deleteMany();
  await prisma.entregaTarefa.deleteMany();
  await prisma.tarefa.deleteMany();
  await prisma.checkInRegistro.deleteMany();
  await prisma.sessaoCheckIn.deleteMany();
  await prisma.comentarioAviso.deleteMany();
  await prisma.avisoTurmaAnexo.deleteMany();
  await prisma.avisoTurma.deleteMany();
  await prisma.respostaForum.deleteMany();
  await prisma.topicoForum.deleteMany();
  await prisma.agendamentoSimuladoQuestao.deleteMany();
  await prisma.agendamentoEntrega.deleteMany();
  await prisma.agendamentoSimulado.deleteMany();
  await prisma.moduloItem.deleteMany();
  await prisma.moduloTurma.deleteMany();
  await prisma.materialTurma.deleteMany();
  await prisma.turmaAluno.deleteMany();
  await prisma.turmaProfessor.deleteMany();
  await prisma.turma.deleteMany();

  // Core/Gamificação
  await prisma.usuarioConquista.deleteMany();
  await prisma.historicoPontos.deleteMany();
  await prisma.usuarioBadge.deleteMany();
  await prisma.usuarioMetricasDiarias.deleteMany();
  await prisma.usuarioStreak.deleteMany();
  await prisma.usuarioGamificacao.deleteMany();
  await prisma.conquistaRegra.deleteMany();
  await prisma.conquista.deleteMany();
  await prisma.titulo.deleteMany();
  
  // Questões
  await prisma.questaoErro.deleteMany();
  await prisma.questaoTentativa.deleteMany();
  await prisma.simuladosQuestao.deleteMany();
  await prisma.avaliacaoSimulado.deleteMany();
  await prisma.simulado.deleteMany();
  await prisma.imagemQuestao.deleteMany();
  await prisma.questaoFavorita.deleteMany();
  await prisma.questao.deleteMany();

  // Pedagógico (Relacionamentos)
  await prisma.cursoFuncao.deleteMany();
  await prisma.unidadeCurricularConhecimento.deleteMany();
  await prisma.capacidadeConhecimento.deleteMany();
  await prisma.subfuncaoCapacidade.deleteMany();

  // Pedagógico (Entidades)
  await prisma.subConhecimento.deleteMany();
  await prisma.conhecimento.deleteMany();
  await prisma.capacidade.deleteMany();
  await prisma.subfuncao.deleteMany();
  await prisma.funcao.deleteMany();
  await prisma.unidadeCurricular.deleteMany();
  await prisma.cursoTecnico.deleteMany();

  // Auxiliares
  await prisma.banca.deleteMany();
  await prisma.instituicao.deleteMany();
  await prisma.logAuditoria.deleteMany();
  await prisma.tokenBlacklist.deleteMany();
  await prisma.usuario.deleteMany();

  console.log('✅ Banco limpo.');

  // ------------------------------------------------------------
  // 2. DADOS ESTÁTICOS
  // ------------------------------------------------------------
  console.log('🏫 Inserindo Instituições, Bancas e Títulos...');
  await prisma.instituicao.createMany({ data: instituicoesData, skipDuplicates: true });
  await prisma.banca.createMany({ data: bancasData, skipDuplicates: true });
  
  await prisma.titulo.createMany({
    data: titulosData.map(t => ({
      nivel: t.nivel,
      nome: t.nome,
      minPontos: t.pontos,
      urlImagem: `titulo_${t.nivel}.png`,
      corHex: '#3b82f6'
    })),
    skipDuplicates: true
  });

  // ------------------------------------------------------------
  // 3. MATRIZ CURRICULAR (ENTIDADES)
  // ------------------------------------------------------------
  console.log('🎓 Importando Entidades Pedagógicas...');

  // 3.1 Curso Técnico
  const curso = await prisma.cursoTecnico.create({
    data: {
      codigo: curriculo.cursoTecnico.codigo,
      nome: curriculo.cursoTecnico.nome,
      descricao: curriculo.cursoTecnico.descricao
    }
  });

  // 3.2 Unidades Curriculares (UCs)
  await prisma.unidadeCurricular.createMany({
    data: curriculo.unidadesCurriculares.map(uc => ({
      codigo: normUC(uc.codigo),
      nome: uc.nome,
      descricao: uc.descricao,
      cursoTecnicoId: curso.id
    })),
    skipDuplicates: true
  });

  // 3.3 Funções
  const funcoesList = (curriculo as any).funcoes || [];
  for (const f of funcoesList) {
    await prisma.funcao.create({
      data: { 
        codigo: normFuncao(f.codigo), 
        nome: f.nome, 
        descricao: f.descricao 
      }
    });
  }

  // 3.4 Subfunções (NA RAIZ)
  const subfuncoesList = (curriculo as any).subfuncoes || [];
  console.log(`   ... Processando ${subfuncoesList.length} Subfunções...`);
  
  for (const sf of subfuncoesList) {
    const parentCode = normFuncao(sf.funcaoCodigo);
    const funcaoPai = await prisma.funcao.findUnique({ where: { codigo: parentCode } });
    
    if (funcaoPai) {
      await prisma.subfuncao.upsert({
        where: { codigo: sf.codigo },
        update: {},
        create: {
          codigo: sf.codigo,
          nome: sf.nome,
          descricao: sf.descricao,
          funcaoId: funcaoPai.id
        }
      });
    }
  }

  // 3.5 Capacidades
  if ((curriculo as any).capacidades) {
    await prisma.capacidade.createMany({
      data: (curriculo as any).capacidades.map((c: any) => ({
        sigla: normCapacidade(c.sigla),
        descricao: c.descricao
      })),
      skipDuplicates: true
    });
  }

  // 3.6 Conhecimentos
  const conhecimentosList = (curriculo as any).conhecimentos || [];
  console.log(`   ... Criando ${conhecimentosList.length} Conhecimentos...`);

  for (const c of conhecimentosList) {
    const code = normConhecimento(c.codigo);
    await prisma.conhecimento.upsert({
      where: { codigo: code },
      update: {},
      create: {
        codigo: code,
        nome: c.nome,
        descricao: c.descricao
      }
    });
  }

  // 3.7 SubConhecimentos (NA RAIZ - Agora corrigido!)
  const subConhecimentosList = (curriculo as any).subConhecimentos || [];
  console.log(`   ... Criando ${subConhecimentosList.length} SubConhecimentos...`);

  for (const sc of subConhecimentosList) {
    // Normaliza o código do pai (ex: CONH-01 -> OBJ-CONH-00001)
    const parentCode = normConhecimento(sc.conhecimentoCodigo);
    const parent = await prisma.conhecimento.findUnique({ where: { codigo: parentCode } });

    if (parent) {
      await prisma.subConhecimento.upsert({
        where: { codigo: sc.codigo },
        update: {},
        create: {
          codigo: sc.codigo,
          nome: sc.nome,
          descricao: sc.descricao,
          conhecimentoId: parent.id
        }
      });
    } else {
      // console.warn(`SubConhecimento ${sc.codigo} órfão: Pai ${parentCode} não encontrado.`);
    }
  }

  // ------------------------------------------------------------
  // 4. RELACIONAMENTOS PEDAGÓGICOS (VÍNCULOS COMPLETOS)
  // ------------------------------------------------------------
  console.log('🔗 Vinculando Relacionamentos...');
  
  // A) Curso <-> Função
  const relCursoFuncao = (relacionamentos as any).cursoFuncoes || [];
  let countCF = 0;
  for (const rel of relCursoFuncao) {
    const funcaoCode = normFuncao(rel.funcaoCodigo);
    const func = await prisma.funcao.findUnique({ where: { codigo: funcaoCode } });
    if (func && curso) {
       await prisma.cursoFuncao.upsert({
         where: { cursoTecnicoId_funcaoId: { cursoTecnicoId: curso.id, funcaoId: func.id } },
         create: { cursoTecnicoId: curso.id, funcaoId: func.id },
         update: {}
       });
       countCF++;
    }
  }
  console.log(`   -> Curso-Função: ${countCF}`);

  // B) UC <-> Conhecimento
  const relUC = relacionamentos.unidadeCurricularConhecimentos || [];
  let countUC = 0;
  for (const rel of relUC) {
    const ucCode = normUC(rel.unidadeCurricularCodigo); 
    const conhCode = normConhecimento(rel.conhecimentoCodigo);
    const uc = await prisma.unidadeCurricular.findUnique({ where: { codigo: ucCode } });
    const conh = await prisma.conhecimento.findUnique({ where: { codigo: conhCode } });
    if (uc && conh) {
      await prisma.unidadeCurricularConhecimento.upsert({
        where: { unidadeCurricularId_conhecimentoId: { unidadeCurricularId: uc.id, conhecimentoId: conh.id } },
        create: { unidadeCurricularId: uc.id, conhecimentoId: conh.id },
        update: {}
      });
      countUC++;
    }
  }
  console.log(`   -> UC-Conhecimento: ${countUC}`);

  // C) Capacidade <-> Conhecimento
  const relCap = (relacionamentos as any).capacidadeConhecimentos || [];
  let countCap = 0;
  for (const rel of relCap) {
    const capSigla = normCapacidade(rel.capacidadeSigla);
    const conhCode = normConhecimento(rel.conhecimentoCodigo);
    const cap = await prisma.capacidade.findUnique({ where: { sigla: capSigla } });
    const conh = await prisma.conhecimento.findUnique({ where: { codigo: conhCode } });
    if (cap && conh) {
      await prisma.capacidadeConhecimento.upsert({
        where: { capacidadeId_conhecimentoId: { capacidadeId: cap.id, conhecimentoId: conh.id } },
        create: { capacidadeId: cap.id, conhecimentoId: conh.id },
        update: {}
      });
      countCap++;
    }
  }
  console.log(`   -> Capacidade-Conhecimento: ${countCap}`);

  // D) Subfunção <-> Capacidade
  const relSubCap = (relacionamentos as any).subfuncaoCapacidades || [];
  let countSubCap = 0;
  for (const rel of relSubCap) {
    const subCode = rel.subfuncaoCodigo; 
    const capSigla = normCapacidade(rel.capacidadeSigla);
    const sub = await prisma.subfuncao.findUnique({ where: { codigo: subCode } });
    const cap = await prisma.capacidade.findUnique({ where: { sigla: capSigla } });
    if (sub && cap) {
      await prisma.subfuncaoCapacidade.upsert({
        where: { subfuncaoId_capacidadeId: { subfuncaoId: sub.id, capacidadeId: cap.id } },
        create: { subfuncaoId: sub.id, capacidadeId: cap.id },
        update: {}
      });
      countSubCap++;
    }
  }
  console.log(`   -> Subfunção-Capacidade: ${countSubCap}`);

  // ------------------------------------------------------------
  // 5. GAMIFICAÇÃO
  // ------------------------------------------------------------
  console.log('🏅 Configurando Conquistas...');
  for (const meta of conquistasMeta) {
    const c = meta as any;
    await prisma.conquista.create({
      data: {
        key: c.key,
        nome: c.nome,
        descricao: c.descricao,
        requisitoTipo: c.requisitoTipo as TipoRequisitoConquista,
        requisitoValor: c.requisitoValor || 0,
        pontos: c.pontos || 10,
        raridade: (c.raridade || 'COMUM') as any,
        categoria: (c.categoria || 'INICIO_ENGAJAMENTO') as any,
        icone: c.icone || 'default_badge'
      }
    });
  }

  // ------------------------------------------------------------
  // 6. USUÁRIOS & LMS
  // ------------------------------------------------------------
  console.log('🏫 Configurando Cenário LMS...');
  const passwordHash = await bcrypt.hash('123456', 10);
  const tituloInicial = await prisma.titulo.findFirst({ where: { nivel: 1 } });

  const admin = await prisma.usuario.create({
    data: {
      nome: 'Administrador Simmula',
      email: 'admin@simmula.com',
      senhaHash: passwordHash,
      tipo: TipoUsuario.SUPER_ADMIN,
      dataNascimento: new Date('1990-01-01'),
      emailVerificado: true,
      gamificacao: { create: { tituloId: tituloInicial?.id, nivel: 10, pontos: 5000 } }
    }
  });

  const professor = await prisma.usuario.create({
    data: {
      nome: 'Prof. Xavier',
      email: 'prof@simmula.com',
      senhaHash: passwordHash,
      tipo: TipoUsuario.PROFESSOR,
      dataNascimento: new Date('1980-05-20'),
      emailVerificado: true,
      gamificacao: { create: { tituloId: tituloInicial?.id } }
    }
  });

  const aluno = await prisma.usuario.create({
    data: {
      nome: 'Aluno Exemplo',
      email: 'aluno@simmula.com',
      senhaHash: passwordHash,
      tipo: TipoUsuario.ALUNO,
      dataNascimento: new Date('2005-03-15'),
      emailVerificado: true,
      gamificacao: { create: { tituloId: tituloInicial?.id } }
    }
  });

  // LMS: Turma Básica
  const turma = await prisma.turma.create({
    data: {
      codigo: 'TURMA-2026-AUTO',
      nome: 'Automação Industrial - Módulo I',
      ativo: true,
      professores: { create: { professorId: professor.id, role: 'COORDENADOR' } },
      alunos: { create: { alunoId: aluno.id, status: StatusTurmaAluno.ATIVO } }
    }
  });

  // LMS: Material
  const material = await prisma.materialTurma.create({
    data: {
      turmaId: turma.id,
      autorId: professor.id,
      titulo: 'Apostila: Introdução',
      tipo: TipoMaterial.LINK_EXTERNO,
      url: 'https://docs.google.com/presentation/d/exemplo'
    }
  });

  // LMS: Questão de Exemplo
  const ucDemo = await prisma.unidadeCurricular.findFirst();
  if (ucDemo) {
    const q1 = await prisma.questao.create({
      data: {
        codigo: 'QST-001',
        enunciado: 'Questão de Teste',
        alternativaA: 'A', alternativaB: 'B', alternativaC: 'C', alternativaD: 'D', alternativaE: 'E',
        alternativaCorreta: 'A',
        dificuldade: NivelDificuldade.FACIL,
        unidadeCurricularId: ucDemo.id
      }
    });

    const agendamento = await prisma.agendamentoSimulado.create({
      data: {
        turmaId: turma.id,
        criadoPorId: professor.id,
        titulo: 'Avaliação Diagnóstica',
        qtdeQuestoes: 1,
        duracaoMinutos: 45,
        status: StatusAgendamento.PUBLICADO,
        dataInicio: new Date(),
        dataFim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        config: {}, 
        questoes: { create: [{ questaoId: q1.id, ordem: 1 }] },
        entregas: { create: { alunoId: aluno.id } }
      }
    });

    await prisma.moduloTurma.create({
      data: {
        turmaId: turma.id,
        autorId: professor.id,
        titulo: 'Módulo 01',
        ordem: 1,
        publicado: true,
        itens: {
          create: [
            { titulo: 'Apostila', tipo: TipoModuloItem.MATERIAL, materialId: material.id, ordem: 1 },
            { titulo: 'Avaliação', tipo: TipoModuloItem.AGENDAMENTO_SIMULADO, agendamentoId: agendamento.id, ordem: 2 }
          ]
        }
      }
    });
  }

  console.log('✅ Seed COMPLETO finalizado!');
}

main()
  .catch((e) => {
    console.error('❌ Erro fatal no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });