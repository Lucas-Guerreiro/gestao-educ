import React from 'react';

interface SidebarProps {
  currentSec: string;
  setCurrentSec: (sec: string) => void;
  syncStatus: 'ok' | 'saving' | 'err';
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  abrirIAModal: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentSec,
  setCurrentSec,
  syncStatus,
  collapsed,
  setCollapsed,
  abrirIAModal,
}) => {
  const menuItems = [
    { sec: 'escola', label: 'Escola & Turmas', icon: 'ti-building', cat: 'Cadastros' },
    { sec: 'alunos', label: 'Alunos', icon: 'ti-users', cat: 'Cadastros' },
    { sec: 'materias', label: 'Matérias', icon: 'ti-book', cat: 'Cadastros' },
    { sec: 'profs', label: 'Professores', icon: 'ti-user-check', cat: 'Cadastros' },
    
    { sec: 'ia', label: 'IA Geradora', icon: 'ti-sparkles', cat: 'Planejamento', special: true },
    { sec: 'bim', label: 'Bimestres', icon: 'ti-calendar', cat: 'Planejamento' },
    { sec: 'ativ', label: 'Atividades', icon: 'ti-clipboard-list', cat: 'Planejamento' },
    { sec: 'capitulos', label: 'Capítulos', icon: 'ti-folder', cat: 'Planejamento' },
    { sec: 'aulas', label: 'Aulas', icon: 'ti-clock-hour-4', cat: 'Planejamento' },
    { sec: 'visao-aulas', label: 'Grade Semanal', icon: 'ti-layout-grid', cat: 'Planejamento' },
    { sec: 'sd', label: 'Seq. Didática', icon: 'ti-notebook', cat: 'Planejamento' },
    
    { sec: 'lan', label: 'Lançar Notas', icon: 'ti-pencil', cat: 'Notas & Resultados' },
    { sec: 'conceito', label: 'Conceitos', icon: 'ti-star', cat: 'Notas & Resultados' },
    { sec: 'visao', label: 'Visão do Aluno', icon: 'ti-eye', cat: 'Notas & Resultados' },
    { sec: 'ranking', label: 'Ranking', icon: 'ti-trophy', cat: 'Notas & Resultados' },
    { sec: 'rel', label: 'Relatório', icon: 'ti-chart-bar', cat: 'Notas & Resultados' },
  ];

  // Agrupar itens por categoria
  const categories = ['Cadastros', 'Planejamento', 'Notas & Resultados'];

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
                if (item.special) {
                  return (
                    <div 
                      key={item.sec}
                      className="sb-item"
                      id="sb-ia-btn"
                      onClick={abrirIAModal}
                    >
                      <i className={item.icon} style={{ color: '#a78bfa' }}></i>
                      <span style={{ color: '#a78bfa' }}>{item.label}</span>
                      <div className="sb-tooltip">{item.label}</div>
                    </div>
                  );
                }
                
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
