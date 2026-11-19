import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
<<<<<<< HEAD
import { getAccessibleModuleByRole } from "./rbac";
import { getPaymentCaps } from "./payment-access";
import { IDLE_TIMEOUT_MS } from "./session-config";
import { computeMfaStatus } from "./mfa/status";
import { getMfaReauthIntervalDays } from "./mfa/config";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
=======

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 hours
  pages: {
    signIn: "/login",
    error: "/login",
  },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: {
<<<<<<< HEAD
            role: { include: { permissions: { include: { app: true } } } },
=======
            role: {
              include: {
                permissions: { include: { app: true } },
              },
            },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
            entity: true,
          },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

<<<<<<< HEAD
        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!valid) return null;

=======
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Update last login
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

<<<<<<< HEAD
        const crossEntityAccessRows = await prisma.userEntity.findMany({
          where: { userId: user.id },
          select: { entityId: true },
        });
        const consolidatedEntityScope = Array.from(
          new Set([
            user.entityId,
            ...crossEntityAccessRows.map((r) => r.entityId),
          ]),
        );

        const driverRecord = await prisma.driver.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });

=======
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          roleId: user.roleId,
          roleName: user.role.name,
          entityId: user.entityId,
          entityName: user.entity.name,
          entityCode: user.entity.code,
<<<<<<< HEAD
          allowedEntityIds: consolidatedEntityScope,
          isSystem: user.role.isSystem,
          defaultLandingPath: user.role.defaultLandingPath ?? null,
          mustChangePassword: user.mustChangePassword,
          approvalLimit: user.approvalLimit != null ? Number(user.approvalLimit) : null,
          isDriver: !!driverRecord,
          driverId: driverRecord?.id ?? null,
          twoFactorEnabled: user.twoFactorEnabled,
          twoFactorVerifiedAt: user.twoFactorVerifiedAt
            ? user.twoFactorVerifiedAt.getTime()
            : null,
