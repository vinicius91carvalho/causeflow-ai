import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CreateUserUseCase } from '../application/create-user.usecase.js';
import type { ListUsersUseCase } from '../application/list-users.usecase.js';
import type { UpdateUserUseCase } from '../application/update-user.usecase.js';
import type { DeleteUserUseCase } from '../application/delete-user.usecase.js';
import type { CreateInviteUseCase } from '../application/create-invite.usecase.js';
import type { ListInvitesUseCase } from '../application/list-invites.usecase.js';
import type { RevokeInviteUseCase } from '../application/revoke-invite.usecase.js';
import type { GetSettingsUseCase } from '../application/get-settings.usecase.js';
import type { UpdateSettingsUseCase } from '../application/update-settings.usecase.js';
import type { GetUserByEmailUseCase } from '../application/get-user-by-email.usecase.js';
import type { AcceptInviteUseCase } from '../application/accept-invite.usecase.js';
export interface UserUseCases {
    createUser: CreateUserUseCase;
    listUsers: ListUsersUseCase;
    updateUser: UpdateUserUseCase;
    deleteUser: DeleteUserUseCase;
    createInvite: CreateInviteUseCase;
    listInvites: ListInvitesUseCase;
    revokeInvite: RevokeInviteUseCase;
    getSettings: GetSettingsUseCase;
    updateSettings: UpdateSettingsUseCase;
    getUserByEmail?: GetUserByEmailUseCase;
    acceptInvite?: AcceptInviteUseCase;
}
export declare function createUserRoutes(useCases: UserUseCases): {
    users: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
    invites: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
};
