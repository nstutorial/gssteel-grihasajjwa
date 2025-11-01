import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Save, Edit } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
  });

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Use user data from Supabase Auth (no additional table needed)
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        created_at: user.created_at || new Date().toISOString(),
      };

      setProfile(userProfile);
      setFormData({
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
      });
      
    } catch (error) {
      console.error('Error setting up profile:', error);
      
      // Set fallback data
      setProfile({
        id: user.id,
        email: user.email || '',
        full_name: '',
        avatar_url: '',
        created_at: new Date().toISOString(),
      });
      setFormData({
        full_name: '',
        email: user.email || '',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    try {
      // Update user metadata in Supabase Auth (email cannot be changed)
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: formData.full_name.trim(),
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      setEditing(false);
      // Refresh profile data
      fetchUserProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    // Reset form data to current profile data
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || user?.email || '',
      });
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Profile</h1>
              <p className="text-muted-foreground">Manage your account information</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Avatar Section */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>
                  Your avatar across the platform
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Avatar className="h-32 w-32 mx-auto mb-4">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(profile?.full_name, profile?.email)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-muted-foreground mb-4">
                  {profile?.full_name || 'No name set'}
                </p>
                <Button variant="outline" size="sm" disabled>
                  <User className="h-4 w-4 mr-2" />
                  Change Avatar
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Profile Information */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Account Information</CardTitle>
                    <CardDescription>
                      Manage your personal details
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!editing && (
                      <Button variant="outline" size="sm" onClick={handleEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter your full name"
                    disabled={!editing}
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    placeholder="Your login email"
                    disabled={true}
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed for security reasons. If email change is required, contact app authority at{' '}
                    <a 
                      href="mailto:nsutradhar.cob@gmail.com" 
                      className="text-primary hover:underline font-medium"
                    >
                      nsutradhar.cob@gmail.com
                    </a>
                  </p>
                </div>

                {/* User ID (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="user_id">User ID</Label>
                  <Input
                    id="user_id"
                    value={profile?.id || user?.id || ''}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    This is your unique user identifier
                  </p>
                </div>

                {/* Account Creation Date */}
                <div className="space-y-2">
                  <Label htmlFor="created_at">Member Since</Label>
                  <Input
                    id="created_at"
                    value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ''}
                    disabled
                  />
                </div>

                {/* Action Buttons */}
                {editing && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button variant="outline" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Statistics */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Account Statistics</CardTitle>
                <CardDescription>Your activity overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Days Active</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {user?.email ? 'Active' : 'Unknown'}
                    </div>
                    <div className="text-sm text-muted-foreground">Status</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {user?.email ? 'Verified' : 'Unverified'}
                    </div>
                    <div className="text-sm text-muted-foreground">Account</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {profile?.full_name ? 'Complete' : 'Incomplete'}
                    </div>
                    <div className="text-sm text-muted-foreground">Profile</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
