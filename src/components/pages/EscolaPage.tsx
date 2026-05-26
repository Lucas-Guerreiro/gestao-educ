import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Escola, Turma } from '@/types';

interface EscolaPageProps {
  escolas: Escola[];
  turmas: Turma[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const EscolaPage: React.FC<EscolaPageProps> = ({ escolas, turmas, setSyncStatus }) => {
  const [escolaNome, setEscolaNome] = useState('');
  const [editingEscolaId, setEditingEscolaId] = useState<string | null>(null);

  const [turmaNome, setTurmaNome] = useState('');
  const [turmaSerie, setTurmaSerie] = useState('');
  const [turmaEscolaId, setTurmaEscolaId] = useState('');
  const [editingTurmaId, setEditingTurmaId] = useState<string | null>(null);

  // Escolas CRUD
  const salvarEscola = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escolaNome.trim()) return;

    setSyncStatus('saving');
    try {
      if (editingEscolaId) {
        await updateDoc(doc(db, 'escolas', editingEscolaId), { nome: escolaNome.trim() });
        setEditingEscolaId(null);
      } else {
        await addDoc(collection(db, 'escolas'), { nome: escolaNome.trim() });
      }
      setEscolaNome('');
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar escola: ' + (err as Error).message);
    }
  };

  const editarEscola = (escola: Escola) => {
    setEditingEscolaId(escola.id);
    setEscolaNome(escola.nome);
  };

  const deletarEscola = async (id: string) => {
    if (!confirm('Deseja realmente deletar esta escola? Todas as turmas associadas perderão o vínculo.')) return;
    setSyncStatus('saving');
    try {
      await deleteDoc(doc(db, 'escolas', id));
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao deletar escola: ' + (err as Error).message);
    }
  };

  // Turmas CRUD
  const salvarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turmaNome.trim() || !turmaSerie.trim() || !turmaEscolaId) {
      alert('Preencha todos os campos da turma.');
      return;
    }

    setSyncStatus('saving');
    try {
      const payload = {
        nome: turmaNome.trim(),
        serie: turmaSerie.trim(),
        escolaId: turmaEscolaId,
      };

      if (editingTurmaId) {
        await updateDoc(doc(db, 'turmas', editingTurmaId), payload);
        setEditingTurmaId(null);
      } else {
        await addDoc(collection(db, 'turmas'), payload);
      }
      setTurmaNome('');
      setTurmaSerie('');
      setTurmaEscolaId('');
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar turma: ' + (err as Error).message);
    }
  };

  const editarTurma = (turma: Turma) => {
    setEditingTurmaId(turma.id);
    setTurmaNome(turma.nome);
    setTurmaSerie(turma.serie);
    setTurmaEscolaId(turma.escolaId);
  };

  const deletarTurma = async (id: string) => {
    if (!confirm('Deseja realmente deletar esta turma?')) return;
    setSyncStatus('saving');
    try {
      await deleteDoc(doc(db, 'turmas', id));
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao deletar turma: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '1rem', flexWrap: 'wrap' }}>
      
      {/* Coluna Escolas */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ti ti-building" style={{ color: 'var(--primary)' }}></i> Escolas Cadastradas
        </div>

        <form onSubmit={salvarEscola} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
          <input 
            value={escolaNome}
            onChange={(e) => setEscolaNome(e.target.value)}
            placeholder="Nome da Escola (ex: Colégio Anchieta)" 
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px' }}
          />
          <button type="submit" className="btn pri" style={{ height: '38px' }}>
            {editingEscolaId ? 'Atualizar' : 'Adicionar'}
          </button>
          {editingEscolaId && (
            <button type="button" className="btn" onClick={() => { setEditingEscolaId(null); setEscolaNome(''); }}>
              Cancelar
            </button>
          )}
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {escolas.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhuma escola cadastrada.</div>
          ) : (
            escolas.map(esc => (
              <div 
                key={esc.id} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{esc.nome}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => editarEscola(esc)}>
                    <i className="ti ti-pencil"></i>
                  </button>
                  <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => deletarEscola(esc.id)}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Coluna Turmas */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ti ti-users" style={{ color: 'var(--primary)' }}></i> Turmas & Séries
        </div>

        <form onSubmit={salvarTurma} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem', background: '#f8fafc', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="f">
              <label style={{ fontSize: '10px', fontWeight: 800 }}>Nome da Turma</label>
              <input value={turmaNome} onChange={(e) => setTurmaNome(e.target.value)} placeholder="Ex: 8º Ano A" style={{ height: '34px' }} />
            </div>
            <div className="f">
              <label style={{ fontSize: '10px', fontWeight: 800 }}>Série / Ano</label>
              <input value={turmaSerie} onChange={(e) => setTurmaSerie(e.target.value)} placeholder="Ex: 8º Ano" style={{ height: '34px' }} />
            </div>
          </div>
          <div className="f">
            <label style={{ fontSize: '10px', fontWeight: 800 }}>Escola Vinculada</label>
            <select value={turmaEscolaId} onChange={(e) => setTurmaEscolaId(e.target.value)} style={{ height: '34px' }}>
              <option value="">— selecione —</option>
              {escolas.map(esc => <option key={esc.id} value={esc.id}>{esc.nome}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            {editingTurmaId && (
              <button type="button" className="btn" onClick={() => { setEditingTurmaId(null); setTurmaNome(''); setTurmaSerie(''); setTurmaEscolaId(''); }}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn pri" style={{ height: '34px' }}>
              {editingTurmaId ? 'Atualizar Turma' : 'Criar Turma'}
            </button>
          </div>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
          {turmas.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhuma turma cadastrada.</div>
          ) : (
            turmas.map(tur => {
              const esc = escolas.find(e => e.id === tur.escolaId);
              return (
                <div 
                  key={tur.id} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{tur.nome} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>({tur.serie})</span></div>
                    <div style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: 600 }}>🏛️ {esc ? esc.nome : 'Escola Excluída'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => editarTurma(tur)}>
                      <i className="ti ti-pencil"></i>
                    </button>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => deletarTurma(tur.id)}>
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};

export default EscolaPage;
