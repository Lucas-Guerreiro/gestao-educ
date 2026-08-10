import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import { 
  Escola, Turma, Aluno, Materia, Professor, 
  Bimestre, Atividade, Capitulo, Aula, 
  SequenciaDidatica, Nota, AdminConfig, ExerciciosIA, Apontamento 
} from '@/types';

// Layout & Modals
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import LoginScreen from './components/modals/LoginScreen';
import SenhaModal from './components/modals/SenhaModal';
import BackupModal from './components/modals/BackupModal';
import AulaDetalheModal from './components/modals/AulaDetalheModal';
import IaModal from './components/modals/IaModal';
import SdModal from './components/modals/SdModal';
import AlunoModal from './components/modals/AlunoModal';
import ImportModal from './components/modals/ImportModal';

// Pages
import EscolaPage from './components/pages/EscolaPage';
import AlunosPage from './components/pages/AlunosPage';
import MateriasPage from './components/pages/MateriasPage';
import ProfsPage from './components/pages/ProfsPage';
import BimestresPage from './components/pages/BimestresPage';
import AtividadesPage from './components/pages/AtividadesPage';
import CapitulosPage from './components/pages/CapitulosPage';
import AulasPage from './components/pages/AulasPage';
import GradePage from './components/pages/GradePage';
import SdPage from './components/pages/SdPage';
import NotasPage from './components/pages/NotasPage';
import ConceitosPage from './components/pages/ConceitosPage';
import BoletimPage from './components/pages/BoletimPage';
import RankingPage from './components/pages/RankingPage';
import RelatorioPage from './components/pages/RelatorioPage';
import ApontamentosPage from './components/pages/ApontamentosPage';
import SharedNotasPage from './components/pages/SharedNotasPage';
import ProvasPage from './components/pages/ProvasPage';
import AlunoProvaPage from './components/pages/AlunoProvaPage';

