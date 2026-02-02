'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
// ✅ CORREÇÃO 1: Import do Hook de Segurança
import { useCsrf } from '@/lib/hooks/use-csrf';

export default function NovaSenhaObrigatoriaPage() {
  const router = useRouter();
  
  // ✅ CORREÇÃO 2: Obter o token CSRF
  const csrfToken = useCsrf();

  const [formData, setFormData] = useState({
    email: '',
    senhaAtual: '',
    novaSenha: '',
    confirmar: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (formData.novaSenha !== formData.confirmar) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/nova-senha', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            // ✅ CORREÇÃO 3: Header de Segurança obrigatório
            'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({
            email: formData.email,
            senhaAtual: formData.senhaAtual,
            novaSenha: formData.novaSenha
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        if (data.details) {
            setFieldErrors(data.details);
        } else {
            setError(data.error || 'Erro ao atualizar senha.');
        }
      }
    } catch (err) {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Se precisar preencher o email via URL (opcional, melhor UX)
  // useEffect(() => { ... ler query param ... }, [])

  if (success) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 animate-in zoom-in-95">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-green-100">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Senha Atualizada!</h2>
                <p className="text-gray-500 text-sm mb-6">Sua conta está segura novamente. Redirecionando para o login...</p>
                <button onClick={() => router.push('/login')} className="text-blue-600 font-bold hover:underline text-sm">
                    Ir para Login agora
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500"></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-50 text-orange-600 mb-4">
            <RefreshCw size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Troca Obrigatória</h1>
          <p className="text-gray-500 text-sm mt-2">
            Por segurança, você precisa definir uma nova senha antes de continuar.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium border border-red-100 flex gap-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">E-mail</label>
            <input 
              type="email" required
              className="w-full p-3 border rounded-xl font-medium outline-none transition border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Confirme seu e-mail"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Senha Atual (Temporária)</label>
            <div className="relative">
                <input 
                type="password" required
                className="w-full p-3 border rounded-xl font-medium outline-none transition border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 pr-10"
                placeholder="Senha recebida"
                value={formData.senhaAtual}
                onChange={e => setFormData({...formData, senhaAtual: e.target.value})}
                />
                <Lock size={16} className="absolute right-3 top-3.5 text-gray-400" />
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Nova Senha</label>
            <input 
              type="password" required minLength={10}
              className="w-full p-3 border rounded-xl font-medium outline-none transition border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Mínimo 10 caracteres"
              value={formData.novaSenha}
              onChange={e => setFormData({...formData, novaSenha: e.target.value})}
            />
            {fieldErrors.novaSenha && <p className="text-xs text-red-500 mt-1 font-bold ml-1">{fieldErrors.novaSenha[0]}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Confirmar Nova Senha</label>
            <input 
              type="password" required
              className="w-full p-3 border rounded-xl font-medium outline-none transition border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Repita a nova senha"
              value={formData.confirmar}
              onChange={e => setFormData({...formData, confirmar: e.target.value})}
            />
          </div>

          <button disabled={loading} className="w-full bg-brand-blue text-white py-3.5 rounded-xl font-bold hover:bg-blue-900 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:shadow-none">
            {loading ? 'Atualizando...' : 'Definir Nova Senha'}
          </button>

        </form>
      </div>
    </div>
  );
}