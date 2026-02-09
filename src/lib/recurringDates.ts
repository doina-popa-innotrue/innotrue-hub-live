import { addDays, addWeeks, addMonths, isAfter } from 'date-fns';

export type RecurrencePattern = 'daily' | 'weekly' | 'bi-weekly' | 'monthly';

export interface RecurrenceConfig {
  startDate: Date;
  pattern: RecurrencePattern | string;
  endType?: 'count' | 'date';
  count?: number;
  endDate?: string | null;
  maxLimit: number;
}

/**
 * Get the next date based on the recurrence pattern
 */
export function getNextRecurringDate(date: Date, pattern: string): Date {
  switch (pattern.toLowerCase()) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly':
      return addWeeks(date, 1);
    case 'bi-weekly':
      return addWeeks(date, 2);
    case 'monthly':
      return addMonths(date, 1);
    default:
      return addWeeks(date, 1);
  }
}

/**
 * Generate an array of recurring dates based on the configuration.
 * Does NOT include the start date (master session) - only generates child dates.
 * 
 * @param config - The recurrence configuration
 * @returns Array of Date objects for each recurring instance
 */
export function generateRecurringDates(config: RecurrenceConfig): Date[] {
  const { startDate, pattern, endType = 'count', count = 4, endDate, maxLimit } = config;
  
  const dates: Date[] = [];
  let currentDate = startDate;
  
  // Max 6 months ahead as a safety limit
  const maxEndDate = addMonths(startDate, 6);
  
  // Determine effective end date based on configuration
  const effectiveEndDate = endDate ? new Date(endDate) : maxEndDate;
  const effectiveMax = endType === 'count' ? Math.min(count, maxLimit) : maxLimit;

  // Generate instances (not including the first one which is the master)
  while (dates.length < effectiveMax - 1) {
    currentDate = getNextRecurringDate(currentDate, pattern);
    
    // Check against end date or 6-month limit
    if (isAfter(currentDate, effectiveEndDate) || isAfter(currentDate, maxEndDate)) {
      break;
    }
    
    dates.push(new Date(currentDate));
  }

  return dates;
}

/**
 * Simple version for group sessions that use end date instead of count
 */
export function generateRecurringDatesSimple(
  startDate: Date,
  pattern: string,
  endDate: string | null,
  maxLimit: number
): Date[] {
  return generateRecurringDates({
    startDate,
    pattern,
    endType: 'date',
    endDate,
    maxLimit,
  });
}
