export interface Escola {
  id: string;
  nome: string;
}

export interface Turma {
  id: string;
  escolaId: string;
  nome: string;
  serie: string;
}

export interface Aluno {
  id: string;
  nome: string;
  turmaId: string;
  nascimento?: string;
  ativo?: boolean;
  observacoes?: string;
}

export interface Materia {
  id: string;
  escolaId: string;
  nome: string;
}

export interface Professor {
  id: string;
  nome: string;
  materias: string[]; // IDs de matérias
}

export interface Bimestre {
  id: string;
  nome: string;
  peso: number;
}

export interface Atividade {
  id: string;
  nome: string;
  tipo: 'prova' | 'trabalho' | 'qualitativa';
  turmaId: string;
  materiaId: string;
  bimestreId: string;
  peso: number;
}

export interface Capitulo {
  id: string;
  turmaId: string;
  materiaId: string;
  nome: string;
  descricao?: string;
}

export interface Aula {
  id: string;
  data: string; // YYYY-MM-DD
  horario: string;
  turmaId: string;
  materiaId: string;
  tipo: 'teorica' | 'pratica' | 'revisao' | 'avaliacao' | 'pedagogica' | 'outra';
  capituloId?: string;
  realizada: boolean;
}

export interface SdCapitulo {
  capituloId: string;
  exercicios: string[]; // IDs de exercícios do EXERCICIOS_GERADOS_IA
}

export interface SequenciaDidatica {
  id: string;
  professorId: string;
  turmaId: string;
  materiaId: string;
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
  capitulos: SdCapitulo[];
}

export interface Nota {
  alunoId: string;
  atividadeId: string;
  turmaId: string;
  materiaId: string;
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
