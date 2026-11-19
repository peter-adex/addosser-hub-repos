import { Html, Head, Body, Container, Heading, Text, Button, Section, Hr, Img } from "@react-email/components";

interface Props {
  name: string;
  inviterName: string;
  role: string;
  entity: string;
  inviteUrl: string;
}

export function InvitationEmail({ name, inviterName, role, entity, inviteUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "DM Sans, Arial, sans-serif", background: "#F4F6FB", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #E4E8F0" }}>
<<<<<<< HEAD
=======
          {/* Header */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          <Section style={{ background: "#1B2A8A", padding: "32px 40px", textAlign: "center" }}>
            <Heading style={{ color: "#FFB800", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "0.04em" }}>
              ADDOSSER ENTERPRISE HUB
            </Heading>
          </Section>

<<<<<<< HEAD
=======
          {/* Body */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          <Section style={{ padding: "40px" }}>
            <Heading style={{ fontSize: 22, fontWeight: 800, color: "#1A1D2E", marginTop: 0 }}>
              You&apos;ve been invited 🎉
            </Heading>
            <Text style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6 }}>
              Hello {name}, <strong>{inviterName}</strong> has invited you to join the <strong>Addosser Enterprise Hub</strong>.
            </Text>

            <Section style={{ background: "#F4F6FB", borderRadius: 12, padding: "20px", margin: "24px 0", border: "1px solid #E4E8F0" }}>
              <Text style={{ margin: "4px 0", fontSize: 14, color: "#1A1D2E" }}>
                <strong>Role:</strong> {role}
              </Text>
              <Text style={{ margin: "4px 0", fontSize: 14, color: "#1A1D2E" }}>
                <strong>Entity:</strong> {entity}
              </Text>
            </Section>

            <Text style={{ color: "#6B7280", fontSize: 14 }}>
              Click the button below to set up your account. This link expires in <strong>7 days</strong>.
            </Text>

            <Button
              href={inviteUrl}
              style={{
                display: "block",
                background: "#FFB800",
                color: "#1B2A8A",
                padding: "14px 28px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 15,
                textDecoration: "none",
                textAlign: "center",
                margin: "28px 0",
              }}
            >
              Accept Invitation →
            </Button>

            <Hr style={{ borderColor: "#E4E8F0", margin: "24px 0" }} />
            <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
              If you didn&apos;t expect this invitation, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
