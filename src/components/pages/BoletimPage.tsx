import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota, Escola, Apontamento, Professor } from '@/types';

interface BoletimPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  atividades: Atividade[];
  notas: Nota[];
  escolas: Escola[];
  apontamentos: Apontamento[];
  professores: Professor[];
  setSyncStatus?: (status: 'ok' | 'saving' | 'err') => void;
  globalBimestreId: string;
  onBimestreChange: (id: string) => void;
}

const BoletimPage: React.FC<BoletimPageProps> = ({
  alunos,
  turmas,
  materias,
  bimestres,
  atividades,
  notas,
  escolas,
  apontamentos,
  professores,
  setSyncStatus,
  globalBimestreId,
  onBimestreChange,
}) => {
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [selectedAlunoId, setSelectedAlunoId] = useState('');

  // Estados para a nova funcionalidade de consulta/edição de notas por bimestre e matérias
  const [selectedBimestreId, setSelectedBimestreId] = useState('');

  // Sincronizar com o bimestre global
  useEffect(() => {
    if (globalBimestreId) {
      setSelectedBimestreId(globalBimestreId);
    }
  }, [globalBimestreId]);
  const [selectedMateriaIds, setSelectedMateriaIds] = useState<string[]>([]);
  const [editingNotaId, setEditingNotaId] = useState<string | null>(null); // `${alunoId}_${atividadeId}`
  const [editNotaValue, setEditNotaValue] = useState('');
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});

  const obterNotaMaxima = (tipo: string): number => {
    if (tipo === 'trabalho') return 6;
    if (tipo === 'pluraal') return 1;
    if (tipo === 'qualitativa') return 3;
    return 10;
  };

  const obterNotaValor = (atividadeId: string): string => {
    const reg = notas.find(n => n.alunoId === selectedAlunoId && n.atividadeId === atividadeId);
    if (!reg || reg.nota === undefined || reg.nota === -1) return '';
    return String(reg.nota);
  };

  const salvarNotaEdicao = async (atividadeId: string, valorStr: string) => {
    if (!selectedAlunoId || !selectedTurmaId) return;

    const at = atividades.find(a => a.id === atividadeId);
    if (!at) return;

    const tipoAt = at.tipo;
    const notaMax = obterNotaMaxima(tipoAt);

    const valor = valorStr.trim() === '' ? null : Number(valorStr.replace(',', '.'));
    if (valor !== null && (isNaN(valor) || valor < 0 || valor > notaMax)) {
      alert(`Por favor, informe uma nota válida entre 0 e ${notaMax} para atividades do tipo ${tipoAt.toUpperCase()}.`);
      return;
    }

    const docId = `${selectedAlunoId}_${atividadeId}`;
    const cellKey = docId;

    setSavingCells(prev => ({ ...prev, [cellKey]: true }));
    if (setSyncStatus) setSyncStatus('saving');

    try {
      const docRef = doc(db, 'notas', docId);
      if (valor === null) {
        await setDoc(docRef, {
          alunoId: selectedAlunoId,
          atividadeId,
          turmaId: selectedTurmaId,
          materiaId: at.materiaId,
          bimestreId: at.bimestreId,
          nota: -1 // -1 representa apagado
        });
      } else {
        await setDoc(docRef, {
          alunoId: selectedAlunoId,
          atividadeId,
          turmaId: selectedTurmaId,
          materiaId: at.materiaId,
          bimestreId: at.bimestreId,
          nota: valor
        });
      }
      if (setSyncStatus) setSyncStatus('ok');
      setEditingNotaId(null);
    } catch (err) {
      if (setSyncStatus) setSyncStatus('err');
      console.error('Erro ao salvar nota:', err);
      alert('Erro ao salvar nota. Tente novamente.');
    } finally {
      setSavingCells(prev => ({ ...prev, [cellKey]: false }));
    }
  };

  // Filtrar alunos da turma
  const alunosDaTurma = alunos.filter(a => String(a.turmaId) === selectedTurmaId && a.ativo !== false);

  // Aluno e turma ativos
  const aluno = alunos.find(a => a.id === selectedAlunoId);
  const turma = turmas.find(t => t.id === selectedTurmaId);
  const escola = turma ? escolas.find(e => e.id === turma.escolaId) : null;
  
  // Filtrar disciplinas vinculadas à turma por qualquer professor, com fallback para todas da escola
  const materiasEscola = React.useMemo(() => {
    if (!selectedTurmaId) return [];
    
    const idsVinculados = new Set<string>();
    professores.forEach(prof => {
      if (prof.vinculos) {
        prof.vinculos.forEach(v => {
          if (v.turmaId === selectedTurmaId) {
            v.materias.forEach(mid => idsVinculados.add(mid));
          }
        });
      }
    });

    if (idsVinculados.size === 0) {
      return escola ? materias.filter(m => m.escolaId === escola.id) : [];
    }

    return materias.filter(m => idsVinculados.has(m.id));
  }, [selectedTurmaId, escola, materias, professores]);

  // Obter ano letivo a partir de bimestres
  const anosBimestres = Array.from(new Set(bimestres.map(b => b.ano).filter(Boolean)));
  const anoLetivoExibicao = anosBimestres.length > 0 ? anosBimestres.sort().join(' / ') : new Date().getFullYear();

  // Calcular média para o aluno, matéria e bimestre específicos de acordo com as três categorias
  const obterMediaBimestral = (materiaId: string, bimestreId: string) => {
    const ativs = atividades.filter(
      at => at.turmaId === selectedTurmaId && at.materiaId === materiaId && at.bimestreId === bimestreId
    );

    if (ativs.length === 0) return null;

    // 1. Trabalho (máx. 6)
    const trabalhos = ativs.filter(at => at.tipo === 'trabalho');
    let notaTrabalho = 0;
    if (trabalhos.length > 0) {
      let soma = 0;
      trabalhos.forEach(at => {
        const reg = notas.find(n => n.alunoId === selectedAlunoId && n.atividadeId === at.id);
        if (reg && reg.nota !== undefined && reg.nota >= 0) {
          soma += reg.nota;
        }
      });
      notaTrabalho = soma / trabalhos.length;
    }

    // 2. PLURAAL (máx. 1)
    const pluraals = ativs.filter(at => at.tipo === 'pluraal');
    let notaPluraal = 0;
    if (pluraals.length > 0) {
      let soma = 0;
      pluraals.forEach(at => {
        const reg = notas.find(n => n.alunoId === selectedAlunoId && n.atividadeId === at.id);
        if (reg && reg.nota !== undefined && reg.nota >= 0) {
          soma += reg.nota;
        }
      });
      notaPluraal = soma / pluraals.length;
    }

    // 3. Qualitativa (máx. 3)
    const qualitativas = ativs.filter(at => at.tipo === 'qualitativa');
    let notaQualitativa = 0;
    if (qualitativas.length > 0) {
      let soma = 0;
      qualitativas.forEach(at => {
        const reg = notas.find(n => n.alunoId === selectedAlunoId && n.atividadeId === at.id);
        if (reg && reg.nota !== undefined && (reg.nota as any) !== 'faltou' && (reg.nota as any) !== '') {
          const num = Number(reg.nota);
          if (!isNaN(num) && num >= 0) {
            soma += num;
          }
        }
      });
      notaQualitativa = soma / qualitativas.length;
    }

    // Se não houver notas lançadas para nenhuma atividade, retorna null
    let temAlgumaNota = false;
    ativs.forEach(at => {
      const reg = notas.find(n => n.alunoId === selectedAlunoId && n.atividadeId === at.id);
      if (reg && reg.nota !== undefined && reg.nota >= 0) {
        temAlgumaNota = true;
      }
    });

    if (!temAlgumaNota) return null;

    // 4. Pontos extras de apontamentos (Material, Tarefa, Comportamento) no bimestre e matéria ativos
    const registrosAp = apontamentos.filter(
      ap => ap.alunoId === selectedAlunoId && 
            ap.materiaId === materiaId && 
            ap.bimestreId === bimestreId
    );
    let pontosAtitudinais = 0;
    registrosAp.forEach(ap => {
      if (ap.tarefa === 'sim') pontosAtitudinais += 0.1;
      else if (ap.tarefa === 'parcial') pontosAtitudinais += 0.05;

      if (ap.material === 'sim') pontosAtitudinais += 0.1;
      else if (ap.material === 'parcial') pontosAtitudinais += 0.05;

      if (ap.comportamento === 'excelente') pontosAtitudinais += 0.2;
      else if (ap.comportamento === 'bom') pontosAtitudinais += 0.1;
      else if (ap.comportamento === 'regular') pontosAtitudinais += 0.05;
    });
    const pontosExtras = Math.min(pontosAtitudinais, 1.0);

    // 5. Notas de Ponto Bônus (soma direto na média final)
    const bonusAtivs = ativs.filter(at => at.tipo === 'bonus');
    let totalBonus = 0;
    bonusAtivs.forEach(at => {
      const reg = notas.find(n => n.alunoId === selectedAlunoId && n.atividadeId === at.id);
      if (reg && reg.nota !== undefined && reg.nota >= 0) {
        totalBonus += reg.nota;
      }
    });

    const mediaBase = Math.min(notaTrabalho + notaPluraal + notaQualitativa + pontosExtras, 10.0);
    return Math.min(mediaBase + totalBonus, 10.0);
  };

  const dispararImpressao = () => {
    window.print();
  };

  const formatarData = (dStr?: any) => {
    if (!dStr || typeof dStr !== 'string') return '—';
    return dStr.split('-').reverse().join('/');
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Controles de Filtros */}
      <div className="card-box no-print" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="f">
            <label>Selecione a Turma *</label>
            <select value={selectedTurmaId} onChange={(e) => { 
              setSelectedTurmaId(e.target.value); 
              setSelectedAlunoId(''); 
              setSelectedMateriaIds([]);
              setEditingNotaId(null);
            }}>
              <option value="">— selecione a turma —</option>
              {turmas.map(t => {
                const esc = escolas.find(e => e.id === t.escolaId);
                return <option key={t.id} value={t.id}>{t.nome} ({esc ? esc.nome : 'Escola'})</option>;
              })}
            </select>
          </div>
          <div className="f">
            <label>
              Selecione o Aluno *
              {selectedTurmaId && alunosDaTurma.length === 0 && (
                <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '6px' }}>Nenhum aluno ativo nesta turma</span>
              )}
            </label>
            <select value={selectedAlunoId} onChange={(e) => {
              setSelectedAlunoId(e.target.value);
              setSelectedMateriaIds([]);
              setEditingNotaId(null);
            }} disabled={!selectedTurmaId}>
              <option value="">— selecione o aluno —</option>
              {alunosDaTurma.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Visão de Boletim */}
      {!selectedTurmaId || !selectedAlunoId || !aluno ? (
        <div className="card-box no-print" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          ⚠️ Selecione a Turma e o Aluno acima para carregar e formatar o boletim individual de notas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Bloco de Consulta e Edição de Notas (Professores) - Apenas em tela, não imprime */}
          <div className="card-box no-print" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-notebook" style={{ color: 'var(--primary)', fontSize: '18px' }}></i>
                Consulta e Lançamento de Notas do Aluno
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Selecione o bimestre e as matérias para consultar ou editar as notas detalhadas deste aluno.
              </div>
            </div>

            {/* Filtros da Consulta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              {/* Seletor de Bimestre */}
              <div className="f" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Selecione o Bimestre *</label>
                <select 
                  value={globalBimestreId} 
                  onChange={(e) => { onBimestreChange(e.target.value); setEditingNotaId(null); }}
                  style={{ width: '100%', maxWidth: '300px' }}
                >
                  <option value="">— selecione o bimestre —</option>
                  {bimestres.map(b => (
                    <option key={b.id} value={b.id}>{b.nome}{b.ano ? ` (${b.ano})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Seletor de Matérias (Seleção Múltipla Dinâmica) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Selecione as Matérias (Uma ou mais) *</label>
                  {materiasEscola.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => setSelectedMateriaIds(materiasEscola.map(m => m.id))}
                        style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        ✓ Selecionar Todas
                      </button>
                      <span style={{ color: 'var(--border)', fontSize: '11px' }}>|</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedMateriaIds([])}
                        style={{ fontSize: '11px', background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        ✕ Limpar Seleção
                      </button>
                    </div>
                  )}
                </div>
                {materiasEscola.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>Nenhuma matéria cadastrada para esta escola.</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {materiasEscola.map(m => {
                      const isSelected = selectedMateriaIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setEditingNotaId(null);
                            setSelectedMateriaIds(prev => 
                              prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                            );
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                            background: isSelected ? 'var(--primary)' : '#fff',
                            color: isSelected ? '#fff' : 'var(--text-main)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease-in-out',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          {isSelected && <span>✓</span>}
                          {m.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Listagem de Notas */}
            {!selectedBimestreId || selectedMateriaIds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                💡 Selecione o bimestre e pelo menos uma matéria acima para carregar as notas.
              </div>
            ) : (
              <div>
                {(() => {
                  const atividadesFiltradasEdicao = atividades.filter(
                    at => at.turmaId === selectedTurmaId && 
                          selectedMateriaIds.includes(at.materiaId) && 
                          at.bimestreId === selectedBimestreId
                  );

                  if (atividadesFiltradasEdicao.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                        Nenhuma atividade cadastrada para os filtros selecionados.
                      </div>
                    );
                  }

                  const atividadesOrdenadas = [...atividadesFiltradasEdicao].sort((a, b) => {
                    const matA = materias.find(m => m.id === a.materiaId)?.nome || '';
                    const matB = materias.find(m => m.id === b.materiaId)?.nome || '';
                    if (matA !== matB) return matA.localeCompare(matB, 'pt-BR');
                    return a.nome.localeCompare(b.nome, 'pt-BR');
                  });

                  // Badge styles
                  const badgeColor = (t: string) => {
                    if (t === 'prova') return { bg: '#fee2e2', text: '#991b1b' };
                    if (t === 'trabalho') return { bg: '#eff6ff', text: '#1e40af' };
                    if (t === 'pluraal') return { bg: '#f3e8ff', text: '#6b21a8' };
                    return { bg: '#f0fdf4', text: '#166534' };
                  };

                  const ObterCoresNotaEdicao = (notaStr: string, notaMax: number) => {
                    if (!notaStr || notaStr.trim() === '') return { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--text-main)' };
                    const valor = Number(notaStr.replace(',', '.'));
                    if (isNaN(valor)) return { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--text-main)' };
                    
                    const pct = valor / notaMax;
                    if (pct >= 0.7) {
                      return { bg: '#dcfce7', border: '#86efac', text: '#166534' };
                    } else if (pct >= 0.4) {
                      return { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' };
                    } else {
                      return { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' };
                    }
                  };

                  return (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: 'var(--text-muted)', fontWeight: 800 }}>
                            <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Matéria</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Atividade</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', width: '100px', borderBottom: '1px solid var(--border)' }}>Tipo</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', width: '100px', borderBottom: '1px solid var(--border)' }}>Nota Máxima</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', width: '130px', borderBottom: '1px solid var(--border)' }}>Nota</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', width: '120px', borderBottom: '1px solid var(--border)' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {atividadesOrdenadas.map(at => {
                            const mat = materias.find(m => m.id === at.materiaId);
                            const colors = badgeColor(at.tipo);
                            const notaVal = obterNotaValor(at.id);
                            const cellKey = `${selectedAlunoId}_${at.id}`;
                            const isEditing = editingNotaId === cellKey;
                            const isSaving = !!savingCells[cellKey];
                            const notaColors = ObterCoresNotaEdicao(notaVal, obterNotaMaxima(at.tipo));

                            return (
                              <tr key={at.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-main)', borderBottom: '1px solid var(--border)' }}>
                                  {mat ? mat.nome : '—'}
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{at.nome}</div>
                                  {at.descricao && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{at.descricao}</div>}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                                  <span style={{ fontSize: '9.5px', background: colors.bg, color: colors.text, padding: '3px 8px', borderRadius: '6px', fontWeight: 800, textTransform: 'uppercase' }}>
                                    {at.tipo}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                                  {obterNotaMaxima(at.tipo)}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                                  {isEditing ? (
                                    <div style={{ display: 'inline-block', width: '80px', position: 'relative' }}>
                                      <input
                                        type="text"
                                        value={editNotaValue}
                                        onChange={(e) => setEditNotaValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            salvarNotaEdicao(at.id, editNotaValue);
                                          } else if (e.key === 'Escape') {
                                            setEditingNotaId(null);
                                          }
                                        }}
                                        style={{
                                          width: '100%',
                                          textAlign: 'center',
                                          padding: '5px',
                                          border: '1px solid var(--primary)',
                                          borderRadius: '6px',
                                          fontSize: '13px',
                                          fontWeight: 700,
                                          outline: 'none'
                                        }}
                                        autoFocus
                                        placeholder={`0-${obterNotaMaxima(at.tipo)}`}
                                      />
                                    </div>
                                  ) : (
                                    <span style={{
                                      display: 'inline-block',
                                      minWidth: '35px',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontWeight: 800,
                                      fontSize: '13px',
                                      background: notaColors.bg,
                                      border: `1px solid ${notaColors.border}`,
                                      color: notaColors.text
                                    }}>
                                      {notaVal !== '' ? Number(notaVal).toFixed(1) : '—'}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                                  {isSaving ? (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      ⏳ Gravando...
                                    </span>
                                  ) : isEditing ? (
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                      <button 
                                        type="button"
                                        onClick={() => salvarNotaEdicao(at.id, editNotaValue)}
                                        style={{ padding: '4px 8px', background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                                        title="Salvar Alteração"
                                      >
                                        ✓ Salvar
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setEditingNotaId(null)}
                                        style={{ padding: '4px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                                        title="Cancelar"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingNotaId(cellKey);
                                        setEditNotaValue(notaVal);
                                      }}
                                      style={{
                                        padding: '5px 10px',
                                        fontSize: '11.5px',
                                        fontWeight: 700,
                                        background: '#fff',
                                        border: '1px solid var(--border)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        color: 'var(--text-main)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                      className="btn"
                                    >
                                      ✏️ Editar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Botão de Ação */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="no-print">
            <button className="btn pri" onClick={dispararImpressao}>
              <i className="ti ti-printer"></i> 🖨️ Imprimir Boletim Escolar
            </button>
          </div>

          {/* Folha de Boletim (Estilizada para impressão) */}
          <div id="boletim-imprimivel" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', boxShadow: 'var(--shadow-lg)' }}>
            
            {/* Cabeçalho Oficial do Boletim */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid var(--dark)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--dark)', letterSpacing: '0.5px' }}>
                  {escola ? escola.nome.toUpperCase() : 'BOLETIM ESCOLAR OFICIAL'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                  SISTEMA DE GESTÃO ESCOLAR INTEGRADO
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', color: '#1e40af', fontWeight: 800 }}>
                  ANO LETIVO: {anoLetivoExibicao}
                </span>
              </div>
            </div>

            {/* Ficha Cadastral do Aluno */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#fafafa', border: '1px solid var(--border)', padding: '14px', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>NOME DO ALUNO:</span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dark)' }}>{aluno.nome}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>TURMA:</span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dark)' }}>{turma ? turma.nome : '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>SÉRIE / ANO:</span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dark)' }}>{turma ? turma.serie : '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>NASCIMENTO:</span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dark)' }}>{formatarData(aluno.nascimento)}</div>
              </div>
            </div>

            {/* Tabela de Notas */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '2rem' }}>
              <thead>
                <tr style={{ background: 'var(--dark)', color: '#fff', fontWeight: 800 }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderRadius: '8px 0 0 0' }}>COMPONENTE CURRICULAR</th>
                  {bimestres.map(b => (
                    <th key={b.id} style={{ padding: '12px', textAlign: 'center', width: '110px' }}>
                      {b.nome.replace(' Bimestre', 'º B')}{b.ano ? ` (${b.ano})` : ''}
                    </th>
                  ))}
                  <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>MÉDIA</th>
                  <th style={{ padding: '12px', textAlign: 'center', width: '110px', borderRadius: '0 8px 0 0' }}>SITUAÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {materiasEscola.length === 0 ? (
                  <tr>
                    <td colSpan={bimestres.length + 3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Nenhuma disciplina vinculada ao boletim desta escola.
                    </td>
                  </tr>
                ) : (
                  materiasEscola.map(mat => {
                    let somaMedias = 0;
                    let bimestresComNota = 0;

                    const mediasBimestrais = bimestres.map(b => {
                      const m = obterMediaBimestral(mat.id, b.id);
                      if (m !== null) {
                        somaMedias += m;
                        bimestresComNota++;
                      }
                      return m;
                    });

                    const mediaFinal = bimestresComNota > 0 ? somaMedias / bimestresComNota : null;
                    const aprovado = mediaFinal !== null && mediaFinal >= 7.0;

                    return (
                      <tr key={mat.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border)', transition: '0.15s' }}>
                        <td style={{ padding: '12px', fontWeight: 800, color: 'var(--text-main)' }}>{mat.nome}</td>
                        {mediasBimestrais.map((m, idx) => (
                          <td key={idx} style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                            {m !== null && !isNaN(m) ? m.toFixed(1) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 800, background: '#fafafa' }}>
                          {mediaFinal !== null && !isNaN(mediaFinal) ? mediaFinal.toFixed(1) : '—'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', background: '#fafafa' }}>
                          {mediaFinal === null ? (
                            <span style={{ fontSize: '10px', color: '#64748b' }}>PENDENTE</span>
                          ) : aprovado ? (
                            <span style={{ fontSize: '10.5px', color: '#166534', fontWeight: 800 }}>APROVADO</span>
                          ) : (
                            <span style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 800 }}>RECUPERAÇÃO</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Rodapé de Assinaturas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '4rem', fontSize: '11px', textAlign: 'center' }}>
              <div>
                <div style={{ borderTop: '1px solid #94a3b8', width: '220px', margin: '0 auto', paddingTop: '6px' }}>
                  ASSINATURA DA COORDENAÇÃO
                </div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #94a3b8', width: '220px', margin: '0 auto', paddingTop: '6px' }}>
                  ASSINATURA DO PROFESSOR
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Estilos CSS Especiais para Impressão */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .sidebar, .topbar, .no-print, #sb-toggle-btn {
            display: none !important;
          }
          #boletim-imprimivel {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>

    </div>
  );
};

export default BoletimPage;
