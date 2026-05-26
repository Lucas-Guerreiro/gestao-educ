import React, { useState } from 'react';
import { Aluno, Turma, Atividade, Nota, Escola } from '@/types';

interface RankingPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  atividades: Atividade[];
  notas: Nota[];
  escolas: Escola[];
}

const RankingPage: React.FC<RankingPageProps> = ({
  alunos,
  turmas,
  atividades,
  notas,
  escolas,
}) => {
  const [turmaId, setTurmaId] = useState('');
  const [filtroSerie, setFiltroSerie] = useState('');

  // Calcular média global de um aluno
  const obterMediaGlobalAluno = (alunoId: string, alunoTurmaId: string) => {
    const t = turmas.find(x => x.id === alunoTurmaId);
    if (!t) return null;

    const ativsDaTurma = atividades.filter(at => at.turmaId === alunoTurmaId);

    let somaProdutos = 0;
    let somaPesos = 0;
    let temNota = false;

    // Calcular notas
    ativsDaTurma.forEach(at => {
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

  // Filtrar alunos
  const obterAlunosRankeados = () => {
    let baseAlunos = alunos.filter(a => a.ativo !== false);

    if (turmaId) {
      baseAlunos = baseAlunos.filter(a => String(a.turmaId) === turmaId);
    } else if (filtroSerie) {
      // Filtrar turmas que correspondem à série
      const turmasDaSerie = turmas.filter(t => t.serie.toLowerCase() === filtroSerie.toLowerCase());
      const idsTurmas = turmasDaSerie.map(t => t.id);
      baseAlunos = baseAlunos.filter(a => idsTurmas.includes(String(a.turmaId)));
    } else {
      // Se nada selecionado, retorna vazio para não misturar escolas distintas sem critério
      return [];
    }

    // Mapear com médias
    const listaComMedias = baseAlunos.map(a => {
      const media = obterMediaGlobalAluno(a.id, a.turmaId);
      return {
        ...a,
        mediaGlobal: media
      };
    });

    // Filtrar quem tem média e ordenar descendente
    return listaComMedias
      .filter(x => x.mediaGlobal !== null)
      .sort((a, b) => (b.mediaGlobal || 0) - (a.mediaGlobal || 0));
  };

  const alunosRankeados = obterAlunosRankeados();

  // Listar todas as séries exclusivas para filtro
  const seriesDisponiveis = Array.from(new Set(turmas.map(t => t.serie)));

  // Obter top 3 do ranking
  const podium = alunosRankeados.slice(0, 3);

  const medalha = (posicao: number) => {
    if (posicao === 0) return { emoji: '🥇', cor: '#fbbf24', text: '1º Lugar' };
    if (posicao === 1) return { emoji: '🥈', cor: '#94a3b8', text: '2º Lugar' };
    return { emoji: '🥉', cor: '#b45309', text: '3º Lugar' };
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Filtros de Ranking */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="f">
            <label>Filtrar por Turma específica</label>
            <select 
              value={turmaId} 
              onChange={(e) => { 
                setTurmaId(e.target.value); 
                if (e.target.value) setFiltroSerie(''); 
              }}
            >
              <option value="">— selecione —</option>
              {turmas.map(t => {
                const esc = escolas.find(e => e.id === t.escolaId);
                return <option key={t.id} value={t.id}>{t.nome} ({esc ? esc.nome : 'Escola'})</option>;
              })}
            </select>
          </div>
          <div className="f">
            <label>Ou Filtrar Geral por Série (ex: 8º Ano)</label>
            <select 
              value={filtroSerie} 
              onChange={(e) => { 
                setFiltroSerie(e.target.value); 
                if (e.target.value) setTurmaId(''); 
              }}
            >
              <option value="">— selecione —</option>
              {seriesDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Visualização de Resultados */}
      {!turmaId && !filtroSerie ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          ⚠️ Selecione uma Turma ou Série acima para carregar o ranking classificatório de alunos.
        </div>
      ) : alunosRankeados.length === 0 ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Nenhum dado de notas cadastrado para gerar o ranking deste segmento.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Podium de Vencedores */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', padding: '20px 0', flexWrap: 'wrap' }}>
            
            {/* 2º Lugar */}
            {podium[1] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '4px' }}>🥈</div>
                <div style={{ background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '16px 16px 0 0', padding: '16px', width: '150px', height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>{medalha(1).text}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>{podium[1].nome.split(' ')[0]}</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#475569' }}>{(podium[1].mediaGlobal || 0).toFixed(1)}</div>
                </div>
              </div>
            )}

            {/* 1º Lugar (Destaque) */}
            {podium[0] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '42px', marginBottom: '4px', animation: 'bounce 2s infinite' }}>🥇</div>
                <div style={{ background: '#fffbeb', border: '3px solid #f59e0b', borderRadius: '16px 16px 0 0', padding: '18px', width: '170px', height: '170px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.15)' }}>
                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 800 }}>{medalha(0).text}</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.2 }}>{podium[0].nome}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#b45309' }}>{(podium[0].mediaGlobal || 0).toFixed(1)}</div>
                </div>
              </div>
            )}

            {/* 3º Lugar */}
            {podium[2] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '4px' }}>🥉</div>
                <div style={{ background: '#fafaf9', border: '2px solid #d7ccc8', borderRadius: '16px 16px 0 0', padding: '16px', width: '150px', height: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 800 }}>{medalha(2).text}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>{podium[2].nome.split(' ')[0]}</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#78716c' }}>{(podium[2].mediaGlobal || 0).toFixed(1)}</div>
                </div>
              </div>
            )}

          </div>

          {/* Lista Completa dos Demais Alunos */}
          <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
              📊 Classificação Geral de Rendimento
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alunosRankeados.map((aluno, index) => {
                const tur = turmas.find(t => t.id === String(aluno.turmaId));
                const posEmoji = index < 3 ? medalha(index).emoji : `${index + 1}º`;
                
                return (
                  <div 
                    key={aluno.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '12px 16px', 
                      background: index === 0 ? '#fffbeb' : index === 1 ? '#f8fafc' : index === 2 ? '#fafaf9' : '#fff', 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px',
                      borderColor: index === 0 ? '#fde68a' : 'var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, minWidth: '32px', color: '#64748b' }}>
                        {posEmoji}
                      </span>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>{aluno.nome}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Turma: {tur ? tur.nome : '—'}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: index === 0 ? '#b45309' : 'var(--primary)' }}>
                      {(aluno.mediaGlobal || 0).toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default RankingPage;
