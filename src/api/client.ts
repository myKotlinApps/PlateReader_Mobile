import { remoteApiRequest } from '../mobile/remoteTransport';

export const identityApi = {
  logout: async () => {
    await remoteApiRequest('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  },
};
