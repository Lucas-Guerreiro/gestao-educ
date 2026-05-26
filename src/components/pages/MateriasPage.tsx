import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Materia, Escola } from '@/types';

interface MateriasPageProps {
  materias: Materia[];
  escolas: Escola[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const MateriasPage: React.FC<MateriasPageProps> = ({ materias, escolas, setSyncStatus }) => {
  const [materiaNome, setMateriaNome] = useState('');
  const [escolaId, setEscolaId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materiaNome.trim() || !escolaId) {
      alert('Preencha o nome da matéria e a escola.');
      return;
    }

    setSyncStatus('saving');
    try {
      const payload = {
        nome: materiaNome.trim(),
        escolaId,
      };

      if (editingId) {
        await updateDoc(doc(db, 'materias', editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'materias'), payload);
      }
      setMateriaNome('');
      setEscolaId('');
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar matéria: ' + (err as Error).message);
    }
  };

  const editar = (materia: Materia) => {
    setEditingId(materia.id);
    setMateriaNome(materia.nome);
    setEscolaId(materia.escolaId);
  };

  const deletar = async (id: string) => {
    if (!confirm('Deseja realmente deletar esta matéria?')) return;
    setSyncStatus('saving');
    try {
      await deleteDoc(doc(db, 'materias', id));
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao deletar matéria: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', padding: '1rem', flexWrap: 'wrap' }}>
      
      {/* Cadastro Form */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', height: 'fit-content' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-book" style={{ color: 'var(--primary)' }}></i> {editingId ? 'Editar Matéria' : 'Nova Matéria'}
        </div>

        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="f">
            <label>Nome da Matéria *</label>
            <input 
              value={materiaNome} 
              onChange={(e) => setMateriaNome(e.target.value)} 
              placeholder="Ex: Matemática, Português, Física..." 
            />
          </div>
          
          <div className="f">
            <label>Escola Vinculada *</label>
            <select value={escolaId} onChange={(e) => setEscolaId(e.target.value)}>
              <option value="">— selecione —</option>
              {escolas.map(esc => <option key={esc.id} value={esc.id}>{esc.nome}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {editingId && (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setMateriaNome(''); setEscolaId(''); }}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn pri">
              {editingId ? 'Atualizar Matéria' : 'Cadastrar Matéria'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-list" style={{ color: 'var(--primary)' }}></i> Matérias Cadastradas
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto' }}>
          {materias.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhuma matéria cadastrada.</div>
          ) : (
            materias.map(mat => {
              const esc = escolas.find(e => e.id === mat.escolaId);
              return (
                <div 
                  key={mat.id} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}
                >
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{mat.nome}</span>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>🏛️ {esc ? esc.nome : 'Escola Não Encontrada'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => editar(mat)}>
                      <i className="ti ti-pencil"></i>
                    </button>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => deletar(mat.id)}>
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

export default MateriasPage;
