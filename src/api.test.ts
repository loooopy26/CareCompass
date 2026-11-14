import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('aws-amplify', () => ({ Amplify: { configure: vi.fn() } }));
vi.mock('aws-amplify/auth', () => ({
  updatePassword: vi.fn(),
  deleteUser: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: null }),
}));

const cognito = await import('aws-amplify/auth');
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubEnv('VITE_API_URL', 'https://api.example.test');
vi.stubEnv('VITE_COGNITO_REGION', 'us-east-1');
vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-1_test');
vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'client');
const { deleteAccount } = await import('./api');

const cognitoError = (name: string) => Object.assign(new Error(name), { name });

beforeEach(() => {
  vi.mocked(cognito.updatePassword).mockReset().mockResolvedValue(undefined);
  vi.mocked(cognito.deleteUser).mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
});

describe('계정 삭제 비밀번호 확인', () => {
  it('비밀번호가 틀리면 서버를 부르지 않고 NotAuthorizedException으로 멈춘다', async () => {
    vi.mocked(cognito.updatePassword).mockRejectedValue(cognitoError('NotAuthorizedException'));
    await expect(deleteAccount({ password: 'wrong' })).rejects.toMatchObject({ code: 'NotAuthorizedException' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cognito.deleteUser).not.toHaveBeenCalled();
  });

  it('비밀번호가 맞으면 서버에서 지운 뒤 Cognito 사용자를 지운다', async () => {
    await deleteAccount({ password: 'right' });
    expect(cognito.updatePassword).toHaveBeenCalledWith({ oldPassword: 'right', newPassword: 'right' });
    expect(fetchMock).toHaveBeenCalledWith('/v1/me/delete', expect.objectContaining({ method: 'POST' }));
    expect(cognito.deleteUser).toHaveBeenCalled();
  });

  it('비밀번호 재사용 금지 정책 오류는 맞은 비밀번호로 본다', async () => {
    vi.mocked(cognito.updatePassword).mockRejectedValue(cognitoError('PasswordHistoryPolicyViolationException'));
    await deleteAccount({ password: 'right' });
    expect(cognito.deleteUser).toHaveBeenCalled();
  });
});
