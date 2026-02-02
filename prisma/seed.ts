import { PrismaClient, TipoRequisitoConquista, CategoriaConquista } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// 📂 Importação da Fonte da Verdade (JSON)
// Certifique-se de que o arquivo 'conquistas_meta.json' está na pasta 'prisma/'
import conquistasMeta from './conquistas_meta.json';

// Dados Estáticos Auxiliares
import { titulosData } from './titulos-data';
import { instituicoesData, bancasData } from './data-auxiliares';

// Dados Dinâmicos da Matriz Curricular
import curriculo from './curriculo.saep.automacao.json';
import relacionamentos from './relacionamentos.saep.automacao.json';

const prisma = new PrismaClient();

// ============================
// Helpers de normalização (SAEP)
// ============================
function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function norm(str: unknown) {
  return String(str ?? '').trim();
}

function normUpper(str: unknown) {
  return norm(str).toUpperCase();
}

// FUNC-0001 -> FUNC-01 (mantém FUNC-01 como está)
function normFuncaoCodigo(codigo: unknown) {
  const up = normUpper(codigo);
  const m = up.match(/^FUNC-0*(\d+)$/);
  return m ? `FUNC-${pad2(Number(m[1]))}` : up;
}

// UC-0001 -> UC-01 (mantém UC-01 como está)
function normUCCodigo(codigo: unknown) {
  const up = normUpper(codigo);
  const m = up.match(/^UC-0*(\d+)$/);
  return m ? `UC-${pad2(Number(m[1]))}` : up;
}

// OBJ-CONH-00017 -> CONH-17
// CONH-17 -> CONH-17
function normConhecimentoCodigo(codigo: unknown) {
  const up = normUpper(codigo);

  // Já está no formato CONH-xx
  let m = up.match(/^CONH-0*(\d+)$/);
  if (m) return `CONH-${pad2(Number(m[1]))}`;

  // Vem no formato OBJ-CONH-000xx (lista de conhecimentos)
  m = up.match(/^OBJ-CONH-0*(\d+)$/);
  if (m) return `CONH-${pad2(Number(m[1]))}`;

  return up;
}

function isValidCategoriaConquista(value: unknown) {
  return (Object.values(CategoriaConquista) as string[]).includes(String(value));
}

function setAliases(map: Map<string, number>, id: number, ...keys: string[]) {
  for (const k of keys) {
    const kk = normUpper(k);
    if (kk) map.set(kk, id);
  }
}

