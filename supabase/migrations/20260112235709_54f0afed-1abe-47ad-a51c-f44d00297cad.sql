-- Seed Architecture Self Knowledge Check Capability Assessment
DO $$
DECLARE
  v_assessment_id UUID;
  v_domain_id UUID;
BEGIN
  -- Create the assessment
  INSERT INTO public.capability_assessments (
    name,
    slug,
    description,
    instructions,
    rating_scale,
    is_active,
    is_public
  ) VALUES (
    'Architecture Self Knowledge Check',
    'architecture-self-knowledge-check',
    'This self-assessment helps you evaluate your architectural knowledge across core enterprise and Salesforce architecture domains.',
    'For each statement, rate yourself on a scale from 1 (limited exposure) to 5 (strong, hands-on mastery). Use the explanations to calibrate your rating consistently.',
    5,
    true,
    false
  ) RETURNING id INTO v_assessment_id;

  -- Domain 1: System Architecture
  INSERT INTO public.capability_domains (assessment_id, name, description, order_index)
  VALUES (v_assessment_id, 'System Architecture', 'Core platform architecture patterns and design principles', 1)
  RETURNING id INTO v_domain_id;

  INSERT INTO public.capability_domain_questions (domain_id, question_text, description, order_index) VALUES
  (v_domain_id, 'Org strategy: single-org vs multi-org (hub-and-spoke, global/regional)', 'Ability to assess organizational scale, autonomy needs, regulatory constraints, and operating models to recommend an appropriate org strategy, including understanding trade-offs in data ownership, integration complexity, cost, and governance.', 1),
  (v_domain_id, 'Hyperforce, data residency, and region strategy', 'Understanding of Hyperforce architecture, regional deployments, and data residency implications, including how these influence compliance, latency, disaster recovery, and long-term platform strategy.', 2),
  (v_domain_id, 'Platform scalability & performance patterns (LDV, concurrency, caching)', 'Ability to design for scale using Salesforce-specific performance patterns such as selective queries, LDV strategies, async processing, caching, and concurrency controls.', 3),
  (v_domain_id, 'Limits-aware design and governor limit mitigation', 'Understanding of Salesforce limits and ability to design solutions that proactively mitigate governor limits through architectural patterns rather than reactive fixes.', 4),
  (v_domain_id, 'Multi-cloud & cross-cloud solution patterns', 'Ability to design coherent solutions spanning multiple Salesforce clouds and platform services, understanding capability overlaps, integration boundaries, and licensing implications.', 5),
  (v_domain_id, 'Asynchronous processing patterns', 'Knowledge of asynchronous processing options and when to apply them based on volume, timing, error handling, and user experience requirements.', 6),
  (v_domain_id, 'Observability and telemetry', 'Understanding of monitoring, logging, and health assessment capabilities and how to use them to support operational excellence.', 7),
  (v_domain_id, 'Resiliency patterns', 'Ability to design fault-tolerant solutions using retries, idempotency, circuit breakers, and graceful degradation patterns.', 8),
  (v_domain_id, 'Cost/licensing trade-offs and capacity planning', 'Ability to balance architectural decisions with licensing models, consumption limits, and growth forecasts.', 9);

  -- Domain 2: Security & Identity Management
  INSERT INTO public.capability_domains (assessment_id, name, description, order_index)
  VALUES (v_assessment_id, 'Security & Identity Management', 'Security architecture, access control, and identity management patterns', 2)
  RETURNING id INTO v_domain_id;

  INSERT INTO public.capability_domain_questions (domain_id, question_text, description, order_index) VALUES
  (v_domain_id, 'Sharing model design', 'Ability to design secure and scalable record access models using declarative and programmatic mechanisms while balancing usability and performance.', 1),
  (v_domain_id, 'Profiles, Permission Sets, and Permission Set Groups strategy', 'Understanding of modern permission management strategies and how to design maintainable access models.', 2),
  (v_domain_id, 'Session, Login, and Transaction Security Policies', 'Knowledge of security policy controls and their impact on usability, compliance, and risk.', 3),
  (v_domain_id, 'OAuth 2.0 / OIDC flows', 'Ability to select and explain appropriate authentication flows for different integration and client scenarios.', 4),
  (v_domain_id, 'SSO for internal and external users', 'Understanding of SAML and social SSO patterns and how they apply to workforce and customer identities.', 5),
  (v_domain_id, 'Identity & Access Management patterns', 'Ability to design identity architectures using Salesforce as IdP or SP, including provisioning and lifecycle management.', 6),
  (v_domain_id, 'Shield capabilities', 'Understanding of advanced security, compliance, and auditing features and when they are required.', 7);

  -- Domain 3: Data Management & Architecture
  INSERT INTO public.capability_domains (assessment_id, name, description, order_index)
  VALUES (v_assessment_id, 'Data Management & Architecture', 'Data modeling, quality, lifecycle, and migration strategies', 3)
  RETURNING id INTO v_domain_id;

  INSERT INTO public.capability_domain_questions (domain_id, question_text, description, order_index) VALUES
  (v_domain_id, 'Conceptual, logical, and physical data modeling', 'Ability to translate business concepts into scalable Salesforce data models while respecting platform constraints.', 1),
  (v_domain_id, 'Account and Contact models', 'Understanding of standard and B2B/B2C account-contact relationship patterns.', 2),
  (v_domain_id, 'LDV strategies', 'Ability to manage large data volumes through selective access, archiving, and performance-aware design.', 3),
  (v_domain_id, 'Data quality & governance', 'Understanding of master data, deduplication strategies, and governance processes to ensure data reliability.', 4),
  (v_domain_id, 'Data lifecycle & retention', 'Ability to design data retention, archiving, and purge strategies aligned with compliance and performance needs.', 5),
  (v_domain_id, 'Data migration strategy', 'Knowledge of migration approaches, tooling, sequencing, and validation techniques.', 6),
  (v_domain_id, 'Backup & restore strategies', 'Understanding of data protection options and recovery scenarios.', 7);

  -- Domain 4: Integration Patterns, Capabilities & Strategies
  INSERT INTO public.capability_domains (assessment_id, name, description, order_index)
  VALUES (v_assessment_id, 'Integration Patterns, Capabilities & Strategies', 'API design, event-driven architecture, and integration governance', 4)
  RETURNING id INTO v_domain_id;

  INSERT INTO public.capability_domain_questions (domain_id, question_text, description, order_index) VALUES
  (v_domain_id, 'Pattern selection', 'Ability to select appropriate integration patterns based on consistency, latency, volume, and reliability needs.', 1),
  (v_domain_id, 'API portfolio', 'Understanding of Salesforce APIs and when to use each based on use case and scale.', 2),
  (v_domain_id, 'Event-driven integration', 'Ability to design near real-time integrations using event-based patterns.', 3),
  (v_domain_id, 'Middleware strategy and governance', 'Understanding of when middleware is required and how to govern integrations effectively.', 4),
  (v_domain_id, 'Error handling and reprocessing', 'Ability to design integrations that are resilient, observable, and recoverable.', 5),
  (v_domain_id, 'Integration performance & testing', 'Understanding of throughput limits, testing strategies, and performance tuning.', 6);

  -- Domain 5: Governance, Development Lifecycle & Deployment
  INSERT INTO public.capability_domains (assessment_id, name, description, order_index)
  VALUES (v_assessment_id, 'Governance, Development Lifecycle & Deployment', 'DevOps, CI/CD, environment management, and release practices', 5)
  RETURNING id INTO v_domain_id;

  INSERT INTO public.capability_domain_questions (domain_id, question_text, description, order_index) VALUES
  (v_domain_id, 'Environment strategy', 'Ability to design sandbox and environment strategies that support development, testing, and governance.', 1),
  (v_domain_id, 'Source-driven development', 'Understanding of version control, packaging, and deployment models.', 2),
  (v_domain_id, 'CI/CD pipelines', 'Ability to design automated pipelines with quality gates and validation.', 3),
  (v_domain_id, 'Release management & change control', 'Understanding of controlled release practices and rollback strategies.', 4),
  (v_domain_id, 'Monitoring post-deployment', 'Ability to define operational metrics and monitor production health.', 5);

  -- Domain 6: Solution Architecture
  INSERT INTO public.capability_domains (assessment_id, name, description, order_index)
  VALUES (v_assessment_id, 'Solution Architecture', 'Requirements analysis, documentation, and solution design practices', 6)
  RETURNING id INTO v_domain_id;

  INSERT INTO public.capability_domain_questions (domain_id, question_text, description, order_index) VALUES
  (v_domain_id, 'Requirements to capabilities mapping', 'Ability to translate business requirements into platform capabilities while managing trade-offs.', 1),
  (v_domain_id, 'Documentation & diagram standards', 'Ability to communicate architecture clearly using standard diagrams and documentation.', 2),
  (v_domain_id, 'Scalability & performance NFRs', 'Understanding of non-functional requirements and how to design for them.', 3),
  (v_domain_id, 'Operational readiness', 'Ability to design solutions with support, monitoring, and ownership in mind.', 4),
  (v_domain_id, 'Technical debt management', 'Understanding of how to identify, prioritize, and reduce technical debt over time.', 5);

  -- Domain 7: Communication
  INSERT INTO public.capability_domains (assessment_id, name, description, order_index)
  VALUES (v_assessment_id, 'Communication', 'Presentation skills, stakeholder management, and architectural communication', 7)
  RETURNING id INTO v_domain_id;

  INSERT INTO public.capability_domain_questions (domain_id, question_text, description, order_index) VALUES
  (v_domain_id, 'Storyline structure for architectural reviews', 'Ability to structure architectural narratives clearly, establishing context, constraints, assumptions, options considered, and a well-supported recommendation.', 1),
  (v_domain_id, 'Time-boxed whiteboarding and slide craft', 'Ability to communicate ideas visually within time constraints using whiteboards and well-designed slides.', 2),
  (v_domain_id, 'Stakeholder analysis and persona-driven messaging', 'Understanding of stakeholder perspectives and ability to tailor messages based on audience priorities, concerns, and decision authority.', 3),
  (v_domain_id, 'Defending trade-offs under pressure', 'Ability to explain and defend architectural trade-offs calmly, including responding to unexpected questions without becoming defensive or overly detailed.', 4),
  (v_domain_id, 'Executive summaries and risk logs', 'Ability to distill complex architectures into concise executive summaries and maintain clear, actionable risk and mitigation logs.', 5),
  (v_domain_id, 'Clear architectural artifacts', 'Ability to produce clear, consistent diagrams such as ERDs, sequence diagrams, integration flows, and deployment views that support decision-making.', 6),
  (v_domain_id, 'Estimation and delivery roadmap', 'Ability to estimate effort, identify dependencies, and communicate phased delivery roadmaps with realistic assumptions.', 7),
  (v_domain_id, 'Live Q&A techniques', 'Ability to listen actively, restate questions for clarity, reframe when needed, and provide structured, concise answers.', 8),
  (v_domain_id, 'Practice cadence and feedback loops', 'Ability to use regular practice, peer review, and feedback loops to continuously improve communication effectiveness.', 9),
  (v_domain_id, 'Presence, clarity, and concise narration', 'Demonstrated ability to communicate with confidence, clarity, and appropriate pacing, avoiding unnecessary complexity or verbosity.', 10);

END $$;