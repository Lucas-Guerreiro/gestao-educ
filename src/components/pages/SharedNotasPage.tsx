import React, { useState, useMemo, useEffect } from 'react';
import { doc, setDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Materia, Bimestre, Atividade, Nota, Escola } from '@/types';
import SharedPlanilhaModal from '../modals/SharedPlanilhaModal';
import ExportarPdfNotasModal from '../modals/ExportarPdfNotasModal';

interface SharedNotasPageProps {
  sharedMap: Record<string, string>;
  sharedAtividadeId: string;
  sharedLinkId?: string;
  linkAtividadesIds?: string[];
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
  sharedLinkId,
  linkAtividadesIds,
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
  const [selectedAtividadeId, setSelectedAtividadeId] = useState('');
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [edicaoBloqueada, setEdicaoBloqueada] = useState(true);
  const [isPlanilhaModalOpen, setIsPlanilhaModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Escuta em tempo real do link compartilhado caso seja acessado via linkId
  const [linkDocAtivIds, setLinkDocAtivIds] = useState<string[]>([]);
  const [linkNome, setLinkNome] = useState('');

  useEffect(() => {
    if (!sharedLinkId) return undefined;
    const docRef = doc(db, 'links_compartilhados', sharedLinkId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data?.atividadesIds)) {
          setLinkDocAtivIds(data.atividadesIds);
        }
        if (data?.nome) {
          setLinkNome(data.nome);
        }
      }
    });
    return () => unsub();
  }, [sharedLinkId]);

  // Consolidar todos os IDs de atividades pertencentes ao link
  const todasAtividadesIdsDoLink = useMemo(() => {
    if (linkDocAtivIds.length > 0) return linkDocAtivIds;
    if (linkAtividadesIds && linkAtividadesIds.length > 0) return linkAtividadesIds;
    return Object.values(sharedMap);
  }, [linkDocAtivIds, linkAtividadesIds, sharedMap]);

  // Lista de objetos de atividades vinculadas ao link
  const atividadesDoLink = useMemo(() => {
    if (todasAtividadesIdsDoLink.length > 0) {
      return atividades.filter(a => todasAtividadesIdsDoLink.includes(a.id));
    }
    return atividades.filter(a => a.id === sharedAtividadeId);
  }, [atividades, todasAtividadesIdsDoLink, sharedAtividadeId]);

  // Turmas permitidas / presentes no link
  const turmasDisponiveis = useMemo(() => {
    const tIds = Array.from(new Set(atividadesDoLink.map(a => a.turmaId)));
    if (tIds.length === 0 && Object.keys(sharedMap).length > 0) {
      return turmas.filter(t => Object.keys(sharedMap).includes(t.id));
    }
    return turmas.filter(t => tIds.includes(t.id));
  }, [turmas, atividadesDoLink, sharedMap]);

  // Pré-selecionar turma se houver apenas uma
  useEffect(() => {
    if (turmasDisponiveis.length === 1 && !selectedTurmaId) {
      setSelectedTurmaId(turmasDisponiveis[0].id);
    }
  }, [turmasDisponiveis, selectedTurmaId]);

  // Atividades da turma selecionada
  const atividadesDaTurma = useMemo(() => {
    if (!selectedTurmaId) return [];
    const list = atividadesDoLink.filter(a => a.turmaId === selectedTurmaId);
    if (list.length === 0) {
      const ativ = atividades.find(a => a.id === sharedMap[selectedTurmaId] || a.id === sharedAtividadeId);
      return ativ ? [ativ] : [];
    }
    return list;
  }, [selectedTurmaId, atividadesDoLink, atividades, sharedMap, sharedAtividadeId]);

  // Auto-selecionar a atividade da turma
  useEffect(() => {
    if (atividadesDaTurma.length > 0) {
      const existe = atividadesDaTurma.some(a => a.id === selectedAtividadeId);
      if (!existe) {
        setSelectedAtividadeId(atividadesDaTurma[0].id);
      }
    } else {
      setSelectedAtividadeId('');
    }
  }, [atividadesDaTurma, selectedAtividadeId]);

  // ID da atividade atualmente selecionada
  const currentAtividadeId = useMemo(() => {
    return selectedAtividadeId || (atividadesDaTurma[0]?.id) || sharedAtividadeId;
  }, [selectedAtividadeId, atividadesDaTurma, sharedAtividadeId]);

  // Detalhes da atividade compartilhada
  const atividade = useMemo(() => {
    return atividades.find(a => a.id === currentAtividadeId) || null;
  }, [atividades, currentAtividadeId]);

  const selectedTurmaObj = useMemo(() => {
    return turmas.find(t => t.id === selectedTurmaId) || null;
  }, [turmas, selectedTurmaId]);

  const escola = useMemo(() => {
    if (!selectedTurmaObj) return null;
    return escolas.find(e => e.id === selectedTurmaObj.escolaId) || null;
  }, [escolas, selectedTurmaObj]);

  const materia = useMemo(() => {
    if (!atividade) return null;
    return materias.find(m => m.id === atividade.materiaId) || null;
  }, [materias, atividade]);

  const bimestre = useMemo(() => {
    if (!atividade) return null;
    return bimestres.find(b => b.id === atividade.bimestreId) || null;
  }, [bimestres, atividade]);

  const atividadeExpirada = useMemo(() => {
    if (!atividade || !atividade.dataLimite) return false;
    const hoje = new Date().toISOString().split('T')[0];
    return hoje > atividade.dataLimite && !atividade.liberadoVencido;
  }, [atividade]);

  // Filtrar alunos ativos da turma selecionada ordenados alfabeticamente
  const alunosFiltrados = useMemo(() => {
    return alunos
      .filter(a => String(a.turmaId) === selectedTurmaId && a.ativo !== false)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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

  // Salvar lote completo de notas via WriteBatch (usado pela Planilha Simples)
  const salvarNotasEmLote = async (notasMap: Record<string, number | null>) => {
    if (!atividade || !selectedTurmaId) return;

    setSyncStatus('saving');
    try {
      const batch = writeBatch(db);

      for (const alunoId in notasMap) {
        const valor = notasMap[alunoId];
        const docId = `${alunoId}_${currentAtividadeId}`;
        const docRef = doc(db, 'notas', docId);

        if (valor === null) {
          batch.set(docRef, {
            alunoId,
            atividadeId: currentAtividadeId,
            turmaId: selectedTurmaId,
            materiaId: atividade.materiaId,
            bimestreId: atividade.bimestreId,
            nota: -1
          });
        } else {
          batch.set(docRef, {
            alunoId,
            atividadeId: currentAtividadeId,
            turmaId: selectedTurmaId,
            materiaId: atividade.materiaId,
            bimestreId: atividade.bimestreId,
            nota: valor
          });
        }
      }

      await batch.commit();
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      console.error('Erro ao salvar notas em lote:', err);
      throw err;
    }
  };

  // Suporte a colar (Ctrl+V) em sequência direta nos campos da tabela
  const handleTablePaste = (e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData || (!pasteData.includes('\n') && !pasteData.includes('\t'))) {
      return;
    }

    e.preventDefault();
    const linhas = pasteData
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    linhas.forEach((linha, i) => {
      const alunoIdx = startIndex + i;
      if (alunoIdx < alunosFiltrados.length) {
        const targetAluno = alunosFiltrados[alunoIdx];
        const partes = linha.split('\t').map(p => p.trim());
        let valorStr = partes[partes.length - 1];
        if (partes.length > 1) {
          const candidato = partes.find(p => !isNaN(Number(p.replace(',', '.'))) && p !== '');
          if (candidato) valorStr = candidato;
        }

        const inputElem = document.getElementById(`shared-input-nota-${alunoIdx}`) as HTMLInputElement;
        if (inputElem) {
          inputElem.value = valorStr;
        }
        salvarNota(targetAluno.id, valorStr);
      }
    });
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
          {linkNome && (
            <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '3px 9px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              🔗 {linkNome}
            </span>
          )}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
          🏫 {escola ? escola.nome : 'Escola'}
        </div>
      </div>

      {/* Main Container */}
      <div style={{ padding: '16px 20px', maxWidth: '860px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        
        {/* Card Informativo do Trabalho */}
        <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '14px 18px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{atividade.nome}</span>
                <span style={{ fontSize: '9.5px', background: colors.bg, color: colors.text, padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                  {atividade.tipo.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '10.5px', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  📖 {materia ? materia.nome : '—'}
                </span>
                <span style={{ fontSize: '10.5px', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  📅 {bimestre ? `${bimestre.nome}${bimestre.ano ? ` (${bimestre.ano})` : ''}` : '—'}
                </span>
                <span style={{ fontSize: '10.5px', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  ⚖️ Peso: {atividade.peso}
                </span>
              </div>
            </div>

            {/* Seleção de Turma e Atividade (quando houver mais de uma vinculada) */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ minWidth: '180px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  Turma para Lançar Notas *
                </label>
                <select 
                  value={selectedTurmaId} 
                  onChange={(e) => setSelectedTurmaId(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', width: '100%', height: '36px', fontWeight: 600, background: '#fff' }}
                >
                  <option value="">— selecione a turma —</option>
                  {turmasDisponiveis.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>

              {selectedTurmaId && atividadesDaTurma.length > 1 && (
                <div style={{ minWidth: '220px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', marginBottom: '4px', display: 'block' }}>
                    Atividade desta Turma ({atividadesDaTurma.length}) *
                  </label>
                  <select 
                    value={selectedAtividadeId} 
                    onChange={(e) => setSelectedAtividadeId(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #3b82f6', fontSize: '13px', width: '100%', height: '36px', fontWeight: 700, background: '#eff6ff', color: '#1e40af' }}
                  >
                    {atividadesDaTurma.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.nome} ({a.tipo.toUpperCase()} - Peso {a.peso})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          {atividade.descricao && (
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
              📝 {atividade.descricao}
            </div>
          )}
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
          <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '14px 18px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              {atividadeExpirada ? (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '8px 12px', fontSize: '11.5px', color: '#e11d48', lineHeight: 1.5, flex: 1 }}>
                  <i className="ti ti-lock" style={{ marginRight: '6px' }}></i>
                  <span>⚠️ <b>Lançamento Expirado:</b> O prazo para digitação destas notas terminou em <b>{atividade.dataLimite ? atividade.dataLimite.split('-').reverse().join('/') : '—'}</b>. O lançamento está temporariamente bloqueado.</span>
                </div>
              ) : (
                <>
                  <div style={{ background: edicaoBloqueada ? '#f8fafc' : '#eff6ff', border: edicaoBloqueada ? '1px solid var(--border)' : '1px solid #bfdbfe', borderRadius: '10px', padding: '8px 12px', fontSize: '11.5px', color: edicaoBloqueada ? 'var(--text-muted)' : '#1e40af', lineHeight: 1.4, flex: 1 }}>
                    <i className={edicaoBloqueada ? "ti ti-lock" : "ti ti-info-circle"}></i>
                    {edicaoBloqueada ? (
                      <span> <b>Visualização Protegida:</b> Digitação bloqueada. Clique em <b>"Habilitar Edição"</b> para alterar.</span>
                    ) : (
                      <span> <b>Lançamento Ativo:</b> Notas salvas automaticamente. Pressione <b>Enter</b> para avançar ao próximo aluno.</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setIsPdfModalOpen(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid #dc2626',
                        background: '#dc2626',
                        color: '#fff',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.15s ease',
                        userSelect: 'none'
                      }}
                      title="Exportar uma ou mais notas em arquivo PDF formatado para impressão"
                    >
                      <i className="ti ti-file-text" style={{ fontSize: '15px' }}></i>
                      Exportar PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPlanilhaModalOpen(true)}
                      disabled={atividadeExpirada}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: atividadeExpirada ? 'not-allowed' : 'pointer',
                        border: '1px solid #16a34a',
                        background: '#16a34a',
                        color: '#fff',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.15s ease',
                        userSelect: 'none'
                      }}
                      title="Abrir planilha simples para lançar, colar do Excel ou importar notas em lote"
                    >
                      <i className="ti ti-file-spreadsheet" style={{ fontSize: '15px' }}></i>
                      Lançar por Planilha
                    </button>

                    <button
                      type="button"
                      onClick={() => setEdicaoBloqueada(prev => !prev)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
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
                  </div>
                </>
              )}
            </div>

            {/* Container da Tabela com Altura Expandida para Exibir Mais de 10 Alunos */}
            <div style={{
              overflowY: 'auto',
              minHeight: '460px',
              maxHeight: 'min(72vh, 650px)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-sm)',
              background: '#fff'
            }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontWeight: 800 }}>
                    <th style={{ padding: '9px 10px', textAlign: 'center', width: '50px', position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                      #
                    </th>
                    <th style={{ padding: '9px 14px', textAlign: 'left', minWidth: '220px', position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
                      Nome do Aluno ({alunosFiltrados.length})
                    </th>
                    <th style={{ padding: '9px 12px', textAlign: 'center', width: '160px', position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: 'inset 0 -2px 0 var(--border)' }}>
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
                      <tr
                        key={aluno.id}
                        className="table-row-hover"
                        style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                      >
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                          #{String(idx + 1).padStart(2, '0')}
                        </td>

                        <td style={{ padding: '6px 14px', fontWeight: 600, color: 'var(--text-main)', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                          {aluno.nome}
                        </td>
                        
                        <td style={{ padding: '4px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '90px' }}>
                            <input 
                              key={`${aluno.id}_${notaVal}`}
                              id={`shared-input-nota-${idx}`}
                              defaultValue={notaVal}
                              disabled={edicaoBloqueada || atividadeExpirada}
                              onPaste={(e) => handleTablePaste(e, idx)}
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
                                padding: '4px 8px', 
                                height: '32px',
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

      {/* Modal de Lançamento por Planilha Simples */}
      {isPlanilhaModalOpen && atividade && selectedTurmaObj && (
        <SharedPlanilhaModal
          atividade={atividade}
          turma={selectedTurmaObj}
          alunos={alunosFiltrados}
          obterNotaValor={obterNotaValor}
          obterNotaMaxima={obterNotaMaxima}
          fecharModal={() => setIsPlanilhaModalOpen(false)}
          onSalvarLote={salvarNotasEmLote}
          atividadeExpirada={atividadeExpirada}
        />
      )}

      {/* Modal de Exportação de Notas em PDF */}
      {isPdfModalOpen && atividade && selectedTurmaObj && (
        <ExportarPdfNotasModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          escolaNome={escola ? escola.nome : 'Escola'}
          turmaNome={selectedTurmaObj.nome}
          materiaNome={materia ? materia.nome : '—'}
          bimestreNome={bimestre ? `${bimestre.nome}${bimestre.ano ? ` (${bimestre.ano})` : ''}` : '—'}
          atividade={atividade}
          todasAtividades={atividadesDaTurma}
          alunos={alunosFiltrados}
          obterNotaValor={(alunoId, ativId) => {
            const idParaBuscar = ativId || atividade.id;
            const reg = notas.find(n => n.alunoId === alunoId && n.atividadeId === idParaBuscar);
            if (!reg || reg.nota === undefined || reg.nota === -1) return '';
            return String(reg.nota);
          }}
          obterNotaMaxima={obterNotaMaxima}
        />
      )}
    </div>
  );
};

export default SharedNotasPage;
