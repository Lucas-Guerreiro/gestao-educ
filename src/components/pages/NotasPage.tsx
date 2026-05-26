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

    // 1. Trabalho (máx. 6)
    const trabalhos = atividadesFiltradas.filter(at => at.tipo === 'trabalho');
    let notaTrabalho = 0;
    if (trabalhos.length > 0) {
      let soma = 0;
      trabalhos.forEach(at => {
        const notaStr = obterNotaValor(alunoId, at.id);
        if (notaStr !== '' && Number(notaStr) >= 0) {
          soma += Number(notaStr);
        }
      });
      notaTrabalho = soma / trabalhos.length;
    }

    // 2. PLURAAL (máx. 1)
    const pluraals = atividadesFiltradas.filter(at => at.tipo === 'pluraal');
    let notaPluraal = 0;
    if (pluraals.length > 0) {
      let soma = 0;
      pluraals.forEach(at => {
        const notaStr = obterNotaValor(alunoId, at.id);
        if (notaStr !== '' && Number(notaStr) >= 0) {
          soma += Number(notaStr);
        }
      });
      notaPluraal = soma / pluraals.length;
    }

    // 3. Qualitativa (máx. 3)
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
            <b>Dica de Lançamento:</b> Digite a nota na célula correspondente e pressione <b>Enter</b> ou clique fora (Tab) para salvar instantaneamente no banco de dados. As notas possuem limite máximo de acordo com o tipo: Trabalho (até 6), PLURAAL (até 1) e Qualitativa (até 3).
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 }}>
                <th style={{ padding: '10px', textAlign: 'left', minWidth: '200px' }}>Aluno</th>
                {atividadesFiltradas.map(at => (
                  <th key={at.id} style={{ padding: '10px', textAlign: 'center', width: '120px' }}>
                    <div style={{ color: 'var(--text-main)', fontWeight: 700 }}>{at.nome}</div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {at.tipo.toUpperCase()} (máx. {obterNotaMaxima(at.tipo)})
                    </span>
                  </th>
                ))}
                <th style={{ padding: '10px', textAlign: 'center', width: '120px', background: '#fafafa' }}>
                  Média Bimestral
                </th>
              </tr>
            </thead>
            <tbody>
              {alunosFiltrados.map(aluno => {
                const media = calcularMediaAluno(aluno.id);
                const mediaNum = media !== '—' ? Number(media) : null;
                const isFail = mediaNum !== null && mediaNum < 6.0;

                return (
                  <tr key={aluno.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                    <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-main)' }}>{aluno.nome}</td>
                    
                    {atividadesFiltradas.map(at => {
                      const notaVal = obterNotaValor(aluno.id, at.id);
                      const displayVal = notaVal === '-1' ? '' : notaVal;
                      const cellKey = `${aluno.id}_${at.id}`;
                      const isSaving = !!savingCells[cellKey];

                      return (
                        <td key={at.id} style={{ padding: '6px', textAlign: 'center' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '75px' }}>
                            <input 
                              defaultValue={displayVal}
                              onBlur={(e) => salvarNota(aluno.id, at.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              placeholder={`0-${obterNotaMaxima(at.tipo)}`}
                              style={{ 
                                width: '100%', 
                                textAlign: 'center', 
                                padding: '6px', 
                                border: '1px solid var(--border)', 
                                borderRadius: '8px', 
                                fontSize: '13px', 
                                fontWeight: 700,
                                background: isSaving ? '#f1f5f9' : '#fff',
                                color: isSaving ? '#94a3b8' : 'var(--text-main)'
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
