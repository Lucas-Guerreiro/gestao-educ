import React, { useState, useMemo } from 'react';
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

  // Handlers com reset em cascata
  const handleTurmaChange = (id: string) => {
    setTurmaId(id);
    setMateriaId('');
    setBimestreId('');
  };

  const handleMateriaChange = (id: string) => {
    setMateriaId(id);
    setBimestreId('');
  };

  // Matérias que têm atividades na turma selecionada
  const materiasDaTurma = useMemo(() => {
    if (!turmaId) return materias;
    const ids = new Set(atividades.filter(at => at.turmaId === turmaId).map(at => at.materiaId));
    return materias.filter(m => ids.has(m.id));
  }, [turmaId, atividades, materias]);

  // Bimestres que têm atividades na turma + matéria selecionadas
  const bimestresDaTurmaMateria = useMemo(() => {
    if (!turmaId || !materiaId) return bimestres;
    const ids = new Set(
      atividades.filter(at => at.turmaId === turmaId && at.materiaId === materiaId).map(at => at.bimestreId)
    );
    return bimestres.filter(b => ids.has(b.id));
  }, [turmaId, materiaId, atividades, bimestres]);

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

  // Filtrar as atividades com base em qualquer um dos filtros selecionados
  const atividadesFiltradasParaLista = useMemo(() => {
    return atividades.filter(at => {
      const matchTurma = turmaId ? at.turmaId === turmaId : true;
      const matchMateria = materiaId ? at.materiaId === materiaId : true;
      const matchBimestre = bimestreId ? at.bimestreId === bimestreId : true;
      return matchTurma && matchMateria && matchBimestre;
    });
  }, [atividades, turmaId, materiaId, bimestreId]);

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
              Selecione a Matéria *
              {turmaId && materiasDaTurma.length === 0 && (
                <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '6px' }}>Nenhuma atividade cadastrada para esta turma</span>
              )}
            </label>
            <select value={materiaId} onChange={(e) => handleMateriaChange(e.target.value)} disabled={!turmaId}>
              <option value="">— selecione —</option>
              {materiasDaTurma.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div className="f">
            <label>
              Selecione o Bimestre *
              {materiaId && bimestresDaTurmaMateria.length === 0 && (
                <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '6px' }}>Nenhuma atividade nesta matéria</span>
              )}
            </label>
            <select value={bimestreId} onChange={(e) => setBimestreId(e.target.value)} disabled={!materiaId}>
              <option value="">— selecione —</option>
              {bimestresDaTurmaMateria.map(b => (
                <option key={b.id} value={b.id}>{b.nome}{b.ano ? ` (${b.ano})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Planilha de Notas */}
      {!turmaId || !materiaId || !bimestreId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="card-box" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ti ti-info-circle"></i>
              Selecione os Filtros ou Escolha uma Atividade Abaixo
            </div>
            <div style={{ fontSize: '12.5px', color: '#1e40af', opacity: 0.9 }}>
              Preencha a Turma, Matéria e o Bimestre nos selects acima para carregar a planilha completa de notas, ou clique em <b>"Lançar Notas"</b> em qualquer atividade listada abaixo para carregar seus dados automaticamente.
            </div>
          </div>

          <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ti ti-clipboard-list" style={{ color: 'var(--primary)' }}></i>
              Atividades Cadastradas ({atividadesFiltradasParaLista.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
              {atividadesFiltradasParaLista.length === 0 ? (
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12.5px', textAlign: 'center', padding: '30px 10px' }}>
                  Nenhuma atividade corresponde aos filtros atuais.
                </div>
              ) : (
                atividadesFiltradasParaLista.map(ativ => {
                  const tur = turmas.find(t => t.id === ativ.turmaId);
                  const mat = materias.find(m => m.id === ativ.materiaId);
                  const bim = bimestres.find(b => b.id === ativ.bimestreId);
                  const colors = badgeColor(ativ.tipo);
                  
                  const totalAlunos = alunos.filter(a => String(a.turmaId) === ativ.turmaId && a.ativo !== false).length;
                  const notasLancadas = notas.filter(n => n.atividadeId === ativ.id && n.nota !== undefined && n.nota >= 0).length;
                  const progressoPorcentagem = totalAlunos > 0 ? Math.round((notasLancadas / totalAlunos) * 100) : 0;

                  return (
                    <div 
                      key={ativ.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '12px 16px', 
                        background: '#f8fafc', 
                        border: '1px solid var(--border)', 
                        borderRadius: '12px',
                        cursor: 'default'
                      }}
                      className="table-row-hover"
                    >
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>{ativ.nome}</span>
                          {ativ.descricao && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>— {ativ.descricao}</span>}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', background: colors.bg, color: colors.text, padding: '2.5px 7px', borderRadius: '6px', fontWeight: 800 }}>
                            {ativ.tipo.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '9.5px', background: '#e2e8f0', color: '#475569', padding: '2.5px 7px', borderRadius: '6px', fontWeight: 600 }}>
                            🏫 {tur ? tur.nome : '—'}
                          </span>
                          <span style={{ fontSize: '9.5px', background: '#e2e8f0', color: '#475569', padding: '2.5px 7px', borderRadius: '6px', fontWeight: 600 }}>
                            📖 {mat ? mat.nome : '—'}
                          </span>
                          <span style={{ fontSize: '9.5px', background: '#eff6ff', color: '#1e40af', padding: '2.5px 7px', borderRadius: '6px', fontWeight: 700 }}>
                            📅 {bim ? `${bim.nome}${bim.ano ? ` (${bim.ano})` : ''}` : '—'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ti ti-users" style={{ color: 'var(--primary)' }}></i>
                            <span>Alunos: <b>{totalAlunos}</b></span>
                          </div>
                          <span>•</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ti ti-discount-check" style={{ color: progressoPorcentagem === 100 ? '#22c55e' : '#eab308' }}></i>
                            <span>Lançamentos: <b>{notasLancadas}/{totalAlunos} ({progressoPorcentagem}%)</b></span>
                          </div>
                          {totalAlunos > 0 && (
                            <div style={{ width: '80px', height: '5px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', marginLeft: '4px' }}>
                              <div style={{ width: `${progressoPorcentagem}%`, height: '100%', background: progressoPorcentagem === 100 ? '#22c55e' : 'var(--primary)' }}></div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        <button 
                          className="btn pri" 
                          style={{ 
                            padding: '8px 16px', 
                            fontSize: '12.5px', 
                            fontWeight: 700, 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            boxShadow: 'var(--shadow-sm)',
                            borderRadius: '8px'
                          }} 
                          onClick={() => {
                            setTurmaId(ativ.turmaId);
                            setMateriaId(ativ.materiaId);
                            setBimestreId(ativ.bimestreId);
                          }}
                        >
                          <i className="ti ti-table"></i> Lançar Notas
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
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
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
          
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '11.5px', color: '#1e40af', lineHeight: 1.5 }}>
            <i className="ti ti-info-circle"></i>
            <b>Dica de Lançamento:</b> Digite a nota na célula correspondente e pressione <b>Enter</b> para descer automaticamente para o próximo aluno, ou clique fora (Tab) para salvar. As notas de Trabalho (máx. 6) e PLURAAL (máx. 1) iniciam ocultas.
          </div>

          {/* Controles de Visibilidade das Notas */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn" 
              onClick={() => {
                setTurmaId('');
                setMateriaId('');
                setBimestreId('');
              }}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '12.5px', 
                fontWeight: 600,
                borderColor: '#cbd5e1',
                color: 'var(--text-main)',
                background: '#fff',
                padding: '6px 12px',
                borderRadius: '8px'
              }}
            >
              <i className="ti ti-arrow-left"></i>
              Voltar para Atividades
            </button>
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

          {/* Container de Rolagem da Tabela com Cabeçalho Congelado */}
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 290px)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontWeight: 800 }}>
                  <th style={{ 
                    padding: '12px 10px', 
                    textAlign: 'left', 
                    minWidth: '200px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: '#fff',
                    boxShadow: 'inset 0 -2px 0 var(--border)'
                  }}>
                    Aluno
                  </th>
                  {atividadesFiltradas.map(at => {
                    const colors = badgeColor(at.tipo);
                    return (
                      <th 
                        key={at.id} 
                        style={{ 
                          padding: '12px 10px', 
                          textAlign: 'center', 
                          width: '120px',
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                          background: '#fff',
                          boxShadow: 'inset 0 -2px 0 var(--border)'
                        }}
                      >
                        <div className="nota-col-label" style={{ display: 'inline-block', padding: '6px 10px', borderRadius: '10px', background: colors.bg, color: colors.text, minWidth: '110px' }}>
                          <div style={{ fontWeight: 700, color: colors.text, fontSize: '13px' }}>{at.nome}</div>
                          {at.descricao && <div className="nt-tip">{at.descricao}</div>}
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ 
                    padding: '12px 10px', 
                    textAlign: 'center', 
                    width: '120px', 
                    background: '#fafafa',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    boxShadow: 'inset 0 -2px 0 var(--border)'
                  }}>
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
                    <tr key={aluno.id} className="table-row-hover">
                      <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid var(--border)' }}>{aluno.nome}</td>
                      
                      {atividadesFiltradas.map((at, atIdx) => {
                        const eOcultavel = at.tipo === 'prova' || at.tipo === 'trabalho' || at.tipo === 'pluraal';
                        const celulaOculta = eOcultavel && notasOcultas;

                        const notaVal = obterNotaValor(aluno.id, at.id);
                        const displayVal = celulaOculta ? '***' : (notaVal === '-1' ? '' : notaVal);
                        const cellKey = `${aluno.id}_${at.id}`;
                        const isSaving = !!savingCells[cellKey];
                        const notaColors = getNotaCellColors(displayVal, celulaOculta);

                        return (
                          <td key={at.id} style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
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
                      <td style={{ padding: '10px', textAlign: 'center', background: '#fafafa', fontWeight: 800, borderBottom: '1px solid var(--border)' }}>
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
        </div>
      )}

    </div>
  );
};

export default NotasPage;
