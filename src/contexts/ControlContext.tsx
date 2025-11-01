import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface ControlSettings {
  allowEdit: boolean;
  allowDelete: boolean;
  allowAddNew: boolean;
  allowExport: boolean;
  showFinancialTotals: boolean;
  allowBulkOperations: boolean;
  allowAddPayment: boolean;
  allowPaymentManager: boolean;
  allowRecordPayment: boolean;
  allowBillManagement: boolean;
  allowMahajanDeletion: boolean;
}

interface ControlContextType {
  settings: ControlSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const ControlContext = createContext<ControlContextType | undefined>(undefined);

export const ControlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ControlSettings>({
    allowEdit: true,
    allowDelete: true,
    allowAddNew: true,
    allowExport: true,
    showFinancialTotals: true,
    allowBulkOperations: true,
    allowAddPayment: true,
    allowPaymentManager: true,
    allowRecordPayment: true,
    allowBillManagement: true,
    allowMahajanDeletion: true,
  });
  const [loading, setLoading] = useState(false);

  const fetchControlSettings = async () => {
    if (!user) {
      setSettings({
        allowEdit: true,
        allowDelete: true,
        allowAddNew: true,
        allowExport: true,
        showFinancialTotals: true,
        allowBulkOperations: true,
        allowAddPayment: true,
        allowPaymentManager: true,
        allowRecordPayment: true,
        allowBillManagement: true,
        allowMahajanDeletion: true,
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')


        .select('control_settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        if (error.code === '42703') {
          // Column doesn't exist - use defaults
          console.log('control_settings column not found, using defaults');
          setSettings({
            allowEdit: true,
            allowDelete: true,
            allowAddNew: true,
            allowExport: true,
            showFinancialTotals: true,
            allowBulkOperations: true,
            allowAddPayment: true,
            allowPaymentManager: true,
            allowRecordPayment: true,
            allowBillManagement: true,
            allowMahajanDeletion: true,
          });
        } else {
          throw error;
        }
      } else if (data && 'control_settings' in data) {
        // Merge database settings with defaults to ensure all fields are present
        const defaultSettings = {
          allowEdit: true,
          allowDelete: true,
          allowAddNew: true,
          allowExport: true,
          showFinancialTotals: true,
          allowBulkOperations: true,
          allowAddPayment: true,
          allowPaymentManager: true,
          allowRecordPayment: true,
          allowBillManagement: true,
          allowMahajanDeletion: true,
        };
        const dbSettings = (data as any).control_settings;
        setSettings({
          ...defaultSettings,
          ...dbSettings
        });
      } else {
        // No data found - use defaults
        setSettings({
          allowEdit: true,
          allowDelete: true,
          allowAddNew: true,
          allowExport: true,
          showFinancialTotals: true,
          allowBulkOperations: true,
          allowAddPayment: true,
          allowPaymentManager: true,
          allowRecordPayment: true,
          allowBillManagement: true,
          allowMahajanDeletion: true,
        });
      }
      
    } catch (error) {
      console.error('Unexpected error fetching control settings:', error);
      setSettings({
        allowEdit: true,
        allowDelete: true,
        allowAddNew: true,
        allowExport: true,
        showFinancialTotals: true,
        allowBulkOperations: true,
        allowAddPayment: true,
        allowPaymentManager: true,
        allowRecordPayment: true,
        allowBillManagement: true,
        allowMahajanDeletion: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    await fetchControlSettings();
  };

  useEffect(() => {
    fetchControlSettings();
  }, [user]);

  return (
    <ControlContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </ControlContext.Provider>
  );
};

export const useControl = (): ControlContextType => {
  const context = useContext(ControlContext);
  if (context === undefined) {
    throw new Error('useControl must be used within a ControlProvider');
  }
  return context;
};
