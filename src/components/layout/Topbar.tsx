import React from 'react';
import { Bimestre } from '@/types';

interface TopbarProps {
  currentSec: string;
  abrirSenhaModal: () => void;
  abrirBackupModal: () => void;
  realizarLogout: () => void;
  selectedAno: number;
  anosDisponiveis: number[];
  onAnoChange: (ano: number) => void;
  selectedBimestreId: string;
  bimestresAtivos: Bimestre[];
  onBimestreChange: (id: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const Topbar: React.FC<TopbarProps> = ({
  currentSec,
  abrirSenhaModal,
  abrirBackupModal,
  realizarLogout,
  selectedAno,
  anosDisponiveis,
  onAnoChange,
  selectedBimestreId,
  bimestresAtivos,
  onBimestreChange,
  collapsed,
  setCollapsed,
}) => {
  const sectionMeta: Record<string, { label: string; icon: string }> = {
    'escola': { label: 'Escola Turma', icon: 'ti-building' },
    'alunos': { label: 'Alunos', icon: 'ti-users' },
    'materias': { label: 'Matérias', icon: 'ti-book' },
    'profs': { label: 'Professores', icon: 'ti-user-check' },
    'bim': { label: 'Bimestres', icon: 'ti-calendar' },
    'ativ': { label: 'Atividades', icon: 'ti-clipboard-list' },
    'capitulos': { label: 'Capítulos', icon: 'ti-folder' },
    'aulas': { label: 'Aulas', icon: 'ti-clock-hour-4' },
    'visao-aulas': { label: 'Grade Semanal', icon: 'ti-layout-grid' },
    'sd': { label: 'Seq. Didática', icon: 'ti-notebook' },
    'lan': { label: 'Lançar Notas', icon: 'ti-pencil' },
    'conceito': { label: 'Conceitos', icon: 'ti-star' },
    'visao': { label: 'Visão do Aluno', icon: 'ti-eye' },
    'ranking': { label: 'Ranking', icon: 'ti-trophy' },
    'rel': { label: 'Relatório', icon: 'ti-chart-bar' },
    'apontamentos': { label: 'Apontamento de Alunos', icon: 'ti-checklist' },
  };

  const meta = sectionMeta[currentSec] || { label: 'Painel Geral', icon: 'ti-school' };

  return (
    <div className="topbar">
      <button 
        className="tb-btn tb-menu-toggle" 
        id="btn-toggle-menu-topbar" 
        style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: '8px', 
          width: '36px', 
          height: '36px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          cursor: 'pointer', 
          marginRight: '12px', 
          color: 'var(--text-main)', 
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s ease'
        }}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        <i className="ti ti-menu-2" style={{ fontSize: '18px' }}></i>
      </button>

      <div className="topbar-title" id="topbar-title">
        <i className={`ti ${meta.icon}`}></i> {meta.label}
      </div>

      {/* Seletores Globais (Ano Letivo e Bimestre) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', marginRight: '16px' }}>
        {/* Seletor Global de Ano Letivo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '10px' }}>
          <i className="ti ti-calendar" style={{ color: 'var(--primary)', fontWeight: 'bold' }}></i>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ano Letivo:</span>
          <select 
            value={selectedAno} 
            onChange={(e) => onAnoChange(Number(e.target.value))}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              fontSize: '12.5px', 
              fontWeight: 800, 
              color: 'var(--text-main)', 
              cursor: 'pointer',
              paddingRight: '2px',
              outline: 'none'
            }}
          >
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Seletor Global de Bimestre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '10px' }}>
          <i className="ti ti-calendar-event" style={{ color: 'var(--primary)', fontWeight: 'bold' }}></i>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bimestre:</span>
          <select 
            value={selectedBimestreId} 
            onChange={(e) => onBimestreChange(e.target.value)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              fontSize: '12.5px', 
              fontWeight: 800, 
              color: 'var(--text-main)', 
              cursor: 'pointer',
              paddingRight: '2px',
              outline: 'none'
            }}
          >
            {bimestresAtivos.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="tb-btns">
        <button 
          className="tb-btn" 
          id="btn-alterar-senha" 
          style={{ background: '#334155', color: '#fff' }}
          onClick={abrirSenhaModal}
        >
          <i className="ti ti-lock"></i> Alterar Senha
        </button>
        <button 
          className="tb-btn" 
          id="btn-sair" 
          style={{ background: '#dc2626', color: '#fff' }}
          onClick={realizarLogout}
        >
          <i className="ti ti-logout"></i> Sair
        </button>
        <button 
          className="tb-btn tb-bk" 
          id="btn-backup"
          onClick={abrirBackupModal}
        >
          <i className="ti ti-cloud-upload"></i> Backup
        </button>
      </div>
    </div>
  );
};

export default Topbar;
