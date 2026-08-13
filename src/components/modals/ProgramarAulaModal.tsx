import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aula, Turma, Materia, Capitulo, Escola, Professor } from '@/types';

interface ProgramarAulaModalProps {
  turmas: Turma[];
  materias: Materia[];
  capitulos: Capitulo[];
  escolas: Escola[];
  professores: Professor[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
  fecharModal: () => void;
  defaultData?: string; // Permitir abrir já com a data pré-selecionada
  aulaEdicao?: Aula | null; // Aula a ser editada (se houver)
}

const ProgramarAulaModal: React.FC<ProgramarAulaModalProps> = ({
  turmas,
  materias,
  capitulos,
  escolas,
  professores,
  setSyncStatus,
  fecharModal,
  defaultData = '',
  aulaEdicao = null
}) => {
  const [data, setData] = useState(aulaEdicao ? aulaEdicao.data : defaultData);
  const [horario, setHorario] = useState(aulaEdicao ? aulaEdicao.horario : '1º Tempo (Manhã)');
  const [turmaId, setTurmaId] = useState(aulaEdicao ? aulaEdicao.turmaId : '');
  const [materiaId, setMateriaId] = useState(aulaEdicao ? aulaEdicao.materiaId : '');
  const [tipo, setTipo] = useState<'teorica' | 'pratica' | 'revisao' | 'avaliacao' | 'pedagogica' | 'outra'>(aulaEdicao ? (aulaEdicao.tipo as any) : 'teorica');
  const [capituloId, setCapituloId] = useState(aulaEdicao ? aulaEdicao.capituloId || '' : '');
  const [realizada, setRealizada] = useState(aulaEdicao ? aulaEdicao.realizada : false);
  const [descricao, setDescricao] = useState(aulaEdicao ? aulaEdicao.descricao || '' : '');
  const [loading, setLoading] = useState(false);

  const horariosDisponiveis = [
    "1º Tempo (Manhã)",
    "2º Tempo (Manhã)",
    "3º Tempo (Manhã)",
    "4º Tempo (Manhã)",
    "5º Tempo (Manhã)",
    "6º Tempo (Manhã)",
    "7º Tempo (Manhã)",
    "1º Tempo (Tarde)",
    "2º Tempo (Tarde)",
    "3º Tempo (Tarde)",
    "4º Tempo (Tarde)",
    "5º Tempo (Tarde)",
    "6º Tempo (Tarde)",
    "7º Tempo (Tarde)"
  ];

  // Filtrar as matérias vinculadas à turma através de qualquer professor, com fallback para as matérias da escola da turma
  const materiasDaTurmaEscola = useMemo(() => {
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
      const turmaSelected = turmas.find(t => t.id === turmaId);
      if (!turmaSelected) return [];
      return materias.filter(m => m.escolaId === turmaSelected.escolaId);
    }

    return materias.filter(m => idsVinculados.has(m.id));
  }, [turmaId, turmas, materias, professores]);

  // Auto-selecionar matéria se houver apenas uma vinculada à turma (somente para novas programações)
  useEffect(() => {
    if (!aulaEdicao && turmaId && materiasDaTurmaEscola.length === 1) {
      setMateriaId(materiasDaTurmaEscola[0].id);
    }
  }, [turmaId, materiasDaTurmaEscola, aulaEdicao]);

  // Filtrar capítulos pela turma e matéria selecionadas
  const capitulosFiltrados = useMemo(() => {
    if (!turmaId || !materiaId) return [];
    return capitulos.filter(c => c.turmaId === turmaId && c.materiaId === materiaId);
  }, [turmaId, materiaId, capitulos]);

  const handleTurmaChange = (id: string) => {
    setTurmaId(id);
    setMateriaId('');
    setCapituloId('');
  };

