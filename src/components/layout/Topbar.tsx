import React from 'react';

interface TopbarProps {
  currentSec: string;
  abrirSenhaModal: () => void;
  abrirBackupModal: () => void;
  realizarLogout: () => void;
  selectedAno: number;
  anosDisponiveis: number[];
  onAnoChange: (ano: number) => void;
}

const Topbar: React.FC<TopbarProps> = ({
  currentSec,
  abrirSenhaModal,
  abrirBackupModal,
  realizarLogout,
  selectedAno,
  anosDisponiveis,
  onAnoChange,
}) => {
  const sectionMeta: Record<string, { label: string; icon: string }> = {
    'escola': { label: 'Escola & Turmas', icon: 'ti-building' },
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
  };

  const meta = sectionMeta[currentSec] || { label: 'Painel Geral', icon: 'ti-school' };

  return (
    <div className="topbar">
      <div className="topbar-title" id="topbar-title">
        <i className={`ti ${meta.icon}`}></i> {meta.label}
      </div>

      {/* Seletor Global de Ano Letivo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '10px', marginLeft: 'auto', marginRight: '16px' }}>
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
