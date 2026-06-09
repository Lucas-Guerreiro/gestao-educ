import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { Capitulo, Turma, Materia, Escola, Professor } from '@/types';

interface CapitulosPageProps {
  capitulos: Capitulo[];
  turmas: Turma[];
  materias: Materia[];
  escolas: Escola[];
  professores: Professor[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const CapitulosPage: React.FC<CapitulosPageProps> = ({
  capitulos,
  turmas,
  materias,
  escolas,
  professores,
  setSyncStatus,
}) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filtrar as matérias vinculadas à turma através de qualquer professor, com fallback para as matérias da escola da turma
  const materiasDaTurmaEscola = React.useMemo(() => {
    if (!turmaId) return [];
    
    const idsVinculados = new Set<string>();
    professores.forEach(prof => {
      if (prof.vinculos) {
        prof.vinculos.forEach(v => {
          if (v.turmaId === turmaId) {
            v.materias.forEach(mid => idsVinculados.add(mid));
          }
        });
      }
    });

    if (idsVinculados.size === 0) {
      const turmaSelected = turmas.find(t => t.id === turmaId);
      if (!turmaSelected) return [];
      return materias.filter(m => m.escolaId === turmaSelected.escolaId);
    }

    return materias.filter(m => idsVinculados.has(m.id));
  }, [turmaId, turmas, materias, professores]);

  const handleTurmaChange = (id: string) => {
    setTurmaId(id);
    setMateriaId('');
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !turmaId || !materiaId) {
      alert('Por favor, preencha o nome, turma e matéria.');
      return;
    }

    setSyncStatus('saving');
    try {
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim(),
        turmaId,
        materiaId,
      };

      if (editingId) {
        await updateDoc(doc(db, 'capitulos', editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'capitulos'), payload);
      }

      setNome('');
      setDescricao('');
      setTurmaId('');
      setMateriaId('');
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar capítulo: ' + (err as Error).message);
    }
  };

  const editar = (cap: Capitulo) => {
    setEditingId(cap.id);
    setNome(cap.nome);
    setDescricao(cap.descricao || '');
    setTurmaId(cap.turmaId);
    setMateriaId(cap.materiaId);
  };

  const deletar = async (id: string) => {
    if (!confirm('Deseja realmente deletar este capítulo? Todas as referências em aulas e planejamentos serão atualizadas.')) return;
    setSyncStatus('saving');
    try {
      const batch = writeBatch(db);
      
      // 1. Deletar capítulo
      batch.delete(doc(db, 'capitulos', id));
      
      // 2. Aulas associadas (definir capituloId como vazio / SET NULL)
      const aulasSnap = await getDocs(query(collection(db, 'aulas'), where('capituloId', '==', id)));
      for (const aulaDoc of aulasSnap.docs) {
        batch.update(doc(db, 'aulas', aulaDoc.id), { capituloId: "" });
      }
      
      // 3. Sequências Didáticas contendo este capítulo
      const sdsSnap = await getDocs(collection(db, 'sequencias_didaticas'));
      for (const sdDoc of sdsSnap.docs) {
        const sdData = sdDoc.data();
        if (Array.isArray(sdData.capitulos)) {
          const originalLength = sdData.capitulos.length;
          const updatedCapitulos = sdData.capitulos.filter((c: any) => c.capituloId !== id);
          if (updatedCapitulos.length !== originalLength) {
            batch.update(doc(db, 'sequencias_didaticas', sdDoc.id), { capitulos: updatedCapitulos });
          }
        }
      }
      
      await batch.commit();
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao deletar capítulo e atualizar vínculos: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', padding: '1rem', flexWrap: 'wrap' }}>
      
      {/* Form */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', height: 'fit-content' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-folder" style={{ color: 'var(--primary)' }}></i> {editingId ? 'Editar Capítulo' : 'Novo Capítulo Pedagógico'}
        </div>

        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="f">
            <label>Título do Capítulo *</label>
            <input 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              placeholder="Ex: Capítulo 1: Introdução a Funções" 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Turma Vinculada *</label>
              <select value={turmaId} onChange={(e) => handleTurmaChange(e.target.value)}>
                <option value="">— selecione —</option>
                {turmas.map(t => {
                  const esc = escolas.find(e => e.id === t.escolaId);
                  return <option key={t.id} value={t.id}>{t.nome} ({esc ? esc.nome : 'Escola'})</option>;
                })}
              </select>
            </div>
            <div className="f">
              <label>
                Matéria Vinculada *
                {turmaId && materiasDaTurmaEscola.length === 0 && (
                  <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '6px' }}>Nenhuma matéria nesta escola</span>
                )}
              </label>
              <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} disabled={!turmaId}>
                <option value="">— selecione —</option>
                {materiasDaTurmaEscola.map(m => {
                  const esc = escolas.find(e => e.id === m.escolaId);
                  return <option key={m.id} value={m.id}>{m.nome} ({esc ? esc.nome : 'Escola'})</option>;
                })}
              </select>
            </div>
          </div>

          <div className="f">
            <label>Descrição do Capítulo (BNCC ou Eixos temáticos)</label>
            <textarea 
              value={descricao} 
              onChange={(e) => setDescricao(e.target.value)} 
              placeholder="Conteúdos programados, habilidades BNCC relacionadas..." 
              style={{ height: '70px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {editingId && (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setNome(''); setDescricao(''); setTurmaId(''); setMateriaId(''); }}>
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
          <i className="ti ti-list" style={{ color: 'var(--primary)' }}></i> Banco de Capítulos
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
          {capitulos.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhum capítulo cadastrado.</div>
          ) : (
            capitulos.map(cap => {
              const tur = turmas.find(t => t.id === cap.turmaId);
              const mat = materias.find(m => m.id === cap.materiaId);

              return (
                <div 
                  key={cap.id} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}
                >
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{cap.nome}</span>
                    {cap.descricao && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{cap.descricao}</div>}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                      <span style={{ fontSize: '9.5px', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                        🏫 {tur ? tur.nome : '—'}
                      </span>
                      <span style={{ fontSize: '9.5px', background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        📖 {mat ? mat.nome : '—'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => editar(cap)}>
                      <i className="ti ti-pencil"></i> Editar
                    </button>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => deletar(cap.id)}>
                      <i className="ti ti-trash"></i> Excluir
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

export default CapitulosPage;
