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
  const alunosFiltrados = alunos.filter(a => a.turmaId === turmaId && a.ativo !== false);

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

  // Salvar nota no Firestore com ID determinístico
  const salvarNota = async (alunoId: string, atividadeId: string, valorStr: string) => {
    if (!turmaId || !materiaId || !bimestreId) return;
    
    const valor = valorStr.trim() === '' ? null : Number(valorStr.replace(',', '.'));
    if (valor !== null && (isNaN(valor) || valor < 0 || valor > 10)) {
      alert('Por favor, informe uma nota válida entre 0 e 10.');
      return;
    }

    const docId = `${alunoId}_${atividadeId}`;
    const cellKey = `${alunoId}_${atividadeId}`;
    
    setSavingCells(prev => ({ ...prev, [cellKey]: true }));
    setSyncStatus('saving');

    try {
      const docRef = doc(db, 'notas', docId);
      if (valor === null) {
        // Se a nota foi apagada, podemos remover ou salvar como nula. Vamos salvar nula ou remover do Firestore
        // Para simplificar, salvaremos com nota: -1 ou apenas atualizaremos para remover se o usuário preferir,
        // mas setar nota: -1 ou deletar é ótimo. Vamos deletar ou setar valor nulo.
        // Vamos apenas salvar com nota nula ou apenas ignorar. Uma ótima prática é deletar o doc se apagado.
        // Mas para manter simples e robusto, vamos salvar como nula ou deletar.
        // Vamos apenas deletar usando deleteDoc. Mas para simplificar a permissão de escrita, salvaremos como nota nula.
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

  // Calcular média bimestral ponderada do aluno
  const calcularMediaAluno = (alunoId: string) => {
    let somaProdutos = 0;
    let somaPesos = 0;
    let temNota = false;

    atividadesFiltradas.forEach(at => {
      const notaStr = obterNotaValor(alunoId, at.id);
      if (notaStr !== '' && Number(notaStr) >= 0) {
        const n = Number(notaStr);
        somaProdutos += n * at.peso;
        somaPesos += at.peso;
        temNota = true;
      }
    });

    if (!temNota || somaPesos === 0) return '—';
    const media = somaProdutos / somaPesos;
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
              {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
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
            <b>Dica de Lançamento:</b> Digite a nota na célula correspondente e pressione <b>Enter</b> ou clique fora (Tab) para salvar instantaneamente no banco de dados. Use notas de 0 a 10.
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 }}>
                <th style={{ padding: '10px', textAlign: 'left', minWidth: '200px' }}>Aluno</th>
                {atividadesFiltradas.map(at => (
                  <th key={at.id} style={{ padding: '10px', textAlign: 'center', width: '120px' }}>
                    <div style={{ color: 'var(--text-main)', fontWeight: 700 }}>{at.nome}</div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {at.tipo.toUpperCase()} (p. {at.peso})
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
                          <div style={{ position: 'relative', display: 'inline-block', width: '70px' }}>
                            <input 
                              defaultValue={displayVal}
                              onBlur={(e) => salvarNota(aluno.id, at.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              placeholder="—"
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
