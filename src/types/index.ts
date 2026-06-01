/**
 * @entity Escola
 * @description Representa uma unidade escolar cadastrada no ERP.
 */
export interface Escola {
  /** @pk Chave Primária Única (UUID) */
  id: string;
  nome: string;
}

/**
 * @entity Turma
 * @description Representa um agrupamento de alunos de um ano/série específico em uma escola.
 */
export interface Turma {
  /** @pk Chave Primária Única */
  id: string;
  /** @fk Chave Estrangeira -> Escola.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  escolaId: string;
  nome: string;
  serie: string;
}

/**
 * @entity Aluno
 * @description Aluno matriculado em uma turma específica.
 */
export interface Aluno {
  /** @pk Chave Primária Única */
  id: string;
  nome: string;
  /** @fk Chave Estrangeira -> Turma.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  turmaId: string;
  nascimento?: string;
  ativo?: boolean;
  observacoes?: string;
}

/**
 * @entity Materia
 * @description Disciplina/Matéria ofertada pela escola.
 */
export interface Materia {
  /** @pk Chave Primária Única */
  id: string;
  /** @fk Chave Estrangeira -> Escola.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  escolaId: string;
  nome: string;
}

/**
 * @entity Professor
 * @description Docente cadastrado responsável por lecionar matérias.
 */
export interface Professor {
  /** @pk Chave Primária Única */
  id: string;
  nome: string;
  /** 
   * @fk Array de Chaves Estrangeiras -> Materia.id
   * @cardinality N:M (Representação física simplificada por array no NoSQL)
   * @cascade ON DELETE CASCADE (Remove o ID da matéria deletada do array)
   */
  materias: string[]; // IDs de matérias
}

/**
 * @entity Bimestre
 * @description Período letivo letramento e pesos avaliativos.
 */
export interface Bimestre {
  /** @pk Chave Primária Única */
  id: string;
  nome: string;
  peso: number;
  /** @fk Chave Estrangeira conceitual (Ano Letivo) | @cardinality N:1 */
  ano: number;
}

/**
 * @entity Atividade
 * @description Atividade, prova ou qualitativa planejada para uma turma, matéria e bimestre.
 */
export interface Atividade {
  /** @pk Chave Primária Única */
  id: string;
  nome: string;
  tipo: 'prova' | 'trabalho' | 'qualitativa' | 'pluraal';
  /** @fk Chave Estrangeira -> Turma.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  turmaId: string;
  /** @fk Chave Estrangeira -> Materia.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  materiaId: string;
  /** @fk Chave Estrangeira -> Bimestre.id | @cardinality N:1 | @cascade ON DELETE RESTRICT */
  bimestreId: string;
  peso: number;
  descricao?: string;
  dataLimite?: string; // YYYY-MM-DD
  liberadoVencido?: boolean;
}

/**
 * @entity Capitulo
 * @description Eixo temático curricular pertencente a uma matéria em uma turma.
 */
export interface Capitulo {
  /** @pk Chave Primária Única */
  id: string;
  /** @fk Chave Estrangeira -> Turma.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  turmaId: string;
  /** @fk Chave Estrangeira -> Materia.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  materiaId: string;
  nome: string;
  descricao?: string;
}

/**
 * @entity Aula
 * @description Registro de aula ministrada ou planejada.
 */
export interface Aula {
  /** @pk Chave Primária Única */
  id: string;
  data: string; // YYYY-MM-DD
  horario: string;
  /** @fk Chave Estrangeira -> Turma.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  turmaId: string;
  /** @fk Chave Estrangeira -> Materia.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  materiaId: string;
  tipo: 'teorica' | 'pratica' | 'revisao' | 'avaliacao' | 'pedagogica' | 'outra';
  /** @fk Chave Estrangeira -> Capitulo.id | @cardinality N:1 (Opcional) | @cascade ON DELETE SET NULL */
  capituloId?: string;
  realizada: boolean;
}

/**
 * @entity SdCapitulo
 * @description Entidade embutida pivot que vincula capítulos e exercícios IA dentro da Sequência Didática.
 */
export interface SdCapitulo {
  /** @fk Chave Estrangeira -> Capitulo.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  capituloId: string;
  exercicios: string[]; // IDs de exercícios do EXERCICIOS_GERADOS_IA
}

/**
 * @entity SequenciaDidatica
 * @description Planejamento pedagógico sequencial elaborado por um professor para uma turma e matéria.
 */
export interface SequenciaDidatica {
  /** @pk Chave Primária Única */
  id: string;
  /** @fk Chave Estrangeira -> Professor.id | @cardinality N:1 | @cascade ON DELETE RESTRICT */
  professorId: string;
  /** @fk Chave Estrangeira -> Turma.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  turmaId: string;
  /** @fk Chave Estrangeira -> Materia.id | @cardinality N:1 | @cascade ON DELETE CASCADE */
  materiaId: string;
  /** @fk Chave Estrangeira -> Bimestre.id (Opcional, mapeada como bimestre de texto na interface) | @cascade ON DELETE SET NULL */
  bimestre?: string;
  cargaHoraria?: number;
  periodo?: string;
  nivelEnsino?: 'ef1' | 'ef2' | 'em';
  objetivo?: string;
  habilidades?: string;
  metodologias?: string[];
  metodologiasOutras?: string;
  recursos?: string[];
  recursosOutros?: string;
  nee?: string;
  avaliacao?: string;
  autorregulacao?: string;
  observacoes?: string;
  /** @relation Composição embutida contendo referências a Capítulos */
  capitulos: SdCapitulo[];
}

/**
 * @entity Nota
 * @description Lançamento de nota de um aluno para uma atividade específica.
 * @note Em um modelo puramente relacional 3NF, os campos turmaId, materiaId e bimestreId 
 * seriam excluídos por redundância (pois Atividade já os possui). Mantidos aqui para compatibilidade
 * de dados da API legada e integridade da interface reativa.
 */
export interface Nota {
  /** @pk Chave Primária Composta (alunoId + atividadeId) | @fk -> Aluno.id | @cascade ON DELETE CASCADE */
  alunoId: string;
  /** @pk Chave Primária Composta (alunoId + atividadeId) | @fk -> Atividade.id | @cascade ON DELETE CASCADE */
  atividadeId: string;
  /** @fk Chave Estrangeira Redundante -> Turma.id | @cascade ON DELETE CASCADE */
  turmaId: string;
  /** @fk Chave Estrangeira Redundante -> Materia.id | @cascade ON DELETE CASCADE */
  materiaId: string;
  /** @fk Chave Estrangeira Redundante -> Bimestre.id | @cascade ON DELETE RESTRICT */
  bimestreId: string;
  nota: number;
}

export interface AdminConfig {
  senha?: string;
}

export interface ExerciciosIA {
  id: string;
  nome: string;
  desc: string;
}

/**
 * @entity Apontamento
 * @description Registro diário de acompanhamento de alunos (tarefa, material, comportamento).
 */
export interface Apontamento {
  /** @pk Chave Primária Única (determinística: alunoId_materiaId_data) */
  id: string;
  /** @fk Chave Estrangeira -> Aluno.id | @cascade ON DELETE CASCADE */
  alunoId: string;
  /** @fk Chave Estrangeira -> Turma.id | @cascade ON DELETE CASCADE */
  turmaId: string;
  /** @fk Chave Estrangeira -> Materia.id | @cascade ON DELETE CASCADE */
  materiaId: string;
  /** @fk Chave Estrangeira -> Bimestre.id | @cascade ON DELETE CASCADE */
  bimestreId: string;
  data: string; // YYYY-MM-DD
  tarefa: 'sim' | 'nao' | 'parcial' | '';
  material: 'sim' | 'nao' | 'parcial' | '';
  comportamento: 'excelente' | 'bom' | 'regular' | 'indisciplinado' | '';
  observacao: string;
}
