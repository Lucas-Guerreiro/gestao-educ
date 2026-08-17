import React, { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Materia, Bimestre, Escola, Apontamento } from '@/types';

interface ApontamentoSalaModalProps {
  turmaId: string;
  materiaId: string;
  bimestreId: string;
  alunos: Aluno[];
  apontamentos: Apontamento[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  escolas: Escola[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
  fecharModal: () => void;
}

const ApontamentoSalaModal: React.FC<ApontamentoSalaModalProps> = ({
  turmaId,
  materiaId,
  bimestreId,
  alunos,
  apontamentos,
  turmas,
  materias,
  bimestres,
  escolas: _escolas,
  setSyncStatus,
  fecharModal
}) => {
  const [dataApontamento, setDataApontamento] = useState(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  });

  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  const selectedTurma = useMemo(() => turmas.find(t => t.id === turmaId), [turmas, turmaId]);
  const selectedMateria = useMemo(() => materias.find(m => m.id === materiaId), [materias, materiaId]);
  const selectedBimestre = useMemo(() => bimestres.find(b => b.id === bimestreId), [bimestres, bimestreId]);

  // Filtrar alunos ativos pertencentes à turma selecionada
  const alunosDaTurma = useMemo(() => {
    return alunos.filter(a => String(a.turmaId) === String(turmaId) && a.ativo !== false);
  }, [alunos, turmaId]);

  // Obter registro de apontamento do aluno na data e matéria específicas
  const obterApontamento = (alunoId: string): Apontamento | null => {
    const registro = apontamentos.find(
      ap => 
        ap.alunoId === alunoId && 
        ap.materiaId === materiaId && 
        ap.data === dataApontamento
    );
    return registro || null;
  };

  // Salvar apontamento no Firestore
  const salvarApontamentoCampo = async (
    alunoId: string, 
    campo: 'tarefa' | 'material' | 'comportamento' | 'observacao' | 'presenca', 
    valor: string
  ) => {
    if (!turmaId || !materiaId || !bimestreId || !dataApontamento) return;

    const docId = `${alunoId}_${materiaId}_${dataApontamento}`;
    const rowKey = `${alunoId}_${dataApontamento}`;

    setSavingRows(prev => ({ ...prev, [rowKey]: true }));
    setSyncStatus('saving');

    try {
      const registroExistente = obterApontamento(alunoId);

      const payload: any = {
        alunoId,
        turmaId,
        materiaId,
        bimestreId,
        data: dataApontamento,
        presenca: registroExistente ? registroExistente.presenca || '' : '',
        tarefa: registroExistente ? registroExistente.tarefa || '' : '',
        material: registroExistente ? registroExistente.material || '' : '',
        comportamento: registroExistente ? registroExistente.comportamento || '' : '',
        observacao: registroExistente ? registroExistente.observacao || '' : ''
      };

      // Atualizar o campo específico
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

  // Marcar um campo específico como 'sim', 'nao', 'presente', etc. para todos os alunos em lote
  const marcarTodos = async (campo: 'tarefa' | 'material' | 'presenca', valor: 'sim' | 'nao' | 'presente' | 'falta') => {
    if (!turmaId || !materiaId || !bimestreId || !dataApontamento || alunosDaTurma.length === 0) {
      alert('Certifique-se de preencher todos os filtros e que existam alunos.');
      return;
    }

    if (!confirm(`Deseja definir todos os alunos desta turma como "${valor.toUpperCase()}" para o item "${campo.toUpperCase()}" na data selecionada?`)) {
      return;
    }

    setSyncStatus('saving');
    try {
      for (const aluno of alunosDaTurma) {
        const docId = `${aluno.id}_${materiaId}_${dataApontamento}`;
        const registroExistente = obterApontamento(aluno.id);

        const payload: any = {
          alunoId: aluno.id,
          turmaId,
          materiaId,
          bimestreId,
          data: dataApontamento,
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

  return (
    <div id="apontamento-sala-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 3000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '1020px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexShrink: 0, color: '#fff', background: 'linear-gradient(135deg, var(--dark), var(--dark-hover))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-checklist" style={{ fontSize: '20px' }}></i>
            <div>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>Apontamentos de Sala de Aula</span>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                Turma: {selectedTurma ? selectedTurma.nome : '—'} | Matéria: {selectedMateria ? selectedMateria.nome : '—'} | Bimestre: {selectedBimestre ? selectedBimestre.nome : '—'}
              </div>
            </div>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.2)', cursor: 'pointer', fontSize: '18px', color: '#fff', lineHeight: 1, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Content Form */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div className="f" style={{ margin: 0, minWidth: '180px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800 }}>Data do Apontamento *</label>
              <input 
                type="date" 
                value={dataApontamento} 
                onChange={(e) => setDataApontamento(e.target.value)} 
                required
                style={{ height: '36px', padding: '0 10px', fontSize: '13px' }}
              />
            </div>

            {/* Ações em Lote */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn" 
                onClick={() => marcarTodos('presenca', 'presente')}
                style={{ height: '36px', fontSize: '11.5px', padding: '0 12px', borderColor: '#10b981', color: '#047857', background: '#ecfdf5' }}
              >
                ✓ Presença (Todos)
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={() => marcarTodos('tarefa', 'sim')}
                style={{ height: '36px', fontSize: '11.5px', padding: '0 12px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
              >
                ✓ Sim em Tarefa (Todos)
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={() => marcarTodos('material', 'sim')}
                style={{ height: '36px', fontSize: '11.5px', padding: '0 12px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
              >
                ✓ Sim em Material (Todos)
              </button>
            </div>
          </div>

          {/* Planilha de Lançamento */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 10px', width: '200px', color: 'var(--text-muted)' }}>Nome do Aluno</th>
                  <th style={{ padding: '12px 10px', width: '160px', textAlign: 'center', color: 'var(--text-muted)' }}>Presença</th>
                  <th style={{ padding: '12px 10px', width: '150px', textAlign: 'center', color: 'var(--text-muted)' }}>Fez a Tarefa?</th>
                  <th style={{ padding: '12px 10px', width: '150px', textAlign: 'center', color: 'var(--text-muted)' }}>Trouxe Material?</th>
                  <th style={{ padding: '12px 10px', width: '160px', color: 'var(--text-muted)' }}>Comportamento</th>
                  <th style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>Anotações / Observação</th>
                </tr>
              </thead>
              <tbody>
                {alunosDaTurma.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Nenhum aluno ativo matriculado nesta turma.
                    </td>
                  </tr>
                ) : (
                  alunosDaTurma.map(aluno => {
                    const ap = obterApontamento(aluno.id);
                    const rowKey = `${aluno.id}_${dataApontamento}`;
                    const isSaving = savingRows[rowKey] || false;

                    return (
                      <tr key={aluno.id} style={{ borderBottom: '1px solid var(--border)', opacity: isSaving ? 0.6 : 1, transition: 'opacity 0.25s' }}>
                        
                        {/* Nome do Aluno */}
                        <td 
                          style={{ 
                            padding: '10px', 
                            fontWeight: 700, 
                            color: aluno.especificidade ? '#1e40af' : 'var(--text-main)', 
                            cursor: aluno.especificidade ? 'pointer' : 'default' 
                          }}
                          onClick={() => {
                            if (aluno.especificidade) {
                              alert(`Informações de Acessibilidade/Especificidade de ${aluno.nome}:\n\n- ${aluno.especificidade}`);
                            }
                          }}
                          title={aluno.especificidade ? "Clique para ver a especificidade do aluno" : undefined}
                        >
                          {aluno.nome}
                          {aluno.especificidade && <span style={{ color: '#b45309', fontSize: '8px', marginLeft: '6px', background: '#fffbeb', padding: '1px 4px', borderRadius: '4px', border: '1px solid #fde68a' }}>⚠️ Esp.</span>}
                        </td>

                        {/* Presença */}
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '3px' }}>
                            <button 
                              type="button" 
                              onClick={() => salvarApontamentoCampo(aluno.id, 'presenca', 'presente')}
                              className={`btn ${ap?.presenca === 'presente' ? 'pri' : ''}`}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '10.5px', 
                                height: '24px',
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
                                padding: '4px 8px', 
                                fontSize: '10.5px', 
                                height: '24px',
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
                                padding: '4px 8px', 
                                fontSize: '10.5px', 
                                height: '24px',
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
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '3px' }}>
                            <button 
                              type="button" 
                              onClick={() => salvarApontamentoCampo(aluno.id, 'tarefa', 'sim')}
                              className={`btn ${ap?.tarefa === 'sim' ? 'pri' : ''}`}
                              style={{ padding: '4px 8px', fontSize: '10px', height: '24px' }}
                            >
                              Sim
                            </button>
                            <button 
                              type="button" 
                              onClick={() => salvarApontamentoCampo(aluno.id, 'tarefa', 'nao')}
                              className={`btn ${ap?.tarefa === 'nao' ? 'danger-badge' : ''}`}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                height: '24px',
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
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                height: '24px',
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
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '3px' }}>
                            <button 
                              type="button" 
                              onClick={() => salvarApontamentoCampo(aluno.id, 'material', 'sim')}
                              className={`btn ${ap?.material === 'sim' ? 'pri' : ''}`}
                              style={{ padding: '4px 8px', fontSize: '10px', height: '24px' }}
                            >
                              Sim
                            </button>
                            <button 
                              type="button" 
                              onClick={() => salvarApontamentoCampo(aluno.id, 'material', 'nao')}
                              className={`btn ${ap?.material === 'nao' ? 'danger-badge' : ''}`}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                height: '24px',
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
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                height: '24px',
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
                        <td style={{ padding: '10px' }}>
                          <select 
                            value={ap?.comportamento || ''} 
                            onChange={(e) => salvarApontamentoCampo(aluno.id, 'comportamento', e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '6px', width: '100%', height: '28px' }}
                          >
                            <option value="">— selecione —</option>
                            <option value="excelente">Excelente (+0.2 pts)</option>
                            <option value="bom">Bom (+0.1 pts)</option>
                            <option value="regular">Regular (+0.05 pts)</option>
                            <option value="indisciplinado">Indisciplinado (+0 pts)</option>
                          </select>
                        </td>

                        {/* Observação */}
                        <td style={{ padding: '10px' }}>
                          <input 
                            value={ap?.observacao || ''} 
                            onChange={(e) => salvarApontamentoCampo(aluno.id, 'observacao', e.target.value)}
                            placeholder="Notas pedagógicas ou ocorrências de aula..."
                            style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '6px', width: '100%', height: '28px' }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" className="btn pri" onClick={fecharModal} style={{ padding: '0 16px', height: '36px', fontWeight: 700 }}>
              Fechar e Atualizar Médias
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApontamentoSalaModal;
