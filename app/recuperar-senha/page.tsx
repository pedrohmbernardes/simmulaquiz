'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, CheckCircle2, AlertCircle, KeyRound, GraduationCap, Sparkles, Shield } from 'lucide-react';
import { useCsrf } from '@/lib/hooks/use-csrf';

export default function RecuperarSenhaPage() {
  const router = useRouter();
  const csrfToken = useCsrf();
  
  const [step, setStep] = useState(1); // 1=Email, 2=Código/Senha, 3=Sucesso
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Enviar Código
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({ action: 'request', email })
      });
      // Sempre avança para não revelar se email existe ou não
      setStep(2);
    } catch (err) {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Redefinir Senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({ action: 'reset', email, code, newPassword: senha })
      });

      const data = await res.json();

      if (res.ok) {
        setStep(3);
      } else {
        setError(data.error || 'Erro ao redefinir senha.');
      }
    } catch (err) {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 p-4 relative overflow-hidden font-lato">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-700 via-purple-600 to-blue-700"></div>
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <KeyRound size={24} className="text-purple-600/50" />
            </div>
          </div>
          <p className="text-gray-700 font-roboto font-bold mt-6 text-lg animate-pulse">
            {step === 1 ? 'Enviando código...' : step === 2 ? 'Validando...' : 'Processando...'}
          </p>
          <div className="flex gap-1 mt-3">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce animation-delay-200"></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce animation-delay-400"></div>
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

        {/* HEADER DINÂMICO */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 mb-5 shadow-lg shadow-purple-100/50">
            {step === 1 && <Mail size={28} />}
            {step === 2 && <KeyRound size={28} />}
            {step === 3 && <CheckCircle2 size={28} className="text-green-600" />}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-oswald mb-3">
            {step === 1 && 'Recuperar Senha'}
            {step === 2 && 'Redefinir Senha'}
            {step === 3 && 'Senha Alterada!'}
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            {step === 1 && 'Informe seu e-mail para receber o código de recuperação'}
            {step === 2 && 'Digite o código recebido e sua nova senha'}
            {step === 3 && 'Sua senha foi redefinida com sucesso'}
          </p>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 text-red-700 p-4 rounded-2xl mb-6 text-sm font-roboto font-bold border-2 border-red-200 flex items-start gap-3 animate-in slide-in-from-top-2 shadow-sm">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* ETAPA 1: SOLICITAR CÓDIGO */}
        {step === 1 && (
          <form onSubmit={handleRequestCode} className="space-y-6">
            <div>
              <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1">
                E-mail Cadastrado
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-purple-600 transition-colors">
                  <Mail size={20} />
                </div>
                <input 
                  type="email" 
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 hover:border-gray-300 shadow-sm disabled:bg-gray-50"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-1 flex items-center gap-1">
                <Shield size={12} />
                Enviaremos um código de 8 dígitos para este e-mail
              </p>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-roboto font-bold py-4 rounded-2xl transition-all shadow-xl shadow-purple-300/50 hover:shadow-2xl hover:shadow-purple-400/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group transform active:scale-[0.98] hover:scale-[1.02]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Enviando...
                </div>
              ) : (
                <>
                  Enviar Código
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center pt-4">
              <Link 
                href="/login" 
                className="text-sm text-gray-500 hover:text-purple-600 font-roboto font-medium transition-colors inline-flex items-center gap-1"
              >
                ← Voltar para Login
              </Link>
            </div>
          </form>
        )}

        {/* ETAPA 2: REDEFINIR */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1 text-center">
                Código de 8 Dígitos
              </label>
              <input 
                type="text" 
                required 
                maxLength={8}
                disabled={loading}
                autoFocus
                className="w-full p-4 border-2 rounded-2xl text-center text-3xl font-mono tracking-[0.5em] outline-none transition-all border-purple-200 bg-purple-50/30 text-purple-700 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 shadow-inner placeholder:tracking-normal disabled:bg-gray-50"
                placeholder="00000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Código enviado para <strong className="text-gray-700">{email}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1">
                Nova Senha
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-purple-600 transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  required 
                  minLength={10}
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 hover:border-gray-300 shadow-sm disabled:bg-gray-50"
                  placeholder="Mínimo 10 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-1 flex items-center gap-1">
                <Shield size={12} />
                Use letras, números e caracteres especiais
              </p>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-roboto font-bold py-4 rounded-2xl transition-all shadow-xl shadow-green-300/50 hover:shadow-2xl hover:shadow-green-400/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group transform active:scale-[0.98] hover:scale-[1.02]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Validando...
                </div>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Redefinir Senha
                </>
              )}
            </button>

            <button 
              type="button" 
              onClick={() => setStep(1)} 
              disabled={loading}
              className="w-full text-sm text-gray-500 hover:text-purple-600 font-roboto font-medium py-2 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
            >
              Não recebi o código / Corrigir e-mail
            </button>
          </form>
        )}

        {/* ETAPA 3: SUCESSO */}
        {step === 3 && (
          <div className="text-center animate-in zoom-in-95 duration-300 space-y-6">
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-200/50 animate-pulse">
              <CheckCircle2 size={48} />
            </div>
            
            <div>
              <h2 className="text-2xl font-oswald font-bold text-gray-900 mb-2">
                Tudo Certo!
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Sua senha foi redefinida com sucesso. <br />
                Agora você já pode fazer login com a nova senha.
              </p>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
              <div className="flex items-center gap-3 text-green-700 justify-center">
                <Sparkles size={20} />
                <p className="text-sm font-roboto font-bold">
                  Sua conta está segura novamente!
                </p>
              </div>
            </div>
            
            <div className="space-y-3 pt-4">
              <button 
                onClick={() => router.push('/login')} 
                className="w-full bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-roboto font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-300/50 hover:shadow-2xl hover:shadow-blue-400/50 flex items-center justify-center gap-2 group transform active:scale-[0.98] hover:scale-[1.02]"
              >
                Fazer Login Agora
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <Link 
                href="/" 
                className="block text-sm text-gray-500 hover:text-blue-700 font-roboto font-medium transition-colors py-2"
              >
                Voltar para a página inicial
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
