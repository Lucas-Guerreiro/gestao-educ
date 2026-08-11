import React from 'react';
import { Aula, Turma, Materia, Capitulo, SequenciaDidatica, ExerciciosIA } from '@/types';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface AulaDetalheModalProps {
  aula: Aula | null;
  turmas: Turma[];
  materias: Materia[];
  capitulos: Capitulo[];
  sequencias: SequenciaDidatica[];
  exerciciosIA: ExerciciosIA[];
  fecharModal: () => void;
}

const AulaDetalheModal: React.FC<AulaDetalheModalProps> = ({
  aula,
  turmas,
  materias,
  capitulos,
  sequencias,
  exerciciosIA,
  fecharModal,
}) => {
  if (!aula) return null;

  const tur = turmas.find(t => t.id === aula.turmaId);
  const mat = materias.find(m => m.id === aula.materiaId);
  const cap = capitulos.find(c => c.id === aula.capituloId);

  // Procurar se esse capítulo possui exercícios mapeados em alguma Sequência Didática
  const exerciciosVinculados: ExerciciosIA[] = [];
  if (cap) {
    sequencias.forEach(sd => {
      if (sd.turmaId === aula.turmaId && sd.materiaId === aula.materiaId && sd.capitulos) {
        const capSd = sd.capitulos.find(c => c.capituloId === cap.id);
        if (capSd && capSd.exercicios && capSd.exercicios.length > 0) {
          capSd.exercicios.forEach(exId => {
            const ex = exerciciosIA.find(e => e.id === exId);
            if (ex && !exerciciosVinculados.some(e => e.id === ex.id)) {
              exerciciosVinculados.push(ex);
            }
          });
        }
      }
    });
  }

  const formatarDataExibicao = (dataStr: string) => {
    if (!dataStr) return '';
    const partes = dataStr.split('-');
    if (partes.length !== 3) return dataStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  return (
    <div id="aula-detalhe-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 3000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        <div id="ad-header" style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexShrink: 0, color: '#fff', background: 'linear-gradient(135deg, var(--dark), var(--dark-hover))' }}>
          <div style={{ flex: 1 }}>
            {!(aula.turmaId === 'SOP' || aula.turmaId === 'Capela') ? (
              <div className={`ali-badge-tipo tipo-aula-${aula.tipo}`} style={{ marginBottom: '6px' }}>
                {aula.tipo.toUpperCase()}
              </div>
            ) : (
              <div style={{ display: 'inline-block', background: '#d8b4fe', color: '#581c87', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                EVENTO ESPECIAL
              </div>
            )}
            <div id="ad-titulo" style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.3 }}>
              {aula.turmaId === 'SOP' || aula.turmaId === 'Capela' ? aula.turmaId.toUpperCase() : (mat ? mat.nome : 'Matéria Não Vinculada')}
            </div>
            <div id="ad-meta" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span><i className="ti ti-calendar"></i> {formatarDataExibicao(aula.data)}</span>
              <span><i className="ti ti-clock"></i> {aula.horario}</span>
              {!(aula.turmaId === 'SOP' || aula.turmaId === 'Capela') && (
                <span><i className="ti ti-users"></i> Turma: {tur ? tur.nome : '—'}</span>
              )}
            </div>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.2)', cursor: 'pointer', fontSize: '18px', color: '#fff', lineHeight: 1, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
          {cap ? (
            <div id="ad-cap" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#1e40af', lineHeight: 1.5 }}>
              <strong>{cap.nome}</strong><br />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cap.descricao || 'Sem descrição.'}</span>
            </div>
          ) : null}

          {aula.descricao ? (
            <div id="ad-desc" style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.6 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>
                📝 Descrição / Conteúdo da Aula
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{aula.descricao}</div>
            </div>
          ) : null}
          
          {exerciciosVinculados.length > 0 ? (
            <div id="ad-exercicios-section">
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-clipboard-list" style={{ fontSize: '14px', color: 'var(--primary)' }}></i> Exercícios da Sequência Didática
              </div>
              <div id="ad-exercicios">
                {exerciciosVinculados.map((ex, idx) => (
                  <div key={ex.id} className="exer-ia-card">
                    <div className="exer-ia-num">{idx + 1}</div>
                    <div className="exer-ia-body">
                      <div className="exer-ia-nome">{ex.nome}</div>
                      <div className="exer-ia-desc">{ex.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !(aula.turmaId === 'SOP' || aula.turmaId === 'Capela') && (
              <div id="ad-sem-atividades" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                Nenhuma atividade programada para esta aula.
              </div>
            )
          )}
          
          <div id="ad-realizada-badge" style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {aula.realizada ? (
              <div style={{ background: 'var(--success-light)', color: 'var(--success-text)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-circle-check" style={{ fontSize: '16px' }}></i> Aula ministrada e concluída!
              </div>
            ) : (
              <div style={{ background: 'var(--warning-light)', color: 'var(--warning-text)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-clock" style={{ fontSize: '16px' }}></i> Planejada (ministração pendente)
              </div>
            )}

            <button
              onClick={async () => {
                try {
                  await updateDoc(doc(db, 'aulas', aula.id), { realizada: !aula.realizada });
                } catch (err) {
                  console.error("Erro ao atualizar status de conclusão da aula:", err);
                }
              }}
              style={{
                width: '100%',
                height: '40px',
                background: aula.realizada ? '#f1f5f9' : 'linear-gradient(135deg, #10b981, #059669)',
                border: '1px solid ' + (aula.realizada ? '#cbd5e1' : '#059669'),
                borderRadius: '10px',
                color: aula.realizada ? 'var(--text-main)' : '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <i className={aula.realizada ? "ti ti-arrow-back" : "ti ti-circle-check"}></i>
              {aula.realizada ? "Marcar como Planejada (Desfazer)" : "Marcar como Aula Já Ministrada (Concluída)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AulaDetalheModal;
