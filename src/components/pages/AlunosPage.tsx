import React, { useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Aluno, Turma, Escola } from '@/types';

interface AlunosPageProps {
  alunos: Aluno[];
  turmas: Turma[];
  escolas: Escola[];
  abrirAlunoModal: (alunoId: string | null) => void;
  abrirImportModal: () => void;
  setSyncStatus: (status: 'ok' | 'saving' | 'err') => void;
}

const AlunosPage: React.FC<AlunosPageProps> = ({
  alunos,
  turmas,
  escolas,
  abrirAlunoModal,
  abrirImportModal,
  setSyncStatus,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');

  const deletarAluno = async (id: string) => {
    if (!confirm('Deseja realmente excluir este aluno?')) return;
    setSyncStatus('saving');
    try {
      await deleteDoc(doc(db, 'alunos', id));
      setSyncStatus('ok');
    } catch (err) {
      setSyncStatus('err');
      alert('Erro ao excluir aluno: ' + (err as Error).message);
    }
  };

  // Filtrar
  const alunosFiltrados = alunos.filter(a => {
    const atendeBusca = a.nome.toLowerCase().includes(busca.toLowerCase());
    const atendeTurma = filtroTurma ? a.turmaId === filtroTurma : true;
    return atendeBusca && atendeTurma;
  });

  const formatarData = (dt?: string) => {
    if (!dt) return '—';
    const partes = dt.split('-');
    if (partes.length !== 3) return dt;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Header com Ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px', maxWidth: '600px' }}>
          <input 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar aluno por nome..." 
            style={{ flex: 2, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px' }}
          />
          <select 
            value={filtroTurma} 
            onChange={(e) => setFiltroTurma(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '13px' }}
          >
            <option value="">🏫 Todas as Turmas</option>
            {turmas.map(t => {
              const esc = escolas.find(e => e.id === t.escolaId);
              return (
                <option key={t.id} value={t.id}>
                  {t.nome} ({esc ? esc.nome : 'Escola'})
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={abrirImportModal} style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
            <i className="ti ti-file-excel"></i> Importar Excel (SheetJS)
          </button>
          <button className="btn pri" onClick={() => abrirAlunoModal(null)}>
            <i className="ti ti-plus"></i> Novo Aluno
          </button>
        </div>
      </div>

      {/* Lista de Alunos */}
      <div className="card-box" style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 }}>
              <th style={{ padding: '10px 12px' }}>Nome do Aluno</th>
              <th style={{ padding: '10px 12px' }}>Turma Vinculada</th>
              <th style={{ padding: '10px 12px' }}>Data de Nascimento</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {alunosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Nenhum aluno encontrado correspondente aos filtros.
                </td>
              </tr>
            ) : (
              alunosFiltrados.map(a => {
                const tur = turmas.find(t => t.id === a.turmaId);
                const esc = tur ? escolas.find(e => e.id === tur.escolaId) : null;
                const statusAtivo = a.ativo !== false;

                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', transition: '0.15s' }} className="table-row-hover">
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-main)' }}>{a.nome}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{tur ? tur.nome : 'Turma Removida'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{esc ? esc.nome : ''}</div>
                    </td>
                    <td style={{ padding: '12px' }}>{formatarData(a.nascimento)}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontSize: '11px', 
                        fontWeight: 700,
                        background: statusAtivo ? 'var(--success-light)' : 'var(--danger-light)',
                        color: statusAtivo ? 'var(--success-text)' : 'var(--danger-text)'
                      }}>
                        {statusAtivo ? '✅ ATIVO' : '⛔ INATIVO'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => abrirAlunoModal(a.id)}>
                          <i className="ti ti-pencil"></i> Editar
                        </button>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => deletarAluno(a.id)}>
                          <i className="ti ti-trash"></i> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default AlunosPage;
