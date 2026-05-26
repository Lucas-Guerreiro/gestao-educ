import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota, Escola } from '@/types';

interface NotasPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  atividades: Atividade[];
  notas: Nota[];
  escolas: Escola[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const NotasPage: React.FC<NotasPageProps> = ({
  alunos,
  turmas,
  materias,
  bimestres,
  atividades,
  notas,
  escolas,
  setSyncStatus,
}) => {
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [bimestreId, setBimestreId] = useState('');

  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});

  // Estados de revelação/ocultação de notas de Provas, Trabalho e PLURAAL
  const [visibilidadePermanente, setVisibilidadePermanente] = useState<boolean>(() => {
    return localStorage.getItem('es_notas_reveladas_permanente') === 'true';
  });

  const [notasOcultas, setNotasOcultas] = useState<boolean>(() => {
    const permanente = localStorage.getItem('es_notas_reveladas_permanente') === 'true';
    return !permanente; // Se for permanente, as notas não começam ocultas. Senão, começam ocultas.
  });

  const alternarVisibilidadeTemporaria = () => {
    setNotasOcultas(prev => !prev);
  };

  const alternarVisibilidadePermanente = () => {
    const novoValor = !visibilidadePermanente;
    setVisibilidadePermanente(novoValor);
    localStorage.setItem('es_notas_reveladas_permanente', String(novoValor));
    if (novoValor) {
      setNotasOcultas(false); // Se ativou permanente, revela as notas
    } else {
      setNotasOcultas(true); // Se desativou permanente, volta a ocultar por padrão
    }
  };

  // Filtrar alunos ativos da turma selecionada
  const alunosFiltrados = alunos.filter(a => String(a.turmaId) === turmaId && a.ativo !== false);

  // Filtrar atividades da turma, matéria e bimestre
  const atividadesFiltradas = atividades.filter(
    at => at.turmaId === turmaId && at.materiaId === materiaId && at.bimestreId === bimestreId
  );

  // Obter nota do aluno para a atividade específica
  const obterNotaValor = (alunoId: string, atividadeId: string): string => {
    const registro = notas.find(n => n.alunoId === alunoId && n.atividadeId === atividadeId);
    if (!registro || registro.nota === undefined) return '';
    return String(registro.nota);
  };

  const obterNotaMaxima = (tipo: string): number => {
    if (tipo === 'trabalho') return 6;
    if (tipo === 'pluraal') return 1;
    if (tipo === 'qualitativa') return 3;
    return 10;
  };

  const badgeColor = (t: string) => {
    if (t === 'prova') return { bg: '#fee2e2', text: '#991b1b' };
    if (t === 'trabalho') return { bg: '#eff6ff', text: '#1e40af' };
    if (t === 'pluraal') return { bg: '#f3e8ff', text: '#6b21a8' };
    return { bg: '#f0fdf4', text: '#166534' };
  };

  const getNotaCellColors = (valorStr: string, celulaOculta: boolean) => {
    if (celulaOculta || !valorStr || valorStr === '-1') {
      return { bg: '#fff', border: '#cbd5e1', text: 'var(--text-main)' };
    }

    const valor = Number(valorStr.replace(',', '.'));
    if (Number.isNaN(valor)) {
      return { bg: '#fff', border: '#cbd5e1', text: 'var(--text-main)' };
    }

    if (valor <= 1.5) {
      return { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' };
    }

    if (valor <= 2.4) {
      return { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' };
    }

    return { bg: '#dcfce7', border: '#86efac', text: '#166534' };
  };

  // Salvar nota no Firestore com ID determinístico
  const salvarNota = async (alunoId: string, atividadeId: string, valorStr: string) => {
    if (!turmaId || !materiaId || !bimestreId) return;
    
    const at = atividades.find(a => a.id === atividadeId);
    const tipoAt = at ? at.tipo : '';
    const notaMax = obterNotaMaxima(tipoAt);

    const valor = valorStr.trim() === '' ? null : Number(valorStr.replace(',', '.'));
    if (valor !== null && (isNaN(valor) || valor < 0 || valor > notaMax)) {
      alert(`Por favor, informe uma nota válida entre 0 e ${notaMax} para atividades do tipo ${tipoAt.toUpperCase()}.`);
      return;
    }

    const docId = `${alunoId}_${atividadeId}`;
    const cellKey = `${alunoId}_${atividadeId}`;
    
    setSavingCells(prev => ({ ...prev, [cellKey]: true }));
    setSyncStatus('saving');

    try {
      const docRef = doc(db, 'notas', docId);
      if (valor === null) {
        await setDoc(docRef, {
          alunoId,
          atividadeId,
          turmaId,
          materiaId,
          bimestreId,
          nota: -1 // -1 representa apagado
        });
      } else {
        await setDoc(docRef, {
          alunoId,
          atividadeId,
          turmaId,
          materiaId,
          bimestreId,
          nota: valor
        });
      }
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      console.error('Erro ao salvar nota:', err);
    } finally {
      setSavingCells(prev => ({ ...prev, [cellKey]: false }));
    }
  };

  // Calcular média bimestral do aluno baseado na soma direta das médias de Trabalho, PLURAAL e Qualitativa
  const calcularMediaAluno = (alunoId: string) => {
    if (atividadesFiltradas.length === 0) return '—';

    // 1. Trabalho (máx. 6) - Só soma se não estiver oculto
    const trabalhos = atividadesFiltradas.filter(at => at.tipo === 'trabalho');
    let notaTrabalho = 0;
    if (trabalhos.length > 0 && !notasOcultas) {
      let soma = 0;
      trabalhos.forEach(at => {
        const notaStr = obterNotaValor(alunoId, at.id);
        if (notaStr !== '' && Number(notaStr) >= 0) {
          soma += Number(notaStr);
        }
      });
      notaTrabalho = soma / trabalhos.length;
    }

    // 2. PLURAAL (máx. 1) - Só soma se não estiver oculto
    const pluraals = atividadesFiltradas.filter(at => at.tipo === 'pluraal');
    let notaPluraal = 0;
    if (pluraals.length > 0 && !notasOcultas) {
      let soma = 0;
      pluraals.forEach(at => {
        const notaStr = obterNotaValor(alunoId, at.id);
        if (notaStr !== '' && Number(notaStr) >= 0) {
          soma += Number(notaStr);
        }
      });
      notaPluraal = soma / pluraals.length;
    }

    // 3. Qualitativa (máx. 3) - Qualitativa nunca oculta
    const qualitativas = atividadesFiltradas.filter(at => at.tipo === 'qualitativa');
    let notaQualitativa = 0;
    if (qualitativas.length > 0) {
      let soma = 0;
      qualitativas.forEach(at => {
        const notaStr = obterNotaValor(alunoId, at.id);
        if (notaStr !== '' && Number(notaStr) >= 0) {
          soma += Number(notaStr);
        }
      });
      notaQualitativa = soma / qualitativas.length;
    }

    // Se o aluno não tem nota lançada em nenhuma atividade, exibe '—'
    let temAlgumaNota = false;
    atividadesFiltradas.forEach(at => {
      const notaStr = obterNotaValor(alunoId, at.id);
      if (notaStr !== '' && Number(notaStr) >= 0) {
        temAlgumaNota = true;
      }
    });

    if (!temAlgumaNota) return '—';

    const media = notaTrabalho + notaPluraal + notaQualitativa;
    return media.toFixed(1);
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Filtros da Grade */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div className="f">
            <label>Selecione a Turma *</label>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">— selecione —</option>
              {turmas.map(t => {
                const esc = escolas.find(e => e.id === t.escolaId);
                return <option key={t.id} value={t.id}>{t.nome} ({esc ? esc.nome : 'Escola'})</option>;
              })}
            </select>
          </div>
          <div className="f">
            <label>Selecione a Matéria *</label>
            <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
              <option value="">— selecione —</option>
              {materias.map(m => {
                const esc = escolas.find(e => e.id === m.escolaId);
                return <option key={m.id} value={m.id}>{m.nome} ({esc ? esc.nome : 'Escola'})</option>;
              })}
            </select>
          </div>
          <div className="f">
            <label>Selecione o Bimestre *</label>
            <select value={bimestreId} onChange={(e) => setBimestreId(e.target.value)}>
              <option value="">— selecione —</option>
              {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}{b.ano ? ` (${b.ano})` : ''}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Planilha de Notas */}
      {!turmaId || !materiaId || !bimestreId ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          ⚠️ Selecione a Turma, Matéria e o Bimestre acima para carregar a planilha de lançamento de notas.
        </div>
      ) : atividadesFiltradas.length === 0 ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Nenhuma atividade pedagógica planejada para esta turma, matéria e bimestre. Por favor, crie atividades antes na aba de Planejamento.
        </div>
      ) : alunosFiltrados.length === 0 ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Nenhum aluno cadastrado nesta turma de aplicação.
        </div>
      ) : (
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
          
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '11.5px', color: '#1e40af', lineHeight: 1.5 }}>
            <i className="ti ti-info-circle"></i>
            <b>Dica de Lançamento:</b> Digite a nota na célula correspondente e pressione <b>Enter</b> para descer automaticamente para o próximo aluno, ou clique fora (Tab) para salvar. As notas de Trabalho (máx. 6) e PLURAAL (máx. 1) iniciam ocultas.
          </div>

          {/* Controles de Visibilidade das Notas */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn" 
              onClick={alternarVisibilidadeTemporaria}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '12.5px', 
                fontWeight: 600,
                borderColor: notasOcultas ? 'var(--primary)' : '#cbd5e1',
                color: notasOcultas ? 'var(--primary)' : 'var(--text-main)',
                background: notasOcultas ? '#eff6ff' : '#fff',
                padding: '6px 12px',
                borderRadius: '8px'
              }}
            >
              <i className={notasOcultas ? "ti ti-eye" : "ti ti-eye-off"}></i>
              {notasOcultas ? '👁️ Revelar Notas (Trabalho/PLURAAL)' : '🙈 Ocultar Notas (Trabalho/PLURAAL)'}
            </button>

            <button 
              type="button" 
              className="btn" 
              onClick={alternarVisibilidadePermanente}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '12.5px', 
                fontWeight: 600,
                borderColor: visibilidadePermanente ? '#22c55e' : '#cbd5e1',
                color: visibilidadePermanente ? '#15803d' : '#64748b',
                background: visibilidadePermanente ? '#f0fdf4' : '#f8fafc',
                padding: '6px 12px',
                borderRadius: '8px'
              }}
            >
              <i className={visibilidadePermanente ? "ti ti-lock-open" : "ti ti-lock"}></i>
              {visibilidadePermanente ? '🔓 Visibilidade Permanente: ATIVADA' : '🔒 Tornar Visibilidade Permanente'}
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 }}>
                <th style={{ padding: '10px', textAlign: 'left', minWidth: '200px' }}>Aluno</th>
                {atividadesFiltradas.map(at => {
                  const colors = badgeColor(at.tipo);
                  return (
                    <th key={at.id} style={{ padding: '10px', textAlign: 'center', width: '120px' }}>
                      <div className="nota-col-label" style={{ display: 'inline-block', padding: '6px 10px', borderRadius: '10px', background: colors.bg, color: colors.text, minWidth: '110px' }}>
                        <div style={{ fontWeight: 700, color: colors.text, fontSize: '13px' }}>{at.nome}</div>
                        {at.descricao && <div className="nt-tip">{at.descricao}</div>}
                      </div>
                    </th>
                  );
                })}
                <th style={{ padding: '10px', textAlign: 'center', width: '120px', background: '#fafafa' }}>
                  Média Bimestral
                </th>
              </tr>
            </thead>
            <tbody>
              {alunosFiltrados.map((aluno, alunoIdx) => {
                const media = calcularMediaAluno(aluno.id);
                const mediaNum = media !== '—' ? Number(media) : null;
                const isFail = mediaNum !== null && mediaNum < 6.0;

                return (
                  <tr key={aluno.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                    <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-main)' }}>{aluno.nome}</td>
                    
                    {atividadesFiltradas.map((at, atIdx) => {
                      const eOcultavel = at.tipo === 'prova' || at.tipo === 'trabalho' || at.tipo === 'pluraal';
                      const celulaOculta = eOcultavel && notasOcultas;

                      const notaVal = obterNotaValor(aluno.id, at.id);
                      const displayVal = celulaOculta ? '***' : (notaVal === '-1' ? '' : notaVal);
                      const cellKey = `${aluno.id}_${at.id}`;
                      const isSaving = !!savingCells[cellKey];
                      const notaColors = getNotaCellColors(displayVal, celulaOculta);

                      return (
                        <td key={at.id} style={{ padding: '6px', textAlign: 'center' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '75px' }}>
                            <input 
                              key={celulaOculta ? 'oculto' : 'visivel'}
                              id={`input-nota-${alunoIdx}-${atIdx}`}
                              defaultValue={displayVal}
                              disabled={celulaOculta}
                              onBlur={(e) => {
                                if (!celulaOculta) {
                                  salvarNota(aluno.id, at.id, e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const proximoInput = document.getElementById(`input-nota-${alunoIdx + 1}-${atIdx}`);
                                  if (proximoInput) {
                                    (proximoInput as HTMLInputElement).focus();
                                    (proximoInput as HTMLInputElement).select();
                                  } else {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }
                              }}
                              placeholder={celulaOculta ? 'Oculto' : `0-${obterNotaMaxima(at.tipo)}`}
                              style={{ 
                                width: '100%', 
                                textAlign: 'center', 
                                padding: '6px', 
                                border: `1px solid ${notaColors.border}`,
                                borderRadius: '8px', 
                                fontSize: '13px', 
                                fontWeight: 700,
                                background: notaColors.bg,
                                color: notaColors.text,
                                cursor: celulaOculta ? 'not-allowed' : 'text',
                                transition: 'background 160ms ease, border-color 160ms ease'
                              }}
                            />
                            {isSaving && (
                              <div style={{ position: 'absolute', top: '2px', right: '2px', fontSize: '9px' }}>⏳</div>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Média Bimestral */}
                    <td style={{ padding: '10px', textAlign: 'center', background: '#fafafa', fontWeight: 800 }}>
                      <span style={{ 
                        color: isFail ? '#dc2626' : mediaNum !== null ? '#166534' : 'var(--text-muted)',
                        background: isFail ? '#fee2e2' : mediaNum !== null ? '#dcfce7' : 'none',
                        padding: mediaNum !== null ? '4px 10px' : '0',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}>
                        {media}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default NotasPage;
