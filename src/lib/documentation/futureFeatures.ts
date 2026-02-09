/**
 * Future Feature Planning Documentation
 * This file captures planned features for future implementation.
 */

export const futureFeatures = {
  aiStudyAssistant: {
    status: 'planned',
    priority: 'medium',
    summary: 'AI-powered study support for client learning',
    
    description: `
      Enable AI support for client studies (e.g., learning OAuth flows with Salesforce).
      Can be part of a program or general development.
      Users can make notes and tasks from conversations.
    `,
    
    keyDecisions: {
      conversationStorage: 'Session-only (not persisted) - keeps data clean',
      noteCreation: 'Save insight action → creates note linked to module/program',
      taskCreation: 'Create task action → pre-filled task with AI context',
      resourceSuggestions: 'AI suggests from existing resource library based on topic',
      contextAwareness: 'Pass current module/program info to AI for relevant responses',
    },
    
    v1Scope: [
      'Floating "Study Assistant" chat accessible from modules/programs',
      'Quick actions: Save Note, Create Task',
      'Resource suggestions from existing library',
      'No conversation history (session only)',
    ],
    
    v2Considerations: [
      'Voice input',
      'Document/resource upload for discussion',
      'Shared study sessions (coach visibility)',
    ],
    
    technicalNotes: {
      aiProvider: 'Google Vertex AI (Gemini)',
      complexity: 'Medium (~2-3 days focused work)',
      integrations: ['Tasks system', 'Notes system', 'Resource library', 'Module context'],
    },
    
    rationale: `
      Users are already doing this externally (consolidation value).
      Contextual advantage - AI knows their program/module.
      Clean data approach - only valuable insights saved, not chat noise.
      Differentiator for the platform.
    `,
  },
};
