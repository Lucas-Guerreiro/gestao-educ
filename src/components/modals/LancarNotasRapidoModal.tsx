import React, { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota } from '@/types';

interface LancarNotasRapidoModalProps {
  turmaId: string;
  materiaId: string;
  bimestreId: string;
  alunos: Aluno[];
  atividades: Atividade[];
  notas: Nota[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
  fecharModal: () => void;
}

const LancarNotasRapidoModal: React.FC<LancarNotasRapidoModalProps> = ({
  turmaId,
  materiaId,
  bimestreId,
  alunos,
  atividades,
  notas,
  turmas,
  materias,
  bimestres,
  setSyncStatus,
  fecharModal
}) => {
  const [selectedAtividadeId, setSelectedAtividadeId] = useState('');
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  // Estados para criação de atividade rápida
  const [isCriandoAtividade, setIsCriandoAtividade] = useState(false);
  const [nomeNovaAtiv, setNomeNovaAtiv] = useState('');
  const [tipoNovaAtiv, setTipoNovaAtiv] = useState<'trabalho' | 'pluraal' | 'prova'>('trabalho');
  const [salvandoAtividade, setSalvandoAtividade] = useState(false);

  const selectedTurma = useMemo(() => turmas.find(t => t.id === turmaId), [turmas, turmaId]);
  const selectedMateria = useMemo(() => materias.find(m => m.id === materiaId), [materias, materiaId]);
  const selectedBimestre = useMemo(() => bimestres.find(b => b.id === bimestreId), [bimestres, bimestreId]);

  // Alunos ativos na turma
  const alunosDaTurma = useMemo(() => {
    return alunos.filter(a => String(a.turmaId) === String(turmaId) && a.ativo !== false);
  }, [alunos, turmaId]);

  // Atividades cadastradas para esta turma, matéria e bimestre
  const atividadesFiltradas = useMemo(() => {
    return atividades.filter(
      a => 
        String(a.turmaId) === String(turmaId) && 
        String(a.materiaId) === String(materiaId) && 
        String(a.bimestreId) === String(bimestreId)
    );
  }, [atividades, turmaId, materiaId, bimestreId]);

  // Auto-selecionar atividade se houver apenas uma
  useMemo(() => {
    if (atividadesFiltradas.length === 1 && !selectedAtividadeId) {
      setSelectedAtividadeId(atividadesFiltradas[0].id);
    }
  }, [atividadesFiltradas, selectedAtividadeId]);

  // Obter nota do aluno para a atividade selecionada
  const obterNotaAluno = (alunoId: string): string => {
    if (!selectedAtividadeId) return '';
    const registro = notas.find(n => n.alunoId === alunoId && n.atividadeId === selectedAtividadeId);
    return registro ? String(registro.nota) : '';
  };

  // Salvar nota no Firestore
  const salvarNota = async (alunoId: string, valorStr: string) => {
    if (!selectedAtividadeId || !turmaId || !materiaId || !bimestreId) return;

    const valorLimpo = valorStr.replace(',', '.');
    if (valorLimpo === '') {
      // Opcional: deletar se nota for limpa
      return;
    }

    const notaNum = Number(valorLimpo);
    if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) {
      alert("Por favor, digite uma nota válida entre 0.0 e 10.0");
      return;
    }

    const docId = `${alunoId}_${selectedAtividadeId}`;
    const rowKey = `${alunoId}_${selectedAtividadeId}`;

    setSavingRows(prev => ({ ...prev, [rowKey]: true }));
    setSyncStatus('saving');

    try {
      const payload: Nota = {
        alunoId,
        atividadeId: selectedAtividadeId,
        turmaId,
        materiaId,
        bimestreId,
        nota: notaNum
      };

      await setDoc(doc(db, 'notas', docId), payload);
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      console.error('Erro ao salvar nota:', err);
    } finally {
      setSavingRows(prev => ({ ...prev, [rowKey]: false }));
    }
  };

