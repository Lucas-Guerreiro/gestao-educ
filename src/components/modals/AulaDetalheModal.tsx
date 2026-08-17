import React, { useState, useMemo } from 'react';
import { Aula, Turma, Materia, Capitulo, SequenciaDidatica, ExerciciosIA, Aluno, Apontamento, Bimestre } from '@/types';
import { db } from '../../firebase';
import { doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface AulaDetalheModalProps {
  aula: Aula | null;
  turmas: Turma[];
  materias: Materia[];
  capitulos: Capitulo[];
  sequencias: SequenciaDidatica[];
  exerciciosIA: ExerciciosIA[];
  alunos: Aluno[];
  apontamentos: Apontamento[];
  bimestres: Bimestre[];
  selectedBimestreId: string;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
  fecharModal: () => void;
  onNavegarSeccao?: (seccao: string) => void;
  onEditar?: (aula: Aula) => void;
  onExcluir?: (aulaId: string) => void;
}

const AulaDetalheModal: React.FC<AulaDetalheModalProps> = ({
  aula,
  turmas,
  materias,
  capitulos,
  sequencias,
  exerciciosIA,
  alunos,
  apontamentos,
  bimestres,
  selectedBimestreId,
  setSyncStatus,
  fecharModal,
  onNavegarSeccao,
  onEditar,
  onExcluir,
}) => {
  if (!aula) return null;

  const [alunosSelecionados, setAlunosSelecionados] = useState<string[]>([]);
  const [textoApontamento, setTextoApontamento] = useState('');
  const [salvandoApontamento, setSalvandoApontamento] = useState(false);

  const tur = turmas.find(t => t.id === aula.turmaId);
  const mat = materias.find(m => m.id === aula.materiaId);
  const cap = capitulos.find(c => c.id === aula.capituloId);

  // Alunos ativos pertencentes a esta turma
  const alunosDaTurma = useMemo(() => {
    return alunos.filter(a => a.turmaId === aula.turmaId && a.ativo !== false);
  }, [alunos, aula.turmaId]);

  // Apontamentos já salvos com observações para esta aula (mesma data, turma e matéria)
  const apontamentosDestaAula = useMemo(() => {
    return apontamentos.filter(ap => 
      ap.turmaId === aula.turmaId && 
      ap.materiaId === aula.materiaId && 
      ap.data === aula.data && 
      ap.observacao && 
      ap.observacao.trim() !== ''
    );
  }, [apontamentos, aula]);

  // Procurar se esse capítulo possui exercícios mapeados em alguma Sequência Didática
  const exerciciosVinculados: ExerciciosIA[] = [];
  if (cap) {
    sequencias.forEach(sd => {
      if (sd.turmaId === aula.turmaId && sd.materiaId === aula.materiaId && sd.capitulos) {
        const capSd = sd.capitulos.find(c => c.capituloId === cap.id);
        if (capSd && capSd.exercicios && capSd.exercicios.length > 0) {
          capSd.exercicios.forEach(exId => {
            const ex = exerciciosIA.find(e => e.id === exId);
            if (ex && !exerciciosVinculados.some(e => e.id === ex.id)) {
              exerciciosVinculados.push(ex);
            }
          });
        }
      }
    });
  }

  const formatarDataExibicao = (dataStr: string) => {
    if (!dataStr) return '';
    const partes = dataStr.split('-');
    if (partes.length !== 3) return dataStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const handleSelectAluno = (id: string) => {
    setAlunosSelecionados(prev => 
      prev.includes(id) ? prev.filter(alId => alId !== id) : [...prev, id]
    );
  };

  const toggleSelecionarTodos = () => {
    if (alunosSelecionados.length === alunosDaTurma.length) {
      setAlunosSelecionados([]);
    } else {
      setAlunosSelecionados(alunosDaTurma.map(a => a.id));
    }
  };

  const salvarApontamentos = async () => {
    if (alunosSelecionados.length === 0 || !textoApontamento.trim()) return;
    setSalvandoApontamento(true);
    setSyncStatus('saving');
    try {
      const bId = selectedBimestreId || (bimestres.length > 0 ? bimestres[0].id : '');
      if (!bId) {
        alert("Bimestre não configurado. Por favor, configure um bimestre primeiro.");
        setSyncStatus('err');
        setSalvandoApontamento(false);
        return;
      }

      for (const alId of alunosSelecionados) {
        const docId = `${alId}_${aula.materiaId}_${aula.data}`;
        const apExistente = apontamentos.find(ap => ap.id === docId);

        const payload: any = {
          alunoId: alId,
          turmaId: aula.turmaId,
          materiaId: aula.materiaId,
          bimestreId: bId,
          data: aula.data,
          observacao: textoApontamento.trim()
        };

        if (apExistente) {
          payload.tarefa = apExistente.tarefa || '';
          payload.material = apExistente.material || '';
          payload.comportamento = apExistente.comportamento || '';
        } else {
          payload.tarefa = '';
          payload.material = '';
          payload.comportamento = '';
        }

        await setDoc(doc(db, 'apontamentos', docId), payload);
      }

      setSyncStatus('ok');
      setTextoApontamento('');
      setAlunosSelecionados([]);
    } catch (err: any) {
      setSyncStatus('err');
      alert('Erro ao salvar apontamentos: ' + err.message);
    } finally {
      setSalvandoApontamento(false);
    }
  };

  const deletarApontamento = async (apId: string) => {
    if (!confirm("Deseja realmente excluir este apontamento?")) return;
    setSyncStatus('saving');
    try {
      const apExistente = apontamentos.find(ap => ap.id === apId);
      if (apExistente) {
        const temOutrosDados = apExistente.tarefa || apExistente.material || apExistente.comportamento;
        if (temOutrosDados) {
          await updateDoc(doc(db, 'apontamentos', apId), { observacao: '' });
        } else {
          await deleteDoc(doc(db, 'apontamentos', apId));
        }
      }
      setSyncStatus('ok');
    } catch (err: any) {
      setSyncStatus('err');
      alert('Erro ao excluir apontamento: ' + err.message);
    }
  };

  return (
    <div id="aula-detalhe-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 3000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        
        {/* Header */}
        <div id="ad-header" style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexShrink: 0, color: '#fff', background: 'linear-gradient(135deg, var(--dark), var(--dark-hover))' }}>
          <div style={{ flex: 1 }}>
            {!(aula.turmaId === 'SOP' || aula.turmaId === 'Capela') ? (
              <div className={`ali-badge-tipo tipo-aula-${aula.tipo}`} style={{ marginBottom: '6px' }}>
                {aula.tipo.toUpperCase()}
              </div>
            ) : (
              <div style={{ display: 'inline-block', background: '#d8b4fe', color: '#581c87', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                EVENTO ESPECIAL
              </div>
            )}
            <div id="ad-titulo" style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.3 }}>
              {aula.turmaId === 'SOP' || aula.turmaId === 'Capela' ? aula.turmaId.toUpperCase() : (mat ? mat.nome : 'Matéria Não Vinculada')}
            </div>
            <div id="ad-meta" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span><i className="ti ti-calendar"></i> {formatarDataExibicao(aula.data)}</span>
              <span><i className="ti ti-clock"></i> {aula.horario}</span>
              {!(aula.turmaId === 'SOP' || aula.turmaId === 'Capela') && (
                <span><i className="ti ti-users"></i> Turma: {tur ? tur.nome : '—'}</span>
              )}
            </div>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.2)', cursor: 'pointer', fontSize: '18px', color: '#fff', lineHeight: 1, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        
        {/* Scrollable Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {cap ? (
            <div id="ad-cap" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#1e40af', lineHeight: 1.5 }}>
              <strong>{cap.nome}</strong><br />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cap.descricao || 'Sem descrição.'}</span>
            </div>
          ) : null}

          {aula.descricao ? (
            <div id="ad-desc" style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.6 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>
                📝 Descrição / Conteúdo da Aula
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{aula.descricao}</div>
            </div>
          ) : null}
          
          {exerciciosVinculados.length > 0 ? (
            <div id="ad-exercicios-section">
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-clipboard-list" style={{ fontSize: '14px', color: 'var(--primary)' }}></i> Exercícios da Sequência Didática
              </div>
              <div id="ad-exercicios">
                {exerciciosVinculados.map((ex, idx) => (
                  <div key={ex.id} className="exer-ia-card">
                    <div className="exer-ia-num">{idx + 1}</div>
                    <div className="exer-ia-body">
                      <div className="exer-ia-nome">{ex.nome}</div>
                      <div className="exer-ia-desc">{ex.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !(aula.turmaId === 'SOP' || aula.turmaId === 'Capela') && (
              <div id="ad-sem-atividades" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic' }}>
                Nenhuma atividade programada para esta aula.
              </div>
            )
          )}

          {/* Seção de Apontamentos da Aula */}
          {!(aula.turmaId === 'SOP' || aula.turmaId === 'Capela') && (
            <div id="ad-apontamentos-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-checklist" style={{ fontSize: '14px', color: 'var(--primary)' }}></i> Apontamentos e Ocorrências da Aula
              </div>

              {/* Formulário de Novo Apontamento */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Seleção de Alunos */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 700 }}>Selecionar Aluno(s) *</label>
                    <button 
                      type="button" 
                      onClick={toggleSelecionarTodos}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      {alunosSelecionados.length === alunosDaTurma.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>

                  {/* Caixa de rolagem com alunos */}
                  <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {alunosDaTurma.length === 0 ? (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum aluno ativo nesta turma.</span>
                    ) : (
                      alunosDaTurma.map(aluno => {
                        const isSelected = alunosSelecionados.includes(aluno.id);
                        return (
                          <label key={aluno.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', cursor: 'pointer', color: aluno.especificidade ? '#1e40af' : 'var(--text-main)', fontWeight: aluno.especificidade ? 700 : 500 }} title={aluno.especificidade ? "Aluno com especificidade" : undefined}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectAluno(aluno.id)}
                              style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                            />
                            <span>
                              {aluno.nome}
                              {aluno.especificidade && <span style={{ color: '#b45309', fontSize: '8px', marginLeft: '6px', background: '#fffbeb', padding: '1px 4px', borderRadius: '4px', border: '1px solid #fde68a' }}>⚠️ Esp.</span>}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Texto do Apontamento */}
                <div className="f" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 700 }}>Texto do Apontamento *</label>
                  <textarea 
                    value={textoApontamento}
                    onChange={(e) => setTextoApontamento(e.target.value)}
                    placeholder="Escreva a anotação para os alunos selecionados..."
                    rows={2}
                    style={{ fontSize: '12px', padding: '8px 10px', minHeight: '50px', border: '1px solid var(--border)', borderRadius: '8px', resize: 'vertical' }}
                  />
                </div>

                {/* Botão de Salvar */}
                <button
                  type="button"
                  onClick={salvarApontamentos}
                  disabled={salvandoApontamento || alunosSelecionados.length === 0 || !textoApontamento.trim()}
                  className="btn pri"
                  style={{
                    height: '32px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    width: 'fit-content',
                    alignSelf: 'flex-end',
                    padding: '0 12px'
                  }}
                >
                  {salvandoApontamento ? '⏳ Salvando...' : 'Salvar Apontamento'}
                </button>
              </div>

              {/* Listagem de Apontamentos já salvos nesta aula */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Registros desta Aula ({apontamentosDestaAula.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', border: apontamentosDestaAula.length > 0 ? '1px solid var(--border)' : 'none', borderRadius: '8px', padding: apontamentosDestaAula.length > 0 ? '6px' : 0 }}>
                  {apontamentosDestaAula.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                      Nenhum apontamento registrado para esta aula.
                    </div>
                  ) : (
                    apontamentosDestaAula.map(ap => {
                      const aluno = alunos.find(a => a.id === ap.alunoId);
                      return (
                        <div key={ap.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '11.5px', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <strong style={{ color: 'var(--text-main)' }}>{aluno ? aluno.nome : 'Aluno Desconhecido'}</strong>
                            <button
                              onClick={() => deletarApontamento(ap.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: 700 }}
                              title="Excluir apontamento"
                            >
                              ✕
                            </button>
                          </div>
                          <div style={{ color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'pre-wrap', fontSize: '11px', lineHeight: 1.4 }}>
                            {ap.observacao}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}
          
          {/* Conclusão e Ações de Modificação */}
          <div id="ad-realizada-badge" style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aula.realizada ? (
              <div style={{ background: 'var(--success-light)', color: 'var(--success-text)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-circle-check" style={{ fontSize: '16px' }}></i> Aula ministrada e concluída!
              </div>
            ) : (
              <div style={{ background: 'var(--warning-light)', color: 'var(--warning-text)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-clock" style={{ fontSize: '16px' }}></i> Planejada (ministração pendente)
              </div>
            )}

            <button
              onClick={async () => {
                try {
                  await updateDoc(doc(db, 'aulas', aula.id), { realizada: !aula.realizada });
                } catch (err) {
                  console.error("Erro ao atualizar status de conclusão da aula:", err);
                }
              }}
              style={{
                width: '100%',
                height: '40px',
                background: aula.realizada ? '#f1f5f9' : 'linear-gradient(135deg, #10b981, #059669)',
                border: '1px solid ' + (aula.realizada ? '#cbd5e1' : '#059669'),
                borderRadius: '10px',
                color: aula.realizada ? 'var(--text-main)' : '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <i className={aula.realizada ? "ti ti-arrow-back" : "ti ti-circle-check"}></i>
              {aula.realizada ? "Marcar como Planejada (Desfazer)" : "Marcar como Aula Já Ministrada (Concluída)"}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  if (onNavegarSeccao) {
                    onNavegarSeccao('ativ');
                  }
                  fecharModal();
                }}
                className="btn"
                style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '13px'
                }}
              >
                <i className="ti ti-checklist" style={{ fontSize: '16px' }}></i> Atividades
              </button>
              <button
                onClick={() => {
                  if (onNavegarSeccao) {
                    onNavegarSeccao('lan');
                  }
                  fecharModal();
                }}
                className="btn"
                style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '13px'
                }}
              >
                <i className="ti ti-notes" style={{ fontSize: '16px' }}></i> Lançar Notas
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => {
                  if (onEditar) {
                    onEditar(aula);
                  }
                }}
                className="btn"
                style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '13px'
                }}
              >
                <i className="ti ti-pencil" style={{ fontSize: '16px' }}></i> Editar Aula
              </button>
              <button
                onClick={async () => {
                  if (confirm("Deseja realmente excluir esta aula?")) {
                    if (onExcluir) {
                      onExcluir(aula.id);
                    }
                  }
                }}
                className="btn"
                style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '13px',
                  borderColor: '#fca5a5',
                  color: '#dc2626'
                }}
              >
                <i className="ti ti-trash" style={{ fontSize: '16px' }}></i> Excluir Aula
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AulaDetalheModal;
