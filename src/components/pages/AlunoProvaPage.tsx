import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import './AlunoProvaPage.css';

interface Questao {
  id: string;
  type: 'multiple-choice' | 'essay' | 'true-false';
  question: string;
  options?: string[];
  statements?: string[];
  // Rastreamento opcional para restaurar o embaralhamento
  shuffledMap?: number[];
}

const AlunoProvaPage: React.FC = () => {
  // Configuração e Estado
  const [etapa, setEtapa] = useState<'login' | 'prova' | 'concluida'>('login');
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');

  // Banco de Questões
  const [examQuestions, setExamQuestions] = useState<Questao[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({});
  const [questionTimesSpent, setQuestionTimesSpent] = useState<Record<string, number>>({});

  // Status de Bloqueio e Segurança
  const [isServerLocked, setIsServerLocked] = useState(false);
  const [isLocalLocked, setIsLocalLocked] = useState(false);
  const [lockReason, setLockReason] = useState('Foi detectada uma tentativa de saída do ambiente seguro.');
  const [blurCount, setBlurCount] = useState(0);
  
  // Modais
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Bateria e Rede
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [connectionStatus, setConnectionStatus] = useState<'Conectado' | 'Desconectado'>('Conectado');

  // Referências mutáveis para contornar closures do React em EventListeners
  const stateRef = useRef({
    studentId: '',
    studentName: '',
    examQuestions: [] as Questao[],
    studentAnswers: {} as Record<string, any>,
    currentQuestionIndex: 0,
    globalTimeRemaining: 3600,
    questionTimesSpent: {} as Record<string, number>,
    isSubmitting: false,
    blurCount: 0,
    blurTimestamp: null as number | null,
    isLocked: false
  });

  // Cronômetros
  const [globalTimeRemaining, setGlobalTimeRemaining] = useState(3600);
  const [currentQuestionTimeSpent, setCurrentQuestionTimeSpent] = useState(0);

  // Sincronizar dados com a ref
  useEffect(() => {
    stateRef.current.studentId = studentId;
    stateRef.current.studentName = studentName;
    stateRef.current.examQuestions = examQuestions;
    stateRef.current.studentAnswers = studentAnswers;
    stateRef.current.currentQuestionIndex = currentQuestionIndex;
    stateRef.current.globalTimeRemaining = globalTimeRemaining;
    stateRef.current.questionTimesSpent = questionTimesSpent;
    stateRef.current.blurCount = blurCount;
    stateRef.current.isLocked = isServerLocked || isLocalLocked;
  }, [studentId, studentName, examQuestions, studentAnswers, currentQuestionIndex, globalTimeRemaining, questionTimesSpent, blurCount, isServerLocked, isLocalLocked]);

  // Monitorar nível de bateria
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batt: any) => {
        setBatteryLevel(Math.round(batt.level * 100));
        batt.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(batt.level * 100));
        });
      });
    }
  }, []);

  // -------------------------------------------------------------
  // 1. EMBARALHAMENTO (FISHER-YATES)
  // -------------------------------------------------------------
  
  const fisherYatesShuffle = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const setupExam = (questionsList: any[], savedState?: any) => {
    if (savedState) {
      setExamQuestions(savedState.examQuestions);
      setStudentAnswers(savedState.studentAnswers || {});
      setCurrentQuestionIndex(savedState.currentQuestionIndex || 0);
      setGlobalTimeRemaining(savedState.globalTimeRemaining || 3600);
      setQuestionTimesSpent(savedState.questionTimesSpent || {});
      setBlurCount(savedState.blurCount || 0);
      return;
    }

    // Criar nova prova
    const shuffledQuestions = fisherYatesShuffle(questionsList).map((q: any) => {
      // Limpa respostas corretas do front do aluno
      const cleanQ = { ...q };
      delete cleanQ.answer;
      delete cleanQ.answers;

      if (cleanQ.type === 'multiple-choice' && cleanQ.options) {
        const originalOptions = cleanQ.options.map((opt: string, index: number) => ({ text: opt, originalIndex: index }));
        const shuffledOptions = fisherYatesShuffle<{ text: string, originalIndex: number }>(originalOptions);
        cleanQ.options = shuffledOptions.map((o: any) => o.text);
        cleanQ.shuffledMap = shuffledOptions.map((o: any) => o.originalIndex);
      }
      return cleanQ;
    });

    setExamQuestions(shuffledQuestions);
    setStudentAnswers({});
    setCurrentQuestionIndex(0);
    setGlobalTimeRemaining(shuffledQuestions.length * 10 * 60); // 10 minutos por questão
    const initialTimes: Record<string, number> = {};
    shuffledQuestions.forEach(q => {
      initialTimes[q.id] = 0;
    });
    setQuestionTimesSpent(initialTimes);
    setBlurCount(0);
  };

  // -------------------------------------------------------------
  // 2. CONTROLE DE REGISTRO E FIRESTORE
  // -------------------------------------------------------------

  const startRegistration = async () => {
    if (!studentName.trim() || !studentId.trim()) {
      alert('Preencha seu nome e matrícula.');
      return;
    }

    // Tentar ativar Fullscreen (gesto do usuário)
    try {
      await requestFullScreen();
    } catch (err) {
      console.warn('Fullscreen não ativado no primeiro clique:', err);
    }

    // Carregar questões do Firestore
    try {
      const questionsDoc = await getDoc(doc(db, 'config', 'provas_questoes'));
      if (!questionsDoc.exists()) {
        throw new Error('Nenhuma prova ativa encontrada no sistema. Fale com o professor.');
      }
      
      const data = questionsDoc.data();
      const dbQuestions = data.questions || [];
      if (dbQuestions.length === 0) {
        throw new Error('A prova ativa não possui questões cadastradas.');
      }

      // Checar localStorage por progresso anterior
      const cacheKey = `safe_exam_progress_${studentId.trim()}`;
      const savedData = localStorage.getItem(cacheKey);
      let parsedSaved = null;
      if (savedData) {
        try { parsedSaved = JSON.parse(savedData); } catch (e) { console.error(e); }
      }

      setupExam(dbQuestions, parsedSaved);

      // Criar/Reconectar sessão do aluno no Firestore
      const sessionDocRef = doc(db, 'provas_sessoes', studentId.trim());
      const sessionSnap = await getDoc(sessionDocRef);

      const logEntry = {
        timestamp: new Date().toISOString(),
        message: parsedSaved ? 'Se reconectou ao sistema de provas' : 'Iniciou a prova e entrou no sistema',
        type: 'info'
      };

      if (!sessionSnap.exists()) {
        await setDoc(sessionDocRef, {
          id: studentId.trim(),
          name: studentName.trim(),
          status: 'active',
          statusBeforeOffline: 'active',
          lastHeartbeat: new Date().toISOString(),
          battery: batteryLevel,
          screenStatus: { isFullscreen: true, isFocused: true },
          blurCount: parsedSaved ? (parsedSaved.blurCount || 0) : 0,
          logs: [logEntry],
          progress: { totalQuestions: dbQuestions.length, answered: 0 },
          timeLeft: dbQuestions.length * 10 * 60,
          answers: {}
        });
      } else {
        const currentData = sessionSnap.data();
        const nextStatus = currentData.status === 'offline' 
          ? (currentData.statusBeforeOffline || 'active') 
          : currentData.status;

        await updateDoc(sessionDocRef, {
          status: nextStatus,
          statusBeforeOffline: nextStatus,
          lastHeartbeat: new Date().toISOString(),
          logs: arrayUnion(logEntry)
        });

        if (nextStatus === 'locked') {
          setIsServerLocked(true);
        }
      }

      setEtapa('prova');
      setConnectionStatus('Conectado');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // -------------------------------------------------------------
  // 3. TELEMETRIA (HEARTBEAT) E ESCUTA DE TRAVAS DO FIRESTORE
  // -------------------------------------------------------------

  useEffect(() => {
    if (etapa !== 'prova' || !studentId) return;

    // A. Escuta em tempo real do nosso status (Bloquear/Desbloquear pelo Professor)
    const unsubSession = onSnapshot(doc(db, 'provas_sessoes', studentId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Tratar status 'offline' do servidor
        if (data.status === 'offline') {
          // Quando o servidor marca como offline (por exemplo, após timeout de aba background), 
          // e o aluno volta a mandar heartbeat, nós restauramos o status anterior dele
          const restoredStatus = data.statusBeforeOffline || 'active';
          updateDoc(doc(db, 'provas_sessoes', studentId), {
            status: restoredStatus,
            logs: arrayUnion({
              timestamp: new Date().toISOString(),
              message: 'Conexão de telemetria restabelecida.',
              type: 'info'
            })
          });
          return;
        }

        if (data.status === 'locked') {
          setIsServerLocked(true);
          setLockReason(data.logs[data.logs.length - 1]?.message || 'A prova foi bloqueada por razões de integridade.');
        } else if (data.status === 'active') {
          setIsServerLocked(false);
        }
      }
    }, () => setConnectionStatus('Desconectado'));

    // B. Loop de Heartbeat (a cada 5 segundos)
    const heartbeatTimer = setInterval(() => {
      const sessionDocRef = doc(db, 'provas_sessoes', studentId);
      const isFocused = document.hasFocus();
      const isFullscreen = !!document.fullscreenElement;

      // Se sair da tela cheia em background, trava a prova
      if (!isFullscreen && !stateRef.current.isLocked && !stateRef.current.isSubmitting) {
        setIsLocalLocked(true);
        updateDoc(sessionDocRef, {
          status: 'locked',
          statusBeforeOffline: 'locked',
          logs: arrayUnion({
            timestamp: new Date().toISOString(),
            message: 'Saída de Tela Cheia: O aluno saiu do modo tela cheia obrigatório.',
            type: 'danger'
          })
        });
      }

      updateDoc(sessionDocRef, {
        lastHeartbeat: new Date().toISOString(),
        battery: batteryLevel,
        screenStatus: { isFullscreen, isFocused },
        timeLeft: stateRef.current.globalTimeRemaining,
        progress: {
          totalQuestions: stateRef.current.examQuestions.length,
          answered: Object.keys(stateRef.current.studentAnswers).length
        },
        blurCount: stateRef.current.blurCount,
        answers: stateRef.current.studentAnswers
      }).then(() => {
        setConnectionStatus('Conectado');
      }).catch(() => {
        setConnectionStatus('Desconectado');
      });
    }, 5000);

    return () => {
      unsubSession();
      clearInterval(heartbeatTimer);
    };
  }, [etapa, studentId, batteryLevel]);

  // -------------------------------------------------------------
  // 4. KIOSK MODE - SEGURANÇA E TELA CHEIA
  // -------------------------------------------------------------

  useEffect(() => {
    if (etapa !== 'prova') return;

    // A. Bloquear menu de contexto
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('Menu de Contexto', 'Tentativa de abrir menu de contexto (clique direito ou toque longo).');
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // B. Bloquear atalhos de teclado (Ctrl+C, Ctrl+V, F12, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      if (
        e.key === 'F12' ||
        (isCtrl && isShift && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (isCtrl && (e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X' || e.key === 's' || e.key === 'S'))
      ) {
        e.preventDefault();
        logViolation('Teclado Bloqueado', `Tentativa de usar atalho proibido: ${e.key}`);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // C. Visibility API - Detecção de saída da aba
    const handleVisibility = () => {
      if (document.hidden) {
        if (stateRef.current.blurTimestamp === null) {
          stateRef.current.blurTimestamp = Date.now();
          const nextCount = stateRef.current.blurCount + 1;
          setBlurCount(nextCount);
          logViolation('Troca de Aba / Minimização', `O aluno saiu da aba de prova (Saída nº ${nextCount}).`, false);
        }
      } else {
        if (stateRef.current.blurTimestamp !== null) {
          const duration = Math.round((Date.now() - stateRef.current.blurTimestamp) / 1000);
          stateRef.current.blurTimestamp = null;
          logViolation('Retorno à Prova', `O aluno retornou à aba após passar ${duration} segundos fora. Total de saídas: ${stateRef.current.blurCount}`, false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // D. Fullscreen Change - Detecção de saída de tela cheia
    const handleFullscreen = () => {
      if (stateRef.current.isSubmitting) return;

      if (!document.fullscreenElement) {
        setIsLocalLocked(true);
        logViolation('Saída de Tela Cheia', 'O aluno saiu do modo tela cheia obrigatório.', true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreen);

    // E. Prevenir arrastar texto
    const handleDrag = (e: DragEvent) => e.preventDefault();
    document.addEventListener('dragstart', handleDrag);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('dragstart', handleDrag);
    };
  }, [etapa]);

  const logViolation = (type: string, message: string, shouldLock: boolean = false) => {
    if (!studentId) return;
    const sessionDocRef = doc(db, 'provas_sessoes', studentId);
    
    const updates: any = {
      logs: arrayUnion({
        timestamp: new Date().toISOString(),
        message: `${type}: ${message}`,
        type: 'danger'
      })
    };

    if (shouldLock) {
      updates.status = 'locked';
      updates.statusBeforeOffline = 'locked';
    }

    updateDoc(sessionDocRef, updates);
    saveLocalProgress();
  };

  const requestFullScreen = () => {
    const docElm = document.documentElement;
    if (docElm.requestFullscreen) return docElm.requestFullscreen();
    if ((docElm as any).webkitRequestFullscreen) return (docElm as any).webkitRequestFullscreen();
    if ((docElm as any).mozRequestFullScreen) return (docElm as any).mozRequestFullScreen();
    return Promise.reject();
  };

  const requestFullScreenAndResume = async () => {
    if (isServerLocked) {
      alert('Sua prova continua bloqueada no servidor. Aguarde a liberação do professor.');
      return;
    }

    try {
      await requestFullScreen();
      setIsLocalLocked(false);
      logViolation('Retorno Seguro', 'O aluno reativou o modo tela cheia e retornou à prova.', false);
    } catch {
      alert('Falha ao ativar a tela cheia. Garanta que o navegador tem permissão.');
    }
  };

  // -------------------------------------------------------------
  // 5. CRONÔMETROS E PERSISTÊNCIA LOCAL
  // -------------------------------------------------------------

  useEffect(() => {
    if (etapa !== 'prova') return;

    const interval = setInterval(() => {
      if (isServerLocked || isLocalLocked) return;

      setGlobalTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          alert('Tempo esgotado! Suas respostas serão enviadas automaticamente.');
          submitExam();
          return 0;
        }
        
        // Salvar progresso no local storage a cada 10s
        if (prev % 10 === 0) {
          saveLocalProgress();
        }
        return prev - 1;
      });

      setCurrentQuestionTimeSpent(prev => prev + 1);
      
      // Acumula tempo gasto na questão atual
      const q = stateRef.current.examQuestions[stateRef.current.currentQuestionIndex];
      if (q) {
        setQuestionTimesSpent(prev => ({
          ...prev,
          [q.id]: (prev[q.id] || 0) + 1
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [etapa, isServerLocked, isLocalLocked]);

  const saveLocalProgress = () => {
    if (!stateRef.current.studentId) return;
    const state = {
      examQuestions: stateRef.current.examQuestions,
      studentAnswers: stateRef.current.studentAnswers,
      currentQuestionIndex: stateRef.current.currentQuestionIndex,
      globalTimeRemaining: stateRef.current.globalTimeRemaining,
      questionTimesSpent: stateRef.current.questionTimesSpent,
      blurCount: stateRef.current.blurCount
    };
    localStorage.setItem(`safe_exam_progress_${stateRef.current.studentId}`, JSON.stringify(state));
  };

  const clearLocalProgress = () => {
    localStorage.removeItem(`safe_exam_progress_${studentId}`);
  };

  // -------------------------------------------------------------
  // 6. NAVEGAÇÃO E SUBMISSÃO DA PROVA
  // -------------------------------------------------------------

  const handleSelectOption = (idx: number) => {
    const q = examQuestions[currentQuestionIndex];
    setStudentAnswers(prev => ({ ...prev, [q.id]: idx }));
    saveLocalProgress();
  };

  const handleEssayInput = (text: string) => {
    const q = examQuestions[currentQuestionIndex];
    setStudentAnswers(prev => ({ ...prev, [q.id]: text }));
    saveLocalProgress();
  };

  const handleSelectTrueFalse = (stmtIdx: number, val: boolean) => {
    const q = examQuestions[currentQuestionIndex];
    const current = [...(studentAnswers[q.id] || Array(q.statements?.length).fill(null))];
    current[stmtIdx] = val;
    setStudentAnswers(prev => ({ ...prev, [q.id]: current }));
    saveLocalProgress();
  };

  const navigateQuestion = (dir: number) => {
    const nextIdx = currentQuestionIndex + dir;
    if (nextIdx >= 0 && nextIdx < examQuestions.length) {
      setCurrentQuestionIndex(nextIdx);
      setCurrentQuestionTimeSpent(questionTimesSpent[examQuestions[nextIdx].id] || 0);
    }
  };

  const triggerFinishConfirm = () => {
    // Validar questões pendentes
    let pendentes = 0;
    examQuestions.forEach(q => {
      const ans = studentAnswers[q.id];
      if (ans === undefined || ans === null || ans === '') {
        pendentes++;
      } else if (q.type === 'true-false') {
        const hasNull = ans.some((val: any) => val === null);
        if (hasNull || ans.length < (q.statements?.length || 0)) {
          pendentes++;
        }
      }
    });

    setShowConfirmModal(true);
  };

  const executeFinish = () => {
    setShowConfirmModal(false);
    submitExam();
  };

  const submitExam = async () => {
    stateRef.current.isSubmitting = true;

    // Sair de tela cheia se estiver ativa
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    try {
      // Salvar conclusão no Firestore
      const sessionDocRef = doc(db, 'provas_sessoes', studentId);
      await updateDoc(sessionDocRef, {
        status: 'active', // Destrava ao finalizar
        statusBeforeOffline: 'active',
        logs: arrayUnion({
          timestamp: new Date().toISOString(),
          message: `Prova Concluída: O aluno submeteu as respostas com sucesso.`,
          type: 'success'
        }),
        answers: studentAnswers,
        progress: {
          totalQuestions: examQuestions.length,
          answered: Object.keys(studentAnswers).length
        }
      });
    } catch (e) {
      console.error('Falha ao salvar respostas no Firebase:', e);
    }

    clearLocalProgress();
    setEtapa('concluida');
  };

  // -------------------------------------------------------------
  // 7. RENDERIZADORES DE INTERFACE
  // -------------------------------------------------------------

  const getFormatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (etapa === 'login') {
    return (
      <div className="aluno-prova-screen">
        <div className="aluno-setup-card">
          <h1 className="logo-tag">Safe<span>Exam</span></h1>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '-15px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>Área do Aluno BYOD</p>

          <div className="setup-form">
            <div className="input-group">
              <label className="input-label">Nome Completo</label>
              <input 
                type="text" 
                value={studentName} 
                onChange={(e) => setStudentName(e.target.value)} 
                className="input-field" 
                placeholder="Seu nome..." 
                autoComplete="off"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Matrícula ou CPF</label>
              <input 
                type="text" 
                value={studentId} 
                onChange={(e) => setStudentId(e.target.value)} 
                className="input-field" 
                placeholder="Ex: 202610283" 
                autoComplete="off"
              />
            </div>

            <div className="rules-box">
              <h3>Regras de Integridade</h3>
              <ul>
                <li>🔒 O <strong>Modo Tela Cheia</strong> é obrigatório para iniciar e manter a prova.</li>
                <li>🚫 Sair de tela cheia ou trocar de aba <strong>bloqueará sua prova</strong> na hora.</li>
                <li>⌨️ Atalhos de teclado (Ctrl+C, Ctrl+V, F12) estão bloqueados.</li>
                <li>🔋 Mantenha o aparelho carregado.</li>
              </ul>
            </div>

            <button onClick={startRegistration} className="btn btn-primary" style={{ width: '100%' }}>
              Entrar e Ativar Modo Seguro
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (etapa === 'concluida') {
    return (
      <div className="aluno-prova-screen">
        <div className="aluno-setup-card" style={{ textAlign: 'center' }}>
          <div className="aluno-success-icon">✓</div>
          <h1 className="logo-tag">Prova Finalizada!</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Suas respostas foram gravadas e enviadas no banco de dados.</p>
          
          <div className="aluno-finish-details">
            <p><strong>Nome:</strong> {studentName}</p>
            <p><strong>Matrícula:</strong> {studentId}</p>
            <p>A telemetria de integridade foi concluída. Você já pode fechar o navegador ou sair da sala.</p>
          </div>
        </div>
      </div>
    );
  }

  // Render da Questão Ativa
  const q = examQuestions[currentQuestionIndex];

  return (
    <div className="aluno-prova-screen" style={{ overflowY: 'auto', display: 'block' }}>
      
      {/* ⚠️ Barreira de Bloqueio de Segurança */}
      {(isServerLocked || isLocalLocked) && (
        <div className="aluno-lock-overlay">
          <div className="aluno-lock-card">
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
            <h2>Prova Bloqueada!</h2>
            <p style={{ color: '#fff', fontSize: '1rem', marginBottom: '20px' }}>{lockReason}</p>
            <div className="aluno-lock-details">
              <p><strong>Ação necessária:</strong> Chame o professor na sua carteira e solicite o desbloqueio no painel.</p>
              <p style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '0.8rem', color: 'hsl(215, 16%, 47%)' }}>
                Aluno: {studentName} | Matrícula: {studentId}
              </p>
            </div>
            <div className="aluno-re-trigger-box">
              <p>Após a liberação do professor, clique abaixo para retornar em tela cheia:</p>
              <button 
                onClick={requestFullScreenAndResume} 
                disabled={isServerLocked} 
                className="btn btn-danger" 
                style={{ width: '100%' }}
              >
                {isServerLocked ? 'Aguardando Desbloqueio do Professor...' : 'Reativar Tela Cheia e Retornar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ❓ Modal de Confirmação Customizado */}
      {showConfirmModal && (
        <div className="aluno-modal-overlay">
          <div className="aluno-confirm-modal-card">
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❓</div>
            <h2>Finalizar Prova?</h2>
            <p>
              {Object.keys(studentAnswers).length < examQuestions.length 
                ? `Você possui ${examQuestions.length - Object.keys(studentAnswers).length} questão(ões) pendentes. Tem certeza que deseja entregar a prova incompleta?`
                : 'Tem certeza que deseja finalizar a prova e entregar suas respostas? Esta ação não pode ser desfeita.'
              }
            </p>
            <div className="aluno-confirm-actions">
              <button onClick={() => setShowConfirmModal(false)} className="btn btn-secondary">
                Voltar à Prova
              </button>
              <button onClick={executeFinish} className="btn btn-danger">
                Entregar Prova
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prova Ativa Container */}
      <div className="aluno-exam-layout">
        
        {/* Cabeçalho */}
        <header className="aluno-exam-header">
          <div className="aluno-student-meta">
            <span className="aluno-avatar-dot"></span>
            <div>
              <h2>{studentName}</h2>
              <p>Matrícula: {studentId}</p>
            </div>
          </div>

          <div className="aluno-exam-timers">
            <div className={`aluno-timer-box aluno-global-timer ${globalTimeRemaining < 300 ? 'warning' : ''}`} title="Tempo restante da prova">
              <span>⏳</span>
              <span>{getFormatTime(globalTimeRemaining)}</span>
            </div>
            <div className="aluno-timer-box aluno-question-timer" title="Tempo nesta questão">
              <span>⏱️</span>
              <span>{getFormatTime(currentQuestionTimeSpent)}</span>
            </div>
          </div>

          <div className="aluno-device-status">
            <span className={`badge ${connectionStatus === 'Conectado' ? 'badge-active' : 'badge-offline'}`}>
              {connectionStatus}
            </span>
            <span style={{ fontWeight: 600 }}>🔋 {batteryLevel}%</span>
          </div>
        </header>

        {/* Barra de Progresso */}
        <div className="aluno-progress-container">
          <div className="aluno-progress-bar-track">
            <div 
              className="aluno-progress-bar-fill" 
              style={{ width: `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%` }}
            ></div>
          </div>
          <div className="aluno-progress-text">
            Questão {currentQuestionIndex + 1} de {examQuestions.length}
          </div>
        </div>

        {/* Questão Ativa */}
        {q && (
          <main className="aluno-question-container">
            <div className="aluno-question-text">
              {currentQuestionIndex + 1}. {q.question}
            </div>

            {/* Renderizar baseado no tipo */}
            {q.type === 'multiple-choice' && q.options && (
              <div className="aluno-options-list">
                {q.options.map((opt, idx) => (
                  <div 
                    key={idx}
                    className={`aluno-option-card ${studentAnswers[q.id] === idx ? 'selected' : ''}`}
                    onClick={() => handleSelectOption(idx)}
                  >
                    <div className="aluno-option-radio"></div>
                    <div className="aluno-option-label">{opt}</div>
                  </div>
                ))}
              </div>
            )}

            {q.type === 'essay' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  className="aluno-essay-textarea"
                  spellCheck="false"
                  placeholder="Escreva sua resposta aqui..."
                  value={studentAnswers[q.id] || ''}
                  onChange={(e) => handleEssayInput(e.target.value)}
                />
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'hsl(215, 16%, 47%)' }}>
                  {(studentAnswers[q.id] || '').length} caracteres
                </div>
              </div>
            )}

            {q.type === 'true-false' && q.statements && (
              <div className="aluno-tf-list">
                {q.statements.map((stmt, idx) => {
                  const ansList = studentAnswers[q.id] || Array(q.statements?.length || 0).fill(null);
                  return (
                    <div key={idx} className="aluno-tf-row">
                      <div className="aluno-tf-statement">{idx + 1}. {stmt}</div>
                      <div className="aluno-tf-buttons">
                        <button 
                          className={`aluno-btn-tf ${ansList[idx] === true ? 'selected-true' : ''}`}
                          onClick={() => handleSelectTrueFalse(idx, true)}
                        >
                          Verdadeiro (V)
                        </button>
                        <button 
                          className={`aluno-btn-tf ${ansList[idx] === false ? 'selected-false' : ''}`}
                          onClick={() => handleSelectTrueFalse(idx, false)}
                        >
                          Falso (F)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}

        {/* Rodapé de Ações */}
        <footer className="aluno-exam-footer">
          <button 
            disabled={currentQuestionIndex === 0} 
            onClick={() => navigateQuestion(-1)} 
            className="btn btn-secondary btn-sm"
          >
            ◀ Anterior
          </button>
          
          <button 
            onClick={() => {
              saveLocalProgress();
              alert('Progresso salvo localmente com sucesso.');
            }} 
            className="btn btn-primary btn-sm"
          >
            💾 Salvar Progresso
          </button>

          {currentQuestionIndex === examQuestions.length - 1 ? (
            <button onClick={triggerFinishConfirm} className="btn btn-danger btn-sm">
              🏁 Finalizar Prova
            </button>
          ) : (
            <button onClick={() => navigateQuestion(1)} className="btn btn-secondary btn-sm">
              Próxima ▶
            </button>
          )}
        </footer>

      </div>
    </div>
  );
};

export default AlunoProvaPage;
