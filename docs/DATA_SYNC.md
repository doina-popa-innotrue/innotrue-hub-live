# InnoTrue Hub — Production to Preprod Data Sync

> Export configuration data from production Supabase and sync it to preprod.
> Run these queries in the **production** SQL Editor, then share the results
> with Claude Code to generate the sync SQL for preprod.

---

## Table of Contents

1. [How This Works](#how-this-works)
2. [Quick Sync — Most Common Tables](#quick-sync--most-common-tables)
3. [Full Export Queries](#full-export-queries)
4. [Sync Procedure](#sync-procedure)

---

## How This Works

1. **You** make configuration changes in **production** admin UI
2. **You** run the relevant export query below in production SQL Editor
3. **You** paste the JSON output to Claude Code
4. **Claude Code** generates idempotent INSERT/UPDATE SQL for preprod + updates `seed.sql`
5. **You** run the generated SQL in **preprod** SQL Editor

All export queries output JSON so the data is easy to copy-paste.

---

## Quick Sync — Most Common Tables

### Programs & Modules (most frequently edited)

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT p.id, p.slug, p.name, p.description, p.category, p.is_active,
         p.credit_cost, p.min_plan_tier, p.created_at,
         (SELECT json_agg(row_to_json(m) ORDER BY m.order_index)
          FROM program_modules m WHERE m.program_id = p.id
         ) AS modules
  FROM programs p
  WHERE p.is_active = true
  ORDER BY p.name
) t;
```

### Capability Assessments (with domains & questions)

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT ca.id, ca.name, ca.slug, ca.description, ca.instructions,
         ca.instructions_self, ca.instructions_evaluator,
         ca.assessment_mode, ca.rating_scale, ca.is_active, ca.is_public,
         ca.feature_key, ca.pass_fail_enabled, ca.pass_fail_mode,
         ca.pass_fail_threshold, ca.allow_instructor_eval,
         ac.name AS category_name,
         af.slug AS family_slug,
         (SELECT json_agg(row_to_json(d) ORDER BY d.order_index) FROM (
            SELECT cd.id, cd.name, cd.description, cd.order_index,
                   (SELECT json_agg(row_to_json(q) ORDER BY q.order_index)
                    FROM capability_domain_questions q WHERE q.domain_id = cd.id
                   ) AS questions
            FROM capability_domains cd WHERE cd.assessment_id = ca.id
         ) d) AS domains
  FROM capability_assessments ca
  LEFT JOIN assessment_categories ac ON ac.id = ca.category_id
  LEFT JOIN assessment_families af ON af.id = ca.family_id
  WHERE ca.is_active = true
  ORDER BY ca.name
) t;
```

### Plans & Plan-Feature Mappings

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT p.id, p.key, p.name, p.tier_level, p.is_free, p.credit_allowance,
         p.is_purchasable, p.description,
         (SELECT json_agg(json_build_object(
            'feature_key', f.key,
            'enabled', pf.enabled,
            'limit_value', pf.limit_value
          ))
          FROM plan_features pf
          JOIN features f ON f.id = pf.feature_id
          WHERE pf.plan_id = p.id
         ) AS features
  FROM plans p
  ORDER BY p.tier_level
) t;
```

### Features (all, with system flag)

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT f.id, f.key, f.name, f.description, f.is_consumable,
         f.is_system, f.is_active,
         fc.name AS category_name
  FROM features f
  LEFT JOIN feature_categories fc ON fc.id = f.category_id
  ORDER BY f.key
) t;
```

---

## Full Export Queries

### Platform Settings

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT key, value, description FROM system_settings ORDER BY key
) t;
```

### Platform Terms

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT id, title, content_html, version, is_current,
         is_blocking_on_update, effective_from
  FROM platform_terms
  WHERE is_current = true
) t;
```

### Session Types & Roles

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT st.id, st.name, st.description, st.default_duration,
         st.feature_key, st.is_active,
         (SELECT json_agg(json_build_object(
            'role_name', str.role_name,
            'description', str.description,
            'is_required', str.is_required
          ))
          FROM session_type_roles str WHERE str.session_type_id = st.id
         ) AS roles
  FROM session_types st
  ORDER BY st.name
) t;
```

### Credit Services & Packages

```sql
-- Credit services
SELECT json_agg(row_to_json(t)) FROM (
  SELECT id, name, description, credit_cost, category,
         feature_key, is_active, is_org_service
  FROM credit_services ORDER BY category, name
) t;

-- Individual top-up packages
SELECT json_agg(row_to_json(t)) FROM (
  SELECT id, slug, name, description, credits, price_cents,
         currency, is_active, display_order
  FROM credit_topup_packages ORDER BY display_order
) t;

-- Org credit packages
SELECT json_agg(row_to_json(t)) FROM (
  SELECT id, slug, name, description, credits, price_cents,
         currency, is_active, display_order
  FROM org_credit_packages ORDER BY display_order
) t;

-- Org platform tiers
SELECT json_agg(row_to_json(t)) FROM (
  SELECT id, slug, name, description, monthly_price_cents,
         included_credits, is_active
  FROM org_platform_tiers ORDER BY slug
) t;
```

### Tracks & Track Features

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT tr.id, tr.key, tr.name, tr.description, tr.display_order,
         (SELECT json_agg(json_build_object(
            'feature_key', f.key,
            'enabled', tf.enabled,
            'limit_value', tf.limit_value
          ))
          FROM track_features tf
          JOIN features f ON f.id = tf.feature_id
          WHERE tf.track_id = tr.id
         ) AS features
  FROM tracks tr
  ORDER BY tr.display_order
) t;
```

