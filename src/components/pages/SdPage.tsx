import React from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { SequenciaDidatica, Professor, Turma, Materia, Aula } from '@/types';

interface SdPageProps {
  sequencias: SequenciaDidatica[];
  professores: Professor[];
  turmas: Turma[];
  materias: Materia[];
  aulas: Aula[];
  abrirSdModal: (sdId: string | null) => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const SdPage: React.FC<SdPageProps> = ({
  sequencias,
  professores,
  turmas,
  materias,
  aulas,
  abrirSdModal,
  setSyncStatus,
}) => {

  const deletarSd = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta Sequência Didática?')) return;
    setSyncStatus('saving');
    try {
      await deleteDoc(doc(db, 'sequencias_didaticas', id));
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao excluir Sequência Didática: ' + (err as Error).message);
    }
  };

  // Obter progresso da sequência didática baseada nas aulas ministradas daquela turma e matéria
  const obterProgressoAulas = (turmaId: string, materiaId: string) => {
    const aulasFiltradas = aulas.filter(a => a.turmaId === turmaId && a.materiaId === materiaId);
    const total = aulasFiltradas.length;
    if (total === 0) return { pct: 0, concluido: 0, total: 0 };
    
    const concluido = aulasFiltradas.filter(a => a.realizada).length;
    const pct = Math.round((concluido / total) * 100);
    return { pct, concluido, total };
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Header com Ação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
          Organize e gerencie o planejamento pedagógico e sequências didáticas.
        </div>
        <button className="btn pri" onClick={() => abrirSdModal(null)}>
          <i className="ti ti-plus"></i> Nova Sequência Didática
        </button>
      </div>

      {/* Cards de Sequências Didáticas */}
      {sequencias.length === 0 ? (
        <div className="card-box" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', fontStyle: 'italic', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)' }}>
          Nenhuma Sequência Didática planejada até o momento. Clique em "Nova Sequência Didática" para começar.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {sequencias.map(sd => {
            const prof = professores.find(p => p.id === sd.professorId);
            const tur = turmas.find(t => t.id === sd.turmaId);
            const mat = materias.find(m => m.id === sd.materiaId);
            const prog = obterProgressoAulas(sd.turmaId, sd.materiaId);

            return (
              <div 
                key={sd.id} 
                className="card-box" 
                style={{ 
                  background: '#fff', 
                  borderRadius: '16px', 
                  padding: '1.25rem', 
                  border: '1px solid var(--border)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div>
                  {/* Cabeçalho do Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '11px', background: '#ede9fe', color: '#7c3aed', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                        {sd.nivelEnsino === 'em' ? 'Ensino Médio' : sd.nivelEnsino === 'ef2' ? 'Ensino Fundamental II' : 'Ensino Fundamental I'}
                      </span>
                      <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>
                        📖 {mat ? mat.nome : 'Matéria Excluída'}
                      </h4>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                        🏫 Turma: {tur ? tur.nome : 'Turma Excluída'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => abrirSdModal(sd.id)}>
                        <i className="ti ti-pencil"></i>
                      </button>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => deletarSd(sd.id)}>
                        <i className="ti ti-trash"></i>
                      </button>
                    </div>
                  </div>

                  {/* Informações */}
                  <div style={{ margin: '10px 0', borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Responsável:</span> <b>{prof ? prof.nome : '—'}</b>
                    </div>
                    {sd.bimestre && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Período:</span> <b>{sd.bimestre} {sd.periodo ? `(${sd.periodo})` : ''}</b>
                      </div>
                    )}
                    {sd.objetivo && (
                      <div style={{ marginTop: '4px', background: '#fafafa', padding: '6px 8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>Objetivo Geral:</span>
                        <div style={{ color: 'var(--text-main)', fontWeight: 500, fontSize: '11px', lineHeight: 1.3 }}>{sd.objetivo}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progresso de Aulas Ministradas */}
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <span>Progresso das Aulas</span>
                    <span style={{ color: 'var(--primary)' }}>{prog.pct}% ({prog.concluido}/{prog.total})</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${prog.pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--primary-hover))', borderRadius: '4px', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default SdPage;
