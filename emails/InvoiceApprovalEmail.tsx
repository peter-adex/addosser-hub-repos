import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Hr
} from '@react-email/components'

type EventType =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECALLED'
  | 'EXCEPTIONAL'

interface Props {
  recipientName: string
  requesterName: string
  invoiceNo: string
  invoiceType: string
  vendorName: string
  entityCode: string
  glCode: string
  glName?: string
  amountPayable: number
  eventType: EventType
  stepLabel?: string
  comment?: string
  isBudgetExceeded?: boolean
  exceptionalJustification?: string
  actionUrl: string
}

const fmtNGN = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(n)

const EVENT_META: Record<
  EventType,
  { subject: string; headingColor: string; intro: string }
> = {
  PENDING: {
    subject: 'Invoice Approval Required',
    headingColor: '#d97706',
    intro: 'A new invoice requires your approval.'
  },
  APPROVED: {
    subject: 'Invoice Approved ✅',
    headingColor: '#16a34a',
    intro: 'Your invoice has been approved.'
  },
  REJECTED: {
    subject: 'Invoice Rejected ❌',
    headingColor: '#dc2626',
    intro: 'Your invoice has been rejected.'
  },
  RECALLED: {
    subject: 'Invoice Recalled 🔄',
    headingColor: '#6b7280',
    intro: 'An invoice requisition has been recalled by the submitter.'
  },
  EXCEPTIONAL: {
    subject: '⚠️ Exceptional Invoice — Budget Override Approval Required',
    headingColor: '#dc2626',
    intro:
      'This invoice exceeds the GL budget and requires approval from an approver configured with Exceptional Approval Workflow permission.'
  }
}

export function InvoiceApprovalEmail ({
  recipientName,
  requesterName,
  invoiceNo,
  invoiceType,
  vendorName,
  entityCode,
  glCode,
  glName,
  amountPayable,
  eventType,
  stepLabel,
  comment,
  isBudgetExceeded,
  exceptionalJustification,
  actionUrl
}: Props) {
  const meta = EVENT_META[eventType]

  return (
    <Html>
      <Head />
      <Body
        style={{
          fontFamily: 'DM Sans, Arial, sans-serif',
          background: '#F4F6FB',
          margin: 0,
          padding: 0
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: '40px auto',
            background: '#fff',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid #E4E8F0'
          }}
        >
          <Section
            style={{
              background: '#1B2A8A',
              padding: '24px 40px',
              textAlign: 'center'
            }}
          >
            <Heading
              style={{
                color: '#FFB800',
                fontSize: 20,
                fontWeight: 800,
                margin: 0
              }}
            >
              ADDOSSER ENTERPRISE HUB
            </Heading>
            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                margin: '4px 0 0'
              }}
            >
              Invoice Processing
            </Text>
          </Section>

          <Section style={{ padding: '32px 40px' }}>
            {isBudgetExceeded && (
              <Section
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 16
                }}
              >
                <Text
                  style={{
                    margin: 0,
                    color: '#dc2626',
                    fontWeight: 700,
                    fontSize: 13
                  }}
                >
                  ⚠️ EXCEPTIONAL APPROVAL — Invoice amount exceeds GL budget for{' '}
                  {entityCode}
                </Text>
                {exceptionalJustification && (
                  <Text
                    style={{
                      margin: '8px 0 0',
                      color: '#7f1d1d',
                      fontSize: 13,
                      lineHeight: 1.5
                    }}
                  >
                    <strong>Requester&apos;s Justification:</strong>{' '}
                    {exceptionalJustification}
                  </Text>
                )}
              </Section>
            )}

            <Heading
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: meta.headingColor,
                marginTop: 0
              }}
            >
              {meta.subject}
            </Heading>

            <Text
              style={{
                color: '#6B7280',
                fontSize: 15,
                lineHeight: 1.6,
                margin: '0 0 20px'
              }}
            >
              Hello{' '}
              <strong style={{ color: '#1A1D2E' }}>{recipientName}</strong>,
              <br />
              {meta.intro}
              {eventType === 'PENDING' && requesterName && (
                <>
                  {' '}
                  Submitted by <strong>{requesterName}</strong>
                  {stepLabel ? ` — ${stepLabel}` : ''}.
                </>
              )}
            </Text>

            <Section
              style={{
                background: '#F4F6FB',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                border: '1px solid #E4E8F0'
              }}
            >
              {(
                [
                  ['Invoice Type', invoiceType],
                  ['Invoice No.', invoiceNo],
                  ['Vendor', vendorName],
                  ['Entity', entityCode],
                  ['GL Account', glName ? `${glCode} — ${glName}` : glCode],
                  ['Amount Payable', fmtNGN(amountPayable)]
                ] as [string, string][]
              ).map(([label, value]) => (
                <Section key={label} style={{ marginBottom: 6 }}>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: '#9CA3AF',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: '#1A1D2E',
                      fontWeight: 600
                    }}
                  >
                    {value}
                  </Text>
                </Section>
              ))}
            </Section>

            {comment && (
              <Section
                style={{
                  background: '#FFF9E6',
                  borderRadius: 10,
                  padding: '14px 16px',
                  marginBottom: 20,
                  border: '1px solid #FFB800'
                }}
              >
                <Text style={{ margin: 0, fontSize: 13, color: '#92400E' }}>
                  <strong>Comment:</strong> {comment}
                </Text>
              </Section>
            )}

            <Button
              href={actionUrl}
              style={{
                display: 'block',
                background: '#FFB800',
                color: '#1B2A8A',
                padding: '14px 28px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 15,
                textDecoration: 'none',
                textAlign: 'center',
                marginBottom: 24
              }}
            >
              {eventType === 'PENDING' || eventType === 'EXCEPTIONAL'
                ? 'Review Invoice →'
                : 'View Invoice →'}
            </Button>

            <Hr style={{ borderColor: '#E4E8F0', margin: '20px 0' }} />
            <Text style={{ color: '#9CA3AF', fontSize: 11, margin: 0 }}>
              Clicking the button above opens the Addosser Hub and marks this
              notification as read automatically.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
