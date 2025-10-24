import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Settings as SettingsIcon, Mail, Edit3, Shield, Lock, BarChart3 } from 'lucide-react';
import { useControl } from '@/contexts/ControlContext';

export interface TabSettings {
  loans: boolean;
  customers: boolean;
  mahajans: boolean;
  bill_customers: boolean;
  daywise: boolean;
  payments: boolean;
}

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
  allowEmailChange: boolean;
  allowBillManagement: boolean;
  allowMahajanDeletion: boolean;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshSettings } = useControl();
  const [settings, setSettings] = useState<TabSettings>({
    loans: true,
    customers: true,
    mahajans: true,
    bill_customers: true,
    daywise: true,
    payments: true,
  });
  const [controlSettings, setControlSettings] = useState<ControlSettings>({
    allowEdit: true,
    allowDelete: true,
    allowAddNew: true,
    allowExport: true,
    showFinancialTotals: true,
    allowBulkOperations: true,
    allowAddPayment: true,
    allowPaymentManager: true,
    allowRecordPayment: true,
    allowEmailChange: true,
    allowBillManagement: true,
    allowMahajanDeletion: true,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailChangeMethod, setEmailChangeMethod] = useState<'confirmation' | 'direct'>('direct');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(true);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [userRole, setUserRole] = useState<string>('employee');

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchUserRole();
      // Check if password was already verified in this session
      const sessionPasswordVerified = sessionStorage.getItem('settingsPasswordVerified');
      if (sessionPasswordVerified === 'true') {
        setIsPasswordVerified(true);
        setPasswordPromptOpen(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Check if user is admin and bypass password verification
  useEffect(() => {
    console.log('=== SETTINGS ACCESS LOGIC ===');
    console.log('User role:', userRole);
    console.log('User:', user?.email);
    
    if (userRole === 'admin') {
      console.log('✅ ADMIN: Direct access granted');
      setIsPasswordVerified(true);
      setPasswordPromptOpen(false);
    } else if (userRole === 'employee') {
      console.log('🔒 EMPLOYEE: Checking password verification');
      const sessionPasswordVerified = sessionStorage.getItem('settingsPasswordVerified');
      if (sessionPasswordVerified === 'true') {
        console.log('✅ Password already verified in session');
        setIsPasswordVerified(true);
        setPasswordPromptOpen(false);
      } else {
        console.log('❌ Password required');
        setIsPasswordVerified(false);
        setPasswordPromptOpen(true);
      }
    } else {
      console.log('❓ Unknown role:', userRole);
      // Default to employee behavior
      setIsPasswordVerified(false);
      setPasswordPromptOpen(true);
    }
  }, [userRole]);

  // Cleanup effect to clear password verification when navigating away
  useEffect(() => {
    return () => {
      // Clear password verification when component unmounts (navigating away)
      sessionStorage.removeItem('settingsPasswordVerified');
    };
  }, []);

  // Function to handle navigation with cleanup
  const handleNavigation = (path: string) => {
    sessionStorage.removeItem('settingsPasswordVerified');
    navigate(path);
  };

  const fetchUserRole = async () => {
    if (!user) return;
    
    console.log('Fetching user role for user:', user.id, user.email);
    
    try {
      // Direct query to profiles table instead of RPC function
      const { data, error } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        console.log('Database Error details:', error);
        
        // Special handling for known admin email
        if (user.email === 'fakiragram@grihasajjwa.com') {
          console.log('🚨 EMERGENCY: Known admin email detected, forcing admin role');
          setUserRole('admin');
        } else {
          setUserRole('employee'); // Default to employee on error
        }
      } else {
        console.log('Database result:', data);
        console.log('Setting user role to:', data?.user_role || 'employee');
        setUserRole(data?.user_role || 'employee'); // Default to employee if no data
      }
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      
      // Special handling for known admin email
      if (user.email === 'fakiragram@grihasajjwa.com') {
        console.log('🚨 EMERGENCY: Known admin email detected, forcing admin role');
        setUserRole('admin');
      } else {
        setUserRole('employee'); // Default to employee on error
      }
    }
  };

  const verifyPassword = async () => {
    setIsVerifyingPassword(true);
    
    try {
      // Check password against database - get all active passwords
      const { data, error } = await supabase
        .from('settings_access_password' as any)
        .select('password_hash')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching password:', error);
        toast({
          title: 'Error',
          description: 'Failed to verify password. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Check if any of the active passwords match
      const passwords = data as any[];
      const isValidPassword = passwords.some(pwd => enteredPassword === pwd.password_hash);

      if (isValidPassword) {
        setIsPasswordVerified(true);
        setPasswordPromptOpen(false);
        sessionStorage.setItem('settingsPasswordVerified', 'true');
        toast({
          title: 'Access Granted',
          description: 'Password verified successfully',
        });
      } else {
        toast({
          title: 'Access Denied',
          description: 'Incorrect password. Please try again.',
          variant: 'destructive',
        });
        setEnteredPassword('');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while verifying password',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handlePasswordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      verifyPassword();
    }
  };

  const fetchSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('visible_tabs, control_settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        
        // Check if it's a column not found error
        if (error.code === '42703') {
          toast({
            title: 'Migration Needed',
            description: 'Control settings column missing. Please run the database migration.',
            variant: 'destructive',
          });
          // Use defaults and don't return
        setControlSettings({
          allowEdit: true,
          allowDelete: true,
          allowAddNew: true,
          allowExport: true,
          showFinancialTotals: true,
          allowBulkOperations: true,
          allowAddPayment: true,
          allowPaymentManager: true,
          allowRecordPayment: true,
          allowEmailChange: true,
          allowBillManagement: true,
          allowMahajanDeletion: true,
        });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to load settings',
            variant: 'destructive',
          });
          return;
        }
      }

      if (data) {
        const settings = (data as any)?.visible_tabs as unknown as TabSettings;
        // Ensure mahajans field exists, default to true if missing
        const settingsWithMahajans = {
          ...settings,
          mahajans: settings.mahajans !== undefined ? settings.mahajans : true
        };
        setSettings(settingsWithMahajans);
        
        // Try to load control settings from database
        const defaultControlSettings = {
          allowEdit: true,
          allowDelete: true,
          allowAddNew: true,
          allowExport: true,
          showFinancialTotals: true,
          allowBulkOperations: true,
          allowAddPayment: true,
          allowPaymentManager: true,
          allowRecordPayment: true,
          allowEmailChange: true,
          allowBillManagement: true,
          allowMahajanDeletion: true,
        };
        
        if ((data as any)?.control_settings) {
          // Merge database settings with defaults to ensure all fields are present
          const dbSettings = (data as any).control_settings;
          setControlSettings({
            ...defaultControlSettings,
            ...dbSettings
          });
        } else {
          // Use defaults if control_settings not found
          setControlSettings(defaultControlSettings);
        }
      } else {
        // If no settings exist, use defaults and create them
        const defaultSettings = {
          loans: true,
          customers: true,
          mahajans: true,
          daywise: true,
          payments: true,
          bill_customers: true,
        };
        
        const defaultControls = {
          allowEdit: true,
          allowDelete: true,
          allowAddNew: true,
          allowExport: true,
          showFinancialTotals: true,
          allowBulkOperations: true,
          allowAddPayment: true,
          allowPaymentManager: true,
          allowRecordPayment: true,
          allowEmailChange: true,
          allowBillManagement: true,
          allowMahajanDeletion: true,
        };
        
        setSettings(defaultSettings);
        setControlSettings(defaultControls);
        
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
    } finally {
      setIsLoading(false);
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
        // Update Existing Record
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
          description: 'Settings updated successfully',
        });
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

  const handleControlToggle = async (key: keyof ControlSettings) => {
    if (!user || isUpdating) return;

    const newControlSettings = { ...controlSettings, [key]: !controlSettings[key] };
    setControlSettings(newControlSettings);
    setIsUpdating(true);

    try {
      console.log('Updating control settings for user:', user.id);
      console.log('New control settings:', newControlSettings);
      
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

      if (existingData) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            control_settings: newControlSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error updating control settings:', updateError);
          throw updateError;
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: settings as any,
            control_settings: newControlSettings,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error inserting control settings:', insertError);
          throw insertError;
        }
      }

      toast({
        title: 'Success',
        description: 'Control settings updated successfully',
      });

      // Refresh the global control context
      refreshSettings();

    } catch (error) {
      console.error('Unexpected error updating control settings:', error);
      // Revert the local state on error
      setControlSettings(controlSettings);
      
      // Check if it's a column not found error
      if (error && typeof error === 'object' && 'code' in error && error.code === '42703') {
        toast({
          title: 'Database Migration Required',
          description: 'The control_settings column needs to be added to your database. Please run the migration.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred while updating control settings',
          variant: 'destructive',
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmailChange = async () => {
    if (!user || !newEmail.trim()) return;
    
    setIsChangingEmail(true);
    
    try {
      if (emailChangeMethod === 'direct') {
        // Direct email change - use admin API to update user
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          email: newEmail.trim()
        });
        
        if (error) {
          toast({
            variant: "destructive",
            title: "Email Change Error",
            description: error.message,
          });
        } else {
          toast({
            title: "Email Updated",
            description: "Your email address has been updated successfully.",
          });
        }
      } else {
        // Confirmation method - send confirmation link
        const { error } = await supabase.auth.updateUser({
          email: newEmail.trim()
        });
        
        if (error) {
          toast({
            variant: "destructive",
            title: "Email Change Error",
            description: error.message,
          });
        } else {
          toast({
            title: "Check your email",
            description: "We've sent a confirmation link to your new email address.",
          });
        }
      }
      
      setIsEmailDialogOpen(false);
      setNewEmail('');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Email Change Error",
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setIsChangingEmail(false);
    }
  };

  const resetToDefaults = async () => {
    const defaultSettings = {
      loans: true,
      customers: true,
      mahajans: true,
      daywise: true,
      payments: true,
      bill_customers: true,
    };

    const defaultControls = {
      allowEdit: true,
      allowDelete: true,
      allowAddNew: true,
      allowExport: true,
      showFinancialTotals: true,
      allowBulkOperations: true,
      allowAddPayment: true,
      allowPaymentManager: true,
      allowRecordPayment: true,
      allowEmailChange: true,
      allowBillManagement: true,
      allowMahajanDeletion: true,
    };

    setSettings(defaultSettings);
    setControlSettings(defaultControls);
    
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          visible_tabs: defaultSettings,
          control_settings: defaultControls,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to reset settings',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Settings reset to defaults',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset settings',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Show password prompt if not verified and not admin
  if (!isPasswordVerified && userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-6">
            <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Settings Access</h1>
            <p className="text-muted-foreground mb-6">
              Please enter the password to access the Settings page.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-password">Password</Label>
              <Input
                id="settings-password"
                type="password"
                placeholder="Enter password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                onKeyPress={handlePasswordKeyPress}
                disabled={isVerifyingPassword}
                className="text-center"
              />
            </div>
            
            <Button
              onClick={verifyPassword}
              disabled={isVerifyingPassword || !enteredPassword.trim()}
              className="w-full"
            >
              {isVerifyingPassword ? 'Verifying...' : 'Access Settings'}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleNavigation('/')}
              className="w-full"
              disabled={isVerifyingPassword}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigation('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            {userRole === 'admin' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/password-management')}
                  className="flex items-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Manage Access Password
                </Button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your application preferences</p>
              {userRole === 'admin' && (
                <p className="text-sm text-green-600 font-medium">Admin Access - No password required</p>
              )}
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="max-w-2xl space-y-6">
          {/* User Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                User Profile Settings
              </CardTitle>
              <CardDescription>
                Manage your account information and role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current User Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Current Email</Label>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full capitalize">
                      {userRole}
                    </span>
                  </div>
                </div>

                {/* Email Change Section */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Change Email Address</Label>
                    <p className="text-sm text-muted-foreground">
                      Update your email address with or without confirmation.
                    </p>
                  </div>
                  <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={!controlSettings.allowEmailChange}
                        className="flex items-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Change Email
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Email Address</DialogTitle>
                        <DialogDescription>
                          Enter your new email address and choose how you want to update it.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-email">New Email Address</Label>
                          <Input
                            id="new-email"
                            type="email"
                            placeholder="Enter new email address"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            disabled={isChangingEmail}
                          />
                        </div>
                        
                        <div className="space-y-3">
                          <Label>Change Method</Label>
                          <RadioGroup
                            value={emailChangeMethod}
                            onValueChange={(value: 'confirmation' | 'direct') => setEmailChangeMethod(value)}
                            disabled={isChangingEmail}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="direct" id="direct" />
                              <Label htmlFor="direct" className="text-sm">
                                Direct change (No confirmation) - Recommended
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="confirmation" id="confirmation" />
                              <Label htmlFor="confirmation" className="text-sm">
                                Send confirmation link
                              </Label>
                            </div>
                          </RadioGroup>
                          <p className="text-xs text-muted-foreground">
                            {emailChangeMethod === 'confirmation' 
                              ? 'A confirmation link will be sent to your new email address.'
                              : 'Email will be changed immediately without confirmation.'
                            }
                          </p>
                        </div>
                        
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEmailDialogOpen(false);
                              setNewEmail('');
                              setEmailChangeMethod('direct');
                            }}
                            disabled={isChangingEmail}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleEmailChange}
                            disabled={isChangingEmail || !newEmail.trim()}
                          >
                            {isChangingEmail 
                              ? (emailChangeMethod === 'direct' ? 'Updating...' : 'Sending...') 
                              : (emailChangeMethod === 'direct' ? 'Update Email' : 'Send Confirmation')
                            }
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Email Change Control */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Email Change Permission</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow users to change their email address
                    </p>
                  </div>
                  <Switch
                    checked={controlSettings.allowEmailChange}
                    disabled={isUpdating}
                    onCheckedChange={() => handleControlToggle('allowEmailChange')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tab Visibility Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Tab Visibility Settings</CardTitle>
              <CardDescription>
                Control which tabs are visible in the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor={key} className="capitalize text-base font-medium">
                        {key === 'daywise' ? 'Daywise Payment' : key}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {key === 'loans' && 'Manage loans and repayments'}
                        {key === 'customers' && 'Customer management and details'}
                        {key === 'mahajans' && 'Mahajan management and bill tracking'}
                        {key === 'daywise' && 'Daily payment schedule overview'}
                        {key === 'payments' && 'Payment history and tracking'}
                      </p>
                    </div>
                    <Switch
                      id={key}
                      checked={value}
                      disabled={isUpdating}
                      onCheckedChange={() => handleToggle(key as keyof TabSettings)}
                    />
                  </div>
                ))}
              </div>

              {/* Reset Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={resetToDefaults}
                  disabled={isUpdating}
                  className="w-full"
                >
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Controller Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Controller Settings</CardTitle>
              <CardDescription>
                Control the visibility of edit, delete, and other operations throughout the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
              <div className="grid gap-4">
                {Object.entries(controlSettings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor={key} className="capitalize text-base font-medium">
                        {key === 'allowEdit' && 'Edit Operations'}
                        {key === 'allowDelete' && 'Delete Operations'}
                        {key === 'allowAddNew' && 'Add New Items'}
                        {key === 'allowExport' && 'Export Functions'}
                        {key === 'showFinancialTotals' && 'Financial Totals Display'}
                        {key === 'allowBulkOperations' && 'Bulk Operations'}
                        {key === 'allowAddPayment' && 'Add Payment Operations'}
                        {key === 'allowPaymentManager' && 'Payment Manager Tab'}
                        {key === 'allowRecordPayment' && 'Record Payment Button'}
                        {key === 'allowEmailChange' && 'Email Change Permission'}
                        {key === 'allowBillManagement' && 'Bill Management Operations'}
                        {key === 'allowMahajanDeletion' && 'Mahajan Deletion Permission'}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {key === 'allowEdit' && 'Show/hide edit buttons and modify forms throughout the app'}
                        {key === 'allowDelete' && 'Show/hide delete buttons and remove data functionality'}
                        {key === 'allowAddNew' && 'Show/hide add buttons and create new records'}
                        {key === 'allowExport' && 'Enable/disable CSV export, PDF generation, and data downloads'}
                        {key === 'showFinancialTotals' && 'Display/hide financial summaries and totals in reports'}
                        {key === 'allowBulkOperations' && 'Enable/disable multi-record operations and batch actions'}
                        {key === 'allowAddPayment' && 'Show/hide Add Payment buttons in loan lists and payment forms'}
                        {key === 'allowPaymentManager' && 'Show/hide Payment Manager tab in Customers section'}
                        {key === 'allowRecordPayment' && 'Show/hide Record Payment button in loan details and payment dialogs'}
                        {key === 'allowEmailChange' && 'Enable/disable email change functionality for users'}
                        {key === 'allowBillManagement' && 'Show/hide bill management features in Mahajan section'}
                        {key === 'allowMahajanDeletion' && 'Enable/disable mahajan deletion functionality'}
                      </p>
                    </div>
                    <Switch
                      id={key}
                      checked={value}
                      disabled={isUpdating}
                      onCheckedChange={() => handleControlToggle(key as keyof ControlSettings)}
                    />
                  </div>
                ))}
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
