'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Edit,
  Users,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mail,
  RefreshCw
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  getAllTeams,
  createTeam,
  updateTeam,
  getAllUsers,
  updateUser,
  Team,
  UserWithDetails
} from '@/lib/api-super-admin';

// Available team colors (matching database hex values)
const teamColors = [
  { value: '#3B82F6', label: 'Blue', class: 'bg-blue-500' },
  { value: '#10B981', label: 'Green', class: 'bg-emerald-500' },
  { value: '#8B5CF6', label: 'Purple', class: 'bg-violet-500' },
  { value: '#F59E0B', label: 'Orange', class: 'bg-amber-500' },
  { value: '#EC4899', label: 'Pink', class: 'bg-pink-500' },
  { value: '#EF4444', label: 'Red', class: 'bg-red-500' },
  { value: '#06B6D4', label: 'Cyan', class: 'bg-cyan-500' },
  { value: '#84CC16', label: 'Lime', class: 'bg-lime-500' },
];

export default function TeamsPage() {
  const { token } = useAuth();

  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [allAdmins, setAllAdmins] = useState<UserWithDetails[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, UserWithDetails[]>>({});

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Partial<Team & { key?: string }>>({});
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // Fetch teams and admins
  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch teams and all admin users in parallel
      const [teamsData, adminsData] = await Promise.all([
        getAllTeams(token),
        getAllUsers(token, { role: 'admin' })
      ]);

      setTeams(teamsData);
      setAllAdmins(adminsData);

      // Group admins by their team
      const membersByTeam: Record<string, UserWithDetails[]> = {};
      teamsData.forEach(team => {
        membersByTeam[team.key] = adminsData.filter(admin => admin.team === team.key);
      });
      setTeamMembers(membersByTeam);

    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create new team
  const handleCreateNew = () => {
    setEditingTeam({
      key: '',
      name: '',
      description: '',
      color: '#3B82F6',
    });
    setIsEditing(true);
  };

  // Edit existing team
  const handleEdit = (team: Team) => {
    setEditingTeam({
      id: team.id,
      key: team.key,
      name: team.name,
      description: team.description || '',
      color: team.color,
      is_active: team.is_active,
      order_index: team.order_index,
    });
    setIsEditing(true);
  };

  // Open member management dialog
  const handleManageMembers = (team: Team) => {
    setSelectedTeam(team);
    // Pre-select current team members
    const currentMembers = teamMembers[team.key] || [];
    setSelectedMemberIds(currentMembers.map(m => m.id));
    setIsManagingMembers(true);
  };

  // Save team (create or update)
  const handleSave = async () => {
    if (!token) return;

    try {
      setSaving(true);
      setSaveStatus('idle');

      if (editingTeam.id) {
        // Update existing team
        await updateTeam(token, editingTeam.id, {
          name: editingTeam.name,
          description: editingTeam.description || undefined,
          color: editingTeam.color,
          is_active: editingTeam.is_active,
          order_index: editingTeam.order_index,
        });
        setSaveMessage('Team updated successfully!');
      } else {
        // Create new team
        if (!editingTeam.key || !editingTeam.name) {
          throw new Error('Team key and name are required');
        }
        await createTeam(token, {
          key: editingTeam.key.toLowerCase().replace(/\s+/g, '_'),
          name: editingTeam.name,
          description: editingTeam.description || undefined,
          color: editingTeam.color,
        });
        setSaveMessage('Team created successfully!');
      }

      setSaveStatus('success');
      setIsEditing(false);

      // Refresh data
      await fetchData();

      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save team:', err);
      setSaveStatus('error');
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  // Save member assignments
  const handleSaveMembers = async () => {
    if (!token || !selectedTeam) return;

    try {
      setSaving(true);
      setSaveStatus('idle');

      const currentMembers = teamMembers[selectedTeam.key] || [];
      const currentMemberIds = currentMembers.map(m => m.id);

      // Find members to add and remove
      const toAdd = selectedMemberIds.filter(id => !currentMemberIds.includes(id));
      const toRemove = currentMemberIds.filter(id => !selectedMemberIds.includes(id));

      // Update each user's team assignment
      const updates: Promise<UserWithDetails>[] = [];

      // Add new members to this team
      for (const userId of toAdd) {
        updates.push(updateUser(token, userId, { team: selectedTeam.key }));
      }

      // Remove members from this team (set team to empty string which backend treats as null)
      for (const userId of toRemove) {
        updates.push(updateUser(token, userId, { team: '' }));
      }

      await Promise.all(updates);

      setSaveStatus('success');
      setSaveMessage(`Team members updated! Added ${toAdd.length}, removed ${toRemove.length}.`);
      setIsManagingMembers(false);

      // Refresh data
      await fetchData();

      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save members:', err);
      setSaveStatus('error');
      setSaveMessage(err instanceof Error ? err.message : 'Failed to update team members');
    } finally {
      setSaving(false);
    }
  };

  // Toggle member selection
  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Get color style for team
  const getColorStyle = (hexColor: string) => {
    return { backgroundColor: hexColor };
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-camp-green" />
        <span className="ml-2 text-gray-600">Loading teams...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-1">
            Organize admin users into review teams
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Team
          </Button>
        </div>
      </div>

      {saveStatus === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {saveMessage}
          </AlertDescription>
        </Alert>
      )}

      {saveStatus === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      {/* Teams Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const members = teamMembers[team.key] || [];

          return (
            <Card key={team.id} className={!team.is_active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                      style={getColorStyle(team.color)}
                    />
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {team.name}
                        {!team.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{team.description || 'No description'}</CardDescription>
                      <div className="text-xs text-muted-foreground">
                        Key: <code className="bg-muted px-1 py-0.5 rounded">{team.key}</code>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(team)}
                      title="Edit team"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{team.admin_count || 0} member{(team.admin_count || 0) !== 1 ? 's' : ''}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleManageMembers(team)}
                  >
                    <UserPlus className="mr-1 h-3 w-3" />
                    Manage
                  </Button>
                </div>

                {members.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Team Members</div>
                      <div className="flex flex-wrap gap-2">
                        {members.slice(0, 5).map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {member.first_name?.[0]}{member.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{member.first_name} {member.last_name}</span>
                          </div>
                        ))}
                        {members.length > 5 && (
                          <div className="flex items-center justify-center p-2 rounded-md bg-muted text-xs text-muted-foreground">
                            +{members.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {teams.length === 0 && (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No teams configured</h3>
          <p className="text-muted-foreground mb-4">
            Create your first team to start organizing admin users.
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            Create Team
          </Button>
        </Card>
      )}

      {/* Edit/Create Team Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTeam.id ? 'Edit Team' : 'Create New Team'}
            </DialogTitle>
            <DialogDescription>
              {editingTeam.id
                ? 'Update team details below.'
                : 'Enter the details for your new team.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingTeam.id && (
              <div className="space-y-2">
                <Label htmlFor="team-key">Team Key</Label>
                <Input
                  id="team-key"
                  value={editingTeam.key || ''}
                  onChange={(e) =>
                    setEditingTeam(prev => ({ ...prev, key: e.target.value }))
                  }
                  placeholder="e.g., ops, medical, behavioral"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  A unique identifier for this team (lowercase, no spaces)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                value={editingTeam.name || ''}
                onChange={(e) =>
                  setEditingTeam(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Operations Team"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                value={editingTeam.description || ''}
                onChange={(e) =>
                  setEditingTeam(prev => ({ ...prev, description: e.target.value }))
                }
                placeholder="Brief description of the team's purpose"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-color">Team Color</Label>
              <Select
                value={editingTeam.color || '#3B82F6'}
                onValueChange={(value) =>
                  setEditingTeam(prev => ({ ...prev, color: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teamColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: color.value }}
                        />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingTeam.id && (
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="team-active"
                  checked={editingTeam.is_active !== false}
                  onChange={(e) =>
                    setEditingTeam(prev => ({ ...prev, is_active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="team-active" className="font-normal">
                  Team is active
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!editingTeam.id && (!editingTeam.key || !editingTeam.name))}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editingTeam.id ? 'Save Changes' : 'Create Team'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={isManagingMembers} onOpenChange={setIsManagingMembers}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Team Members</DialogTitle>
            <DialogDescription>
              Add or remove admin users from <strong>{selectedTeam?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground mb-3">
              Select the admin users who should be part of this team.
              Only users with the Admin role are shown.
            </div>

            {allAdmins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No admin users found.</p>
                <p className="text-sm">Promote users to Admin role first in User Management.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-2">
                {allAdmins.map((user) => {
                  const isSelected = selectedMemberIds.includes(user.id);
                  const isOnAnotherTeam = user.team && user.team !== selectedTeam?.key;

                  return (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors
                        ${isSelected ? 'bg-camp-green/10 border-camp-green' : 'hover:bg-muted/50'}
                        ${isOnAnotherTeam ? 'opacity-60' : ''}`}
                      onClick={() => toggleMember(user.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.first_name} {user.last_name}
                            {isOnAnotherTeam && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Currently: {user.team}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(user.id)}
                        className="h-5 w-5 rounded border-gray-300 text-camp-green focus:ring-camp-green"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedMemberIds.length} admin{selectedMemberIds.length !== 1 ? 's' : ''} selected
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManagingMembers(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMembers} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Members'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
