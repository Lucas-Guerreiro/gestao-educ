import React, { useState } from 'react';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota, Escola } from '@/types';

interface ConceitosPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  atividades: Atividade[];
  notas: Nota[];
  escolas: Escola[];
}

const ConceitosPage: React.FC<ConceitosPageProps> = ({
  alunos,
  turmas,
  materias,
  bimestres,
  atividades,
  notas,
  escolas,
}) => {
  const [turmaId, setTurmaId] = useState('');
  const [bimestreId, setBimestreId] = useState('');

  // Filtrar turmas/alunos ativos
  const turmaSelecionada = turmas.find(t => t.id === turmaId);
  const escolaId = turmaSelecionada?.escolaId || '';

  const alunosFiltrados = alunos.filter(a => String(a.turmaId) === turmaId && a.ativo !== false);
  const materiasFiltradas = materias.filter(m => m.escolaId === escolaId);

  // Calcular média ponderada para aluno + matéria no bimestre selecionado
  const obterMedia = (alunoId: string, materiaId: string) => {
    const ativs = atividades.filter(
      at => at.turmaId === turmaId && at.materiaId === materiaId && at.bimestreId === bimestreId
    );

    let somaProdutos = 0;
    let somaPesos = 0;
    let temNota = false;

    ativs.forEach(at => {
      const reg = notas.find(n => n.alunoId === alunoId && n.atividadeId === at.id);
      if (reg && reg.nota !== undefined && reg.nota >= 0) {
        somaProdutos += reg.nota * at.peso;
        somaPesos += at.peso;
        temNota = true;
      }
    });

    if (!temNota || somaPesos === 0) return null;
    return somaProdutos / somaPesos;
  };

  const renderBadge = (media: number | null) => {
    if (media === null) {
      return (
        <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
          Sem Notas
        </span>
      );
    }

    if (media >= 6.0) {
      return (
        <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
          ✅ Aprovado ({media.toFixed(1)})
        </span>
      );
    } else if (media >= 5.0) {
      return (
        <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
          ⚠️ Regular ({media.toFixed(1)})
        </span>
      );
    } else {
      return (
        <span style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
          ⛔ Recuperação ({media.toFixed(1)})
        </span>
      );
    }
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Filtros */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
            <label>Selecione o Bimestre *</label>
            <select value={bimestreId} onChange={(e) => setBimestreId(e.target.value)}>
              <option value="">— selecione —</option>
              {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Matriz de Conceitos */}
      {!turmaId || !bimestreId ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          ⚠️ Selecione a Turma e o Bimestre acima para carregar o Mapa Analítico de Conceitos.
        </div>
      ) : alunosFiltrados.length === 0 ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Nenhum aluno ativo nesta turma.
        </div>
      ) : materiasFiltradas.length === 0 ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Nenhuma matéria vinculada à escola desta turma.
        </div>
      ) : (
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 }}>
                <th style={{ padding: '10px', textAlign: 'left', minWidth: '180px' }}>Aluno</th>
                {materiasFiltradas.map(mat => (
                  <th key={mat.id} style={{ padding: '10px', textAlign: 'center' }}>
                    {mat.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alunosFiltrados.map(aluno => (
                <tr key={aluno.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                  <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-main)' }}>{aluno.nome}</td>
                  {materiasFiltradas.map(mat => {
                    const mediaVal = obterMedia(aluno.id, mat.id);
                    return (
                      <td key={mat.id} style={{ padding: '10px', textAlign: 'center' }}>
                        {renderBadge(mediaVal)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default ConceitosPage;
