import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { Atividade, Turma, Materia, Bimestre, Escola, Professor } from '@/types';

interface AtividadesPageProps {
  atividades: Atividade[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  escolas: Escola[];
  professores: Professor[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const AtividadesPage: React.FC<AtividadesPageProps> = ({
  atividades,
  turmas,
  materias,
  bimestres,
  escolas,
  professores,
  setSyncStatus,
}) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'prova' | 'trabalho' | 'qualitativa' | 'pluraal'>('prova');
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [bimestreId, setBimestreId] = useState('');
  const [peso, setPeso] = useState(1);
  const [descricao, setDescricao] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [liberadoVencido, setLiberadoVencido] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estados para Duplicação em Lote
  const [isDuplicarModalOpen, setIsDuplicarModalOpen] = useState(false);
  const [atividadeParaDuplicar, setAtividadeParaDuplicar] = useState<Atividade | null>(null);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
  
  // Filters state
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroBimestre, setFiltroBimestre] = useState('');

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
        descricao: descricao.trim(),
        dataLimite: dataLimite || '',
        liberadoVencido: !!liberadoVencido,
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
      setDescricao('');
      setDataLimite('');
      setLiberadoVencido(false);
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
    setDescricao(ativ.descricao || '');
    setDataLimite(ativ.dataLimite || '');
    setLiberadoVencido(!!ativ.liberadoVencido);
  };

  const abrirDuplicarModal = (ativ: Atividade) => {
    setAtividadeParaDuplicar(ativ);
    setTurmasSelecionadas([]);
    setIsDuplicarModalOpen(true);
  };

  const fecharDuplicarModal = () => {
    setAtividadeParaDuplicar(null);
    setTurmasSelecionadas([]);
    setIsDuplicarModalOpen(false);
  };

  const handleToggleTurma = (tId: string) => {
    setTurmasSelecionadas(prev => 
      prev.includes(tId) ? prev.filter(id => id !== tId) : [...prev, tId]
    );
  };

  const turmasDisponiveisParaDuplicar = React.useMemo(() => {
    if (!atividadeParaDuplicar) return [];
    const turmaOrigem = turmas.find(t => t.id === atividadeParaDuplicar.turmaId);
    if (!turmaOrigem) return [];
    return turmas.filter(t => t.escolaId === turmaOrigem.escolaId && t.id !== atividadeParaDuplicar.turmaId);
  }, [atividadeParaDuplicar, turmas]);