  const handleMateriaChange = (id: string) => {
    setMateriaId(id);
    setCapituloId('');
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const ehEspecial = turmaId === 'SOP' || turmaId === 'Capela';
    if (!data || !horario || !turmaId || (!ehEspecial && (!materiaId || !tipo))) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    setSyncStatus('saving');
    try {
      const payload = {
        data,
        horario,
        turmaId,
        materiaId: ehEspecial ? '' : materiaId,
        tipo: ehEspecial ? 'outra' : tipo,
        capituloId: ehEspecial ? '' : (capituloId || null),
        realizada,
        descricao: descricao || ''
      };

      if (aulaEdicao) {
        await updateDoc(doc(db, 'aulas', aulaEdicao.id), payload as any);
      } else {
        await addDoc(collection(db, 'aulas'), payload);
      }
      setSyncStatus('ok');
      fecharModal();
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar aula: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const ehEspecial = turmaId === 'SOP' || turmaId === 'Capela';

  return (
    <div id="programar-aula-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 3000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexShrink: 0, color: '#fff', background: 'linear-gradient(135deg, var(--dark), var(--dark-hover))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-calendar-plus" style={{ fontSize: '20px' }}></i>
            <span style={{ fontSize: '15px', fontWeight: 800 }}>
              {aulaEdicao ? 'Editar Aula Agendada' : 'Programar Nova Aula'}
            </span>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.2)', cursor: 'pointer', fontSize: '18px', color: '#fff', lineHeight: 1, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Content Form */}
        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '20px', gap: '12px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Data *</label>
              <input 
                type="date" 
                value={data} 
                onChange={(e) => setData(e.target.value)} 
                required
              />
            </div>
            <div className="f">
              <label>Horário / Tempo *</label>
              <select value={horario} onChange={(e) => setHorario(e.target.value)} required>
                {horariosDisponiveis.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="f">
            <label>Turma Vinculada *</label>
            <select value={turmaId} onChange={(e) => handleTurmaChange(e.target.value)} required>
              <option value="">— selecione —</option>
              {turmas.map(t => {
                const esc = escolas.find(e => e.id === t.escolaId);
                return <option key={t.id} value={t.id}>{t.nome} ({esc ? esc.nome : 'Escola'})</option>;
              })}
              <option value="SOP">SOP (Orientação Pedagógica)</option>
              <option value="Capela">Capela</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Matéria Vinculada {!ehEspecial && '*'}</label>
              <select 
                value={materiaId} 
                onChange={(e) => handleMateriaChange(e.target.value)} 
                disabled={!turmaId || ehEspecial}
                required={!ehEspecial}
              >
                <option value="">— selecione —</option>
                {materiasDaTurmaEscola.map(m => {
                  const esc = escolas.find(e => e.id === m.escolaId);
                  return <option key={m.id} value={m.id}>{m.nome} ({esc ? esc.nome : 'Escola'})</option>;
                })}
              </select>
            </div>

            <div className="f">
              <label>Tipo de Aula {!ehEspecial && '*'}</label>
              <select 
                value={tipo} 
                onChange={(e) => setTipo(e.target.value as any)} 
                disabled={!turmaId || ehEspecial}
                required={!ehEspecial}
              >
                <option value="teorica">Teórica</option>
                <option value="pratica">Prática / Laboratório</option>
                <option value="revisao">Revisão</option>
                <option value="avaliacao">Avaliação</option>
                <option value="pedagogica">Pedagógica</option>
                <option value="outra">Outra</option>
              </select>
            </div>
          </div>

          <div className="f">
            <label>Capítulo Mapeado</label>
            <select 
              value={capituloId} 
              onChange={(e) => setCapituloId(e.target.value)}
              disabled={!materiaId || ehEspecial}
            >
              <option value="">— selecione —</option>
              {capitulosFiltrados.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="f" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <input 
              id="pa-realizada-checkbox"
              type="checkbox" 
              checked={realizada} 
              onChange={(e) => setRealizada(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="pa-realizada-checkbox" style={{ fontSize: '11.5px', cursor: 'pointer', userSelect: 'none', fontWeight: 600, color: 'var(--text-main)' }}>
              Marcar como aula já ministrada (concluída)
            </label>
          </div>

          <div className="f">
            <label>Descrição / Conteúdo Programado</label>
            <textarea 
              value={descricao} 
              onChange={(e) => setDescricao(e.target.value)} 
              placeholder="Descreva o conteúdo que será abordado..."
              rows={3}
              style={{ padding: '8px 12px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px', flexShrink: 0 }}>
            <button type="button" className="btn" onClick={fecharModal} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn pri" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading ? (
                <>⏳ Salvando...</>
              ) : (
                <>
                  <i className="ti ti-device-floppy"></i> {aulaEdicao ? 'Salvar Alterações' : 'Agendar Aula'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProgramarAulaModal;
