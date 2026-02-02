'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Eye, EyeOff, Calendar, GraduationCap, Mail, Lock, User, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useCsrf } from '@/lib/hooks/use-csrf';

export default function RegisterPage() {
  const router = useRouter();
  const csrfToken = useCsrf();
  
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    dataNascimento: '',
    senha: '',
    confirmarSenha: '' 
  });
  
  const [codigo, setCodigo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const passwordRequirements = [
    { label: "Mínimo 10 caracteres", valid: formData.senha.length >= 10 },
    { label: "Letra maiúscula", valid: /[A-Z]/.test(formData.senha) },
    { label: "Letra minúscula", valid: /[a-z]/.test(formData.senha) },
    { label: "Número", valid: /[0-9]/.test(formData.senha) },
    { label: "Símbolo (!@#$)", valid: /[!@#$%^&*(),.?":{}|<>]/.test(formData.senha) },
  ];

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1/$2');
    if (v.length > 5) v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
    
    if (v.length > 10) v = v.substr(0, 10);

    setFormData({ ...formData, dataNascimento: v });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (honeypot) return; 

    setGeneralError('');
    setFieldErrors({});

    if (formData.senha !== formData.confirmarSenha) {
      setFieldErrors({ confirmarSenha: ["As senhas não coincidem."] });
      return;
    }

    const allRequirementsMet = passwordRequirements.every(r => r.valid);
    if (!allRequirementsMet) {
      setFieldErrors({ senha: ["A senha não atende a todos os requisitos de segurança."] });
      return;
    }

    if (formData.dataNascimento.length !== 10) {
        setFieldErrors({ dataNascimento: ["Data inválida. Use o formato Dia/Mês/Ano"] });
        return;
    }

    setLoading(true);

    try {
      const [dia, mes, ano] = formData.dataNascimento.split('/');
      const dataISO = new Date(`${ano}-${mes}-${dia}`).toISOString();

      const payload = {
        nome: formData.nome,
        email: formData.email,
        dataNascimento: dataISO,
        senha: formData.senha,
        website: honeypot
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setStep(2); 
      } else {
        if (data.details) {
          setFieldErrors(data.details);
        } else {
          setGeneralError(data.error || 'Erro ao realizar cadastro');
        }
      }
    } catch (err) {
      setGeneralError('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({
          email: formData.email,
          codigo: codigo
        })
      });

      const data = await res.json();

      if (res.ok) {
        setStep(3); 
      } else {
        setGeneralError(data.error || 'Código inválido ou expirado.');
      }
    } catch (err) {
      setGeneralError('Erro de conexão ao verificar.');
    } finally {
      setLoading(false);
    }
  };

  // TELA DE SUCESSO (STEP 3)
  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-green-50/30 to-gray-50 p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-green-500 via-green-600 to-green-500"></div>
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-green-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>

        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center border border-gray-100 relative z-10 animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-200/50 animate-pulse">
            <CheckCircle2 size={48} />
          </div>
          
          <h2 className="text-3xl font-oswald font-bold text-gray-900 mb-4">Conta Ativada!</h2>
          
          <p className="text-gray-600 mb-8 leading-relaxed font-lato">
            Seu e-mail foi confirmado com sucesso. Você já pode acessar o sistema e começar a treinar!
          </p>

          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 mb-8">
            <div className="flex items-center gap-3 text-green-700 justify-center">
              <Sparkles size={20} />
              <p className="text-sm font-roboto font-bold">
                Bem-vindo ao SimmulaQuiz!
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => router.push('/login')}
            className="w-full bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white py-4 rounded-2xl font-roboto font-bold transition-all shadow-xl shadow-blue-300/50 hover:shadow-2xl hover:shadow-blue-400/50 transform active:scale-[0.98] hover:scale-[1.02]"
          >
            Fazer Login Agora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 p-4 relative overflow-hidden">
      
      {/* Background decorativo */}
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900"></div>
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-blue-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-green-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles size={24} className="text-green-500/50" />
            </div>
          </div>
          <p className="text-gray-700 font-roboto font-bold mt-6 text-lg animate-pulse">
            {step === 1 ? 'Processando Cadastro...' : 'Validando...'}
          </p>
          <div className="flex gap-1 mt-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce animation-delay-200"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce animation-delay-400"></div>
          </div>
        </div>
      )}

      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-2xl border border-gray-100 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo/Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-700 to-blue-800 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200/50">
            <GraduationCap size={24} />
          </div>
          <span className="font-oswald font-bold text-2xl text-gray-900 tracking-tight">
            Simmula<span className="text-blue-700">Quiz</span>
          </span>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-oswald font-bold text-gray-900 mb-3">
            {step === 1 ? 'Crie sua Conta' : 'Confirme seu E-mail'}
          </h1>
          <p className="text-gray-600 text-sm font-lato leading-relaxed">
            {step === 1 ? 'Preencha os dados abaixo para começar' : `Enviamos um código para ${formData.email}`}
          </p>
        </div>

        {generalError && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 text-red-700 p-4 rounded-2xl mb-6 text-sm font-roboto font-bold border-2 border-red-200 flex items-start gap-3 shadow-sm">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">{generalError}</div>
          </div>
        )}

        {/* STEP 1: FORMULÁRIO DE CADASTRO */}
        {step === 1 && (
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Honeypot */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ display: 'none' }} value={honeypot} onChange={e => setHoneypot(e.target.value)} />

            {/* Grid: Nome + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1">Nome Completo</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-700 transition-colors">
                    <User size={20} />
                  </div>
                  <input 
                    type="text" 
                    disabled={loading}
                    className={`w-full pl-12 pr-4 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all shadow-sm ${fieldErrors.nome ? 'border-red-300 bg-red-50/50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'}`}
                    placeholder="Ex: João da Silva" 
                    value={formData.nome} 
                    onChange={(e) => setFormData({...formData, nome: e.target.value})} 
                  />
                </div>
                {fieldErrors.nome && (
                  <p className="text-xs text-red-600 mt-2 font-roboto font-bold ml-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {fieldErrors.nome[0]}
                  </p>
                )}
              </div>

              {/* Data de Nascimento */}
              <div>
                <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1">Data de Nascimento</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-700 transition-colors z-10">
                    <Calendar size={20} />
                  </div>
                  <input 
                    type="text"
                    maxLength={10}
                    disabled={loading}
                    className={`w-full pl-12 pr-4 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all shadow-sm ${fieldErrors.dataNascimento ? 'border-red-300 bg-red-50/50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'}`}
                    placeholder="DD/MM/AAAA"
                    value={formData.dataNascimento} 
                    onChange={handleDateChange} 
                  />
                </div>
                {fieldErrors.dataNascimento && (
                  <p className="text-xs text-red-600 mt-2 font-roboto font-bold ml-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {fieldErrors.dataNascimento[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Email (full width) */}
            <div>
              <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1">E-mail Profissional ou Pessoal</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-700 transition-colors">
                  <Mail size={20} />
                </div>
                <input 
                  type="email"
                  disabled={loading}
                  className={`w-full pl-12 pr-4 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all shadow-sm ${fieldErrors.email ? 'border-red-300 bg-red-50/50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'}`}
                  placeholder="Ex: joao@email.com" 
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-red-600 mt-2 font-roboto font-bold ml-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {fieldErrors.email[0]}
                </p>
              )}
            </div>

            {/* Senhas (grid 2 colunas) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1">Senha</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-700 transition-colors z-10">
                    <Lock size={20} />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"}
                    disabled={loading}
                    className={`w-full pl-12 pr-12 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all shadow-sm ${fieldErrors.senha ? 'border-red-300 bg-red-50/50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'}`}
                    placeholder="Mínimo 10 caracteres" 
                    value={formData.senha} 
                    onChange={(e) => setFormData({...formData, senha: e.target.value})} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-700 transition-colors z-10"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-2 ml-1">Confirmar Senha</label>
                <input 
                  type="password"
                  disabled={loading}
                  className={`w-full px-4 py-4 border-2 rounded-2xl font-roboto font-medium outline-none transition-all shadow-sm ${
                    formData.confirmarSenha && formData.senha !== formData.confirmarSenha 
                    ? 'border-red-300 bg-red-50/50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                    : 'border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-gray-300'
                  }`}
                  placeholder="Repita a senha" 
                  value={formData.confirmarSenha} 
                  onChange={(e) => setFormData({...formData, confirmarSenha: e.target.value})} 
                />
              </div>
            </div>

            {(fieldErrors.senha || fieldErrors.confirmarSenha) && (
              <div className="bg-gradient-to-r from-red-50 to-red-100 text-red-700 p-3 rounded-2xl text-sm font-roboto font-bold border-2 border-red-200 flex items-center gap-2">
                <AlertCircle size={16} />
                {fieldErrors.senha?.[0] || fieldErrors.confirmarSenha?.[0]}
              </div>
            )}

            {/* Requisitos de senha */}
            <div className="bg-gradient-to-br from-blue-50 to-gray-50 p-4 rounded-2xl border-2 border-blue-100">
              <p className="text-xs font-roboto font-bold text-gray-700 uppercase mb-3">Requisitos de Segurança:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {passwordRequirements.map((req, idx) => (
                  <div key={idx} className={`flex items-center gap-2 text-xs font-roboto font-medium transition-all ${req.valid ? 'text-green-600' : 'text-gray-500'}`}>
                    {req.valid ? (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <Check size={12} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <span className="leading-tight">{req.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 rounded-2xl font-roboto font-bold transition-all shadow-xl shadow-green-300/50 hover:shadow-2xl hover:shadow-green-400/50 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] hover:scale-[1.02] mt-6 uppercase tracking-wide text-sm"
            >
              {loading ? 'Processando Cadastro...' : 'Criar Conta Segura'}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFICAÇÃO DE EMAIL */}
        {step === 2 && (
          <form onSubmit={handleVerify} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 p-4 rounded-2xl text-center mb-6">
              <p className="text-sm font-roboto text-blue-900">
                Acesse seu e-mail <strong className="font-bold">{formData.email}</strong> e insira o código de verificação abaixo.
              </p>
            </div>

            <div>
              <label className="block text-xs font-roboto font-bold text-gray-600 uppercase tracking-wider mb-3 text-center">Código de 8 Dígitos</label>
              <input 
                type="text" 
                maxLength={8}
                disabled={loading}
                className="w-full p-4 border-2 border-blue-500 rounded-2xl text-center text-4xl font-mono tracking-[0.5em] outline-none focus:ring-4 focus:ring-blue-100 bg-blue-50/30 text-blue-700 placeholder:tracking-normal shadow-inner"
                placeholder="00000000"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} 
                autoFocus
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || codigo.length < 6} 
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 rounded-2xl font-roboto font-bold transition-all shadow-xl shadow-green-300/50 hover:shadow-2xl hover:shadow-green-400/50 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] hover:scale-[1.02] uppercase tracking-wide text-sm"
            >
              {loading ? 'Validando...' : 'Verificar e Ativar'}
            </button>
            
            <button 
              type="button" 
              onClick={() => setStep(1)}
              disabled={loading}
              className="w-full text-sm text-gray-500 hover:text-blue-700 font-roboto font-medium py-2 hover:bg-gray-50 rounded-xl transition-colors"
            >
              Corrigir e-mail / Voltar
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-3">
          <p className="text-sm text-gray-600 font-lato">
            Já tem uma conta?{' '}
            <Link href="/login" className={`text-blue-700 font-roboto font-bold hover:text-blue-800 hover:underline transition-colors ${loading ? 'pointer-events-none opacity-50' : ''}`}>
              Faça Login
            </Link>
          </p>
          <div>
            <Link href="/" className={`text-xs text-gray-500 hover:text-blue-700 transition-colors inline-flex items-center gap-1 font-roboto font-medium ${loading ? 'pointer-events-none opacity-50' : ''}`}>
              ← Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
