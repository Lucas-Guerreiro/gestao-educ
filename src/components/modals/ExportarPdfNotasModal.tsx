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
  const [incluirSituacao, setIncluirSituacao] = useState(true);
  const [incluirEstatisticas, setIncluirEstatisticas] = useState(true);
  const [incluirAssinatura, setIncluirAssinatura] = useState(true);
  const [observacoes, setObservacoes] = useState('');

  const [buscaAluno, setBuscaAluno] = useState('');

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

  // Alunos filtrados pela busca
  const alunosFiltrados = useMemo(() => {
    if (!buscaAluno.trim()) return alunosOrdenados;
    const termo = buscaAluno.toLowerCase().trim();
    return alunosOrdenados.filter(a => a.nome.toLowerCase().includes(termo));
  }, [alunosOrdenados, buscaAluno]);

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
  }, [alunosParaImprimir, obterNotaValor, atividadeAtual.id]);

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
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
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
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '820px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* Header do Modal */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '16px 22px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(220, 38, 38, 0.35)'
              }}
            >
              <i className="ti ti-file-text" style={{ fontSize: '20px' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                Exportar Notas em Arquivo PDF
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>
                {turmaNome} &bull; {materiaNome} &bull; {bimestreNome}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#cbd5e1',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            ✕
          </button>
        </div>

        {/* Corpo do Modal com Seções Organizadas */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#f8fafc'
          }}
        >
          {/* Card 1: Informações e Título do Documento */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '14px 16px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: todasAtividades && todasAtividades.length > 1 ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr', gap: '12px' }}>
              {/* Seletor de Atividade */}
              {todasAtividades && todasAtividades.length > 1 && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Atividade do Relatório
                  </label>
                  <select
                    value={atividadeSelecionadaId}
                    onChange={(e) => {
                      setAtividadeSelecionadaId(e.target.value);
                      const ativObj = todasAtividades.find(a => a.id === e.target.value);
                      if (ativObj) setTituloRelatorio(`Relatório de Notas - ${ativObj.nome}`);
                    }}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      width: '100%',
                      height: '36px',
                      background: '#fff',
                      color: '#0f172a',
                      fontWeight: 600
                    }}
                  >
                    {todasAtividades.map(a => (
                      <option key={a.id} value={a.id}>{a.nome} ({a.tipo.toUpperCase()} - Peso {a.peso})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Título do Relatório */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Título do Relatório
                </label>
                <input
                  type="text"
                  value={tituloRelatorio}
                  onChange={(e) => setTituloRelatorio(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    width: '100%',
                    height: '36px',
                    color: '#0f172a',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            {/* Observações no Rodapé */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Observações no Rodapé (Opcional)
              </label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Alunos com notas pendentes devem procurar o professor até a data final do bimestre."
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  width: '100%',
                  height: '34px',
                  color: '#334155'
                }}
              />
            </div>
          </div>

          {/* Card 2: Opções de Impressão (Checkboxes com tamanho padronizado 16px) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px'
            }}
          >
            {/* Opção 1: Coluna de Situação */}
            <div
              onClick={() => setIncluirSituacao(!incluirSituacao)}
              style={{
                background: incluirSituacao ? '#eff6ff' : '#ffffff',
                border: incluirSituacao ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="checkbox"
                checked={incluirSituacao}
                onChange={(e) => setIncluirSituacao(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '16px',
                  height: '16px',
                  minWidth: '16px',
                  minHeight: '16px',
                  margin: 0,
                  padding: 0,
                  flexShrink: 0,
                  cursor: 'pointer',
                  accentColor: '#2563eb'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b' }}>
                  Coluna de Situação
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Aprovado / Abaixo da média
                </div>
              </div>
            </div>

            {/* Opção 2: Estatísticas */}
            <div
              onClick={() => setIncluirEstatisticas(!incluirEstatisticas)}
              style={{
                background: incluirEstatisticas ? '#eff6ff' : '#ffffff',
                border: incluirEstatisticas ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="checkbox"
                checked={incluirEstatisticas}
                onChange={(e) => setIncluirEstatisticas(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '16px',
                  height: '16px',
                  minWidth: '16px',
                  minHeight: '16px',
                  margin: 0,
                  padding: 0,
                  flexShrink: 0,
                  cursor: 'pointer',
                  accentColor: '#2563eb'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b' }}>
                  Estatísticas da Turma
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Média geral, maior e menor nota
                </div>
              </div>
            </div>

            {/* Opção 3: Linha de Assinatura */}
            <div
              onClick={() => setIncluirAssinatura(!incluirAssinatura)}
              style={{
                background: incluirAssinatura ? '#eff6ff' : '#ffffff',
                border: incluirAssinatura ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="checkbox"
                checked={incluirAssinatura}
                onChange={(e) => setIncluirAssinatura(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '16px',
                  height: '16px',
                  minWidth: '16px',
                  minHeight: '16px',
                  margin: 0,
                  padding: 0,
                  flexShrink: 0,
                  cursor: 'pointer',
                  accentColor: '#2563eb'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b' }}>
                  Campo de Assinatura
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Linhas para docente e coordenação
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Seleção de Alunos com Busca e Lista Alinhada */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Barra de Ações da Lista */}
            <div
              style={{
                padding: '10px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  Alunos no Relatório
                </span>
                <span
                  style={{
                    background: '#e0e7ff',
                    color: '#3730a3',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}
                >
                  {selectedAlunoIds.length} de {alunosOrdenados.length} selecionados
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Input de Busca Rápida */}
                <div style={{ position: 'relative', width: '180px' }}>
                  <input
                    type="text"
                    value={buscaAluno}
                    onChange={(e) => setBuscaAluno(e.target.value)}
                    placeholder="Filtrar aluno..."
                    style={{
                      width: '100%',
                      height: '30px',
                      padding: '4px 10px 4px 26px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '11.5px',
                      background: '#fff'
                    }}
                  />
                  <i
                    className="ti ti-search"
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      fontSize: '13px',
                      pointerEvents: 'none'
                    }}
                  ></i>
                </div>

                {/* Botão Selecionar / Desmarcar Todos */}
                <button
                  type="button"
                  onClick={toggleSelecionarTodos}
                  style={{
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    color: '#2563eb',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {selectedAlunoIds.length === alunosOrdenados.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>
            </div>

            {/* Lista com Rolagem e Linhas Bem Espaçadas */}
            <div
              style={{
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '4px 0'
              }}
            >
              {alunosFiltrados.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  Nenhum aluno encontrado para "{buscaAluno}"
                </div>
              ) : (
                alunosFiltrados.map((aluno, index) => {
                  const notaVal = obterNotaValor(aluno.id, atividadeAtual.id);
                  const isSelected = selectedAlunoIds.includes(aluno.id);
                  const isFalta = notaVal.toLowerCase() === 'faltou';
                  const num = Number(notaVal.replace(',', '.'));
                  const temNota = notaVal.trim() !== '';

                  return (
                    <div
                      key={aluno.id}
                      onClick={() => toggleAluno(aluno.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 14px',
                        background: isSelected ? '#f8fafc' : 'transparent',
                        borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Checkbox e Nome */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{
                            width: '16px',
                            height: '16px',
                            minWidth: '16px',
                            minHeight: '16px',
                            margin: 0,
                            padding: 0,
                            flexShrink: 0,
                            cursor: 'pointer',
                            accentColor: '#2563eb'
                          }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: '11px', width: '22px', fontWeight: 600 }}>
                          #{String(index + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0f172a' : '#64748b', fontSize: '13px' }}>
                          {aluno.nome}
                        </span>
                      </div>

                      {/* Badge da Nota */}
                      <div>
                        {isFalta ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            FALTOU
                          </span>
                        ) : temNota && !isNaN(num) ? (
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 800,
                              padding: '2px 9px',
                              borderRadius: '6px',
                              background: num >= (notaMaxima * 0.6) ? '#ecfdf5' : '#fef2f2',
                              color: num >= (notaMaxima * 0.6) ? '#059669' : '#dc2626',
                              border: `1px solid ${num >= (notaMaxima * 0.6) ? '#a7f3d0' : '#fecaca'}`
                            }}
                          >
                            Nota: {num.toFixed(1)}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#94a3b8'
                            }}
                          >
                            Sem nota
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Rodapé do Modal com Resumo e Ações */}
        <div
          style={{
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Resumo Rápido */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto' }}>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#475569',
                background: '#f1f5f9',
                padding: '4px 10px',
                borderRadius: '6px'
              }}
            >
              📄 <b>{selectedAlunoIds.length}</b> de <b>{alunosOrdenados.length}</b> alunos
            </span>
            {selectedAlunoIds.length > 0 && (
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#0369a1',
                  background: '#e0f2fe',
                  padding: '4px 10px',
                  borderRadius: '6px'
                }}
              >
                Média: <b>{estatisticas.media}</b>
              </span>
            )}
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '8px', flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
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
                padding: '8px 22px',
                borderRadius: '8px',
                border: 'none',
                background: selectedAlunoIds.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: selectedAlunoIds.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: selectedAlunoIds.length === 0 ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.35)',
                transition: 'all 0.15s ease'
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
              <th style={{ padding: '8px', width: incluirSituacao ? '90px' : '130px', textAlign: 'center' }}>
                Nota (0 - {notaMaxima.toFixed(1)})
              </th>
              {incluirSituacao && (
                <th style={{ padding: '8px', width: '110px', textAlign: 'center' }}>Situação</th>
              )}
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
                  {incluirSituacao && (
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
                  )}
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
