import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { Atividade, Turma, Materia, Bimestre, Escola } from '@/types';

interface AtividadesPageProps {
  atividades: Atividade[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  escolas: Escola[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const AtividadesPage: React.FC<AtividadesPageProps> = ({
  atividades,
  turmas,
  materias,
  bimestres,
  escolas,
  setSyncStatus,
}) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'prova' | 'trabalho' | 'qualitativa'>('prova');
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [bimestreId, setBimestreId] = useState('');
  const [peso, setPeso] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !turmaId || !materiaId || !bimestreId || peso <= 0) {
      alert('Por favor, preencha todos os campos corretamente.');
      return;
    }

    setSyncStatus('saving');
    try {
      const payload = {
        nome: nome.trim(),
        tipo,
        turmaId,
        materiaId,
        bimestreId,
        peso: Number(peso),
      };

      if (editingId) {
        await updateDoc(doc(db, 'atividades', editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'atividades'), payload);
      }

      setNome('');
      setTipo('prova');
      setTurmaId('');
      setMateriaId('');
      setBimestreId('');
      setPeso(1);
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar atividade: ' + (err as Error).message);
    }
  };

  const editar = (ativ: Atividade) => {
    setEditingId(ativ.id);
    setNome(ativ.nome);
    setTipo(ativ.tipo);
    setTurmaId(ativ.turmaId);
    setMateriaId(ativ.materiaId);
    setBimestreId(ativ.bimestreId);
    setPeso(ativ.peso);
  };

  const duplicar = (ativ: Atividade) => {
    setEditingId(null);
    setNome(ativ.nome);
    setTipo(ativ.tipo);
    setMateriaId(ativ.materiaId);
    setBimestreId(ativ.bimestreId);
    setPeso(ativ.peso);
    setTurmaId('');
    alert(`Atividade "${ativ.nome}" copiada para o formulário! Agora selecione a nova Turma Vinculada e clique em Cadastrar.`);
  };

  const deletar = async (id: string) => {
    if (!confirm('Deseja realmente deletar esta atividade? Todas as notas associadas serão perdidas permanentemente.')) return;
    setSyncStatus('saving');
    try {
      const batch = writeBatch(db);
      
      // 1. Deletar atividade
      batch.delete(doc(db, 'atividades', id));
      
      // 2. Notas associadas
      const notasSnap = await getDocs(query(collection(db, 'notas'), where('atividadeId', '==', id)));
      for (const notaDoc of notasSnap.docs) {
        batch.delete(doc(db, 'notas', notaDoc.id));
      }
      
      await batch.commit();
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao deletar atividade e suas notas: ' + (err as Error).message);
    }
  };

  const badgeColor = (t: string) => {
    if (t === 'prova') return { bg: '#fee2e2', text: '#991b1b' };
    if (t === 'trabalho') return { bg: '#eff6ff', text: '#1e40af' };
    return { bg: '#f0fdf4', text: '#166534' };
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', padding: '1rem', flexWrap: 'wrap' }}>
      
      {/* Form */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', height: 'fit-content' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-clipboard-list" style={{ color: 'var(--primary)' }}></i> {editingId ? 'Editar Atividade' : 'Nova Atividade/Avaliação'}
        </div>

        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="f">
            <label>Título da Atividade *</label>
            <input 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              placeholder="Ex: Prova Mensal, Trabalho de Álgebra..." 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                <option value="prova">📝 Prova / Exame</option>
                <option value="trabalho">📚 Trabalho / Seminário</option>
                <option value="qualitativa">🌟 Avaliação Qualitativa</option>
              </select>
            </div>
            <div className="f">
              <label>Bimestre *</label>
              <select value={bimestreId} onChange={(e) => setBimestreId(e.target.value)}>
                <option value="">— selecione —</option>
                {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}{b.ano ? ` (${b.ano})` : ''}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Turma Vinculada *</label>
              <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
                <option value="">— selecione —</option>
                {turmas.map(t => {
                  const esc = escolas.find(e => e.id === t.escolaId);
                  return <option key={t.id} value={t.id}>{t.nome} ({esc ? esc.nome : 'Escola'})</option>;
                })}
              </select>
            </div>
            <div className="f">
              <label>Matéria Vinculada *</label>
              <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
                <option value="">— selecione —</option>
                {materias.map(m => {
                  const esc = escolas.find(e => e.id === m.escolaId);
                  return <option key={m.id} value={m.id}>{m.nome} ({esc ? esc.nome : 'Escola'})</option>;
                })}
              </select>
            </div>
          </div>

          <div className="f" style={{ maxWidth: '140px' }}>
            <label>Peso Computacional *</label>
            <input 
              type="number"
              min="0.1"
              step="0.1"
              value={peso} 
              onChange={(e) => setPeso(parseFloat(e.target.value) || 1)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {editingId && (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setNome(''); setTipo('prova'); setTurmaId(''); setMateriaId(''); setBimestreId(''); setPeso(1); }}>
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
          <i className="ti ti-list" style={{ color: 'var(--primary)' }}></i> Planejamento de Atividades
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
          {atividades.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhuma atividade cadastrada.</div>
          ) : (
            atividades.map(ativ => {
              const tur = turmas.find(t => t.id === ativ.turmaId);
              const mat = materias.find(m => m.id === ativ.materiaId);
              const bim = bimestres.find(b => b.id === ativ.bimestreId);
              const colors = badgeColor(ativ.tipo);

              return (
                <div 
                  key={ativ.id} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}
                >
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{ativ.nome}</span>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '9px', background: colors.bg, color: colors.text, padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                        {ativ.tipo.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '9px', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                        🏫 {tur ? tur.nome : '—'}
                      </span>
                      <span style={{ fontSize: '9px', background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                        📖 {mat ? mat.nome : '—'}
                      </span>
                      <span style={{ fontSize: '9px', background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        📅 {bim ? `${bim.nome}${bim.ano ? ` (${bim.ano})` : ''}` : '—'}
                      </span>
                      <span style={{ fontSize: '9px', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        ⚖️ Peso: {ativ.peso}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#bae6fd', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => duplicar(ativ)}>
                      <i className="ti ti-copy"></i> Duplicar
                    </button>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => editar(ativ)}>
                      <i className="ti ti-pencil"></i> Editar
                    </button>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => deletar(ativ.id)}>
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

export default AtividadesPage;
