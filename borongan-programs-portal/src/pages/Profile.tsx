import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCamera, FiLoader } from 'react-icons/fi';
import { useQueryClient } from '@tanstack/react-query';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api/auth.service';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

function toAbsUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = API_URL.replace(/\/api\/?$/, '');
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

interface ProfileForm {
  firstName: string;
  middleName: string;
  lastName: string;
  extensionName: string;
  birthdate: string;
  sex: string;
  civilStatus: string;
  contactNumber: string;
  email: string;
  streetAddress: string;
  emergencyContactPerson: string;
  emergencyContactNumber: string;
  picturePath: string;
}

const emptyForm: ProfileForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  extensionName: '',
  birthdate: '',
  sex: '',
  civilStatus: '',
  contactNumber: '',
  email: '',
  streetAddress: '',
  emergencyContactPerson: '',
  emergencyContactNumber: '',
  picturePath: '',
};

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName ?? '',
      middleName: user.middleName ?? '',
      lastName: user.lastName ?? '',
      extensionName: user.extensionName ?? '',
      birthdate: user.birthdate ? String(user.birthdate).slice(0, 10) : '',
      sex: user.sex ?? '',
      civilStatus: user.civilStatus ?? '',
      contactNumber: user.contactNumber ?? '',
      email: user.email ?? '',
      streetAddress: user.streetAddress ?? '',
      emergencyContactPerson: user.emergencyContactPerson ?? '',
      emergencyContactNumber: user.emergencyContactNumber ?? '',
      picturePath: user.picturePath ?? '',
    });
  }, [user]);

  const update = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Max 5MB' });
      return;
    }
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const upload = await api.post('/upload/registration/profile-picture', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = upload.data.data.url as string;
      update('picturePath', url);
      setPhotoPreview(null);
      toast({ title: 'Photo uploaded', description: 'Save the form to apply your new photo.' });
    } catch {
      setPhotoPreview(null);
      toast({ variant: 'destructive', title: 'Photo upload failed', description: 'Please try again.' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await api.put('/residents/me', {
        firstName: form.firstName || null,
        middleName: form.middleName || null,
        lastName: form.lastName || null,
        extensionName: form.extensionName || null,
        birthdate: form.birthdate || null,
        sex: form.sex || null,
        civilStatus: form.civilStatus || null,
        contactNumber: form.contactNumber || null,
        email: form.email || null,
        streetAddress: form.streetAddress || null,
        emergencyContactPerson: form.emergencyContactPerson || null,
        emergencyContactNumber: form.emergencyContactNumber || null,
        picturePath: form.picturePath || null,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile';
      toast({ variant: 'destructive', title: 'Save failed', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const photoSrc = photoPreview || toAbsUrl(form.picturePath);
  const initials = ((user?.name ?? '?').match(/\b\w/g) ?? []).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Button size="sm" variant="ghost" onClick={() => navigate('/')} className="gap-1.5">
            <FiArrowLeft size={14} />
            <span>Back</span>
          </Button>
          <h1 className="text-sm font-semibold text-heading-700">My Profile</h1>
          <div className="w-12" />
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Photo</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Avatar
                className={cn('h-20 w-20 cursor-pointer', photoUploading && 'opacity-60')}
                onClick={() => !photoUploading && photoInputRef.current?.click()}
              >
                {photoSrc ? (
                  <AvatarImage src={photoSrc} alt={user?.name ?? 'Profile'} />
                ) : null}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="gap-1.5"
                >
                  {photoUploading ? <FiLoader className="animate-spin" size={14} /> : <FiCamera size={14} />}
                  <span>{photoUploading ? 'Uploading...' : form.picturePath ? 'Change photo' : 'Upload photo'}</span>
                </Button>
                <p className="text-xs text-muted-foreground mt-2">JPEG, PNG, or WebP. Max 5MB.</p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePhotoUpload(f);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">First name</label>
                <Input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Middle name</label>
                <Input value={form.middleName} onChange={(e) => update('middleName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Last name</label>
                <Input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Extension</label>
                <Input
                  value={form.extensionName}
                  onChange={(e) => update('extensionName', e.target.value)}
                  placeholder="Jr., Sr., III..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Birthdate</label>
                <Input
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => update('birthdate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Sex</label>
                <Select value={form.sex} onValueChange={(v) => update('sex', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-heading-700">Civil status</label>
                <Select value={form.civilStatus} onValueChange={(v) => update('civilStatus', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                    <SelectItem value="Separated">Separated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Contact number</label>
                <Input
                  value={form.contactNumber}
                  onChange={(e) => update('contactNumber', e.target.value)}
                  placeholder="09xx-xxx-xxxx"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-heading-700">Street address</label>
                <Input
                  value={form.streetAddress}
                  onChange={(e) => update('streetAddress', e.target.value)}
                  placeholder="Purok / Street, Barangay"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Contact person</label>
                <Input
                  value={form.emergencyContactPerson}
                  onChange={(e) => update('emergencyContactPerson', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-heading-700">Contact number</label>
                <Input
                  value={form.emergencyContactNumber}
                  onChange={(e) => update('emergencyContactNumber', e.target.value)}
                  placeholder="09xx-xxx-xxxx"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate('/')} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || photoUploading}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Profile;
