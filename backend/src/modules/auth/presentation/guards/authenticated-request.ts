import { Request } from 'express';
import { AuthUser } from '../../../users/domain/user';

export type AuthenticatedRequest = Request & { user: AuthUser };
