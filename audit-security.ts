import fs from 'fs';
import path from 'path';

// --- CONFIGURAÇÕES ---
const ROOTS_TO_SCAN = [path.join(process.cwd(), 'app')]; 

const EXCLUSIONS = ['layout.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx', 'global-error.tsx'];

// Rotas de API públicas ou com lógica própria
const WHITELIST_AUTH_API = [
    'app/api/auth/login', 
    'app/api/auth/register', 
    'app/api/auth/recuperar', 
    'app/api/auth/verify', 
    'app/api/cron',
    'app/api/upload',
    'app/api/unidades', // Às vezes públicas para catálogo
    'app/api/cursos'    // Às vezes públicas para catálogo
];

// Rotas de API que não exigem CSRF
const WHITELIST_CSRF_API = [
    'app/api/auth', 
    'app/api/csrf', 
    'app/api/cron'
];

// Páginas que, mesmo em pastas protegidas, podem ser públicas (se houver)
const WHITELIST_PAGES: string[] = [
    // ex: 'app/(student)/estudante/termos/page.tsx'
];

// --- CORES ---
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    bold: "\x1b[1m",
    gray: "\x1b[90m"
};

// --- INTERFACES ---
interface Issue {
    level: 'CRITICO' | 'ALTO' | 'MEDIO' | 'INFO';
    msg: string;
}

interface Stats {
    filesScanned: number;
    issuesFound: number;
    critical: number;
}

const stats: Stats = { filesScanned: 0, issuesFound: 0, critical: 0 };

console.log(`${colors.blue}${colors.bold}=== AUDITORIA DE SEGURANÇA V2 (SIMMULAQUIZ) ===${colors.reset}\n`);

function scanDirectory(directory: string) {
    if (!fs.existsSync(directory)) {
        console.warn(`${colors.yellow}Diretório não encontrado: ${directory}${colors.reset}`);
        return;
    }

    const files = fs.readdirSync(directory);

    files.forEach(file => {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (!['node_modules', '.next', '.git', '__tests__'].includes(file)) {
                scanDirectory(fullPath);
            }
        } else {
            if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !EXCLUSIONS.includes(file)) {
                analyzeFile(fullPath);
            }
        }
    });
}

function analyzeFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    
    const isApiRoute = relativePath.includes('app/api/');
    const isPage = relativePath.endsWith('page.tsx');
    
    if (!isApiRoute && !isPage) return;

    stats.filesScanned++;
    const issues: Issue[] = [];

    // ========================================================================
    // 1. ANÁLISE DE API ROUTES (Backend)
    // ========================================================================
    if (isApiRoute && filePath.endsWith('route.ts')) {
        const hasMutation = /export async function (POST|PUT|DELETE|PATCH)/.test(content);

        // A. Autenticação
        // Busca: getSession, jwtVerify ou validação manual de token
        const hasAuthCheck = /getSession|jwtVerify|verifyJWT|token|session/.test(content);
        const isWhitelistedAuth = WHITELIST_AUTH_API.some(w => relativePath.includes(w));

        if (!hasAuthCheck && !isWhitelistedAuth) {
            issues.push({ 
                level: 'CRITICO', 
                msg: 'API: Nenhuma verificação de sessão detectada (getSession/token ausente).' 
            });
        }

        // B. Rate Limit (Proteção de Infra)
        // Busca: rateLimit, .limit(, apiRateLimit
        const hasRateLimit = /rateLimit|limit\(|apiRateLimit/.test(content);
        if (!hasRateLimit && !relativePath.includes('cron')) {
            issues.push({ 
                level: 'MEDIO', 
                msg: 'API: Nenhum Rate Limit detectado.' 
            });
        }

        // C. Cache Control (Dados sensíveis não devem ter cache)
        if (content.includes('NextResponse.json') && !content.includes('Cache-Control') && !content.includes('revalidate = 0') && !content.includes("dynamic = 'force-dynamic'")) {
             // Opcional: Apenas INFO pois o Nextjs tem defaults variados
             // issues.push({ level: 'INFO', msg: 'API: Verifique se o Cache-Control está configurado.' });
        }
    }

    // ========================================================================
    // 2. ANÁLISE DE PÁGINAS (Frontend)
    // ========================================================================
    if (isPage) {
        const isProtectedZone = relativePath.includes('(student)') || relativePath.includes('(admin)');
        const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
        const isWhitelistedPage = WHITELIST_PAGES.some(w => relativePath.includes(w));

        if (isProtectedZone && !isWhitelistedPage) {
            let isSecure = false;
            let securityMethod = '';

            // --- Cenário A: Server Component ---
            // Deve usar getSession diretamente
            if (!isClientComponent) {
                if (content.includes('getSession')) {
                    isSecure = true;
                    securityMethod = 'Server Auth (getSession)';
                }
            } 
            
            // --- Cenário B: Client Component (A MELHORIA ESTÁ AQUI) ---
            // Pode usar:
            // 1. Hook useCsrf (que valida sessão indiretamente)
            // 2. Fetch explícito para /api/csrf ou /api/auth
            // 3. Redirecionamento forçado para /auth/login ou /login
            else {
                const hasUseCsrf = content.includes('useCsrf');
                const hasFetchAuth = /fetch\s*\(\s*['"`]\/api\/(csrf|auth)/.test(content);
                const hasRedirect = /router\.push\s*\(\s*['"`]\/?(auth\/)?login/.test(content) || /redirect\s*\(\s*['"`]\/?(auth\/)?login/.test(content);
                
                if (hasUseCsrf || hasFetchAuth || hasRedirect) {
                    isSecure = true;
                    securityMethod = 'Client Auth (useCsrf/Fetch/Redirect)';
                }
            }

            if (!isSecure) {
                issues.push({ 
                    level: 'CRITICO', 
                    msg: `Página Protegida (${isClientComponent ? 'Client' : 'Server'}) sem verificação de segurança detectada.` 
                });
            } else {
                // Debug opcional para ver o que ele detectou como seguro
                // console.log(`${colors.gray}  [OK] ${relativePath} protegido via ${securityMethod}${colors.reset}`);
            }
        }
    }

    // --- RELATÓRIO DO ARQUIVO ---
    if (issues.length > 0) {
        stats.issuesFound += issues.length;
        console.log(`${colors.bold}Arquivo: ${relativePath}${colors.reset}`);
        
        issues.forEach(issue => {
            let color = colors.blue;
            if (issue.level === 'CRITICO') { color = colors.red; stats.critical++; }
            if (issue.level === 'ALTO') color = colors.yellow;
            
            console.log(`  [${color}${issue.level}${colors.reset}] ${issue.msg}`);
        });
        console.log('');
    }
}

// --- EXECUÇÃO ---
ROOTS_TO_SCAN.forEach(dir => scanDirectory(dir));

// --- CONCLUSÃO ---
console.log(`${colors.blue}=== RESUMO DA AUDITORIA ===${colors.reset}`);
console.log(`Arquivos verificados: ${stats.filesScanned}`);
console.log(`Problemas encontrados: ${stats.issuesFound}`);

if (stats.critical > 0) {
    console.log(`\n${colors.red}❌ ATENÇÃO: ${stats.critical} FALHAS CRÍTICAS ENCONTRADAS.${colors.reset}`);
    console.log(`${colors.red}Revise os arquivos listados acima imediatamente.${colors.reset}`);
} else {
    console.log(`\n${colors.green}✅ SUCESSO: Nenhuma falha crítica detectada.${colors.reset}`);
    console.log(`${colors.green}O sistema de blindagem híbrida (Server/Client) parece consistente.${colors.reset}`);
}
console.log(`\n${colors.gray}Fim da execução.${colors.reset}`);