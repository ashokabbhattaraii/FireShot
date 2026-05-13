import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient, Role } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { MemoryCacheService } from "../../common/cache/memory-cache.service";
import { AdminActionLogService } from "./admin-action-log.service";

export interface PermissionInput {
  resource: string;
  action: string;
}

type PermissionEffect = "ALLOW" | "DENY";

interface CachedPermission {
  resource: string;
  action: string;
}

interface CachedPermissionOverride extends CachedPermission {
  effect: PermissionEffect;
}

interface CachedPermissionProfile {
  exists: boolean;
  role: "PLAYER" | "ADMIN" | "FINANCE" | "SUPER_ADMIN";
  roleName: string | null;
  rolePermissions: CachedPermission[];
  permissionOverrides: CachedPermissionOverride[];
}

@Injectable()
export class RolesService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private cache: MemoryCacheService,
    private logs: AdminActionLogService,
  ) {}

  async getRolesWithCounts() {
    const roles = await this.prisma.userRole.findMany({
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
      permissions: r.permissions,
      permissionCount: r.permissions.length,
      userCount: r._count.users,
    }));
  }

  async createRole(name: string, permissions: PermissionInput[], adminId: string, ip?: string | null) {
    const conflict = await this.prisma.userRole.findUnique({ where: { name } });
    if (conflict) throw new BadRequestException("Role name already exists");
    const role = await this.prisma.userRole.create({
      data: {
        name,
        isSystem: false,
        permissions: { create: permissions.map((p) => ({ resource: p.resource, action: p.action })) },
      },
      include: { permissions: true },
    });
    await this.logs.log(adminId, "role.create", "role", role.id, null, { name, permissions }, ip);
    this.invalidatePermissionCache();
    return role;
  }

  async updatePermissions(roleId: string, permissions: PermissionInput[], adminId: string, ip?: string | null) {
    const role = await this.prisma.userRole.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });
    if (!role) throw new NotFoundException();
    const old = role.permissions.map(({ resource, action }) => ({ resource, action }));
    await this.prisma.$transaction([
      this.prisma.permission.deleteMany({ where: { roleId } }),
      this.prisma.permission.createMany({
        data: permissions.map((p) => ({ resource: p.resource, action: p.action, roleId })),
      }),
    ]);
    await this.logs.log(adminId, "role.permissions_update", "role", roleId, { permissions: old }, { permissions }, ip);
    this.invalidatePermissionCache();
    return this.prisma.userRole.findUnique({ where: { id: roleId }, include: { permissions: true } });
  }

  async deleteRole(id: string, adminId: string, ip?: string | null) {
    const role = await this.prisma.userRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException();
    if (role.isSystem) throw new ForbiddenException("System roles cannot be deleted");
    await this.prisma.userRole.delete({ where: { id } });
    await this.logs.log(adminId, "role.delete", "role", id, role, null, ip);
    this.invalidatePermissionCache();
    return { ok: true };
  }

  async assignRole(userId: string, roleId: string, adminId: string, ip?: string | null) {
    const role = await this.prisma.userRole.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException("Role not found");
    const before = await this.prisma.user.findUnique({ where: { id: userId }, select: { roleId: true } });
    const nextRole = this.toUserRole(role.name);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId, role: nextRole },
    });
    await this.logs.log(adminId, "user.assign_role", "user", userId, before, { roleId, roleName: role.name }, ip);
    this.invalidatePermissionCache(userId);
    return updated;
  }

  async getRoleUsers(roleId: string, page = 1, limit = 25) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { roleId },
        select: { id: true, email: true, name: true, avatarUrl: true, isBanned: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where: { roleId } }),
    ]);
    return { items, total, page, limit };
  }

  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = await this.getPermissionProfile(userId);
    if (!user.exists) return false;
    if (user.role === "SUPER_ADMIN") return true;

    // Per-user overrides win over role permissions; explicit DENY beats ALLOW.
    const overrides = user.permissionOverrides ?? [];
    const matchOverride = (effect: PermissionEffect) =>
      overrides.some((o) => this.permissionMatches(o, resource, action) && o.effect === effect);
    if (matchOverride("DENY")) return false;
    if (matchOverride("ALLOW")) return true;

    let perms = user.rolePermissions;
    const legacyAdminRoleRef =
      user.role === "ADMIN" && (!user.roleName || user.roleName === "PLAYER");
    if (legacyAdminRoleRef) {
      const adminRole = await this.getRolePermissionsByName("ADMIN");
      perms = adminRole.permissions;
      if (!adminRole.exists) return true;
    }
    if (!perms.length) return false;
    return perms.some((p) => this.permissionMatches(p, resource, action));
  }

  async getUserAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleRef: { include: { permissions: true } },
        permissionOverrides: { orderBy: [{ resource: "asc" }, { action: "asc" }] },
      },
    });
    if (!user) throw new NotFoundException();
    const roles = await this.prisma.userRole.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        roleName: user.roleRef?.name ?? null,
        rolePermissions: user.roleRef?.permissions ?? [],
        overrides: user.permissionOverrides,
      },
      availableRoles: roles,
    };
  }

  async setUserOverrides(
    userId: string,
    overrides: { resource: string; action: string; effect: "ALLOW" | "DENY" }[],
    adminId: string,
    ip?: string | null,
  ) {
    const before = await this.prisma.userPermission.findMany({ where: { userId } });
    await this.prisma.$transaction([
      this.prisma.userPermission.deleteMany({ where: { userId } }),
      ...(overrides.length
        ? [
            this.prisma.userPermission.createMany({
              data: overrides.map((o) => ({ ...o, userId })),
            }),
          ]
        : []),
    ]);
    await this.logs.log(
      adminId,
      "user.permissions_update",
      "user",
      userId,
      { overrides: before.map(({ resource, action, effect }) => ({ resource, action, effect })) },
      { overrides },
      ip,
    );
    this.invalidatePermissionCache(userId);
    return this.prisma.userPermission.findMany({ where: { userId } });
  }

  async ensurePlayerRoleId(): Promise<string | null> {
    const r = await this.prisma.userRole.findUnique({ where: { name: "PLAYER" } });
    return r?.id ?? null;
  }

  async ensureSuperAdminRoleId(): Promise<string | null> {
    const r = await this.prisma.userRole.findUnique({ where: { name: "SUPER_ADMIN" } });
    return r?.id ?? null;
  }

  private getPermissionProfile(userId: string): Promise<CachedPermissionProfile> {
    return this.cache.getStaleWhileRevalidate(
      `permissions:user:${userId}`,
      30,
      300,
      async () => {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            role: true,
            roleRef: {
              select: {
                name: true,
                permissions: { select: { resource: true, action: true } },
              },
            },
            permissionOverrides: {
              select: { resource: true, action: true, effect: true },
            },
          },
        });
        if (!user) {
          return {
            exists: false,
            role: "PLAYER",
            roleName: null,
            rolePermissions: [],
            permissionOverrides: [],
          };
        }
        return {
          exists: true,
          role: user.role,
          roleName: user.roleRef?.name ?? null,
          rolePermissions: user.roleRef?.permissions ?? [],
          permissionOverrides: user.permissionOverrides,
        };
      },
    );
  }

  private getRolePermissionsByName(
    name: string,
  ): Promise<{ exists: boolean; permissions: CachedPermission[] }> {
    return this.cache.getStaleWhileRevalidate(
      `permissions:role-name:${name}`,
      60,
      600,
      async () => {
        const role = await this.prisma.userRole.findUnique({
          where: { name },
          select: { permissions: { select: { resource: true, action: true } } },
        });
        return { exists: !!role, permissions: role?.permissions ?? [] };
      },
    );
  }

  private permissionMatches(permission: CachedPermission, resource: string, action: string) {
    return (
      (permission.resource === resource || permission.resource === "*") &&
      (permission.action === action || permission.action === "*")
    );
  }

  private invalidatePermissionCache(userId?: string) {
    if (userId) {
      this.cache.del(`permissions:user:${userId}`);
      return;
    }
    this.cache.delPrefix("permissions:");
  }

  private toUserRole(roleName: string): Role {
    switch (roleName) {
      case "PLAYER":
        return Role.PLAYER;
      case "ADMIN":
        return Role.ADMIN;
      case "FINANCE":
        return Role.FINANCE;
      case "SUPER_ADMIN":
        return Role.SUPER_ADMIN;
      default:
        return Role.ADMIN;
    }
  }
}
