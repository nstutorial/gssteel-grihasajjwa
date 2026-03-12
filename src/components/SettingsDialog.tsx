import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsUpdate: (settings: TabSettings) => void;
}

export interface TabSettings {
  loans: boolean;
  customers: boolean;
  daywise: boolean;
  payments: boolean;
  home_route?: string;
}

const HOME_ROUTE_OPTIONS = [
  { value: '/firm-accounts', label: 'Firm Accounts' },
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/reminders', label: 'Loan Reminders' },
  { value: '/bill-reminders', label: 'Bill Reminders' },
  { value: '/bill-customers', label: 'Bill Customers' },
  { value: '/partners', label: 'Partners' },
  { value: '/cheques', label: 'Cheques' },
  { value: '/tasks', label: 'Tasks' },
];

const SettingsDialog = ({ open, onOpenChange, onSettingsUpdate }: SettingsDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<TabSettings>({
    loans: true,
    customers: true,
    daywise: true,
    payments: true,
    home_route: '/firm-accounts',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchSettings();
    }
  }, [open, user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('visible_tabs')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load settings',
          variant: 'destructive',
        });
        return;
      }

      if (data) {
        const fetchedSettings = data.visible_tabs as unknown as TabSettings;
        const mergedSettings = {
          loans: fetchedSettings.loans ?? true,
          customers: fetchedSettings.customers ?? true,
          daywise: fetchedSettings.daywise ?? true,
          payments: fetchedSettings.payments ?? true,
          home_route: fetchedSettings.home_route ?? '/firm-accounts',
        };
        setSettings(mergedSettings);
        onSettingsUpdate(mergedSettings);
      } else {
        // If no settings exist, use defaults and create them
        const defaultSettings: TabSettings = {
          loans: true,
          customers: true,
          daywise: true,
          payments: true,
          home_route: '/firm-accounts',
        };
        
        setSettings(defaultSettings);
        onSettingsUpdate(defaultSettings);
        
        // Create default settings in database
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: defaultSettings as unknown as Json,
          });
          
        if (insertError) {
          console.error('Error creating default settings:', insertError);
        }
      }
    } catch (error) {
      console.error('Unexpected error fetching settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (key: keyof TabSettings) => {
    if (!user || isUpdating) return;

    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    setIsUpdating(true);

    await saveSettings(newSettings);
  };

  const handleHomeRouteChange = async (value: string) => {
    if (!user || isUpdating) return;

    const newSettings = { ...settings, home_route: value };
    setSettings(newSettings);
    setIsUpdating(true);

    await saveSettings(newSettings);
  };

  const saveSettings = async (newSettings: TabSettings) => {
    try {
      console.log('Updating settings for user:', user?.id);
      console.log('New settings:', newSettings);
      
      // First, try to update existing record
      const { data: existingData, error: fetchError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching existing settings:', fetchError);
        throw fetchError;
      }

      console.log('Existing data:', existingData);

      let error;
      if (existingData) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            visible_tabs: newSettings as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user!.id);
        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user!.id,
            visible_tabs: newSettings as unknown as Json,
          });
        error = insertError;
      }

      if (error) {
        console.error('Settings update error:', error);
        // Revert the local state on error
        setSettings(settings);
        toast({
          title: 'Error',
          description: `Failed to update settings: ${error.message}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Settings updated',
        });
        onSettingsUpdate(newSettings);
      }
    } catch (error) {
      console.error('Unexpected error updating settings:', error);
      // Revert the local state on error
      setSettings(settings);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while updating settings',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const tabKeys: (keyof Omit<TabSettings, 'home_route'>)[] = ['loans', 'customers', 'daywise', 'payments'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your app preferences
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Home Route Setting */}
          <div className="space-y-2">
            <Label>Home Page</Label>
            <Select
              value={settings.home_route || '/firm-accounts'}
              onValueChange={handleHomeRouteChange}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select home page" />
              </SelectTrigger>
              <SelectContent>
                {HOME_ROUTE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tab Visibility Settings */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Dashboard Tab Visibility</Label>
            <div className="space-y-3 pt-2">
              {tabKeys.map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key} className="capitalize font-normal">
                    {key}
                  </Label>
                  <Switch
                    id={key}
                    checked={settings[key]}
                    disabled={isUpdating}
                    onCheckedChange={() => handleToggle(key)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