=======
          isSystem: user.role.isSystem,
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          permissions: user.role.permissions.map((p) => ({
            appSlug: p.app.slug,
            canView: p.canView,
            canCreate: p.canCreate,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
            canApprove: p.canApprove,
          })),
        };
      },
    }),
  ],
  callbacks: {
<<<<<<< HEAD
    async jwt({ token, user, trigger, session }) {
=======
    async jwt({ token, user }) {
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      if (user) {
        token.id = user.id;
        token.roleId = (user as any).roleId;
        token.roleName = (user as any).roleName;
        token.entityId = (user as any).entityId;
        token.entityName = (user as any).entityName;
        token.entityCode = (user as any).entityCode;
<<<<<<< HEAD
        token.allowedEntityIds = (user as any).allowedEntityIds;
        token.isSystem = (user as any).isSystem;
        token.defaultLandingPath = (user as any).defaultLandingPath;
        token.permissions = (user as any).permissions;
        token.isDriver = (user as any).isDriver;
        token.driverId = (user as any).driverId;
        token.lastActivityAt = Date.now();

        token.mfaEnabled = (user as any).twoFactorEnabled;
        token.mfaVerifiedAt = (user as any).twoFactorVerifiedAt;
        token.mfaIntervalDays = await getMfaReauthIntervalDays();
      }

      if (trigger === "update") {
        token.lastActivityAt = Date.now();

        if ((session as any)?.mfaSync) {
          const { prisma } = await import("./prisma");
          const fresh = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { twoFactorEnabled: true, twoFactorVerifiedAt: true },
          });
          if (fresh) {
            token.mfaEnabled = fresh.twoFactorEnabled;
            token.mfaVerifiedAt = fresh.twoFactorVerifiedAt
              ? fresh.twoFactorVerifiedAt.getTime()
              : null;
            token.mfaIntervalDays = await getMfaReauthIntervalDays();
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (!session.user || !token.id) return session;

      const lastActivityAt = (token as any).lastActivityAt as number | undefined;
      if (lastActivityAt && Date.now() - lastActivityAt > IDLE_TIMEOUT_MS) {
        (session.user as any).id = null;
        (session.user as any).roleId = null;
        (session.user as any).roleName = null;
        (session.user as any).entityId = null;
        (session.user as any).entityName = null;
        (session.user as any).entityCode = null;
        (session.user as any).allowedEntityIds = [];
        (session.user as any).isSystem = false;
        (session.user as any).defaultLandingPath = null;
        (session.user as any).permissions = [];
        (session.user as any).isDriver = false;
        (session.user as any).driverId = null;
        (session.user as any).sessionExpiredReason = "idle";
        return session;
      }

      const freshUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        include: {
          role: { include: { permissions: { include: { app: true } } } },
          entity: true,
          entityAccess: { select: { entityId: true } },
        },
      });

      if (!freshUser || !freshUser.isActive) {
        (session.user as any).id = token.id;
        (session.user as any).roleId = null;
        (session.user as any).roleName = null;
        (session.user as any).entityId = null;
        (session.user as any).entityName = null;
        (session.user as any).entityCode = null;
        (session.user as any).allowedEntityIds = [];
        (session.user as any).isSystem = false;
        (session.user as any).defaultLandingPath = null;
        (session.user as any).permissions = [];
        (session.user as any).isDriver = false;
        (session.user as any).driverId = null;
        return session;
      }

      const mfaStatus = await computeMfaStatus({
        twoFactorEnabled: freshUser.twoFactorEnabled,
        twoFactorVerifiedAt: freshUser.twoFactorVerifiedAt,
      });
      (session.user as any).mfaStatus = mfaStatus;

      if (mfaStatus !== "verified") {
        (session.user as any).id = freshUser.id;
        (session.user as any).email = freshUser.email;
        (session.user as any).name = freshUser.name;
        (session.user as any).roleId = null;
        (session.user as any).roleName = null;
        (session.user as any).entityId = null;
        (session.user as any).entityName = null;
        (session.user as any).entityCode = null;
        (session.user as any).allowedEntityIds = [];
        (session.user as any).isSystem = false;
        (session.user as any).defaultLandingPath = null;
        (session.user as any).permissions = [];
        (session.user as any).isDriver = false;
        (session.user as any).driverId = null;
        (session.user as any).fleetNav = null;
        return session;
      }

      const allowedEntityIds = Array.from(
        new Set([
          freshUser.entityId,
          ...freshUser.entityAccess.map((r) => r.entityId),
        ]),
      );

      (session.user as any).id = freshUser.id;
      (session.user as any).roleId = freshUser.roleId;
      (session.user as any).roleName = freshUser.role.name;
      (session.user as any).entityId = freshUser.entityId;
      (session.user as any).entityName = freshUser.entity.name;
      (session.user as any).entityCode = freshUser.entity.code;
      (session.user as any).allowedEntityIds = allowedEntityIds;
      (session.user as any).isSystem = freshUser.role.isSystem;
      (session.user as any).defaultLandingPath =
        freshUser.role.defaultLandingPath ?? null;
      (session.user as any).permissions = freshUser.role.permissions.map(
        (p) => ({
          appSlug: p.app.slug,
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canApprove: p.canApprove,
        }),
      );
      (session.user as any).isDriver = (token as any).isDriver ?? false;
      (session.user as any).driverId = (token as any).driverId ?? null;

      (session.user as any).fleetNav = await getAccessibleModuleByRole("fleet", {
        id: freshUser.roleId,
        isSystem: freshUser.role.isSystem,
      });

      const paymentCaps = await getPaymentCaps({
        roleId: freshUser.roleId,
        isSystem: freshUser.role.isSystem,
        permissions: (session.user as any).permissions,
      });
      (session.user as any).paymentCaps = {
        assign: paymentCaps.assign,
        process: paymentCaps.process,
        approve: paymentCaps.approve,
        viewPages: paymentCaps.viewPages,
      };

      (session.user as any).mfaStatus = "verified";

=======
        token.isSystem = (user as any).isSystem;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).roleId = token.roleId;
        (session.user as any).roleName = token.roleName;
        (session.user as any).entityId = token.entityId;
        (session.user as any).entityName = token.entityName;
        (session.user as any).entityCode = token.entityCode;
        (session.user as any).isSystem = token.isSystem;
        (session.user as any).permissions = token.permissions;
      }
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      return session;
    },
  },
};
