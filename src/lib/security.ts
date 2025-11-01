import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * Security utilities for ensuring data isolation
 */

export const SecurityUtils = {
  /**
   * Ensure user is authenticated before database operations
   */
  ensureAuthenticated: (user: User | null): void => {
    if (!user) {
      throw new Error('User must be authenticated to perform this operation');
    }
  },

  /**
   * Create a secure query builder that automatically includes user_id filter
   */
  createSecureQuery: (user: User | null) => {
    SecurityUtils.ensureAuthenticated(user);
    
    return {
      customers: () => supabase.from('customers').select('*').eq('user_id', user!.id),
      loans: () => supabase.from('loans').select('*').eq('user_id', user!.id),
      expenses: () => supabase.from('expenses').select('*').eq('user_id', user!.id),
      expenseCategories: () => supabase.from('expense_categories').select('*').eq('user_id', user!.id),
      loanTransactions: () => supabase
        .from('loan_transactions')
        .select(`
          *,
          loan:loans!inner(user_id)
        `)
        .eq('loan.user_id', user!.id),
    };
  },

  /**
   * Validate that a customer belongs to the authenticated user
   */
  validateCustomerOwnership: async (user: User, customerId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('user_id', user.id)
      .single();

    return !error && !!data;
  },

  /**
   * Validate that a loan belongs to the authenticated user
   */
  validateLoanOwnership: async (user: User, loanId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('loans')
      .select('id')
      .eq('id', loanId)
      .eq('user_id', user.id)
      .single();

    return !error && !!data;
  },

  /**
   * Validate that an expense belongs to the authenticated user
   */
  validateExpenseOwnership: async (user: User, expenseId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('expenses')
      .select('id')
      .eq('id', expenseId)
      .eq('user_id', user.id)
      .single();

    return !error && !!data;
  },

  /**
   * Get user's data with automatic filtering
   */
  getUserData: async (user: User) => {
    const secureQuery = SecurityUtils.createSecureQuery(user);
    
    const [customers, loans, expenses, expenseCategories] = await Promise.all([
      secureQuery.customers().select('*'),
      secureQuery.loans().select('*'),
      secureQuery.expenses().select('*'),
      secureQuery.expenseCategories().select('*'),
    ]);

    return {
      customers: customers.data || [],
      loans: loans.data || [],
      expenses: expenses.data || [],
      expenseCategories: expenseCategories.data || [],
    };
  },

  /**
   * Log security events (for monitoring)
   */
  logSecurityEvent: (event: string, userId: string, details?: any) => {
    console.log(`[SECURITY] ${event} - User: ${userId}`, details);
    // In production, you might want to send this to a logging service
  },
};

/**
 * Higher-order function to wrap database operations with security checks
 */
export const withSecurity = <T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  user: User | null
) => {
  return async (...args: T): Promise<R> => {
    SecurityUtils.ensureAuthenticated(user);
    SecurityUtils.logSecurityEvent('Database Operation', user!.id, { args });
    return operation(...args);
  };
};

/**
 * Custom hook for secure database operations
 */
export const useSecureDatabase = (user: User | null) => {
  if (!user) {
    throw new Error('User must be authenticated to use secure database operations');
  }

  return {
    // Secure customer operations
    getCustomers: () => SecurityUtils.createSecureQuery(user).customers(),
    createCustomer: (data: any) => supabase.from('customers').insert({
      ...data,
      user_id: user.id,
    }),
    
    // Secure loan operations
    getLoans: () => SecurityUtils.createSecureQuery(user).loans(),
    createLoan: (data: any) => supabase.from('loans').insert({
      ...data,
      user_id: user.id,
    }),
    
    // Secure expense operations
    getExpenses: () => SecurityUtils.createSecureQuery(user).expenses(),
    createExpense: (data: any) => supabase.from('expenses').insert({
      ...data,
      user_id: user.id,
    }),
    
    // Secure transaction operations
    getLoanTransactions: () => SecurityUtils.createSecureQuery(user).loanTransactions(),
    createLoanTransaction: (data: any) => supabase.from('loan_transactions').insert(data),
  };
};
