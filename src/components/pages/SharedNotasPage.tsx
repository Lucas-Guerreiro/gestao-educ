import React, { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota, Escola } from '@/types';

interface SharedNotasPageProps {
  sharedMap: Record<string, string>;
  sharedAtividadeId: string;
  alunos: Aluno[];
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  atividades: Atividade[];
  escolas: Escola[];
  notas: Nota[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const SharedNotasPage: React.FC<SharedNotasPageProps> = ({
  sharedMap,
  sharedAtividadeId,
  alunos,
  turmas,
  materias,
  bimestres,
  atividades,
  escolas,
  notas,
  setSyncStatus,
}) => {
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [edicaoBloqueada, setEdicaoBloqueada] = useState(true);

  // Obter o ID da atividade correspondente à turma selecionada
  const currentAtividadeId = useMemo(() => {
    return selectedTurmaId ? (sharedMap[selectedTurmaId] || sharedAtividadeId) : sharedAtividadeId;
  }, [selectedTurmaId, sharedMap, sharedAtividadeId]);

  // Detalhes da atividade compartilhada
  const atividade = useMemo(() => {
    return atividades.find(a => a.id === currentAtividadeId) || null;
  }, [atividades, currentAtividadeId]);

  // Verificar se o prazo limite da atividade expirou
  const hojeStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const atividadeExpirada = useMemo(() => {
    if (!atividade || !atividade.dataLimite) return false;
    return hojeStr > atividade.dataLimite && !atividade.liberadoVencido;
  }, [atividade, hojeStr]);


  // Escola da atividade
  const escola = useMemo(() => {
    if (!atividade) return null;
    const tur = turmas.find(t => t.id === atividade.turmaId);
    if (!tur) return null;
    return escolas.find(e => e.id === tur.escolaId) || null;
  }, [atividade, turmas, escolas]);

  // Matéria da atividade
  const materia = useMemo(() => {
    if (!atividade) return null;
    return materias.find(m => m.id === atividade.materiaId) || null;
  }, [atividade, materias]);

  // Bimestre da atividade
  const bimestre = useMemo(() => {
    if (!atividade) return null;
    return bimestres.find(b => b.id === atividade.bimestreId) || null;
  }, [atividade, bimestres]);

  // Filtrar turmas que o professor pode escolher (devem estar no link e pertencerem à mesma escola da atividade original)
  const turmasDisponiveis = useMemo(() => {
    const turmasPermitidas = Object.keys(sharedMap);
    if (!escola) return [];
    return turmas.filter(t => t.escolaId === escola.id && turmasPermitidas.includes(t.id));
  }, [turmas, escola, sharedMap]);

  // Filtrar alunos ativos da turma selecionada
  const alunosFiltrados = useMemo(() => {
    return alunos.filter(a => String(a.turmaId) === selectedTurmaId && a.ativo !== false);
  }, [alunos, selectedTurmaId]);

  // Obter nota do aluno para a atividade específica
  const obterNotaValor = (alunoId: string): string => {
    const registro = notas.find(n => n.alunoId === alunoId && n.atividadeId === currentAtividadeId);
    if (!registro || registro.nota === undefined) return '';
    return registro.nota === -1 ? '' : String(registro.nota);
  };

  const obterNotaMaxima = (tipo: string): number => {
    if (tipo === 'trabalho') return 6;
    if (tipo === 'pluraal') return 1;
    if (tipo === 'qualitativa') return 3;
    return 10;
  };

  const badgeColor = (t: string) => {
    if (t === 'prova') return { bg: '#fee2e2', text: '#991b1b' };
    if (t === 'trabalho') return { bg: '#eff6ff', text: '#1e40af' };
    if (t === 'pluraal') return { bg: '#f3e8ff', text: '#6b21a8' };
    return { bg: '#f0fdf4', text: '#166534' };
  };

  const getNotaCellColors = (valorStr: string) => {
    if (!valorStr) {
      return { bg: '#fff', border: '#cbd5e1', text: 'var(--text-main)' };
    }

    const valor = Number(valorStr.replace(',', '.'));
    if (isNaN(valor)) {
      return { bg: '#fff', border: '#cbd5e1', text: 'var(--text-main)' };
    }

    if (valor <= 1.5) {
      return { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' };
    }

    if (valor <= 2.4) {
      return { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' };
    }

    return { bg: '#dcfce7', border: '#86efac', text: '#166534' };
  };

  // Salvar nota no Firestore com ID composto determinístico
  const salvarNota = async (alunoId: string, valorStr: string) => {
    if (!atividade || !selectedTurmaId) return;

    const notaMax = obterNotaMaxima(atividade.tipo);
    const valor = valorStr.trim() === '' ? null : Number(valorStr.replace(',', '.'));

    if (valor !== null && (isNaN(valor) || valor < 0 || valor > notaMax)) {
      alert(`Por favor, informe uma nota válida entre 0 e ${notaMax} para atividades do tipo ${atividade.tipo.toUpperCase()}.`);
      return;
    }

    const docId = `${alunoId}_${currentAtividadeId}`;
    const cellKey = alunoId;

    setSavingCells(prev => ({ ...prev, [cellKey]: true }));
    setSyncStatus('saving');

    try {
      const docRef = doc(db, 'notas', docId);
      if (valor === null) {
        await setDoc(docRef, {
          alunoId,
          atividadeId: currentAtividadeId,
          turmaId: selectedTurmaId,
          materiaId: atividade.materiaId,
          bimestreId: atividade.bimestreId,
          nota: -1 // representa apagado
        });
      } else {
        await setDoc(docRef, {
          alunoId,
          atividadeId: currentAtividadeId,
          turmaId: selectedTurmaId,
          materiaId: atividade.materiaId,
          bimestreId: atividade.bimestreId,
          nota: valor
        });
      }
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      console.error('Erro ao salvar nota compartilhada:', err);
    } finally {
      setSavingCells(prev => ({ ...prev, [cellKey]: false }));
    }
  };

  if (!atividade) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '2rem', maxWidth: '460px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: '40px', color: '#dc2626', marginBottom: '12px' }}></i>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>Atividade Não Encontrada</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            O link de acesso compartilhado que você utilizou é inválido ou a atividade correspondente foi excluída do sistema. Certifique-se de utilizar a URL completa gerada.
          </div>
        </div>
      </div>
    );
  }

  const colors = badgeColor(atividade.tipo);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', width: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Topbar Simplificada */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--primary)', color: '#fff', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-school" style={{ fontSize: '18px' }}></i>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>EscolaSystem</span>
          <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '20px', fontWeight: 700 }}>
            Lançamento Compartilhado
          </span>
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
          🏫 {escola ? escola.nome : 'Escola'}
        </div>
      </div>

