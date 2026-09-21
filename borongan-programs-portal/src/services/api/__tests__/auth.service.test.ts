/**
 * auth.service.test.ts
 *
 * Minimal TDD-style tests for the new updateMyProfile() method.
 *
 * WHAT: Verifies that authService.updateMyProfile() calls PUT /residents/me
 *       with the right payload, and translates backend errors correctly.
 *
 * WHY:  The Profile page depends on this method. The endpoint contract
 *       (path, method, error shape) is what the backend relies on.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('axios', () => {
  const mockApi = {
    put: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { response: { use: vi.fn() } },
  };
  return {
    default: {
      create: () => mockApi,
    },
  };
});

import axios from 'axios';
import { authService } from '../auth.service';

const mockApi = (axios as unknown as { create: () => { put: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> } }).create();

describe('authService.updateMyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PUT /residents/me with the provided payload', async () => {
    mockApi.put.mockResolvedValueOnce({ data: { data: {} } });
    await authService.updateMyProfile({ firstName: 'Test', picturePath: '/x.png' });
    expect(mockApi.put).toHaveBeenCalledWith('/residents/me', {
      firstName: 'Test',
      picturePath: '/x.png',
    });
  });

  it('passes empty payload when called with no arguments (sanity check)', async () => {
    mockApi.put.mockResolvedValueOnce({ data: { data: {} } });
    await authService.updateMyProfile({});
    expect(mockApi.put).toHaveBeenCalledWith('/residents/me', {});
  });

  it('throws the backend error message when the server returns one', async () => {
    mockApi.put.mockRejectedValueOnce({
      response: { data: { message: 'Invalid email' } },
    });
    await expect(authService.updateMyProfile({ email: 'bad' })).rejects.toThrow('Invalid email');
  });

  it('falls back to err.message when no response body is present', async () => {
    mockApi.put.mockRejectedValueOnce(new Error('Network down'));
    await expect(authService.updateMyProfile({})).rejects.toThrow('Network down');
  });

  it('falls back to the generic message when nothing else is available', async () => {
    mockApi.put.mockRejectedValueOnce({});
    await expect(authService.updateMyProfile({})).rejects.toThrow('Failed to update profile');
  });
});
