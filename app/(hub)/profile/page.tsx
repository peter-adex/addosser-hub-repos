import { Metadata } from "next";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const sessionUser = await requireAuth();

  const user = await prisma.user.findUnique({
    where:   { id: sessionUser.id },
    include: { role: true, entity: true, entityAccess: { include: { entity: true } } },
  });

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Update your personal information and account settings</p>
      </div>

      <ProfileForm user={{
        id:          user.id,
        name:        user.name,
        email:       user.email,
        avatar:      user.avatar ?? null,
        roleName:    user.role.name,
        entityName:  user.entity.name,
        entityCode:  user.entity.code,
        extraEntities: user.entityAccess.map((ea) => ({ id: ea.entity.id, name: ea.entity.name, code: ea.entity.code })),
        pendingName: user.pendingName ?? null,
        pendingNameRequestedAt: user.pendingNameRequestedAt?.toISOString() ?? null,
        createdAt:   user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      }} />
    </div>
  );
}
