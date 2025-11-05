-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.bill_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  email text,
  gst_number text,
  outstanding_amount numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bill_customers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bill_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['principal'::text, 'interest'::text, 'mixed'::text])),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode USER-DEFINED NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bill_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT bill_transactions_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id)
);
CREATE TABLE public.bills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mahajan_id uuid NOT NULL,
  bill_number text,
  bill_amount numeric NOT NULL,
  interest_rate numeric DEFAULT 0,
  interest_type text DEFAULT 'none'::text CHECK (interest_type = ANY (ARRAY['daily'::text, 'monthly'::text, 'none'::text])),
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bills_pkey PRIMARY KEY (id),
  CONSTRAINT bills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT bills_mahajan_id_fkey FOREIGN KEY (mahajan_id) REFERENCES public.mahajans(id)
);
CREATE TABLE public.custom_transaction_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT custom_transaction_types_pkey PRIMARY KEY (id),
  CONSTRAINT custom_transaction_types_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  daily_amount numeric,
  outstanding_amount numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_day text,
  locked boolean DEFAULT false,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense'::text CHECK (type = ANY (ARRAY['expense'::text, 'income'::text])),
  description text,
  color text DEFAULT '#3B82F6'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_pkey PRIMARY KEY (id),
  CONSTRAINT expense_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid,
  amount numeric NOT NULL,
  description text NOT NULL,
  payment_method USER-DEFINED NOT NULL,
  type text NOT NULL DEFAULT 'expense'::text CHECK (type = ANY (ARRAY['expense'::text, 'earning'::text])),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id)
);
CREATE TABLE public.firm_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type = ANY (ARRAY['cash'::text, 'bank'::text])),
  opening_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  account_number text,
  bank_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT firm_accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.firm_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  firm_account_id uuid NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['partner_deposit'::text, 'partner_withdrawal'::text, 'expense'::text, 'income'::text, 'adjustment'::text, 'refund'::text])),
  amount numeric NOT NULL,
  partner_id uuid,
  description text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  mahajan_id uuid,
  transaction_sub_type text,
  CONSTRAINT firm_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT firm_transactions_firm_account_id_fkey FOREIGN KEY (firm_account_id) REFERENCES public.firm_accounts(id),
  CONSTRAINT firm_transactions_mahajan_id_fkey FOREIGN KEY (mahajan_id) REFERENCES public.mahajans(id)
);
CREATE TABLE public.loan_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['principal'::text, 'interest'::text, 'mixed'::text])),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_mode text DEFAULT 'cash'::text CHECK (payment_mode = ANY (ARRAY['cash'::text, 'bank'::text])),
  is_confirmed boolean DEFAULT false,
  confirmed_at timestamp with time zone,
  confirmed_by uuid,
  CONSTRAINT loan_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT loan_transactions_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id),
  CONSTRAINT loan_transactions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.loans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  principal_amount numeric NOT NULL,
  interest_rate numeric DEFAULT 0,
  interest_type text DEFAULT 'none'::text CHECK (interest_type = ANY (ARRAY['daily'::text, 'monthly'::text, 'none'::text])),
  loan_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  loan_number text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  emi_amount numeric,
  emi_frequency text DEFAULT 'monthly'::text CHECK (emi_frequency = ANY (ARRAY['weekly'::text, 'monthly'::text])),
  processing_fee numeric DEFAULT 0,
  total_outstanding numeric DEFAULT 0,
  locked boolean DEFAULT false,
  CONSTRAINT loans_pkey PRIMARY KEY (id),
  CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT loans_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.mahajans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  payment_day text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  advance_payment numeric NOT NULL DEFAULT 0,
  CONSTRAINT mahajans_pkey PRIMARY KEY (id),
  CONSTRAINT mahajans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.partner_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  mahajan_id uuid,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text NOT NULL DEFAULT 'cash'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT partner_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT partner_transactions_mahajan_id_fkey FOREIGN KEY (mahajan_id) REFERENCES public.mahajans(id),
  CONSTRAINT partner_transactions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id)
);
CREATE TABLE public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  total_invested numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT partners_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_role text DEFAULT 'employee'::text CHECK (user_role = ANY (ARRAY['admin'::text, 'employee'::text])),
  email text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.sale_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL,
  payment_mode USER-DEFINED NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sale_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT sale_transactions_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id)
);
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bill_customer_id uuid NOT NULL,
  sale_number text,
  sale_amount numeric NOT NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  interest_rate numeric DEFAULT 0,
  interest_type text DEFAULT 'none'::text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_bill_customer_id_fkey FOREIGN KEY (bill_customer_id) REFERENCES public.bill_customers(id)
);
CREATE TABLE public.settings_access_password (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  password_hash text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT settings_access_password_pkey PRIMARY KEY (id),
  CONSTRAINT settings_access_password_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  visible_tabs jsonb NOT NULL DEFAULT '{"loans": true, "daywise": true, "mahajans": true, "payments": true, "customers": true}'::jsonb,
  control_settings jsonb DEFAULT '{"allowEdit": true, "allowAddNew": true, "allowDelete": true, "allowExport": true, "allowBulkOperations": true, "showFinancialTotals": true}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_settings_pkey PRIMARY KEY (id)
);
