import React, { useState, useMemo } from 'react';
import { Aluno, Atividade } from '@/types';

interface ExportarPdfNotasModalProps {
  isOpen: boolean;
  onClose: () => void;
  escolaNome: string;
  turmaNome: string;
  materiaNome: string;
  bimestreNome: string;
  atividade: Atividade;
  todasAtividades?: Atividade[];
  alunos: Aluno[];
  obterNotaValor: (alunoId: string, ativId: string) => string;
  obterNotaMaxima: (tipo: string) => number;
}

const ExportarPdfNotasModal: React.FC<ExportarPdfNotasModalProps> = ({
  isOpen,
  onClose,
  escolaNome,
  turmaNome,
  materiaNome,
  bimestreNome,
  atividade,
  todasAtividades,
  alunos,
  obterNotaValor,
  obterNotaMaxima,
}) => {
  if (!isOpen) return null;

  const [atividadeSelecionadaId, setAtividadeSelecionadaId] = useState(atividade.id);

  const atividadeAtual = useMemo(() => {
    if (todasAtividades && todasAtividades.length > 0) {
      return todasAtividades.find(a => a.id === atividadeSelecionadaId) || atividade;
    }
    return atividade;
  }, [todasAtividades, atividadeSelecionadaId, atividade]);

  const notaMaxima = useMemo(() => obterNotaMaxima(atividadeAtual.tipo), [atividadeAtual.tipo, obterNotaMaxima]);

  // Alunos ordenados alfabeticamente
  const alunosOrdenados = useMemo(() => {
    return [...alunos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos]);

  // Estado dos alunos selecionados para o PDF (por padrão todos)
  const [selectedAlunoIds, setSelectedAlunoIds] = useState<string[]>(() => alunosOrdenados.map(a => a.id));
  const [tituloRelatorio, setTituloRelatorio] = useState(`Relatório de Notas - ${atividadeAtual.nome}`);
  const [incluirEstatisticas, setIncluirEstatisticas] = useState(true);
  const [incluirAssinatura, setIncluirAssinatura] = useState(true);
  const [observacoes, setObservacoes] = useState('');

  // Toggle de seleção individual
  const toggleAluno = (id: string) => {
    setSelectedAlunoIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Selecionar todos / desmarcar todos
  const toggleSelecionarTodos = () => {
    if (selectedAlunoIds.length === alunosOrdenados.length) {
      setSelectedAlunoIds([]);
    } else {
      setSelectedAlunoIds(alunosOrdenados.map(a => a.id));
    }
  };

  // Filtrar apenas os alunos selecionados
  const alunosParaImprimir = useMemo(() => {
    return alunosOrdenados.filter(a => selectedAlunoIds.includes(a.id));
  }, [alunosOrdenados, selectedAlunoIds]);

  // Estatísticas das notas selecionadas
  const estatisticas = useMemo(() => {
    let soma = 0;
    let validas = 0;
    let pendentes = 0;
    let faltas = 0;
    let maiorNota = -1;
    let menorNota = 999;

    alunosParaImprimir.forEach(aluno => {
      const vStr = obterNotaValor(aluno.id, atividadeAtual.id);
      if (!vStr || vStr.trim() === '') {
        pendentes++;
      } else if (vStr.toLowerCase() === 'faltou') {
        faltas++;
      } else {
        const num = Number(vStr.replace(',', '.'));
        if (!isNaN(num)) {
          soma += num;
          validas++;
          if (num > maiorNota) maiorNota = num;
          if (num < menorNota) menorNota = num;
        } else {
          pendentes++;
        }
      }
    });

    const media = validas > 0 ? (soma / validas).toFixed(1) : '—';
    return {
      total: alunosParaImprimir.length,
      validas,
      pendentes,
      faltas,
      media,
      maiorNota: maiorNota >= 0 ? maiorNota.toFixed(1) : '—',
      menorNota: menorNota <= 100 ? menorNota.toFixed(1) : '—'
    };
  }, [alunosParaImprimir, obterNotaValor]);

  // Disparar impressão / Salvar PDF
  const dispararImpressao = () => {
    window.print();
  };

  const dataAtualFormatada = useMemo(() => {
    const hoje = new Date();
    return hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, []);

  return (
    <div
      className="export-pdf-modal-wrapper"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      {/* Container do Modal */}
      <div
        className="no-print"
        style={{
          background: '#fff',
          borderRadius: '16px',
          maxWidth: '780px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* Header do Modal */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            padding: '16px 20px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: '#dc2626',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <i className="ti ti-file-text" style={{ fontSize: '18px' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>Exportar Notas em Arquivo PDF</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Gere um relatório formatado para impressão ou download em PDF
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Corpo do Modal (Configurações e Seleção de Alunos) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Seletor de Atividade (se houver mais de uma disponível) */}
          {todasAtividades && todasAtividades.length > 1 && (
            <div className="f">
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                Selecione a Atividade para o Relatório
              </label>
              <select
                value={atividadeSelecionadaId}
                onChange={(e) => {
                  setAtividadeSelecionadaId(e.target.value);
                  const ativObj = todasAtividades.find(a => a.id === e.target.value);
                  if (ativObj) setTituloRelatorio(`Relatório de Notas - ${ativObj.nome}`);
                }}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', background: '#fff' }}
              >
                {todasAtividades.map(a => (
                  <option key={a.id} value={a.id}>{a.nome} ({a.tipo.toUpperCase()} - Peso {a.peso})</option>
                ))}
              </select>
            </div>
          )}

          {/* Título do Relatório */}
          <div className="f">
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Título do Relatório
            </label>
            <input
              type="text"
              value={tituloRelatorio}
              onChange={(e) => setTituloRelatorio(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%' }}
            />
          </div>

          {/* Opções de Inclusão */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={incluirEstatisticas}
                onChange={(e) => setIncluirEstatisticas(e.target.checked)}
                style={{ accentColor: '#2563eb' }}
              />
              Incluir Estatísticas da Turma (Média, Maior e Menor Nota)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={incluirAssinatura}
                onChange={(e) => setIncluirAssinatura(e.target.checked)}
                style={{ accentColor: '#2563eb' }}
              />
              Incluir Campo para Assinatura do Professor
            </label>
          </div>

          {/* Seleção de Uma ou Mais Notas (Alunos) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
                Selecionar Alunos para o PDF ({selectedAlunoIds.length} de {alunosOrdenados.length})
              </label>
              <button
                type="button"
                onClick={toggleSelecionarTodos}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                {selectedAlunoIds.length === alunosOrdenados.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '190px', overflowY: 'auto', padding: '6px', background: '#fff' }}>
              {alunosOrdenados.map((aluno, index) => {
                const notaVal = obterNotaValor(aluno.id, atividadeAtual.id);
                const isSelected = selectedAlunoIds.includes(aluno.id);

                return (
                  <div
                    key={aluno.id}
                    onClick={() => toggleAluno(aluno.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: isSelected ? '#f0fdf4' : 'transparent',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      fontSize: '12.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // tratado no onClick da div
                        style={{ cursor: 'pointer', accentColor: '#16a34a' }}
                      />
                      <span style={{ color: '#94a3b8', fontSize: '11px', width: '20px' }}>{index + 1}.</span>
                      <span style={{ fontWeight: 600, color: isSelected ? '#1e293b' : '#64748b' }}>{aluno.nome}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: notaVal ? '#dbeafe' : '#f1f5f9',
                          color: notaVal ? '#1e40af' : '#94a3b8'
                        }}
                      >
                        {notaVal ? `Nota: ${notaVal}` : 'Sem nota'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Observações Opcionais */}
          <div className="f">
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Observações no Rodapé (Opcional)
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Alunos com pendência devem procurar o docente até sexta-feira."
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', width: '100%' }}
            />
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            📄 Serão impressos <b>{selectedAlunoIds.length}</b> aluno(s)
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={dispararImpressao}
              disabled={selectedAlunoIds.length === 0}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: selectedAlunoIds.length === 0 ? '#94a3b8' : '#dc2626',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: selectedAlunoIds.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.25)'
              }}
            >
              <i className="ti ti-printer" style={{ fontSize: '16px' }}></i>
              Gerar PDF / Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA EXCLUSIVA DE IMPRESSÃO (Folha A4 formatada visível apenas no @media print) */}
      <div id="relatorio-notas-pdf" className="area-impressao-pdf" style={{ display: 'none' }}>
        {/* Cabeçalho Institucional */}
        <div style={{ borderBottom: '2px solid #1e293b', paddingBottom: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>
              {escolaNome || 'SISTEMA ESCOLAR'}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
              {tituloRelatorio}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
            <div>Emissão: <b>{dataAtualFormatada}</b></div>
            <div>Ano Letivo: <b>{new Date().getFullYear()}</b></div>
          </div>
        </div>

        {/* Metadados da Atividade e Turma */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #e2e8f0', fontSize: '11.5px' }}>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Turma</span>
            <b style={{ color: '#0f172a', fontSize: '13px' }}>{turmaNome}</b>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Matéria</span>
            <b style={{ color: '#0f172a', fontSize: '13px' }}>{materiaNome}</b>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Bimestre</span>
            <b style={{ color: '#0f172a', fontSize: '13px' }}>{bimestreNome}</b>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Nota Máxima</span>
            <b style={{ color: '#dc2626', fontSize: '13px' }}>{notaMaxima.toFixed(1)} pts</b>
          </div>
        </div>

        {/* Tabela de Notas */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '16px' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '8px', width: '36px', textAlign: 'center' }}>#</th>
              <th style={{ padding: '8px 12px' }}>Nome do Aluno</th>
              <th style={{ padding: '8px', width: '90px', textAlign: 'center' }}>Nota (0 - {notaMaxima.toFixed(1)})</th>
              <th style={{ padding: '8px', width: '110px', textAlign: 'center' }}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaImprimir.map((aluno, index) => {
              const valStr = obterNotaValor(aluno.id, atividadeAtual.id);
              const num = Number(valStr.replace(',', '.'));
              const isPreenchida = valStr && valStr.trim() !== '';
              const isFalta = valStr.toLowerCase() === 'faltou';
              const mediaCorte = notaMaxima * 0.6; // 60% de aproveitamento

              return (
                <tr
                  key={aluno.id}
                  style={{
                    background: index % 2 === 0 ? '#fff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: '7px 12px', fontWeight: 700, color: '#0f172a' }}>
                    {aluno.nome}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 900, fontSize: '12px' }}>
                    {isFalta ? (
                      <span style={{ color: '#1d4ed8' }}>FALTOU</span>
                    ) : isPreenchida && !isNaN(num) ? (
                      <span style={{ color: num >= mediaCorte ? '#166534' : '#dc2626' }}>
                        {num.toFixed(1)}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', fontSize: '10.5px', fontWeight: 700 }}>
                    {isFalta ? (
                      <span style={{ color: '#1d4ed8' }}>Falta Justificada</span>
                    ) : isPreenchida && !isNaN(num) ? (
                      num >= mediaCorte ? (
                        <span style={{ color: '#166534' }}>Aprovado</span>
                      ) : (
                        <span style={{ color: '#dc2626' }}>Abaixo da Média</span>
                      )
                    ) : (
                      <span style={{ color: '#64748b' }}>Pendente</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Estatísticas no Rodapé */}
        {incluirEstatisticas && (
          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f1f5f9', padding: '10px 14px', borderRadius: '8px', fontSize: '11px', marginBottom: '16px', border: '1px solid #cbd5e1' }}>
            <div>Total de Alunos Listados: <b>{estatisticas.total}</b></div>
            <div>Notas Lançadas: <b>{estatisticas.validas}</b></div>
            <div>Média Geral: <b>{estatisticas.media}</b></div>
            <div>Maior Nota: <b>{estatisticas.maiorNota}</b></div>
            <div>Menor Nota: <b>{estatisticas.menorNota}</b></div>
            <div>Faltas: <b>{estatisticas.faltas}</b></div>
          </div>
        )}

        {/* Observações */}
        {observacoes && (
          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '20px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px' }}>
            <b>Observações:</b> {observacoes}
          </div>
        )}

        {/* Linha de Assinatura */}
        {incluirAssinatura && (
          <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-around', textAlign: 'center', fontSize: '11px', color: '#334155' }}>
            <div style={{ width: '220px' }}>
              <div style={{ borderTop: '1px solid #475569', paddingTop: '6px', fontWeight: 700 }}>
                PROFESSOR(A) RESPONSÁVEL
              </div>
            </div>
            <div style={{ width: '220px' }}>
              <div style={{ borderTop: '1px solid #475569', paddingTop: '6px', fontWeight: 700 }}>
                COORDENAÇÃO PEDAGÓGICA
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Estilos CSS Especiais para Impressão em PDF */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .export-pdf-modal-wrapper,
          .export-pdf-modal-wrapper * {
            visibility: visible;
          }
          .no-print {
            display: none !important;
          }
          .export-pdf-modal-wrapper {
            position: absolute !important;
            inset: 0 !important;
            background: #fff !important;
            padding: 0 !important;
            display: block !important;
          }
          #relatorio-notas-pdf {
            display: block !important;
            width: 100% !important;
            padding: 20px !important;
            background: #fff !important;
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ExportarPdfNotasModal;
