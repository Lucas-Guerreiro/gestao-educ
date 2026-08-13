import React from 'react';

interface SidebarProps {
  currentSec: string;
  setCurrentSec: (sec: string) => void;
  syncStatus: 'ok' | 'saving' | 'err';
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  perfil?: 'admin' | 'professor';
}

const Sidebar: React.FC<SidebarProps> = ({
  currentSec,
  setCurrentSec,
  syncStatus,
  collapsed,
  setCollapsed,
  perfil = 'admin',
}) => {
  const menuItems = perfil === 'professor' ? [
    { sec: 'visao-aulas', label: 'Grade Semanal', icon: 'ti-layout-grid', cat: 'Professor' },
    { sec: 'aulas', label: 'Aulas', icon: 'ti-clock-hour-4', cat: 'Professor' },
    { sec: 'capitulos', label: 'Capítulos', icon: 'ti-folder', cat: 'Professor' },
    { sec: 'ativ', label: 'Atividades', icon: 'ti-clipboard-list', cat: 'Professor' },
    { sec: 'lan', label: 'Lançar Notas', icon: 'ti-pencil', cat: 'Professor' },
  ] : [
    { sec: 'escola', label: 'Escola Turma', icon: 'ti-building', cat: 'Cadastros' },
    { sec: 'profs', label: 'Professores', icon: 'ti-user-check', cat: 'Cadastros' },
    { sec: 'bim', label: 'Bimestres', icon: 'ti-calendar', cat: 'Cadastros' },
    { sec: 'materias', label: 'Matérias', icon: 'ti-book', cat: 'Cadastros' },
    { sec: 'alunos', label: 'Alunos', icon: 'ti-users', cat: 'Cadastros' },
    
    { sec: 'capitulos', label: 'Capítulos', icon: 'ti-folder', cat: 'Planejamentos' },
    { sec: 'aulas', label: 'Aulas', icon: 'ti-clock-hour-4', cat: 'Planejamentos' },
    { sec: 'ativ', label: 'Atividades', icon: 'ti-clipboard-list', cat: 'Planejamentos' },
    { sec: 'visao-aulas', label: 'Grade Semanal', icon: 'ti-layout-grid', cat: 'Planejamentos' },
    { sec: 'sd', label: 'Seq. Didática', icon: 'ti-notebook', cat: 'Planejamentos' },
    
    { sec: 'lan', label: 'Lançar Notas', icon: 'ti-pencil', cat: 'Notas & Resultados' },
    { sec: 'conceito', label: 'Conceitos', icon: 'ti-star', cat: 'Notas & Resultados' },
    { sec: 'visao', label: 'Visão do Aluno', icon: 'ti-eye', cat: 'Notas & Resultados' },
    { sec: 'ranking', label: 'Ranking', icon: 'ti-trophy', cat: 'Notas & Resultados' },
    { sec: 'rel', label: 'Relatório', icon: 'ti-chart-bar', cat: 'Notas & Resultados' },
    { sec: 'apontamentos', label: 'Apontamentos', icon: 'ti-checklist', cat: 'Notas & Resultados' },
    { sec: 'provas', label: 'Provas Online', icon: 'ti-clipboard-text', cat: 'Notas & Resultados' },
  ];

  // Agrupar itens por categoria
  const categories = perfil === 'professor' ? ['Professor'] : ['Cadastros', 'Planejamentos', 'Notas & Resultados'];

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`} id="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-icon">
          <i className="ti ti-school"></i>
        </div>
        <span className="sb-logo-text">EscolaSystem</span>
      </div>
      
      <div 
        className="sb-toggle" 
        id="sb-toggle-btn"
        onClick={() => setCollapsed(!collapsed)}
      >
        <i className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-left'}`} id="sb-arrow"></i>
      </div>
      
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
        {categories.map(cat => {
          const itemsCat = menuItems.filter(item => item.cat === cat);
          return (
            <React.Fragment key={cat}>
              <div className="sb-section">{cat}</div>
               {itemsCat.map(item => {
                return (
                  <div 
                    key={item.sec}
                    className={`sb-item ${currentSec === item.sec ? 'on' : ''}`}
                    onClick={() => setCurrentSec(item.sec)}
                  >
                    <i className={`ti ${item.icon}`}></i>
                    <span>{item.label}</span>
                    <div className="sb-tooltip">{item.label}</div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      
      <div className="sb-footer">
        <div className="sync-pill">
          {syncStatus === 'ok' && (
            <>
              <i className="ti ti-circle-check sync-ok" id="sync-icon"></i>
              <span id="sync-txt">Sincronizado</span>
            </>
          )}
          {syncStatus === 'saving' && (
            <>
              <i className="ti ti-refresh sync-saving" id="sync-icon"></i>
              <span id="sync-txt">Salvando...</span>
            </>
          )}
          {syncStatus === 'err' && (
            <>
              <i className="ti ti-alert-triangle sync-err" id="sync-icon"></i>
              <span id="sync-txt">Erro no Firestore</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