const App: React.FC = () => {
  // Authentication states
  const [autenticado, setAutenticado] = useState(false);
  const [perfil, setPerfil] = useState<'admin' | 'professor'>('admin');
  const [adminConfig, setAdminConfig] = useState<AdminConfig>({ senha: 'admin123' });

  // Navigation state
  const [currentSec, setCurrentSec] = useState('escola');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'ok' | 'saving' | 'err'>('ok');

  // Database Collections States
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [bimestres, setBimestres] = useState<Bimestre[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [capitulos, setCapitulos] = useState<Capitulo[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [sequencias, setSequencias] = useState<SequenciaDidatica[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);

  // Active School Year State
  const [selectedAno, setSelectedAno] = useState<number>(() => {
    const saved = localStorage.getItem('es_ano_ativo');
    return saved ? Number(saved) : new Date().getFullYear();
  });

  const handleAnoChange = (ano: number) => {
    setSelectedAno(ano);
    localStorage.setItem('es_ano_ativo', String(ano));
  };

  // Active Bimestre State
  const [selectedBimestreId, setSelectedBimestreId] = useState<string>(() => {
    return localStorage.getItem('es_bimestre_ativo') || '';
  });

  const handleBimestreChange = (bimestreId: string) => {
    setSelectedBimestreId(bimestreId);
    localStorage.setItem('es_bimestre_ativo', bimestreId);
  };

  // Derive unique school years from bimestres letivos
  const anosDisponiveis = Array.from(new Set(bimestres.map(b => b.ano).filter(Boolean)));
  if (!anosDisponiveis.includes(new Date().getFullYear())) {
    anosDisponiveis.push(new Date().getFullYear());
  }
  anosDisponiveis.sort((a, b) => b - a);

  // Active year filters
  const bimestresAtivos = bimestres.filter(b => {
    const bAno = b.ano || new Date().getFullYear();
    return bAno === selectedAno;
  });

  // Synchronize/Default selectedBimestreId when year changes or on load
  useEffect(() => {
    if (bimestresAtivos.length > 0) {
      const exists = bimestresAtivos.some(b => b.id === selectedBimestreId);
      if (!exists || !selectedBimestreId) {
        const defaultId = bimestresAtivos[0].id;
        setSelectedBimestreId(defaultId);
        localStorage.setItem('es_bimestre_ativo', defaultId);
      }
    } else if (selectedBimestreId !== '') {
      setSelectedBimestreId('');
      localStorage.removeItem('es_bimestre_ativo');
    }
  }, [selectedAno, bimestresAtivos, selectedBimestreId]);

  const atividadesAtivas = atividades.filter(a => bimestresAtivos.some(b => b.id === a.bimestreId));

  const aulasAtivas = aulas.filter(a => {
    if (!a.data) return false;
    try {
      const year = a.data.split('-')[0];
      return Number(year) === selectedAno;
    } catch {
      return true;
    }
  });

  const notasAtivas = notas.filter(n => atividadesAtivas.some(a => a.id === n.atividadeId));
  const apontamentosAtivos = apontamentos.filter(ap => bimestresAtivos.some(b => b.id === ap.bimestreId));

  // Simulated AI Exercises list to back IaModal and SdModal
  const simulatedExerciciosIA: ExerciciosIA[] = [
    { id: 'ex-1', nome: 'Questão de Interpretação textual', desc: 'Identificar a tese principal do autor e classificar os argumentos apresentados no texto base.' },
    { id: 'ex-2', nome: 'Equações Lineares Aplicadas', desc: 'Resolver problemas práticos do dia a dia utilizando equações de primeiro grau com duas variáveis.' },
    { id: 'ex-3', nome: 'Análise de Gráficos de Funções', desc: 'Identificar raízes, domínio, imagem e crescimento de funções afins a partir de representações gráficas.' },
    { id: 'ex-4', nome: 'Análise Histórica do Período', desc: 'Diferenciar os aspectos econômicos, sociais e políticos da Revolução Industrial nas fases inicial e secundária.' },
    { id: 'ex-5', nome: 'Reações Químicas no Cotidiano', desc: 'Balanceamento de equações químicas simples e identificação de processos endotérmicos e exotérmicos.' },
    { id: 'ex-6', nome: 'Genética Mendeliana Prática', desc: 'Calcular a probabilidade de transmissão de características hereditárias usando cruzamentos de primeira lei.' },
    { id: 'ex-7', nome: 'Dinâmica Newtoniana e Forças', desc: 'Calcular aceleração, força resultante e coeficiente de atrito em blocos sob planos inclinados.' },
    { id: 'ex-8', nome: 'Geopolítica e Globalização', desc: 'Explicar o papel dos blocos econômicos na divisão internacional do trabalho no século XXI.' },
  ];

  // Modals Visibility States
  const [isSenhaModalOpen, setIsSenhaModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isIaModalOpen, setIsIaModalOpen] = useState(false);
  const [isAlunoModalOpen, setIsAlunoModalOpen] = useState(false);
  const [alunoModalId, setAlunoModalId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSdModalOpen, setIsSdModalOpen] = useState(false);
  const [sdModalId, setSdModalId] = useState<string | null>(null);
  const [isAulaDetalheOpen, setIsAulaDetalheOpen] = useState(false);
  const [aulaDetalhe, setAulaDetalhe] = useState<Aula | null>(null);
  const [isBimestreChoiceModalOpen, setIsBimestreChoiceModalOpen] = useState(false);

  // Read authentication on mount
  useEffect(() => {
    const isAuth = sessionStorage.getItem('es_autenticado');
    const userPerfil = sessionStorage.getItem('es_perfil') as 'admin' | 'professor';
    if (isAuth === 'true') {
      setAutenticado(true);
      const activePerfil = userPerfil || 'admin';
      setPerfil(activePerfil);
      if (activePerfil === 'professor') {
        setCurrentSec('visao-aulas'); // Ao abrir/recarregar o sistema com professor, abre na Grade Semanal
        const confirmado = sessionStorage.getItem('es_bimestre_confirmado');
        if (confirmado !== 'true') {
          setIsBimestreChoiceModalOpen(true);
        }
      } else {
        setCurrentSec('escola');
      }
    }
  }, []);

  // Set up Firebase Realtime Snapshot Listeners
  useEffect(() => {
    const unsubAdmin = onSnapshot(doc(db, 'config', 'admin'), (docSnap) => {
      if (docSnap.exists()) {
        setAdminConfig(docSnap.data() as AdminConfig);
      }
    }, () => setSyncStatus('err'));

    const unsubEscolas = onSnapshot(collection(db, 'escolas'), (snapshot) => {
      const items: Escola[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Escola));
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
      setEscolas(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubTurmas = onSnapshot(collection(db, 'turmas'), (snapshot) => {
      const items: Turma[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Turma));
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
      setTurmas(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubAlunos = onSnapshot(collection(db, 'alunos'), (snapshot) => {
      const items: Aluno[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Aluno));
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
      setAlunos(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubMaterias = onSnapshot(collection(db, 'materias'), (snapshot) => {
      const items: Materia[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Materia));
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
      setMaterias(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubProfessores = onSnapshot(collection(db, 'professores'), (snapshot) => {
      const items: Professor[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Professor));
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
      setProfessores(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubBimestres = onSnapshot(collection(db, 'bimestres'), (snapshot) => {
      const items: Bimestre[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Bimestre));
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
      setBimestres(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubAtividades = onSnapshot(collection(db, 'atividades'), (snapshot) => {
      const items: Atividade[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Atividade));
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
      setAtividades(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubCapitulos = onSnapshot(collection(db, 'capitulos'), (snapshot) => {
      const items: Capitulo[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Capitulo));
      items.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
      setCapitulos(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubAulas = onSnapshot(collection(db, 'aulas'), (snapshot) => {
      const items: Aula[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as Aula));
      setAulas(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubSequencias = onSnapshot(collection(db, 'sequencias_didaticas'), (snapshot) => {
      const items: SequenciaDidatica[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as SequenciaDidatica));
      setSequencias(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubNotas = onSnapshot(collection(db, 'notas'), (snapshot) => {
      const items: Nota[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as any as Nota));
      setNotas(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    const unsubApontamentos = onSnapshot(collection(db, 'apontamentos'), (snapshot) => {
      const items: Apontamento[] = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() } as any as Apontamento));
      setApontamentos(items);
      setSyncStatus('ok');
    }, () => setSyncStatus('err'));

    return () => {
      unsubAdmin();
      unsubEscolas();
      unsubTurmas();
      unsubAlunos();
      unsubMaterias();
      unsubProfessores();
      unsubBimestres();
      unsubAtividades();
      unsubCapitulos();
      unsubAulas();
      unsubSequencias();
      unsubNotas();
      unsubApontamentos();
    };
  }, []);

  const realizarLogout = () => {
    setAutenticado(false);
    sessionStorage.removeItem('es_autenticado');
    sessionStorage.removeItem('es_perfil');
    sessionStorage.removeItem('es_bimestre_confirmado');
  };

  const renderActiveSection = () => {
    switch (currentSec) {
      case 'escola':
        return <EscolaPage escolas={escolas} turmas={turmas} setSyncStatus={setSyncStatus} />;
      case 'alunos':
        return (
          <AlunosPage 
            alunos={alunos} 
            turmas={turmas} 
            escolas={escolas} 
            abrirAlunoModal={(id) => { setAlunoModalId(id); setIsAlunoModalOpen(true); }}
            abrirImportModal={() => setIsImportModalOpen(true)}
            setSyncStatus={setSyncStatus}
          />
        );
      case 'materias':
        return <MateriasPage materias={materias} escolas={escolas} setSyncStatus={setSyncStatus} />;
      case 'profs':
        return <ProfsPage professores={professores} materias={materias} escolas={escolas} turmas={turmas} setSyncStatus={setSyncStatus} />;
      case 'bim':
        return <BimestresPage bimestres={bimestres} setSyncStatus={setSyncStatus} />;
      case 'ativ':
        return (
          <AtividadesPage 
            atividades={atividadesAtivas} 
            turmas={turmas} 
            materias={materias} 
            bimestres={bimestresAtivos} 
            escolas={escolas}
            professores={professores}
            setSyncStatus={setSyncStatus}
            selectedBimestreId={selectedBimestreId}
          />
        );
      case 'capitulos':
        return (
          <CapitulosPage 
            capitulos={capitulos} 
            turmas={turmas} 
            materias={materias} 
            escolas={escolas}
            professores={professores}
            setSyncStatus={setSyncStatus}
          />
        );
      case 'aulas':
        return (
          <AulasPage 
            aulas={aulasAtivas} 
            turmas={turmas} 
            materias={materias} 
            capitulos={capitulos} 
            escolas={escolas}
            professores={professores}
            setSyncStatus={setSyncStatus}
          />
        );
      case 'visao-aulas':
        return (
          <GradePage 
            aulas={aulasAtivas} 
            turmas={turmas} 
            materias={materias} 
            abrirAulaDetalheModal={(a) => { setAulaDetalhe(a); setIsAulaDetalheOpen(true); }}
          />
        );
      case 'sd':
        return (
          <SdPage 
            sequencias={sequencias} 
            professores={professores} 
            turmas={turmas} 
            materias={materias} 
            aulas={aulasAtivas}
            abrirSdModal={(id) => { setSdModalId(id); setIsSdModalOpen(true); }}
            setSyncStatus={setSyncStatus}
          />
        );
      case 'lan':
        return (
          <NotasPage 
            alunos={alunos} 
            turmas={turmas} 
            materias={materias} 
            bimestres={bimestresAtivos} 
            atividades={atividadesAtivas} 
            notas={notasAtivas}
            escolas={escolas}
            apontamentos={apontamentosAtivos}
            professores={professores}
            setSyncStatus={setSyncStatus}
            selectedBimestreId={selectedBimestreId}
            onBimestreChange={handleBimestreChange}
          />
        );
      case 'conceito':
        return (
          <ConceitosPage 
            alunos={alunos} 
            turmas={turmas} 
            materias={materias} 
            bimestres={bimestresAtivos} 
            atividades={atividadesAtivas} 
            notas={notasAtivas}
            escolas={escolas}
            apontamentos={apontamentosAtivos}
            professores={professores}
            selectedBimestreId={selectedBimestreId}
            onBimestreChange={handleBimestreChange}
          />
        );
      case 'visao':
        return (
          <BoletimPage 
            alunos={alunos} 
            turmas={turmas} 
            materias={materias} 
            bimestres={bimestresAtivos} 
            atividades={atividadesAtivas} 
            notas={notasAtivas}
            escolas={escolas}
            apontamentos={apontamentosAtivos}
            professores={professores}
            setSyncStatus={setSyncStatus}
            globalBimestreId={selectedBimestreId}
            onBimestreChange={handleBimestreChange}
          />
        );
      case 'ranking':
        return (
          <RankingPage 
            alunos={alunos} 
            turmas={turmas} 
            atividades={atividadesAtivas} 
            notas={notasAtivas}
            escolas={escolas}
            apontamentos={apontamentosAtivos}
          />
        );
      case 'rel':
        return (
          <RelatorioPage 
            alunos={alunos} 
            turmas={turmas} 
            notas={notasAtivas} 
            escolas={escolas}
          />
        );
      case 'apontamentos':
        return (
          <ApontamentosPage 
            alunos={alunos} 
            turmas={turmas} 
            materias={materias} 
            bimestres={bimestresAtivos} 
            escolas={escolas} 
            apontamentos={apontamentosAtivos} 
            professores={professores}
            setSyncStatus={setSyncStatus}
            selectedBimestreId={selectedBimestreId}
            onBimestreChange={handleBimestreChange}
          />
        );
      case 'provas':
        return <ProvasPage setSyncStatus={setSyncStatus} />;
      default:
        return <EscolaPage escolas={escolas} turmas={turmas} setSyncStatus={setSyncStatus} />;
    }
  };

  // Verificar se é acesso compartilhado de notas para professores convidados (bypass de login)
  const queryParams = new URLSearchParams(window.location.search);

  // Bypass para a prova do aluno (Kiosk Mode BYOD)
  const isAlunoProva = queryParams.get('prova') === 'true';
  if (isAlunoProva) {
    return <AlunoProvaPage />;
  }

  const isCompartilhado = queryParams.get('compartilhado') === 'true';
  const sharedMapStr = queryParams.get('map') || '';
  const sharedAtividadeId = queryParams.get('atividadeId') || '';
  const sharedTurmas = queryParams.get('turmas') ? queryParams.get('turmas')!.split(',') : [];

  const sharedMap: Record<string, string> = {};
  if (sharedMapStr) {
    sharedMapStr.split(',').forEach(entry => {
      const [tId, aId] = entry.split(':');
      if (tId && aId) {
        sharedMap[tId] = aId;
      }
    });
  } else if (sharedAtividadeId) {
    // Manter retrocompatibilidade se passarem o formato antigo
    if (sharedTurmas.length > 0) {
      sharedTurmas.forEach(tId => {
        sharedMap[tId] = sharedAtividadeId;
      });
    } else {
      const ativ = atividades.find(a => a.id === sharedAtividadeId);
      if (ativ) {
        sharedMap[ativ.turmaId] = sharedAtividadeId;
      }
    }
  }

  if (isCompartilhado && Object.keys(sharedMap).length > 0) {
    const fallbackAtividadeId = Object.values(sharedMap)[0] || sharedAtividadeId;
    return (
      <SharedNotasPage
        sharedMap={sharedMap}
        sharedAtividadeId={fallbackAtividadeId}
        alunos={alunos}
        turmas={turmas}
        materias={materias}
        bimestres={bimestres}
        atividades={atividades}
        escolas={escolas}
        notas={notas}
        setSyncStatus={setSyncStatus}
      />
    );
  }

  // If not authenticated, render Login Lock Screen
  if (!autenticado) {
    return (
      <LoginScreen 
        adminConfig={adminConfig} 
        setAutenticado={(auth, pref) => {
          setAutenticado(auth);
          const userPref = pref || 'admin';
          setPerfil(userPref);
          sessionStorage.setItem('es_perfil', userPref);
          if (userPref === 'professor') {
            setCurrentSec('visao-aulas'); // Ao abrir o sistema deve abrir na tela Grade semanal
            setIsBimestreChoiceModalOpen(true); // Abre o modal de escolha de bimestre
          } else {
            setCurrentSec('escola');
          }
        }} 
      />
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', width: '100%' }}>
      {/* Sidebar Navigation */}
      <Sidebar 
        currentSec={currentSec} 
        setCurrentSec={(sec) => {
          // Bloquear o professor de acessar seções que não sejam as do seu menu por segurança
          if (perfil === 'professor' && !['visao-aulas', 'capitulos', 'ativ', 'lan'].includes(sec)) {
            return;
          }
          setCurrentSec(sec);
          setSidebarCollapsed(true); // Fecha o menu lateral automaticamente após a seleção
        }} 
        syncStatus={syncStatus}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        perfil={perfil}
      />

      {/* Overlay Backdrop para fechar a Sidebar ao clicar fora */}
      {!sidebarCollapsed && (
        <div 
          onClick={() => setSidebarCollapsed(true)} 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            zIndex: 1999,
            backdropFilter: 'blur(1px)',
            transition: 'opacity 0.2s ease',
            cursor: 'pointer'
          }}
        />
      )}

      {/* Main Workspace Column */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowX: 'hidden' }}>
        <Topbar 
          currentSec={currentSec} 
          abrirSenhaModal={() => setIsSenhaModalOpen(true)}
          abrirBackupModal={() => setIsBackupModalOpen(true)}
          realizarLogout={realizarLogout}
          selectedAno={selectedAno}
          anosDisponiveis={anosDisponiveis}
          onAnoChange={handleAnoChange}
          selectedBimestreId={selectedBimestreId}
          bimestresAtivos={bimestresAtivos}
          onBimestreChange={handleBimestreChange}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          perfil={perfil}
        />

        <div style={{ flex: 1, padding: '12px' }}>
          {renderActiveSection()}
        </div>
      </div>

      {/* MODALS RENDER OVERLAYS */}
      
      {isSenhaModalOpen && (
        <SenhaModal 
          adminConfig={adminConfig} 
          setAdminConfig={setAdminConfig}
          fecharModal={() => setIsSenhaModalOpen(false)} 
          setSyncStatus={setSyncStatus}
        />
      )}

      {isBackupModalOpen && (
        <BackupModal 
          fecharModal={() => setIsBackupModalOpen(false)} 
          setSyncStatus={setSyncStatus}
        />
      )}

      {isAulaDetalheOpen && aulaDetalhe && (
        <AulaDetalheModal 
          aula={aulaDetalhe}
          turmas={turmas}
          materias={materias}
          capitulos={capitulos}
          sequencias={sequencias}
          exerciciosIA={simulatedExerciciosIA}
          fecharModal={() => { setAulaDetalhe(null); setIsAulaDetalheOpen(false); }}
        />
      )}

      {isIaModalOpen && (
        <IaModal 
          turmas={turmas}
          materias={materias}
          exerciciosIA={simulatedExerciciosIA}
          fecharModal={() => setIsIaModalOpen(false)}
          setSyncStatus={setSyncStatus}
        />
      )}

      {isSdModalOpen && (
        <SdModal 
          sdId={sdModalId}
          sds={sequencias}
          professores={professores}
          turmas={turmas}
          materias={materias}
          capitulos={capitulos}
          exerciciosIA={simulatedExerciciosIA}
          fecharModal={() => { setSdModalId(null); setIsSdModalOpen(false); }}
          setSyncStatus={setSyncStatus}
        />
      )}

      {isAlunoModalOpen && (
        <AlunoModal 
          alunoId={alunoModalId}
          alunos={alunos}
          turmas={turmas}
          fecharModal={() => { setAlunoModalId(null); setIsAlunoModalOpen(false); }}
          setSyncStatus={setSyncStatus}
        />
      )}

      {isImportModalOpen && (
        <ImportModal 
          turmas={turmas}
          fecharModal={() => setIsImportModalOpen(false)}
          setSyncStatus={setSyncStatus}
        />
      )}
      {/* Modal de Escolha Inicial de Bimestre para o Professor */}
      {isBimestreChoiceModalOpen && (
        <div style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.65)', zIndex: 4000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '380px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
            <div style={{ padding: '20px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: '#fff', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <i className="ti ti-calendar-event" style={{ fontSize: '24px' }}></i>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800 }}>Bimestre de Trabalho</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>Selecione o bimestre ativo para os seus lançamentos</div>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="f" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Escolha o Bimestre *</label>
                <select 
                  value={selectedBimestreId} 
                  onChange={(e) => handleBimestreChange(e.target.value)}
                  style={{ width: '100%', height: '42px', fontSize: '14px', fontWeight: 700, borderRadius: '8px', border: '1px solid var(--border)', padding: '0 8px' }}
                >
                  <option value="">— selecione o bimestre —</option>
                  {bimestresAtivos.map(b => (
                    <option key={b.id} value={b.id}>{b.nome}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  if (!selectedBimestreId) {
                    alert("Por favor, selecione um bimestre para continuar.");
                    return;
                  }
                  setIsBimestreChoiceModalOpen(false);
                  sessionStorage.setItem('es_bimestre_confirmado', 'true');
                }}
                className="btn pri"
                style={{ width: '100%', height: '42px', fontSize: '14px', fontWeight: 700, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                Confirmar e Iniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
