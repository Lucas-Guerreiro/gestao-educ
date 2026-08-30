import React, { useState } from 'react';
import { GradeHoraria, Turma, Materia } from '@/types';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

interface GradeHorariaPageProps {
  gradeHoraria: GradeHoraria[];
  turmas: Turma[];
  materias: Materia[];
  perfil: 'admin' | 'professor';
}

const GradeHorariaPage: React.FC<GradeHorariaPageProps> = ({
  gradeHoraria,
  turmas,
  materias,
  perfil,
}) => {
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Dados do formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDiaSemana, setFormDiaSemana] = useState(1);
  const [formTempo, setFormTempo] = useState('');
  const [formMateriaId, setFormMateriaId] = useState('');
  const [formHorarioInicio, setFormHorarioInicio] = useState('');
  const [formHorarioFim, setFormHorarioFim] = useState('');
  const [formSala, setFormSala] = useState('');

  const diasSemana = [
    { nome: 'Segunda-feira', valor: 1 },
    { nome: 'Terça-feira', valor: 2 },
    { nome: 'Quarta-feira', valor: 3 },
    { nome: 'Quinta-feira', valor: 4 },
    { nome: 'Sexta-feira', valor: 5 },
  ];

  const temposHorarios = [
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

  // Obter grade indexada por [diaSemana][tempo]
  const obterItemGrade = (dia: number, tempo: string) => {
    return gradeHoraria.find(item => 
      item.turmaId === selectedTurmaId && 
      item.diaSemana === dia && 
      item.tempo === tempo
    );
  };

  // Abrir modal para adicionar
  const handleAdicionarClick = (dia: number, tempo: string) => {
    setEditingId(null);
    setFormDiaSemana(dia);
    setFormTempo(tempo);
    setFormMateriaId('');
    setFormHorarioInicio('');
    setFormHorarioFim('');
    setFormSala('');
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleEditarClick = (item: GradeHoraria) => {
    setEditingId(item.id);
    setFormDiaSemana(item.diaSemana);
    setFormTempo(item.tempo);
    setFormMateriaId(item.materiaId);
    setFormHorarioInicio(item.horarioInicio);
    setFormHorarioFim(item.horarioFim);
    setFormSala(item.sala);
    setIsModalOpen(true);
  };

  // Excluir horário da grade
  const handleExcluirClick = async (id: string) => {
    if (!window.confirm('Deseja realmente remover este horário da grade horária?')) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'grade_horaria', id));
    } catch (err) {
      console.error('Erro ao remover da grade:', err);
      alert('Ocorreu um erro ao excluir o horário.');
    } finally {
      setLoading(false);
    }
  };

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurmaId || !formMateriaId || !formHorarioInicio || !formHorarioFim || !formSala) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      const dataPayload = {
        turmaId: selectedTurmaId,
        materiaId: formMateriaId,
        diaSemana: formDiaSemana,
        tempo: formTempo,
        horarioInicio: formHorarioInicio,
        horarioFim: formHorarioFim,
        sala: formSala,
      };

      if (editingId) {
        await updateDoc(doc(db, 'grade_horaria', editingId), dataPayload);
      } else {
        await addDoc(collection(db, 'grade_horaria'), dataPayload);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar horário da grade:', err);
      alert('Ocorreu um erro ao salvar o horário.');
    } finally {
      setLoading(false);
    }
  };

  const getMateriaNome = (id: string) => {
    const mat = materias.find(m => m.id === id);
    return mat ? mat.nome : 'Matéria desconhecida';
  };

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Estilos Embutidos */}
      <style>{`
        .grade-horaria-container {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .grade-horaria-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .grade-horaria-table th {
          background: #f8fafc;
          padding: 12px 10px;
          font-size: 13px;
          font-weight: 800;
          color: var(--text-muted);
          border-bottom: 2px solid var(--border);
          text-align: center;
        }
        .grade-horaria-table td {
          padding: 8px;
          border-bottom: 1px solid var(--border);
          border-right: 1px solid var(--border);
          vertical-align: middle;
          height: 90px;
        }
        .grade-horaria-table td:last-child {
          border-right: none;
        }
        .grade-tempo-cell {
          font-weight: 700;
          color: var(--text-main);
          font-size: 11.5px;
          background: #f8fafc;
          text-align: center;
          width: 130px;
          border-right: 2px solid var(--border) !important;
        }
        .card-aula-grade {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          height: 100%;
          justify-content: space-between;
          position: relative;
          transition: all 0.15s ease;
        }
        .card-aula-grade:hover {
          box-shadow: var(--shadow-sm);
          border-color: #93c5fd;
        }
        .card-aula-materia {
          font-weight: 800;
          color: #1e40af;
          font-size: 12px;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .card-aula-info {
          font-size: 11px;
          color: #1e3a8a;
          opacity: 0.85;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .card-aula-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 4px;
        }
        .btn-action-grade {
          background: none;
          border: none;
          padding: 3px;
          cursor: pointer;
          border-radius: 4px;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.1s ease;
        }
        .btn-action-grade:hover {
          background: #dbeafe;
          color: #1e40af;
        }
        .btn-action-grade.btn-delete:hover {
          background: #fee2e2;
          color: #ef4444;
        }
        .btn-add-grade {
          width: 100%;
          height: 100%;
          min-height: 50px;
          background: none;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          color: #94a3b8;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .btn-add-grade:hover {
          background: #f1f5f9;
          border-color: var(--primary);
          color: var(--primary);
        }
        
        /* Modal Styles */
        .grade-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .grade-modal-content {
          background: #fff;
          border-radius: 16px;
          width: 90%;
          max-width: 440px;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: modalSlideUp 0.2s ease-out;
        }
        @keyframes modalSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .grade-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .grade-modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .grade-modal-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: #f8fafc;
        }
      `}</style>

      {/* Cabeçalho da Página */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            📅 Grade Horária das Disciplinas
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Configure o quadro fixo de horários semanais das matérias por turma.
          </p>
        </div>
      </div>

      {/* Filtro por Turma */}
      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Selecione a Turma:
          </label>
          <select 
            className="input" 
            value={selectedTurmaId}
            onChange={(e) => setSelectedTurmaId(e.target.value)}
            style={{ minWidth: '220px', fontWeight: 700 }}
          >
            <option value="">— Escolher Turma —</option>
            {turmas.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Grade */}
      {selectedTurmaId ? (
        <div className="grade-horaria-container">
          <div style={{ overflowX: 'auto' }}>
            <table className="grade-horaria-table">
              <thead>
                <tr>
                  <th className="grade-tempo-cell">Tempo</th>
                  {diasSemana.map(d => (
                    <th key={d.valor} style={{ minWidth: '160px' }}>{d.nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {temposHorarios.map((tempo) => (
                  <tr key={tempo}>
                    <td className="grade-tempo-cell">{tempo}</td>
                    {diasSemana.map((dia) => {
                      const item = obterItemGrade(dia.valor, tempo);
                      return (
                        <td key={dia.valor}>
                          {item ? (
                            <div className="card-aula-grade">
                              <div>
                                <div className="card-aula-materia" title={getMateriaNome(item.materiaId)}>
                                  {getMateriaNome(item.materiaId)}
                                </div>
                                <div className="card-aula-info">
                                  <span>🕒 {item.horarioInicio} - {item.horarioFim}</span>
                                  <span>📍 {item.sala}</span>
                                </div>
                              </div>
                              <div className="card-aula-actions">
                                <button 
                                  type="button" 
                                  className="btn-action-grade" 
                                  onClick={() => handleEditarClick(item)}
                                  title="Editar horário"
                                  disabled={loading}
                                >
                                  <i className="ti ti-pencil" style={{ fontSize: '13px' }}></i>
                                </button>
                                <button 
                                  type="button" 
                                  className="btn-action-grade btn-delete" 
                                  onClick={() => handleExcluirClick(item.id)}
                                  title="Excluir horário"
                                  disabled={loading}
                                >
                                  <i className="ti ti-trash" style={{ fontSize: '13px' }}></i>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              type="button" 
                              className="btn-add-grade" 
                              onClick={() => handleAdicionarClick(dia.valor, tempo)}
                              title="Adicionar aula neste horário"
                              disabled={loading}
                            >
                              <i className="ti ti-plus"></i>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
          <i className="ti ti-calendar" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}></i>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Selecione uma turma acima para configurar ou visualizar a Grade Horária.</span>
        </div>
      )}

      {/* Modal de Cadastro/Edição de Horário */}
      {isModalOpen && (
        <div className="grade-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="grade-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="grade-modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {editingId ? '✎ Editar Horário da Grade' : '➕ Adicionar Horário na Grade'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)' }}
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="grade-modal-body">
                
                {/* Dia e Tempo (Apenas Leitura) */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Dia da Semana:</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={diasSemana.find(d => d.valor === formDiaSemana)?.nome || ''} 
                      disabled 
                      style={{ background: '#f1f5f9', fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Tempo:</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={formTempo} 
                      disabled 
                      style={{ background: '#f1f5f9', fontWeight: 700, fontSize: '11.5px' }}
                    />
                  </div>
                </div>

                {/* Seleção da Matéria */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Matéria *:</label>
                  <select 
                    className="input" 
                    value={formMateriaId} 
                    onChange={(e) => setFormMateriaId(e.target.value)}
                    required
                    style={{ fontWeight: 700 }}
                  >
                    <option value="">— Selecione a Matéria —</option>
                    {materias.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Horários (Início e Fim) */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Início *:</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="ex: 10:20 ou 10h" 
                      value={formHorarioInicio} 
                      onChange={(e) => setFormHorarioInicio(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Fim *:</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="ex: 11:05 ou 10:45" 
                      value={formHorarioFim} 
                      onChange={(e) => setFormHorarioFim(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Sala de Aula */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Sala de Aula *:</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ex: Sala 19 ou Sala 21" 
                    value={formSala} 
                    onChange={(e) => setFormSala(e.target.value)}
                    required
                  />
                </div>

              </div>
              
              <div className="grade-modal-footer">
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={loading}
                  style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Processando...' : 'Salvar Horário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default GradeHorariaPage;