### Add-ons & Add-on Features

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT ao.id, ao.name, ao.description, ao.price_cents,
         ao.billing_interval, ao.is_active,
         (SELECT json_agg(json_build_object(
            'feature_key', f.key,
            'enabled', aof.enabled,
            'limit_value', aof.limit_value
          ))
          FROM add_on_features aof
          JOIN features f ON f.id = aof.feature_id
          WHERE aof.add_on_id = ao.id
         ) AS features
  FROM add_ons ao
  ORDER BY ao.name
) t;
```

### Program Plans & Program Plan Features

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT pp.id, pp.name, pp.description, pp.tier_level,
         pp.is_active, pp.credit_allowance, pp.display_name,
         (SELECT json_agg(json_build_object(
            'feature_key', f.key,
            'enabled', ppf.enabled,
            'limit_value', ppf.limit_value
          ))
          FROM program_plan_features ppf
          JOIN features f ON f.id = ppf.feature_id
          WHERE ppf.program_plan_id = pp.id
         ) AS features
  FROM program_plans pp
  ORDER BY pp.tier_level
) t;
```

### Notification Categories & Types

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT nc.id, nc.key, nc.name, nc.description, nc.icon, nc.order_index,
         (SELECT json_agg(row_to_json(nt) ORDER BY nt.order_index)
          FROM notification_types nt WHERE nt.category_id = nc.id
         ) AS types
  FROM notification_categories nc
  ORDER BY nc.order_index
) t;
```

### Email Templates

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT template_key, name, subject, html_body, text_body,
         description, is_active
  FROM email_templates
  ORDER BY template_key
) t;
```

### Wheel of Life Categories

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT key, name, description, color, icon, order_index, is_active
  FROM wheel_categories
  ORDER BY order_index
) t;
```

### Assessment Categories & Families

```sql
-- Categories
SELECT json_agg(row_to_json(t)) FROM (
  SELECT name, description, order_index, is_active
  FROM assessment_categories ORDER BY order_index
) t;

-- Families
SELECT json_agg(row_to_json(t)) FROM (
  SELECT slug, name, description, is_active
  FROM assessment_families ORDER BY name
) t;
```

### Psychometric Assessments (catalog)

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT name, category, description, provider, url, cost,
         feature_key, is_active,
         ac.name AS category_name
  FROM psychometric_assessments pa
  LEFT JOIN assessment_categories ac ON ac.id = pa.category_id
  ORDER BY name
) t;
```

### Guided Path Templates

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT gf.slug, gf.name, gf.description, gf.is_active,
         (SELECT json_agg(row_to_json(gt) ORDER BY gt.created_at) FROM (
            SELECT gt.id, gt.name, gt.description, gt.category, gt.is_active,
                   (SELECT json_agg(row_to_json(gg) ORDER BY gg.order_index) FROM (
                      SELECT gg.title, gg.description, gg.order_index,
                             (SELECT json_agg(row_to_json(gm) ORDER BY gm.order_index)
                              FROM guided_path_template_milestones gm WHERE gm.goal_id = gg.id
                             ) AS milestones
                      FROM guided_path_template_goals gg WHERE gg.template_id = gt.id
                   ) gg) AS goals
            FROM guided_path_templates gt WHERE gt.family_id = gf.id
         ) gt) AS templates
  FROM guided_path_template_families gf
  ORDER BY gf.name
) t;
```

### Scenario Templates

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT st.id, st.name, st.description, st.is_active,
         sc.name AS category_name,
         ca.slug AS assessment_slug,
         (SELECT json_agg(row_to_json(ss) ORDER BY ss.order_index)
          FROM scenario_sections ss WHERE ss.template_id = st.id
         ) AS sections
  FROM scenario_templates st
  LEFT JOIN scenario_categories sc ON sc.id = st.category_id
  LEFT JOIN capability_assessments ca ON ca.id = st.capability_assessment_id
  ORDER BY st.name
) t;
```

### Skills & Skill Categories

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT s.name, s.description, sc.key AS category_key
  FROM skills s
  LEFT JOIN skill_categories sc ON sc.id = s.category_id
  ORDER BY s.name
) t;

-- Skill categories
SELECT json_agg(row_to_json(t)) FROM (
  SELECT key, name, description, display_order
  FROM skill_categories ORDER BY display_order
) t;
```

### Resource Library

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT canonical_id, title, description, type, url,
         is_active, is_public,
         rc.name AS category_name
  FROM resource_library rl
  LEFT JOIN resource_categories rc ON rc.id = rl.category_id
  ORDER BY rl.title
) t;
```

### Status Markers

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT name, display_order FROM status_markers ORDER BY display_order
) t;
```

### Feature Categories

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT name, description, display_order FROM feature_categories ORDER BY display_order
) t;
```

### Module Types

```sql
SELECT json_agg(row_to_json(t)) FROM (
  SELECT name, description FROM module_types ORDER BY name
) t;
```

---

## Sync Procedure

### First-time full sync

1. Run **all** the export queries above on production
2. Share the results with Claude Code: "Here's the production data export. Generate sync SQL for preprod and update seed.sql."
3. Run the generated SQL on preprod
4. Commit the updated `seed.sql` and any new migration files

### Incremental sync (after making changes in prod)

1. Run only the relevant export query (e.g., just "Programs & Modules" if you only changed programs)
2. Share with Claude Code: "I updated the CTA Immersion program modules. Here's the current state from production."
3. Run the generated sync SQL on preprod
4. Commit updates

### What NOT to sync

Never sync these between environments:
- User accounts (`auth.users`, `profiles`, `user_roles`)
- User-generated content (enrollments, progress, decisions, goals, snapshots, etc.)
- Credit balances and transactions
- Notification preferences
- Session bookings
- OAuth tokens and consent records
- Audit logs
