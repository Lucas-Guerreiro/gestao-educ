import React, { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Materia, Bimestre, Escola, Apontamento, Professor } from '@/types';

interface ApontamentosPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  escolas: Escola[];
  apontamentos: Apontamento[];
  professores: Professor[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const ApontamentosPage: React.FC<ApontamentosPageProps> = ({
  alunos,
  turmas,
  materias,
  bimestres,
  escolas,
  apontamentos,
  professores,
  setSyncStatus,
}) => {
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [bimestreId, setBimestreId] = useState('');
  const [dataApontamento, setDataApontamento] = useState(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  });

  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  // Handlers com reset de cascata
  const handleTurmaChange = (id: string) => {
    setTurmaId(id);
    setMateriaId('');
    setBimestreId('');
  };

  // Matérias vinculadas à turma através de qualquer professor, com fallback para as matérias da escola da turma
  const materiasDaTurmaEscola = useMemo(() => {
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

  // Filtrar alunos ativos da turma selecionada
  const alunosFiltrados = useMemo(() => {
    return alunos.filter(a => String(a.turmaId) === turmaId && a.ativo !== false);
  }, [alunos, turmaId]);

  // Obter registro de apontamento do aluno na data e matéria específicas
  const obterApontamento = (alunoId: string): Apontamento | null => {
    const registro = apontamentos.find(
      ap => ap.alunoId === alunoId && 
            ap.materiaId === materiaId && 
            ap.data === dataApontamento
    );
    return registro || null;
  };

  // Salvar apontamento no Firestore de forma atômica e determinística
  const salvarApontamentoCampo = async (
    alunoId: string, 
    campo: 'tarefa' | 'material' | 'comportamento' | 'observacao', 
    valor: any
  ) => {
    if (!turmaId || !materiaId || !bimestreId || !dataApontamento) return;

    const docId = `${alunoId}_${materiaId}_${dataApontamento}`;
    const rowKey = `${alunoId}_${dataApontamento}`;

    setSavingRows(prev => ({ ...prev, [rowKey]: true }));
    setSyncStatus('saving');

    try {
      const registroExistente = obterApontamento(alunoId);
      
      const payload: Partial<Apontamento> = {
        alunoId,
        turmaId,
        materiaId,
        bimestreId,
        data: dataApontamento,
        tarefa: registroExistente ? registroExistente.tarefa : '',
        material: registroExistente ? registroExistente.material : '',
        comportamento: registroExistente ? registroExistente.comportamento : '',
        observacao: registroExistente ? registroExistente.observacao : '',
      };

      // Atualizar apenas o campo alterado
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

  // Marcar um campo específico como 'sim' ou 'excelente' para todos os alunos filtrados (apontamento em lote!)
  const marcarLote = async (campo: 'tarefa' | 'material', valor: 'sim' | 'nao') => {
    if (!turmaId || !materiaId || !bimestreId || !dataApontamento || alunosFiltrados.length === 0) {
      alert('Por favor, selecione os filtros e certifique-se de que há alunos ativos na turma.');
      return;
    }

    if (!confirm(`Deseja marcar o status de "${campo.toUpperCase()}" como "${valor.toUpperCase()}" para todos os alunos nesta data?`)) {
      return;
    }

    setSyncStatus('saving');
    try {
      // Executar salvamento para todos em lote
      for (const aluno of alunosFiltrados) {
        const docId = `${aluno.id}_${materiaId}_${dataApontamento}`;
        const registroExistente = obterApontamento(aluno.id);

        const payload = {
          alunoId: aluno.id,
          turmaId,
          materiaId,
          bimestreId,
          data: dataApontamento,
          tarefa: registroExistente ? registroExistente.tarefa : '',
          material: registroExistente ? registroExistente.material : '',
          comportamento: registroExistente ? registroExistente.comportamento : '',
          observacao: registroExistente ? registroExistente.observacao : '',
        };

        payload[campo] = valor;
        await setDoc(doc(db, 'apontamentos', docId), payload);
      }
      setSyncStatus('ok');
      alert(`Status de "${campo.toUpperCase()}" atualizado em lote com sucesso!`);
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao atualizar apontamentos em lote: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Filtros e Seletores de Apontamento */}
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
              Selecione a Disciplina *
              {turmaId && materiasDaTurmaEscola.length === 0 && (
                <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '6px' }}>Nenhuma matéria cadastrada nesta escola</span>
              )}
            </label>
            <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} disabled={!turmaId}>
              <option value="">— selecione —</option>
              {materiasDaTurmaEscola.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div className="f">
            <label>Selecione o Bimestre *</label>
            <select value={bimestreId} onChange={(e) => setBimestreId(e.target.value)} disabled={!materiaId}>
              <option value="">— selecione —</option>
              {bimestres.map(b => (
                <option key={b.id} value={b.id}>{b.nome}{b.ano ? ` (${b.ano})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="f">
            <label>Data do Apontamento *</label>
            <input 
              type="date" 
              value={dataApontamento} 
              onChange={(e) => setDataApontamento(e.target.value)} 
              disabled={!bimestreId}
              style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px' }}
            />
          </div>
        </div>
      </div>

      {/* Planilha de Apontamentos Diários */}
      {!turmaId || !materiaId || !bimestreId || !dataApontamento ? (
        <div className="card-box" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ti ti-info-circle"></i>
            Acompanhamento Diário de Apontamento de Alunos
          </div>
          <div style={{ fontSize: '12.5px', color: '#1e40af', opacity: 0.9, lineHeight: '1.5' }}>
            Selecione a <b>Turma</b>, a <b>Disciplina</b>, o <b>Bimestre</b> e a <b>Data de Aplicação</b> no painel de filtros acima para carregar a planilha diária. Esse painel permite registrar a entrega de tarefas de casa, posse de material escolar e atitudes dos alunos na data selecionada com salvamento em tempo real.
          </div>
        </div>
      ) : alunosFiltrados.length === 0 ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Nenhum aluno ativo cadastrado nesta turma para fazer apontamento.
        </div>
      ) : (
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Cabeçalho de Dica e Atalhos de Lote */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '500px', lineHeight: '1.5' }}>
              💡 <b>Dicas de Lançamento:</b> Clique nos botões para marcar o status de tarefa e material. As observações são salvas automaticamente quando você termina de digitar (perde o foco ou pressiona Enter).
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn" 
                onClick={() => marcarLote('tarefa', 'sim')}
                style={{ fontSize: '11.5px', padding: '6px 12px', borderColor: '#86efac', color: '#166534', background: '#f0fdf4', fontWeight: 700 }}
              >
                <i className="ti ti-checklist"></i> Marcar todas as Tarefas como FEITO
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={() => marcarLote('material', 'sim')}
                style={{ fontSize: '11.5px', padding: '6px 12px', borderColor: '#86efac', color: '#166534', background: '#f0fdf4', fontWeight: 700 }}
              >
                <i className="ti ti-briefcase"></i> Marcar todos os Materiais como COMPLETO
              </button>
            </div>
          </div>

          {/* Grid Planilha de Lançamento */}
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontWeight: 800 }}>
                  <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '180px', position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                    Nome do Aluno
                  </th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '160px', position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                    Tarefa de Casa
                  </th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '160px', position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                    Material Escolar
                  </th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '150px', position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                    Comportamento
                  </th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '220px', position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                    Observações / Ocorrências
                  </th>
                </tr>
              </thead>
              <tbody>
                {alunosFiltrados.map((aluno) => {
                  const ap = obterApontamento(aluno.id);
                  const statusTarefa = ap ? ap.tarefa : '';
                  const statusMaterial = ap ? ap.material : '';
                  const statusComportamento = ap ? ap.comportamento : '';
                  const obsValor = ap ? ap.observacao : '';

                  const rowKey = `${aluno.id}_${dataApontamento}`;
                  const isSaving = !!savingRows[rowKey];

                  return (
                    <tr key={aluno.id} className="table-row-hover">
                      <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{aluno.nome}</span>
                          {isSaving && <span style={{ fontSize: '10px', color: 'var(--primary)' }}>⏳</span>}
                        </div>
                      </td>

                      {/* Botões de Tarefa */}
                      <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'inline-flex', gap: '3px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                          <button
                            type="button"
                            onClick={() => salvarApontamentoCampo(aluno.id, 'tarefa', 'sim')}
                            style={{
                              border: 'none',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: statusTarefa === 'sim' ? '#dcfce7' : 'transparent',
                              color: statusTarefa === 'sim' ? '#15803d' : '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                            title="Tarefa Feita"
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => salvarApontamentoCampo(aluno.id, 'tarefa', 'nao')}
                            style={{
                              border: 'none',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: statusTarefa === 'nao' ? '#fee2e2' : 'transparent',
                              color: statusTarefa === 'nao' ? '#b91c1c' : '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                            title="Tarefa Não Feita"
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={() => salvarApontamentoCampo(aluno.id, 'tarefa', 'parcial')}
                            style={{
                              border: 'none',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: statusTarefa === 'parcial' ? '#fef3c7' : 'transparent',
                              color: statusTarefa === 'parcial' ? '#b45309' : '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                            title="Tarefa Feita Parcialmente"
                          >
                            Parcial
                          </button>
                        </div>
                      </td>

                      {/* Botões de Material */}
                      <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'inline-flex', gap: '3px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                          <button
                            type="button"
                            onClick={() => salvarApontamentoCampo(aluno.id, 'material', 'sim')}
                            style={{
                              border: 'none',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: statusMaterial === 'sim' ? '#dcfce7' : 'transparent',
                              color: statusMaterial === 'sim' ? '#15803d' : '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                            title="Material Completo"
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => salvarApontamentoCampo(aluno.id, 'material', 'nao')}
                            style={{
                              border: 'none',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: statusMaterial === 'nao' ? '#fee2e2' : 'transparent',
                              color: statusMaterial === 'nao' ? '#b91c1c' : '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                            title="Material Incompleto/Esqueceu"
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={() => salvarApontamentoCampo(aluno.id, 'material', 'parcial')}
                            style={{
                              border: 'none',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: statusMaterial === 'parcial' ? '#fef3c7' : 'transparent',
                              color: statusMaterial === 'parcial' ? '#b45309' : '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                            title="Esqueceu item menor"
                          >
                            Parcial
                          </button>
                        </div>
                      </td>

                      {/* Comportamento Seletor */}
                      <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <select
                          value={statusComportamento}
                          onChange={(e) => salvarApontamentoCampo(aluno.id, 'comportamento', e.target.value)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 
                              statusComportamento === 'excelente' ? '#15803d' :
                              statusComportamento === 'bom' ? '#0369a1' :
                              statusComportamento === 'regular' ? '#b45309' :
                              statusComportamento === 'indisciplinado' ? '#b91c1c' : '#64748b',
                            background:
                              statusComportamento === 'excelente' ? '#f0fdf4' :
                              statusComportamento === 'bom' ? '#f0f9ff' :
                              statusComportamento === 'regular' ? '#fffbeb' :
                              statusComportamento === 'indisciplinado' ? '#fef2f2' : '#fff',
                            cursor: 'pointer',
                            outline: 'none',
                            width: '100%'
                          }}
                        >
                          <option value="">— selecione —</option>
                          <option value="excelente">🌟 Excelente</option>
                          <option value="bom">😊 Bom</option>
                          <option value="regular">😐 Regular</option>
                          <option value="indisciplinado">⚠️ Indisciplinado</option>
                        </select>
                      </td>

                      {/* Campo Observação */}
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                        <input
                          type="text"
                          defaultValue={obsValor}
                          placeholder="Ex: Não trouxe o livro, conversando muito..."
                          onBlur={(e) => {
                            if (e.target.value !== obsValor) {
                              salvarApontamentoCampo(aluno.id, 'observacao', e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            outline: 'none',
                            transition: 'border-color 0.15s ease'
                          }}
                        />
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

export default ApontamentosPage;
