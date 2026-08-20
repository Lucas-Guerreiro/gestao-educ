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
  aulas: Aula[];
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
  aulas,
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

  // Estados para criação/edição de capítulos
  const [mostrarFormCapitulo, setMostrarFormCapitulo] = useState(false);
  const [modoFormCapitulo, setModoFormCapitulo] = useState<'criar' | 'editar'>('criar');
  const [capituloNome, setCapituloNome] = useState('');
  const [capituloDescricao, setCapituloDescricao] = useState('');
  const [capituloSalvando, setCapituloSalvando] = useState(false);

  // Estado para visualização das aulas existentes
  const [mostrarAulasExistentes, setMostrarAulasExistentes] = useState(false);

  const aulasExistentesFiltradas = useMemo(() => {
    if (!turmaId || !materiaId) return [];
    return aulas.filter(a => a.turmaId === turmaId && a.materiaId === materiaId)
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [turmaId, materiaId, aulas]);

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

  const handleAbrirFormCapitulo = (modo: 'criar' | 'editar') => {
    setModoFormCapitulo(modo);
    if (modo === 'criar') {
      setCapituloNome('');
      setCapituloDescricao('');
    } else {
      const capituloAtual = capitulos.find(c => c.id === capituloId);
      if (capituloAtual) {
        setCapituloNome(capituloAtual.nome);
        setCapituloDescricao(capituloAtual.descricao || '');
      }
    }
    setMostrarFormCapitulo(true);
  };

  const handleCancelarCapitulo = () => {
    setMostrarFormCapitulo(false);
    setCapituloNome('');
    setCapituloDescricao('');
  };

  const handleSalvarCapitulo = async () => {
    if (!capituloNome.trim() || !turmaId || !materiaId) return;

    setCapituloSalvando(true);
    setSyncStatus('saving');

    try {
      if (modoFormCapitulo === 'criar') {
        const novoCapitulo = {
          turmaId,
          materiaId,
          nome: capituloNome.trim(),
          descricao: capituloDescricao.trim()
        };

        const docRef = await addDoc(collection(db, 'capitulos'), novoCapitulo);
        setCapituloId(docRef.id);
      } else {
        if (!capituloId) return;
        const capituloRef = doc(db, 'capitulos', capituloId);
        await updateDoc(capituloRef, {
          nome: capituloNome.trim(),
          descricao: capituloDescricao.trim()
        });
      }

      setSyncStatus('ok');
      setMostrarFormCapitulo(false);
      setCapituloNome('');
      setCapituloDescricao('');
    } catch (error) {
      console.error('Erro ao salvar capitulo:', error);
      setSyncStatus('err');
      alert('Erro ao salvar o capítulo. Tente novamente.');
    } finally {
      setCapituloSalvando(false);
    }
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
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: mostrarAulasExistentes && turmaId && materiaId && !ehEspecial ? '960px' : '520px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s ease' }}>
        
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

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'row' }}>
          {/* Content Form */}
          <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', width: mostrarAulasExistentes && turmaId && materiaId && !ehEspecial ? '50%' : '100%', overflowY: 'auto', padding: '20px', gap: '12px', boxSizing: 'border-box', transition: 'width 0.3s ease' }}>
          
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ margin: 0 }}>Capítulo Mapeado</label>
              {materiaId && !ehEspecial && !mostrarFormCapitulo && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => handleAbrirFormCapitulo('criar')}
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: 0 }}
                  >
                    + Criar Novo
                  </button>
                  {capituloId && (
                    <button 
                      type="button" 
                      onClick={() => handleAbrirFormCapitulo('editar')}
                      style={{ background: 'none', border: 'none', color: '#d97706', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: 0 }}
                    >
                      ✎ Editar
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <select 
              value={capituloId} 
              onChange={(e) => setCapituloId(e.target.value)}
              disabled={!materiaId || ehEspecial || mostrarFormCapitulo}
            >
              <option value="">— selecione —</option>
              {capitulosFiltrados.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>

            {mostrarFormCapitulo && (
              <div style={{ 
                background: '#f8fafc', 
                border: '1px solid #cbd5e1', 
                borderRadius: '8px', 
                padding: '12px', 
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b' }}>
                  {modoFormCapitulo === 'criar' ? 'Criar Novo Capítulo' : 'Editar Capítulo'}
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748b' }}>Nome do Capítulo *</label>
                  <input 
                    type="text" 
                    value={capituloNome} 
                    onChange={(e) => setCapituloNome(e.target.value)}
                    placeholder="Ex: Capítulo 1: Introdução"
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', width: '100%', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748b' }}>Descrição (Opcional)</label>
                  <textarea 
                    value={capituloDescricao} 
                    onChange={(e) => setCapituloDescricao(e.target.value)}
                    placeholder="Breve descrição do conteúdo do capítulo..."
                    rows={2}
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button 
                    type="button" 
                    onClick={handleCancelarCapitulo}
                    style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    onClick={handleSalvarCapitulo}
                    disabled={capituloSalvando || !capituloNome.trim()}
                    style={{ 
                      padding: '4px 10px', 
                      fontSize: '11px', 
                      borderRadius: '6px', 
                      border: 'none', 
                      background: modoFormCapitulo === 'criar' ? '#2563eb' : '#d97706', 
                      color: '#fff', 
                      cursor: 'pointer',
                      fontWeight: 600,
                      opacity: !capituloNome.trim() ? 0.6 : 1
                    }}
                  >
                    {capituloSalvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
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

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexShrink: 0 }}>
            {turmaId && materiaId && !ehEspecial ? (
              <button 
                type="button" 
                className="btn" 
                onClick={() => setMostrarAulasExistentes(!mostrarAulasExistentes)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: mostrarAulasExistentes ? 'var(--primary-light)' : 'none', 
                  borderColor: mostrarAulasExistentes ? 'var(--primary)' : 'var(--border)',
                  color: mostrarAulasExistentes ? 'var(--primary-text)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  padding: '6px 12px'
                }}
              >
                <i className={mostrarAulasExistentes ? "ti ti-chevron-left" : "ti ti-list"}></i>
                {mostrarAulasExistentes ? 'Ocultar Aulas' : `Aulas (${aulasExistentesFiltradas.length})`}
              </button>
            ) : <div />}
            
            <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>
        </form>

        {/* Coluna da Direita: Aulas Existentes */}
        {mostrarAulasExistentes && turmaId && materiaId && !ehEspecial && (
          <div style={{ 
            width: '50%', 
            display: 'flex', 
            flexDirection: 'column', 
            overflowY: 'auto', 
            padding: '20px', 
            gap: '12px', 
            background: '#fafafb', 
            borderLeft: '1px solid var(--border)',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.2s ease-in-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ti ti-calendar-event" style={{ fontSize: '16px' }}></i> Aulas Existentes
              </span>
              <span style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary-text)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                {aulasExistentesFiltradas.length} {aulasExistentesFiltradas.length === 1 ? 'aula' : 'aulas'}
              </span>
            </div>

            {aulasExistentesFiltradas.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', color: 'var(--text-muted)', textAlign: 'center', gap: '8px' }}>
                <i className="ti ti-calendar-off" style={{ fontSize: '32px', color: '#cbd5e1' }}></i>
                <span style={{ fontSize: '12px' }}>Nenhuma aula registrada para esta matéria e turma.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {aulasExistentesFiltradas.map(aula => {
                  const cap = capitulos.find(c => c.id === aula.capituloId);
                  const [ano, mes, dia] = aula.data.split('-');
                  const dataFormatada = `${dia}/${mes}/${ano}`;

                  return (
                    <div 
                      key={aula.id} 
                      style={{ 
                        background: '#fff', 
                        border: '1px solid var(--border)', 
                        borderRadius: '10px', 
                        padding: '12px',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {dataFormatada} — {aula.horario.split(' ')[0]}
                        </span>
                        <span style={{ 
                          fontSize: '9.5px', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: aula.tipo === 'teorica' ? '#dbeafe' : 
                                      aula.tipo === 'pratica' ? '#dcfce7' : 
                                      aula.tipo === 'revisao' ? '#fef9c3' : 
                                      aula.tipo === 'avaliacao' ? '#fee2e2' : '#f1f5f9',
                          color: aula.tipo === 'teorica' ? '#1e40af' : 
                                 aula.tipo === 'pratica' ? '#166534' : 
                                 aula.tipo === 'revisao' ? '#854d0e' : 
                                 aula.tipo === 'avaliacao' ? '#991b1b' : '#475569'
                        }}>
                          {aula.tipo === 'teorica' ? 'Teórica' : 
                           aula.tipo === 'pratica' ? 'Prática' : 
                           aula.tipo === 'revisao' ? 'Revisão' : 
                           aula.tipo === 'avaliacao' ? 'Avaliação' : 
                           aula.tipo === 'pedagogica' ? 'Pedagógica' : 'Outra'}
                        </span>
                      </div>

                      {cap && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4f46e5', fontWeight: 600 }}>
                          <i className="ti ti-bookmark" style={{ fontSize: '12px' }}></i>
                          <span>{cap.nome}</span>
                        </div>
                      )}

                      {aula.descricao && (
                        <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {aula.descricao}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <span style={{ 
                          fontSize: '9.5px', 
                          fontWeight: 700, 
                          color: aula.realizada ? '#166534' : '#b45309',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          <i className={aula.realizada ? "ti ti-circle-check" : "ti ti-circle-dashed"}></i>
                          {aula.realizada ? 'Ministrada' : 'Programada'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ProgramarAulaModal;
