import {
  Html, Head, Body, Container, Heading,
  Text, Button, Section, Hr, Row, Column, Img,
} from "@react-email/components";

interface Props {
  approverName:  string;
  submitterName: string;
  budgetType:    "OPEX" | "CAPEX";
  entityName:    string;
  glCode:        string;
  glName:        string;
  glCategory:    string;
  financialYear: number;
  annualAmount:  string;
  distributionType: string;
  stepNumber:    number;
  totalSteps:    number;
  budgetUrl:     string;
}

const NAVY   = "#1B2A8A";
const GOLD   = "#FFB800";
const BG     = "#F4F6FB";
const CARD   = "#FFFFFF";
const MUTED  = "#6B7280";
const BORDER = "#E4E8F0";

const TYPE_COLOR: Record<string, string> = { OPEX: "#0284c7", CAPEX: "#7c3aed" };
const TYPE_BG:    Record<string, string> = { OPEX: "#e0f2fe", CAPEX: "#ede9fe" };

export function BudgetSubmittedEmail({
  approverName,
  submitterName,
  budgetType,
  entityName,
  glCode,
  glName,
  glCategory,
  financialYear,
  annualAmount,
  distributionType,
  stepNumber,
  totalSteps,
  budgetUrl,
}: Props) {
  const typeBg    = TYPE_BG[budgetType]    ?? "#e0f2fe";
  const typeColor = TYPE_COLOR[budgetType] ?? "#0284c7";

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "'DM Sans', Arial, sans-serif", background: BG, margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 600, margin: "40px auto" }}>

          <Section style={{ background: NAVY, padding: "28px 40px", borderRadius: "16px 16px 0 0", textAlign: "center" }}>
            <Heading style={{ color: GOLD, fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "0.06em" }}>
              ADDOSSER ENTERPRISE HUB
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, margin: "4px 0 0", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Budget Approval Request
            </Text>
          </Section>

          <Section style={{ background: CARD, padding: "40px", border: `1px solid ${BORDER}`, borderTop: "none" }}>

            <Heading style={{ fontSize: 22, fontWeight: 800, color: "#1A1D2E", margin: "0 0 8px" }}>
              Action Required: Budget Approval
            </Heading>
            <Text style={{ color: MUTED, fontSize: 15, lineHeight: "1.6", margin: "0 0 24px" }}>
              Hello <strong style={{ color: "#1A1D2E" }}>{approverName}</strong>, a new budget line has been submitted
              and requires your approval as <strong>Approver {stepNumber} of {totalSteps}</strong>.
            </Text>

            <Section style={{ background: typeBg, borderRadius: 10, padding: "12px 16px", marginBottom: 24, border: `1px solid ${typeColor}30` }}>
              <Text style={{ margin: 0, fontSize: 13, color: typeColor, fontWeight: 700 }}>
                {budgetType === "OPEX" ? "📊" : "🏗️"} {budgetType} Budget
                &nbsp;—&nbsp;
                {budgetType === "OPEX" ? "Operating Expenditure: recurring day-to-day costs" : "Capital Expenditure: long-term asset investment"}
              </Text>
            </Section>

            <Section style={{ background: "#F8FAFC", borderRadius: 12, padding: "20px 24px", marginBottom: 24, border: `1px solid ${BORDER}` }}>
              <Heading style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px" }}>
                Budget Details
              </Heading>
              {[
                ["Entity",             entityName],
                ["GL Code",            glCode],
                ["GL Account",         glName],
                ["Category",           glCategory],
                ["Financial Year",     String(financialYear)],
                ["Annual Amount",      annualAmount],
                ["Distribution",       distributionType === "EQUAL" ? "Equal Monthly" : distributionType === "WEIGHTED" ? "Weighted" : "Manual Entry"],
                ["Submitted By",       submitterName],
                ["Approval Step",      `Step ${stepNumber} of ${totalSteps}`],
              ].map(([label, value]) => (
                <Row key={label} style={{ marginBottom: 10 }}>
                  <Column style={{ width: "40%", verticalAlign: "top" }}>
                    <Text style={{ margin: 0, fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {label}
                    </Text>
                  </Column>
                  <Column style={{ width: "60%", verticalAlign: "top" }}>
                    <Text style={{ margin: 0, fontSize: 13, fontWeight: label === "Annual Amount" ? 800 : 500, color: label === "Annual Amount" ? NAVY : "#1A1D2E" }}>
                      {value}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>

            <Text style={{ fontSize: 14, color: MUTED, marginBottom: 16 }}>
              Please review the budget details and take action. You can approve or reject with a comment directly in the hub.
            </Text>
            <Button
              href={budgetUrl}
              style={{
                display: "block",
                background: GOLD,
                color: NAVY,
                padding: "14px 32px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 15,
                textDecoration: "none",
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Review & Approve Budget →
            </Button>

            <Hr style={{ borderColor: BORDER, margin: "24px 0" }} />

            <Text style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Approval Chain
            </Text>
            <Section style={{ display: "flex", gap: 8 }}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <Row key={i}>
                  <Column>
                    <Section style={{
                      display: "inline-block",
                      width: 28, height: 28,
                      borderRadius: 999,
                      background: i + 1 < stepNumber ? "#16a34a" : i + 1 === stepNumber ? GOLD : BORDER,
                      textAlign: "center",
                      lineHeight: "28px",
                      fontSize: 12, fontWeight: 800,
                      color: i + 1 <= stepNumber ? NAVY : MUTED,
                    }}>
                      {i + 1 < stepNumber ? "✓" : i + 1}
                    </Section>
                    {i < totalSteps - 1 && (
                      <Section style={{ display: "inline-block", width: 20, height: 2, background: i + 1 < stepNumber ? "#16a34a" : BORDER, verticalAlign: "middle", margin: "0 4px" }} />
                    )}
                  </Column>
                </Row>
              ))}
            </Section>

            <Hr style={{ borderColor: BORDER, margin: "24px 0" }} />

            <Text style={{ color: MUTED, fontSize: 12, lineHeight: "1.5", margin: 0 }}>
              This notification was sent because your role has approval authority on the Budgeting module.
              If you believe this was sent in error, please contact your system administrator.
              <br /><br />
              <strong>Addosser Enterprise Hub</strong> — Do not reply to this email.
            </Text>
          </Section>

          <Section style={{ background: NAVY, padding: "16px 40px", borderRadius: "0 0 16px 16px", textAlign: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>
              © {new Date().getFullYear()} Addosser Group · Powered by Addosser Enterprise Hub
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
