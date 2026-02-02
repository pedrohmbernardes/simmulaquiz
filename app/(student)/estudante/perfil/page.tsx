'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Award, ShieldAlert, Key, Trash2, Camera, ChevronRight, 
  User, Mail, Calendar, Save, AlertTriangle, X , Trophy
} from 'lucide-react';

import { ImageCropperModal } from '@/components/ui/ImageCropperModal';

// --- SECURITY HELPER (CSRF) ---
async function getCsrfToken() {
  try {
    const res = await fetch("/api/csrf", { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.csrfToken || data.token;
  } catch (error) {
    console.error("Failed to get security token", error);
    return null;
  }
}

export default function StudentProfile() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [perfilData, setPerfilData] = useState<any>(null);
  
  // Forms
  const [personalForm, setPersonalForm] = useState({ nome: '', email: '', dataNascimento: '' });
  const [passForm, setPassForm] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  
  // Loadings
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  
  // Modals and Visual States
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  // Deletion States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteCode, setDeleteCode] = useState('');

  // States: Data Change Verification
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false); 
  const [emailCode, setEmailCode] = useState(''); 

  // 🛡️ 1. ARMOR: Initial Session Validation
  useEffect(() => {
    getCsrfToken().then(token => {
        if (!token) router.push('/login');
    });
  }, [router]);

  // 1. Initial Load
  useEffect(() => {
    async function fetchPerfil() {
      try {
        const res = await fetch('/api/estudante/perfil');
        
        // 🛡️ Auth Check
        if (res.status === 401 || res.status === 403) {
            router.push('/login');
            return;
        }

        if (res.ok) {
          const data = await res.json();
          setPerfilData(data);
          
          setPersonalForm({
            nome: data.perfil.nome || '',
            email: data.perfil.email || '',
            dataNascimento: data.perfil.dataNascimento ? data.perfil.dataNascimento.split('T')[0] : ''
          });
        }
      } catch (error) {
        setMsg({ type: 'error', text: 'Falha ao carregar dados.' });
      } finally {
        setLoading(false);
      }
    }
    fetchPerfil();
  }, [router]);

  // --- IMAGE UPLOAD (ARMORED) ---
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-Side Validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        setMsg({ type: 'error', text: 'Formato inválido (Use JPG, PNG ou WEBP).' });
        return;
    }
    if (file.size > 5 * 1024 * 1024) { 
        setMsg({ type: 'error', text: 'A imagem deve ter no máximo 5MB.' });
        return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setSelectedImage(reader.result as string);
      setShowCropper(true);
    });
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setShowCropper(false);
    setImgLoading(true);
    setMsg({ type: '', text: '' });

    try {
        // 🛡️ 1. Get CSRF Token
        const csrfToken = await getCsrfToken();
        if (!csrfToken) throw new Error("Falha de segurança: Recarregue a página.");

        const file = new File([croppedBlob], "avatar.webp", { type: "image/webp" });
        const formData = new FormData();
        formData.append('file', file);

        // 🛡️ 2. Upload with Token
        const uploadRes = await fetch('/api/estudante/upload-foto', {
            method: 'POST',
            body: formData,
            headers: {
                'x-csrf-token': csrfToken
            }
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Falha no upload.');

        // 🛡️ 3. Update Profile with Token
        const updateRes = await fetch('/api/estudante/perfil', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify({ fotoUrl: uploadData.url })
        });

        if (updateRes.ok) {
            setPerfilData((prev: any) => ({
                ...prev,
                perfil: { ...prev.perfil, fotoUrl: uploadData.url }
            }));
            setMsg({ type: 'success', text: 'Foto atualizada!' });
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error('Erro ao salvar URL.');
        }

    } catch (error) {
        setMsg({ type: 'error', text: error instanceof Error ? error.message : 'Erro no processo de upload.' });
    } finally {
        setImgLoading(false);
        setSelectedImage(null);
    }
  };

  // --- DATA UPDATE (ARMORED) ---
  const handleRequestUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setShowSaveConfirmation(true);
  };

  const confirmPersonalDataUpdate = async () => {
    if (!showEmailOtpModal) setActionLoading(true);
    setShowSaveConfirmation(false);

    try {
        const csrfToken = await getCsrfToken();
        if (!csrfToken) throw new Error("Sessão expirada. Recarregue a página.");

        const payload: any = { ...personalForm };
        if (emailCode) {
            payload.codigoEmail = emailCode;
        }

        const res = await fetch('/api/estudante/perfil', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            if (data.step === 'EMAIL_VERIFICATION_REQUIRED') {
                setShowEmailOtpModal(true);
                setActionLoading(false); 
                setMsg({ type: '', text: '' });
            } else {
                setMsg({ type: 'success', text: 'Dados atualizados com sucesso!' });
                setShowEmailOtpModal(false);
                setEmailCode('');
                
                setPerfilData((prev: any) => ({
                    ...prev,
                    perfil: { ...prev.perfil, ...personalForm }
                }));
                
                router.refresh();
            }
        } else {
            setMsg({ type: 'error', text: data.error || 'Erro ao atualizar.' });
            setActionLoading(false);
        }
    } catch (error) {
        setMsg({ type: 'error', text: error instanceof Error ? error.message : 'Erro de conexão.' });
        setActionLoading(false);
    }
  };

  const handleVerifyEmailCode = async () => {
      setActionLoading(true);
      await confirmPersonalDataUpdate();
      setActionLoading(false);
  };

  // --- PASSWORD UPDATE (ARMORED) ---
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    if (passForm.novaSenha !== passForm.confirmar) {
      return setMsg({ type: 'error', text: 'As novas senhas não coincidem.' });
    }

    setPassLoading(true);
    try {
      const csrfToken = await getCsrfToken();
      if (!csrfToken) throw new Error("Sessão expirada. Recarregue a página.");

      const res = await fetch('/api/estudante/perfil', { 
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          senhaAtual: passForm.senhaAtual,
          novaSenha: passForm.novaSenha
        })
      });

      if (res.ok) {
        setMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
        setPassForm({ senhaAtual: '', novaSenha: '', confirmar: '' });
      } else {
        const data = await res.json();
        setMsg({ type: 'error', text: data.error || 'Erro ao alterar.' });
      }
    } catch (error) {
      setMsg({ type: 'error', text: error instanceof Error ? error.message : 'Erro de conexão.' });
    } finally {
      setPassLoading(false);
    }
  };

  // --- DELETION (ARMORED) ---
  const handleDeleteRequest = async () => {
    setActionLoading(true);
    try {
      const csrfToken = await getCsrfToken();
      if (!csrfToken) throw new Error("Sessão expirada. Recarregue a página.");

      const res = await fetch('/api/estudante/perfil', { 
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ codigo: deleteStep === 2 ? deleteCode : null })
      });
      const data = await res.json();

      if (data.step === 'CONFIRMATION_REQUIRED') {
        setDeleteStep(2); 
      } else if (data.success) {
        window.location.href = '/login?deleted=true';
      } else {
        setMsg({ type: 'error', text: data.error || 'Erro na operação.' });
      }
    } catch (error) {
      setMsg({ type: 'error', text: error instanceof Error ? error.message : 'Erro de conexão.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20 animate-pulse text-gray-400 font-bold text-xs uppercase tracking-widest">Carregando perfil...</div>;

  const recentConquistas = perfilData?.conquistas?.slice(0, 3) || [];

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20 font-sans">
      
      {/* 1. PROFILE HEADER */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-800 rounded-3xl p-8 text-white mb-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
            <Award size={200} />
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full border-4 border-white/30 shadow-lg overflow-hidden bg-white/10 flex items-center justify-center relative">
                {perfilData?.perfil.fotoUrl ? (
                    <Image 
                        src={perfilData.perfil.fotoUrl} 
                        alt="Avatar" 
                        fill 
                        className="object-cover"
                        unoptimized
                    />
                ) : (
                    <span className="text-5xl font-black text-white/80 select-none">
                        {perfilData?.perfil.nome.charAt(0)}
                    </span>
                )}
                {imgLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
            <button 
                onClick={() => !imgLoading && fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-400 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110 border-2 border-indigo-900 cursor-pointer disabled:opacity-50"
                disabled={imgLoading}
            >
                <Camera size={16} />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp"
                onChange={onFileSelect} 
            />
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-black font-oswald uppercase tracking-wide">{perfilData?.perfil.nome}</h1>
            <p className="text-blue-100 font-medium opacity-80 font-lato">{perfilData?.perfil.email}</p>
            
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
              {/* ✅ CORRECTION: Dynamic Title */}
              <span className="bg-yellow-400 text-yellow-950 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                <Award size={14} /> {perfilData?.progresso?.titulo|| 'Estudante'}
              </span>
              <span className="bg-white/20 px-4 py-1 rounded-full text-xs font-bold uppercase border border-white/10">
                Nível {perfilData?.progresso?.nivel || 1}
              </span>
            </div>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl text-center border border-white/10 backdrop-blur-sm min-w-[120px]">
            <p className="text-[10px] uppercase font-black tracking-tighter opacity-60">Total de XP</p>
            <p className="text-3xl font-black font-mono">{perfilData?.progresso?.pontos?.toLocaleString('pt-BR') || 0}</p>
          </div>
        </div>
      </div>

      {/* GLOBAL FEEDBACK */}
      {msg.text && (
        <div className={`p-4 rounded-xl mb-8 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2 ${msg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
            {msg.type === 'error' ? <ShieldAlert size={18} /> : '✓'} {msg.text}
        </div>
      )}

      {/* ... REST OF JSX (unchanged logic, just inside secured component) ... */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: ACHIEVEMENTS */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                    <Award size={18} className="text-blue-600" /> Conquistas
                </h2>
                <Link href="/estudante/conquistas" className="text-[10px] font-bold text-blue-600 hover:underline uppercase">
                    Ver Todas
                </Link>
            </div>
            
            <div className="space-y-4 flex-1">
                {recentConquistas.length > 0 ? (
                recentConquistas.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors">
                        <div className="text-2xl">{'🏅'}</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate" title={c.nome}>{c.nome}</p>
                            <p className="text-[10px] text-gray-500 truncate font-mono">
                                {new Date(c.dataConquista).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                    </div>
                ))
                ) : (
                <div className="text-center py-8 text-gray-400">
                    <Award size={48} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs italic">Nenhuma conquista desbloqueada ainda.</p>
                </div>
                )}
            </div>

            <Link href="/estudante/conquistas" className="mt-6 w-full py-3 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">
                Ir para Sala de Troféus <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* RIGHT: FORMS */}
        <div className="lg:col-span-2 space-y-8">
          {/* 1. PERSONAL DATA */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 font-oswald uppercase">
              <User size={20} className="text-blue-600" /> Meus Dados
            </h2>

            <form onSubmit={handleRequestUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <User size={12}/> Nome Completo
                        </label>
                        <input 
                            type="text" required
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-sans text-sm"
                            value={personalForm.nome}
                            onChange={e => setPersonalForm({...personalForm, nome: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <Calendar size={12}/> Nascimento
                        </label>
                        <input 
                            type="date"
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-sans text-sm text-gray-600"
                            value={personalForm.dataNascimento}
                            onChange={e => setPersonalForm({...personalForm, dataNascimento: e.target.value})}
                        />
                        <p className="text-[10px] text-gray-400 mt-1 text-right">Data no formato Dia/Mês/Ano</p>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                        <Mail size={12}/> E-mail de Acesso
                    </label>
                    <input 
                        type="email" required
                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-sans text-sm"
                        value={personalForm.email}
                        onChange={e => setPersonalForm({...personalForm, email: e.target.value})}
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button 
                        disabled={actionLoading}
                        className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {actionLoading ? 'Salvando...' : <><Save size={14} /> Salvar Alterações</>}
                    </button>
                </div>
            </form>
          </div>

          {/* 2. PASSWORD */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 font-oswald uppercase">
              <Key size={20} className="text-blue-600" /> Alterar Senha
            </h2>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha Atual</label>
                <input 
                  type="password" required
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-sans text-sm"
                  placeholder="••••••••"
                  value={passForm.senhaAtual}
                  onChange={e => setPassForm({...passForm, senhaAtual: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nova Senha</label>
                  <input 
                    type="password" required minLength={10}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-sans text-sm"
                    placeholder="Mínimo 10 caracteres"
                    value={passForm.novaSenha}
                    onChange={e => setPassForm({...passForm, novaSenha: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirmar Nova</label>
                  <input 
                    type="password" required minLength={10}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-sans text-sm"
                    placeholder="Repita a nova senha"
                    value={passForm.confirmar}
                    onChange={e => setPassForm({...passForm, confirmar: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                    disabled={passLoading}
                    className="w-full md:w-auto px-8 py-3 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {passLoading ? 'Processando...' : 'Atualizar Senha'}
                </button>
              </div>
            </form>
          </div>

          {/* 3. DANGER ZONE */}
          <div className="bg-red-50 p-8 rounded-2xl border border-red-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-red-800 font-bold font-oswald uppercase">Encerrar Conta</h3>
              <p className="text-red-600/70 text-xs font-medium mt-1">Esta ação apagará permanentemente todo seu histórico.</p>
            </div>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 bg-white border border-red-200 hover:border-red-300 px-4 py-2 rounded-lg font-black text-xs uppercase tracking-tighter shadow-sm transition-all"
            >
              <Trash2 size={16} /> Excluir permanentemente
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: CONFIRMATION */}
      {showSaveConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
               <h2 className="text-xl font-black text-gray-900 font-oswald uppercase flex items-center gap-2">
                 <AlertTriangle className="text-yellow-500" size={24} /> Confirmar Alterações
               </h2>
               <button onClick={() => setShowSaveConfirmation(false)} className="text-gray-400 hover:text-gray-600">
                 <X size={20} />
               </button>
            </div>
            
            <div className="space-y-4 mb-6">
               <p className="text-gray-600 text-sm font-lato">
                 Você está prestes a atualizar suas informações pessoais. Verifique se os dados estão corretos.
               </p>
               
               {personalForm.email !== perfilData?.perfil?.email && (
                 <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl text-xs text-yellow-800 font-bold flex items-start gap-2">
                    <ShieldAlert className="shrink-0" size={16} />
                    <span>
                       Atenção: Ao alterar seu e-mail, enviaremos um código de verificação para o <u>novo endereço</u>.
                    </span>
                 </div>
               )}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmPersonalDataUpdate}
                disabled={actionLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 uppercase tracking-wide text-sm shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"/> : 'Confirmar e Salvar'}
              </button>
              <button onClick={() => setShowSaveConfirmation(false)} className="w-full py-3 text-gray-500 text-xs font-bold uppercase tracking-wide hover:bg-gray-50 rounded-xl transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EMAIL VERIFICATION (OTP) */}
      {showEmailOtpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-gray-900 mb-2 font-oswald uppercase flex items-center gap-2">
              <Mail className="text-blue-500" size={24} /> Verificar E-mail
            </h2>
            
            <p className="text-gray-500 text-sm mb-6 font-lato">
               Enviamos um código de segurança para <strong>{personalForm.email}</strong>. Digite-o abaixo para confirmar a troca.
            </p>

            <div className="mb-6">
                <input 
                  type="text"
                  maxLength={6}
                  className="w-full text-center text-3xl font-mono tracking-[0.5em] p-3 border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none text-blue-600 font-bold uppercase"
                  placeholder="000000"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                />
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleVerifyEmailCode}
                disabled={actionLoading || emailCode.length < 6}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 uppercase tracking-wide text-sm shadow-lg shadow-blue-200 transition-all"
              >
                {actionLoading ? 'Verificando...' : 'Validar e Trocar E-mail'}
              </button>
              <button 
                onClick={() => { 
                    setShowEmailOtpModal(false); 
                    setPersonalForm(prev => ({...prev, email: perfilData?.perfil.email})); // Reverts email
                }} 
                className="w-full py-3 text-gray-400 text-xs font-bold uppercase tracking-wide hover:text-gray-600"
              >
                Cancelar Troca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETION */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-gray-900 mb-2 font-oswald uppercase">
              {deleteStep === 1 ? 'Tem certeza?' : 'Confirme seu E-mail'}
            </h2>
            
            {deleteStep === 1 ? (
              <p className="text-gray-500 text-sm mb-8 font-lato">Para sua segurança, enviaremos um código de verificação para seu e-mail atual antes de apagar os dados.</p>
            ) : (
              <div className="mb-6">
                <p className="text-gray-500 text-xs mb-4">Digite o código enviado para <span className="font-bold text-gray-700">{perfilData?.perfil.email}</span></p>
                <input 
                  type="text"
                  maxLength={6}
                  className="w-full text-center text-3xl font-mono tracking-[0.5em] p-3 border-2 border-red-100 rounded-xl focus:border-red-500 outline-none text-red-600 font-bold"
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteRequest}
                disabled={actionLoading || (deleteStep === 2 && deleteCode.length < 6)}
                className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 uppercase tracking-wide text-sm shadow-lg shadow-red-200 transition-all"
              >
                {actionLoading ? 'Processando...' : deleteStep === 1 ? 'Enviar Código de Exclusão' : 'Confirmar e Apagar Tudo'}
              </button>
              <button onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }} className="w-full py-3 text-gray-400 text-xs font-bold uppercase tracking-wide hover:text-gray-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CROP */}
      {showCropper && selectedImage && (
        <ImageCropperModal
          imageSrc={selectedImage}
          onClose={() => { setShowCropper(false); setSelectedImage(null); }}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}