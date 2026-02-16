// ============================================================================
// Scenario-Based Assessment Types
// ============================================================================

export interface ScenarioTemplate {
  id: string;
  title: string;
  description: string | null;
  capability_assessment_id: string | null;
  category_id: string | null;
  is_protected: boolean;
  is_active: boolean;
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  capability_assessments?: {
    id: string;
    name: string;
    slug: string;
    rating_scale: number;
  } | null;
  scenario_categories?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  sections_count?: number;
}

export interface ScenarioSection {
  id: string;
  template_id: string;
  title: string;
  instructions: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  // Nested data
  paragraphs?: SectionParagraph[];
}

export interface SectionParagraph {
  id: string;
  section_id: string;
  content: string;
  order_index: number;
  requires_response: boolean;
  created_at: string;
  updated_at: string;
  // Nested data
  question_links?: ParagraphQuestionLink[];
}

export interface ParagraphQuestionLink {
  id: string;
  paragraph_id: string;
  question_id: string;
  weight: number;
  rubric_text?: string | null;
  created_at: string;
  // Joined data
  capability_domain_questions?: {
    id: string;
    question_text: string;
    description: string | null;
    domain_id: string;
    capability_domains?: {
      id: string;
      name: string;
    };
  };
}

export type ScenarioAssignmentStatus = "draft" | "submitted" | "in_review" | "evaluated";

export interface ScenarioAssignment {
  id: string;
  template_id: string;
  user_id: string;
  assigned_by: string | null;
  enrollment_id: string | null;
  module_id: string | null;
  status: ScenarioAssignmentStatus;
  assigned_at: string;
  submitted_at: string | null;
  evaluated_at: string | null;
  evaluated_by: string | null;
  overall_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  scenario_templates?: ScenarioTemplate;
  profiles?: {
    id: string;
    name: string;
    email: string;
  };
  assigned_by_profile?: {
    id: string;
    name: string;
  };
  evaluated_by_profile?: {
    id: string;
    name: string;
  };
  scenario_categories?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  program_modules?: {
    id: string;
    title: string;
  };
  client_enrollments?: {
    id: string;
    program_id: string;
    programs?: {
      id: string;
      name: string;
    };
  };
}

// Module-Scenario linking
export interface ModuleScenario {
  id: string;
  module_id: string;
  template_id: string;
  is_required_for_certification: boolean;
  order_index: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  // Joined data
  scenario_templates?: ScenarioTemplate;
  program_modules?: {
    id: string;
    title: string;
    program_id: string;
  };
}

export interface ParagraphResponse {
  id: string;
  assignment_id: string;
  paragraph_id: string;
  response_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParagraphEvaluation {
  id: string;
  assignment_id: string;
  paragraph_id: string;
  evaluator_id: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParagraphQuestionScore {
  id: string;
  assignment_id: string;
  paragraph_id: string;
  question_id: string;
  score: number;
  evaluator_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  capability_domain_questions?: {
    id: string;
    question_text: string;
    domain_id: string;
    capability_domains?: {
      id: string;
      name: string;
    };
  };
}

// ============================================================================
// Form Data Types
// ============================================================================

export interface ScenarioTemplateFormData {
  title: string;
  description: string;
  capability_assessment_id: string;
  category_id: string;
  is_protected: boolean;
  is_active: boolean;
}

export interface ScenarioCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScenarioSectionFormData {
  title: string;
  instructions: string;
  order_index: number;
}

export interface SectionParagraphFormData {
  content: string;
  order_index: number;
  requires_response: boolean;
}

export interface ScenarioAssignmentFormData {
  template_id: string;
  user_id: string;
  enrollment_id?: string;
  module_id?: string;
}

export interface ModuleScenarioFormData {
  module_id: string;
  template_id: string;
  is_required_for_certification: boolean;
  notes?: string;
}

// ============================================================================
// Aggregated Score Types
// ============================================================================

export interface DomainScoreAggregate {
  domain_id: string;
  domain_name: string;
  total_score: number;
  max_possible_score: number;
  percentage: number;
  question_count: number;
}

export interface ScenarioScoreSummary {
  assignment_id: string;
  overall_percentage: number;
  domain_scores: DomainScoreAggregate[];
  total_paragraphs: number;
  paragraphs_evaluated: number;
}
