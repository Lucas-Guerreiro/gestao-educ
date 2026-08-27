import React, { useState, useMemo } from 'react';
import { Aluno, Turma, Atividade, Nota, Escola, Apontamento } from '@/types';

interface RankingPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  atividades: Atividade[];
  notas: Nota[];
  escolas: Escola[];
  apontamentos: Apontamento[];
}

const RankingPage: React.FC<RankingPageProps> = ({
  alunos,
  turmas,
  atividades,
  notas,
  escolas,
  apontamentos,
}) => {
  const [turmaId, setTurmaId] = useState('');
  const [filtroSerie, setFiltroSerie] = useState('');

  // Calcular média global de um aluno (média de suas médias bimestrais de todas as matérias/bimestres)
  const obterMediaGlobalAluno = (alunoId: string, alunoTurmaId: string) => {
    const t = turmas.find(x => String(x.id) === String(alunoTurmaId));
    if (!t) return null;

    const ativsDaTurma = atividades.filter(at => String(at.turmaId) === String(alunoTurmaId));
    if (ativsDaTurma.length === 0) return null;

    // Identificar todas as matérias e bimestres que possuem atividades na turma
    const materiaIds = Array.from(new Set(ativsDaTurma.map(at => String(at.materiaId))));
    const bimestreIds = Array.from(new Set(ativsDaTurma.map(at => String(at.bimestreId))));

    let somaMediasBimestrais = 0;
    let qtdMediasBimestrais = 0;

    materiaIds.forEach(matId => {
      bimestreIds.forEach(bimId => {
        const ativs = ativsDaTurma.filter(at => String(at.materiaId) === matId && String(at.bimestreId) === bimId);
        if (ativs.length === 0) return;

        // Calcular média desta matéria/bimestre
        // 1. Trabalho (máx. 6)
        const trabalhos = ativs.filter(at => at.tipo === 'trabalho');
        let notaTrabalho = 0;
        if (trabalhos.length > 0) {
          let soma = 0;
          trabalhos.forEach(at => {
            const reg = notas.find(n => String(n.alunoId) === String(alunoId) && String(n.atividadeId) === String(at.id));
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
            const reg = notas.find(n => String(n.alunoId) === String(alunoId) && String(n.atividadeId) === String(at.id));
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
            const reg = notas.find(n => String(n.alunoId) === String(alunoId) && String(n.atividadeId) === String(at.id));
            if (reg && reg.nota !== undefined && (reg.nota as any) !== 'faltou' && (reg.nota as any) !== '') {
              const num = Number(reg.nota);
              if (!isNaN(num) && num >= 0) {
                soma += num;
              }
            }
          });
          notaQualitativa = soma / qualitativas.length;
        }

        // Se tem ao menos uma nota lançada
        let temAlgumaNota = false;
        ativs.forEach(at => {
          const reg = notas.find(n => String(n.alunoId) === String(alunoId) && String(n.atividadeId) === String(at.id));
          if (reg && reg.nota !== undefined && reg.nota >= 0) {
            temAlgumaNota = true;
          }
        });

        if (temAlgumaNota) {
          // 4. Pontos extras de apontamentos (Material, Tarefa, Comportamento) no bimestre e matéria ativos
          const registrosAp = apontamentos.filter(
            ap => String(ap.alunoId) === String(alunoId) && 
                  String(ap.materiaId) === matId && 
                  String(ap.bimestreId) === bimId
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

          // 3.5 Ponto Bônus (soma direto na média final)
          const bonusAtivs = ativs.filter(at => at.tipo === 'bonus');
          let totalBonus = 0;
          bonusAtivs.forEach(at => {
            const reg = notas.find(n => String(n.alunoId) === String(alunoId) && String(n.atividadeId) === String(at.id));
            if (reg && reg.nota !== undefined && reg.nota >= 0) {
              totalBonus += reg.nota;
            }
          });

          const mediaBase = Math.min(notaTrabalho + notaPluraal + notaQualitativa + pontosExtras, 10.0);
          const mediaBimestralFinal = Math.min(mediaBase + totalBonus, 10.0);

          somaMediasBimestrais += mediaBimestralFinal;
          qtdMediasBimestrais++;
        }
      });
    });

    if (qtdMediasBimestrais === 0) return null;
    return somaMediasBimestrais / qtdMediasBimestrais;
  };

  // Filtrar alunos
  const obterAlunosRankeados = () => {
    let baseAlunos = alunos.filter(a => a.ativo !== false);

    if (turmaId) {
      baseAlunos = baseAlunos.filter(a => String(a.turmaId) === turmaId);
    } else if (filtroSerie) {
      // Filtrar turmas que correspondem à série
      const turmasDaSerie = turmas.filter(t => (t.serie || '').toLowerCase() === filtroSerie.toLowerCase());
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

  const alunosRankeados = useMemo(() => obterAlunosRankeados(), [
    alunos, turmas, atividades, notas, turmaId, filtroSerie
  ]);

  // Calcular as colocações (rankings) tratando empates
  const alunosComColocacao = useMemo(() => {
    let colocacaoAtual = 1;
    return alunosRankeados.map((aluno, idx, arr) => {
      if (idx > 0) {
        const alunoAnterior = arr[idx - 1];
        if ((aluno.mediaGlobal || 0).toFixed(1) !== (alunoAnterior.mediaGlobal || 0).toFixed(1)) {
          colocacaoAtual = idx + 1;
        }
      }
      return {
        ...aluno,
        posicaoRank: colocacaoAtual
      };
    });
  }, [alunosRankeados]);

  // Listar todas as séries exclusivas para filtro
  const seriesDisponiveis = Array.from(new Set(turmas.map(t => t.serie)));

  // Obter top 3 do ranking com colocação
  const podium = alunosComColocacao.slice(0, 3);

  const obterEstiloPodium = (posicao: number) => {
    if (posicao === 1) {
      return {
        emoji: '🥇',
        corBorda: '#f59e0b',
        bg: '#fffbeb',
        corTexto: '#b45309',
        height: '170px',
        width: '170px',
        fontSizeEmoji: '42px',
        borderWidth: '3px',
        shadow: '0 10px 15px -3px rgba(245, 158, 11, 0.15)',
        text: '1º Lugar',
        anim: 'bounce 2s infinite'
      };
    }
    if (posicao === 2) {
      return {
        emoji: '🥈',
        corBorda: '#cbd5e1',
        bg: '#f8fafc',
        corTexto: '#475569',
        height: '140px',
        width: '150px',
        fontSizeEmoji: '32px',
        borderWidth: '2px',
        shadow: 'none',
        text: '2º Lugar',
        anim: 'none'
      };
    }
    return {
      emoji: '🥉',
      corBorda: '#d7ccc8',
      bg: '#fafaf9',
      corTexto: '#78716c',
      height: '120px',
      width: '150px',
      fontSizeEmoji: '32px',
      borderWidth: '2px',
      shadow: 'none',
      text: '3º Lugar',
      anim: 'none'
    };
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Cabeçalho com indicador de tempo real */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
          🏆 Ranking de Alunos
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', color: '#15803d', fontWeight: 700 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
          Atualização em tempo real
        </div>
      </div>

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
      ) : alunosComColocacao.length === 0 ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Nenhum dado de notas cadastrado para gerar o ranking deste segmento.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Podium de Vencedores */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', padding: '20px 0', flexWrap: 'wrap' }}>
            {podium.map(aluno => {
              const estilo = obterEstiloPodium(aluno.posicaoRank);
              return (
                <div key={aluno.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: estilo.fontSizeEmoji, marginBottom: '4px', animation: estilo.anim }}>{estilo.emoji}</div>
                  <div style={{ 
                    background: estilo.bg, 
                    border: `${estilo.borderWidth} solid ${estilo.corBorda}`, 
                    borderRadius: '16px 16px 0 0', 
                    padding: '16px', 
                    width: estilo.width, 
                    height: estilo.height, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    textAlign: 'center',
                    boxShadow: estilo.shadow
                  }}>
                    <div style={{ fontSize: '11px', color: estilo.corTexto, fontWeight: 800 }}>{estilo.text}</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
                      {aluno.posicaoRank === 1 ? aluno.nome : aluno.nome.split(' ')[0]}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: estilo.corTexto }}>
                      {(aluno.mediaGlobal || 0).toFixed(1)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lista Completa dos Demais Alunos */}
          <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
              📊 Classificação Geral de Rendimento
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alunosComColocacao.map((aluno) => {
                const tur = turmas.find(t => String(t.id) === String(aluno.turmaId));
                const posEmoji = aluno.posicaoRank === 1 ? '🥇' : aluno.posicaoRank === 2 ? '🥈' : aluno.posicaoRank === 3 ? '🥉' : `${aluno.posicaoRank}º`;
                
                return (
                  <div 
                    key={aluno.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '12px 16px', 
                      background: aluno.posicaoRank === 1 ? '#fffbeb' : aluno.posicaoRank === 2 ? '#f8fafc' : aluno.posicaoRank === 3 ? '#fafaf9' : '#fff', 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px',
                      borderColor: aluno.posicaoRank === 1 ? '#fde68a' : 'var(--border)'
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
                    <div style={{ fontSize: '16px', fontWeight: 900, color: aluno.posicaoRank === 1 ? '#b45309' : 'var(--primary)' }}>
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
