import {
  Html, Head, Body, Container, Heading,
  Text, Button, Section, Hr,
} from "@react-email/components";

interface Props {
  approverName:     string;
  requesterName:    string;
  assetName:        string;
  assetTag:         string;
  classification:   string;
  entityCode:       string;
  branchName:       string;
  acquisitionValue: number;
  stepLabel:        string;
  actionUrl:        string;
  workflowAction:   string;
}

const fmtNGN = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);

export function AssetApprovalEmail({
  approverName, requesterName, assetName, assetTag, classification,
  entityCode, branchName, acquisitionValue, stepLabel, actionUrl, workflowAction,
}: Props) {
  const actionLabel = workflowAction === "MOVE" ? "Move Approval"
    : workflowAction === "DISPOSE" ? "Disposal Approval"
    : "Asset Registration";

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "DM Sans, Arial, sans-serif", background: "#F4F6FB", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "40px auto", background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #E4E8F0" }}>

          <Section style={{ background: "#1B2A8A", padding: "24px 40px", textAlign: "center" }}>
            <Heading style={{ color: "#FFB800", fontSize: 20, fontWeight: 800, margin: 0 }}>
              ADDOSSER ENTERPRISE HUB
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "4px 0 0" }}>
              {actionLabel} — Approval Required
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px" }}>
            <Text style={{ color: "#6B7280", fontSize: 15, margin: "0 0 12px" }}>
              Hello <strong style={{ color: "#1A1D2E" }}>{approverName}</strong>,
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
              <strong style={{ color: "#1A1D2E" }}>{requesterName}</strong> has submitted an asset {actionLabel.toLowerCase()} that requires your approval (<strong>{stepLabel}</strong>).
            </Text>

            <Section style={{ background: "#F4F6FB", borderRadius: 12, padding: "20px", marginBottom: 24, border: "1px solid #E4E8F0" }}>
              {[
                ["Asset Name",     assetName],
                ["Asset Tag",      assetTag],
                ["Classification", classification],
                ["Entity",         entityCode],
                ["Branch",         branchName],
                ["Acq. Value",     fmtNGN(acquisitionValue)],
              ].map(([label, value]) => (
                <Section key={label} style={{ display: "flex", marginBottom: 6 }}>
                  <Text style={{ margin: 0, fontSize: 12, color: "#9CA3AF", minWidth: 120, fontWeight: 700, textTransform: "uppercase" }}>{label}</Text>
                  <Text style={{ margin: 0, fontSize: 13, color: "#1A1D2E", fontWeight: 600 }}>{value}</Text>
                </Section>
              ))}
            </Section>

            <Button
              href={actionUrl}
              style={{
                display: "block", background: "#FFB800", color: "#1B2A8A",
                padding: "14px 28px", borderRadius: 12, fontWeight: 800,
                fontSize: 15, textDecoration: "none", textAlign: "center",
                margin: "0 0 24px",
              }}
            >
              Review & Approve →
            </Button>

            <Hr style={{ borderColor: "#E4E8F0", margin: "20px 0" }} />
            <Text style={{ color: "#9CA3AF", fontSize: 11, margin: 0 }}>
              You are receiving this because your role has approval access on the Asset Management module.
              Clicking the button above will open the Addosser Hub and automatically mark this notification as read.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
