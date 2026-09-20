import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Aluno, Atividade, Turma } from '@/types';

interface SharedPlanilhaModalProps {
  atividade: Atividade;
  turma: Turma;
  alunos: Aluno[];
  obterNotaValor: (alunoId: string) => string;
  obterNotaMaxima: (tipo: string) => number;
  fecharModal: () => void;
  onSalvarLote: (notasMap: Record<string, number | null>) => Promise<void>;
  atividadeExpirada?: boolean;
}

const SharedPlanilhaModal: React.FC<SharedPlanilhaModalProps> = ({
  atividade,
  turma,
  alunos,
  obterNotaValor,
  obterNotaMaxima,
  fecharModal,
  onSalvarLote,
  atividadeExpirada = false,
}) => {
  const notaMaxima = useMemo(() => obterNotaMaxima(atividade.tipo), [atividade.tipo, obterNotaMaxima]);

  // Estado local das notas no formato { [alunoId]: "nota digitada" }
  const [notasLocais, setNotasLocais] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    alunos.forEach(a => {
      inicial[a.id] = obterNotaValor(a.id);
    });
    return inicial;
  });

  const [abaAtiva, setAbaAtiva] = useState<'grid' | 'colar' | 'arquivo'>('grid');
  const [textoColado, setTextoColado] = useState('');
  const [mensagemFeedback, setMensagemFeedback] = useState<{ tipo: 'ok' | 'err' | 'info'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Alunos ordenados alfabeticamente
  const alunosOrdenados = useMemo(() => {
    return [...alunos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos]);

  // Atualizar nota individual
  const handleNotaChange = (alunoId: string, valor: string) => {
    setNotasLocais(prev => ({
      ...prev,
      [alunoId]: valor
    }));
  };

  // Normalizar valor numérico
  const parseValor = (valStr: string): number | null => {
    if (!valStr || valStr.trim() === '' || valStr.trim() === '-') return null;
    const n = Number(valStr.trim().replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  // Validações
  const estatisticas = useMemo(() => {
    let preenchidos = 0;
    let vazios = 0;
    let invalidos = 0;

    alunosOrdenados.forEach(a => {
      const vStr = notasLocais[a.id];
      if (!vStr || vStr.trim() === '') {
        vazios++;
      } else {
        const num = parseValor(vStr);
        if (num === null || num < 0 || num > notaMaxima) {
          invalidos++;
        } else {
          preenchidos++;
        }
      }
    });

    return { preenchidos, vazios, invalidos, total: alunosOrdenados.length };
  }, [alunosOrdenados, notasLocais, notaMaxima]);

  // Suporte a colar (Paste) sequencial direto na tabela
  const handlePasteSequencial = (e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData || !pasteData.includes('\n') && !pasteData.includes('\t')) {
      return; // Colagem de texto simples em célula única, deixa comportamento padrão
    }

    e.preventDefault();
    const linhas = pasteData
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    setNotasLocais(prev => {
      const novo = { ...prev };
      linhas.forEach((linha, i) => {
        const alunoIdx = startIndex + i;
        if (alunoIdx < alunosOrdenados.length) {
          const targetAluno = alunosOrdenados[alunoIdx];
          // Se tiver colunas separadas por TAB, pega a última ou a coluna que parece nota
          const partes = linha.split('\t').map(p => p.trim());
          let valorEncontrado = partes[partes.length - 1];
          if (partes.length > 1) {
            const candidato = partes.find(p => !isNaN(Number(p.replace(',', '.'))) && p !== '');
            if (candidato) valorEncontrado = candidato;
          }
          novo[targetAluno.id] = valorEncontrado;
        }
      });
      return novo;
    });

    setMensagemFeedback({
      tipo: 'ok',
      texto: `${Math.min(linhas.length, alunosOrdenados.length - startIndex)} notas coladas a partir do aluno selecionado.`
    });
  };

  // Processar texto colado na aba Colar
  const processarTextoColado = () => {
    if (!textoColado.trim()) {
      setMensagemFeedback({ tipo: 'err', texto: 'Cole os dados da sua planilha antes de processar.' });
      return;
    }

    const linhas = textoColado
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (linhas.length === 0) {
      setMensagemFeedback({ tipo: 'err', texto: 'Nenhuma linha válida encontrada no texto colado.' });
      return;
    }

    const novoMap = { ...notasLocais };
    let atribuidos = 0;

    // Verificar se as linhas têm formato "Nome \t Nota" ou apenas "Nota"
    const temColunas = linhas.some(l => l.includes('\t') || l.includes(';') || l.includes(','));

    if (temColunas) {
      // Tentar match por nome ou por posição
      linhas.forEach((linha, idx) => {
        const partes = (linha.includes('\t') ? linha.split('\t') : linha.split(';')).map(p => p.trim());
        
        if (partes.length >= 2) {
          const nomePossivel = partes[0].toLowerCase();
          const notaPossivel = partes[1];

          // Buscar aluno correspondente pelo nome
          const alunoEncontrado = alunosOrdenados.find(a => 
            a.nome.toLowerCase() === nomePossivel || 
            a.nome.toLowerCase().includes(nomePossivel) ||
            nomePossivel.includes(a.nome.toLowerCase())
          );

          if (alunoEncontrado) {
            novoMap[alunoEncontrado.id] = notaPossivel;
            atribuidos++;
          } else if (idx < alunosOrdenados.length) {
            // Se não encontrou por nome, atribui por ordem sequencial
            novoMap[alunosOrdenados[idx].id] = notaPossivel;
            atribuidos++;
          }
        } else if (idx < alunosOrdenados.length) {
          novoMap[alunosOrdenados[idx].id] = partes[0];
          atribuidos++;
        }
      });
    } else {
      // Apenas coluna de notas sequenciais
      linhas.forEach((nota, idx) => {
        if (idx < alunosOrdenados.length) {
          novoMap[alunosOrdenados[idx].id] = nota;
          atribuidos++;
        }
      });
    }

    setNotasLocais(novoMap);
    setAbaAtiva('grid');
    setMensagemFeedback({
      tipo: 'ok',
      texto: `Sucesso! ${atribuidos} notas foram preenchidas na planilha. Revise os valores abaixo.`
    });
  };

  // Upload de arquivo Excel / CSV
  const handleUploadArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawJson || rawJson.length === 0) {
          setMensagemFeedback({ tipo: 'err', texto: 'A planilha selecionada está vazia.' });
          return;
        }

        // Tentar identificar cabeçalho ou começar na linha 0
        let linhaInicio = 0;
        const primeiraLinhaStr = rawJson[0]?.map((c: any) => String(c).toLowerCase()) || [];
        const temCabecalho = primeiraLinhaStr.some((c: string) => 
          c.includes('aluno') || c.includes('nome') || c.includes('nota') || c.includes('estudante')
        );

        if (temCabecalho) {
          linhaInicio = 1;
        }

        const novoMap = { ...notasLocais };
        let count = 0;

        for (let r = linhaInicio; r < rawJson.length; r++) {
          const row = rawJson[r];
          if (!row || row.length === 0) continue;

          // Se tem 2 ou mais colunas (ex: Coluna 0 = Nome, Coluna 1 = Nota)
          if (row.length >= 2) {
            const nomeStr = String(row[0] || '').trim().toLowerCase();
            const notaVal = String(row[1] ?? '').trim();

            const alunoMatch = alunosOrdenados.find(a => 
              a.nome.toLowerCase() === nomeStr ||
              a.nome.toLowerCase().includes(nomeStr) ||
              nomeStr.includes(a.nome.toLowerCase())
            );

            if (alunoMatch && notaVal !== '') {
              novoMap[alunoMatch.id] = notaVal;
              count++;
            } else {
              const idxSequencial = r - linhaInicio;
              if (idxSequencial < alunosOrdenados.length && notaVal !== '') {
                novoMap[alunosOrdenados[idxSequencial].id] = notaVal;
                count++;
              }
            }
          } else {
            // Apenas 1 coluna (notas sequenciais)
            const idxSequencial = r - linhaInicio;
            const notaVal = String(row[0] ?? '').trim();
            if (idxSequencial < alunosOrdenados.length && notaVal !== '') {
              novoMap[alunosOrdenados[idxSequencial].id] = notaVal;
              count++;
            }
          }
        }

        setNotasLocais(novoMap);
        setAbaAtiva('grid');
        setMensagemFeedback({
          tipo: 'ok',
          texto: `Arquivo "${file.name}" importado! ${count} notas identificadas e preenchidas na grade.`
        });
      } catch (err: any) {
        setMensagemFeedback({ tipo: 'err', texto: 'Erro ao processar planilha: ' + err.message });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Baixar modelo de planilha preenchido com a lista de alunos
  const baixarModeloExcel = () => {
    try {
      const dadosModelo = alunosOrdenados.map((aluno, index) => ({
        'Nº': index + 1,
        'Nome do Aluno': aluno.nome,
        [`Nota (0 a ${notaMaxima.toFixed(1)})`]: notasLocais[aluno.id] || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dadosModelo);

      // Ajustar larguras das colunas
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 38 },
        { wch: 20 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas');

      const nomeArquivo = `Notas_${turma.nome.replace(/\s+/g, '_')}_${atividade.nome.replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, nomeArquivo);

      setMensagemFeedback({
        tipo: 'info',
        texto: `Planilha modelo "${nomeArquivo}" gerada! Preencha as notas no Excel e depois importe de volta.`
      });
    } catch (err: any) {
      setMensagemFeedback({ tipo: 'err', texto: 'Erro ao gerar modelo Excel: ' + err.message });
    }
  };

  // Limpar todas as notas locais
  const handleLimparNotas = () => {
    if (window.confirm('Deseja limpar todos os valores de notas da planilha atual?')) {
      const limpo: Record<string, string> = {};
      alunosOrdenados.forEach(a => {
        limpo[a.id] = '';
      });
      setNotasLocais(limpo);
      setMensagemFeedback({ tipo: 'info', texto: 'Valores da planilha foram limpos.' });
    }
  };

  // Salvar no Firebase em lote
  const handleSalvarTodas = async () => {
    if (estatisticas.invalidos > 0) {
      alert(`Existem ${estatisticas.invalidos} nota(s) inválida(s) ou acima da nota máxima permitida (${notaMaxima.toFixed(1)}). Corrija antes de salvar.`);
      return;
    }

    setSalvando(true);
    try {
      const loteParaSalvar: Record<string, number | null> = {};
      alunosOrdenados.forEach(a => {
        const vStr = notasLocais[a.id];
        loteParaSalvar[a.id] = parseValor(vStr);
      });

      await onSalvarLote(loteParaSalvar);
      fecharModal();
    } catch (err: any) {
      alert('Ocorreu um erro ao salvar as notas: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          maxWidth: '860px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* Cabeçalho do Modal */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
            padding: '16px 20px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <i className="ti ti-table" style={{ fontSize: '20px' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>Planilha Simples de Lançamento de Notas</div>
              <div style={{ fontSize: '11.5px', opacity: 0.9, marginTop: '2px' }}>
                📖 {atividade.nome} • 🏫 {turma.nome} • 🎯 Máxima: <b>{notaMaxima.toFixed(1)}</b>
              </div>
            </div>
          </div>

          <button
            onClick={fecharModal}
            disabled={salvando}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Barra de Ferramentas / Abas */}
        <div
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          {/* Abas */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setAbaAtiva('grid')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: abaAtiva === 'grid' ? '#2563eb' : '#cbd5e1',
                background: abaAtiva === 'grid' ? '#2563eb' : '#fff',
                color: abaAtiva === 'grid' ? '#fff' : '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="ti ti-table"></i> Tabela / Planilha
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('colar')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: abaAtiva === 'colar' ? '#2563eb' : '#cbd5e1',
                background: abaAtiva === 'colar' ? '#2563eb' : '#fff',
                color: abaAtiva === 'colar' ? '#fff' : '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="ti ti-clipboard"></i> Colar do Excel
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva('arquivo')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: abaAtiva === 'arquivo' ? '#2563eb' : '#cbd5e1',
                background: abaAtiva === 'arquivo' ? '#2563eb' : '#fff',
                color: abaAtiva === 'arquivo' ? '#fff' : '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="ti ti-file-spreadsheet"></i> Upload (.xlsx/.csv)
            </button>
          </div>

          {/* Ações Auxiliares */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={baixarModeloExcel}
              title="Baixar planilha formatada com a lista de alunos da turma"
              style={{
                background: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="ti ti-download"></i> Baixar Modelo Excel
            </button>

            <button
              type="button"
              onClick={handleLimparNotas}
              title="Limpar notas digitadas nesta planilha"
              style={{
                background: '#fff',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <i className="ti ti-eraser"></i> Limpar
            </button>
          </div>
        </div>

        {/* Alerta de Feedback */}
        {mensagemFeedback && (
          <div
            style={{
              padding: '8px 20px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background:
                mensagemFeedback.tipo === 'ok'
                  ? '#f0fdf4'
                  : mensagemFeedback.tipo === 'err'
                  ? '#fef2f2'
                  : '#eff6ff',
              color:
                mensagemFeedback.tipo === 'ok'
                  ? '#166534'
                  : mensagemFeedback.tipo === 'err'
                  ? '#991b1b'
                  : '#1e40af',
              borderBottom: '1px solid rgba(0,0,0,0.06)'
            }}
          >
            <span>{mensagemFeedback.texto}</span>
            <button
              type="button"
              onClick={() => setMensagemFeedback(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Conteúdo Principal do Modal */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* ABA 1: GRID / PLANILHA RÁPIDA */}
          {abaAtiva === 'grid' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '11.5px',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="ti ti-info-circle" style={{ fontSize: '15px' }}></i>
                <span>
                  <b>Dica de agilidade:</b> Você pode copiar uma coluna de notas do seu Excel e colar (<b>Ctrl+V</b>) diretamente no primeiro campo abaixo para preencher os alunos em sequência! Pressione <b>Enter</b> para pular para a próxima linha.
                </span>
              </div>

              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  maxHeight: '48vh',
                  overflowY: 'auto'
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', fontWeight: 800, borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px', textAlign: 'center', width: '50px' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Nome do Aluno</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '160px' }}>
                        Nota (0 a {notaMaxima.toFixed(1)})
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '130px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alunosOrdenados.map((aluno, index) => {
                      const vStr = notasLocais[aluno.id] || '';
                      const num = parseValor(vStr);
                      const isVazio = vStr.trim() === '';
                      const isExcedido = num !== null && (num < 0 || num > notaMaxima);

                      return (
                        <tr
                          key={aluno.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: index % 2 === 0 ? '#fff' : '#fafafa'
                          }}
                        >
                          <td style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontWeight: 700, fontSize: '11px' }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>
                            {aluno.nome}
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                            <input
                              id={`planilha-input-nota-${index}`}
                              type="text"
                              value={vStr}
                              onChange={(e) => handleNotaChange(aluno.id, e.target.value)}
                              onPaste={(e) => handlePasteSequencial(e, index)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const prox = document.getElementById(`planilha-input-nota-${index + 1}`);
                                  if (prox) {
                                    (prox as HTMLInputElement).focus();
                                    (prox as HTMLInputElement).select();
                                  }
                                }
                              }}
                              placeholder="—"
                              style={{
                                width: '100px',
                                textAlign: 'center',
                                padding: '6px',
                                borderRadius: '8px',
                                border: '1.5px solid',
                                borderColor: isExcedido ? '#ef4444' : isVazio ? '#cbd5e1' : '#3b82f6',
                                background: isExcedido ? '#fef2f2' : isVazio ? '#fff' : '#f0fdf4',
                                color: isExcedido ? '#b91c1c' : '#1e293b',
                                fontWeight: 800,
                                fontSize: '13.5px',
                                outline: 'none'
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {isExcedido ? (
                              <span style={{ fontSize: '10.5px', background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                                ⚠️ Máx: {notaMaxima.toFixed(1)}
                              </span>
                            ) : !isVazio ? (
                              <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                                ✓ OK ({num?.toFixed(1)})
                              </span>
                            ) : (
                              <span style={{ fontSize: '10.5px', background: '#f1f5f9', color: '#94a3b8', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                Em branco
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 2: COLAR DO EXCEL */}
          {abaAtiva === 'colar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                📋 <b>Como usar a colagem rápida:</b>
                <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>Abra sua planilha (Excel ou Google Sheets).</li>
                  <li>Selecione a coluna com as notas dos alunos e tecle <b>Ctrl + C</b>.</li>
                  <li>Cole (<b>Ctrl + V</b>) na caixa abaixo e clique em <b>"Aplicar Notas na Planilha"</b>.</li>
                </ol>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  <i>Nota: Se você colar duas colunas (Nome e Nota), o sistema tentará associar pelo nome do aluno automaticamente!</i>
                </span>
              </div>

              <textarea
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
                placeholder={"Exemplo (apenas notas):\n5.5\n6.0\n4.0\n\nOu (Nome e Nota):\nAna Silva\t5.5\nBruno Santos\t6.0"}
                rows={10}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: 1.4,
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setTextoColado('')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#64748b',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Limpar Texto
                </button>
                <button
                  type="button"
                  onClick={processarTextoColado}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="ti ti-check"></i> Aplicar Notas na Planilha
                </button>
              </div>
            </div>
          )}

          {/* ABA 3: UPLOAD DE ARQUIVO */}
          {abaAtiva === 'arquivo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '20px 10px', textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <i className="ti ti-upload" style={{ fontSize: '32px' }}></i>
              </div>

              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>Importar Planilha do Computador</div>
                <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '440px', margin: '4px auto 0 auto', lineHeight: 1.4 }}>
                  Envie um arquivo <b>.xlsx</b>, <b>.xls</b> ou <b>.csv</b> contendo a lista com os nomes e as respectivas notas.
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleUploadArquivo}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                  }}
                >
                  <i className="ti ti-file-search"></i> Escolher Arquivo de Planilha
                </button>

                <button
                  type="button"
                  onClick={baixarModeloExcel}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1px solid #a7f3d0',
                    background: '#ecfdf5',
                    color: '#065f46',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="ti ti-download"></i> Baixar Modelo Pré-Preenchido
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé / Sumário e Botão Salvar */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Contadores */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b' }}>
              Total: <b>{estatisticas.total} alunos</b>
            </span>
            <span style={{ color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
              ✓ {estatisticas.preenchidos} preenchidas
            </span>
            <span style={{ color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              {estatisticas.vazios} pendentes
            </span>
            {estatisticas.invalidos > 0 && (
              <span style={{ color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                ⚠️ {estatisticas.invalidos} inválida(s)
              </span>
            )}
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={fecharModal}
              disabled={salvando}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSalvarTodas}
              disabled={salvando || atividadeExpirada || estatisticas.invalidos > 0}
              style={{
                padding: '8px 24px',
                borderRadius: '8px',
                border: 'none',
                background: (atividadeExpirada || estatisticas.invalidos > 0) ? '#94a3b8' : '#16a34a',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: (atividadeExpirada || estatisticas.invalidos > 0 || salvando) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.25)'
              }}
            >
              {salvando ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                  <span>Salvando no Firebase...</span>
                </>
              ) : (
                <>
                  <i className="ti ti-device-floppy"></i>
                  <span>Salvar Todas as Notas</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedPlanilhaModal;
