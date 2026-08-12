import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { Professor, Materia, Escola, Turma } from '@/types';

interface ProfsPageProps {
  professores: Professor[];
  materias: Materia[];
  escolas: Escola[];
  turmas: Turma[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const ProfsPage: React.FC<ProfsPageProps> = ({ professores, materias, escolas, turmas, setSyncStatus }) => {
  const [profNome, setProfNome] = useState('');
  const [vinculos, setVinculos] = useState<{ turmaId: string; materias: string[] }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profNome.trim()) {
      alert('Preencha o nome do professor.');
      return;
    }

    setSyncStatus('saving');
    try {
      const derivedMaterias = Array.from(new Set(vinculos.flatMap(v => v.materias)));
      const payload = {
        nome: profNome.trim(),
        materias: derivedMaterias,
        vinculos: vinculos,
        email: email.trim().toLowerCase(),
        senha: senha.trim()
      };

      if (editingId) {
        await updateDoc(doc(db, 'professores', editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'professores'), payload);
      }
      setProfNome('');
      setVinculos([]);
      setEmail('');
      setSenha('');
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar professor: ' + (err as Error).message);
    }
  };

  const toggleVinculoMateria = (turmaId: string, materiaId: string) => {
    setVinculos(prev => {
      const existing = prev.find(v => v.turmaId === turmaId);
      if (existing) {
        const updatedMaterias = existing.materias.includes(materiaId)
          ? existing.materias.filter(id => id !== materiaId)
          : [...existing.materias, materiaId];
        
        if (updatedMaterias.length === 0) {
          return prev.filter(v => v.turmaId !== turmaId);
        }
        return prev.map(v => v.turmaId === turmaId ? { ...v, materias: updatedMaterias } : v);
      } else {
        return [...prev, { turmaId, materias: [materiaId] }];
      }
    });
  };

  const editar = (prof: Professor) => {
    setEditingId(prof.id);
    setProfNome(prof.nome);
    setVinculos(prof.vinculos || []);
    setEmail(prof.email || '');
    setSenha(prof.senha || '');
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>E-mail / Usuário de Acesso</label>
              <input 
                type="email"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Ex: roberto@escola.com" 
              />
            </div>
            <div className="f">
              <label>Senha de Acesso</label>
              <input 
                type="text"
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                placeholder="Ex: roberto123" 
              />
            </div>
          </div>

          <div className="f">
            <label>Vínculos de Turmas e Disciplinas (Onde leciona) *</label>
            <div style={{ maxHeight: '250px', overflowY: 'auto', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {turmas.length === 0 ? (
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '11px' }}>Nenhuma turma cadastrada.</div>
              ) : (
                turmas.map(t => {
                  const esc = escolas.find(e => e.id === t.escolaId);
                  const materiasDaEscola = materias.filter(m => m.escolaId === t.escolaId);
                  const vinculoTurma = vinculos.find(v => v.turmaId === t.id);
                  const materiasVinculadas = vinculoTurma ? vinculoTurma.materias : [];

                  return (
                    <div key={t.id} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>🏫 {t.nome}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>({esc ? esc.nome : 'Escola'})</span>
                      </div>
                      
                      {materiasDaEscola.length === 0 ? (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '12px' }}>Nenhuma matéria nesta escola.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px', paddingLeft: '12px' }}>
                          {materiasDaEscola.map(mat => (
                            <label key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-main)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={materiasVinculadas.includes(mat.id)} 
                                onChange={() => toggleVinculoMateria(t.id, mat.id)} 
                              />
                              <span>{mat.nome}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {editingId && (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setProfNome(''); setVinculos([]); setEmail(''); setSenha(''); }}>
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
                  {prof.email && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      ({prof.email})
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {(!prof.vinculos || prof.vinculos.length === 0) ? (
                      <span style={{ fontSize: '9px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#64748b' }}>Sem vínculos</span>
                    ) : (
                      prof.vinculos.map((v, vIdx) => {
                        const tur = turmas.find(t => t.id === v.turmaId);
                        if (!tur) return null;
                        return (
                          <div key={vIdx} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', background: '#fff', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '8px' }}>
                            <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-main)' }}>🏫 {tur.nome}:</span>
                            {v.materias.map(mid => {
                              const mat = materias.find(m => m.id === mid);
                              if (!mat) return null;
                              return (
                                <span key={mid} style={{ fontSize: '9px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 5px', borderRadius: '4px', color: '#1e40af', fontWeight: 600 }}>
                                  {mat.nome}
                                </span>
                              );
                            })}
                          </div>
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
