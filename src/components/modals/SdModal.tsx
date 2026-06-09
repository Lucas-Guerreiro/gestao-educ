import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { SequenciaDidatica, Professor, Turma, Materia, Capitulo, ExerciciosIA, SdCapitulo } from '@/types';

interface SdModalProps {
  sdId: string | null;
  sds: SequenciaDidatica[];
  professores: Professor[];
  turmas: Turma[];
  materias: Materia[];
  capitulos: Capitulo[];
  exerciciosIA: ExerciciosIA[];
  fecharModal: () => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const SdModal: React.FC<SdModalProps> = ({
  sdId,
  sds,
  professores,
  turmas,
  materias,
  capitulos,
  exerciciosIA,
  fecharModal,
  setSyncStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'capitulos' | 'desenv' | 'aval'>('geral');

  // Fields
  const [professorId, setProfessorId] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [bimestre, setBimestre] = useState('');
  const [cargaHoraria, setCargaHoraria] = useState(0);
  const [periodo, setPeriodo] = useState('');
  const [nivelEnsino, setNivelEnsino] = useState<'ef1' | 'ef2' | 'em'>('ef1');

  const [objetivo, setObjetivo] = useState('');
  const [habilidades, setHabilidades] = useState('');
  const [metodologias, setMetodologias] = useState<string[]>([]);
  const [metodologiasOutras, setMetodologiasOutras] = useState('');
  const [recursos, setRecursos] = useState<string[]>([]);
  const [recursosOutros, setRecursosOutros] = useState('');
  const [nee, setNee] = useState('');

  const [avaliacao, setAvaliacao] = useState('');
  const [autorregulacao, setAutorregulacao] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Selected chapters and their exercises
  const [selectedCaps, setSelectedCaps] = useState<SdCapitulo[]>([]);

  // Standard checklists
  const metodologiasPadrao = [
    'Aula Expositiva',
    'Trabalho em Grupo',
    'Estudo de Caso',
    'Sala de Aula Invertida',
    'Projetos Práticos',
    'Gamificação'
  ];

  const recursosPadrao = [
    'Quadro / Pincel',
    'Projetor / Slides',
    'Computador / Internet',
    'Material Impresso',
    'Laboratório de Ciências',
    'Lego / Robótica'
  ];

  useEffect(() => {
    if (sdId) {
      const sd = sds.find(s => s.id === sdId);
      if (sd) {
        setProfessorId(sd.professorId || '');
        setTurmaId(sd.turmaId || '');
        setMateriaId(sd.materiaId || '');
        setBimestre(sd.bimestre || '');
        setCargaHoraria(sd.cargaHoraria || 0);
        setPeriodo(sd.periodo || '');
        setNivelEnsino(sd.nivelEnsino || 'ef1');
        setObjetivo(sd.objetivo || '');
        setHabilidades(sd.habilidades || '');
        setMetodologias(sd.metodologias || []);
        setMetodologiasOutras(sd.metodologiasOutras || '');
        setRecursos(sd.recursos || []);
        setRecursosOutros(sd.recursosOutros || '');
        setNee(sd.nee || '');
        setAvaliacao(sd.avaliacao || '');
        setAutorregulacao(sd.autorregulacao || '');
        setObservacoes(sd.observacoes || '');
        setSelectedCaps(sd.capitulos || []);
      }
    } else {
      setProfessorId('');
      setTurmaId('');
      setMateriaId('');
      setBimestre('');
      setCargaHoraria(0);
      setPeriodo('');
      setNivelEnsino('ef1');
      setObjetivo('');
      setHabilidades('');
      setMetodologias([]);
      setMetodologiasOutras('');
      setRecursos([]);
      setRecursosOutros('');
      setNee('');
      setAvaliacao('');
      setAutorregulacao('');
      setObservacoes('');
      setSelectedCaps([]);
    }
  }, [sdId, sds]);

  const toggleMetodologia = (met: string) => {
    if (metodologias.includes(met)) {
      setMetodologias(metodologias.filter(m => m !== met));
    } else {
      setMetodologias([...metodologias, met]);
    }
  };

  const toggleRecurso = (rec: string) => {
    if (recursos.includes(rec)) {
      setRecursos(recursos.filter(r => r !== rec));
    } else {
      setRecursos([...recursos, rec]);
    }
  };

  // Filtrar as matérias vinculadas à turma e professor selecionados (com fallback para as matérias da escola)
  const materiasFiltradas = useMemo(() => {
    if (!turmaId) return [];
    const turmaSelected = turmas.find(t => t.id === turmaId);
    if (!turmaSelected) return [];

    const idsVinculados = new Set<string>();
    
    // Se houver professor selecionado, tentamos filtrar pelos seus vínculos específicos para esta turma
    const profSelected = professores.find(p => p.id === professorId);
    if (profSelected && profSelected.vinculos) {
      profSelected.vinculos.forEach(v => {
        if (v.turmaId === turmaId) {
          v.materias.forEach(mid => idsVinculados.add(mid));
        }
      });
    } else {
      // Se não houver professor específico selecionado, buscamos os vínculos de qualquer professor para esta turma
      professores.forEach(prof => {
        if (prof.vinculos) {
          prof.vinculos.forEach(v => {
            if (v.turmaId === turmaId) {
              v.materias.forEach(mid => idsVinculados.add(mid));
            }
          });
        }
      });
    }

    if (idsVinculados.size === 0) {
      return materias.filter(m => m.escolaId === turmaSelected.escolaId);
    }

    return materias.filter(m => idsVinculados.has(m.id));
  }, [turmaId, professorId, professores, materias, turmas]);

  // Filter chapters of selected Class/Subject
  const capitulosFiltrados = capitulos.filter(c => c.turmaId === turmaId && c.materiaId === materiaId);

  const toggleCapitulo = (capId: string) => {
    const existe = selectedCaps.some(c => c.capituloId === capId);
    if (existe) {
      setSelectedCaps(selectedCaps.filter(c => c.capituloId !== capId));
    } else {
      setSelectedCaps([...selectedCaps, { capituloId: capId, exercicios: [] }]);
    }
  };

  const toggleExercicioNoCapitulo = (capId: string, exId: string) => {
    setSelectedCaps(selectedCaps.map(c => {
      if (c.capituloId === capId) {
        const jaTem = c.exercicios.includes(exId);
        return {
          ...c,
          exercicios: jaTem 
            ? c.exercicios.filter(id => id !== exId) 
            : [...c.exercicios, exId]
        };
      }
      return c;
    }));
  };

  const salvar = async () => {
    if (!professorId || !turmaId || !materiaId) {
      alert('Por favor, preencha o Professor, Turma e Matéria na aba Geral.');
      return;
    }

    const payload = {
      professorId,
      turmaId,
      materiaId,
      bimestre,
      cargaHoraria,
      periodo,
      nivelEnsino,
      objetivo: objetivo.trim(),
      habilidades: habilidades.trim(),
      metodologias,
      metodologiasOutras: metodologiasOutras.trim(),
      recursos,
      recursosOutros: recursosOutros.trim(),
      nee: nee.trim(),
      avaliacao: avaliacao.trim(),
      autorregulacao: autorregulacao.trim(),
      observacoes: observacoes.trim(),
      capitulos: selectedCaps,
    };

    setSyncStatus('saving');
    try {
      if (sdId) {
        await updateDoc(doc(db, 'sequencias_didaticas', sdId), payload);
      } else {
        await addDoc(collection(db, 'sequencias_didaticas'), payload);
      }
      setSyncStatus('ok');
      fecharModal();
    } catch (err: any) {
      setSyncStatus('err');
      alert('Erro ao salvar Sequência Didática: ' + err.message);
    }
  };

  return (
    <div id="sd-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 3000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '780px', maxHeight: '90vh', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
            {sdId ? '🚀 Editar Sequência Didática' : '🚀 Nova Sequência Didática'}
          </span>
          <button onClick={fecharModal} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}>✕</button>
        </div>

        {/* Tab Headers */}
        <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button 
            className={`tab-btn-modal ${activeTab === 'geral' ? 'active' : ''}`}
            onClick={() => setActiveTab('geral')}
            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', borderBottom: activeTab === 'geral' ? '2.5px solid var(--primary)' : 'none', fontWeight: activeTab === 'geral' ? 700 : 500, color: activeTab === 'geral' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
          >
            📋 1. Geral
          </button>
          <button 
            className={`tab-btn-modal ${activeTab === 'capitulos' ? 'active' : ''}`}
            onClick={() => setActiveTab('capitulos')}
            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', borderBottom: activeTab === 'capitulos' ? '2.5px solid var(--primary)' : 'none', fontWeight: activeTab === 'capitulos' ? 700 : 500, color: activeTab === 'capitulos' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
          >
            📖 2. Capítulos & Exercícios
          </button>
          <button 
            className={`tab-btn-modal ${activeTab === 'desenv' ? 'active' : ''}`}
            onClick={() => setActiveTab('desenv')}
            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', borderBottom: activeTab === 'desenv' ? '2.5px solid var(--primary)' : 'none', fontWeight: activeTab === 'desenv' ? 700 : 500, color: activeTab === 'desenv' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
          >
            ⚙️ 3. Desenvolvimento
          </button>
          <button 
            className={`tab-btn-modal ${activeTab === 'aval' ? 'active' : ''}`}
            onClick={() => setActiveTab('aval')}
            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', borderBottom: activeTab === 'aval' ? '2.5px solid var(--primary)' : 'none', fontWeight: activeTab === 'aval' ? 700 : 500, color: activeTab === 'aval' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
          >
            🎯 4. Avaliação
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
          
          {/* TAB 1: GERAL */}
          {activeTab === 'geral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="f">
                  <label>Professor Responsável *</label>
                  <select value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
                    <option value="">— selecione —</option>
                    {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="f">
                  <label>Turma de Aplicação *</label>
                  <select value={turmaId} onChange={(e) => { setTurmaId(e.target.value); setSelectedCaps([]); }}>
                    <option value="">— selecione —</option>
                    {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="f">
                  <label>Matéria Vinculada *</label>
                  <select value={materiaId} onChange={(e) => { setMateriaId(e.target.value); setSelectedCaps([]); }}>
                    <option value="">— selecione —</option>
                    {materiasFiltradas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div className="f">
                  <label>Bimestre</label>
                  <input value={bimestre} onChange={(e) => setBimestre(e.target.value)} placeholder="Ex: 1º Bimestre" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="f">
                  <label>Carga Horária (horas)</label>
                  <input type="number" min="0" value={cargaHoraria} onChange={(e) => setCargaHoraria(parseInt(e.target.value) || 0)} />
                </div>
                <div className="f">
                  <label>Período de Realização</label>
                  <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex: Mai/2026 - Jun/2026" />
                </div>
                <div className="f">
                  <label>Nível de Ensino</label>
                  <select value={nivelEnsino} onChange={(e) => setNivelEnsino(e.target.value as any)}>
                    <option value="ef1">Ensino Fundamental I</option>
                    <option value="ef2">Ensino Fundamental II</option>
                    <option value="em">Ensino Médio</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CAPÍTULOS & EXERCÍCIOS */}
          {activeTab === 'capitulos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <i className="ti ti-info-circle" style={{ color: 'var(--primary)', marginRight: '4px' }}></i>
                Selecione os capítulos correspondentes à matéria desta turma. Para cada capítulo, marque quais exercícios gerados pela Inteligência Artificial farão parte do plano didático.
              </div>

              {!turmaId || !materiaId ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', background: '#fafafa', borderRadius: '10px' }}>
                  ⚠️ Selecione a Turma e a Matéria na aba Geral para listar os capítulos disponíveis.
                </div>
              ) : capitulosFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', background: '#fafafa', borderRadius: '10px' }}>
                  Nenhum capítulo cadastrado para a turma e matéria selecionadas. Crie capítulos no painel ou use a IA Geradora para criá-los.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {capitulosFiltrados.map(cap => {
                    const capSd = selectedCaps.find(c => c.capituloId === cap.id);
                    const isChecked = !!capSd;

                    return (
                      <div key={cap.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: isChecked ? '#fff' : '#fafafa' }}>
                        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', background: isChecked ? '#eff6ff' : '#f1f5f9', borderBottom: isChecked ? '1px solid #bfdbfe' : 'none' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => toggleCapitulo(cap.id)} 
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{cap.nome}</div>
                            {cap.descricao && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cap.descricao}</div>}
                          </div>
                        </div>

                        {/* List exercises if chapter is checked */}
                        {isChecked && capSd && (
                          <div style={{ padding: '12px 14px', borderTop: 'none', background: '#fff' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', marginBottom: '8px', letterSpacing: '0.5px' }}>📌 EXERCÍCIOS IA VINCULADOS:</div>
                            {exerciciosIA.length === 0 ? (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Nenhum exercício no banco da IA. Crie exercicios através da IA Geradora.
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {exerciciosIA.map(ex => {
                                  const exChecked = capSd.exercicios.includes(ex.id);
                                  return (
                                    <div 
                                      key={ex.id} 
                                      onClick={() => toggleExercicioNoCapitulo(cap.id, ex.id)}
                                      style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px', border: exChecked ? '1px solid #c084fc' : '1px solid #e2e8f0', borderRadius: '8px', background: exChecked ? '#faf5ff' : '#f8fafc', cursor: 'pointer', transition: '0.15s' }}
                                    >
                                      <input 
                                        type="checkbox" 
                                        checked={exChecked} 
                                        readOnly 
                                        style={{ width: '14px', height: '14px', marginTop: '2px', cursor: 'pointer' }}
                                      />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>{ex.nome}</div>
                                        <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>{ex.desc}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DESENVOLVIMENTO */}
          {activeTab === 'desenv' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="f">
                <label>Objetivo Geral</label>
                <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Quais são os principais objetivos de aprendizagem desta sequência?" style={{ height: '60px' }} />
              </div>

              <div className="f">
                <label>Habilidades (Códigos BNCC)</label>
                <input value={habilidades} onChange={(e) => setHabilidades(e.target.value)} placeholder="Ex: EF08MA01, EF08MA02" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="f">
                  <label>Metodologias de Ensino</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    {metodologiasPadrao.map(met => (
                      <label key={met} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={metodologias.includes(met)} 
                          onChange={() => toggleMetodologia(met)} 
                        />
                        {met}
                      </label>
                    ))}
                    <input 
                      style={{ marginTop: '6px', height: '28px', fontSize: '11px', padding: '0 8px' }} 
                      value={metodologiasOutras} 
                      onChange={(e) => setMetodologiasOutras(e.target.value)} 
                      placeholder="Outras metodologias..." 
                    />
                  </div>
                </div>

                <div className="f">
                  <label>Recursos Didáticos</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    {recursosPadrao.map(rec => (
                      <label key={rec} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={recursos.includes(rec)} 
                          onChange={() => toggleRecurso(rec)} 
                        />
                        {rec}
                      </label>
                    ))}
                    <input 
                      style={{ marginTop: '6px', height: '28px', fontSize: '11px', padding: '0 8px' }} 
                      value={recursosOutros} 
                      onChange={(e) => setRecursosOutros(e.target.value)} 
                      placeholder="Outros recursos..." 
                    />
                  </div>
                </div>
              </div>

              <div className="f">
                <label>Adaptações para NEE (Necessidades Educacionais Especiais)</label>
                <textarea value={nee} onChange={(e) => setNee(e.target.value)} placeholder="Descreva adaptações curriculares necessárias para alunos com deficiência, TDAH, autismo, etc." style={{ height: '56px' }} />
              </div>
            </div>
          )}

          {/* TAB 4: AVALIAÇÃO */}
          {activeTab === 'aval' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="f">
                <label>Formas de Avaliação</label>
                <textarea value={avaliacao} onChange={(e) => setAvaliacao(e.target.value)} placeholder="Quais instrumentos avaliativos serão utilizados? (provas, seminários, participação, autoavaliação)" style={{ height: '70px' }} />
              </div>

              <div className="f">
                <label>Estratégia de Autorregulação e Feedback</label>
                <textarea value={autorregulacao} onChange={(e) => setAutorregulacao(e.target.value)} placeholder="Como os alunos receberão feedback? Como farão a autorreflexão de sua aprendizagem?" style={{ height: '65px' }} />
              </div>

              <div className="f">
                <label>Observações Pedagógicas</label>
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações gerais adicionais de caráter pedagógico..." style={{ height: '65px' }} />
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: '8px', padding: '14px 20px', borderTop: '1px solid var(--border)', justifyContent: 'flex-end', background: '#f8fafc', flexShrink: 0 }}>
          <button className="btn" onClick={fecharModal}>Cancelar</button>
          <button className="btn pri" onClick={salvar}>
            <i className="ti ti-device-floppy"></i> Salvar Sequência
          </button>
        </div>

      </div>
    </div>
  );
};

export default SdModal;