      {/* Main Container */}
      <div style={{ padding: '24px', maxWidth: '800px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
        
        {/* Card Informativo do Trabalho */}
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{atividade.nome}</span>
                <span style={{ fontSize: '9px', background: colors.bg, color: colors.text, padding: '2.5px 7px', borderRadius: '6px', fontWeight: 800 }}>
                  {atividade.tipo.toUpperCase()}
                </span>
              </div>
              {atividade.descricao && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  📝 {atividade.descricao}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                📖 {materia ? materia.nome : '—'}
              </span>
              <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                📅 {bimestre ? `${bimestre.nome}${bimestre.ano ? ` (${bimestre.ano})` : ''}` : '—'}
              </span>
              <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                ⚖️ Peso: {atividade.peso}
              </span>
            </div>
          </div>

          {/* Seleção de Turma Participante */}
          <div className="f" style={{ maxWidth: '300px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Selecione a Turma para Lançar Notas *
            </label>
            <select 
              value={selectedTurmaId} 
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '13px', width: '100%' }}
            >
              <option value="">— selecione a turma —</option>
              {turmasDisponiveis.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela de Lançamento */}
        {!selectedTurmaId ? (
          <div className="card-box" style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '16px', padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            👋 Escolha uma das turmas vinculadas ao link acima para carregar a planilha e digitar as notas dos alunos.
          </div>
        ) : alunosFiltrados.length === 0 ? (
          <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', border: '1px solid var(--border)' }}>
            Nenhum aluno ativo matriculado nesta turma.
          </div>
        ) : (
          <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              {atividadeExpirada ? (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 14px', fontSize: '11.5px', color: '#e11d48', lineHeight: 1.5, flex: 1 }}>
                  <i className="ti ti-lock" style={{ marginRight: '6px' }}></i>
                  <span>⚠️ <b>Lançamento Expirado:</b> O prazo para digitação destas notas terminou em <b>{atividade.dataLimite ? atividade.dataLimite.split('-').reverse().join('/') : '—'}</b>. O lançamento está temporariamente bloqueado.</span>
                </div>
              ) : (
                <>
                  <div style={{ background: edicaoBloqueada ? '#f8fafc' : '#eff6ff', border: edicaoBloqueada ? '1px solid var(--border)' : '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', fontSize: '11.5px', color: edicaoBloqueada ? 'var(--text-muted)' : '#1e40af', lineHeight: 1.5, flex: 1 }}>
                    <i className={edicaoBloqueada ? "ti ti-lock" : "ti ti-info-circle"}></i>
                    {edicaoBloqueada ? (
                      <span> <b>Visualização Protegida:</b> A digitação de notas está temporariamente bloqueada. Clique em <b>"Habilitar Edição"</b> ao lado para preencher ou alterar notas.</span>
                    ) : (
                      <span> <b>Lançamento Ativo:</b> As notas digitadas são salvas automaticamente na nuvem ao perder o foco (Tab) ou pressionar Enter (para pular de linha).</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEdicaoBloqueada(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: edicaoBloqueada ? 'var(--primary)' : '#cbd5e1',
                      background: edicaoBloqueada ? 'var(--primary)' : '#fff',
                      color: edicaoBloqueada ? '#fff' : 'var(--text-main)',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    <i className={edicaoBloqueada ? "ti ti-lock-open" : "ti ti-lock"}></i>
                    {edicaoBloqueada ? 'Habilitar Edição' : 'Bloquear Edição'}
                  </button>
                </>
              )}
            </div>

            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 360px)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontWeight: 800 }}>
                    <th style={{ padding: '12px 10px', textAlign: 'left', minWidth: '220px', position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                      Nome do Aluno
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', width: '150px', position: 'sticky', top: 0, zIndex: 10, background: '#fff', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                      Nota (Máx: {obterNotaMaxima(atividade.tipo).toFixed(1)})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {alunosFiltrados.map((aluno, idx) => {
                    const notaVal = obterNotaValor(aluno.id);
                    const isSaving = !!savingCells[aluno.id];
                    const notaColors = getNotaCellColors(notaVal);

                    return (
                      <tr key={aluno.id} className="table-row-hover">
                        <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid var(--border)' }}>
                          {aluno.nome}
                        </td>
                        
                        <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '85px' }}>
                            <input 
                              id={`shared-input-nota-${idx}`}
                              defaultValue={notaVal}
                              disabled={edicaoBloqueada || atividadeExpirada}
                              onBlur={(e) => {
                                if (!atividadeExpirada) {
                                  salvarNota(aluno.id, e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const proximoInput = document.getElementById(`shared-input-nota-${idx + 1}`);
                                  if (proximoInput) {
                                    (proximoInput as HTMLInputElement).focus();
                                    (proximoInput as HTMLInputElement).select();
                                  } else {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }
                              }}
                              placeholder={atividadeExpirada ? '🔒 Expirado' : (edicaoBloqueada ? '—' : `0-${obterNotaMaxima(atividade.tipo)}`)}
                              style={{ 
                                width: '100%', 
                                textAlign: 'center', 
                                padding: '6px', 
                                border: `1px solid ${atividadeExpirada ? '#fca5a5' : (edicaoBloqueada ? 'var(--border)' : notaColors.border)}`,
                                borderRadius: '8px', 
                                fontSize: '13px', 
                                fontWeight: 700,
                                background: atividadeExpirada ? '#fff1f2' : (edicaoBloqueada ? '#f1f5f9' : notaColors.bg),
                                color: atividadeExpirada ? '#e11d48' : (edicaoBloqueada ? '#94a3b8' : notaColors.text),
                                outline: 'none',
                                cursor: (atividadeExpirada || edicaoBloqueada) ? 'not-allowed' : 'text',
                                transition: 'background 160ms ease, border-color 160ms ease'
                              }}
                            />
                            {isSaving && (
                              <div style={{ position: 'absolute', top: '2px', right: '2px', fontSize: '9px' }}>⏳</div>
                            )}
                          </div>
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
    </div>
  );
};

export default SharedNotasPage;
