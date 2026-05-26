import React, { useState } from 'react';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota, Escola } from '@/types';

interface BoletimPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  atividades: Atividade[];
  notas: Nota[];
  escolas: Escola[];
}

const BoletimPage: React.FC<BoletimPageProps> = ({
  alunos,
  turmas,
  materias,
  bimestres,
  atividades,
  notas,
  escolas,
}) => {
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [selectedAlunoId, setSelectedAlunoId] = useState('');

  // Filtrar alunos da turma
  const alunosDaTurma = alunos.filter(a => String(a.turmaId) === selectedTurmaId && a.ativo !== false);

  // Aluno e turma ativos
  const aluno = alunos.find(a => a.id === selectedAlunoId);
  const turma = turmas.find(t => t.id === selectedTurmaId);
  const escola = turma ? escolas.find(e => e.id === turma.escolaId) : null;
  const materiasEscola = escola ? materias.filter(m => m.escolaId === escola.id) : [];

  // Calcular média ponderada para o aluno, matéria e bimestre específicos
  const obterMediaBimestral = (materiaId: string, bimestreId: string) => {
    const ativs = atividades.filter(
      at => at.turmaId === selectedTurmaId && at.materiaId === materiaId && at.bimestreId === bimestreId
    );

    let somaProdutos = 0;
    let somaPesos = 0;
    let temNota = false;

    ativs.forEach(at => {
      const reg = notas.find(n => n.alunoId === selectedAlunoId && n.atividadeId === at.id);
      if (reg && reg.nota !== undefined && reg.nota >= 0) {
        somaProdutos += reg.nota * at.peso;
        somaPesos += at.peso;
        temNota = true;
      }
    });

    if (!temNota || somaPesos === 0) return null;
    return somaProdutos / somaPesos;
  };

  const dispararImpressao = () => {
    window.print();
  };

  const formatarData = (dStr?: string) => {
    if (!dStr) return '—';
    return dStr.split('-').reverse().join('/');
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Controles de Filtros */}
      <div className="card-box no-print" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="f">
            <label>Selecione a Turma *</label>
            <select value={selectedTurmaId} onChange={(e) => { setSelectedTurmaId(e.target.value); setSelectedAlunoId(''); }}>
              <option value="">— selecione a turma —</option>
              {turmas.map(t => {
                const esc = escolas.find(e => e.id === t.escolaId);
                return <option key={t.id} value={t.id}>{t.nome} ({esc ? esc.nome : 'Escola'})</option>;
              })}
            </select>
          </div>
          <div className="f">
            <label>Selecione o Aluno *</label>
            <select value={selectedAlunoId} onChange={(e) => setSelectedAlunoId(e.target.value)} disabled={!selectedTurmaId}>
              <option value="">— selecione o aluno —</option>
              {alunosDaTurma.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Visão de Boletim */}
      {!selectedTurmaId || !selectedAlunoId || !aluno ? (
        <div className="card-box no-print" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          ⚠️ Selecione a Turma e o Aluno acima para carregar e formatar o boletim individual de notas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Botão de Ação */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="no-print">
            <button className="btn pri" onClick={dispararImpressao}>
              <i className="ti ti-printer"></i> 🖨️ Imprimir Boletim Escolar
            </button>
          </div>

          {/* Folha de Boletim (Estilizada para impressão) */}
          <div id="boletim-imprimivel" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', boxShadow: 'var(--shadow-lg)' }}>
            
            {/* Cabeçalho Oficial do Boletim */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid var(--dark)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--dark)', letterSpacing: '0.5px' }}>
                  {escola ? escola.nome.toUpperCase() : 'BOLETIM ESCOLAR OFICIAL'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                  SISTEMA DE GESTÃO ESCOLAR INTEGRADO
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', color: '#1e40af', fontWeight: 800 }}>
                  ANO LETIVO: {new Date().getFullYear()}
                </span>
              </div>
            </div>

            {/* Ficha Cadastral do Aluno */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#fafafa', border: '1px solid var(--border)', padding: '14px', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>NOME DO ALUNO:</span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dark)' }}>{aluno.nome}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>TURMA:</span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dark)' }}>{turma ? turma.nome : '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>SÉRIE / ANO:</span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dark)' }}>{turma ? turma.serie : '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>NASCIMENTO:</span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--dark)' }}>{formatarData(aluno.nascimento)}</div>
              </div>
            </div>

            {/* Tabela de Notas */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '2rem' }}>
              <thead>
                <tr style={{ background: 'var(--dark)', color: '#fff', fontWeight: 800 }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderRadius: '8px 0 0 0' }}>COMPONENTE CURRICULAR</th>
                  {bimestres.map(b => (
                    <th key={b.id} style={{ padding: '12px', textAlign: 'center', width: '100px' }}>
                      {b.nome.replace(' Bimestre', 'º B')}
                    </th>
                  ))}
                  <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>MÉDIA</th>
                  <th style={{ padding: '12px', textAlign: 'center', width: '110px', borderRadius: '0 8px 0 0' }}>SITUAÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {materiasEscola.length === 0 ? (
                  <tr>
                    <td colSpan={bimestres.length + 3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Nenhuma disciplina vinculada ao boletim desta escola.
                    </td>
                  </tr>
                ) : (
                  materiasEscola.map(mat => {
                    let somaMedias = 0;
                    let bimestresComNota = 0;

                    const mediasBimestrais = bimestres.map(b => {
                      const m = obterMediaBimestral(mat.id, b.id);
                      if (m !== null) {
                        somaMedias += m;
                        bimestresComNota++;
                      }
                      return m;
                    });

                    const mediaFinal = bimestresComNota > 0 ? somaMedias / bimestresComNota : null;
                    const aprovado = mediaFinal !== null && mediaFinal >= 6.0;

                    return (
                      <tr key={mat.id} style={{ borderBottom: '1px solid var(--border)', transition: '0.15s' }}>
                        <td style={{ padding: '12px', fontWeight: 800, color: 'var(--text-main)' }}>{mat.nome}</td>
                        {mediasBimestrais.map((m, idx) => (
                          <td key={idx} style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                            {m !== null ? m.toFixed(1) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 800, background: '#fafafa' }}>
                          {mediaFinal !== null ? mediaFinal.toFixed(1) : '—'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', background: '#fafafa' }}>
                          {mediaFinal === null ? (
                            <span style={{ fontSize: '10px', color: '#64748b' }}>PENDENTE</span>
                          ) : aprovado ? (
                            <span style={{ fontSize: '10.5px', color: '#166534', fontWeight: 800 }}>APROVADO</span>
                          ) : (
                            <span style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 800 }}>RECUPERAÇÃO</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Rodapé de Assinaturas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '4rem', fontSize: '11px', textAlign: 'center' }}>
              <div>
                <div style={{ borderTop: '1px solid #94a3b8', width: '220px', margin: '0 auto', paddingTop: '6px' }}>
                  ASSINATURA DA COORDENAÇÃO
                </div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #94a3b8', width: '220px', margin: '0 auto', paddingTop: '6px' }}>
                  ASSINATURA DO PROFESSOR
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Estilos CSS Especiais para Impressão */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .sidebar, .topbar, .no-print, #sb-toggle-btn {
            display: none !important;
          }
          #boletim-imprimivel {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>

    </div>
  );
};

export default BoletimPage;