  const confirmarDuplicacaoLote = async () => {
    if (!atividadeParaDuplicar || turmasSelecionadas.length === 0) {
      alert('Por favor, selecione ao menos uma turma para duplicar a atividade.');
      return;
    }

    setSyncStatus('saving');
    try {
      const batch = writeBatch(db);

      turmasSelecionadas.forEach(tId => {
        const docRef = doc(collection(db, 'atividades'));
        batch.set(docRef, {
          nome: atividadeParaDuplicar.nome,
          tipo: atividadeParaDuplicar.tipo,
          turmaId: tId,
          materiaId: atividadeParaDuplicar.materiaId,
          bimestreId: atividadeParaDuplicar.bimestreId,
          peso: Number(atividadeParaDuplicar.peso),
          descricao: (atividadeParaDuplicar.descricao || '').trim(),
          dataLimite: atividadeParaDuplicar.dataLimite || '',
          liberadoVencido: !!atividadeParaDuplicar.liberadoVencido,
        });
      });

      await batch.commit();
      setSyncStatus('ok');
      alert(`Atividade duplicada com sucesso para ${turmasSelecionadas.length} turma(s)!`);
      fecharDuplicarModal();
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao duplicar atividades em lote: ' + (err as Error).message);
    }
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
    if (t === 'pluraal') return { bg: '#f3e8ff', text: '#6b21a8' };
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
                <option value="pluraal">💜 Atividade PLURAAL</option>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Peso Computacional *</label>
              <input 
                type="number"
                min="0.1"
                step="0.1"
                value={peso} 
                onChange={(e) => setPeso(parseFloat(e.target.value) || 1)} 
              />
            </div>
            <div className="f">
              <label>Descrição da Atividade</label>
              <input 
                value={descricao} 
                onChange={(e) => setDescricao(e.target.value)} 
                placeholder="Ex: Prova Mensal Cap 1 e 2, Trabalho BNCC..." 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px', alignItems: 'center' }}>
            <div className="f">
              <label>Data Limite para Lançamento (Prazo)</label>
              <input 
                type="date"
                value={dataLimite} 
                onChange={(e) => setDataLimite(e.target.value)} 
              />
            </div>
            <div className="f" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
              <input 
                type="checkbox" 
                id="liberado-vencido-checkbox"
                checked={liberadoVencido} 
                onChange={(e) => setLiberadoVencido(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="liberado-vencido-checkbox" style={{ fontSize: '11.5px', cursor: 'pointer', userSelect: 'none', fontWeight: 600, color: 'var(--text-main)' }}>
                Permitir após prazo
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {editingId && (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setNome(''); setTipo('prova'); setTurmaId(''); setMateriaId(''); setBimestreId(''); setPeso(1); setDescricao(''); setDataLimite(''); setLiberadoVencido(false); }}>
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
          <i className="ti ti-list" style={{ color: 'var(--primary)' }}></i> Planejamento
        </div>

        {/* Filtros de Lista */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem', background: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div className="f" style={{ flex: 1, minWidth: '120px' }}>
            <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Filtrar por Turma</label>
            <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ height: '34px', fontSize: '12px' }}>
              <option value="">— Todas as Turmas —</option>
              {turmas.map(t => {
                const esc = escolas.find(e => e.id === t.escolaId);
                return <option key={t.id} value={t.id}>{t.nome} ({esc ? esc.nome : 'Escola'})</option>;
              })}
            </select>
          </div>
          <div className="f" style={{ flex: 1, minWidth: '120px' }}>
            <label style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Filtrar por Bimestre</label>
            <select value={filtroBimestre} onChange={(e) => setFiltroBimestre(e.target.value)} style={{ height: '34px', fontSize: '12px' }}>
              <option value="">— Todos os Bimestres —</option>
              {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}{b.ano ? ` (${b.ano})` : ''}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
          {(() => {
            const atividadesFiltradas = atividades.filter(a => {
              const atendeTurma = filtroTurma ? a.turmaId === filtroTurma : true;
              const atendeBimestre = filtroBimestre ? a.bimestreId === filtroBimestre : true;
              return atendeTurma && atendeBimestre;
            });

            if (atividadesFiltradas.length === 0) {
              return <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhuma atividade correspondente aos filtros.</div>;
            }

            return atividadesFiltradas.map(ativ => {
              const tur = turmas.find(t => t.id === ativ.turmaId);
              const mat = materias.find(m => m.id === ativ.materiaId);
              const bim = bimestres.find(b => b.id === ativ.bimestreId);
              const colors = badgeColor(ativ.tipo);

              return (
                <div 
                  key={ativ.id} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}
                >
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{ativ.nome}</span>
                    {ativ.descricao && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>📝 {ativ.descricao}</div>}
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
                      {ativ.dataLimite && (() => {
                        const hoje = new Date().toISOString().split('T')[0];
                        const estaExpirado = hoje > ativ.dataLimite && !ativ.liberadoVencido;
                        return (
                          <span style={{ 
                            fontSize: '9px', 
                            background: estaExpirado ? '#fee2e2' : '#f0fdf4', 
                            color: estaExpirado ? '#dc2626' : '#16a34a', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <i className={estaExpirado ? "ti ti-lock" : "ti ti-lock-open"}></i>
                            Prazo: {ativ.dataLimite.split('-').reverse().join('/')} {estaExpirado && '(Expirado)'}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#bae6fd', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => abrirDuplicarModal(ativ)}>
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
            });
          })()}
        </div>
      </div>

      {isDuplicarModalOpen && atividadeParaDuplicar && (() => {
        const mat = materias.find(m => m.id === atividadeParaDuplicar.materiaId);
        const bim = bimestres.find(b => b.id === atividadeParaDuplicar.bimestreId);
        const colors = badgeColor(atividadeParaDuplicar.tipo);

        return (
          <div className="sd-modal-overlay open" style={{ display: 'flex', alignItems: 'center' }}>
            <div className="sd-modal" style={{ maxWidth: '520px', padding: '20px', borderRadius: '16px' }}>
              <div className="sd-modal-header" style={{ marginBottom: '14px', paddingBottom: '10px' }}>
                <div className="sd-modal-title" style={{ fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-squares-filled" style={{ color: 'var(--primary)', fontSize: '18px' }}></i>
                  Duplicar Atividade em Lote
                </div>
                <button 
                  type="button" 
                  onClick={fecharDuplicarModal}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)' }}
                >
                  <i className="ti ti-x"></i>
                </button>
              </div>

              {/* Card de Resumo da Atividade */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{atividadeParaDuplicar.nome}</span>
                  <span style={{ fontSize: '9px', background: colors.bg, color: colors.text, padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                    {atividadeParaDuplicar.tipo.toUpperCase()}
                  </span>
                </div>
                {atividadeParaDuplicar.descricao && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    📝 {atividadeParaDuplicar.descricao}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '9.5px', background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    📖 {mat ? mat.nome : '—'}
                  </span>
                  <span style={{ fontSize: '9.5px', background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    📅 {bim ? bim.nome : '—'}
                  </span>
                  <span style={{ fontSize: '9.5px', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    ⚖️ Peso: {atividadeParaDuplicar.peso}
                  </span>
                </div>
              </div>

              {/* Instruções */}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
                Selecione as turmas adicionais para as quais deseja copiar esta atividade. O sistema criará as cópias de forma instantânea com todas as especificações acima.
              </div>

              {/* Lista de Checkboxes de Turmas */}
              <div style={{ 
                border: '1px solid var(--border)', 
                borderRadius: '12px', 
                padding: '10px 14px', 
                maxHeight: '180px', 
                overflowY: 'auto',
                background: '#fff',
                marginBottom: '18px'
              }}>
                {turmasDisponiveisParaDuplicar.length === 0 ? (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                    Nenhuma outra turma cadastrada na mesma escola desta atividade.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {turmasDisponiveisParaDuplicar.map(turma => (
                      <label 
                        key={turma.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px', 
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          background: turmasSelecionadas.includes(turma.id) ? '#f5f3ff' : 'transparent',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={turmasSelecionadas.includes(turma.id)}
                          onChange={() => handleToggleTurma(turma.id)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {turma.nome}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn" 
                  onClick={fecharDuplicarModal}
                  style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn pri" 
                  onClick={confirmarDuplicacaoLote}
                  disabled={turmasSelecionadas.length === 0}
                  style={{ 
                    padding: '8px 18px', 
                    fontSize: '12.5px', 
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: turmasSelecionadas.length === 0 ? 0.6 : 1,
                    cursor: turmasSelecionadas.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <i className="ti ti-copy"></i>
                  Duplicar em Lote ({turmasSelecionadas.length})
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default AtividadesPage;
