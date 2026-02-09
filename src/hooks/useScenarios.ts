// Re-export all scenario hooks from focused modules
// This file maintains backward compatibility for existing imports

export {
  useScenarioTemplates,
  useScenarioTemplate,
  useScenarioTemplateMutations,
  useScenarioSections,
  useScenarioSectionMutations,
  useSectionParagraphs,
  useSectionParagraphMutations,
  useQuestionLinkMutations,
  useScenarioAssignments,
  useScenarioAssignment,
  useScenarioAssignmentMutations,
  useParagraphResponses,
  useParagraphResponseMutations,
  useParagraphEvaluations,
  useParagraphEvaluationMutations,
  useParagraphQuestionScores,
  useParagraphQuestionScoreMutations,
  useScenarioScoreSummary,
  useScenarioProgress,
  useModuleScenarios,
  useScenariosForModule,
  useModuleScenarioMutations,
} from './scenarios';

export type {
  CreateAssignmentData,
  BulkAssignmentData,
  ModuleScenarioMutationData,
} from './scenarios';
