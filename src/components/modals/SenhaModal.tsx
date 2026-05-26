import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { AdminConfig } from '@/types';

interface SenhaModalProps {
  adminConfig: AdminConfig;
  setAdminConfig: (config: AdminConfig) => void;
  fecharModal: () => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const SenhaModal: React.FC<SenhaModalProps> = ({
  adminConfig,
  setAdminConfig,
  fecharModal,
  setSyncStatus,
}) => {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [msg, setMsg] = useState({ text: '', color: '' });

  const alterarSenha = async () => {
    if (!atual || !nova || !confirma) {
      setMsg({ text: 'Preencha todos os campos.', color: 'var(--danger)' });
      return;
    }

    const senhaCorreta = adminConfig.senha || 'admin123';
    if (atual !== senhaCorreta) {
      setMsg({ text: 'Senha atual incorreta.', color: 'var(--danger)' });
      return;
    }

    if (nova !== confirma) {
      setMsg({ text: 'A nova senha e a confirmação não conferem.', color: 'var(--danger)' });
      return;
    }

    setSyncStatus('saving');
    try {
      await updateDoc(doc(db, 'config', 'admin'), { senha: nova });
      setAdminConfig({ ...adminConfig, senha: nova });
      setMsg({ text: 'Senha alterada com sucesso!', color: 'var(--success)' });
      setAtual('');
      setNova('');
      setConfirma('');
      setSyncStatus('ok');
      setTimeout(() => {
        fecharModal();
        setMsg({ text: '', color: '' });
      }, 1500);
    } catch (err: any) {
      setSyncStatus('err');
      setMsg({ text: 'Erro ao alterar senha: ' + err.message, color: 'var(--danger)' });
    }
  };

  return (
    <div id="senha-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 9000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '380px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ti ti-lock" style={{ fontSize: '20px', color: '#fff' }}></i>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 800 }}>Alterar Senha</div>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', fontSize: '16px', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="f">
            <label>Senha atual</label>
            <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} />
          </div>
          <div className="f">
            <label>Nova senha</label>
            <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} />
          </div>
          <div className="f">
            <label>Confirmar nova senha</label>
            <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </div>
          {msg.text && (
            <div id="sm-msg" style={{ fontSize: '12px', minHeight: '16px', fontWeight: 600, color: msg.color }}>
              {msg.text}
            </div>
          )}
          <button id="sm-btn" className="btn pri" onClick={alterarSenha} style={{ height: '40px', width: '100%' }}>
            <i className="ti ti-check"></i> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SenhaModal;
