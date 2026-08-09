import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aula, Turma, Materia, Capitulo, Escola, Professor } from '@/types';

interface AulasPageProps {
  aulas: Aula[];
  turmas: Turma[];
  materias: Materia[];
  capitulos: Capitulo[];
  escolas: Escola[];
  professores: Professor[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const AulasPage: React.FC<AulasPageProps> = ({
  aulas,
  turmas,
  materias,
  capitulos,
  escolas,
  professores,
  setSyncStatus,
}) => {
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('1º Tempo (Manhã)');
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [tipo, setTipo] = useState<'teorica' | 'pratica' | 'revisao' | 'avaliacao' | 'pedagogica' | 'outra'>('teorica');
  const [capituloId, setCapituloId] = useState('');
  const [realizada, setRealizada] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const horariosDisponiveis = [
    "1º Tempo (Manhã)",
    "2º Tempo (Manhã)",
    "3º Tempo (Manhã)",
    "4º Tempo (Manhã)",
    "5º Tempo (Manhã)",
    "6º Tempo (Manhã)",
    "7º Tempo (Manhã)",
    "1º Tempo (Tarde)",
    "2º Tempo (Tarde)",
    "3º Tempo (Tarde)",
    "4º Tempo (Tarde)",
    "5º Tempo (Tarde)",
    "6º Tempo (Tarde)",
    "7º Tempo (Tarde)"
  ];

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

  // Auto-selecionar matéria se houver apenas uma vinculada à turma
  useEffect(() => {
    if (turmaId && materiasDaTurmaEscola.length === 1) {
      setMateriaId(materiasDaTurmaEscola[0].id);
    }
  }, [turmaId, materiasDaTurmaEscola]);

  const handleTurmaChange = (id: string) => {
    setTurmaId(id);
    setMateriaId('');
    setCapituloId('');
  };

  const handleMateriaChange = (id: string) => {
    setMateriaId(id);
    setCapituloId('');
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !horario || !turmaId || !materiaId || !tipo) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSyncStatus('saving');
    try {
      const payload = {
        data,
        horario,
        turmaId,
        materiaId,
        tipo,
        capituloId: capituloId || null,
        realizada,
        descricao: descricao || ''
      };

      if (editingId) {
        await updateDoc(doc(db, 'aulas', editingId), payload as any);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'aulas'), payload);
      }

      setData('');
      setHorario('1º Tempo (Manhã)');
      setTurmaId('');
      setMateriaId('');
      setTipo('teorica');
      setCapituloId('');
      setRealizada(false);
      setDescricao('');
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar aula: ' + (err as Error).message);
    }
  };

  const toggleRealizada = async (aula: Aula) => {
    setSyncStatus('saving');
    try {
      await updateDoc(doc(db, 'aulas', aula.id), { realizada: !aula.realizada });
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao atualizar status da aula: ' + (err as Error).message);
    }
  };

  const editar = (aula: Aula) => {
    setEditingId(aula.id);
    setData(aula.data || '');
    setHorario(aula.horario || '');
    setTurmaId(aula.turmaId || '');
    setMateriaId(aula.materiaId || '');
    setTipo(aula.tipo || 'teorica');
    setCapituloId(aula.capituloId || '');
    setRealizada(aula.realizada);
    setDescricao(aula.descricao || '');
  };

  const deletar = async (id: string) => {
    if (!confirm('Deseja realmente deletar esta aula programada?')) return;
    setSyncStatus('saving');
    try {
      await deleteDoc(doc(db, 'aulas', id));
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao deletar aula: ' + (err as Error).message);
    }
  };

  const capitulosFiltrados = capitulos.filter(c => c.turmaId === turmaId && c.materiaId === materiaId);

  const formatarData = (dStr: string) => {
    if (!dStr) return '';
    return dStr.split('-').reverse().join('/');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', padding: '1rem', flexWrap: 'wrap' }}>
      
      {/* Form */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', height: 'fit-content' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-clock-hour-4" style={{ color: 'var(--primary)' }}></i> {editingId ? 'Editar Aula' : 'Programar Nova Aula'}
        </div>

        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Data *</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="f">
              <label>Horário *</label>
              <select value={horario} onChange={(e) => setHorario(e.target.value)}>
                {horariosDisponiveis.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
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
              <select value={materiaId} onChange={(e) => handleMateriaChange(e.target.value)} disabled={!turmaId}>
                <option value="">— selecione —</option>
                {materiasDaTurmaEscola.map(m => {
                  const esc = escolas.find(e => e.id === m.escolaId);
                  return <option key={m.id} value={m.id}>{m.nome} ({esc ? esc.nome : 'Escola'})</option>;
                })}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Tipo de Aula *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                <option value="teorica">📖 Teórica</option>
                <option value="pratica">🧪 Prática / Lab</option>
                <option value="revisao">🔄 Revisão de Conteúdo</option>
                <option value="avaliacao">📝 Avaliação / Teste</option>
                <option value="pedagogica">🌟 Atividade Especial</option>
                <option value="outra">⚙️ Outro</option>
              </select>
            </div>
            <div className="f">
              <label>
                Capítulo Mapeado
                {turmaId && materiaId && capitulosFiltrados.length === 0 && (
                  <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '6px' }}>Nenhum capítulo cadastrado</span>
                )}
              </label>
              <select value={capituloId} onChange={(e) => setCapituloId(e.target.value)} disabled={!turmaId || !materiaId}>
                <option value="">— sem capítulo associado —</option>
                {capitulosFiltrados.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="f">
            <label>Descrição da Aula / Conteúdo Planejado</label>
            <textarea 
              value={descricao} 
              onChange={(e) => setDescricao(e.target.value)} 
              placeholder="Descreva o conteúdo que será abordado, dinâmica, objetivos ou observações da aula..."
              rows={3}
              style={{ 
                padding: '8px 12px', 
                borderRadius: '10px', 
                border: '1px solid var(--border)', 
                fontSize: '13px', 
                fontFamily: 'inherit',
                width: '100%', 
                resize: 'vertical',
                minHeight: '70px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <input 
              type="checkbox" 
              id="aula-realizada-check"
              checked={realizada} 
              onChange={(e) => setRealizada(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="aula-realizada-check" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer', margin: 0 }}>
              Marcar como Aula Já Ministrada (Concluída)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {editingId && (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setData(''); setHorario('1º Tempo (Manhã)'); setTurmaId(''); setMateriaId(''); setTipo('teorica'); setCapituloId(''); setRealizada(false); setDescricao(''); }}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn pri">
              {editingId ? 'Atualizar Aula' : 'Agendar Aula'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-list" style={{ color: 'var(--primary)' }}></i> Aulas Agendadas
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
          {aulas.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhuma aula agendada.</div>
          ) : (
            [...aulas].sort((a,b) => (b.data || '').localeCompare(a.data || '')).map(aula => {
              const tur = turmas.find(t => t.id === aula.turmaId);
              const mat = materias.find(m => m.id === aula.materiaId);
              const cap = capitulos.find(c => c.id === aula.capituloId);

              return (
                <div 
                  key={aula.id} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: aula.realizada ? '#f0fdf4' : '#fff', border: '1px solid var(--border)', borderRadius: '10px', borderColor: aula.realizada ? '#bbf7d0' : 'var(--border)' }}
                >
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {formatarData(aula.data)} — {aula.horario || '—'}
                      </span>
                      <span className={`ali-badge-tipo tipo-aula-${aula.tipo}`} style={{ fontSize: '8.5px', padding: '2px 5px' }}>
                        {aula.tipo.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 700, marginTop: '4px' }}>
                      📖 {mat ? mat.nome : '—'} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>(Turma: {tur ? tur.nome : '—'})</span>
                    </div>

                    {cap && (
                      <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '2px', fontWeight: 600 }}>
                        📌 Capítulo: {cap.nome}
                      </div>
                    )}

                    {aula.descricao && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                        📝 {aula.descricao}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button 
                      className={`btn ${aula.realizada ? 'suc' : ''}`}
                      onClick={() => toggleRealizada(aula)}
                      style={{ padding: '6px 10px', fontSize: '11px', minWidth: '95px', fontWeight: 700 }}
                    >
                      {aula.realizada ? '✅ Ministrada' : '⏳ Pendente'}
                    </button>
                    <button className="btn" style={{ padding: '6px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => editar(aula)}>
                      <i className="ti ti-pencil"></i> Editar
                    </button>
                    <button className="btn" style={{ padding: '6px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => deletar(aula.id)}>
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

export default AulasPage;
