'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Trophy, CheckCircle2, AlertCircle, GraduationCap } from 'lucide-react';
import { useCsrf } from '@/lib/hooks/use-csrf';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const csrfToken = useCsrf();
  
  const [form, setForm] = useState({ email: '', senha: '' });
  const [otp, setOtp] = useState('');
  const [verificationMode, setVerificationMode] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- LÓGICA DE LOGIN ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    setFieldErrors({}); 
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || '' 
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.ok) {
        // 1. Feedback Visual
        if (data.xpGanho && data.xpGanho > 0) {
            toast.success('Login Diário!', {
                description: `Você ganhou +${data.xpGanho} XP por voltar a estudar hoje!`,
                icon: <Trophy className="text-yellow-500" size={20} />,
                duration: 5000,
            });
        } else {
            toast.success(`Bem-vindo de volta, ${data.name || 'Estudante'}!`);
        }

        // 2. Verificação de troca de senha obrigatória
        if (data.requirePasswordChange) {
          router.push(`/nova-senha?email=${encodeURIComponent(form.email)}`);
          return;
        }

        // ✅ 3. LÓGICA DE REDIRECIONAMENTO ATUALIZADA
        // Alunos vão direto para o painel. Admins vão para a escolha.
        if (data.role === 'ALUNO') {
          router.push('/estudante');
        } else {
          router.push('/escolha-perfil'); 
        }
        
        router.refresh(); 
        
      } else {
        // TRATAMENTO DO LOGIN REATIVO
        if (res.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') {
            setVerificationMode(true);
            setVerifyError('');
            toast.message('Verificação Necessária', {
                description: 'Sua senha está correta, mas o e-mail não foi validado. Enviamos um novo código agora!',
                icon: <Mail className="text-blue-500" size={20} />,
                duration: 6000
            });
            setLoading(false);
            return;
        }

        if (data.details) {
          setFieldErrors(data.details);
        } else {
          setGeneralError(data.error || 'Erro ao entrar.');
          toast.error('Falha no login', { description: data.error });
        }
        setLoading(false); 
      }
    } catch (err) {
      setGeneralError('Erro de conexão.');
      toast.error('Erro de conexão', { description: 'Verifique sua internet.' });
      setLoading(false);
    }
  };

  // --- LÓGICA DE VERIFICAÇÃO (OTP) ---
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    setLoading(true);

    try {
        const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: form.email, codigo: otp })
        });

        if (res.ok) {
            toast.success('Conta verificada com sucesso!');
            // Após verificar, manda o aluno para o painel (fluxo padrão de aluno novo)
            window.location.href = '/estudante'; 
        } else {
            const data = await res.json();
            const msg = data.error || 'Código inválido';
            
            setVerifyError(msg);
            toast.error(msg);
            setLoading(false);
        }
    } catch (error) {
        setVerifyError('Erro de conexão. Tente novamente.');
        toast.error('Erro ao verificar código');
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 p-4 relative overflow-hidden font-lato">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900"></div>
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-blue-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-green-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-gray-200 border-t-blue-700 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock size={24} className="text-blue-700/50" />
            </div>
          </div>
          <p className="text-gray-700 font-roboto font-bold mt-6 text-lg animate-pulse">
             {verificationMode ? 'Validando Código...' : 'Autenticando...'}
          </p>
          <div className="flex gap-1 mt-3">
            <div className="w-2 h-2 bg-blue-700 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-700 rounded-full animate-bounce animation-delay-200"></div>
            <div className="w-2 h-2 bg-blue-700 rounded-full animate-bounce animation-delay-400"></div>
          </div>
        </div>
      )}

      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-gray-100 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo/Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-700 to-blue-800 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200/50">
            <GraduationCap size={24} />
          </div>
          <span className="font-oswald font-bold text-2xl text-gray-900 tracking-tight">
            Simmula<span className="text-blue-700">Quiz</span>
          </span>
        </div>

        {/* CABEÇALHO DINÂMICO */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 mb-5 shadow-lg shadow-blue-100/50">
            {verificationMode ? <Mail size={28} /> : <Lock size={28} />}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-oswald mb-3">
            {verificationMode ? 'Validar E-mail' : 'Bem-vindo de volta'}
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            {verificationMode 
                ? `Digite o código enviado para ${form.email}` 
                : 'Acesse sua conta para continuar estudando'}
          </p>
        </div>
        
        {generalError && !verificationMode && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 text-red-700 p-4 rounded-2xl mb-6 text-sm font-roboto font-bold border-2 border-red-200 flex items-start gap-3 animate-in slide-in-from-top-2 shadow-sm">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">{generalError}</div>
          </div>
        )}

        {/* --- FORMULÁRIO DE CÓDIGO (MODO VERIFICAÇÃO) --- */}
        {verificationMode ? (
            <form onSubmit={handleVerify} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div>
                    <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-3 text-center">
                      Código de 6 dígitos
                    </label>
                    <input 
                        type="text" 
                        maxLength={6}
                        autoFocus
                        className={`w-full text-center text-4xl font-mono tracking-[0.6em] p-4 border-2 rounded-2xl outline-none font-bold uppercase transition-all placeholder:tracking-normal shadow-inner
                            ${verifyError 
                                ? 'border-red-300 bg-red-50/50 text-red-600 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                                : 'border-blue-200 bg-blue-50/30 text-blue-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                            }`}
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => {
                            setOtp(e.target.value.replace(/\D/g, ''));
                            setVerifyError('');
                        }}
                        disabled={loading}
                    />
                    
                    {verifyError && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-red-600 text-sm font-roboto font-bold animate-in slide-in-from-top-1 bg-red-50 py-3 px-4 rounded-xl border border-red-200">
                            <AlertCircle size={18} />
                            <span>{verifyError}</span>
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={loading || otp.length < 6}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-roboto font-bold py-4 rounded-2xl transition-all shadow-xl shadow-green-200/50 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.98] hover:scale-[1.02]"
                >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Validando...
                      </div>
                    ) : (
                      <>
                        <CheckCircle2 size={20} /> 
                        Confirmar e Entrar
                      </>
                    )}
                </button>

                <button 
                    type="button" 
                    onClick={() => setVerificationMode(false)}
                    className="w-full text-gray-500 text-sm font-roboto font-bold hover:text-blue-700 uppercase transition-colors py-2 hover:bg-gray-50 rounded-xl"
                >
                    ← Voltar para Login
                </button>
            </form>
        ) : (
            /* --- FORMULÁRIO DE LOGIN PADRÃO --- */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1">
                  E-mail
                </label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-700 transition-colors">
                        <Mail size={20} />
                    </div>
                    <input 
                      type="email" 
                      disabled={loading}
                      className={`w-full pl-12 pr-4 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed shadow-sm
                        ${fieldErrors.email 
                          ? 'border-red-300 bg-red-50/50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                          : 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'
                        }`}
                      placeholder="seu@email.com"
                      value={form.email}
                      onChange={e => setForm({...form, email: e.target.value})}
                    />
                </div>
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-2 font-roboto font-bold ml-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {fieldErrors.email[0]}
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider">
                      Senha
                    </label>
                    <Link 
                      href="/recuperar-senha" 
                      className={`text-xs text-blue-700 hover:text-blue-800 font-roboto font-bold hover:underline transition-colors ${loading ? 'pointer-events-none opacity-50' : ''}`}
                    >
                        Esqueceu a senha?
                    </Link>
                </div>
                
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-700 transition-colors">
                        <Lock size={20} />
                    </div>
                    
                    <input 
                      type={showPassword ? "text" : "password"} 
                      disabled={loading}
                      className={`w-full pl-12 pr-14 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed shadow-sm
                        ${fieldErrors.senha 
                          ? 'border-red-300 bg-red-50/50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                          : 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'
                        }`}
                      placeholder="Sua senha secreta"
                      value={form.senha}
                      onChange={e => setForm({...form, senha: e.target.value})}
                    />
                    
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-700 transition-colors" 
                      tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
                {fieldErrors.senha && (
                  <p className="text-xs text-red-600 mt-2 font-roboto font-bold ml-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {fieldErrors.senha[0]}
                  </p>
                )}
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-roboto font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-300/50 hover:shadow-2xl hover:shadow-blue-400/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-xl flex items-center justify-center gap-2 group transform active:scale-[0.98] hover:scale-[1.02]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Entrando...
                  </div>
                ) : (
                    <>
                      Entrar no Sistema 
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                )}
              </button>
            </form>
        )}
        
        {!verificationMode && (
            <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-4">
              <p className="text-sm text-gray-600 font-lato">
                Ainda não tem uma conta?{' '}
                <Link 
                  href="/registrar" 
                  className={`text-blue-700 font-roboto font-bold hover:text-blue-800 hover:underline transition-colors ${loading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  Cadastre-se grátis
                </Link>
              </p>
              <div>
                <Link 
                  href="/" 
                  className={`text-xs text-gray-500 hover:text-blue-700 transition-colors inline-flex items-center gap-1 font-roboto font-medium ${loading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  ← Voltar para a página inicial
                </Link>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}