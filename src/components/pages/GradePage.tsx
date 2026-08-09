import React, { useState } from 'react';
import { Aula, Turma, Materia } from '@/types';

interface GradePageProps {
  aulas: Aula[];
  turmas: Turma[];
  materias: Materia[];
  abrirAulaDetalheModal: (aula: Aula) => void;
}

const GradePage: React.FC<GradePageProps> = ({
  aulas,
  turmas,
  materias,
  abrirAulaDetalheModal,
}) => {
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [semanaOffset, setSemanaOffset] = useState(0); // 0 = semana atual, -1 = anterior, 1 = seguinte

  const diasSemana = [
    { nome: 'Segunda-feira', valor: 1 },
    { nome: 'Terça-feira', valor: 2 },
    { nome: 'Quarta-feira', valor: 3 },
    { nome: 'Quinta-feira', valor: 4 },
    { nome: 'Sexta-feira', valor: 5 },
  ];

  const horarios = [
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

  // Obter datas da semana selecionada
  const obterDatasSemana = (offset: number) => {
    const hoje = new Date();
    const diaAtual = hoje.getDay(); // 0 = domingo, 1 = segunda, etc.
    const diffParaSegunda = diaAtual === 0 ? -6 : 1 - diaAtual; // calcular dias para retroceder à segunda-feira
    
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() + diffParaSegunda + (offset * 7));

    const datas = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(segunda);
      d.setDate(segunda.getDate() + i);
      datas.push(d.toISOString().split('T')[0]);
    }
    return datas;
  };

  const datasSemana = obterDatasSemana(semanaOffset);

  const formatarDataCabecalho = (dStr: string) => {
    const partes = dStr.split('-');
    return `${partes[2]}/${partes[1]}`;
  };

  // Filtrar aulas do período e da turma (retorna array de aulas para suportar múltiplas turmas na visualização geral)
  const obterAulasNaCelula = (dataStr: string, horarioStr: string) => {
    return aulas.filter(a => {
      const bateEspacoTempo = a.data === dataStr && a.horario === horarioStr;
      if (!bateEspacoTempo) return false;
      if (selectedTurmaId) {
        return a.turmaId === selectedTurmaId;
      }
      return true;
    });
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Controles de Filtro e Navegação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="f" style={{ minWidth: '220px', maxWidth: '300px' }}>
          <label style={{ fontSize: '10px', fontWeight: 800 }}>Selecione a Turma para filtrar a Grade</label>
          <select value={selectedTurmaId} onChange={(e) => setSelectedTurmaId(e.target.value)}>
            <option value="">— todas as turmas —</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn" onClick={() => setSemanaOffset(semanaOffset - 1)}>
            ◀ Anterior
          </button>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', background: '#fff', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
            Semana de {formatarDataCabecalho(datasSemana[0])} a {formatarDataCabecalho(datasSemana[4])}
          </span>
          <button className="btn" onClick={() => setSemanaOffset(semanaOffset + 1)}>
            Próxima ▶
          </button>
          <button className="btn" onClick={() => setSemanaOffset(0)} style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
            Hoje
          </button>
        </div>
      </div>

      {/* Grid Calendário Semanal Geral */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ width: '140px', padding: '12px 10px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>Horário</th>
              {diasSemana.map((dia, idx) => (
                <th key={dia.valor} style={{ padding: '12px 10px', textAlign: 'center', fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  <div>{dia.nome}</div>
                  <span style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: 600 }}>({formatarDataCabecalho(datasSemana[idx])})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horarios.map(h => (
              <tr key={h} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '14px 10px', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', background: '#fafafa', verticalAlign: 'middle' }}>
                  {h}
                </td>
                {datasSemana.map((dt, idx) => {
                  const aulasNaCelula = obterAulasNaCelula(dt, h);

                  return (
                    <td key={idx} style={{ padding: '8px', verticalAlign: 'top', minHeight: '110px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '90px' }}>
                        {aulasNaCelula.length > 0 ? (
                          aulasNaCelula.map(aula => {
                            const tur = turmas.find(t => t.id === aula.turmaId);
                            const mat = materias.find(m => m.id === aula.materiaId);

                            return (
                              <div 
                                key={aula.id} 
                                onClick={() => abrirAulaDetalheModal(aula)}
                                style={{ 
                                  background: aula.realizada ? '#f0fdf4' : '#eff6ff', 
                                  border: aula.realizada ? '1px solid #bbf7d0' : '1px solid #bfdbfe', 
                                  borderRadius: '10px', 
                                  padding: '8px 10px', 
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  boxShadow: 'var(--shadow-sm)',
                                  transition: 'all 0.15s ease'
                                }}
                                className="weekly-cell-card"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', flexWrap: 'wrap' }}>
                                  <span className={`ali-badge-tipo tipo-aula-${aula.tipo}`} style={{ fontSize: '7.5px', padding: '1px 3.5px' }}>
                                    {aula.tipo.toUpperCase()}
                                  </span>
                                  {aula.realizada && <span style={{ fontSize: '9px' }}>✅</span>}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', lineHeight: 1.2 }}>
                                  {mat ? mat.nome : 'Matéria'}
                                </div>
                                <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  🏫 {tur ? tur.nome : '—'}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          selectedTurmaId ? (
                            <div style={{ border: '2px dashed #f1f5f9', borderRadius: '10px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '20px', fontWeight: 300, minHeight: '90px' }}>
                              +
                            </div>
                          ) : (
                            <div style={{ flex: 1 }} />
                          )
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default GradePage;
