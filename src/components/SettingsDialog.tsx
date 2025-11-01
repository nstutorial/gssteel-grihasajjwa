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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
}

const SettingsDialog = ({ open, onOpenChange, onSettingsUpdate }: SettingsDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<TabSettings>({
    loans: true,
    customers: true,
    daywise: true,
    payments: true,
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
        const settings = data.visible_tabs as unknown as TabSettings;
        setSettings(settings);
        onSettingsUpdate(settings);
      } else {
        // If no settings exist, use defaults and create them
        const defaultSettings = {
          loans: true,
          customers: true,
          daywise: true,
          payments: true,
        };
        
        setSettings(defaultSettings);
        onSettingsUpdate(defaultSettings);
        
        // Create default settings in database
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: defaultSettings,
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

    try {
      console.log('Updating settings for user:', user.id);
      console.log('New settings:', newSettings);
      
      // First, try to update existing record
      const { data: existingData, error: fetchError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
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
            visible_tabs: newSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        error = updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: newSettings,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tab Visibility Settings</DialogTitle>
          <DialogDescription>
            Control which tabs are visible in the dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key} className="capitalize">
                {key}
              </Label>
              <Switch
                id={key}
                checked={value}
                disabled={isUpdating}
                onCheckedChange={() => handleToggle(key as keyof TabSettings)}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
