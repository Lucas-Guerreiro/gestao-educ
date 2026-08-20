import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Turma, Materia, Bimestre } from '@/types';

interface CriarAtividadeModalProps {
  turmaId: string;
  materiaId: string;
  bimestreId: string;
  turmas: Turma[];
  materias: Materia[];
  bimestres: Bimestre[];
  fecharModal: () => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const CriarAtividadeModal: React.FC<CriarAtividadeModalProps> = ({
  turmaId: defaultTurmaId,
  materiaId: defaultMateriaId,
  bimestreId: defaultBimestreId,
  turmas,
  materias,
  bimestres,
  fecharModal,
  setSyncStatus
}) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'prova' | 'trabalho' | 'qualitativa' | 'pluraal'>('prova');
  const [turmaId, setTurmaId] = useState(defaultTurmaId);
  const [materiaId, setMateriaId] = useState(defaultMateriaId);
  const [bimestreId, setBimestreId] = useState(defaultBimestreId);
  const [peso, setPeso] = useState(1);
  const [descricao, setDescricao] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [liberadoVencido, setLiberadoVencido] = useState(false);
  const [loading, setLoading] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !turmaId || !materiaId || !bimestreId || peso <= 0) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    setSyncStatus('saving');
    try {
      const payload = {
        nome: nome.trim(),
        tipo,
        turmaId,
        materiaId,
        bimestreId,
        peso: Number(peso),
        descricao: descricao.trim(),
        dataLimite: dataLimite || '',
        liberadoVencido: !!liberadoVencido
      };

      await addDoc(collection(db, 'atividades'), payload);
      setSyncStatus('ok');
      fecharModal();
    } catch (err) {
      console.error('Erro ao criar atividade:', err);
      setSyncStatus('err');
      alert('Erro ao criar atividade: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="criar-atividade-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 3000, alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexShrink: 0, color: '#fff', background: 'linear-gradient(135deg, var(--dark), var(--dark-hover))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-checklist" style={{ fontSize: '20px' }}></i>
            <span style={{ fontSize: '15px', fontWeight: 800 }}>Criar Nova Atividade</span>
          </div>
          <button type="button" onClick={fecharModal} style={{ border: 'none', background: 'rgba(255,255,255,.2)', cursor: 'pointer', fontSize: '18px', color: '#fff', lineHeight: 1, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '20px', gap: '12px' }}>
          
          <div className="f">
            <label>Nome da Atividade *</label>
            <input 
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Prova Trimestral, Trabalho do Livro..."
              style={{ padding: '8px 12px', fontSize: '13px' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                <option value="prova">📝 Prova / Exame</option>
                <option value="trabalho">📚 Trabalho / Seminário</option>
                <option value="pluraal">💜 Atividade PLURAAL</option>
                <option value="qualitativa">🌟 Avaliação Qualitativa</option>
              </select>
            </div>

            <div className="f">
              <label>Peso (Nota Máxima) *</label>
              <input 
                type="number"
                step="any"
                value={peso}
                onChange={(e) => setPeso(Number(e.target.value))}
                min="0.1"
                style={{ padding: '8px 12px', fontSize: '13px' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Turma</label>
              <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} disabled>
                <option value="">— selecione —</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <div className="f">
              <label>Matéria</label>
              <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)} disabled>
                <option value="">— selecione —</option>
                {materias.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="f">
              <label>Bimestre *</label>
              <select value={bimestreId} onChange={(e) => setBimestreId(e.target.value)} required>
                <option value="">— selecione —</option>
                {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}{b.ano ? ` (${b.ano})` : ''}</option>)}
              </select>
            </div>

            <div className="f">
              <label>Data Limite (Opcional)</label>
              <input 
                type="date"
                value={dataLimite}
                onChange={(e) => setDataLimite(e.target.value)}
                style={{ padding: '7px 12px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div className="f" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <input 
              id="ca-liberado-checkbox"
              type="checkbox" 
              checked={liberadoVencido} 
              onChange={(e) => setLiberadoVencido(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="ca-liberado-checkbox" style={{ fontSize: '11.5px', cursor: 'pointer', userSelect: 'none', fontWeight: 600, color: 'var(--text-main)' }}>
              Permitir lançamentos após a data limite
            </label>
          </div>

          <div className="f">
            <label>Descrição / Instruções (Opcional)</label>
            <textarea 
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva as instruções ou tópicos cobrados..."
              rows={3}
              style={{ padding: '8px 12px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px', flexShrink: 0 }}>
            <button type="button" className="btn" onClick={fecharModal} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn pri" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading ? (
                <>⏳ Criando...</>
              ) : (
                <>
                  <i className="ti ti-device-floppy"></i> Criar Atividade
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CriarAtividadeModal;
