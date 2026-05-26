import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { Professor, Materia, Escola } from '@/types';

interface ProfsPageProps {
  professores: Professor[];
  materias: Materia[];
  escolas: Escola[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const ProfsPage: React.FC<ProfsPageProps> = ({ professores, materias, escolas, setSyncStatus }) => {
  const [profNome, setProfNome] = useState('');
  const [selectedMaterias, setSelectedMaterias] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profNome.trim()) {
      alert('Preencha o nome do professor.');
      return;
    }

    setSyncStatus('saving');
    try {
      const payload = {
        nome: profNome.trim(),
        materias: selectedMaterias,
      };

      if (editingId) {
        await updateDoc(doc(db, 'professores', editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'professores'), payload);
      }
      setProfNome('');
      setSelectedMaterias([]);
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar professor: ' + (err as Error).message);
    }
  };

  const toggleMateria = (id: string) => {
    if (selectedMaterias.includes(id)) {
      setSelectedMaterias(selectedMaterias.filter(mid => mid !== id));
    } else {
      setSelectedMaterias([...selectedMaterias, id]);
    }
  };

  const editar = (prof: Professor) => {
    setEditingId(prof.id);
    setProfNome(prof.nome);
    setSelectedMaterias(prof.materias || []);
  };

  const deletar = async (id: string) => {
    if (!confirm('Deseja realmente deletar este professor? Todos os planejamentos de Sequências Didáticas associados a ele serão excluídos permanentemente.')) return;
    setSyncStatus('saving');
    try {
      const batch = writeBatch(db);
      
      // 1. Deletar professor
      batch.delete(doc(db, 'professores', id));
      
      // 2. Sequências didáticas associadas
      const sdsSnap = await getDocs(query(collection(db, 'sequencias_didaticas'), where('professorId', '==', id)));
      for (const sdDoc of sdsSnap.docs) {
        batch.delete(doc(db, 'sequencias_didaticas', sdDoc.id));
      }
      
      await batch.commit();
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao deletar professor e seus planejamentos: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', padding: '1rem', flexWrap: 'wrap' }}>
      
      {/* Form */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', height: 'fit-content' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-user-check" style={{ color: 'var(--primary)' }}></i> {editingId ? 'Editar Professor' : 'Novo Professor'}
        </div>

        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="f">
            <label>Nome do Professor *</label>
            <input 
              value={profNome} 
              onChange={(e) => setProfNome(e.target.value)} 
              placeholder="Ex: Prof. Roberto Silva" 
            />
          </div>

          <div className="f">
            <label>Disciplinas que leciona</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {materias.length === 0 ? (
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '11px' }}>Nenhuma matéria cadastrada.</div>
              ) : (
                materias.map(mat => {
                  const esc = escolas.find(e => e.id === mat.escolaId);
                  return (
                    <label key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedMaterias.includes(mat.id)} 
                        onChange={() => toggleMateria(mat.id)} 
                      />
                      <div>
                        <b>{mat.nome}</b> <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>({esc ? esc.nome : 'Escola'})</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {editingId && (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setProfNome(''); setSelectedMaterias([]); }}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn pri">
              {editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-list" style={{ color: 'var(--primary)' }}></i> Professores Cadastrados
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto' }}>
          {professores.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhum professor cadastrado.</div>
          ) : (
            professores.map(prof => (
              <div 
                key={prof.id} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{prof.nome}</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {(prof.materias || []).length === 0 ? (
                      <span style={{ fontSize: '9px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#64748b' }}>Sem matérias</span>
                    ) : (
                      prof.materias.map(mid => {
                        const mat = materias.find(m => m.id === mid);
                        if (!mat) return null;
                        return (
                          <span key={mid} style={{ fontSize: '9px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '4px', color: '#1e40af', fontWeight: 600 }}>
                            {mat.nome}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => editar(prof)}>
                    <i className="ti ti-pencil"></i> Editar
                  </button>
                  <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => deletar(prof.id)}>
                    <i className="ti ti-trash"></i> Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default ProfsPage;
