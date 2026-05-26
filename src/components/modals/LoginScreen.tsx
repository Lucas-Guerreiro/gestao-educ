import React, { useState } from 'react';
import { AdminConfig } from '@/types';

interface LoginScreenProps {
  adminConfig: AdminConfig;
  setAutenticado: (autenticado: boolean) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ adminConfig, setAutenticado }) => {
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(false);

  const tentarLogin = () => {
    const senhaCorreta = adminConfig.senha || 'admin123';
    if (senha === senhaCorreta) {
      setAutenticado(true);
      setErro(false);
      setSenha('');
      sessionStorage.setItem('es_autenticado', 'true');
    } else {
      setErro(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      tentarLogin();
    }
  };

  return (
    <div id="login-screen" style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
            <i className="ti ti-school" style={{ fontSize: '32px', color: '#fff' }}></i>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '4px', letterSpacing: '0.5px' }}>EscolaSystem</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Sistema de Gestão Escolar Premium</div>
        </div>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9', marginBottom: '4px' }}>Acesso ao sistema</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '1.5rem' }}>Digite a senha de administrador</div>
          
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: '6px' }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input 
                id="login-senha" 
                type={mostrarSenha ? 'text' : 'password'} 
                placeholder="••••••••" 
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setErro(false); }}
                onKeyPress={handleKeyPress}
                style={{ width: '100%', height: '44px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9', fontSize: '15px', padding: '0 44px 0 14px', boxSizing: 'border-box', outline: 'none' }}
              />
              <button 
                id="login-toggle-vis" 
                type="button" 
                onClick={() => setMostrarSenha(!mostrarSenha)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <i className={`ti ${mostrarSenha ? 'ti-eye-off' : 'ti-eye'}`} id="login-eye-icon" style={{ fontSize: '18px' }}></i>
              </button>
            </div>
            {erro && (
              <div id="login-erro" style={{ fontSize: '12px', color: '#f87171', marginTop: '6px', minHeight: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="ti ti-alert-circle" style={{ fontSize: '14px' }}></i> Senha incorreta.
              </div>
            )}
          </div>
          
          <button 
            id="login-btn" 
            type="button" 
            onClick={tentarLogin}
            style={{ width: '100%', height: '44px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(139,92,246,0.25)' }}
          >
            <i className="ti ti-login" style={{ fontSize: '16px' }}></i> Entrar
          </button>
          
          <div style={{ marginTop: '1.2rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
            <i className="ti ti-info-circle" style={{ color: '#3b82f6', marginRight: '2px' }}></i> Senha padrão: <b style={{ color: '#94a3b8' }}>admin123</b>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
