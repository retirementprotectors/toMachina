'use client'

import type { Client } from '@tomachina/core'
import { formatPhone, str } from '../../lib/formatters'
import { InlineField, InlineToggle, InlineSection, ReadOnlyField } from '../../lib/inline-edit'
import { FieldGrid } from '../../lib/ui-helpers'

interface ContactTabProps {
  client: Client
  clientId: string
}

const PHONE_TYPE_OPTIONS = [
  { label: 'Home', value: 'Home' },
  { label: 'Cell', value: 'Cell' },
  { label: 'Work', value: 'Work' },
  { label: 'Fax', value: 'Fax' },
]

const RELATIONSHIP_OPTIONS = [
  { label: 'Client', value: 'Client' },
  { label: 'Prospect', value: 'Prospect' },
  { label: 'Referrer', value: 'Referrer' },
  { label: 'Family', value: 'Family' },
  { label: 'Business Partner', value: 'Business Partner' },
  { label: 'Other', value: 'Other' },
]

export function ContactTab({ client, clientId }: ContactTabProps) {
  const docPath = `clients/${clientId}`

  return (
    <div className="space-y-4">
      {/* Phone Numbers */}
      <InlineSection title="Phone Numbers" icon="phone">
        <FieldGrid cols={3}>
          <InlineField
            label="Cell Phone"
            value={str(client.cell_phone)}
            fieldKey="cell_phone"
            docPath={docPath}
            type="tel"
            formatDisplay={formatPhone}
          />
          <InlineField
            label="Alt Phone"
            value={str(client.alt_phone)}
            fieldKey="alt_phone"
            docPath={docPath}
            type="tel"
            formatDisplay={formatPhone}
          />
          <InlineField
            label="Phone Type"
            value={str(client.phone_type)}
            fieldKey="phone_type"
            docPath={docPath}
            type="select"
            options={PHONE_TYPE_OPTIONS}
          />
          <InlineField
            label="Primary Phone"
            value={str(client.phone)}
            fieldKey="phone"
            docPath={docPath}
            type="tel"
            formatDisplay={formatPhone}
          />
          <InlineField
            label="Alt Phone Type"
            value={str(client.alt_phone_type)}
            fieldKey="alt_phone_type"
            docPath={docPath}
            type="select"
            options={PHONE_TYPE_OPTIONS}
          />
        </FieldGrid>
      </InlineSection>

      {/* Email */}
      <InlineSection title="Email" icon="email">
        <FieldGrid cols={2}>
          <InlineField
            label="Primary Email"
            value={str(client.email)}
            fieldKey="email"
            docPath={docPath}
            type="email"
          />
          <InlineField
            label="Secondary Email"
            value={str(client.secondary_email)}
            fieldKey="secondary_email"
            docPath={docPath}
            type="email"
          />
        </FieldGrid>
      </InlineSection>

      {/* Address */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InlineSection title="Primary Address" icon="home">
          <div className="space-y-3">
            <InlineField label="Street" value={str(client.address)} fieldKey="address" docPath={docPath} placeholder="Start typing address..." />
            <InlineField label="Street 2" value={str(client.address2)} fieldKey="address2" docPath={docPath} />
            <FieldGrid cols={2}>
              <InlineField label="City" value={str(client.city)} fieldKey="city" docPath={docPath} />
              <InlineField label="State" value={str(client.state)} fieldKey="state" docPath={docPath} />
            </FieldGrid>
            <FieldGrid cols={2}>
              <InlineField label="ZIP" value={str(client.zip)} fieldKey="zip" docPath={docPath} />
              <InlineField label="County" value={str(client.county)} fieldKey="county" docPath={docPath} />
            </FieldGrid>
          </div>
        </InlineSection>

        <InlineSection title="Mailing Address" icon="markunread_mailbox">
          <div className="space-y-3">
            <InlineField label="Street" value={str(client.mailing_address)} fieldKey="mailing_address" docPath={docPath} />
            <InlineField label="Street 2" value={str(client.mailing_address2)} fieldKey="mailing_address2" docPath={docPath} />
            <FieldGrid cols={2}>
              <InlineField label="City" value={str(client.mailing_city)} fieldKey="mailing_city" docPath={docPath} />
              <InlineField label="State" value={str(client.mailing_state)} fieldKey="mailing_state" docPath={docPath} />
            </FieldGrid>
            <InlineField label="ZIP" value={str(client.mailing_zip)} fieldKey="mailing_zip" docPath={docPath} />
          </div>
        </InlineSection>
      </div>

      {/* RPI Relationship */}
      <InlineSection title="RPI Relationship" icon="handshake">
        <FieldGrid cols={3}>
          <InlineField
            label="Relationship"
            value={str(client.rpi_relationship)}
            fieldKey="rpi_relationship"
            docPath={docPath}
            type="select"
            options={RELATIONSHIP_OPTIONS}
          />
          <ReadOnlyField label="Agent" value={str(client.agent_name)} />
          <ReadOnlyField label="Book of Business" value={str(client.book_of_business)} />
          <ReadOnlyField label="Source" value={str(client.source)} />
        </FieldGrid>
      </InlineSection>

      {/* Social */}
      <InlineSection title="Social Profiles" icon="share">
        <FieldGrid cols={3}>
          <InlineField label="Facebook" value={str(client.facebook_url)} fieldKey="facebook_url" docPath={docPath} placeholder="Facebook profile URL" />
          <InlineField label="LinkedIn" value={str(client.linkedin_url)} fieldKey="linkedin_url" docPath={docPath} placeholder="LinkedIn profile URL" />
          <InlineField label="Other" value={str(client.social_other)} fieldKey="social_other" docPath={docPath} placeholder="Other social URL" />
        </FieldGrid>
      </InlineSection>

      {/* Do Not Contact */}
      <InlineSection title="Do Not Contact (DND)" icon="do_not_disturb">
        <div className="space-y-2">
          <InlineToggle label="All Channels" value={Boolean(client.dnc_all)} fieldKey="dnc_all" docPath={docPath} />
          <InlineToggle label="Phone" value={Boolean(client.dnc_phone)} fieldKey="dnc_phone" docPath={docPath} />
          <InlineToggle label="Text/SMS" value={Boolean(client.dnc_sms)} fieldKey="dnc_sms" docPath={docPath} />
          <InlineToggle label="Email" value={Boolean(client.dnc_email)} fieldKey="dnc_email" docPath={docPath} />
          <InlineToggle label="Mail" value={Boolean(client.dnc_mail)} fieldKey="dnc_mail" docPath={docPath} />
        </div>
      </InlineSection>
    </div>
  )
}
