import React from 'react';
import { Aluno, Turma, Nota, Escola } from '@/types';

interface RelatorioPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  notas: Nota[];
  escolas: Escola[];
}

const RelatorioPage: React.FC<RelatorioPageProps> = ({
  alunos,
  turmas,
  notas,
  escolas,
}) => {

  const totalEscolas = escolas.length;
  const totalTurmas = turmas.length;
  const totalAlunos = alunos.filter(a => a.ativo !== false).length;

  // Filtrar notas válidas (maiores ou iguais a zero)
  const notasValidas = notas.filter(n => n.nota !== undefined && n.nota >= 0);
  const totalNotasLancadas = notasValidas.length;

  const obterMediaGeral = () => {
    if (totalNotasLancadas === 0) return '—';
    const soma = notasValidas.reduce((acc, curr) => acc + curr.nota, 0);
    return (soma / totalNotasLancadas).toFixed(1);
  };

  // Calcular distribuição de notas
  const obterDistribuicaoNotas = () => {
    if (totalNotasLancadas === 0) return { aprovados: 0, regulares: 0, recuperacao: 0 };
    
    let aprovados = 0;
    let regulares = 0;
    let recuperacao = 0;

    notasValidas.forEach(n => {
      if (n.nota >= 7.0) aprovados++;
      else if (n.nota >= 5.0) regulares++;
      else recuperacao++;
    });

    const pAprov = Math.round((aprovados / totalNotasLancadas) * 100);
    const pReg = Math.round((regulares / totalNotasLancadas) * 100);
    const pRec = Math.round((recuperacao / totalNotasLancadas) * 100);

    return {
      aprovados: pAprov,
      regulares: pReg,
      recuperacao: pRec,
      aprovadosQtd: aprovados,
      regularesQtd: regulares,
      recuperacaoQtd: recuperacao
    };
  };

  const dist = obterDistribuicaoNotas();
  const mediaGeral = obterMediaGeral();

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Cards de Métricas Principais (KPIs) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        
        {/* Card Escolas */}
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '46px', height: '46px', background: '#eff6ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-building" style={{ fontSize: '24px', color: '#1e40af' }}></i>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>TOTAL DE ESCOLAS</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--dark)' }}>{totalEscolas}</div>
          </div>
        </div>

        {/* Card Turmas */}
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '46px', height: '46px', background: '#f5f3ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-users" style={{ fontSize: '24px', color: '#6d28d9' }}></i>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>TURMAS ATIVAS</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--dark)' }}>{totalTurmas}</div>
          </div>
        </div>

        {/* Card Alunos */}
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '46px', height: '46px', background: '#ecfdf5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-school" style={{ fontSize: '24px', color: '#047857' }}></i>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>ALUNOS ATIVOS</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--dark)' }}>{totalAlunos}</div>
          </div>
        </div>

        {/* Card Média Geral */}
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '46px', height: '46px', background: '#fffbeb', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-star" style={{ fontSize: '24px', color: '#b45309' }}></i>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>MÉDIA GLOBAL</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309' }}>{mediaGeral}</div>
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Distribuição de Notas */}
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
            📊 Distribuição Estatística de Notas Lançadas
          </div>
          
          {totalNotasLancadas === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
              Nenhuma nota lançada no sistema para gerar estatísticas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Barra Horizontal Multi-Segmento */}
              <div style={{ width: '100%', height: '24px', borderRadius: '12px', overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
                {dist.aprovados > 0 && (
                  <div style={{ width: `${dist.aprovados}%`, background: '#10b981', height: '100%', transition: '0.3s' }} title={`Aprovados: ${dist.aprovados}%`}></div>
                )}
                {dist.regulares > 0 && (
                  <div style={{ width: `${dist.regulares}%`, background: '#f59e0b', height: '100%', transition: '0.3s' }} title={`Regulares: ${dist.regulares}%`}></div>
                )}
                {dist.recuperacao > 0 && (
                  <div style={{ width: `${dist.recuperacao}%`, background: '#ef4444', height: '100%', transition: '0.3s' }} title={`Recuperação: ${dist.recuperacao}%`}></div>
                )}
              </div>

              {/* Legenda e Detalhes dos Segmentos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></div>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Aprovados (Média ≥ 7.0)</span>
                  </div>
                  <b>{dist.aprovados}% ({dist.aprovadosQtd} lançamentos)</b>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></div>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Regulares (5.0 ≤ Média &lt; 7.0)</span>
                  </div>
                  <b>{dist.regulares}% ({dist.regularesQtd} lançamentos)</b>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></div>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Recuperação (Média &lt; 5.0)</span>
                  </div>
                  <b>{dist.recuperacao}% ({dist.recuperacaoQtd} lançamentos)</b>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Visão de Densidade por Turma */}
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
            📊 Distribuição de Alunos por Turma
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto' }}>
            {turmas.length === 0 ? (
              <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                Nenhuma turma cadastrada.
              </div>
            ) : (
              turmas.map(t => {
                const qtdAlunos = alunos.filter(a => String(a.turmaId) === t.id && a.ativo !== false).length;
                const maxAlunos = Math.max(...turmas.map(x => alunos.filter(a => String(a.turmaId) === x.id && a.ativo !== false).length), 1);
                const pctDensidade = Math.round((qtdAlunos / maxAlunos) * 100);

                return (
                  <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                      <span>{t.nome}</span>
                      <span style={{ color: 'var(--primary)' }}>{qtdAlunos} alunos</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pctDensidade}%`, height: '100%', background: '#6366f1', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default RelatorioPage;
