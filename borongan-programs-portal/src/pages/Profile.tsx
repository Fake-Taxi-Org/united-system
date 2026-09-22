import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCamera, FiDownload, FiHelpCircle, FiInfo, FiLoader, FiLogOut, FiUser } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useToast } from '@/hooks/use-toast';
import api from '@/services/api/auth.service';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const USER_GUIDE_URL = '/user-guide/presentation.html';

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

const emptyDefaults: ProfileForm = {
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
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<ProfileForm>({ defaultValues: emptyDefaults });
  const {
    handleSubmit,
    reset,
    formState: { isDirty },
    setValue,
    watch,
  } = form;

  useEffect(() => {
    if (!user) return;
    reset({
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
  }, [user, reset]);

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
      setValue('picturePath', url, { shouldDirty: true });
      setPhotoPreview(null);
      toast({ title: 'Photo uploaded', description: 'Save the form to apply your new photo.' });
    } catch {
      setPhotoPreview(null);
      toast({ variant: 'destructive', title: 'Photo upload failed', description: 'Please try again.' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const onSubmit = async (values: ProfileForm) => {
    setSaving(true);
    try {
      await api.put('/residents/me', {
        firstName: values.firstName || null,
        middleName: values.middleName || null,
        lastName: values.lastName || null,
        extensionName: values.extensionName || null,
        birthdate: values.birthdate || null,
        sex: values.sex || null,
        civilStatus: values.civilStatus || null,
        contactNumber: values.contactNumber || null,
        email: values.email || null,
        streetAddress: values.streetAddress || null,
        emergencyContactPerson: values.emergencyContactPerson || null,
        emergencyContactNumber: values.emergencyContactNumber || null,
        picturePath: values.picturePath || null,
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

  const photoSrc = photoPreview || toAbsUrl(watch('picturePath'));
  const initials = ((user?.name ?? '?').match(/\b\w/g) ?? []).slice(0, 2).join('').toUpperCase() || '?';
  const barangayName = (user?.barangay as { barangayName?: string; name?: string } | null)?.barangayName
    || (user?.barangay as { barangayName?: string; name?: string } | null)?.name
    || '';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Global nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate('/')}
              aria-label="Back to home"
              className="gap-1.5 -ml-2"
            >
              <FiArrowLeft size={14} />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="flex items-center gap-2.5">
              <img src="/favicon.png" alt="LGU Borongan" className="h-8 w-auto" />
              <span className="font-semibold text-heading-700 text-sm hidden sm:block">
                Borongan Services Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(USER_GUIDE_URL, '_blank', 'noopener,noreferrer')}
              className="gap-1.5"
              aria-label="Open user guide"
              title="User Guide"
            >
              <FiHelpCircle size={14} />
              <span className="hidden sm:inline">Help</span>
            </Button>
            {canInstall && !isInstalled && (
              <Button size="sm" variant="outline" onClick={install} className="gap-1.5">
                <FiDownload size={14} />
                <span className="hidden sm:inline">Install App</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Avatar className="h-9 w-9 border border-gray-200">
                    {photoSrc ? <AvatarImage src={photoSrc} alt={user?.name ?? 'Profile'} /> : null}
                    <AvatarFallback className="bg-primary-100 text-primary-700 text-sm">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[14rem]">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-heading-900 truncate">{user?.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{user?.email || user?.username}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/profile')}>
                  <FiUser />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout} className="text-danger-700 focus:text-danger-700">
                  <FiLogOut />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Identity header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-center gap-5">
            <div className="relative group shrink-0">
              <button
                type="button"
                onClick={() => !photoUploading && photoInputRef.current?.click()}
                disabled={photoUploading}
                className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                aria-label="Change profile photo"
              >
                <Avatar className={cn('h-24 w-24 sm:h-28 sm:w-28 border-4 border-white shadow-md', photoUploading && 'opacity-60')}>
                  {photoSrc ? <AvatarImage src={photoSrc} alt={user?.name ?? 'Profile'} /> : null}
                  <AvatarFallback className="text-2xl bg-primary-100 text-primary-700">{initials}</AvatarFallback>
                </Avatar>
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {photoUploading ? <FiLoader className="animate-spin" size={20} /> : <FiCamera size={20} />}
                </span>
              </button>
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

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-600">Profile</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-heading-900 truncate">{user?.name ?? 'Resident'}</h1>
              {barangayName ? (
                <p className="text-sm text-heading-600 mt-1">Brgy. {barangayName}, Borongan City</p>
              ) : (
                <p className="text-sm text-heading-500 mt-1">Resident account</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5 hidden sm:block">Hover the photo to change it.</p>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card className="border-gray-100">
              <CardContent className="pt-6">
                <Tabs defaultValue="personal" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 mb-6">
                    <TabsTrigger value="personal">Personal</TabsTrigger>
                    <TabsTrigger value="contact">Contact</TabsTrigger>
                    <TabsTrigger value="emergency">Emergency</TabsTrigger>
                  </TabsList>

                  <TabsContent value="personal" className="mt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="middleName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Middle name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="extensionName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Extension</FormLabel>
                            <FormControl><Input {...field} placeholder="Jr., Sr., III..." /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="birthdate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Birthdate</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sex"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sex</FormLabel>
                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="civilStatus"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Civil status</FormLabel>
                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Single">Single</SelectItem>
                                <SelectItem value="Married">Married</SelectItem>
                                <SelectItem value="Widowed">Widowed</SelectItem>
                                <SelectItem value="Separated">Separated</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="contact" className="mt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact number</FormLabel>
                            <FormControl><Input {...field} placeholder="09xx-xxx-xxxx" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl><Input type="email" {...field} placeholder="you@example.com" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="streetAddress"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Street address</FormLabel>
                            <FormControl><Input {...field} placeholder="Purok / Street, Barangay" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="emergency" className="mt-0">
                    <p className="text-sm text-muted-foreground mb-4">
                      The person to contact in case of an emergency.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact person</FormLabel>
                            <FormControl><Input {...field} placeholder="Full name" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergencyContactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact number</FormLabel>
                            <FormControl><Input {...field} placeholder="09xx-xxx-xxxx" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Sticky save bar — only visible when form is dirty */}
            {isDirty && (
              <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 shadow-lg">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">You have unsaved changes.</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        reset();
                        navigate('/');
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={saving || photoUploading}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-heading-900 mb-1">Account</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Signed in as {user?.email || user?.username || 'unknown'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-danger-700 border-danger-200 hover:bg-danger-50 hover:text-danger-700"
                onClick={logout}
              >
                <FiLogOut size={14} />
                Sign out of this account
              </Button>
            </div>

            <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
              <FiInfo size={12} className="mt-0.5 shrink-0" />
              <span>Profile picture changes sync automatically to the Libre Sakay mobile app.</span>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
};

export default Profile;
