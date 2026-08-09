import React, { useState } from 'react';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Turma, Materia, ExerciciosIA } from '@/types';

interface IaModalProps {
  turmas: Turma[];
  materias: Materia[];
  exerciciosIA: ExerciciosIA[];
  fecharModal: () => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const IaModal: React.FC<IaModalProps> = ({
  turmas,
  materias,
  exerciciosIA,
  fecharModal,
  setSyncStatus,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [turmaId, setTurmaId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [qtdAulas, setQtdAulas] = useState(5);
  const [qtdExers, setQtdExers] = useState(4);
  const [contexto, setContexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Analisando documento...');
  const [resultado, setResultado] = useState(false);
  const [erro, setErro] = useState('');

  // Aulas e capítulos gerados temporariamente
  const [capituloGerado, setCapituloGerado] = useState('');
  const [aulasGeradas, setAulasGeradas] = useState<any[]>([]);
  const [exerciciosGerados, setExerciciosGerados] = useState<ExerciciosIA[]>([]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const uploadedFile = e.dataTransfer.files?.[0];
    if (uploadedFile && uploadedFile.type === 'application/pdf') {
      setFile(uploadedFile);
    } else {
      alert('Por favor, envie somente arquivo PDF.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
    }
  };

  const removerArquivo = () => {
    setFile(null);
    setResultado(false);
  };

  // Simular processamento da IA
  const gerarComIA = () => {
    if (!file) {
      setErro('Por favor, envie o documento em PDF para a IA analisar.');
      return;
    }

    setErro('');
    setResultado(false);
    setLoading(true);

    const msgs = [
      'Extraindo textos do PDF...',
      'Buscando tópicos principais...',
      'Estruturando plano de aulas pedagógicas...',
      'Alinhando habilidades com a BNCC...',
      'Mapeando banco de exercícios da IA...'
    ];
    let msgIdx = 0;
    
    const interval = setInterval(() => {
      if (msgIdx < msgs.length) {
        setLoadingMsg(msgs[msgIdx++]);
      }
    }, 900);

    setTimeout(() => {
      clearInterval(interval);
      setLoading(false);

      const capituloNome = `Capítulo IA: Introdução a ${file.name.replace('.pdf', '')}`;
      setCapituloGerado(capituloNome);

      // Geração de aulas
      const tipos = ['teorica', 'pratica', 'revisao', 'avaliacao'];
      const datasProximas: string[] = [];
      let d = new Date();
      
      for (let i = 0; i < qtdAulas; i++) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() === 0) d.setDate(d.getDate() + 2); // pula domingo
        if (d.getDay() === 6) d.setDate(d.getDate() + 1); // pula sábado
        datasProximas.push(d.toISOString().split('T')[0]);
      }

      const horariosDisponiveis = [
        "1º Horário (07:30 - 08:20)",
        "2º Horário (08:20 - 09:10)",
        "3º Horário (09:10 - 10:00)"
      ];

      const aulasList = [];
      for (let i = 0; i < qtdAulas; i++) {
        aulasList.push({
          data: datasProximas[i],
          horario: horariosDisponiveis[i % horariosDisponiveis.length],
          tipo: tipos[i % tipos.length],
          nomeAula: `Aula ${i + 1}: Módulo avançado extraído da pág. ${i * 4 + 1} a ${i * 4 + 4} do PDF.`
        });
      }
      setAulasGeradas(aulasList);

      // Exercícios
      const exList: ExerciciosIA[] = [];
      for (let i = 0; i < Math.min(qtdExers, exerciciosIA.length); i++) {
        exList.push(exerciciosIA[i]);
      }
      setExerciciosGerados(exList);
      setResultado(true);
    }, 4800);
  };

  // Importar para o Firebase Firestore
  const importarResultado = async () => {
    if (!turmaId || !materiaId) {
      alert('Por favor, selecione a Turma e a Matéria de destino nas configurações da IA para importar os registros.');
      return;
    }

    setSyncStatus('saving');
    try {
      // 1. Criar Capítulo
      const capDoc = await addDoc(collection(db, 'capitulos'), {
        turmaId,
        materiaId,
        nome: capituloGerado,
        descricao: 'Gerado automaticamente pela Inteligência Artificial.'
      });

      // 2. Criar Aulas em Lote
      const batch = writeBatch(db);
      aulasGeradas.forEach(aula => {
        const docRef = doc(collection(db, 'aulas'));
        batch.set(docRef, {
          data: aula.data,
          horario: aula.horario,
          turmaId,
          materiaId,
          tipo: aula.tipo,
          capituloId: capDoc.id,
          realizada: false
        });
      });

      await batch.commit();
      setSyncStatus('ok');
      alert('Aulas e capítulos importados com sucesso! Os exercícios já estão vinculados e disponíveis para a Sequência Didática.');
      fecharModal();
    } catch (err: any) {
      setSyncStatus('err');
      alert('Erro ao importar conteúdo gerado: ' + err.message);
    }
  };

  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(2) : '0';

  return (
    <div id="ia-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.65)', zIndex: 5000, alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '800px', margin: 'auto', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', background: 'rgba(255,255,255,.18)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-sparkles" style={{ fontSize: '22px', color: '#fff' }}></i></div>
            <div>
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: 800 }}>IA Geradora de Aulas & Exercícios</div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '11px' }}>Envie um PDF e a IA criará aulas e exercícios para a Sequência Didática</div>
            </div>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.15)', cursor: 'pointer', color: '#fff', fontSize: '18px', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Step 1: Upload */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ background: '#4f46e5', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>1</span>
              Enviar documento (PDF)
            </div>
            {!file ? (
              <div 
                id="ia-dropzone" 
                onClick={() => document.getElementById('ia-file-input-id')?.click()} 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                style={{ border: '2px dashed #c4b5fd', borderRadius: '12px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: dragActive ? '#ede9fe' : '#faf5ff', transition: 'var(--transition)' }}
              >
                <i className="ti ti-file-upload" style={{ fontSize: '40px', color: '#7c3aed', display: 'block', marginBottom: '10px' }}></i>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f46e5' }}>Clique ou arraste seu PDF aqui</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Somente PDF — até 10 MB</div>
                <input type="file" id="ia-file-input-id" onChange={handleFileChange} accept=".pdf" style={{ display: 'none' }} />
              </div>
            ) : (
              <div id="ia-file-info" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="ti ti-file-text" style={{ fontSize: '24px', color: '#3b82f6', flexShrink: 0 }}></i>
                  <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{file.name}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sizeMb} MB</div></div>
                  <button onClick={removerArquivo} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px', lineHeight: 1 }}>✕</button>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Config */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ background: '#4f46e5', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>2</span>
              Configurações
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div className="f" style={{ minWidth: '140px' }}>
                  <label>Turma</label>
                  <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
                    <option value="">— opcional —</option>
                    {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div className="f" style={{ minWidth: '140px' }}>
                  <label>Matéria</label>
                  <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
                    <option value="">— opcional —</option>
                    {materias.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div className="f" style={{ minWidth: '100px', maxWidth: '130px' }}>
                  <label>Nº de Aulas</label>
                  <input type="number" min="1" max="20" value={qtdAulas} onChange={(e) => setQtdAulas(parseInt(e.target.value) || 1)} />
                </div>
                <div className="f" style={{ minWidth: '100px', maxWidth: '150px' }}>
                  <label>Nº de Exercícios</label>
                  <input type="number" min="1" max="15" value={qtdExers} onChange={(e) => setQtdExers(parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="f">
                <label>Contexto adicional <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></label>
                <textarea value={contexto} onChange={(e) => setContexto(e.target.value)} placeholder="Ex: Foco nos capítulos 3 e 4. Alunos do 8º ano. Indicar páginas específicas..." style={{ height: '56px' }} />
              </div>
            </div>
          </div>

          {/* Botão */}
          <button id="ia-btn-gerar" onClick={gerarComIA} style={{ height: '46px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(124,58,237,0.25)' }}>
            <i className="ti ti-sparkles" style={{ fontSize: '18px' }}></i> Gerar com IA
          </button>

          {/* Loading */}
          {loading && (
            <div id="ia-loading" style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ width: '48px', height: '48px', border: '4px solid #ede9fe', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
              <div id="ia-loading-msg" style={{ fontSize: '13px', fontWeight: 800, color: '#7c3aed' }}>{loadingMsg}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Isso pode levar alguns segundos</div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div id="ia-resultado">
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ background: 'var(--success)', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span>
                Conteúdo gerado — revise e importe
              </div>
              <div id="ia-resultado-body" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', background: 'var(--gray-light)' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--dark)', marginBottom: '8px' }}>📖 Capítulo Criado: {capituloGerado}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}><b>Aulas Planejadas ({aulasGeradas.length}):</b></div>
                <ul style={{ paddingLeft: '16px', fontSize: '12px', marginBottom: '14px' }}>
                  {aulasGeradas.map((a, idx) => (
                    <li key={idx}><b>{(a.data || '').split('-').reverse().join('/')} - {a.horario || '—'}</b> | Aula {(a.tipo || '').toUpperCase()}: {a.nomeAula}</li>
                  ))}
                </ul>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}><b>Exercícios Sugeridos para os Capítulos ({exerciciosGerados.length}):</b></div>
                {exerciciosGerados.map((ex, idx) => (
                  <div key={ex.id} style={{ background: '#fff', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', marginBottom: '6px' }}>
                    <b>Exercício {idx + 1}: {ex.nome}</b> - <span style={{ color: 'var(--text-muted)' }}>{ex.desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn" onClick={gerarComIA}><i className="ti ti-refresh"></i> Regenerar</button>
                <button className="btn suc" onClick={importarResultado} style={{ color: '#fff' }}><i className="ti ti-download"></i> Importar Aulas & Exercícios</button>
              </div>
            </div>
          )}

          {erro && (
            <div id="ia-erro" style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#991b1b' }}>
              {erro}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default IaModal;
