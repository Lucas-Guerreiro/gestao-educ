import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, arrayUnion, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import './ProvasPage.css';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
}

interface AlunoSessao {
  id: string; // Matrícula
  name: string; // Nome do aluno
  status: 'active' | 'locked' | 'offline';
  statusBeforeOffline?: 'active' | 'locked';
  lastHeartbeat: string;
  battery: number;
  screenStatus: { isFullscreen: boolean; isFocused: boolean };
  blurCount: number;
  logs: LogEntry[];
  progress: { totalQuestions: number; answered: number };
  timeLeft: number;
  answers: Record<string, any>;
}

interface Questao {
  id: string;
  type: 'multiple-choice' | 'essay' | 'true-false';
  question: string;
  options?: string[];
  statements?: string[];
  answer?: any;
  answers?: any;
}

interface ProvasPageProps {
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const ProvasPage: React.FC<ProvasPageProps> = ({ setSyncStatus }) => {
  const [sessoes, setSessoes] = useState<AlunoSessao[]>([]);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  
  // Modais locais de detalhe por aluno
  const [alunoSelecionadoLogs, setAlunoSelecionadoLogs] = useState<AlunoSessao | null>(null);
  const [alunoSelecionadoRespostas, setAlunoSelecionadoRespostas] = useState<AlunoSessao | null>(null);

  // Escutar sessões de alunos em tempo real
  useEffect(() => {
    setSyncStatus('saving');
    const unsub = onSnapshot(collection(db, 'provas_sessoes'), (snapshot) => {
      const items: AlunoSessao[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as AlunoSessao);
      });
      // Ordenar por nome
      items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
      setSessoes(items);
      setSyncStatus('ok');
    }, () => {
      setSyncStatus('err');
    });

    return () => unsub();
  }, [setSyncStatus]);

  // Escutar banco de questões ativo em tempo real
  useEffect(() => {
    setSyncStatus('saving');
    const unsubQuestao = onSnapshot(doc(db, 'config', 'provas_questoes'), (snap) => {
      if (snap.exists()) {
        setQuestoes(snap.data().questions || []);
      } else {
        setQuestoes([]);
      }
      setSyncStatus('ok');
    }, () => {
      setSyncStatus('err');
    });

    return () => unsubQuestao();
  }, [setSyncStatus]);

  // -------------------------------------------------------------
  // CONTROLE REMOTO DOS ALUNOS
  // -------------------------------------------------------------

  const liberarAluno = async (studentId: string) => {
    setSyncStatus('saving');
    try {
      const sessionRef = doc(db, 'provas_sessoes', studentId);
      await updateDoc(sessionRef, {
        status: 'active',
        statusBeforeOffline: 'active',
        logs: arrayUnion({
          timestamp: new Date().toISOString(),
          message: 'A prova foi desbloqueada pelo professor remotamente.',
          type: 'success'
        })
      });
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao liberar aluno: ' + (err as Error).message);
    }
  };

  const bloquearAluno = async (studentId: string) => {
    setSyncStatus('saving');
    try {
      const sessionRef = doc(db, 'provas_sessoes', studentId);
      await updateDoc(sessionRef, {
        status: 'locked',
        statusBeforeOffline: 'locked',
        logs: arrayUnion({
          timestamp: new Date().toISOString(),
          message: 'A prova foi bloqueada manualmente pelo professor.',
          type: 'danger'
        })
      });
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao bloquear aluno: ' + (err as Error).message);
    }
  };

  const zerarPainel = async () => {
    if (!confirm('Deseja realmente limpar todas as sessões de alunos atuais? Isso removerá logs e respostas temporárias nesta tela de monitoramento.')) return;
    setSyncStatus('saving');
    try {
      const batch = writeBatch(db);
      const snap = await getDocs(collection(db, 'provas_sessoes'));
      snap.forEach(d => {
        batch.delete(doc(db, 'provas_sessoes', d.id));
      });
      await batch.commit();
      setSyncStatus('ok');
      alert('Monitor de alunos zerado com sucesso!');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao limpar sessões: ' + (err as Error).message);
    }
  };

  // -------------------------------------------------------------
  // MODELO DE PROVAS E IMPORTAÇÃO CSV
  // -------------------------------------------------------------

  const baixarModeloCSV = () => {
    const csvContent = 
      "\uFEFF" + // UTF-8 BOM para Excel ler acentos em PT-BR
      "Tipo;Questão;Opções (separadas por '|');Afirmativas (separadas por '|');Resposta\n" +
      "multiple-choice;Qual o principal gás responsável pelo efeito estufa decorrente da atividade humana?;Dióxido de Carbono|Metano|Oxigênio|Nitrogênio;;0\n" +
      "essay;Explique resumidamente a teoria da relatividade geral de Albert Einstein.;;;O aluno deve citar a distorção do espaço-tempo pela presença de massa/energia.\n" +
      "true-false;Classifique as afirmações sobre a água em Verdadeiro (V) ou Falso (F);;A água ferve a 100°C ao nível do mar|A água é composta de 2 átomos de Oxigênio e 1 de Hidrogênio|O gelo é menos denso que a água líquida;V|F|V\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_prova.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): Questao[] => {
    if (text.startsWith('\uFEFF')) {
      text = text.substring(1);
    }
    
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error('O arquivo CSV está vazio ou possui formato inválido.');
    }

    const header = lines[0];
    const separator = header.includes(';') ? ';' : ',';
    
    const parsedQuestions: Questao[] = [];
    
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = parseCSVLine(line);
      if (columns.length < 2) continue;
      
      const rawType = columns[0].toLowerCase();
      let type: 'multiple-choice' | 'essay' | 'true-false' = 'multiple-choice';
      if (rawType === 'essay' || rawType === 'dissertativa') {
        type = 'essay';
      } else if (rawType === 'true-false' || rawType === 'verdadeiro-falso' || rawType === 'tf') {
        type = 'true-false';
      }

      const question = columns[1];
      if (!question) continue;
      
      const id = `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const questionObj: any = {
        id,
        type,
        question
      };
      
      if (type === 'multiple-choice') {
        const optionsStr = columns[2] || '';
        const options = optionsStr.split('|').map(o => o.trim()).filter(Boolean);
        const answerIdx = parseInt(columns[4] || '0', 10);
        
        questionObj.options = options;
        questionObj.answer = isNaN(answerIdx) ? 0 : answerIdx;
      } else if (type === 'true-false') {
        const statementsStr = columns[3] || '';
        const statements = statementsStr.split('|').map(s => s.trim()).filter(Boolean);
        const answersStr = columns[4] || '';
        const answers = answersStr.split('|').map(ans => ans.trim().toUpperCase() === 'V' || ans.trim().toUpperCase() === 'T' || ans.trim().toUpperCase() === 'TRUE');
        
        questionObj.statements = statements;
        questionObj.answers = answers;
      } else {
        // essay
        questionObj.answer = columns[4] || '';
      }
      
      parsedQuestions.push(questionObj);
    }
    
    return parsedQuestions;
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSyncStatus('saving');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      try {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          throw new Error('Nenhuma questão válida encontrada no arquivo CSV.');
        }
        
        await setDoc(doc(db, 'config', 'provas_questoes'), {
          questions: parsed,
          updatedAt: new Date().toISOString()
        });
        
        setSyncStatus('ok');
        alert(`Sucesso! ${parsed.length} questões foram importadas para a prova ativa.`);
      } catch (err) {
        setSyncStatus('err');
        alert('Erro ao parsear ou salvar a planilha: ' + (err as Error).message);
      }
    };
    reader.readAsText(file, 'utf-8');
    // Limpar o input para permitir re-upload do mesmo arquivo
    e.target.value = '';
  };

  const limparQuestoes = async () => {
    if (!confirm('Deseja realmente excluir todas as questões ativas da prova? Os alunos não conseguirão acessar até que uma nova planilha seja importada.')) return;
    setSyncStatus('saving');
    try {
      await setDoc(doc(db, 'config', 'provas_questoes'), {
        questions: [],
        updatedAt: new Date().toISOString()
      });
      setSyncStatus('ok');
      alert('Questoes limpas com sucesso!');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao limpar questões: ' + (err as Error).message);
    }
  };

  // -------------------------------------------------------------
  // AUXILIARES
  // -------------------------------------------------------------

  const getFormatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatarDataHora = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  // Coleta de logs globais ordenados por tempo decrescente (mais recente primeiro)
  const getLogsGlobais = (): { studentName: string; log: LogEntry }[] => {
    const todos: { studentName: string; log: LogEntry }[] = [];
    sessoes.forEach(s => {
      if (s.logs) {
        s.logs.forEach(l => {
          todos.push({ studentName: s.name, log: l });
        });
      }
    });
    return todos.sort((a, b) => b.log.timestamp.localeCompare(a.log.timestamp));
  };

  // Estatísticas
  const totalAlunos = sessoes.length;
  const totalBloqueados = sessoes.filter(s => s.status === 'locked').length;
  const totalAtivos = sessoes.filter(s => s.status === 'active').length;
  
  // Rastrear offline pelo heartbeat ausente por mais de 15 segundos
  const totalOffline = sessoes.filter(s => {
    const diff = Date.now() - new Date(s.lastHeartbeat).getTime();
    return diff > 15000;
  }).length;

  return (
    <div className="provas-dashboard" style={{ padding: '1rem' }}>
      
      {/* Header Administrativo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #fff, hsl(215, 20%, 65%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Monitor de Provas Online
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Gerencie e fiscalize o modo de prova seguro (Kiosk Mode BYOD) em tempo real.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={baixarModeloCSV} style={{ color: '#fff', background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
            <i className="ti ti-download"></i> Modelo CSV
          </button>
          <button className="btn" onClick={zerarPainel} style={{ color: 'hsl(355, 78%, 56%)', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <i className="ti ti-trash"></i> Limpar Alunos
          </button>
        </div>
      </div>

      {/* Row de Estatísticas */}
      <div className="provas-stats-row">
        <div className="provas-stat-card">
          <span className="provas-stat-val">{totalAlunos}</span>
          <span className="provas-stat-lbl">Total de Alunos</span>
        </div>
        <div className="provas-stat-card">
          <span className="provas-stat-val" style={{ color: 'hsl(145, 63%, 49%)' }}>{totalAtivos - totalOffline < 0 ? 0 : totalAtivos - totalOffline}</span>
          <span className="provas-stat-lbl">Realizando Prova</span>
        </div>
        <div className="provas-stat-card locked">
          <span className="provas-stat-val" style={{ color: 'hsl(355, 78%, 56%)' }}>{totalBloqueados}</span>
          <span className="provas-stat-lbl">Bloqueados ⚠️</span>
        </div>
        <div className="provas-stat-card offline">
          <span className="provas-stat-val" style={{ color: 'hsl(38, 92%, 50%)' }}>{totalOffline}</span>
          <span className="provas-stat-lbl">Desconectados (Off)</span>
        </div>
        <div className="provas-stat-card" style={{ borderLeftColor: 'hsl(210, 100%, 50%)' }}>
          <span className="provas-stat-val">{questoes.length}</span>
          <span className="provas-stat-lbl">Questões Ativas</span>
        </div>
      </div>

      {/* Grid de Conteúdo Principal */}
      <div className="provas-dashboard-layout">
        
        {/* Lado Esquerdo: Cards dos Alunos */}
        <section className="provas-students-section">
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#fff' }}>Alunos Conectados</h2>
          
          {sessoes.length === 0 ? (
            <div className="card-box" style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                Nenhum aluno conectado no momento. Os alunos devem entrar no link da prova: <strong>?prova=true</strong>
              </p>
            </div>
          ) : (
            <div className="provas-students-grid">
              {sessoes.map(aluno => {
                const diffTime = Date.now() - new Date(aluno.lastHeartbeat).getTime();
                const isOffline = diffTime > 15000;
                
                // Barra de progresso do aluno
                const totalQ = aluno.progress?.totalQuestions || questoes.length || 0;
                const answeredQ = aluno.progress?.answered || 0;
                const pct = totalQ > 0 ? (answeredQ / totalQ) * 100 : 0;

                return (
                  <div key={aluno.id} className={`provas-student-card ${aluno.status === 'locked' ? 'status-locked' : ''}`}>
                    
                    {/* Linha do Aluno e status */}
                    <div className="provas-student-card-header">
                      <div className="provas-student-info">
                        <h3>{aluno.name}</h3>
                        <span>Matrícula: {aluno.id}</span>
                      </div>
                      
                      {/* Badge de status */}
                      <span className={`badge ${
                        isOffline ? 'badge-offline' : (aluno.status === 'locked' ? 'badge-offline' : 'badge-active')
                      }`} style={{
                        background: isOffline ? 'hsl(38, 92%, 50%)' : (aluno.status === 'locked' ? 'hsl(355, 78%, 56%)' : 'hsl(145, 63%, 49%)'),
                        color: '#fff'
                      }}>
                        {isOffline ? 'OFFLINE' : (aluno.status === 'locked' ? 'BLOQUEADO' : 'ATIVO')}
                      </span>
                    </div>

                    {/* Telemetria do Dispositivo */}
                    <div className="provas-telemetry-grid">
                      <div className="provas-tel-item">
                        <span className="provas-tel-lbl">Bateria</span>
                        <span className={`provas-tel-val ${aluno.battery < 20 ? 'danger' : ''}`}>🔋 {aluno.battery}%</span>
                      </div>
                      <div className="provas-tel-item">
                        <span className="provas-tel-lbl">Foco da Tela</span>
                        <span className={`provas-tel-val ${!aluno.screenStatus?.isFocused ? 'danger' : 'ok'}`}>
                          {aluno.screenStatus?.isFocused ? 'Focado' : 'Sem Foco ⚠️'}
                        </span>
                      </div>
                      <div className="provas-tel-item">
                        <span className="provas-tel-lbl">Tela Cheia</span>
                        <span className={`provas-tel-val ${!aluno.screenStatus?.isFullscreen ? 'danger' : 'ok'}`}>
                          {aluno.screenStatus?.isFullscreen ? 'Sim' : 'Não ⚠️'}
                        </span>
                      </div>
                      <div className="provas-tel-item">
                        <span className="provas-tel-lbl">Saídas da Prova</span>
                        <span className={`provas-tel-val ${aluno.blurCount > 0 ? 'danger' : 'ok'}`}>
                          {aluno.blurCount} saídas
                        </span>
                      </div>
                      <div className="provas-tel-item" style={{ gridColumn: 'span 2' }}>
                        <span className="provas-tel-lbl">Tempo Restante</span>
                        <span className="provas-tel-val">⌛ {getFormatTime(aluno.timeLeft)}</span>
                      </div>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="provas-card-progress-bar">
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${pct}%`, background: pct === 100 ? 'hsl(145, 63%, 49%)' : 'hsl(250, 89%, 65%)' }}></div>
                      </div>
                      <div className="bar-text">
                        <span>Progresso</span>
                        <span>{answeredQ}/{totalQ} respondidas ({Math.round(pct)}%)</span>
                      </div>
                    </div>

                    {/* Ações de Comando do Aluno */}
                    <div className="provas-student-card-actions">
                      {aluno.status === 'locked' ? (
                        <button className="btn pri" onClick={() => liberarAluno(aluno.id)} style={{ padding: '8px 4px', fontSize: '0.75rem', background: 'hsl(145, 63%, 49%)', border: 'none' }}>
                          🔓 Desbloquear
                        </button>
                      ) : (
                        <button className="btn" onClick={() => bloquearAluno(aluno.id)} style={{ padding: '8px 4px', fontSize: '0.75rem', color: 'hsl(355, 78%, 56%)', borderColor: 'rgba(239,68,68,0.2)' }}>
                          🔒 Bloquear
                        </button>
                      )}
                      
                      <button className="btn" onClick={() => setAlunoSelecionadoLogs(aluno)} style={{ padding: '8px 4px', fontSize: '0.75rem', color: 'var(--primary)', borderColor: 'rgba(99,102,241,0.2)' }}>
                        📋 Logs
                      </button>
                      
                      <button className="btn" onClick={() => setAlunoSelecionadoRespostas(aluno)} style={{ gridColumn: 'span 2', padding: '6px 4px', fontSize: '0.75rem', marginTop: '4px' }}>
                        👁️ Ver Respostas
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Lado Direito: Gestão de Questões & Feed de Alertas Globais */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Caixa de Questões */}
          <div className="card-box" style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#fff' }}>Gestão da Prova</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {questoes.length > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>✅ Há <strong>{questoes.length}</strong> questão(ões) ativas.</span>
                    <button onClick={limparQuestoes} className="btn" style={{ padding: '3px 8px', fontSize: '10px', color: 'hsl(355, 78%, 56%)', borderColor: 'rgba(239,68,68,0.2)' }}>
                      Excluir Prova
                    </button>
                  </div>
                ) : (
                  <span>❌ Nenhuma questão ativa no sistema. Importe um arquivo CSV.</span>
                )}
              </div>

              {/* Botão de Upload de CSV */}
              <div style={{ border: '2px dashed rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 10px', textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                <i className="ti ti-upload" style={{ fontSize: '1.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}></i>
                <label className="btn pri" style={{ cursor: 'pointer', display: 'inline-block', fontSize: '0.8rem', padding: '6px 12px' }}>
                  Escolher CSV de Prova
                  <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
                </label>
                <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Suporta UTF-8 BOM e delimitadores comuns (; ou ,)
                </span>
              </div>
            </div>
          </div>

          {/* Feed de Eventos/Logs Globais */}
          <div className="provas-logs-section">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>Linha do Tempo de Infrações</h3>
            <div className="provas-logs-feed">
              {getLogsGlobais().length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                  Nenhum evento registrado ainda.
                </p>
              ) : (
                getLogsGlobais().map((entry, idx) => (
                  <div key={idx} className={`provas-log-item log-${entry.log.type}`}>
                    <div className="provas-log-item-header">
                      <span className="provas-log-student-name">{entry.studentName}</span>
                      <span className="provas-log-time">{formatarDataHora(entry.log.timestamp)}</span>
                    </div>
                    <div>{entry.log.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

      </div>

      {/* 📋 MODAL DE LOGS DO ALUNO */}
      {alunoSelecionadoLogs && (
        <div className="aluno-modal-overlay" style={{ display: 'flex', zIndex: 1000 }}>
          <div className="aluno-confirm-modal-card" style={{ width: '90%', maxWidth: '600px', textAlign: 'left', background: 'hsl(222, 47%, 11%)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Histórico de Telemetria</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Acompanhe a linha do tempo completa de <strong>{alunoSelecionadoLogs.name}</strong> (Matrícula: {alunoSelecionadoLogs.id})
            </p>
            
            <div className="provas-modal-logs-list">
              {alunoSelecionadoLogs.logs && alunoSelecionadoLogs.logs.length > 0 ? (
                alunoSelecionadoLogs.logs.map((log, lIdx) => (
                  <div key={lIdx} className={`provas-log-item log-${log.type}`} style={{ margin: 0 }}>
                    <div className="provas-log-item-header">
                      <span className="provas-log-student-name" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        {log.type === 'danger' ? '⚠️ Infração grave' : log.type === 'success' ? '✓ Sucesso' : 'ℹ Informação'}
                      </span>
                      <span className="provas-log-time">{formatarDataHora(log.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{log.message}</div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>Sem logs registrados.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn" onClick={() => setAlunoSelecionadoLogs(null)}>
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👁️ MODAL DE RESPOSTAS DO ALUNO */}
      {alunoSelecionadoRespostas && (
        <div className="aluno-modal-overlay" style={{ display: 'flex', zIndex: 1000 }}>
          <div className="aluno-confirm-modal-card" style={{ width: '90%', maxWidth: '700px', textAlign: 'left', background: 'hsl(222, 47%, 11%)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Respostas Enviadas</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Visualizando respostas de <strong>{alunoSelecionadoRespostas.name}</strong> (Matrícula: {alunoSelecionadoRespostas.id})
            </p>
            
            <div style={{ maxHeight: '50vh', overflowY: 'auto', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questoes.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>Não há questões cadastradas nesta prova para comparar.</p>
              ) : (
                questoes.map((q, qIdx) => {
                  const respostaAluno = alunoSelecionadoRespostas.answers?.[q.id];
                  const hasAnswer = respostaAluno !== undefined && respostaAluno !== null && respostaAluno !== '';
                  
                  return (
                    <div key={q.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>
                        {qIdx + 1}. {q.question}
                      </div>

                      {q.type === 'multiple-choice' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                          {q.options?.map((opt, optIdx) => {
                            const isCorrect = q.answer === optIdx;
                            const isSelected = respostaAluno === optIdx;
                            return (
                              <div key={optIdx} style={{ 
                                padding: '6px 10px', 
                                borderRadius: '6px', 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                background: isSelected 
                                  ? (isCorrect ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)') 
                                  : (isCorrect ? 'rgba(34, 197, 94, 0.05)' : 'transparent'),
                                border: isSelected 
                                  ? (isCorrect ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)') 
                                  : '1px solid transparent'
                              }}>
                                <span>{opt}</span>
                                <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                                  {isSelected && isCorrect && '✓ Resposta do Aluno (Correta)'}
                                  {isSelected && !isCorrect && '✗ Resposta do Aluno (Incorreta)'}
                                  {!isSelected && isCorrect && '(Gabarito)'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'essay' && (
                        <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <strong>Resposta do Aluno:</strong>
                            <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-line', color: '#fff' }}>
                              {hasAnswer ? respostaAluno : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Sem resposta</span>}
                            </p>
                          </div>
                          {q.answer && (
                            <div style={{ background: 'rgba(34, 197, 94, 0.03)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                              <strong style={{ color: 'hsl(145, 63%, 49%)' }}>Gabarito/Critério sugerido:</strong>
                              <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>{q.answer}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {q.type === 'true-false' && q.statements && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                          {q.statements.map((stmt, stmtIdx) => {
                            const ansCorrect = q.answers?.[stmtIdx];
                            const ansAluno = respostaAluno?.[stmtIdx];
                            const isCorrect = ansCorrect === ansAluno;
                            
                            return (
                              <div key={stmtIdx} style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                padding: '6px 8px', 
                                background: 'rgba(0,0,0,0.1)', 
                                borderRadius: '6px' 
                              }}>
                                <span>{stmtIdx + 1}. {stmt}</span>
                                <div style={{ display: 'flex', gap: '12px', fontWeight: 600 }}>
                                  <span>Gabarito: <strong style={{ color: ansCorrect ? 'hsl(145, 63%, 49%)' : 'hsl(355, 78%, 56%)' }}>{ansCorrect ? 'V' : 'F'}</strong></span>
                                  <span>Aluno: <strong style={{ 
                                    color: ansAluno === null || ansAluno === undefined 
                                      ? 'var(--text-muted)' 
                                      : (isCorrect ? 'hsl(145, 63%, 49%)' : 'hsl(355, 78%, 56%)') 
                                  }}>
                                    {ansAluno === null || ansAluno === undefined ? '—' : (ansAluno ? 'V' : 'F')}
                                  </strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn" onClick={() => setAlunoSelecionadoRespostas(null)}>
                Fechar Respostas
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProvasPage;