  // Criar uma nova atividade rápida no Firestore
  const criarAtividadeRapida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaAtiv.trim() || !turmaId || !materiaId || !bimestreId) return;

    setSalvandoAtividade(true);
    setSyncStatus('saving');
    try {
      const novaAtivId = `ativ_${Date.now()}`;
      const payload: Atividade = {
        id: novaAtivId,
        nome: nomeNovaAtiv.trim(),
        tipo: tipoNovaAtiv,
        turmaId,
        materiaId,
        bimestreId,
        peso: 1
      };

      await setDoc(doc(db, 'atividades', novaAtivId), payload);
      setSyncStatus('ok');
      setSelectedAtividadeId(novaAtivId);
      setNomeNovaAtiv('');
      setIsCriandoAtividade(false);
    } catch (err: any) {
      setSyncStatus('err');
      alert('Erro ao criar atividade: ' + err.message);
    } finally {
      setSalvandoAtividade(false);
    }
  };

  return (
    <div id="lancar-notas-rapido-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 3000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '640px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexShrink: 0, color: '#fff', background: 'linear-gradient(135deg, var(--dark), var(--dark-hover))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-notes" style={{ fontSize: '20px' }}></i>
            <div>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>Lançamento Rápido de Notas</span>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                Turma: {selectedTurma ? selectedTurma.nome : '—'} | Matéria: {selectedMateria ? selectedMateria.nome : '—'} | Bimestre: {selectedBimestre ? selectedBimestre.nome : '—'}
              </div>
            </div>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.2)', cursor: 'pointer', fontSize: '18px', color: '#fff', lineHeight: 1, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Content Form */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Seletor de Atividade ou Modo de Criação */}
          {!isCriandoAtividade ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div className="f" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800 }}>Selecione a Atividade *</label>
                <select 
                  value={selectedAtividadeId} 
                  onChange={(e) => setSelectedAtividadeId(e.target.value)}
                  style={{ height: '36px', padding: '0 10px', fontSize: '13px' }}
                >
                  <option value="">— selecione a atividade —</option>
                  {atividadesFiltradas.map(at => (
                    <option key={at.id} value={at.id}>{at.nome} ({at.tipo.toUpperCase()})</option>
                  ))}
                </select>
              </div>
              <button 
                type="button" 
                className="btn" 
                onClick={() => setIsCriandoAtividade(true)}
                style={{ height: '36px', fontSize: '12px', fontWeight: 700, borderColor: 'var(--primary)', color: 'var(--primary)' }}
              >
                + Nova Atividade
              </button>
            </div>
          ) : (
            <form onSubmit={criarAtividadeRapida} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#eff6ff', padding: '14px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e40af', marginBottom: '4px' }}>
                Criar Nova Atividade Rápida
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="f" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 800 }}>Nome da Atividade *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Prova Mensal"
                    value={nomeNovaAtiv}
                    onChange={(e) => setNomeNovaAtiv(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 10px', fontSize: '12.5px' }}
                  />
                </div>
                <div className="f" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 800 }}>Tipo da Atividade *</label>
                  <select 
                    value={tipoNovaAtiv}
                    onChange={(e) => setTipoNovaAtiv(e.target.value as any)}
                    style={{ height: '32px', padding: '0 6px', fontSize: '12px' }}
                  >
                    <option value="trabalho">Trabalho (Nota 1)</option>
                    <option value="pluraal">Pluraal (Nota 2)</option>
                    <option value="prova">Prova/Qualitativa (Nota 3)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" className="btn" onClick={() => setIsCriandoAtividade(false)} style={{ height: '30px', fontSize: '11px', padding: '0 10px' }}>Cancelar</button>
                <button type="submit" className="btn pri" disabled={salvandoAtividade || !nomeNovaAtiv.trim()} style={{ height: '30px', fontSize: '11px', padding: '0 12px' }}>
                  {salvandoAtividade ? 'Criando...' : 'Salvar e Selecionar'}
                </button>
              </div>
            </form>
          )}

          {/* Listagem de Alunos e Notas */}
          {selectedAtividadeId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                💡 <b>Dica:</b> Insira as notas de 0 a 10. A nota será salva no banco assim que você mudar de campo ou pressionar Enter.
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Aluno</th>
                      <th style={{ padding: '10px 12px', width: '140px', textAlign: 'center', color: 'var(--text-muted)' }}>Nota (0.0 a 10.0)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alunosDaTurma.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Nenhum aluno cadastrado nesta turma.
                        </td>
                      </tr>
                    ) : (
                      alunosDaTurma.map(aluno => {
                        const notaVal = obterNotaAluno(aluno.id);
                        const rowKey = `${aluno.id}_${selectedAtividadeId}`;
                        const isSaving = savingRows[rowKey] || false;

                        return (
                          <tr key={aluno.id} style={{ borderBottom: '1px solid var(--border)', opacity: isSaving ? 0.6 : 1, transition: 'opacity 0.25s' }}>
                            <td 
                              style={{ 
                                padding: '8px 12px', 
                                fontWeight: 700, 
                                color: aluno.especificidade ? '#1e40af' : 'var(--text-main)',
                                cursor: aluno.especificidade ? 'pointer' : 'default'
                              }}
                              onClick={() => {
                                if (aluno.especificidade) {
                                  alert(`Especificidade de ${aluno.nome}:\n\n- ${aluno.especificidade}`);
                                }
                              }}
                            >
                              {aluno.nome}
                              {aluno.especificidade && <span style={{ color: '#b45309', fontSize: '8px', marginLeft: '6px', background: '#fffbeb', padding: '1px 4px', borderRadius: '4px', border: '1px solid #fde68a' }}>⚠️ Esp.</span>}
                              {isSaving && <span style={{ fontSize: '10px', marginLeft: '6px' }}>⏳ saving...</span>}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <input 
                                type="text"
                                defaultValue={notaVal}
                                key={notaVal} // Forçar recriação de valor ao trocar atividade
                                placeholder="0.0"
                                onBlur={(e) => {
                                  if (e.target.value !== notaVal) {
                                    salvarNota(aluno.id, e.target.value);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                style={{ 
                                  width: '80px', 
                                  height: '28px', 
                                  textAlign: 'center', 
                                  fontSize: '13px', 
                                  fontWeight: 700, 
                                  border: '1px solid var(--border)', 
                                  borderRadius: '6px',
                                  outline: 'none',
                                  background: notaVal !== '' ? '#eff6ff' : '#fff',
                                  borderColor: notaVal !== '' ? '#3b82f6' : 'var(--border)'
                                }}
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
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fafafa', borderRadius: '12px', border: '1px dashed var(--border)' }}>
              Selecione uma atividade acima ou crie uma nova para liberar o lançamento de notas.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" className="btn pri" onClick={fecharModal} style={{ padding: '0 16px', height: '36px', fontWeight: 700 }}>
              Fechar e Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LancarNotasRapidoModal;
