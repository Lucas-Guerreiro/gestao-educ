import React, { useState, useMemo, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota, Escola, Apontamento, Professor } from '@/types';
import ApontamentoSalaModal from '../modals/ApontamentoSalaModal';
import CriarAtividadeModal from '../modals/CriarAtividadeModal';

interface NotasPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  atividades: Atividade[];
  notas: Nota[];
  escolas: Escola[];
  apontamentos: Apontamento[];
  professores: Professor[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
  selectedBimestreId: string;
  onBimestreChange: (id: string) => void;
  defaultTurmaId?: string;
  defaultMateriaId?: string;
}

const NotasPage: React.FC<NotasPageProps> = ({
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
  selectedBimestreId,
  onBimestreChange,
  defaultTurmaId = '',
  defaultMateriaId = '',
}) => {
  const [turmaId, setTurmaId] = useState(defaultTurmaId);
  const [materiaId, setMateriaId] = useState(defaultMateriaId);
  const [bimestreId, setBimestreId] = useState('');

  // Sincronizar com o bimestre global
  useEffect(() => {
    if (selectedBimestreId) {
      setBimestreId(selectedBimestreId);
    }
  }, [selectedBimestreId]);

  // Sincronizar com turma e matéria padrão vindas de navegação/redirecionamento
  useEffect(() => {
    if (defaultTurmaId) setTurmaId(defaultTurmaId);
  }, [defaultTurmaId]);

  useEffect(() => {
    if (defaultMateriaId) setMateriaId(defaultMateriaId);
  }, [defaultMateriaId]);

  // Estados para Compartilhamento Interdisciplinar Geral
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedAtivs, setSelectedAtivs] = useState<string[]>([]);
  const [isCriarAtivModalOpen, setIsCriarAtivModalOpen] = useState(false);
  const [atividadeParaEditar, setAtividadeParaEditar] = useState<Atividade | null>(null);
  const [isApontamentoModalOpen, setIsApontamentoModalOpen] = useState(false);
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  const handleEditarAtividade = (ativ: Atividade) => {
    setAtividadeParaEditar(ativ);
    setIsCriarAtivModalOpen(true);
  };

  const toggleAtividadeSelecao = (ativId: string) => {
    setSelectedAtivs(prev => 
      prev.includes(ativId) ? prev.filter(id => id !== ativId) : [...prev, ativId]
    );
  };

  const obterLinkCompartilhadoGeral = () => {
    const base = window.location.origin + window.location.pathname;
    
    const mapEntries = selectedAtivs.map(ativId => {
      const ativ = atividades.find(a => a.id === ativId);
      if (!ativ) return '';
      return `${ativ.turmaId}:${ativ.id}`;
    })
    .filter(Boolean)
    .join(',');
    
    return `${base}?compartilhado=true&map=${mapEntries}`;
  };

  const copiarLink = () => {
    const link = obterLinkCompartilhadoGeral();
    if (!link) return;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiadoFeedback(true);
        setTimeout(() => setCopiadoFeedback(false), 2500);
      })
      .catch(err => console.error('Erro ao copiar link:', err));
  };

  // Handlers com reset em cascata
  const handleTurmaChange = (id: string) => {
    setTurmaId(id);
    setMateriaId('');
  };

  const handleMateriaChange = (id: string) => {
    setMateriaId(id);
  };

  // Matérias que têm atividades na turma selecionada e que são lecionadas nela (com fallback para qualquer matéria com atividades)
  const materiasDaTurma = useMemo(() => {
    if (!turmaId) return materias;
    const ativMateriaIds = new Set(atividades.filter(at => at.turmaId === turmaId).map(at => at.materiaId));
    
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
      return materias.filter(m => ativMateriaIds.has(m.id));
    }
    
    return materias.filter(m => ativMateriaIds.has(m.id) && idsVinculados.has(m.id));
  }, [turmaId, atividades, materias, professores]);

  // Auto-selecionar matéria se houver apenas uma vinculada à turma
  useEffect(() => {
    if (turmaId && materiasDaTurma.length === 1) {
      setMateriaId(materiasDaTurma[0].id);
    }
  }, [turmaId, materiasDaTurma]);

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

  const [qualitativasColapsadas, setQualitativasColapsadas] = useState<boolean>(() => {
    return localStorage.getItem('es_qualitativas_colapsadas') !== 'false';
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

  // Ordenar atividades da esquerda para a direita: Qualitativa (por nome), depois PLURAAL (por nome) e por fim Trabalho (por nome)
  const atividadesOrdenadas = useMemo(() => {
    return [...atividadesFiltradas].sort((a, b) => {
      const getOrder = (tipo: string) => {
        if (tipo === 'qualitativa') return 1;
        if (tipo === 'pluraal') return 2;
        if (tipo === 'trabalho') return 3;
        return 4;
      };
      
      const orderA = getOrder(a.tipo);
      const orderB = getOrder(b.tipo);
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });
  }, [atividadesFiltradas]);

  const qualitativas = useMemo(() => {
    return atividadesFiltradas.filter(at => at.tipo === 'qualitativa');
  }, [atividadesFiltradas]);

  const atividadesExibidas = useMemo(() => {
    if (qualitativasColapsadas) {
      return atividadesOrdenadas.filter(at => at.tipo !== 'qualitativa');
    }
    return atividadesOrdenadas;
  }, [atividadesOrdenadas, qualitativasColapsadas]);

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

  const obterMediaQualitativa = (alunoId: string): string => {
    if (qualitativas.length === 0) return '—';
    
    let soma = 0;
    let temNota = false;
    qualitativas.forEach(at => {
      const notaStr = obterNotaValor(alunoId, at.id);
      if (notaStr !== '' && Number(notaStr) >= 0) {
        soma += Number(notaStr);
        temNota = true;
      }
    });
    
    if (!temNota) return '—';
    return (soma / qualitativas.length).toFixed(1);
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
      let count = 0;
      qualitativas.forEach(at => {
        const notaStr = obterNotaValor(alunoId, at.id);
        if (notaStr !== '' && notaStr !== 'faltou' && Number(notaStr) >= 0) {
          soma += Number(notaStr);
          count++;
        }
      });
      notaQualitativa = count > 0 ? soma / count : 0;
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

    // 4. Pontos extras de apontamentos (Material, Tarefa, Comportamento) no bimestre e matéria ativos
    const registrosAp = apontamentos.filter(
      ap => ap.alunoId === alunoId && 
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
    const bonusAtivs = atividadesFiltradas.filter(at => at.tipo === 'bonus');
    let totalBonus = 0;
    bonusAtivs.forEach(at => {
      const notaStr = obterNotaValor(alunoId, at.id);
      if (notaStr !== '' && Number(notaStr) >= 0) {
        totalBonus += Number(notaStr);
      }
    });

    const mediaBase = Math.min(notaTrabalho + notaPluraal + notaQualitativa + pontosExtras, 10.0);
    const mediaFinal = Math.min(mediaBase + totalBonus, 10.0);
    return mediaFinal.toFixed(1);
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
          <i className="ti ti-notes" style={{ color: 'var(--primary)', marginRight: '4px' }}></i> Lançamento de Notas
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => {
              if (!turmaId || !materiaId || !selectedBimestreId) {
                alert("Por favor, selecione primeiro a Turma, a Matéria e o Bimestre nos filtros abaixo para habilitar a planilha de apontamentos da sala.");
                return;
              }
              setIsApontamentoModalOpen(true);
            }}
            className="btn"
            style={{ 
              padding: '6px 12px', 
              fontSize: '12px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              height: '32px', 
              fontWeight: 700, 
              borderColor: 'var(--primary)', 
              color: 'var(--primary)',
              background: '#eff6ff',
              cursor: 'pointer'
            }}
            title="Lançar presença, tarefas e comportamento da turma"
          >
            <i className="ti ti-checklist" style={{ fontSize: '15px' }}></i> Apontar Sala
          </button>
          <button 
            onClick={() => {
              if (!turmaId || !materiaId) {
                alert("Por favor, selecione primeiro a Turma e a Matéria nos filtros abaixo para poder criar uma atividade.");
                return;
              }
              setIsCriarAtivModalOpen(true);
            }}
            className="btn pri"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', fontWeight: 700, cursor: 'pointer' }}
          >
            <i className="ti ti-plus" style={{ fontSize: '14px' }}></i> Criar Nova
          </button>
        </div>
      </div>
      
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
            <select value={selectedBimestreId} onChange={(e) => onBimestreChange(e.target.value)} disabled={!materiaId}>
              <option value="">— selecione —</option>
              {bimestres.map(b => (
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
                      className="flex-row-mobile-stack table-row-hover"
                      style={{ 
                        padding: '12px 16px', 
                        cursor: 'default'
                      }}
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

                      <div style={{ flexShrink: 0, display: 'flex', gap: '8px' }}>
                        <button 
                          type="button"
                          className="btn" 
                          style={{ 
                            padding: '8px 14px', 
                            fontSize: '12.5px', 
                            fontWeight: 700, 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            boxShadow: 'var(--shadow-sm)',
                            borderRadius: '8px',
                            background: selectedAtivs.includes(ativ.id) ? '#dcfce7' : '#fff',
                            border: selectedAtivs.includes(ativ.id) ? '1px solid #86efac' : '1px solid #cbd5e1',
                            color: selectedAtivs.includes(ativ.id) ? '#15803d' : 'var(--text-main)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }} 
                          onClick={() => toggleAtividadeSelecao(ativ.id)}
                        >
                          <i className={selectedAtivs.includes(ativ.id) ? "ti ti-checkbox" : "ti ti-link"} style={{ fontSize: '15px', color: selectedAtivs.includes(ativ.id) ? '#166534' : 'var(--primary)' }}></i> 
                          {selectedAtivs.includes(ativ.id) ? '✓ Selecionada' : 'Compartilhar'}
                        </button>
                        
                        <button 
                          type="button"
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

            <button 
              type="button" 
              className="btn" 
              onClick={() => {
                setQualitativasColapsadas(prev => {
                  const novo = !prev;
                  localStorage.setItem('es_qualitativas_colapsadas', String(novo));
                  return novo;
                });
              }}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '12.5px', 
                fontWeight: 600,
                borderColor: qualitativasColapsadas ? '#166534' : '#cbd5e1',
                color: qualitativasColapsadas ? '#166534' : 'var(--text-main)',
                background: qualitativasColapsadas ? '#f0fdf4' : '#fff',
                padding: '6px 12px',
                borderRadius: '8px'
              }}
            >
              <i className={qualitativasColapsadas ? "ti ti-layout-columns" : "ti ti-columns"}></i>
              {qualitativasColapsadas ? '📂 Mostrar Notas Qualitativas' : '📁 Colapsar Notas Qualitativas'}
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
                  {qualitativasColapsadas && qualitativas.length > 0 && (
                    <th 
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
                      <div className="nota-col-label" style={{ display: 'inline-block', padding: '6px 10px', borderRadius: '10px', background: '#f0fdf4', color: '#166534', minWidth: '110px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span>Qualitativa</span>
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>Média ({qualitativas.length})</div>
                      </div>
                    </th>
                  )}
                  {atividadesExibidas.map(at => {
                    const colors = badgeColor(at.tipo);
                    const hojeStr = new Date().toISOString().split('T')[0];
                    const atExpirada = !!(at.dataLimite && hojeStr > at.dataLimite && !at.liberadoVencido);

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
                        <div className="nota-col-label" style={{ display: 'inline-block', padding: '6px 10px', borderRadius: '10px', background: colors.bg, color: colors.text, minWidth: '110px', border: atExpirada ? '1.5px dashed #ef4444' : 'none' }}>
                          <div style={{ fontWeight: 700, color: colors.text, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {atExpirada && at.dataLimite && <i className="ti ti-lock" style={{ color: '#ef4444', fontSize: '13px' }} title={`Prazo limite expirado em ${at.dataLimite.split('-').reverse().join('/')}`}></i>}
                            <span 
                              onClick={() => handleEditarAtividade(at)}
                              style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                              title="Ajuste rápido: clique para editar esta atividade"
                            >
                              {at.nome}
                            </span>
                            <button 
                              type="button" 
                              title={selectedAtivs.includes(at.id) ? "Remover do Compartilhamento Geral" : "Selecionar para Compartilhamento Geral"}
                              onClick={() => toggleAtividadeSelecao(at.id)}
                              style={{ 
                                background: selectedAtivs.includes(at.id) ? '#dcfce7' : 'rgba(255,255,255,0.7)', 
                                border: 'none', 
                                borderRadius: '4px', 
                                width: '18px', 
                                height: '18px', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                cursor: 'pointer', 
                                padding: 0,
                                color: selectedAtivs.includes(at.id) ? '#166534' : colors.text,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <i className={selectedAtivs.includes(at.id) ? "ti ti-checkbox" : "ti ti-link"} style={{ fontSize: '11px' }}></i>
                            </button>
                          </div>
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
                  const isFail = mediaNum !== null && mediaNum < 7.0;

                  return (
                    <tr key={aluno.id} className="table-row-hover">
                      <td 
                        onClick={(e) => {
                          if (aluno.especificidade) {
                            e.stopPropagation();
                            alert(`Informações de Acessibilidade/Especificidade de ${aluno.nome}:\n\n- ${aluno.especificidade}`);
                          }
                        }}
                        style={{ 
                          padding: '10px', 
                          fontWeight: 700, 
                          color: aluno.especificidade ? '#1e40af' : 'var(--text-main)', 
                          cursor: aluno.especificidade ? 'pointer' : 'default',
                          borderBottom: '1px solid var(--border)' 
                        }}
                        title={aluno.especificidade ? "Clique para ver informações pedagógicas especiais deste aluno" : undefined}
                      >
                        {aluno.nome}
                      </td>
                      
                      {qualitativasColapsadas && qualitativas.length > 0 && (
                        <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '75px' }}>
                            {(() => {
                              const mediaQual = obterMediaQualitativa(aluno.id);
                              const notaColors = getNotaCellColors(mediaQual, false);
                              return (
                                <input 
                                  readOnly
                                  value={mediaQual}
                                  title="Média das notas qualitativas (leitura apenas)"
                                  style={{ 
                                    width: '100%', 
                                    textAlign: 'center', 
                                    padding: '6px', 
                                    border: `1px solid ${notaColors.border}`,
                                    borderRadius: '8px', 
                                    fontSize: '13px', 
                                    fontWeight: 700,
                                    background: '#f8fafc',
                                    color: notaColors.text,
                                    cursor: 'not-allowed',
                                  }}
                                />
                              );
                            })()}
                          </div>
                        </td>
                      )}

                      {atividadesExibidas.map((at, atIdx) => {
                        const eOcultavel = at.tipo === 'prova' || at.tipo === 'trabalho' || at.tipo === 'pluraal' || at.tipo === 'bonus';
                        const celulaOculta = eOcultavel && notasOcultas;
                        const hojeStr = new Date().toISOString().split('T')[0];
                        const atExpirada = !!(at.dataLimite && hojeStr > at.dataLimite && !at.liberadoVencido);

                        const notaVal = obterNotaValor(aluno.id, at.id);
                        const displayVal = celulaOculta ? '***' : (notaVal === '-1' ? '' : notaVal);
                        const cellKey = `${aluno.id}_${at.id}`;
                        const isSaving = !!savingCells[cellKey];
                        const notaColors = getNotaCellColors(displayVal, celulaOculta);

                        return (
                          <td key={at.id} style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ position: 'relative', display: 'inline-block', width: '75px' }}>
                              {at.tipo === 'qualitativa' ? (
                                <select
                                  id={`input-nota-${alunoIdx}-${atIdx}`}
                                  value={notaVal}
                                  disabled={celulaOculta || atExpirada}
                                  onChange={(e) => {
                                    if (!celulaOculta && !atExpirada) {
                                      salvarNota(aluno.id, at.id, e.target.value);
                                    }
                                  }}
                                  style={{ 
                                    width: '100%', 
                                    textAlign: 'center', 
                                    padding: '6px', 
                                    border: `1px solid ${atExpirada ? 'var(--border)' : (notaVal === 'faltou' ? '#fca5a5' : notaColors.border)}`,
                                    borderRadius: '8px', 
                                    fontSize: '11.5px', 
                                    fontWeight: 700,
                                    background: atExpirada ? '#f1f5f9' : (notaVal === 'faltou' ? '#fee2e2' : (notaVal === '' ? '#fff' : '#dcfce7')),
                                    color: atExpirada ? '#94a3b8' : (notaVal === 'faltou' ? '#991b1b' : (notaVal === '' ? '#64748b' : '#166534')),
                                    cursor: (celulaOculta || atExpirada) ? 'not-allowed' : 'pointer',
                                    transition: 'background 160ms ease, border-color 160ms ease'
                                  }}
                                >
                                  <option value="">—</option>
                                  <option value={String(at.weight || at.peso)}>Sim ({at.peso})</option>
                                  <option value={String((at.weight || at.peso) / 2)}>Parc ({at.peso / 2})</option>
                                  <option value="0">Não (0)</option>
                                  <option value="faltou">Faltou</option>
                                </select>
                              ) : (
                                <input 
                                  key={celulaOculta ? 'oculto' : 'visivel'}
                                  id={`input-nota-${alunoIdx}-${atIdx}`}
                                  defaultValue={displayVal}
                                  disabled={celulaOculta || atExpirada}
                                  onBlur={(e) => {
                                    if (!celulaOculta && !atExpirada) {
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
                                  placeholder={celulaOculta ? 'Oculto' : atExpirada ? '🔒 Expirado' : `0-${obterNotaMaxima(at.tipo)}`}
                                  style={{ 
                                    width: '100%', 
                                    textAlign: 'center', 
                                    padding: '6px', 
                                    border: `1px solid ${atExpirada ? 'var(--border)' : notaColors.border}`,
                                    borderRadius: '8px', 
                                    fontSize: '13px', 
                                    fontWeight: 700,
                                    background: atExpirada ? '#f1f5f9' : notaColors.bg,
                                    color: atExpirada ? '#94a3b8' : notaColors.text,
                                    cursor: (celulaOculta || atExpirada) ? 'not-allowed' : 'text',
                                    transition: 'background 160ms ease, border-color 160ms ease'
                                  }}
                                />
                              )}
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

      {/* BARRA FLUTUANTE DE COMPARTILHAMENTO GERAL */}
      {selectedAtivs.length > 0 && (
        <div 
          style={{ 
            position: 'fixed', 
            bottom: '24px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
            color: '#fff', 
            borderRadius: '16px', 
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px', 
            padding: '12px 24px', 
            zIndex: 8000, 
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-link" style={{ fontSize: '15px' }}></i>
            </div>
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
              <b>{selectedAtivs.length}</b> {selectedAtivs.length === 1 ? 'atividade selecionada' : 'atividades selecionadas'} para compartilhamento
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className="btn pri" 
              onClick={() => setIsShareModalOpen(true)}
              style={{ 
                padding: '6px 14px', 
                fontSize: '12px', 
                fontWeight: 700, 
                borderRadius: '8px',
                background: 'var(--primary)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="ti ti-link"></i> Gerar Link Geral
            </button>
            <button 
              type="button" 
              onClick={() => setSelectedAtivs([])}
              style={{ 
                padding: '6px 12px', 
                fontSize: '12px', 
                fontWeight: 700, 
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer'
              }}
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE COMPARTILHAMENTO DE NOTAS GERAL UNIFICADO */}
      {isShareModalOpen && selectedAtivs.length > 0 && (
        <div 
          id="compartilhar-notas-modal" 
          style={{ 
            display: 'flex', 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15,23,42,.6)', 
            zIndex: 9000, 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1rem', 
            backdropFilter: 'blur(4px)' 
          }}
        >
          <div 
            style={{ 
              background: '#fff', 
              borderRadius: '16px', 
              width: '100%', 
              maxWidth: '560px', 
              boxShadow: 'var(--shadow-lg)', 
              overflow: 'hidden', 
              border: '1px solid var(--border)',
              animation: 'modalFadeIn 0.2s ease-out'
            }}
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, var(--primary), #3b82f6)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="ti ti-link" style={{ fontSize: '20px', color: '#fff' }}></i>
                <div style={{ color: '#fff', fontSize: '14.5px', fontWeight: 800 }}>Link de Lançamento Geral Compartilhado</div>
              </div>
              <button 
                onClick={() => setIsShareModalOpen(false)} 
                style={{ border: 'none', background: 'rgba(255,255,255,.15)', cursor: 'pointer', color: '#fff', fontSize: '16px', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Você reuniu <b>{selectedAtivs.length} atividade(s)</b> de diferentes turmas para compartilhamento de notas unificado. Os professores que acessarem o link poderão alternar entre as turmas e preencher as notas das atividades correspondentes.
              </div>

              {/* Lista de Atividades Selecionadas */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'block' }}>
                  Atividades Incluídas no Link ({selectedAtivs.length})
                </label>

                <div style={{ border: '1px solid var(--border)', borderRadius: '12px', maxHeight: '180px', overflowY: 'auto', padding: '6px', background: '#f8fafc' }}>
                  {selectedAtivs.map(ativId => {
                    const ativ = atividades.find(a => a.id === ativId);
                    if (!ativ) return null;
                    const tur = turmas.find(t => t.id === ativ.turmaId);
                    const mat = materias.find(m => m.id === ativ.materiaId);
                    const colors = badgeColor(ativ.tipo);

                    return (
                      <div 
                        key={ativ.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '10px 12px', 
                          borderRadius: '8px', 
                          background: '#fff', 
                          border: '1px solid var(--border)',
                          marginBottom: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {ativ.nome}
                          </span>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', background: colors.bg, color: colors.text, padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                              {ativ.tipo.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              🏫 {tur ? tur.nome : '—'}
                            </span>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              📖 {mat ? mat.nome : '—'}
                            </span>
                          </div>
                        </div>

                        <button 
                          type="button" 
                          title="Remover do Link" 
                          onClick={() => toggleAtividadeSelecao(ativ.id)}
                          style={{ 
                            border: 'none', 
                            background: 'none', 
                            color: '#ef4444', 
                            cursor: 'pointer', 
                            fontSize: '14px', 
                            padding: '4px 8px' 
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Caixa de Texto do Link */}
              <div style={{ marginTop: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Link Compartilhado Unificado
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={obterLinkCompartilhadoGeral()} 
                    style={{ 
                      flex: 1, 
                      padding: '10px 12px', 
                      borderRadius: '10px', 
                      border: '1px solid var(--border)', 
                      background: '#f8fafc', 
                      fontSize: '12px', 
                      color: 'var(--text-main)', 
                      fontWeight: 600,
                      outline: 'none'
                    }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button 
                    type="button" 
                    className="btn pri" 
                    onClick={copiarLink}
                    style={{ 
                      padding: '0 16px', 
                      height: '38px', 
                      borderRadius: '10px', 
                      fontSize: '12.5px', 
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: copiadoFeedback ? '#10b981' : 'var(--primary)',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <i className={copiadoFeedback ? "ti ti-check" : "ti ti-copy"}></i>
                    {copiadoFeedback ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="ti ti-lock-open"></i> 
                  Este link unificado ignora o login tradicional e dá acesso direto apenas ao lançamento das atividades selecionadas acima.
                </div>
              </div>

              {/* Fechar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => { setSelectedAtivs([]); setIsShareModalOpen(false); }}
                  style={{ 
                    border: 'none', 
                    background: 'none', 
                    color: '#ef4444', 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    fontWeight: 700 
                  }}
                >
                  Limpar Seleção
                </button>
                <button 
                  type="button" 
                  className="btn sec" 
                  onClick={() => setIsShareModalOpen(false)}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '12.5px', 
                    fontWeight: 700, 
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {isApontamentoModalOpen && (
        <ApontamentoSalaModal 
          turmaId={turmaId}
          materiaId={materiaId}
          bimestreId={bimestreId}
          alunos={alunos}
          apontamentos={apontamentos}
          turmas={turmas}
          materias={materias}
          bimestres={bimestres}
          escolas={escolas}
          setSyncStatus={setSyncStatus}
          fecharModal={() => setIsApontamentoModalOpen(false)}
        />
      )}

      {isCriarAtivModalOpen && (
        <CriarAtividadeModal 
          turmaId={turmaId}
          materiaId={materiaId}
          bimestreId={bimestreId}
          turmas={turmas}
          materias={materias}
          bimestres={bimestres}
          fecharModal={() => { setIsCriarAtivModalOpen(false); setAtividadeParaEditar(null); }}
          setSyncStatus={setSyncStatus}
          atividadeEdicao={atividadeParaEditar || undefined}
        />
      )}
    </div>
  );
};

export default NotasPage;
