import React, { useState, useRef } from 'react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Turma } from '@/types';
import * as XLSX from 'xlsx';

interface ImportModalProps {
  turmas: Turma[];
  fecharModal: () => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const ImportModal: React.FC<ImportModalProps> = ({
  turmas,
  fecharModal,
  setSyncStatus,
}) => {
  const [turmaId, setTurmaId] = useState('');
  const [fileName, setFileName] = useState('');
  const [feedback, setFeedback] = useState({ text: '', color: '' });
  const [fileData, setFileData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFeedback({ text: 'Lendo planilha...', color: 'var(--warning)' });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          setFeedback({ text: 'Planilha vazia ou com formato inválido.', color: 'var(--danger)' });
          return;
        }

        setFileData(jsonData);
        setFeedback({ text: `${jsonData.length} alunos detectados na planilha. Selecione a turma de destino.`, color: 'var(--success)' });
      } catch (err: any) {
        setFeedback({ text: 'Erro ao ler planilha: ' + err.message, color: 'var(--danger)' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processarImportacao = async () => {
    if (!turmaId) {
      setFeedback({ text: 'Selecione uma turma de destino.', color: 'var(--danger)' });
      return;
    }
    if (fileData.length === 0) {
      setFeedback({ text: 'Selecione um arquivo de planilha válido com alunos.', color: 'var(--danger)' });
      return;
    }

    setFeedback({ text: `Importando e salvando no Firebase...`, color: 'var(--warning)' });
    setSyncStatus('saving');

    try {
      // Encontrar chave de nome
      const firstRow = fileData[0];
      let nomeKey = null;
      const chavesPossiveis = ['nome', 'nome completo', 'aluno', 'nome_aluno', 'nomecompleto', 'name', 'fullname'];
      
      for (const key in firstRow) {
        if (chavesPossiveis.includes(key.toLowerCase().trim())) {
          nomeKey = key;
          break;
        }
      }

      if (!nomeKey) {
        nomeKey = Object.keys(firstRow)[0];
      }

      const batch = writeBatch(db);
      let count = 0;

      fileData.forEach(row => {
        const nomeAluno = row[nomeKey];
        if (nomeAluno) {
          const docRef = doc(collection(db, 'alunos'));
          batch.set(docRef, {
            nome: String(nomeAluno).trim(),
            turmaId: turmaId,
            nascimento: '',
            ativo: true,
            observacoes: 'Importado por planilha Excel.'
          });
          count++;
        }
      });

      await batch.commit();
      setSyncStatus('ok');
      setFeedback({ text: `Sucesso! ${count} alunos importados e sincronizados com o Firebase!`, color: 'var(--success)' });
      
      setTimeout(() => {
        fecharModal();
      }, 1800);
    } catch (err: any) {
      setSyncStatus('err');
      setFeedback({ text: 'Erro ao importar alunos: ' + err.message, color: 'var(--danger)' });
    }
  };

  return (
    <div id="import-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 1000, alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '500px', margin: '1rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}><i className="ti ti-file-spreadsheet"></i> Importar Alunos (Excel/XLSX)</span>
          <button onClick={fecharModal} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#1e40af', lineHeight: 1.6, marginBottom: '14px' }}>
          <i className="ti ti-info-circle"></i> A planilha deve conter a coluna <b>Nome</b> ou <b>Nome Completo</b>. Selecione uma turma abaixo para vincular os alunos importados.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="f">
            <label>Turma de Destino *</label>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">— selecione —</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Arquivo de Planilha (.xlsx, .xls)</label>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".xlsx, .xls" 
              style={{ display: 'none' }} 
            />
            <button className="btn" onClick={handleSelectFile} style={{ borderColor: '#7c3aed', color: '#7c3aed' }}>
              <i className="ti ti-file-upload"></i> Selecionar Planilha
            </button>
            {fileName && (
              <span id="imp-file-name" style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {fileName}
              </span>
            )}
          </div>
        </div>
        {feedback.text && (
          <div id="imp-feedback" style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: feedback.color }}>
            {feedback.text}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <button className="btn" onClick={fecharModal}>Cancelar</button>
          <button className="btn suc" onClick={processarImportacao} style={{ color: '#fff' }}><i className="ti ti-download"></i> Importar Alunos</button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
