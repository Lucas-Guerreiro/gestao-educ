import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Bimestre } from '@/types';

interface BimestresPageProps {
  bimestres: Bimestre[];
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const BimestresPage: React.FC<BimestresPageProps> = ({ bimestres, setSyncStatus }) => {
  const [nome, setNome] = useState('');
  const [peso, setPeso] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || peso <= 0) {
      alert('Preencha o nome e um peso maior que zero.');
      return;
    }

    setSyncStatus('saving');
    try {
      const payload = {
        nome: nome.trim(),
        peso: Number(peso)
      };

      if (editingId) {
        await updateDoc(doc(db, 'bimestres', editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'bimestres'), payload);
      }
      setNome('');
      setPeso(1);
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao salvar bimestre: ' + (err as Error).message);
    }
  };

  const editar = (bim: Bimestre) => {
    setEditingId(bim.id);
    setNome(bim.nome);
    setPeso(bim.peso);
  };

  const deletar = async (id: string) => {
    if (!confirm('Deseja realmente deletar este bimestre?')) return;
    setSyncStatus('saving');
    try {
      await deleteDoc(doc(db, 'bimestres', id));
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao deletar bimestre: ' + (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', padding: '1rem', flexWrap: 'wrap' }}>
      
      {/* Form */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', height: 'fit-content' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-calendar" style={{ color: 'var(--primary)' }}></i> {editingId ? 'Editar Bimestre' : 'Novo Bimestre'}
        </div>

        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="f">
            <label>Nome do Bimestre *</label>
            <input 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              placeholder="Ex: 1º Bimestre, 2º Bimestre..." 
            />
          </div>
          
          <div className="f">
            <label>Peso Computacional (ex: 2) *</label>
            <input 
              type="number"
              min="0.1"
              step="0.1"
              value={peso} 
              onChange={(e) => setPeso(parseFloat(e.target.value) || 1)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {editingId && (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setNome(''); setPeso(1); }}>
                Cancelar
              </button>
            )}
            <button type="submit" className="btn pri">
              {editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          <i className="ti ti-list" style={{ color: 'var(--primary)' }}></i> Bimestres Letivos
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {bimestres.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>Nenhum bimestre cadastrado.</div>
          ) : (
            bimestres.map(bim => (
              <div 
                key={bim.id} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px' }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{bim.nome}</span>
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>⚖️ Peso: {bim.peso}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => editar(bim)}>
                    <i className="ti ti-pencil"></i>
                  </button>
                  <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => deletar(bim.id)}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default BimestresPage;
