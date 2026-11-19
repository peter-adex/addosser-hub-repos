import { Html, Head, Body, Container, Heading, Text, Section, Hr } from "@react-email/components";

interface Props {
  name: string;
  action: "APPROVED" | "REJECTED";
  glName: string;
  entity: string;
  year: number;
  comment?: string;
}

export function BudgetApprovalEmail({ name, action, glName, entity, year, comment }: Props) {
  const approved = action === "APPROVED";

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "DM Sans, Arial, sans-serif", background: "#F4F6FB", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #E4E8F0" }}>
          <Section style={{ background: "#1B2A8A", padding: "28px 40px", textAlign: "center" }}>
            <Heading style={{ color: "#FFB800", fontSize: 20, fontWeight: 800, margin: 0 }}>ADDOSSER ENTERPRISE HUB</Heading>
          </Section>

          <Section style={{ padding: "40px" }}>
            <Heading style={{ fontSize: 22, fontWeight: 800, color: approved ? "#16a34a" : "#dc2626", marginTop: 0 }}>
              Budget {approved ? "Approved ✅" : "Rejected ❌"}
            </Heading>
            <Text style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6 }}>Hello {name},</Text>
            <Text style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6 }}>
              Your budget submission has been <strong style={{ color: approved ? "#16a34a" : "#dc2626" }}>{action.toLowerCase()}</strong>.
            </Text>

            <Section style={{ background: "#F4F6FB", borderRadius: 12, padding: "20px", margin: "24px 0", border: "1px solid #E4E8F0" }}>
              <Text style={{ margin: "4px 0", fontSize: 14, color: "#1A1D2E" }}><strong>GL Account:</strong> {glName}</Text>
              <Text style={{ margin: "4px 0", fontSize: 14, color: "#1A1D2E" }}><strong>Entity:</strong> {entity}</Text>
              <Text style={{ margin: "4px 0", fontSize: 14, color: "#1A1D2E" }}><strong>Financial Year:</strong> {year}</Text>
            </Section>

            {comment && (
              <Section style={{ background: "#FFF9E6", borderRadius: 10, padding: "16px", border: "1px solid #FFB800" }}>
                <Text style={{ margin: 0, fontSize: 14, color: "#92400E" }}><strong>Reviewer comment:</strong> {comment}</Text>
              </Section>
            )}

            <Hr style={{ borderColor: "#E4E8F0", margin: "24px 0" }} />
            <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
              Log in to the Addosser Enterprise Hub to view full details.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
