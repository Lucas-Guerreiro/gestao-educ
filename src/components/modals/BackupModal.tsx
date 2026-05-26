import React, { useState, useRef } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';

interface BackupModalProps {
  fecharModal: () => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const BackupModal: React.FC<BackupModalProps> = ({ fecharModal, setSyncStatus }) => {
  const [filename, setFilename] = useState('');
  const [formato, setFormato] = useState('json');
  const [log, setLog] = useState({ text: '', color: '' });
  const [restoreText, setRestoreText] = useState('');
  const [restoreFileName, setRestoreFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colecoes = [
    'escolas', 'turmas', 'alunos', 'materias', 'professores', 
    'bimestres', 'atividades', 'capitulos', 'aulas', 'sequencias_didaticas', 'notas'
  ];

  // Baixar Backup
  const downloadBackup = async () => {
    setLog({ text: 'Buscando todos os registros do Firebase...', color: 'var(--warning)' });
    try {
      const backupData: Record<string, any[]> = {};
      for (const col of colecoes) {
        const snapshot = await getDocs(collection(db, col));
        backupData[col] = [];
        snapshot.forEach(docSnap => {
          backupData[col].push({ id: docSnap.id, ...docSnap.data() });
        });
      }

      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { 
        type: formato === 'json' ? 'application/json' : 'text/plain' 
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fn = filename.trim() || 'backup_escola';
      link.download = `${fn}_${new Date().toISOString().split('T')[0]}.${formato}`;
      
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setLog({ text: 'Backup baixado com sucesso!', color: 'var(--success)' });
    } catch (err: any) {
      setLog({ text: 'Erro ao realizar backup: ' + err.message, color: 'var(--danger)' });
    }
  };

  // Upload arquivo trigger
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setRestoreText(evt.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  // Restaurar Backup no Firebase
  const restaurarBackup = async () => {
    const text = restoreText.trim();
    if (!text) {
      setLog({ text: 'Forneça o JSON do backup para restauração.', color: 'var(--danger)' });
      return;
    }

    setLog({ text: 'Analisando arquivo de backup...', color: 'var(--warning)' });
    try {
      const backupData = JSON.parse(text);
      
      // Validação das coleções chaves
      if (!backupData.escolas || !backupData.turmas || !backupData.alunos) {
        setLog({ text: 'Formato de backup inválido. Chaves fundamentais ausentes.', color: 'var(--danger)' });
        return;
      }

      setSyncStatus('saving');
      setLog({ text: 'Limpando dados antigos e restaurando backup no Firebase...', color: 'var(--warning)' });

      // 1. Limpeza de coleções antigas no Firebase
      for (const col of colecoes) {
        const snapshot = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }

      // 2. Restauração dos dados do backup
      for (const col of colecoes) {
        if (backupData[col] && backupData[col].length > 0) {
          const batch = writeBatch(db);
          backupData[col].forEach((item: any) => {
            const docId = item.id;
            const payload = { ...item };
            delete payload.id; // remove o campo ID redundante
            
            const docRef = doc(db, col, docId);
            batch.set(docRef, payload);
          });
          await batch.commit();
        }
      }

      setSyncStatus('ok');
      setLog({ text: 'Todos os dados do backup foram restaurados com sucesso!', color: 'var(--success)' });
      setTimeout(fecharModal, 2000);
    } catch (err: any) {
      setSyncStatus('err');
      setLog({ text: 'Erro na restauração: ' + err.message, color: 'var(--danger)' });
    }
  };

  return (
    <div id="gdrive-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 4000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '460px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: '#fff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-cloud-download" style={{ fontSize: '20px', color: '#1e293b' }}></i>
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '14px', fontWeight: 800 }}>Backup de Dados</div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>Exportar e importar dados</div>
            </div>
          </div>
          <button onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', fontSize: '16px', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#1e40af', lineHeight: 1.6 }}>
            <i className="ti ti-info-circle"></i> O arquivo de backup será salvo na sua pasta de Downloads.
          </div>
          <div className="f">
            <label>Nome do arquivo</label>
            <input 
              value={filename} 
              onChange={(e) => setFilename(e.target.value)} 
              placeholder="backup_escola" 
            />
          </div>
          <div className="f">
            <label>Formato</label>
            <select value={formato} onChange={(e) => setFormato(e.target.value)}>
              <option value="json">JSON (.json)</option>
              <option value="txt">Texto (.txt)</option>
            </select>
          </div>
          <button className="btn suc" onClick={downloadBackup} style={{ height: '40px', fontSize: '13px', width: '100%' }}>
            <i className="ti ti-download"></i> Baixar backup
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.5px' }}>RESTAURAR</span>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
          </div>
          
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".json,.txt" 
              style={{ display: 'none' }} 
            />
            <button className="btn" onClick={handleSelectFile} style={{ width: '100%', borderColor: '#7c3aed', color: '#7c3aed', height: '38px' }}>
              <i className="ti ti-file-upload"></i> Selecionar arquivo de backup
            </button>
            {restoreFileName && (
              <div id="gd-restore-info" style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', minHeight: '14px', fontWeight: 600 }}>
                {restoreFileName}
              </div>
            )}
            <textarea 
              value={restoreText} 
              onChange={(e) => setRestoreText(e.target.value)} 
              placeholder="Ou cole o conteúdo JSON do backup aqui..." 
              style={{ width: '100%', height: '70px', fontSize: '11px', fontFamily: 'monospace', marginTop: '8px' }}
            />
            <button className="btn suc" onClick={restaurarBackup} style={{ width: '100%', marginTop: '8px', height: '36px' }}>
              <i className="ti ti-check"></i> Restaurar dados
            </button>
          </div>
          {log.text && (
            <div id="gd-log" style={{ fontSize: '11px', minHeight: '16px', lineHeight: 1.5, fontWeight: 600, color: log.color }}>
              {log.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupModal;
