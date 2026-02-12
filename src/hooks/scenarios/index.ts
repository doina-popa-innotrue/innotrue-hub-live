// Re-export all scenario hooks from focused modules
export {
  useScenarioTemplates,
  useScenarioTemplate,
  useScenarioTemplateMutations,
  useScenarioSections,
  useScenarioSectionMutations,
  useSectionParagraphs,
  useSectionParagraphMutations,
  useQuestionLinkMutations,
} from "./useScenarioTemplates";

export {
  useScenarioAssignments,
  useScenarioAssignment,
  useScenarioAssignmentMutations,
  type CreateAssignmentData,
  type BulkAssignmentData,
} from "./useScenarioAssignments";

export {
  useParagraphResponses,
  useParagraphResponseMutations,
  useParagraphEvaluations,
  useParagraphEvaluationMutations,
  useParagraphQuestionScores,
  useParagraphQuestionScoreMutations,
  useScenarioScoreSummary,
} from "./useScenarioResponses";

export { useScenarioProgress } from "./useScenarioProgress";

export {
  useModuleScenarios,
  useScenariosForModule,
  useModuleScenarioMutations,
  type ModuleScenarioMutationData,
} from "./useModuleScenarios";