async function main() {
  console.log('🚀 Iniciando Seed SAEP (Schema 2.4 - Gamificação Completa)...');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_INITIAL_PASSWORD;

  if (!adminEmail || !adminPass) {
    throw new Error('❌ ERRO: Configure ADMIN_EMAIL e ADMIN_INITIAL_PASSWORD no arquivo .env');
  }

  // Casting para 'any' para evitar bloqueios de tipagem estrita nos arquivos JSON importados
  const _conquistasMeta = conquistasMeta as any[];
  const _titulosData = titulosData as any[];
  const _instituicoesData = instituicoesData as any[];
  const _bancasData = bancasData as any[];
  const _curriculo = curriculo as any;
  const _relacionamentos = relacionamentos as any;

  // ==========================================
  // 1. LIMPEZA TOTAL (Ordem de dependência estrita)
  // ==========================================
  console.log('🧹 Limpando banco de dados...');

  // 1.1 Tabelas de Log e Histórico (Dependentes de Usuário e Simulado)
  await prisma.historicoPontos.deleteMany();
  await prisma.usuarioMetricasDiarias.deleteMany();
  await prisma.gamificacaoEvento.deleteMany();
  await prisma.logAuditoria.deleteMany();

  // 1.2 Tabelas de Questões e Simulados (Core da Aplicação)
  await prisma.questaoTentativa.deleteMany();
  await prisma.questaoErro.deleteMany();
  await prisma.questaoFavorita.deleteMany();
  await prisma.simuladosQuestao.deleteMany();
  await prisma.avaliacaoSimulado.deleteMany();
  await prisma.simulado.deleteMany();
  await prisma.imagemQuestao.deleteMany(); // Se houver imagens
  await prisma.questao.deleteMany();

  // 1.3 Tabelas Curriculares (Relacionamentos N:N)
  await prisma.unidadeCurricularConhecimento.deleteMany();
  await prisma.subfuncaoCapacidade.deleteMany();
  await prisma.capacidadeConhecimento.deleteMany();
  await prisma.cursoFuncao.deleteMany();

  // 1.4 Tabelas Curriculares (Entidades Base)
  await prisma.subConhecimento.deleteMany();
  await prisma.subfuncao.deleteMany();
  await prisma.conhecimento.deleteMany();
  await prisma.capacidade.deleteMany();
  await prisma.funcao.deleteMany();
  await prisma.unidadeCurricular.deleteMany();
  await prisma.cursoTecnico.deleteMany();

  // 1.5 Tabelas de Gamificação (Core)
  await prisma.usuarioConquista.deleteMany();
  await prisma.conquistaRegra.deleteMany();
  await prisma.conquista.deleteMany();
  await prisma.usuarioStreak.deleteMany();
  await prisma.usuarioGamificacao.deleteMany();
  await prisma.titulo.deleteMany();
  await prisma.rankingEntry.deleteMany();
  await prisma.rankingSnapshot.deleteMany();

  // 1.6 Tabelas de Usuário e Auxiliares
  await prisma.sessaoEstudo.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.instituicao.deleteMany();
  await prisma.banca.deleteMany();

  console.log('✨ Banco de dados limpo.');

  // ==========================================
  // 2. RECONSTRUÇÃO DO CURRÍCULO (COM NORMALIZAÇÃO)
  // ==========================================
  console.log('🏗️  Reconstruindo Currículo...');

  // Mapas aceitam BOTH formatos (ex: UC-0001 e UC-01) para facilitar lookup e evitar “perdas silenciosas”
  const mapUC = new Map<string, number>();
  const mapFunc = new Map<string, number>();
  const mapSubFunc = new Map<string, number>();
  const mapCap = new Map<string, number>();
  const mapConh = new Map<string, number>();

  const cursoCodigo = norm(_curriculo?.cursoTecnico?.codigo);
  const cursoNome = norm(_curriculo?.cursoTecnico?.nome);
  const cursoDescricao = _curriculo?.cursoTecnico?.descricao ?? null;

  const curso = await prisma.cursoTecnico.create({
    data: {
      codigo: cursoCodigo,
      nome: cursoNome,
      descricao: cursoDescricao
    }
  });

  // 2.1 Unidades Curriculares
  let ucCount = 0;
  for (const uc of _curriculo.unidadesCurriculares ?? []) {
    const codigoOriginal = normUpper(uc.codigo);
    const codigoNorm = normUCCodigo(uc.codigo);

    const created = await prisma.unidadeCurricular.create({
      data: {
        codigo: codigoNorm,
        nome: norm(uc.nome),
        descricao: uc.descricao ?? null,
        cargaHoraria: uc.cargaHoraria ?? null,
        cursoTecnicoId: curso.id
      }
    });

    setAliases(mapUC, created.id, codigoNorm, codigoOriginal);
    ucCount++;
  }

  // 2.2 Funções
  let funcCount = 0;
  for (const f of _curriculo.funcoes ?? []) {
    const codigoOriginal = normUpper(f.codigo);
    const codigoNorm = normFuncaoCodigo(f.codigo);

    const created = await prisma.funcao.create({
      data: {
        codigo: codigoNorm,
        nome: norm(f.nome),
        descricao: f.descricao ?? null
      }
    });

    setAliases(mapFunc, created.id, codigoNorm, codigoOriginal);
    funcCount++;
  }

  // 2.3 Subfunções
  let subFuncCount = 0;
  let subFuncSemFuncao = 0;
  for (const sub of _curriculo.subfuncoes ?? []) {
    const subCodigo = normUpper(sub.codigo);
    const funcaoCodigoNorm = normFuncaoCodigo(sub.funcaoCodigo);
    const funcaoId = mapFunc.get(funcaoCodigoNorm);

    if (!funcaoId) {
      subFuncSemFuncao++;
      continue;
    }

    const created = await prisma.subfuncao.create({
      data: {
        codigo: subCodigo,
        nome: norm(sub.nome),
        descricao: sub.descricao ?? null,
        funcaoId
      }
    });

    setAliases(mapSubFunc, created.id, subCodigo);
    subFuncCount++;
  }

  // 2.4 Capacidades (sigla deve bater com o relacionamento)
  let capCount = 0;
  for (const cap of _curriculo.capacidades ?? []) {
    const sigla = normUpper(cap.sigla);
    const created = await prisma.capacidade.create({
      data: {
        sigla,
        descricao: norm(cap.descricao)
      }
    });
    setAliases(mapCap, created.id, sigla);
    capCount++;
  }

  // 2.5 Conhecimentos (OBJ-CONH-000xx -> CONH-xx)
  let conhCount = 0;

  // ✅ novo map
  const mapConhInfoById = new Map<number, { codigo: string; nome: string }>();

  for (const conh of _curriculo.conhecimentos ?? []) {
    const codigoOriginal = normUpper(conh.codigo);
    const codigoNorm = normConhecimentoCodigo(conh.codigo);

    const created = await prisma.conhecimento.create({
      data: {
        codigo: codigoNorm,
        nome: norm(conh.nome),
        descricao: conh.descricao ?? null
      }
    });

    // alias: CONH-xx e OBJ-CONH-000xx
    setAliases(mapConh, created.id, codigoNorm, codigoOriginal);

    // ✅ salva info por id
    mapConhInfoById.set(created.id, { codigo: created.codigo, nome: created.nome });

    conhCount++;
  }


  // 2.6 SubConhecimentos (conhecimentoCodigo já vem como CONH-xx em vários casos)
    let subConhCount = 0;
    let subConhIgnorados = 0;
    let subConhSemPai = 0;

    // ✅ DECLARA FORA do IF (pra poder logar depois)
    const subConhIgnoradosDetalhes: Array<{
      codigo: string;
      nomeOriginal: string;
      conhecimentoCodigoOriginal: string;
      conhecimentoCodigoNorm: string;
      conhecimentoId?: number;
      paiCodigo?: string;
      paiNome?: string;
    }> = [];

    if ((_curriculo.subConhecimentos ?? []).length > 0) {
      for (const subc of _curriculo.subConhecimentos ?? []) {
        const nomeOriginal = String(subc.nome ?? '');
        const nome = norm(nomeOriginal);

        // saneamento mínimo (há entradas literalmente "{")
        if (!nome || nome === '{' || nome === '}') {
          subConhIgnorados++;

          const conhecimentoCodigoOriginal = normUpper(subc.conhecimentoCodigo);
          const conhecimentoCodigoNorm = normConhecimentoCodigo(subc.conhecimentoCodigo);
          const conhecimentoId = mapConh.get(conhecimentoCodigoNorm);
          const infoPai = conhecimentoId ? mapConhInfoById.get(conhecimentoId) : undefined;

          subConhIgnoradosDetalhes.push({
            codigo: normUpper(subc.codigo),
            nomeOriginal,
            conhecimentoCodigoOriginal,
            conhecimentoCodigoNorm,
            conhecimentoId: conhecimentoId ?? undefined,
            paiCodigo: infoPai?.codigo,
            paiNome: infoPai?.nome,
          });

          continue;
        }

        const conhCodigoNorm = normConhecimentoCodigo(subc.conhecimentoCodigo);
        const conhId = mapConh.get(conhCodigoNorm);

        if (!conhId) {
          subConhSemPai++;
          continue;
        }

        await prisma.subConhecimento.create({
          data: {
            codigo: normUpper(subc.codigo),
            nome,
            descricao: subc.descricao ?? null,
            ordem: subc.ordem ?? null,
            conhecimentoId: conhId,
          },
        });

        subConhCount++;
      }
    }


  console.log(
    `✅ Currículo criado: ${ucCount} UCs | ${funcCount} Funções | ${subFuncCount} Subfunções | ${capCount} Capacidades | ${conhCount} Conhecimentos | ${subConhCount} SubConhecimentos`
  );

  if (subFuncSemFuncao > 0) console.warn(`⚠️  ${subFuncSemFuncao} subfunções não foram criadas por falta de função (código não mapeado).`);

  if (subConhIgnorados > 0) {
    console.warn(`⚠️  ${subConhIgnorados} subConhecimentos ignorados por nome inválido (ex: "{").`);

    console.warn('📌 Lista de subConhecimentos ignorados (detalhes):');
    for (const item of subConhIgnoradosDetalhes) {
      console.warn(
        `   - codigo=${item.codigo} | nomeOriginal="${item.nomeOriginal}"` +
        ` | conhOrig=${item.conhecimentoCodigoOriginal} | conhNorm=${item.conhecimentoCodigoNorm}` +
        ` | conhId=${item.conhecimentoId ?? 'N/A'} | paiCodigo=${item.paiCodigo ?? 'N/A'} | paiNome="${item.paiNome ?? 'N/A'}"`
      );
    }
  }

  

  if (subConhSemPai > 0) console.warn(`⚠️  ${subConhSemPai} subConhecimentos não foram criados por falta do Conhecimento pai (código não mapeado).`);

  // ==========================================
  // 3. LINKANDO ENTIDADES (RELACIONAMENTOS)
  // ==========================================
  console.log('🔗 Linkando Entidades Curriculares...');

  // 3.1 Curso ↔ Funções
  const cursoFuncoesData: { cursoTecnicoId: number; funcaoId: number }[] = [];
  let cursoFuncoesSemFuncao = 0;

  for (const rel of _relacionamentos.cursoFuncoes ?? []) {
    // se existir mais de 1 curso no futuro, esse filtro evita “link errado”
    if (norm(rel.cursoCodigo) && norm(rel.cursoCodigo) !== cursoCodigo) continue;

    const funcId = mapFunc.get(normFuncaoCodigo(rel.funcaoCodigo));
    if (!funcId) {
      cursoFuncoesSemFuncao++;
      continue;
    }
    cursoFuncoesData.push({ cursoTecnicoId: curso.id, funcaoId: funcId });
  }

  if (cursoFuncoesData.length > 0) {
    await prisma.cursoFuncao.createMany({ data: cursoFuncoesData, skipDuplicates: true });
  }
  if (cursoFuncoesSemFuncao > 0) console.warn(`⚠️  ${cursoFuncoesSemFuncao} vínculos Curso↔Função não criados (Função não mapeada).`);

  // 3.2 Subfunções ↔ Capacidades
  const subfuncaoCapsData: { subfuncaoId: number; capacidadeId: number }[] = [];
  let subfuncaoCapsPerdidos = 0;

  for (const rel of _relacionamentos.subfuncaoCapacidades ?? []) {
    const subId = mapSubFunc.get(normUpper(rel.subfuncaoCodigo));
    const capId = mapCap.get(normUpper(rel.capacidadeSigla));
    if (!subId || !capId) {
      subfuncaoCapsPerdidos++;
      continue;
    }
    subfuncaoCapsData.push({ subfuncaoId: subId, capacidadeId: capId });
  }

  if (subfuncaoCapsData.length > 0) {
    await prisma.subfuncaoCapacidade.createMany({ data: subfuncaoCapsData, skipDuplicates: true });
  }
  if (subfuncaoCapsPerdidos > 0) console.warn(`⚠️  ${subfuncaoCapsPerdidos} vínculos Subfunção↔Capacidade não criados (Subfunção/Capacidade não mapeada).`);

  // 3.3 Unidade Curricular ↔ Conhecimentos
  const ucConhData: { unidadeCurricularId: number; conhecimentoId: number }[] = [];
  let ucConhPerdidos = 0;

  for (const rel of _relacionamentos.unidadeCurricularConhecimentos ?? []) {
    const ucId = mapUC.get(normUCCodigo(rel.unidadeCurricularCodigo));
    const conhId = mapConh.get(normConhecimentoCodigo(rel.conhecimentoCodigo));
    if (!ucId || !conhId) {
      ucConhPerdidos++;
      continue;
    }
    ucConhData.push({ unidadeCurricularId: ucId, conhecimentoId: conhId });
  }

  if (ucConhData.length > 0) {
    await prisma.unidadeCurricularConhecimento.createMany({ data: ucConhData, skipDuplicates: true });
  }
  if (ucConhPerdidos > 0) console.warn(`⚠️  ${ucConhPerdidos} vínculos UC↔Conhecimento não criados (UC/Conhecimento não mapeado).`);

  // 3.4 Capacidade ↔ Conhecimentos
  const capConhData: { capacidadeId: number; conhecimentoId: number }[] = [];
  let capConhPerdidos = 0;

  for (const rel of _relacionamentos.capacidadeConhecimentos ?? []) {
    const capId = mapCap.get(normUpper(rel.capacidadeSigla));
    const conhId = mapConh.get(normConhecimentoCodigo(rel.conhecimentoCodigo));
    if (!capId || !conhId) {
      capConhPerdidos++;
      continue;
    }
    capConhData.push({ capacidadeId: capId, conhecimentoId: conhId });
  }

  if (capConhData.length > 0) {
    await prisma.capacidadeConhecimento.createMany({ data: capConhData, skipDuplicates: true });
  }
  if (capConhPerdidos > 0) console.warn(`⚠️  ${capConhPerdidos} vínculos Capacidade↔Conhecimento não criados (Capacidade/Conhecimento não mapeado).`);

  console.log('✅ Relacionamentos curriculares linkados.');

  // ==========================================
  // 4. GAMIFICAÇÃO (Fonte: conquistas_meta.json)
  // ==========================================
  console.log('🏆 Configurando Gamificação (Conquistas e Títulos)...');

  await prisma.titulo.createMany({
    data: _titulosData.map((t: any) => ({ nome: t.nome, nivel: t.nivel, minPontos: t.pontos })),
    skipDuplicates: true
  });

  for (const c of _conquistasMeta) {
    // 🛡️ Fallback de Segurança para Enum:
    // Se o requisitoTipo no JSON não existir no Enum do Prisma, usa 'SIMULADOS_TOTAL' para não quebrar o seed.
    const requisitoTipoValido = (Object.values(TipoRequisitoConquista) as string[]).includes(c.requisitoTipo)
      ? c.requisitoTipo
      : 'SIMULADOS_TOTAL';

    const categoriaValida = isValidCategoriaConquista(c.categoria) ? c.categoria : 'INICIO_ENGAJAMENTO';

    await prisma.conquista.create({
      data: {
        key: c.key,
        nome: c.nome,
        descricao: c.descricao || c.desc || 'Sem descrição', // Suporta ambos os formatos
        icone: c.icone || 'Trophy',

        // Dados de Requisito
        requisitoTipo: requisitoTipoValido,
        requisitoValor: c.requisitoValor || 0,

        // Dados de Recompensa
        pontos: c.pontos || 0,
        raridade: c.raridade || 'COMUM',
        categoria: categoriaValida,
        bonusMultiplier: c.bonusMultiplier || 1.0, // Lê do JSON gerado

        // Flags de Controle
        oculta: c.oculta || false,
        impossivel: c.impossivel || false,
        adminOnly: c.adminOnly || false,
        ativo: c.ativo !== undefined ? c.ativo : true
      }
    });
  }

  // ==========================================
  // 5. USUÁRIOS E DADOS DE TESTE
  // ==========================================
  console.log('👤 Criando Usuários...');

  const hashedAdmin = await bcrypt.hash(adminPass, 10);

  // Criar ADMIN
  await prisma.usuario.create({
    data: {
      nome: 'Administrador Simmula',
      email: adminEmail,
      senhaHash: hashedAdmin,
      tipo: 'SUPER_ADMIN',
      ativo: true,
      dataNascimento: new Date('1998-03-11'),
      gamificacao: { create: { nivel: 100, pontos: 989171 } }
    }
  });

  // ==========================================
  // 6. AUXILIARES
  // ==========================================
  console.log('🏫 Inserindo Instituições e Bancas...');
  await prisma.instituicao.createMany({ data: _instituicoesData, skipDuplicates: true });
  await prisma.banca.createMany({ data: _bancasData, skipDuplicates: true });

  console.log('✅ Seed Finalizado com Sucesso! Gamificação e Currículo Prontos.');
}

main()
  .catch((e) => {
    console.error('❌ Erro Fatal no Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
