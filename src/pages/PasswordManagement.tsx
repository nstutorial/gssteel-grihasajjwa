import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Settings as SettingsIcon, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { useControl } from '@/contexts/ControlContext';

const PasswordManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshSettings } = useControl();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('employee');
  const [passwordExists, setPasswordExists] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserRole();
      checkPasswordExists();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) return;
    
    try {
      // Use RPC function to get user role
      const { data, error } = await supabase.rpc('get_user_role', {
        user_id_param: user.id
      });

      if (error) {
        console.error('Error fetching user role:', error);
        setUserRole('employee');
      } else {
        setUserRole(data || 'employee');
      }
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      setUserRole('employee');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPasswordExists = async () => {
    try {
      const { data, error } = await supabase
        .from('settings_access_password' as any)
        .select('id')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking password existence:', error);
      } else {
        setPasswordExists(!!data);
      }
    } catch (error) {
      console.error('Error in checkPasswordExists:', error);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || isUpdating) return;

    // Validation
    if (!newPassword.trim()) {
      toast({
        title: 'Validation Error',
        description: 'New password is required',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Validation Error',
        description: 'New password and confirmation do not match',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 3) {
      toast({
        title: 'Validation Error',
        description: 'Password must be at least 3 characters long',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);

    try {
      // For simplicity, we'll store the password in plain text
      // In production, you should hash the password
      const passwordHash = newPassword; // This should be hashed in production

      if (passwordExists) {
        // Update existing password
        const { error } = await supabase
          .from('settings_access_password' as any)
          .update({
            password_hash: passwordHash,
            updated_at: new Date().toISOString(),
          })
          .eq('is_active', true);

        if (error) {
          throw error;
        }
      } else {
        // Create new password
        const { error } = await supabase
          .from('settings_access_password' as any)
          .insert({
            password_hash: passwordHash,
            created_by: user.id,
            is_active: true,
          });

        if (error) {
          throw error;
        }
      }

      toast({
        title: 'Success',
        description: 'Settings access password updated successfully',
      });

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordExists(true);

    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is admin, if not show access denied
  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-6">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access the Password Management page. This page is only available for administrators.
            </p>
          </div>
          
          <div className="space-y-4">
            <Button
              onClick={() => navigate('/')}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <p>Current role: <span className="font-medium capitalize">{userRole}</span></p>
              <p>Required role: <span className="font-medium">admin</span></p>
            </div>
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
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <Lock className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Password Management</h1>
              <p className="text-muted-foreground">Manage the settings page access password</p>
            </div>
          </div>
        </div>

        {/* Password Management Content */}
        <div className="max-w-2xl space-y-6">
          {/* Password Update Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Settings Access Password
              </CardTitle>
              <CardDescription>
                Set or change the password required for non-admin users to access the Settings page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Alert */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Admin Access:</strong> Administrators can access the Settings page without entering a password.
                  <br />
                  <strong>Other Users:</strong> Must enter the password set here to access the Settings page.
                </AlertDescription>
              </Alert>

              {/* Password Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isUpdating}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={isUpdating}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isUpdating}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isUpdating}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Update Button */}
                <Button
                  onClick={handleUpdatePassword}
                  disabled={isUpdating || !newPassword.trim() || !confirmPassword.trim()}
                  className="w-full"
                >
                  {isUpdating ? 'Updating...' : (passwordExists ? 'Update Password' : 'Set Password')}
                </Button>
              </div>

              {/* Current Status */}
              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  <p>
                    <strong>Current Status:</strong> {passwordExists ? 'Password is set' : 'No password set'}
                  </p>
                  <p className="mt-1">
                    <strong>Last Updated:</strong> {passwordExists ? 'Available' : 'Not applicable'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PasswordManagement;
