-- Populate accessible colors for wheel categories
-- Using WCAG-compliant colors that work well for color vision deficiencies

UPDATE public.wheel_categories SET color = '#10B981' WHERE key = 'health_fitness';      -- Emerald green
UPDATE public.wheel_categories SET color = '#3B82F6' WHERE key = 'career_business';     -- Blue
UPDATE public.wheel_categories SET color = '#F59E0B' WHERE key = 'finances';            -- Amber
UPDATE public.wheel_categories SET color = '#8B5CF6' WHERE key = 'relationships';       -- Purple
UPDATE public.wheel_categories SET color = '#EC4899' WHERE key = 'personal_growth';     -- Pink
UPDATE public.wheel_categories SET color = '#06B6D4' WHERE key = 'fun_recreation';      -- Cyan
UPDATE public.wheel_categories SET color = '#A855F7' WHERE key = 'physical_environment';-- Violet
UPDATE public.wheel_categories SET color = '#F97316' WHERE key = 'family_friends';      -- Orange
UPDATE public.wheel_categories SET color = '#EF4444' WHERE key = 'romance';             -- Red
UPDATE public.wheel_categories SET color = '#14B8A6' WHERE key = 'contribution';        -- Teal

-- Legacy categories
UPDATE public.wheel_categories SET color = '#F97316' WHERE key = 'family_home';         -- Orange
UPDATE public.wheel_categories SET color = '#3B82F6' WHERE key = 'financial_career';    -- Blue
UPDATE public.wheel_categories SET color = '#EC4899' WHERE key = 'mental_educational';  -- Pink
UPDATE public.wheel_categories SET color = '#14B8A6' WHERE key = 'spiritual_ethical';   -- Teal
UPDATE public.wheel_categories SET color = '#8B5CF6' WHERE key = 'social_cultural';     -- Purple
UPDATE public.wheel_categories SET color = '#10B981' WHERE key = 'physical_health';     -- Emerald