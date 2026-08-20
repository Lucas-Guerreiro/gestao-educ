import React, { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aula, Turma, Materia, Capitulo, SequenciaDidatica, ExerciciosIA, Aluno, Apontamento, Bimestre } from '@/types';

interface AulaDetalheModalProps {
  aula: Aula;
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
  onNavegarSeccao?: (seccao: string, turmaId?: string, materiaId?: string) => void;
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
  bimestres: _bimestres,
  selectedBimestreId,
  setSyncStatus,
  fecharModal,
  onNavegarSeccao,
  onEditar,
  onExcluir,
}) => {
  if (!aula) return null;

  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  const tur = turmas.find(t => t.id === aula.turmaId);
  const mat = materias.find(m => m.id === aula.materiaId);
  const cap = capitulos.find(c => c.id === aula.capituloId);

  // Alunos ativos pertencentes a esta turma
  const alunosDaTurma = useMemo(() => {
    return alunos.filter(a => String(a.turmaId) === String(aula.turmaId) && a.ativo !== false);
  }, [alunos, aula.turmaId]);

  const handleLancarNotas = () => {
    if (onNavegarSeccao) {
      onNavegarSeccao('lan', aula.turmaId, aula.materiaId);
      fecharModal();
    }
  };

  // Obter apontamento do aluno nesta data e matéria
  const obterApontamento = (alunoId: string): Apontamento | null => {
    const registro = apontamentos.find(
      ap => 
        ap.alunoId === alunoId && 
        String(ap.materiaId) === String(aula.materiaId) && 
        ap.data === aula.data
    );
    return registro || null;
  };

  // Salvar campo individual de apontamento
  const salvarApontamentoCampo = async (
    alunoId: string, 
    campo: 'tarefa' | 'material' | 'comportamento' | 'observacao' | 'presenca', 
    valor: string
  ) => {
    if (!aula.turmaId || !aula.materiaId || !selectedBimestreId || !aula.data) return;

    const docId = `${alunoId}_${aula.materiaId}_${aula.data}`;
    const rowKey = `${alunoId}_${aula.data}`;

    setSavingRows(prev => ({ ...prev, [rowKey]: true }));
    setSyncStatus('saving');

    try {
      const registroExistente = obterApontamento(alunoId);

      const payload: any = {
        alunoId,
        turmaId: aula.turmaId,
        materiaId: aula.materiaId,
        bimestreId: selectedBimestreId,
        data: aula.data,
        presenca: registroExistente ? registroExistente.presenca || '' : '',
        tarefa: registroExistente ? registroExistente.tarefa || '' : '',
        material: registroExistente ? registroExistente.material || '' : '',
        comportamento: registroExistente ? registroExistente.comportamento || '' : '',
        observacao: registroExistente ? registroExistente.observacao || '' : ''
      };

      payload[campo] = valor;

      await setDoc(doc(db, 'apontamentos', docId), payload);
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      console.error('Erro ao salvar apontamento:', err);
    } finally {
      setSavingRows(prev => ({ ...prev, [rowKey]: false }));
    }
  };

  // Lançamento em lote no modal de aula
  const marcarTodos = async (campo: 'tarefa' | 'material' | 'presenca', valor: 'sim' | 'nao' | 'presente' | 'falta') => {
    if (!aula.turmaId || !aula.materiaId || !selectedBimestreId || !aula.data || alunosDaTurma.length === 0) {
      alert('Incapaz de atualizar apontamentos em lote.');
      return;
    }

    if (!confirm(`Deseja marcar todos como "${valor.toUpperCase()}" para o item "${campo.toUpperCase()}" nesta aula?`)) {
      return;
    }

    setSyncStatus('saving');
    try {
      for (const aluno of alunosDaTurma) {
        const docId = `${aluno.id}_${aula.materiaId}_${aula.data}`;
        const registroExistente = obterApontamento(aluno.id);

        const payload: any = {
          alunoId: aluno.id,
          turmaId: aula.turmaId,
          materiaId: aula.materiaId,
          bimestreId: selectedBimestreId,
          data: aula.data,
          presenca: registroExistente ? registroExistente.presenca || '' : '',
          tarefa: registroExistente ? registroExistente.tarefa || '' : '',
          material: registroExistente ? registroExistente.material || '' : '',
          comportamento: registroExistente ? registroExistente.comportamento || '' : '',
          observacao: registroExistente ? registroExistente.observacao || '' : ''
        };

        payload[campo] = valor;

        await setDoc(doc(db, 'apontamentos', docId), payload);
      }
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao atualizar apontamentos em lote: ' + (err as Error).message);
    }
  };

  // Procurar se esse capítulo possui exercícios mapeados em alguma Sequência Didática
  const exerciciosVinculados: ExerciciosIA[] = [];
  if (cap) {
    sequencias.forEach(sd => {
      if (String(sd.turmaId) === String(aula.turmaId) && String(sd.materiaId) === String(aula.materiaId) && sd.capitulos) {
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

  const isEspecial = aula.turmaId === 'SOP' || aula.turmaId === 'Capela';

  return (
    <div id="aula-detalhe-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 3000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: isEspecial ? '520px' : '960px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        
        {/* Header */}
        <div id="ad-header" style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexShrink: 0, color: '#fff', background: 'linear-gradient(135deg, var(--dark), var(--dark-hover))' }}>
          <div style={{ flex: 1 }}>
            {!isEspecial ? (
              <div className={`ali-badge-tipo tipo-aula-${aula.tipo}`} style={{ marginBottom: '6px' }}>
                {aula.tipo.toUpperCase()}
              </div>
            ) : (
              <div style={{ display: 'inline-block', background: '#d8b4fe', color: '#581c87', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                EVENTO ESPECIAL
              </div>
            )}
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ti ti-calendar-event"></i> Detalhes do Agendamento
            </h3>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.2)', cursor: 'pointer', fontSize: '18px', color: '#fff', lineHeight: 1, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Informações da Aula */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Data</span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {formatarDataExibicao(aula.data)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Horário / Aula</span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {aula.horario}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Turma</span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {isEspecial ? 'GERAL' : (tur ? tur.nome : '—')}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Matéria / Componente</span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {isEspecial ? aula.turmaId.toUpperCase() : (mat ? mat.nome : '—')}
              </div>
            </div>
          </div>

          {/* Capítulo da Aula */}
          {!isEspecial && (
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Capítulo Associado</span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px', background: '#fff', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px' }}>
                {cap ? cap.nome : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 500 }}>Nenhum capítulo atrelado</span>}
              </div>
            </div>
          )}

          {/* Atividades Programadas */}
          {exerciciosVinculados.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-checklist" style={{ fontSize: '14px', color: 'var(--primary)' }}></i> Atividades da Aula
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                {exerciciosVinculados.map((ex, idx) => (
                  <div key={ex.id} className="exer-ia-card" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: '#f8fafc', fontSize: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ background: 'var(--primary)', color: '#fff', borderRadius: '4px', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-main)', display: 'block' }}>{ex.nome}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{ex.desc}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !isEspecial && (
              <div id="ad-sem-atividades" style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                Nenhuma atividade programada para esta aula.
              </div>
            )
          )}

          {/* PLANILHA COMPLETA DE APONTAMENTOS DE SALA DE AULA */}
          {!isEspecial && (
            <div id="ad-planilha-apontamentos" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Cabeçalho da planilha + botões de lote */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ti ti-users" style={{ fontSize: '14px', color: 'var(--primary)' }}></i> Apontamentos e Chamada Diária
                </div>
                
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => marcarTodos('presenca', 'presente')}
                    style={{ height: '28px', fontSize: '10.5px', padding: '0 8px', borderColor: '#10b981', color: '#047857', background: '#ecfdf5', fontWeight: 700 }}
                  >
                    ✓ Presença (Todos)
                  </button>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => marcarTodos('tarefa', 'sim')}
                    style={{ height: '28px', fontSize: '10.5px', padding: '0 8px', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 700 }}
                  >
                    ✓ Tarefa OK (Todos)
                  </button>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => marcarTodos('material', 'sim')}
                    style={{ height: '28px', fontSize: '10.5px', padding: '0 8px', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 700 }}
                  >
                    ✓ Material OK (Todos)
                  </button>
                </div>
              </div>

              {/* Tabela de Lançamento */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px', width: '180px' }}>Aluno</th>
                      <th style={{ padding: '10px', width: '150px', textAlign: 'center' }}>Presença</th>
                      <th style={{ padding: '10px', width: '140px', textAlign: 'center' }}>Tarefa de Casa</th>
                      <th style={{ padding: '10px', width: '140px', textAlign: 'center' }}>Material Escolar</th>
                      <th style={{ padding: '10px', width: '150px' }}>Comportamento</th>
                      <th style={{ padding: '10px' }}>Anotação / Ocorrência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alunosDaTurma.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Nenhum aluno ativo matriculado nesta turma.
                        </td>
                      </tr>
                    ) : (
                      alunosDaTurma.map(aluno => {
                        const ap = obterApontamento(aluno.id);
                        const rowKey = `${aluno.id}_${aula.data}`;
                        const isSaving = savingRows[rowKey] || false;

                        return (
                          <tr key={aluno.id} style={{ borderBottom: '1px solid var(--border)', opacity: isSaving ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                            {/* Nome do Aluno */}
                            <td 
                              style={{ 
                                padding: '8px 10px', 
                                fontWeight: 700, 
                                color: aluno.especificidade ? '#1e40af' : 'var(--text-main)', 
                                cursor: aluno.especificidade ? 'pointer' : 'default' 
                              }}
                              onClick={() => {
                                if (aluno.especificidade) {
                                  alert(`Especificidade de ${aluno.nome}:\n\n- ${aluno.especificidade}`);
                                }
                              }}
                              title={aluno.especificidade ? "Clique para ver a especificidade do aluno" : undefined}
                            >
                              {aluno.nome}
                              {aluno.especificidade && <span style={{ color: '#b45309', fontSize: '8px', marginLeft: '6px', background: '#fffbeb', padding: '1px 4px', borderRadius: '4px', border: '1px solid #fde68a' }}>⚠️ Esp.</span>}
                            </td>

                            {/* Presença */}
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '3px' }}>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'presenca', 'presente')}
                                  className={`btn ${ap?.presenca === 'presente' ? 'pri' : ''}`}
                                  style={{ 
                                    padding: '3px 6px', 
                                    fontSize: '9.5px', 
                                    height: '22px',
                                    background: ap?.presenca === 'presente' ? 'var(--success)' : '#fff',
                                    color: ap?.presenca === 'presente' ? '#fff' : 'var(--text-main)',
                                    border: ap?.presenca === 'presente' ? '1px solid var(--success)' : '1px solid var(--border)'
                                  }}
                                >
                                  Pres.
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'presenca', 'falta')}
                                  className={`btn ${ap?.presenca === 'falta' ? 'danger-badge' : ''}`}
                                  style={{ 
                                    padding: '3px 6px', 
                                    fontSize: '9.5px', 
                                    height: '22px',
                                    background: ap?.presenca === 'falta' ? '#fee2e2' : '#fff',
                                    color: ap?.presenca === 'falta' ? '#ef4444' : 'var(--text-main)',
                                    border: ap?.presenca === 'falta' ? '1px solid #fca5a5' : '1px solid var(--border)'
                                  }}
                                >
                                  Falta
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'presenca', 'justificada')}
                                  className={`btn ${ap?.presenca === 'justificada' ? 'warning-badge' : ''}`}
                                  style={{ 
                                    padding: '3px 6px', 
                                    fontSize: '9.5px', 
                                    height: '22px',
                                    background: ap?.presenca === 'justificada' ? '#fef3c7' : '#fff',
                                    color: ap?.presenca === 'justificada' ? '#d97706' : 'var(--text-main)',
                                    border: ap?.presenca === 'justificada' ? '1px solid #fde68a' : '1px solid var(--border)'
                                  }}
                                >
                                  Just.
                                </button>
                              </div>
                            </td>

                            {/* Tarefa */}
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '3px' }}>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'tarefa', 'sim')}
                                  className={`btn ${ap?.tarefa === 'sim' ? 'pri' : ''}`}
                                  style={{ padding: '3px 6px', fontSize: '9.5px', height: '22px' }}
                                >
                                  Sim
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'tarefa', 'nao')}
                                  className={`btn ${ap?.tarefa === 'nao' ? 'danger-badge' : ''}`}
                                  style={{ 
                                    padding: '3px 6px', 
                                    fontSize: '9.5px', 
                                    height: '22px',
                                    background: ap?.tarefa === 'nao' ? '#fee2e2' : '#fff',
                                    color: ap?.tarefa === 'nao' ? '#ef4444' : 'var(--text-main)',
                                    border: ap?.tarefa === 'nao' ? '1px solid #fca5a5' : '1px solid var(--border)'
                                  }}
                                >
                                  Não
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'tarefa', 'parcial')}
                                  className={`btn ${ap?.tarefa === 'parcial' ? 'warning-badge' : ''}`}
                                  style={{ 
                                    padding: '3px 6px', 
                                    fontSize: '9.5px', 
                                    height: '22px',
                                    background: ap?.tarefa === 'parcial' ? '#fef3c7' : '#fff',
                                    color: ap?.tarefa === 'parcial' ? '#d97706' : 'var(--text-main)',
                                    border: ap?.tarefa === 'parcial' ? '1px solid #fde68a' : '1px solid var(--border)'
                                  }}
                                >
                                  Parc.
                                </button>
                              </div>
                            </td>

                            {/* Material */}
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '3px' }}>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'material', 'sim')}
                                  className={`btn ${ap?.material === 'sim' ? 'pri' : ''}`}
                                  style={{ padding: '3px 6px', fontSize: '9.5px', height: '22px' }}
                                >
                                  Sim
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'material', 'nao')}
                                  className={`btn ${ap?.material === 'nao' ? 'danger-badge' : ''}`}
                                  style={{ 
                                    padding: '3px 6px', 
                                    fontSize: '9.5px', 
                                    height: '22px',
                                    background: ap?.material === 'nao' ? '#fee2e2' : '#fff',
                                    color: ap?.material === 'nao' ? '#ef4444' : 'var(--text-main)',
                                    border: ap?.material === 'nao' ? '1px solid #fca5a5' : '1px solid var(--border)'
                                  }}
                                >
                                  Não
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => salvarApontamentoCampo(aluno.id, 'material', 'parcial')}
                                  className={`btn ${ap?.material === 'parcial' ? 'warning-badge' : ''}`}
                                  style={{ 
                                    padding: '3px 6px', 
                                    fontSize: '9.5px', 
                                    height: '22px',
                                    background: ap?.material === 'parcial' ? '#fef3c7' : '#fff',
                                    color: ap?.material === 'parcial' ? '#d97706' : 'var(--text-main)',
                                    border: ap?.material === 'parcial' ? '1px solid #fde68a' : '1px solid var(--border)'
                                  }}
                                >
                                  Parc.
                                </button>
                              </div>
                            </td>

                            {/* Comportamento */}
                            <td style={{ padding: '6px 10px' }}>
                              <select 
                                value={ap?.comportamento || ''} 
                                onChange={(e) => salvarApontamentoCampo(aluno.id, 'comportamento', e.target.value)}
                                style={{ padding: '3px 6px', fontSize: '11.5px', border: '1px solid var(--border)', borderRadius: '6px', width: '100%', height: '24px' }}
                              >
                                <option value="">— selecione —</option>
                                <option value="excelente">Excelente (+0.2)</option>
                                <option value="bom">Bom (+0.1)</option>
                                <option value="regular">Regular (+0.05)</option>
                                <option value="indisciplinado">Indisciplinado (+0)</option>
                              </select>
                            </td>

                            {/* Observação */}
                            <td style={{ padding: '6px 10px' }}>
                              <input 
                                defaultValue={ap?.observacao || ''} 
                                onBlur={(e) => {
                                  if (e.target.value !== (ap?.observacao || '')) {
                                    salvarApontamentoCampo(aluno.id, 'observacao', e.target.value);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                placeholder="Observação pedagógica..."
                                style={{ padding: '3px 6px', fontSize: '11.5px', border: '1px solid var(--border)', borderRadius: '6px', width: '100%', height: '24px' }}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div id="ad-footer" style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {aula.tipo === 'avaliacao' && (
              <button 
                onClick={handleLancarNotas}
                className="btn pri"
                style={{ height: '32px', fontSize: '12px', fontWeight: 700, background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="ti ti-notes"></i> Lançar Notas
              </button>
            )}
            {onEditar && (
              <button 
                onClick={() => onEditar(aula)}
                className="btn"
                style={{ height: '32px', fontSize: '12px', fontWeight: 700, borderColor: 'var(--primary)', color: 'var(--primary)' }}
              >
                <i className="ti ti-edit"></i> Editar Aula
              </button>
            )}
            {onExcluir && (
              <button 
                onClick={() => {
                  if (confirm('Deseja realmente excluir este agendamento?')) {
                    onExcluir(aula.id);
                  }
                }}
                className="btn text-danger"
                style={{ height: '32px', fontSize: '12px', fontWeight: 700, borderColor: '#fca5a5' }}
              >
                <i className="ti ti-trash"></i> Excluir Aula
              </button>
            )}
          </div>
          <button onClick={fecharModal} className="btn pri" style={{ height: '32px', fontSize: '12px', fontWeight: 700, padding: '0 16px' }}>
            Fechar e Salvar
          </button>
        </div>

      </div>
    </div>
  );
};

export default AulaDetalheModal;
