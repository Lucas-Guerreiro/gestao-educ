import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma } from '@/types';

interface AlunoModalProps {
  alunoId: string | null;
  alunos: Aluno[];
  turmas: Turma[];
  fecharModal: () => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const AlunoModal: React.FC<AlunoModalProps> = ({
  alunoId,
  alunos,
  turmas,
  fecharModal,
  setSyncStatus,
}) => {
  const [nome, setNome] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  const [especificidade, setEspecificidade] = useState('');

  useEffect(() => {
    if (alunoId) {
      const al = alunos.find(a => a.id === alunoId);
      if (al) {
        setNome(al.nome || '');
        setTurmaId(al.turmaId || '');
        setNascimento(al.nascimento || '');
        setAtivo(al.ativo !== false);
        setObservacoes(al.observacoes || '');
        setEspecificidade(al.especificidade || '');
      }
    } else {
      setNome('');
      setTurmaId('');
      setNascimento('');
      setAtivo(true);
      setObservacoes('');
      setEspecificidade('');
    }
  }, [alunoId, alunos]);

  const salvar = async () => {
    if (!nome || !turmaId) {
      alert('Por favor, informe o nome e a turma do aluno.');
      return;
    }

    const payload = {
      nome: nome.trim(),
      turmaId,
      nascimento,
      ativo,
      observacoes: observacoes.trim(),
      especificidade: especificidade.trim()
    };

    setSyncStatus('saving');
    try {
      if (alunoId) {
        await updateDoc(doc(db, 'alunos', alunoId), payload);
      } else {
        await addDoc(collection(db, 'alunos'), payload);
      }
      setSyncStatus('ok');
      fecharModal();
    } catch (err: any) {
      setSyncStatus('err');
      alert('Erro ao salvar aluno: ' + err.message);
    }
  };

  return (
    <div id="aluno-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 1000, alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '440px', margin: '1rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
          <span id="aluno-modal-title" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
            {alunoId ? 'Editar Aluno' : 'Novo Aluno'}
          </span>
          <button onClick={fecharModal} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="f">
            <label>Nome completo *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Ana Souza" />
          </div>
          <div className="f">
            <label>Turma vinculada *</label>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">— selecione —</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Data de nascimento</label>
            <input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
          </div>
          <div className="f">
            <label>Status</label>
            <select value={String(ativo)} onChange={(e) => setAtivo(e.target.value === 'true')}>
              <option value="true">✅ Ativo</option>
              <option value="false">⛔ Inativo</option>
            </select>
          </div>
          <div className="f">
            <label>Especificidade do Aluno</label>
            <input value={especificidade} onChange={(e) => setEspecificidade(e.target.value)} placeholder="Ex: TDAH, Autismo, Dislexia, Cadeirante..." />
          </div>
          <div className="f">
            <label>Observações</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} style={{ height: '60px' }} placeholder="Observações médicas ou de rendimento..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <button className="btn" onClick={fecharModal}>Cancelar</button>
          <button className="btn pri" onClick={salvar}><i className="ti ti-device-floppy"></i> Salvar Aluno</button>
        </div>
      </div>
    </div>
  );
};

export default AlunoModal;
