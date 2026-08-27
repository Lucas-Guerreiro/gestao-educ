import React, { useState, useEffect } from 'react';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota, Escola, Apontamento, Professor } from '@/types';

interface ConceitosPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  atividades: Atividade[];
  notas: Nota[];
  escolas: Escola[];
  apontamentos: Apontamento[];
  professores: Professor[];
  selectedBimestreId: string;
  onBimestreChange: (id: string) => void;
}

const ConceitosPage: React.FC<ConceitosPageProps> = ({
  alunos,
  turmas,
  materias,
  bimestres,
  atividades,
  notas,
  escolas,
  apontamentos,
  professores,
  selectedBimestreId,
  onBimestreChange,
}) => {
  const [turmaId, setTurmaId] = useState('');
  const [bimestreId, setBimestreId] = useState('');

  // Sincronizar com o bimestre global
  useEffect(() => {
    if (selectedBimestreId) {
      setBimestreId(selectedBimestreId);
    }
  }, [selectedBimestreId]);

  // 1. Filtrar os bimestres que possuem atividades para a turma selecionada
  const bimestresDaTurma = React.useMemo(() => {
    if (!turmaId) return [];
    const bimIdsComAtividade = Array.from(
      new Set(
        atividades
          .filter(a => a.turmaId === turmaId)
          .map(a => a.bimestreId)
      )
    );
    return bimestres.filter(b => bimIdsComAtividade.includes(b.id));
  }, [turmaId, atividades, bimestres]);

  const handleTurmaChange = (id: string) => {
    setTurmaId(id);
  };

  // Filtrar turmas/alunos ativos
  const turmaSelecionada = turmas.find(t => t.id === turmaId);
  const escolaId = turmaSelecionada?.escolaId || '';

  const alunosFiltrados = alunos.filter(a => String(a.turmaId) === turmaId && a.ativo !== false);
  
  // Filtrar disciplinas vinculadas à turma por qualquer professor, com fallback para todas da escola
  const materiasFiltradas = React.useMemo(() => {
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
      return materias.filter(m => m.escolaId === escolaId);
    }

    return materias.filter(m => idsVinculados.has(m.id));
  }, [turmaId, escolaId, materias, professores]);

  // Calcular média para aluno + matéria no bimestre selecionado de acordo com as três categorias
  const obterMedia = (alunoId: string, materiaId: string) => {
    const ativs = atividades.filter(
      at => at.turmaId === turmaId && at.materiaId === materiaId && at.bimestreId === bimestreId
    );

    if (ativs.length === 0) return null;

    // 1. Trabalho (máx. 6)
    const trabalhos = ativs.filter(at => at.tipo === 'trabalho');
    let notaTrabalho = 0;
    if (trabalhos.length > 0) {
      let soma = 0;
      trabalhos.forEach(at => {
        const reg = notas.find(n => n.alunoId === alunoId && n.atividadeId === at.id);
        if (reg && reg.nota !== undefined && reg.nota >= 0) {
          soma += reg.nota;
        }
      });
      notaTrabalho = soma / trabalhos.length;
    }

    // 2. PLURAAL (máx. 1)
    const pluraals = ativs.filter(at => at.tipo === 'pluraal');
    let notaPluraal = 0;
    if (pluraals.length > 0) {
      let soma = 0;
      pluraals.forEach(at => {
        const reg = notas.find(n => n.alunoId === alunoId && n.atividadeId === at.id);
        if (reg && reg.nota !== undefined && reg.nota >= 0) {
          soma += reg.nota;
        }
      });
      notaPluraal = soma / pluraals.length;
    }

    // 3. Qualitativa (máx. 3)
    const qualitativas = ativs.filter(at => at.tipo === 'qualitativa');
    let notaQualitativa = 0;
    if (qualitativas.length > 0) {
      let soma = 0;
      qualitativas.forEach(at => {
        const reg = notas.find(n => n.alunoId === alunoId && n.atividadeId === at.id);
        if (reg && reg.nota !== undefined && (reg.nota as any) !== 'faltou' && (reg.nota as any) !== '') {
          const num = Number(reg.nota);
          if (!isNaN(num) && num >= 0) {
            soma += num;
          }
        }
      });
      notaQualitativa = soma / qualitativas.length;
    }

    // Se não houver notas lançadas para nenhuma atividade, retorna null
    let temAlgumaNota = false;
    ativs.forEach(at => {
      const reg = notas.find(n => n.alunoId === alunoId && n.atividadeId === at.id);
      if (reg && reg.nota !== undefined && reg.nota >= 0) {
        temAlgumaNota = true;
      }
    });

    if (!temAlgumaNota) return null;

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
    const bonusAtivs = ativs.filter(at => at.tipo === 'bonus');
    let totalBonus = 0;
    bonusAtivs.forEach(at => {
      const reg = notas.find(n => n.alunoId === alunoId && n.atividadeId === at.id);
      if (reg && reg.nota !== undefined && reg.nota >= 0) {
        totalBonus += reg.nota;
      }
    });

    const mediaBase = Math.min(notaTrabalho + notaPluraal + notaQualitativa + pontosExtras, 10.0);
    return Math.min(mediaBase + totalBonus, 10.0);
  };

  const renderBadge = (media: number | null) => {
    if (media === null) {
      return (
        <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
          Sem Notas
        </span>
      );
    }

    if (media >= 7.0) {
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
              Selecione o Bimestre *
              {turmaId && bimestresDaTurma.length === 0 && (
                <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '6px' }}>Nenhuma atividade nesta turma</span>
              )}
            </label>
            <select value={selectedBimestreId} onChange={(e) => onBimestreChange(e.target.value)} disabled={!turmaId}>
              <option value="">— selecione —</option>
              {bimestresDaTurma.map(b => <option key={b.id} value={b.id}>{b.nome}{b.ano ? ` (${b.ano})` : ''}</option>)}
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
